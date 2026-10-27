import {AdEventType} from "react-native-google-mobile-ads";
import type {RemoteConfigUtilsType} from "./types";

/**
 * Pré-carga e espera máxima dos anúncios de tela cheia (app open e intersticial), atrás de chaves do bloco `utils` do
 * Remote Config. O padrão de cada chave é o comportamento de antes: sem pré-carga (o anúncio carrega na hora de
 * mostrar) e sem limite de espera. Só muda COMO e QUANDO o anúncio carrega; posição e frequência continuam com o app.
 *
 * Nada aqui usa timer: a idade do anúncio pronto e a pausa depois de erro são conferidas pela hora (Date.now) no
 * momento de usar, porque o Android suspende os timers do JS com a Activity pausada.
 */

export type PreloadAdKind = "appopen" | "interstitial";

export type AdPreloadSettings = {
    /** Guardar um anúncio pronto. */
    enabled: boolean;
    /** Pronto mais velho que isso é descartado e o anúncio carrega de novo. */
    maxAgeMs: number;
    /** Depois de um erro de carga, nenhuma pré-carga nova por esse tempo (0 = sem pausa). */
    errorPauseMs: number;
    /** Espera máxima ao carregar na hora de mostrar (0 = sem limite). */
    maxWaitMs: number;
};

/**
 * Idade máxima padrão: 4 h no app open (o prazo do Google) e 1 h no intersticial (o da react-native-google-mobile-ads,
 * `AdStalenessGuidanceMillis` na 17.0).
 */
export const DEFAULT_PRELOAD_MAX_AGE_MINUTES: Record<PreloadAdKind, number> = {appopen: 240, interstitial: 60};

const KEYS = {
    appopen: {enabled: "appopen_preload_enabled", maxAge: "appopen_preload_max_age_minutes"},
    interstitial: {enabled: "interstitial_preload_enabled", maxAge: "interstitial_preload_max_age_minutes"},
} as const;

const asNonNegative = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

/** Lê as chaves do formato. Ausente ou inválida = padrão (o comportamento de antes); idade 0 também é o padrão. */
export const readAdPreloadSettings = (
    kind: PreloadAdKind,
    config: Partial<RemoteConfigUtilsType> | undefined = globalThis.remoteConfigUtils,
): AdPreloadSettings => {
    const keys = KEYS[kind];
    const maxAgeMinutes = asNonNegative(config?.[keys.maxAge]) || DEFAULT_PRELOAD_MAX_AGE_MINUTES[kind];
    return {
        enabled: config?.[keys.enabled] === true,
        maxAgeMs: maxAgeMinutes * 60_000,
        errorPauseMs: (asNonNegative(config?.ad_preload_error_pause_seconds) ?? 0) * 1000,
        maxWaitMs: (asNonNegative(config?.ad_load_max_wait_seconds) ?? 0) * 1000,
    };
};

/** Pronto ainda dentro da idade. Relógio que voltou para trás conta como vencido (carrega de novo). */
export const isAdFresh = (loadedAt: number, now: number, maxAgeMs: number): boolean => {
    const age = now - loadedAt;
    return age >= 0 && age < maxAgeMs;
};

/** Ainda dentro da pausa depois de um erro de carga. */
export const isInErrorPause = (lastErrorAt: number, now: number, pauseMs: number): boolean => {
    if (!lastErrorAt || pauseMs <= 0) return false;
    const elapsed = now - lastErrorAt;
    return elapsed >= 0 && elapsed < pauseMs;
};

/** A carga feita na hora de mostrar passou da espera máxima (0 = sem limite). */
export const isPastMaxWait = (startedAt: number, now: number, maxWaitMs: number): boolean =>
    maxWaitMs > 0 && now - startedAt >= maxWaitMs;

/** O que a pré-carga usa do anúncio do SDK (AppOpenAd e InterstitialAd têm tudo isso). */
export type PreloadableAd = {
    readonly loaded: boolean;
    load(): void;
    removeAllListeners(): void;
    addAdEventListener(type: AdEventType, listener: (payload: any) => void): () => void;
};

/**
 * Reserva de UM anúncio pronto de um formato. Quem chama faz as checagens de sempre (premium, ads desligados,
 * bloqueio e unitId) antes do `preload`; aqui ficam a chave liga/desliga, a idade, a pausa por erro e a carga em
 * andamento. A pré-carga nunca tenta de novo sozinha depois de um erro: a próxima tentativa vem do próximo gatilho.
 */
export const createAdPreloader = <T extends PreloadableAd>(kind: PreloadAdKind, create: (unitId: string) => T) => {
    let ready: {ad: T; unitId: string; loadedAt: number} | null = null;
    let loading = false;
    let lastLoadErrorAt = 0;

    const discard = (ad: T) => {
        try {
            ad.removeAllListeners();
        } catch {}
    };

    // Pronto vencido (ou que o SDK não dá mais como carregado) sai da reserva aqui, na hora de usar.
    const dropStale = (settings: AdPreloadSettings, now: number) => {
        if (ready && (!ready.ad.loaded || !isAdFresh(ready.loadedAt, now, settings.maxAgeMs))) {
            discard(ready.ad);
            ready = null;
        }
    };

    const store = (ad: T, unitId: string) => {
        if (ready) discard(ready.ad);
        ready = {ad, unitId, loadedAt: Date.now()};
    };

    /** Pré-carga ligada, sem pronto válido, sem carga em andamento e fora da pausa por erro. */
    const wants = (): boolean => {
        const settings = readAdPreloadSettings(kind);
        if (!settings.enabled || loading) return false;
        const now = Date.now();
        dropStale(settings, now);
        return !ready && !isInErrorPause(lastLoadErrorAt, now, settings.errorPauseMs);
    };

    return {
        wants,

        /** Carrega um anúncio para guardar; não faz nada se `wants()` for false. Nunca lança. */
        preload(unitId: string): void {
            if (!wants()) return;
            loading = true;
            const offs: Array<() => void> = [];
            const settle = () => {
                offs.forEach((off) => off());
                loading = false;
            };
            try {
                const ad = create(unitId);
                offs.push(
                    ad.addAdEventListener(AdEventType.LOADED, () => {
                        settle();
                        store(ad, unitId);
                    }),
                    ad.addAdEventListener(AdEventType.ERROR, () => {
                        settle();
                        lastLoadErrorAt = Date.now();
                        discard(ad);
                    }),
                );
                ad.load();
            } catch {
                settle();
                lastLoadErrorAt = Date.now();
            }
        },

        /** O pronto, se servir para esta exibição (mesmo unitId e dentro da idade): sai da reserva. Senão null. */
        take(unitId: string): T | null {
            dropStale(readAdPreloadSettings(kind), Date.now());
            if (!ready || ready.unitId !== unitId) return null;
            const {ad} = ready;
            ready = null;
            return ad;
        },

        /**
         * Anúncio carregado na hora que chegou depois da espera máxima: não aparece agora. Com a pré-carga ligada vira
         * o pronto (sem gastar outro pedido); desligada, é descartado.
         */
        adopt(ad: T, unitId: string): void {
            if (readAdPreloadSettings(kind).enabled) store(ad, unitId);
            else discard(ad);
        },

        /** Erro de carga na hora de mostrar: começa a pausa da pré-carga também. */
        noteLoadError(): void {
            lastLoadErrorAt = Date.now();
        },
    };
};
