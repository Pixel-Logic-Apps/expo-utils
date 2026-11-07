// Cadeia de consentimento (Utils.requestTrackingWhenActive) com o portão de permissões: o ATT pede de novo no próximo
// active, a cadeia espera o resultado no máximo o limite e segue, e a resposta que chega depois avisa o FB, recoleta a
// atribuição e sai no `consent_flow` (com as tentativas). Importa o Utils.ts de verdade, com as dependências mockadas
// (nenhuma está instalada neste repo); cada teste usa uma instância nova do módulo (os fluxos são de sessão).
import {afterAll, beforeAll, beforeEach, expect, jest, mock, test} from "bun:test";

const LIMIT = 20000;
const stub = () => () => {};
const resolved = (value?: any) => () => Promise.resolve(value);
const never = <T>() => new Promise<T>(() => {});

const state = {
    os: "ios" as "ios" | "android",
    appState: "active",
    att: "undetermined",
    attAnswers: [] as string[], // o que cada pedido de ATT devolve; sem resposta na fila = descartado
    attRequests: 0,
    pushStatus: 1, // AuthorizationStatus do RNFB (iOS)
    androidPush: false, // PermissionsAndroid.check
    androidAnswers: [] as Array<string | "hang">,
    androidRequests: 0,
    fbTracking: [] as boolean[], // setAdvertiserTrackingEnabled
    refreshed: [] as Array<string | undefined>, // refreshAttributionAfterAtt
    events: [] as Array<{name: string; params: any}>,
    userProps: {} as Record<string, string>,
    storage: new Map<string, string>(),
};
const listeners = new Set<(next: string) => void>();
const setAppState = async (next: string) => {
    state.appState = next;
    for (const listener of [...listeners]) listener(next);
    await flush();
};
const flush = async () => {
    for (let i = 0; i < 100; i++) await Promise.resolve();
};
const advance = async (ms: number, step = 1000) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
        await flush();
        jest.advanceTimersByTime(step);
    }
    await flush();
};

mock.module("react-native", () => ({
    Alert: {alert: stub()},
    AppState: {
        get currentState() {
            return state.appState;
        },
        addEventListener: (_type: string, listener: (next: string) => void) => {
            listeners.add(listener);
            return {remove: () => listeners.delete(listener)};
        },
    },
    Platform: {
        get OS() {
            return state.os;
        },
        Version: 34,
        select: (o: any) => o[state.os] ?? o.default,
    },
    Linking: {openURL: resolved(), canOpenURL: resolved(true)},
    LogBox: {ignoreLogs: stub(), ignoreAllLogs: stub()},
    DevSettings: {addMenuItem: stub()},
    PermissionsAndroid: {
        check: () => Promise.resolve(state.androidPush),
        request: () => {
            state.androidRequests++;
            const answer = state.androidAnswers.shift() ?? "denied";
            if (answer === "hang") return never();
            if (answer === "granted") state.androidPush = true;
            return Promise.resolve(answer);
        },
        PERMISSIONS: {POST_NOTIFICATIONS: "android.permission.POST_NOTIFICATIONS"},
        RESULTS: {GRANTED: "granted"},
    },
    NativeModules: {},
}));
mock.module("expo-tracking-transparency", () => ({
    getTrackingPermissionsAsync: () => Promise.resolve({status: state.att}),
    requestTrackingPermissionsAsync: () => {
        state.attRequests++;
        const answer = state.attAnswers.shift();
        if (answer) state.att = answer;
        return Promise.resolve({status: state.att});
    },
}));
mock.module("react-native-fbsdk-next", () => ({
    Settings: {
        initializeSDK: stub(),
        setAppID: stub(),
        setAdvertiserIDCollectionEnabled: stub(),
        setAdvertiserTrackingEnabled: (enabled: boolean) => {
            state.fbTracking.push(enabled);
            return Promise.resolve();
        },
    },
}));
mock.module("@react-native-firebase/messaging", () => ({
    getMessaging: stub(),
    hasPermission: () => Promise.resolve(state.pushStatus),
    requestPermission: () => Promise.resolve(state.pushStatus),
    onMessage: stub(),
    subscribeToTopic: resolved(),
    getToken: resolved(),
    setBackgroundMessageHandler: stub(),
    experimentalSetDeliveryMetricsExportedToBigQueryEnabled: resolved(),
    registerDeviceForRemoteMessages: resolved(),
    isDeviceRegisteredForRemoteMessages: () => true,
    getAPNSToken: resolved(),
    onNotificationOpenedApp: stub(),
    getInitialNotification: resolved(null),
}));
mock.module("../utils/attribution", () => ({
    runAttributionPhase1: resolved(),
    runAttributionPhase2: resolved(),
    setRcAttributesLate: stub(),
    refreshAttributionAfterAtt: (rckey?: string) => {
        state.refreshed.push(rckey);
        return Promise.resolve();
    },
}));
mock.module("../utils/analytics", () => ({
    logUtilsEvent: (name: string, params: any) => state.events.push({name, params}),
    setUtilsUserProperty: (name: string, value: string) => {
        state.userProps[name] = value;
    },
}));
mock.module("@react-native-async-storage/async-storage", () => ({
    default: {
        getItem: (key: string) => Promise.resolve(state.storage.get(key) ?? null),
        setItem: (key: string, value: string) => {
            state.storage.set(key, value);
            return Promise.resolve();
        },
    },
}));
mock.module("expo-splash-screen", () => ({hideAsync: resolved(), preventAutoHideAsync: resolved(), setOptions: stub()}));
mock.module("expo-localization", () => ({getLocales: () => [{languageCode: "pt", regionCode: "BR"}]}));
mock.module("expo-application", () => ({nativeApplicationVersion: "1.0.0", nativeBuildVersion: "1", applicationId: "com.exemplo"}));
mock.module("expo-device", () => ({isDevice: true}));
mock.module("@microsoft/react-native-clarity", () => ({initialize: stub(), LogLevel: {}}));
mock.module("react-native-purchases", () => ({
    default: {isConfigured: resolved(false), getCustomerInfo: resolved({}), configure: stub(), setLogLevel: stub()},
    LOG_LEVEL: {},
}));
mock.module("expo-dev-menu", () => ({registerDevMenuItems: resolved()}));
mock.module("react-native-google-mobile-ads", () => ({
    default: () => ({initialize: resolved([])}),
    AdsConsent: {gatherConsent: resolved({canRequestAds: true, status: "NOT_REQUIRED"})},
    AdsConsentDebugGeography: {},
}));
mock.module("@react-native-firebase/remote-config", () => ({getRemoteConfig: stub(), fetchAndActivate: resolved(), getValue: stub()}));
mock.module("@react-native-firebase/app", () => ({getApp: stub()}));
mock.module("expo-tiktok-ads-events", () => ({default: {}, TikTokStandardEvents: {}, TikTokWaitForConfig: {}}));
mock.module("../utils/i18n", () => ({getLocalizedMessages: () => ({})}));
mock.module("../utils/hot-updater", () => ({initHotUpdater: resolved()}));
mock.module("../utils/config-integrity", () => ({reportConfigIntegrity: resolved()}));
mock.module("../utils/settings", () => ({mergeRemoteConfigBlocks: stub(), readRemoteConfigBlocks: stub()}));
mock.module("../utils/AdPlacementTracker", () => ({setBlocklist: stub()}));
mock.module("../utils/PremiumUtils", () => ({PremiumUtils: {getIsPremiumStatus: resolved(false)}}));
mock.module("../utils/link-in-bio", () => ({trackLinkInBioInstall: resolved()}));
mock.module("../utils/ad-revenue", () => ({initAdRevenue: stub()}));
mock.module("../utils/push-analytics", () => ({logPushOpened: stub(), logPushReceived: stub()}));
mock.module("../utils/rc-status", () => ({getRevenueCatStatus: stub(), syncRcStatus: resolved()}));
mock.module("../utils/retention-events", () => ({showRetentionPreview: stub()}));

(globalThis as any).disableExpoUtilsWarnings = true;
(globalThis as any).disableExpoUtilsLogs = true;

const appConfig = {expo: {slug: "exemplo", plugins: [["react-native-fbsdk-next", {appID: "123"}]]}};
const appStrings = {rckey: "appl_chave"} as any;

let serial = 0;
const load = async () => import(`../utils/Utils.ts?case=${++serial}`);
const consentEvents = () => state.events.filter((event) => event.name === "consent_flow").map((event) => event.params);

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
    jest.clearAllTimers();
    listeners.clear();
    Object.assign(state, {
        os: "ios",
        appState: "active",
        att: "undetermined",
        attAnswers: [],
        attRequests: 0,
        pushStatus: 1,
        androidPush: false,
        androidAnswers: [],
        androidRequests: 0,
        fbTracking: [],
        refreshed: [],
        events: [],
        userProps: {},
        storage: new Map(),
    });
});

test("iOS: ATT descartado e o app volta a ficar ativo antes do limite → pede de novo e o FB já sobe com o ATT concedido", async () => {
    state.attAnswers = ["", "granted"]; // 1º pedido descartado (volta undetermined), 2º concedido
    const {default: Utils} = await load();
    let done = false;
    Utils.requestTrackingWhenActive(appConfig, appStrings).then(() => (done = true));
    await flush();
    expect(state.attRequests).toBe(1);
    expect(state.fbTracking).toEqual([]); // a cadeia espera o ATT
    await setAppState("inactive"); // o alerta de localização da home respondido
    await setAppState("active");
    await flush();
    expect(state.attRequests).toBe(2);
    expect(done).toBe(true);
    expect(state.fbTracking).toEqual([true]);
    expect(state.refreshed).toEqual([]);
    expect(state.userProps.att_status).toBe("granted");
    expect(consentEvents()).toEqual([{ump: "not_required", att: "granted", push: "granted", att_attempts: 2, push_attempts: 0}]);
});

test("iOS: ATT concedido numa nova tentativa depois do limite → FB avisado (true), atribuição recoletada e consent_flow de novo", async () => {
    state.attAnswers = [""]; // descartado; o app fica ativo e não há volta antes do limite
    const {default: Utils, isAttPending} = await load();
    let done = false;
    Utils.requestTrackingWhenActive(appConfig, appStrings).then(() => (done = true));
    await advance(LIMIT - 1000);
    expect(done).toBe(false);
    expect(isAttPending()).toBe(true);
    await advance(1000);
    expect(done).toBe(true);
    expect(state.fbTracking).toEqual([false]);
    expect(consentEvents()).toEqual([{ump: "not_required", att: "undetermined", push: "granted", att_attempts: 1, push_attempts: 0}]);

    state.attAnswers = ["granted"];
    await setAppState("background"); // a pessoa sai e volta: nova tentativa no próximo active
    await setAppState("active");
    await flush();
    expect(state.attRequests).toBe(2);
    expect(isAttPending()).toBe(false);
    expect(state.fbTracking).toEqual([false, true]);
    expect(state.refreshed).toEqual(["appl_chave"]);
    expect(state.userProps.att_status).toBe("granted");
    expect(consentEvents()[1]).toEqual({ump: "not_required", att: "granted", push: "granted", att_attempts: 2, push_attempts: 0});
});

test("iOS: o app nunca fica ativo → nenhum pedido sai e a cadeia segue no limite; o ATT sai quando ficar ativo", async () => {
    state.appState = "inactive";
    state.attAnswers = ["denied"];
    const {default: Utils, isAttPending} = await load();
    let done = false;
    Utils.requestTrackingWhenActive(appConfig, appStrings).then(() => (done = true));
    await advance(2 * LIMIT);
    expect(done).toBe(true);
    expect(state.attRequests).toBe(0);
    expect(state.fbTracking).toEqual([false]);
    expect(isAttPending()).toBe(true);
    expect(consentEvents()[0]).toMatchObject({att: "undetermined", att_attempts: 0});

    await setAppState("active");
    await flush();
    expect(state.attRequests).toBe(1);
    expect(isAttPending()).toBe(false);
    expect(state.userProps.att_status).toBe("denied");
    expect(state.fbTracking).toEqual([false]); // negado: nada a avisar
    expect(consentEvents().at(-1)).toMatchObject({att: "denied", att_attempts: 1, push: "granted"});
});

test("Android: pedido de notificação pendurado → no limite a cadeia segue; pede de novo no próximo active", async () => {
    state.os = "android";
    state.androidAnswers = ["hang", "granted"];
    const {default: Utils} = await load();
    let done = false;
    Utils.requestTrackingWhenActive(appConfig, appStrings).then(() => (done = true));
    await advance(LIMIT - 1000);
    expect(done).toBe(false);
    await advance(1000);
    expect(done).toBe(true);
    expect(state.androidRequests).toBe(1);
    expect(state.fbTracking).toEqual([true]); // Android: sem ATT, granted = true como antes
    expect(consentEvents()).toEqual([{ump: "not_required", att: "na", push: "timeout", att_attempts: 0, push_attempts: 1}]);

    await setAppState("background");
    await setAppState("active");
    await flush();
    expect(state.androidRequests).toBe(2);
    expect(consentEvents()[1]).toEqual({ump: "not_required", att: "na", push: "granted", att_attempts: 0, push_attempts: 2});
});
