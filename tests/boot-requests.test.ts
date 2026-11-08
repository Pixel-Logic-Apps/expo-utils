// Abertura (Utils.startBootRequests + Utils.prepare): o Remote Config e a versão na loja saem na hora, junto com a
// checagem de OTA, e o prepare usa as mesmas idas à rede, sem repetir. As regras continuam: o app só fica pronto com o
// Remote Config da rede e o veredito da trava da loja; sem resposta da loja, vale a versão do Remote Config (válvula).
// Importa o Utils.ts de verdade, com as dependências mockadas; cada teste usa uma instância nova do módulo.
import {afterAll, beforeAll, beforeEach, expect, jest, mock, test} from "bun:test";

const stub = () => () => {};
const resolved = (value?: any) => () => Promise.resolve(value);

// Promessa que o teste resolve na hora que quiser.
const deferred = <T>() => {
    let resolve: (value: T) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

const state = {
    rcFetches: 0,
    rcUtils: {} as Record<string, any>,
    rcAnswer: null as ReturnType<typeof deferred<void>> | null, // null = o fetchAndActivate responde na hora
    lookups: [] as string[],
    lookupAnswer: null as ReturnType<typeof deferred<any>> | null, // null = a loja responde na hora com storeVersion
    storeVersion: "1.0.0",
};
const flush = async () => {
    for (let i = 0; i < 100; i++) await Promise.resolve();
};

mock.module("react-native", () => ({
    Alert: {alert: stub()},
    AppState: {currentState: "active", addEventListener: () => ({remove: stub()})},
    Platform: {OS: "ios", Version: "26.5", select: (o: any) => o.ios ?? o.default},
    Linking: {openURL: resolved(), canOpenURL: resolved(true)},
    LogBox: {ignoreLogs: stub(), ignoreAllLogs: stub()},
    DevSettings: {addMenuItem: stub()},
    PermissionsAndroid: {check: resolved(false), request: resolved("granted"), PERMISSIONS: {}, RESULTS: {}},
    NativeModules: {},
}));
mock.module("expo-tracking-transparency", () => ({
    getTrackingPermissionsAsync: resolved({status: "undetermined"}),
    requestTrackingPermissionsAsync: resolved({status: "undetermined"}),
}));
mock.module("react-native-fbsdk-next", () => ({Settings: {initializeSDK: stub(), setAppID: stub(), setAdvertiserIDCollectionEnabled: stub(), setAdvertiserTrackingEnabled: resolved()}}));
mock.module("@react-native-firebase/messaging", () => ({
    getMessaging: stub(),
    requestPermission: resolved(1),
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
mock.module("@react-native-firebase/remote-config", () => ({
    getRemoteConfig: () => ({setConfigSettings: resolved(), setDefaults: resolved()}),
    fetchAndActivate: () => {
        state.rcFetches++;
        return state.rcAnswer ? state.rcAnswer.promise : Promise.resolve();
    },
    getValue: () => ({asString: () => ""}),
}));
mock.module("@react-native-firebase/app", () => ({getApp: () => ({})}));
mock.module("../utils/settings", () => ({
    readRemoteConfigBlocks: () => ({utils: state.rcUtils, screens: {}, source: "settings"}),
    mergeRemoteConfigBlocks: (utils: any, screens: any) => ({...screens, ...utils}),
}));
mock.module("../utils/attribution", () => ({runAttributionPhase1: resolved(), runAttributionPhase2: resolved(), setRcAttributesLate: stub(), refreshAttributionAfterAtt: resolved()}));
mock.module("../utils/analytics", () => ({logUtilsEvent: stub(), setUtilsUserProperty: stub()}));
mock.module("@react-native-async-storage/async-storage", () => ({default: {getItem: resolved(null), setItem: resolved()}}));
mock.module("expo-splash-screen", () => ({hideAsync: resolved(), preventAutoHideAsync: resolved(), setOptions: stub()}));
mock.module("expo-localization", () => ({getLocales: () => [{languageCode: "pt", regionCode: "BR"}]}));
mock.module("expo-application", () => ({nativeApplicationVersion: "1.0.0", nativeBuildVersion: "1", applicationId: "com.exemplo"}));
mock.module("expo-device", () => ({isDevice: true}));
mock.module("@microsoft/react-native-clarity", () => ({initialize: stub(), LogLevel: {}}));
mock.module("react-native-purchases", () => ({
    default: {isConfigured: resolved(false), getCustomerInfo: resolved({}), configure: stub(), setLogLevel: stub(), addCustomerInfoUpdateListener: stub()},
    LOG_LEVEL: {},
}));
mock.module("expo-dev-menu", () => ({registerDevMenuItems: resolved()}));
mock.module("react-native-google-mobile-ads", () => ({
    default: () => ({initialize: resolved([])}),
    AdsConsent: {gatherConsent: resolved({canRequestAds: true, status: "NOT_REQUIRED"})},
    AdsConsentDebugGeography: {},
}));
mock.module("expo-tiktok-ads-events", () => ({default: {}, TikTokStandardEvents: {}, TikTokWaitForConfig: {}}));
mock.module("../utils/i18n", () => ({getLocalizedMessages: () => ({})}));
mock.module("../utils/hot-updater", () => ({initHotUpdater: resolved()}));
mock.module("../utils/config-integrity", () => ({reportConfigIntegrity: resolved()}));
mock.module("../utils/AdPlacementTracker", () => ({setBlocklist: stub()}));
mock.module("../utils/PremiumUtils", () => ({PremiumUtils: {getIsPremiumStatus: resolved(false)}}));
mock.module("../utils/link-in-bio", () => ({trackLinkInBioInstall: resolved()}));
mock.module("../utils/ad-revenue", () => ({initAdRevenue: stub()}));
mock.module("../utils/push-analytics", () => ({logPushOpened: stub(), logPushReceived: stub()}));
mock.module("../utils/rc-status", () => ({getRevenueCatStatus: stub(), syncRcStatus: resolved()}));
mock.module("../utils/retention-events", () => ({showRetentionPreview: stub()}));

(globalThis as any).__DEV__ = false;
(globalThis as any).disableExpoUtilsWarnings = true;
(globalThis as any).disableExpoUtilsLogs = true;
const realFetch = globalThis.fetch;
(globalThis as any).fetch = (url: string) => {
    state.lookups.push(String(url));
    if (state.lookupAnswer) return state.lookupAnswer.promise;
    return Promise.resolve({json: async () => ({results: [{version: state.storeVersion}]})});
};

const appConfig = {expo: {slug: "exemplo", plugins: []}};
const appStrings = {} as any;

let serial = 0;
const load = async () => import(`../utils/Utils.ts?case=${++serial}`);

beforeAll(() => jest.useFakeTimers());
afterAll(() => {
    jest.useRealTimers();
    globalThis.fetch = realFetch;
});
beforeEach(() => {
    jest.clearAllTimers();
    delete (globalThis as any).adsDisabledByStoreGate;
    delete (globalThis as any).isAdsEnabled;
    Object.assign(state, {rcFetches: 0, rcUtils: {}, rcAnswer: null, lookups: [], lookupAnswer: null, storeVersion: "1.0.0"});
});

test("Remote Config e loja saem na hora, antes do OTA terminar; o prepare usa as mesmas e só fica pronto com as duas", async () => {
    state.rcAnswer = deferred<void>();
    state.lookupAnswer = deferred<any>();
    const {default: Utils} = await load();
    Utils.startBootRequests(appConfig);
    await flush();
    expect(state.rcFetches).toBe(1);
    expect(state.lookups).toEqual(["https://itunes.apple.com/lookup?bundleId=com.exemplo&country=br"]);

    // O OTA terminou: o prepare começa e não repete nenhuma das duas.
    let ready = false;
    Utils.prepare((value: boolean) => (ready = value), appConfig, appStrings);
    await flush();
    expect(state.rcFetches).toBe(1);
    expect(state.lookups.length).toBe(1);
    expect(ready).toBe(false);

    state.lookupAnswer.resolve({json: async () => ({results: [{version: "1.0.0"}]})});
    await flush();
    expect(ready).toBe(false); // a loja respondeu, mas o Remote Config ainda não

    state.rcAnswer.resolve();
    await flush();
    expect(ready).toBe(true);
    expect((globalThis as any).adsDisabledByStoreGate).toBeUndefined();
});

test("chamar de novo não repete as idas à rede", async () => {
    const {default: Utils} = await load();
    Utils.startBootRequests(appConfig);
    Utils.startBootRequests(appConfig);
    await flush();
    expect(state.rcFetches).toBe(1);
    expect(state.lookups.length).toBe(1);
});

test("trava da loja desligada no app.json: não consulta a loja", async () => {
    const {default: Utils} = await load();
    Utils.startBootRequests({expo: {plugins: [["expo-utils", {disableAdsIfBuildIsNewerThanStore: false}]]}});
    await flush();
    expect(state.rcFetches).toBe(1);
    expect(state.lookups).toEqual([]);
});

test("loja sem resposta: vale a versão do Remote Config, lida depois de o Remote Config chegar", async () => {
    state.rcAnswer = deferred<void>();
    state.lookupAnswer = deferred<any>();
    state.rcUtils = {ios_store_version: "1.0.0"};
    const {default: Utils} = await load();
    Utils.startBootRequests(appConfig);
    let ready = false;
    Utils.prepare((value: boolean) => (ready = value), appConfig, appStrings);
    await flush();
    state.lookupAnswer.reject(new Error("sem rede")); // as duas URLs falham
    await flush();
    state.rcAnswer.resolve();
    await flush();
    expect(ready).toBe(true);
    expect((globalThis as any).adsDisabledByStoreGate).toBeUndefined(); // 1.0.0 local = 1.0.0 no Remote Config
});

test("loja sem resposta e sem versão no Remote Config: anúncios desligados (fail-closed, como antes)", async () => {
    state.lookupAnswer = deferred<any>();
    const {default: Utils} = await load();
    Utils.startBootRequests(appConfig);
    state.lookupAnswer.reject(new Error("sem rede"));
    let ready = false;
    await Utils.prepare((value: boolean) => (ready = value), appConfig, appStrings);
    expect(ready).toBe(true);
    expect((globalThis as any).adsDisabledByStoreGate).toBe(true);
    expect((globalThis as any).isAdsEnabled).toBe(false);
});
