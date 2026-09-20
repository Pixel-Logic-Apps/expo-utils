// Mocks dos módulos nativos para testar a lógica pura do expo-utils com `bun test`
// (nenhum deles está instalado neste repo — são peer deps do app host).
// Rodar: bun test   (na raiz do expo-utils)
import {jest, mock} from "bun:test";

export type Call = [string, ...any[]];

export const state = {
    os: "android" as "android" | "ios",
    configured: true,
    apnsReady: true,
    hang: new Set<string>(), // métodos que NUNCA resolvem (promise nativa pendurada)
    fail: new Set<string>(), // métodos que rejeitam
    calls: [] as Call[],
    events: [] as Array<{name: string; params: Record<string, any>}>,
    warns: [] as any[][],
    userId: undefined as string | null | undefined,
    userProps: {} as Record<string, string | null>,
    storage: new Map<string, string>(),
    storefront: {countryCode: "GB"} as {countryCode: string} | null,
    geo: "ok" as "ok" | "fail", // resposta do 1º provedor de geo por IP
    fetched: [] as string[],
};

const never = () => new Promise<never>(() => {});
const native =
    (name: string, value?: any) =>
    (...args: any[]) => {
        state.calls.push([name, ...args]);
        if (state.hang.has(name)) return never();
        if (state.fail.has(name)) return Promise.reject(new Error(`${name} falhou`));
        return Promise.resolve(typeof value === "function" ? value() : value);
    };

export const callNames = () => state.calls.map((call) => call[0]);
export const callsOf = (name: string) => state.calls.filter((call) => call[0] === name);
export const eventsOf = (name: string) => state.events.filter((event) => event.name === name);

/** Avança o relógio falso em passos, esvaziando as microtasks entre eles. */
export const advance = async (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
        jest.advanceTimersByTime(step);
        for (let i = 0; i < 25; i++) await Promise.resolve();
    }
};

export function installMocks() {
    // Rede da geo por IP: nunca sai pra internet nos testes.
    (globalThis as any).remoteConfigUtils = {};
    (globalThis as any).fetch = (url: string) => {
        state.fetched.push(String(url));
        if (state.geo === "fail") return Promise.resolve({ok: false, status: 503, json: async () => ({})});
        return Promise.resolve({ok: true, status: 200, json: async () => ({success: true, country_code: "GB", region: "England", region_code: "ENG", city: "London"})});
    };
    mock.module("react-native", () => ({
        Platform: {
            get OS() {
                return state.os;
            },
            Version: 34,
        },
    }));
    mock.module("react-native-purchases", () => ({
        default: {
            isConfigured: () => Promise.resolve(state.configured),
            enableAdServicesAttributionTokenCollection: native("enableAdServicesAttributionTokenCollection"),
            setFirebaseAppInstanceID: native("setFirebaseAppInstanceID"),
            setAttributes: native("setAttributes"),
            getStorefront: native("getStorefront", () => state.storefront),
            getAppUserID: native("getAppUserID", "$RCAnonymousID:de39831ab3284a198b7310d7411cddcc"),
            collectDeviceIdentifiers: native("collectDeviceIdentifiers"),
            setFBAnonymousID: native("setFBAnonymousID"),
            setPushToken: native("setPushToken"),
            syncAttributesAndOfferingsIfNeeded: native("syncAttributesAndOfferingsIfNeeded", {}),
        },
    }));
    mock.module("expo-application", () => ({
        nativeApplicationVersion: "2.1.0",
        nativeBuildVersion: "42",
        getInstallationTimeAsync: () => Promise.resolve(new Date("2026-08-15T07:53:00Z")),
    }));
    mock.module("expo-device", () => ({osVersion: "14", modelName: "Pixel 8"}));
    mock.module("expo-localization", () => ({
        getLocales: () => [{languageCode: "pt", languageTag: "pt-BR", regionCode: "BR", currencyCode: "BRL"}],
        getCalendars: () => [{timeZone: "America/Sao_Paulo"}],
    }));
    mock.module("react-native-fbsdk-next", () => ({AppEventsLogger: {getAnonymousID: native("fb.getAnonymousID", "fb-anon-1")}}));
    mock.module("@react-native-firebase/app", () => ({getApp: () => ({})}));
    mock.module("@react-native-firebase/analytics", () => ({
        getAnalytics: () => ({}),
        getAppInstanceId: native("getAppInstanceId", "fid-123"),
        logEvent: (_analytics: any, name: string, params: any) => {
            state.events.push({name, params});
            return Promise.resolve();
        },
        setUserId: (_analytics: any, id: string | null) => {
            state.userId = id;
        },
        setUserProperty: (_analytics: any, name: string, value: string | null) => {
            state.userProps[name] = value;
        },
    }));
    mock.module("@react-native-firebase/messaging", () => ({
        getMessaging: () => ({}),
        getToken: native("getToken", "fcm-token:APA91b"),
        getAPNSToken: native("getAPNSToken", "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"),
    }));
    mock.module("@react-native-async-storage/async-storage", () => ({
        default: {
            getItem: (key: string) => Promise.resolve(state.storage.has(key) ? state.storage.get(key)! : null),
            setItem: (key: string, value: string) => {
                state.storage.set(key, value);
                return Promise.resolve();
            },
        },
    }));
    mock.module("../../utils/Utils", () => ({
        default: {ensureApnsReady: () => Promise.resolve(state.apnsReady)},
        expoUtilsLog: () => {},
        expoUtilsWarn: (...args: any[]) => {
            state.warns.push(args);
        },
    }));
}
