// Cadeia de consentimento (Utils.requestTrackingWhenActive) com o portão de permissões: o ATT pede de novo no próximo
// active, a cadeia espera o resultado no máximo o limite e segue, e a resposta que chega depois avisa o FB, recoleta a
// atribuição e sai no `consent_flow` (com as tentativas). Importa o Utils.ts de verdade, com as dependências mockadas
// (nenhuma está instalada neste repo); cada teste usa uma instância nova do módulo (os fluxos são de sessão). No fim, a
// trava única (withPermissionPrompt): o pedido de localização da home e os da lib nunca ao mesmo tempo.
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
    order: [] as string[], // pedidos de permissão, em ordem
    attHold: false, // o alerta do ATT fica na tela até answerAtt (a promessa não resolve antes)
    answerAtt: (_status: string) => {},
    pushAnswer: null as number | null, // o que o pedido de notificação do iOS responde (null = o status atual)
    ump: null as Promise<any> | null, // gatherConsent controlado pelo teste (null = responde na hora)
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
            state.order.push("push");
            const answer = state.androidAnswers.shift() ?? "denied";
            if (answer === "hang") return never();
            if (answer === "granted") state.androidPush = true;
            return Promise.resolve(answer);
        },
        PERMISSIONS: {POST_NOTIFICATIONS: "android.permission.POST_NOTIFICATIONS"},
        RESULTS: {GRANTED: "granted"},
    },
    NativeModules: {},
    NativeEventEmitter: class {
        addListener() {
            return {remove: () => {}};
        }
    },
}));
mock.module("expo-tracking-transparency", () => ({
    getTrackingPermissionsAsync: () => Promise.resolve({status: state.att}),
    requestTrackingPermissionsAsync: () => {
        state.attRequests++;
        state.order.push("att");
        if (state.attHold) {
            return new Promise((resolve) => {
                state.answerAtt = (status: string) => {
                    state.att = status;
                    resolve({status});
                };
            });
        }
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
    requestPermission: () => {
        state.order.push("push");
        if (state.pushAnswer !== null) state.pushStatus = state.pushAnswer;
        return Promise.resolve(state.pushStatus);
    },
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
    AdsConsent: {gatherConsent: () => state.ump ?? Promise.resolve({canRequestAds: true, status: "NOT_REQUIRED"})},
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
    delete (globalThis as any).isAdsEnabled;
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
        order: [],
        attHold: false,
        answerAtt: () => {},
        pushAnswer: null,
        ump: null,
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
    // A notificação já concedida também passa pelo pedido, que volta sem mostrar nada: 1 tentativa.
    expect(consentEvents()).toEqual([{ump: "not_required", att: "granted", push: "granted", att_attempts: 2, push_attempts: 1}]);
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
    expect(state.fbTracking).toEqual([false]);
    // A notificação (iOS: pedido direto, sem leitura) só pede depois do fim do ATT; com o ATT pendente a cadeia não
    // espera mais 20 s por ela e segue.
    expect(done).toBe(true);
    expect(consentEvents()).toEqual([{ump: "not_required", att: "undetermined", push: "timeout", att_attempts: 1, push_attempts: 0}]);

    state.attAnswers = ["granted"];
    await setAppState("background"); // a pessoa sai e volta: nova tentativa no próximo active
    await setAppState("active");
    await flush();
    expect(state.attRequests).toBe(2);
    expect(isAttPending()).toBe(false);
    expect(state.fbTracking).toEqual([false, true]);
    expect(state.refreshed).toEqual(["appl_chave"]);
    expect(state.userProps.att_status).toBe("granted");
    expect(consentEvents().at(-1)).toEqual({ump: "not_required", att: "granted", push: "granted", att_attempts: 2, push_attempts: 1});
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

test("iOS 27: alerta do ATT na tela além do limite (o app segue active) → a notificação não sai por cima; sai depois da resposta", async () => {
    state.attHold = true;
    state.pushStatus = -1; // notificação nunca perguntada
    state.pushAnswer = 1;
    const {default: Utils} = await load();
    let done = false;
    Utils.requestTrackingWhenActive(appConfig, appStrings).then(() => (done = true));
    await advance(LIMIT + 5000);
    expect(state.order).toEqual(["att"]);
    expect(state.fbTracking).toEqual([false]); // a cadeia seguiu pelo limite do ATT
    await advance(LIMIT);
    expect(done).toBe(true); // e pelo limite do push: TikTok, link-in-bio e update não ficam presos
    expect(state.order).toEqual(["att"]);
    expect(consentEvents()).toEqual([{ump: "not_required", att: "undetermined", push: "timeout", att_attempts: 1, push_attempts: 0}]);

    state.answerAtt("granted");
    await flush();
    expect(state.order).toEqual(["att", "push"]);
    expect(state.fbTracking).toEqual([false, true]);
    expect(consentEvents().at(-1)).toEqual({ump: "not_required", att: "granted", push: "granted", att_attempts: 1, push_attempts: 1});
});

test("iOS 26: app fora de active além do limite → no mesmo \"ficou ativo\" só o ATT pede; a notificação vem depois da resposta", async () => {
    state.appState = "inactive";
    state.attHold = true;
    state.pushStatus = -1;
    state.pushAnswer = 1;
    const {default: Utils} = await load();
    let done = false;
    Utils.requestTrackingWhenActive(appConfig, appStrings).then(() => (done = true));
    await advance(2 * LIMIT + 2000);
    expect(done).toBe(true);
    expect(state.order).toEqual([]);

    await setAppState("active");
    expect(state.order).toEqual(["att"]); // um pedido por vez: o push espera o ATT na tela
    await setAppState("inactive"); // o alerta do ATT deixa o app inactive no iOS 26
    state.answerAtt("denied");
    await flush();
    expect(state.order).toEqual(["att"]); // ATT respondido, mas o app ainda não voltou a active
    await setAppState("active");
    expect(state.order).toEqual(["att", "push"]);
    expect(consentEvents().at(-1)).toEqual({ump: "not_required", att: "denied", push: "granted", att_attempts: 1, push_attempts: 1});
});

test("notificação já respondida: espera o fim do ATT, e o pedido volta sem mostrar nada", async () => {
    state.attHold = true;
    state.pushStatus = 1;
    const {default: Utils} = await load();
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(LIMIT + 1000);
    expect(state.order).toEqual(["att"]);
    state.answerAtt("denied");
    await flush();
    expect(state.order).toEqual(["att", "push"]);
    expect(consentEvents().at(-1)).toMatchObject({att: "denied", push: "granted", att_attempts: 1, push_attempts: 1});
});

test("app open × UMP: com o ATT sem resposta, conta como ATT pendente já enquanto o UMP roda; respondido ou Android, não", async () => {
    let answerUmp: () => void = () => {};
    state.ump = new Promise((resolve) => (answerUmp = () => resolve({canRequestAds: true, status: "NOT_REQUIRED"})));
    state.attAnswers = ["granted"];
    const {default: Utils, isAttPending} = await load();
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await flush();
    expect(state.attRequests).toBe(0);
    expect(isAttPending()).toBe(true);
    answerUmp();
    await flush();
    expect(state.attRequests).toBe(1);
    expect(isAttPending()).toBe(false);

    // ATT já respondido em outra abertura: o UMP rodando não segura o app open.
    state.att = "denied";
    state.ump = new Promise(() => {});
    const second = await load();
    second.default.requestTrackingWhenActive(appConfig, appStrings);
    await flush();
    expect(second.isAttPending()).toBe(false);

    state.os = "android";
    state.att = "undetermined";
    const android = await load();
    android.default.requestTrackingWhenActive(appConfig, appStrings);
    await flush();
    expect(android.isAttPending()).toBe(false);
});

// Pedido de localização da home, controlado pelo teste.
const homeLocation = (withPermissionPrompt: <T>(fn: () => Promise<T>) => Promise<T>) => {
    let answer: (status: string) => void = () => {};
    const seen: {status?: string; error?: Error} = {};
    const done = withPermissionPrompt(() => {
        state.order.push("location");
        return new Promise<string>((resolve) => (answer = resolve));
    }).then(
        (status) => (seen.status = status),
        (error) => (seen.error = error),
    );
    return {seen, done, answer: (status: string) => answer(status)};
};

test("a trava é uma só: exportada de forma nomeada e no Utils, e o requestPushPermission público passa por ela", async () => {
    state.os = "android";
    state.androidAnswers = ["granted"];
    const {default: Utils, withPermissionPrompt} = await load();
    expect(Utils.withPermissionPrompt).toBe(withPermissionPrompt);
    const location = homeLocation(withPermissionPrompt);
    const push = Utils.requestPushPermission();
    await flush();
    expect(state.order).toEqual(["location"]);
    location.answer("granted");
    expect(await push).toBe("granted");
    expect(state.order).toEqual(["location", "push"]);
});

test("Android com anúncio desligado: a home pede localização no mesmo instante da cadeia → a notificação só sai depois da resposta", async () => {
    state.os = "android";
    (globalThis as any).isAdsEnabled = false; // setupMobileAds volta na hora: trava da loja, revisão, gradual
    state.androidAnswers = ["granted"];
    const {default: Utils, withPermissionPrompt} = await load();
    const location = homeLocation(withPermissionPrompt);
    let done = false;
    Utils.requestTrackingWhenActive(appConfig, appStrings).then(() => (done = true));
    await flush();
    expect(state.order).toEqual(["location"]); // sem a trava, POST_NOTIFICATIONS sairia aqui e a localização penduraria
    await setAppState("background"); // o diálogo pausa a Activity
    await advance(3 * LIMIT);
    expect(state.order).toEqual(["location"]);
    expect(location.seen).toEqual({});
    await setAppState("active");
    location.answer("granted");
    await location.done;
    await flush();
    expect(location.seen.status).toBe("granted");
    expect(state.order).toEqual(["location", "push"]);
    expect(done).toBe(true);
    expect(state.fbTracking).toEqual([true]);
    expect(consentEvents().at(-1)).toMatchObject({att: "na", push: "granted", push_attempts: 1});
});

test("Android: a cadeia pede primeiro → a localização da home espera a resposta da notificação", async () => {
    state.os = "android";
    (globalThis as any).isAdsEnabled = false;
    state.androidAnswers = ["hang"];
    const {default: Utils, withPermissionPrompt} = await load();
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await flush();
    expect(state.order).toEqual(["push"]);
    const location = homeLocation(withPermissionPrompt);
    await flush();
    expect(state.order).toEqual(["push"]);
    await advance(LIMIT); // notificação pendurada: a trava não fica presa e a home não fica sem resposta
    expect(state.order).toEqual(["push", "location"]);
    location.answer("granted");
    await location.done;
    expect(location.seen.status).toBe("granted");
});

test("Android: localização pendurada (pedido de terceiro trocou o listener) → no limite a home segue e a notificação sai", async () => {
    state.os = "android";
    (globalThis as any).isAdsEnabled = false;
    state.androidAnswers = ["granted"];
    const {default: Utils, withPermissionPrompt} = await load();
    const location = homeLocation(withPermissionPrompt); // nunca responde
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(LIMIT - 1000);
    expect(location.seen).toEqual({});
    expect(state.order).toEqual(["location"]);
    await advance(1000);
    await location.done;
    expect(location.seen.error?.message).toContain("sem resposta no limite");
    expect(state.order).toEqual(["location", "push"]);
});

test("iOS 26: localização → ATT → notificação, um de cada vez, cada um no \"ficou ativo\" depois da resposta do anterior", async () => {
    (globalThis as any).isAdsEnabled = false;
    state.attHold = true;
    state.pushStatus = -1;
    state.pushAnswer = 1;
    const {default: Utils, withPermissionPrompt} = await load();
    const location = homeLocation(withPermissionPrompt);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await flush();
    expect(state.order).toEqual(["location"]);

    await setAppState("inactive"); // alerta de localização
    await advance(2 * LIMIT);
    expect(state.order).toEqual(["location"]);
    expect(state.attRequests).toBe(0);
    location.answer("granted");
    await location.done;
    await flush();
    expect(state.order).toEqual(["location"]); // respondida, app ainda inactive
    await setAppState("active");
    expect(state.order).toEqual(["location", "att"]);
    expect(state.attRequests).toBe(1); // uma chamada só, com o app ativo: nenhum descarte

    await setAppState("inactive"); // alerta do ATT
    state.answerAtt("granted");
    await flush();
    expect(state.order).toEqual(["location", "att"]);
    await setAppState("active");
    expect(state.order).toEqual(["location", "att", "push"]);
    expect(consentEvents().at(-1)).toMatchObject({att: "granted", push: "granted", att_attempts: 1, push_attempts: 1});
});

test("iOS 27: alerta de localização na tela com o app active → o ATT espera até 60 s; depois a trava solta e o \"Permitir\" tardio vale", async () => {
    (globalThis as any).isAdsEnabled = false;
    state.attAnswers = ["granted"];
    const {default: Utils, withPermissionPrompt} = await load();
    const location = homeLocation(withPermissionPrompt);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(59000);
    expect(state.order).toEqual(["location"]);
    expect(location.seen).toEqual({});
    await advance(1000);
    // ATT respondido na hora; a notificação já concedida volta sem mostrar nada.
    expect(state.order).toEqual(["location", "att", "push"]);
    expect(location.seen).toEqual({}); // a home continua esperando a resposta de verdade, sem erro
    location.answer("granted");
    await location.done;
    expect(location.seen.status).toBe("granted");
});

test("iOS: pedido do app pendurado (a resposta nunca vem) → espera mais um limite e rejeita; quem chama não fica preso", async () => {
    (globalThis as any).isAdsEnabled = false;
    const {withPermissionPrompt} = await load();
    const location = homeLocation(withPermissionPrompt);
    await advance(60000);
    expect(location.seen).toEqual({}); // passou da trava: a resposta de verdade ainda vale
    await advance(59000);
    expect(location.seen).toEqual({});
    await advance(1000);
    await location.done;
    expect(location.seen.error?.message).toContain("sem resposta no limite");
});

// Anúncio só depois do consentimento (`ads_wait_consent_enabled`, desligada por padrão): whenAdsConsentReady espera o UMP
// e, no iOS, a resposta do ATT — não o limite de 20 s da cadeia —, com limite de segurança de 60 s depois do UMP.
const watchAds = (whenAdsConsentReady: () => Promise<void>) => {
    const seen = {ready: false};
    whenAdsConsentReady().then(() => (seen.ready = true));
    return seen;
};

test("ads_wait_consent_enabled desligada (padrão): anúncio liberado na hora, antes do UMP e do ATT", async () => {
    (globalThis as any).remoteConfigUtils = {};
    const {whenAdsConsentReady, isAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    await flush();
    expect(seen.ready).toBe(true);
    expect(isAdsConsentReady()).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, iOS: o ATT na fila atrás da localização → não libera no limite de 20 s da cadeia; libera com a resposta do ATT", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.attAnswers = ["granted"];
    const {default: Utils, withPermissionPrompt, whenAdsConsentReady, isAdsConsentReady, whenConsentFlowDone} = await load();
    const location = homeLocation(withPermissionPrompt); // a localização da home chegou primeiro
    const seen = watchAds(whenAdsConsentReady);
    let flow = false;
    whenConsentFlowDone().then(() => (flow = true));
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(LIMIT + 1000);
    expect(flow).toBe(true); // a cadeia seguiu no limite...
    expect(state.order).toEqual(["location"]); // ...com o ATT ainda na fila
    expect(seen.ready).toBe(false);
    expect(isAdsConsentReady()).toBe(false);
    location.answer("granted");
    await flush();
    expect(state.order.slice(0, 2)).toEqual(["location", "att"]);
    expect(seen.ready).toBe(true);
    expect(isAdsConsentReady()).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, iOS: ATT na tela sem resposta → libera no limite de segurança de 60 s depois do UMP", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.attHold = true;
    const {default: Utils, whenAdsConsentReady, isAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(59000);
    expect(state.attRequests).toBe(1);
    expect(seen.ready).toBe(false);
    await advance(1000);
    expect(seen.ready).toBe(true);
    expect(isAdsConsentReady()).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, iOS: ATT já respondido numa abertura anterior → libera logo depois do UMP, sem pedir", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.att = "denied";
    const {default: Utils, whenAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await flush();
    expect(state.attRequests).toBe(0);
    expect(seen.ready).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, Android: espera o UMP e libera assim que ele responde (não há ATT)", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.os = "android";
    let answerUmp: () => void = () => {};
    state.ump = new Promise((resolve) => (answerUmp = () => resolve({canRequestAds: true, status: "NOT_REQUIRED"})));
    const {default: Utils, whenAdsConsentReady, isAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(3000);
    expect(seen.ready).toBe(false);
    expect(isAdsConsentReady()).toBe(false);
    answerUmp();
    await flush();
    expect(seen.ready).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, iOS: o limite de 60 s não conta o segundo plano — volta depois de 2 min e não libera junto com a nova tentativa", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.attHold = true;
    const {default: Utils, whenAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(10000);
    await setAppState("background");
    await advance(120000);
    await setAppState("active");
    await advance(1000);
    expect(seen.ready).toBe(false); // o timer do JS venceu fora, mas o limite parou no background
    await advance(58000);
    expect(seen.ready).toBe(false);
    await advance(2000);
    expect(seen.ready).toBe(true); // 60 s inteiros depois da volta
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, Android: o formulário do UMP aberto passa dos 20 s → a cadeia segue, mas o anúncio espera a resposta de verdade", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.os = "android";
    let answerUmp: () => void = () => {};
    state.ump = new Promise((resolve) => (answerUmp = () => resolve({canRequestAds: true, status: "OBTAINED"})));
    const {default: Utils, whenAdsConsentReady, whenConsentFlowDone} = await load();
    const seen = watchAds(whenAdsConsentReady);
    let flow = false;
    whenConsentFlowDone().then(() => (flow = true));
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(25000);
    expect(flow).toBe(true); // a cadeia seguiu no limite de 20 s do UMP
    expect(seen.ready).toBe(false);
    answerUmp();
    await flush();
    expect(seen.ready).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada: UMP nega (canRequestAds=false) → nenhum anúncio na sessão, nem no limite de 60 s", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.att = "denied";
    state.ump = Promise.resolve({canRequestAds: false, status: "REQUIRED"});
    const {default: Utils, whenAdsConsentReady, isAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(120000);
    expect(seen.ready).toBe(false);
    expect(isAdsConsentReady()).toBe(false);
    delete (globalThis as any).remoteConfigUtils;
});

test("antes do Remote Config chegar: isAdsConsentReady() = true (como antes da chave) e isAdsConsentReady(true) = false", async () => {
    delete (globalThis as any).remoteConfigUtils;
    const {isAdsConsentReady} = await load();
    expect(isAdsConsentReady()).toBe(true);
    expect(isAdsConsentReady(true)).toBe(false);
    (globalThis as any).remoteConfigUtils = {};
    expect(isAdsConsentReady(true)).toBe(true);
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    expect(isAdsConsentReady(true)).toBe(false);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, iOS 27: localização segurada 90 s (o ATT na fila) → o limite só começa quando o ATT aparece; nada sai aos 61 s", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.attHold = true;
    const {default: Utils, withPermissionPrompt, whenAdsConsentReady} = await load();
    homeLocation(withPermissionPrompt); // a localização fica na tela, com o app active (iOS 27)
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(61000);
    expect(state.attRequests).toBe(1); // a trava soltou aos 60 s e o ATT apareceu agora
    expect(seen.ready).toBe(false); // antes, o anúncio saía aqui, junto com o ATT
    await advance(57000);
    expect(seen.ready).toBe(false);
    await advance(3000);
    expect(seen.ready).toBe(true); // 1 min depois de o ATT aparecer
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, iOS 26: localização na tela com o app inactive por muito tempo (o ATT nunca chega a ser pedido) → libera no limite de 3 min", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    const {default: Utils, withPermissionPrompt, whenAdsConsentReady} = await load();
    homeLocation(withPermissionPrompt);
    await setAppState("inactive"); // o alerta de localização deixa o app inactive no iOS 26
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(179000);
    expect(state.attRequests).toBe(0);
    expect(seen.ready).toBe(false);
    await advance(2000);
    expect(seen.ready).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada, Android: UMP que nunca responde → libera no limite de 1 min (a cadeia já seguiu aos 20 s)", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.os = "android";
    state.ump = new Promise(() => {});
    const {default: Utils, whenAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(59000);
    expect(seen.ready).toBe(false);
    await advance(2000);
    expect(seen.ready).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
});

test("ligada: UMP responde 'não' antes do limite de 1 min → continua sem anúncio depois do limite", async () => {
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true};
    state.os = "android";
    let deny: () => void = () => {};
    state.ump = new Promise((resolve) => (deny = () => resolve({canRequestAds: false, status: "REQUIRED"})));
    const {default: Utils, whenAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await advance(30000);
    deny();
    await advance(120000);
    expect(seen.ready).toBe(false);
    delete (globalThis as any).remoteConfigUtils;
});

test("whenAdsConsentReady chamado antes do Remote Config: espera ele chegar e respeita a chave ligada", async () => {
    delete (globalThis as any).remoteConfigUtils;
    (globalThis as any).__DEV__ = false;
    state.os = "android";
    let answerUmp: () => void = () => {};
    state.ump = new Promise((resolve) => (answerUmp = () => resolve({canRequestAds: true, status: "NOT_REQUIRED"})));
    const {default: Utils, whenAdsConsentReady} = await load();
    const seen = watchAds(whenAdsConsentReady);
    (globalThis as any).remoteConfigUtils = {ads_wait_consent_enabled: true}; // chega enquanto ele espera o Remote Config
    await flush();
    expect(seen.ready).toBe(false);
    Utils.requestTrackingWhenActive(appConfig, appStrings);
    await flush();
    expect(seen.ready).toBe(false);
    answerUmp();
    await flush();
    expect(seen.ready).toBe(true);
    delete (globalThis as any).remoteConfigUtils;
    delete (globalThis as any).__DEV__;
});
