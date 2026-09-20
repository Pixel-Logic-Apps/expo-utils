import {getApp} from "@react-native-firebase/app";
import {getAnalytics, logEvent, setUserId, setUserProperty} from "@react-native-firebase/analytics";

// Porta única de telemetria da lib (Firebase Analytics). Módulo-folha de propósito: não
// importa nada do expo-utils, então qualquer arquivo pode usar sem criar ciclo.
//
// Contrato: NUNCA lança, NUNCA é aguardado (fire-and-forget) e NUNCA vira unhandled
// rejection — analytics não pode quebrar nem atrasar ad, paywall, promo ou boot.
//
// Promise.resolve(...): o RNFB novo (v26) tipa logEvent/setUserId/setUserProperty como
// `void`, mas em runtime eles devolvem promise. `.catch` direto não compila no v26 e, sem
// catch nenhum, a rejeição vira unhandled rejection. O wrapper serve às duas tipagens.

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

// Limites do GA4: nome de evento ≤ 40, valor de parâmetro ≤ 100, valor de user property ≤ 36.
const EVENT_NAME_MAX = 40;
const PARAM_VALUE_MAX = 100;
const USER_PROPERTY_VALUE_MAX = 36;

// GA4 só aceita string e número. Boolean vira 1/0 (o Bundle do Android descarta boolean);
// null/undefined/NaN saem do payload em vez de irem como "undefined".
export function sanitizeAnalyticsParams(params: AnalyticsParams = {}): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const key of Object.keys(params)) {
        const value = params[key];
        if (value === null || value === undefined) continue;
        if (typeof value === "boolean") out[key] = value ? 1 : 0;
        else if (typeof value === "number") {
            if (Number.isFinite(value)) out[key] = value;
        } else out[key] = String(value).slice(0, PARAM_VALUE_MAX);
    }
    return out;
}

export function logUtilsEvent(name: string, params: AnalyticsParams = {}): void {
    try {
        const eventName = name.slice(0, EVENT_NAME_MAX);
        const eventParams = sanitizeAnalyticsParams(params);
        // Em dev cada evento aparece no console do Metro (respeita disableLogs): dá pra
        // acompanhar o funil inteiro sem abrir o DebugView do Firebase.
        if (typeof __DEV__ !== "undefined" && __DEV__ && !(globalThis as any).disableExpoUtilsLogs) {
            // eslint-disable-next-line no-console
            console.log("[expo-utils] event", eventName, JSON.stringify(eventParams));
        }
        Promise.resolve(logEvent(getAnalytics(getApp()), eventName, eventParams)).catch(() => {});
    } catch {}
}

// user_id do GA4 (até 256 chars). É onde vai o App User ID do RevenueCat: `$RCAnonymousID:<32 hex>`
// tem 47 chars e NÃO cabe numa user property (teto de 36).
export function setUtilsUserId(id: string | null): void {
    try {
        Promise.resolve(setUserId(getAnalytics(getApp()), id)).catch(() => {});
    } catch {}
}

export function setUtilsUserProperty(name: string, value: string | null): void {
    try {
        const safeValue = value === null ? null : String(value).slice(0, USER_PROPERTY_VALUE_MAX);
        Promise.resolve(setUserProperty(getAnalytics(getApp()), name, safeValue)).catch(() => {});
    } catch {}
}
