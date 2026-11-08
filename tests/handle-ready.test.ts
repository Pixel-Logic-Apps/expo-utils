// Utils.handleReady: esconde o splash e dispara a cadeia de consentimento na hora, sem espera fixa (até a 1.5.6: 3 s
// no splash + 2 s até a cadeia, gambiarra para o ATT — hoje o portão de permissões espera o app ativo por evento).
// Um hideAsync rejeitado não pode parar a cadeia (UMP, ATT, push, fase 2).
// Importa o Utils.ts de verdade, com todas as dependências mockadas (nenhuma está instalada neste repo).
// O bootDone é de módulo: handleReady roda 1x por arquivo, então o teste é um fluxo só, em ordem.
import {afterAll, expect, jest, mock, test} from "bun:test";

const stub = () => () => {};
const resolved = (value?: any) => () => Promise.resolve(value);
const calls: string[] = [];
const warns: any[][] = [];
let hideError: Error | null = new Error("hideAsync falhou");

mock.module("expo-splash-screen", () => ({
    hideAsync: () => {
        calls.push("hideAsync");
        return hideError ? Promise.reject(hideError) : Promise.resolve();
    },
    preventAutoHideAsync: resolved(),
    setOptions: stub(),
}));
mock.module("react-native", () => ({
    Alert: {alert: stub()},
    AppState: {currentState: "active", addEventListener: () => ({remove: () => {}})},
    Platform: {OS: "android", Version: 34, select: (o: any) => o.android ?? o.default},
    Linking: {openURL: resolved(), canOpenURL: resolved(true)},
    LogBox: {ignoreLogs: stub(), ignoreAllLogs: stub()},
    DevSettings: {addMenuItem: stub()},
    PermissionsAndroid: {request: resolved("granted"), PERMISSIONS: {}, RESULTS: {GRANTED: "granted"}},
    NativeModules: {},
    NativeEventEmitter: class {
        addListener() {
            return {remove: () => {}};
        }
    },
}));
mock.module("expo-localization", () => ({getLocales: () => [{languageCode: "pt", regionCode: "BR"}]}));
mock.module("expo-tracking-transparency", () => ({
    requestTrackingPermissionsAsync: resolved({status: "granted"}),
    getTrackingPermissionsAsync: resolved({status: "granted"}),
}));
mock.module("expo-application", () => ({nativeApplicationVersion: "1.0.0", nativeBuildVersion: "1", applicationId: "com.exemplo"}));
mock.module("expo-device", () => ({isDevice: true}));
mock.module("@microsoft/react-native-clarity", () => ({initialize: stub(), LogLevel: {}}));
mock.module("react-native-fbsdk-next", () => ({Settings: {initializeSDK: stub(), setAdvertiserTrackingEnabled: resolved()}}));
mock.module("react-native-purchases", () => ({
    default: {isConfigured: resolved(false), getCustomerInfo: resolved({}), configure: stub(), setLogLevel: stub()},
    LOG_LEVEL: {},
}));
mock.module("@react-native-async-storage/async-storage", () => ({default: {getItem: resolved(null), setItem: resolved()}}));
mock.module("expo-dev-menu", () => ({registerDevMenuItems: resolved()}));
mock.module("react-native-google-mobile-ads", () => ({
    default: () => ({initialize: resolved([])}),
    AdsConsent: {gatherConsent: resolved({canRequestAds: true})},
    AdsConsentDebugGeography: {},
}));
mock.module("@react-native-firebase/remote-config", () => ({getRemoteConfig: stub(), fetchAndActivate: resolved(), getValue: stub()}));
mock.module("@react-native-firebase/messaging", () => ({
    getMessaging: stub(),
    requestPermission: resolved(),
    hasPermission: resolved(1),
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
mock.module("@react-native-firebase/app", () => ({getApp: stub()}));
mock.module("expo-tiktok-ads-events", () => ({default: {}, TikTokStandardEvents: {}, TikTokWaitForConfig: {}}));
mock.module("../utils/i18n", () => ({getLocalizedMessages: () => ({})}));
mock.module("../utils/hot-updater", () => ({initHotUpdater: resolved()}));
mock.module("../utils/config-integrity", () => ({reportConfigIntegrity: resolved()}));
mock.module("../utils/settings", () => ({mergeRemoteConfigBlocks: stub(), readRemoteConfigBlocks: stub()}));
mock.module("../utils/AdPlacementTracker", () => ({setBlocklist: stub()}));
mock.module("../utils/PremiumUtils", () => ({PremiumUtils: {getIsPremiumStatus: resolved(false)}}));
mock.module("../utils/link-in-bio", () => ({trackLinkInBioInstall: resolved()}));
mock.module("../utils/analytics", () => ({
    logUtilsEvent: (name: string, params: any) => {
        if (name === "expo_utils_warn") warns.push([params?.message]);
    },
    setUtilsUserProperty: stub(),
}));
mock.module("../utils/ad-revenue", () => ({initAdRevenue: stub()}));
mock.module("../utils/attribution", () => ({runAttributionPhase1: resolved(), runAttributionPhase2: resolved(), setRcAttributesLate: stub(), refreshAttributionAfterAtt: resolved()}));
mock.module("../utils/push-analytics", () => ({logPushOpened: stub(), logPushReceived: stub()}));
mock.module("../utils/rc-status", () => ({getRevenueCatStatus: stub(), syncRcStatus: resolved()}));
mock.module("../utils/retention-events", () => ({showRetentionPreview: stub()}));

(globalThis as any).disableExpoUtilsWarnings = true;
const {default: Utils} = await import("../utils/Utils");

// O que vem depois do splash (UMP, ATT, push…) é outro teste: aqui só importa QUANDO a cadeia começa.
const consentArgs: any[][] = [];
Utils.requestTrackingWhenActive = async (...args: any[]) => {
    calls.push("requestTrackingWhenActive");
    consentArgs.push(args);
    return true;
};

const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};

jest.useFakeTimers();
afterAll(() => jest.useRealTimers());

test("esconde o splash e dispara a cadeia na hora, sem timer; hideAsync rejeitado não para a cadeia", async () => {
    Utils.handleReady();
    expect(calls).toEqual(["hideAsync", "requestTrackingWhenActive"]);
    expect(jest.getTimerCount()).toBe(0);
    // Sem prepare(): appConfig/appStrings do boot vazios e push permitido (o padrão).
    expect(consentArgs).toEqual([[undefined, undefined, true]]);
    await flush();
    // O hideAsync rejeitado virou warn (com catch): não é unhandled rejection.
    expect(warns.some(([message]) => String(message).includes("hideAsync"))).toBe(true);
});

test("roda 1x: o 2º onLayout não esconde de novo nem repete a cadeia", async () => {
    hideError = null;
    Utils.handleReady();
    jest.advanceTimersByTime(10_000);
    await flush();
    expect(calls).toEqual(["hideAsync", "requestTrackingWhenActive"]);
});
