import AsyncStorage from "@react-native-async-storage/async-storage";
import {logUtilsEvent} from "./analytics";

type PaidEvent = {
    currency?: string;
    currencyCode?: string;
    precision?: number | string;
    value?: number;
    responseInfo?: {responseId?: string | null} | null;
};

const KEY = "@expo_utils_taichi_v1";
// Strings preservam o contrato dos nomes (inclusive 0.10). Valores em USD, não micros.
const LIMITS = ["0.0001", "0.0002", "0.0003", "0.0005", "0.00075", "0.001", "0.0015", "0.002", "0.003", "0.004",
    "0.005", "0.0075", "0.01", "0.015", "0.02", "0.03", "0.05", "0.075", "0.10", "0.25"];
const WINDOWS = {"24h": 24, "72h": 72, "7d": 168};
type State = {firstOpen: number; usd: number; sent: string[]};
let state: State | undefined;
let initialized: Promise<void> | undefined;
let queue = Promise.resolve();
const seen = new WeakSet<object>();
const responseIds = new Set<string>();

/** Interno: começa no prepare, antes da flag legada de first_open; nunca bloqueia a UI. */
export function initAdRevenue(): Promise<void> {
    if (!initialized) {
        const firstOpen = Date.now();
        initialized = queue = (async () => {
            const [saved, legacy] = await Promise.all([
                AsyncStorage.getItem(KEY), AsyncStorage.getItem("@first_open_logged"),
            ]);
            const parsed: State = saved ? JSON.parse(saved) : {firstOpen: legacy ? 0 : firstOpen, usd: 0, sent: []};
            if (!Number.isFinite(parsed.firstOpen) || parsed.firstOpen < 0 || !Number.isFinite(parsed.usd) || parsed.usd < 0
                || !Array.isArray(parsed.sent) || !parsed.sent.every((name) => typeof name === "string")) return;
            if (!saved) await AsyncStorage.setItem(KEY, JSON.stringify(parsed));
            state = parsed;
        })().catch(() => {}); // Storage ilegível: não inventar um novo primeiro uso.
    }
    return initialized;
}

/**
 * Receita observada de uma impressão. A instância identifica cada apresentação fullscreen;
 * banners usam responseId quando o SDK o fornece, ou a identidade do payload do callback.
 * Best-effort: não lança, não espera e não depende de timers. value já está em unidades da moeda.
 */
export function logAdRevenue(format: string, placementId: string, event?: PaidEvent, impression: object | undefined = event): void {
    try {
        const id = event?.responseInfo?.responseId;
        if ((impression && seen.has(impression)) || (id && responseIds.has(id))) return;
        if (impression) seen.add(impression);
        if (id) {
            responseIds.add(id);
            if (responseIds.size > 128) responseIds.delete(responseIds.values().next().value!);
        }
        const value = event?.value;
        const currency = event?.currency || event?.currencyCode;
        logUtilsEvent("ad_revenue", {format, placementId, value, currency, precision: String(event?.precision ?? "UNKNOWN")});
        if (!initialized || typeof value !== "number" || !Number.isFinite(value) || value <= 0 || currency !== "USD") return;
        const at = Date.now(); // Momento do callback, não o da gravação assíncrona.
        const enabled = globalThis.remoteConfigUtils?.taichi_events;
        queue = queue.then(async () => {
            if (!state || state.firstOpen === 0 || at < state.firstOpen || at - state.firstOpen >= 168 * 3_600_000) return;
            const total = state.usd + value;
            if (!Number.isFinite(total)) return;
            state.usd = total;
            const events: string[] = [];
            for (const [window, hours] of Object.entries(WINDOWS)) {
                if (at - state.firstOpen >= hours * 3_600_000) continue;
                for (const limit of LIMITS) {
                    const name = `taichi_rev_${limit.replace(".", "_")}usd_${window}`;
                    if (total + Number.EPSILON < Number(limit) || state.sent.includes(name)) continue;
                    if (enabled !== undefined && (!Array.isArray(enabled) || !enabled.includes(name))) continue;
                    events.push(name);
                }
            }
            const next = {...state, sent: [...state.sent, ...events]};
            // Persistir antes de emitir evita repetir marcos no próximo boot. Não é ack do GA4.
            await AsyncStorage.setItem(KEY, JSON.stringify(next));
            state = next;
            for (const name of events) logUtilsEvent(name);
        }).catch(() => {}); // Uma falha de gravação não bloqueia as próximas impressões.
    } catch {}
}
