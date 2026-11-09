// Ordem dos diálogos da abertura (opção dialogOrder) e pedidos do app depois deles (appDialogsAfterOpen). Importa o Utils.ts
// de verdade, com as dependências mockadas, e abre o app como o layout: prepare com as opções e o handleReady do 1º
// frame. O UMP se comporta como o SDK: a consulta diz se há formulário e o
// loadAndShowConsentFormIfRequired só mostra com status REQUIRED (Europa). Cada diálogo fica na tela até a resposta, e o
// trace guarda, com o tempo, tudo o que a abertura chama e os eventos dela. Cada teste usa uma instância nova do módulo.
//
// A 1ª parte prova que a ordem padrão, sem appDialogsAfterOpen, faz o mesmo que a a5dd560 (antes das opções novas): as
// sequências esperadas foram gravadas rodando estes mesmos cenários no Utils.ts da a5dd560, e essa parte passa nele sem
// mudança. Depois: a ordem nova no Brasil e na Europa (com o fim do consentimento depois do initialize), ordens inválidas,
// *DialogOnOpen false, appDialogsAfterOpen (até a resposta de verdade do ATT e da notificação da abertura, com as
// armadilhas de quem não deve esperar), ads_wait_consent_enabled e todas as combinações sem trava circular.
import {afterAll, beforeAll, beforeEach, describe, expect, jest, mock, test} from "bun:test";

type Dialog = "ump" | "att" | "push" | "location";

const stub = () => () => {};
const resolved = (value?: any) => () => Promise.resolve(value);
const never = <T>() => new Promise<T>(() => {});

const state = {
    os: "ios" as "ios" | "android",
    appState: "active",
    // Como os alertas do sistema mexem no AppState: "ios27" (o app segue active) ou "ios26" (inactive com o alerta na
    // tela). No Android o diálogo de permissão pausa a Activity (background) até a resposta. O formulário do UMP é do app.
    alerts: "ios27" as "ios26" | "ios27",
    region: "BR" as "BR" | "EU", // EU: a consulta do UMP volta REQUIRED e o formulário aparece
    umpStatus: "UNKNOWN",
    umpAllows: true, // canRequestAds depois do formulário
    infoMs: 0, // a consulta do UMP responde depois disso (rede)
    infoHang: false, // a consulta do UMP nunca responde
    premium: false,
    premiumHang: false, // a leitura de premium nunca responde (a cadeia para no UMP)
    initMs: 0, // o initialize do SDK de anúncios responde depois disso (adapters de mediação)
    att: "undetermined",
    attDiscard: 0, // pedidos de ATT que o iOS descarta (voltam undetermined sem mostrar nada)
    push: -1, // AuthorizationStatus do RNFB no iOS: -1 não perguntado, 0 negado, 1 autorizado
    androidPush: false,
    // Android: notificação negada para sempre. O check volta false e o pedido volta "never_ask_again" na hora, sem diálogo
    // (o app nem sai de active).
    androidPushBlocked: false,
    androidPushHang: false, // Android: a promessa do pedido nunca resolve e nenhum diálogo aparece (o app segue active)
    pushHang: false, // iOS: a resposta da notificação não volta ao app (o RNFB lê o getNotificationSettings depois dela)
    pushLost: false, // iOS: o pedido volta "não determinado" na hora, sem mostrar nada (pedido perdido)
    rcUtils: {} as Record<string, any>,
    storage: new Map<string, string>(),
};
const listeners = new Set<(next: string) => void>();

// Tempo simulado (ms) e o registro da abertura.
let clock = 0;
let trace: string[] = [];
const log = (entry: string) => {
    trace.push(`${clock / 1000}s ${entry}`);
};

// O sistema avisa o AppState na hora (o RN avisa por evento).
const changeAppState = (next: string) => {
    if (state.appState === next) return;
    state.appState = next;
    for (const listener of [...listeners]) listener(next);
};
const setAppState = async (next: string) => {
    changeAppState(next);
    await flush();
};

// Diálogos na tela: cada um até a resposta (do teste, com `answer`, ou automática, com `autoAnswer`).
const onScreen: Dialog[] = [];
let mostOnScreen = 0;
const pendingAnswers = new Map<Dialog, (value: string) => void>();
let autoAnswer: Partial<Record<Dialog, [number, string]>> = {};
const leavesActive = (dialog: Dialog) => dialog !== "ump" && (state.os === "android" || state.alerts === "ios26");
const show = (dialog: Dialog): Promise<string> => {
    log(`${dialog}:aparece`);
    onScreen.push(dialog);
    mostOnScreen = Math.max(mostOnScreen, onScreen.length);
    if (leavesActive(dialog)) changeAppState(state.os === "android" ? "background" : "inactive");
    return new Promise<string>((resolve) => {
        pendingAnswers.set(dialog, (value) => {
            pendingAnswers.delete(dialog);
            onScreen.splice(onScreen.indexOf(dialog), 1);
            log(`${dialog}:responde=${value}`);
            if (leavesActive(dialog)) changeAppState("active");
            resolve(value);
        });
        const plan = autoAnswer[dialog];
        if (plan) setTimeout(() => pendingAnswers.get(dialog)?.(plan[1]), plan[0]);
    });
};
const answer = async (dialog: Dialog, value: string) => {
    const respond = pendingAnswers.get(dialog);
    if (!respond) throw new Error(`${dialog} não está na tela`);
    respond(value);
    await flush();
};

let current: any = null; // o módulo da abertura em teste
let attPending = false;
const flush = async () => {
    for (let i = 0; i < 200; i++) await Promise.resolve();
    // isAttPending (o app open lê na volta ao app): cada mudança entra no trace.
    const pending = current ? current.isAttPending() : false;
    if (pending !== attPending) {
        attPending = pending;
        log(`attPendente=${pending}`);
    }
};
const advance = async (ms: number, step = 500) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
        await flush();
        clock += step;
        jest.advanceTimersByTime(step);
    }
    await flush();
};

mock.module("react-native", () => ({
    Alert: {alert: () => log("alerta")},
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
    DevSettings: {addMenuItem: stub(), reload: stub()},
    PermissionsAndroid: {
        check: () => {
            log("push:le");
            return Promise.resolve(state.androidPush);
        },
        request: () => {
            log("push:pede");
            if (state.androidPush) return Promise.resolve("granted");
            if (state.androidPushBlocked) return Promise.resolve("never_ask_again");
            if (state.androidPushHang) return never<string>();
            return show("push").then((value) => {
                if (value === "granted") state.androidPush = true;
                return value;
            });
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
    getTrackingPermissionsAsync: () => {
        log("att:le");
        return Promise.resolve({status: state.att});
    },
    requestTrackingPermissionsAsync: () => {
        log("att:pede");
        if (state.att !== "undetermined") return Promise.resolve({status: state.att});
        if (state.attDiscard > 0) {
            state.attDiscard--;
            log("att:descartado");
            return Promise.resolve({status: "undetermined"});
        }
        return show("att").then((status) => {
            state.att = status;
            return {status};
        });
    },
}));
mock.module("@react-native-firebase/messaging", () => ({
    getMessaging: stub(),
    requestPermission: () => {
        log("push:pede");
        if (state.push !== -1) return Promise.resolve(state.push);
        if (state.pushLost) return Promise.resolve(-1);
        const answered = show("push").then((value) => (state.push = value === "granted" ? 1 : 0));
        return state.pushHang ? answered.then(() => never<number>()) : answered;
    },
    onMessage: stub(),
    subscribeToTopic: resolved(),
    getToken: resolved(),
    setBackgroundMessageHandler: stub(),
    experimentalSetDeliveryMetricsExportedToBigQueryEnabled: resolved(),
    registerDeviceForRemoteMessages: resolved(),
    isDeviceRegisteredForRemoteMessages: () => true,
    getAPNSToken: resolved("apns"),
    onNotificationOpenedApp: stub(),
    getInitialNotification: resolved(null),
}));
mock.module("react-native-google-mobile-ads", () => ({
    default: () => ({
        initialize: () => {
            log("anuncios:initialize");
            if (state.initMs) return new Promise((resolve) => setTimeout(() => resolve([]), state.initMs));
            return Promise.resolve([]);
        },
    }),
    AdsConsent: {
        requestInfoUpdate: () => {
            log("ump:consulta");
            if (state.infoHang) return never();
            const info = () => {
                if (state.umpStatus !== "OBTAINED") state.umpStatus = state.region === "EU" ? "REQUIRED" : "NOT_REQUIRED";
                return {status: state.umpStatus, canRequestAds: state.umpStatus !== "REQUIRED" && state.umpAllows};
            };
            if (state.infoMs) return new Promise((resolve) => setTimeout(() => resolve(info()), state.infoMs));
            return Promise.resolve(info());
        },
        // Como o SDK: só mostra com status REQUIRED; sem formulário, volta na hora.
        loadAndShowConsentFormIfRequired: () => {
            log("ump:formulario");
            if (state.umpStatus !== "REQUIRED") return Promise.resolve({status: state.umpStatus, canRequestAds: state.umpAllows});
            return show("ump").then((value) => {
                state.umpStatus = "OBTAINED";
                state.umpAllows = value !== "recusa";
                return {status: "OBTAINED", canRequestAds: state.umpAllows};
            });
        },
        reset: () => log("ump:reset"),
    },
    AdsConsentDebugGeography: {},
}));
mock.module("react-native-fbsdk-next", () => ({
    Settings: {
        initializeSDK: () => log("fb:init"),
        setAppID: stub(),
        setAdvertiserIDCollectionEnabled: stub(),
        setAdvertiserTrackingEnabled: (enabled: boolean) => {
            log(`fb:tracking=${enabled}`);
            return Promise.resolve();
        },
    },
}));
mock.module("../utils/attribution", () => ({
    runAttributionPhase1: resolved(),
    runAttributionPhase2: (_rckey: string, att: string) => {
        log(`atribuicao:fase2 att=${att}`);
        return Promise.resolve();
    },
    setRcAttributesLate: stub(),
    refreshAttributionAfterAtt: () => {
        log("atribuicao:recoleta");
        return Promise.resolve();
    },
}));
mock.module("../utils/analytics", () => ({
    logUtilsEvent: (name: string, params: any) => {
        if (name === "consent_flow") {
            log(`consent_flow ${params.ump}|${params.att}|${params.push} ${params.att_attempts}/${params.push_attempts}`);
        } else if (name === "expo_utils_warn") log(`aviso ${String(params?.message).slice(0, 48)}`);
    },
    setUtilsUserProperty: (name: string, value: string) => {
        if (name === "att_status") log(`att_status=${value}`);
    },
}));
mock.module("../utils/PremiumUtils", () => ({
    PremiumUtils: {
        getIsPremiumStatus: () => {
            log("premium");
            return state.premiumHang ? never() : Promise.resolve(state.premium);
        },
    },
}));
mock.module("@react-native-async-storage/async-storage", () => ({
    default: {
        getItem: (key: string) => Promise.resolve(state.storage.get(key) ?? null),
        setItem: (key: string, value: string) => {
            state.storage.set(key, value);
            return Promise.resolve();
        },
        clear: resolved(),
    },
}));
mock.module("@react-native-firebase/remote-config", () => ({
    getRemoteConfig: () => ({setConfigSettings: resolved(), setDefaults: resolved()}),
    fetchAndActivate: resolved(),
    getValue: () => ({asString: () => ""}),
}));
mock.module("@react-native-firebase/app", () => ({getApp: () => ({})}));
mock.module("../utils/settings", () => ({
    readRemoteConfigBlocks: () => ({utils: {...state.rcUtils}, screens: {}, source: "settings"}),
    mergeRemoteConfigBlocks: (utils: any, screens: any) => ({...screens, ...utils}),
}));
mock.module("expo-splash-screen", () => ({hideAsync: resolved(), preventAutoHideAsync: resolved(), setOptions: stub()}));
mock.module("expo-localization", () => ({getLocales: () => [{languageCode: "pt", regionCode: "BR"}]}));
mock.module("expo-application", () => ({nativeApplicationVersion: "1.0.0", nativeBuildVersion: "1", applicationId: "com.exemplo"}));
mock.module("expo-device", () => ({isDevice: true}));
mock.module("@microsoft/react-native-clarity", () => ({initialize: stub(), LogLevel: {}}));
mock.module("react-native-purchases", () => ({
    default: {
        isConfigured: resolved(false),
        getCustomerInfo: resolved({}),
        configure: stub(),
        setLogLevel: stub(),
        setLogHandler: stub(),
        addCustomerInfoUpdateListener: stub(),
    },
    LOG_LEVEL: {},
}));
mock.module("expo-dev-menu", () => ({registerDevMenuItems: resolved()}));
mock.module("expo-tiktok-ads-events", () => ({default: {}, TikTokStandardEvents: {}, TikTokWaitForConfig: {}}));
mock.module("../utils/i18n", () => ({getLocalizedMessages: () => ({})}));
mock.module("../utils/hot-updater", () => ({initHotUpdater: resolved()}));
mock.module("../utils/config-integrity", () => ({reportConfigIntegrity: resolved()}));
mock.module("../utils/AdPlacementTracker", () => ({setBlocklist: stub()}));
mock.module("../utils/link-in-bio", () => ({trackLinkInBioInstall: resolved()}));
mock.module("../utils/ad-revenue", () => ({initAdRevenue: stub()}));
mock.module("../utils/push-analytics", () => ({logPushOpened: stub(), logPushReceived: stub()}));
mock.module("../utils/rc-status", () => ({getRevenueCatStatus: stub(), syncRcStatus: resolved()}));
mock.module("../utils/retention-events", () => ({showRetentionPreview: stub()}));

(globalThis as any).__DEV__ = false;
(globalThis as any).disableExpoUtilsWarnings = true;
(globalThis as any).disableExpoUtilsLogs = true;

// Trava da loja desligada (a abertura não consulta a loja) e o App ID do FB.
const appConfig = {
    expo: {
        slug: "exemplo",
        plugins: [
            ["react-native-fbsdk-next", {appID: "123"}],
            ["expo-utils", {disableAdsIfBuildIsNewerThanStore: false}],
        ],
    },
};
const appStrings = {rckey: "appl_chave"} as any;

let serial = 0;
const load = async () => {
    current = await import(`../utils/Utils.ts?ordem=${++serial}`);
    return current;
};

/**
 * Abre o app como o layout: prepare (com as opções) e, com `ready`, o handleReady do 1º frame. Antes do handleReady roda
 * `beforeReady` (o que a 1ª tela faz ao montar). O trace ganha o fim da cadeia, o fim do consentimento da abertura
 * (whenConsentFlowDone) e a liberação ou a negação dos anúncios (ads_wait_consent_enabled).
 */
const open = async (options?: any, {ready = true, beforeReady}: {ready?: boolean; beforeReady?: (m: any) => void} = {}) => {
    const m = await load();
    const Utils = m.default;
    const chain = Utils.requestTrackingWhenActive;
    Utils.requestTrackingWhenActive = (...args: any[]) =>
        chain(...args).then((granted: boolean) => {
            log("cadeia:fim");
            return granted;
        });
    await Utils.prepare(() => {}, appConfig, appStrings, options);
    m.whenConsentFlowDone().then(() => log("consentimento:fim"));
    m.whenAdsConsentReady().then(() => log("anuncio:liberado"));
    m.whenAdsConsentDenied().then(() => log("anuncio:negado"));
    beforeReady?.(m);
    if (ready) Utils.handleReady();
    await flush();
    return m;
};

// Pedido de permissão da 1ª tela (a localização da Início) pela trava da lib.
const askLocation = (m: any) => {
    const seen: {status?: string; error?: string} = {};
    m.withPermissionPrompt(() => show("location")).then(
        (status: string) => {
            seen.status = status;
            log(`app:localizacao=${status}`);
        },
        (error: Error) => {
            seen.error = error.message;
            log("app:localizacao=erro");
        },
    );
    return seen;
};

// Só as linhas do trace com um destes trechos.
const only = (...parts: string[]) => trace.filter((line) => parts.some((part) => line.includes(part)));
const dialogs = () => only(":aparece", ":responde");
// Os instantes das linhas com o trecho, sem depender da ordem entre linhas do mesmo instante.
const times = (part: string) => only(part).map((line) => line.split(" ")[0]);

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => reset());
// Abertura nova: estado, tempo, trace e diálogos zerados (os timers e ouvintes da abertura anterior saem junto).
const reset = () => {
    jest.clearAllTimers();
    listeners.clear();
    for (const key of ["isAdsEnabled", "remoteConfigUtils", "remoteConfigs", "remoteConfigScreens", "adUnits", "adsDisabledByStoreGate"]) {
        delete (globalThis as any)[key];
    }
    Object.assign(state, {
        os: "ios",
        appState: "active",
        alerts: "ios27",
        region: "BR",
        umpStatus: "UNKNOWN",
        umpAllows: true,
        infoMs: 0,
        infoHang: false,
        premium: false,
        premiumHang: false,
        initMs: 0,
        att: "undetermined",
        attDiscard: 0,
        push: -1,
        androidPush: false,
        androidPushBlocked: false,
        androidPushHang: false,
        pushHang: false,
        pushLost: false,
        rcUtils: {},
        storage: new Map(),
    });
    clock = 0;
    trace = [];
    onScreen.length = 0;
    mostOnScreen = 0;
    pendingAnswers.clear();
    autoAnswer = {};
    current = null;
    attPending = false;
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 1. Ordem padrão = a5dd560
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("ordem padrão, sem appDialogsAfterOpen: a mesma sequência da a5dd560", () => {
    const golden = (expected: string[]) => expect(trace).toEqual(expected);

    test("iPhone, Brasil, 1ª abertura: ATT e notificação respondidos em 2 s", async () => {
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"]};
        await open();
        await advance(8000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario",
            "0s anuncios:initialize", "0s att:le", "0s att:pede", "0s att:aparece", "0s attPendente=true",
            "2s att:responde=granted", "2s att_status=granted", "2s fb:init", "2s fb:tracking=true", "2s consentimento:fim",
            "2s atribuicao:fase2 att=granted", "2s push:pede", "2s push:aparece", "2s attPendente=false",
            "4s push:responde=granted", "4s consent_flow not_required|granted|granted 1/1", "4s cadeia:fim",
        ]);
    });

    test("iPhone, Europa: formulário respondido em 5 s, depois ATT e notificação", async () => {
        state.region = "EU";
        autoAnswer = {ump: [5000, "aceita"], att: [2000, "granted"], push: [2000, "denied"]};
        await open();
        await advance(14000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario", "0s ump:aparece",
            "0s attPendente=true", "5s ump:responde=aceita", "5s anuncios:initialize", "5s att:le", "5s att:pede",
            "5s att:aparece", "7s att:responde=granted", "7s att_status=granted", "7s fb:init", "7s fb:tracking=true",
            "7s consentimento:fim", "7s atribuicao:fase2 att=granted", "7s push:pede", "7s push:aparece",
            "7s attPendente=false", "9s push:responde=denied", "9s consent_flow obtained|granted|denied 1/1",
            "9s cadeia:fim",
        ]);
    });

    test("iPhone, Europa: formulário aberto 25 s — a cadeia segue aos 20 s (initialize e ATT) e a resposta chega depois", async () => {
        state.region = "EU";
        autoAnswer = {ump: [25000, "aceita"], att: [2000, "granted"], push: [2000, "granted"]};
        await open();
        await advance(32000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario", "0s ump:aparece",
            "0s attPendente=true", "20s aviso setupMobileAds: gatherConsent não respondeu em 2", "20s anuncios:initialize",
            "20s att:le", "20s att:pede", "20s att:aparece", "22s att:responde=granted", "22s att_status=granted",
            "22s fb:init", "22s fb:tracking=true", "22s consentimento:fim", "22s atribuicao:fase2 att=granted",
            "22s push:pede", "22s push:aparece", "22s attPendente=false", "24s push:responde=granted",
            "24s consent_flow timeout|granted|granted 1/1", "24s cadeia:fim", "25s ump:responde=aceita",
        ]);
    });

    test("iPhone, Brasil: initialize lento (5 s) → o ATT espera por ele", async () => {
        state.initMs = 5000;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"]};
        await open();
        await advance(8000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario",
            "0s anuncios:initialize", "0s attPendente=true", "5s att:le", "5s att:pede", "5s att:aparece",
            "6s att:responde=granted", "6s att_status=granted", "6s fb:init", "6s fb:tracking=true", "6s consentimento:fim",
            "6s atribuicao:fase2 att=granted", "6s push:pede", "6s push:aparece", "6s attPendente=false",
            "7s push:responde=granted", "7s consent_flow not_required|granted|granted 1/1", "7s cadeia:fim",
        ]);
    });

    test("iOS 27: ATT na tela 25 s → a notificação só depois da resposta (push=timeout no consent_flow)", async () => {
        autoAnswer = {att: [25000, "granted"], push: [1000, "granted"]};
        await open();
        await advance(30000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario",
            "0s anuncios:initialize", "0s att:le", "0s att:pede", "0s att:aparece", "0s attPendente=true", "20s att:le",
            "20s att_status=undetermined", "20s fb:init", "20s fb:tracking=false", "20s consentimento:fim",
            "20s atribuicao:fase2 att=undetermined", "20s consent_flow not_required|undetermined|timeout 1/0",
            "20s cadeia:fim", "25s att:responde=granted", "25s att_status=granted", "25s fb:tracking=true",
            "25s atribuicao:recoleta", "25s consent_flow not_required|granted|timeout 1/0", "25s push:pede",
            "25s push:aparece", "25s attPendente=false", "26s push:responde=granted",
            "26s consent_flow not_required|granted|granted 1/1",
        ]);
    });

    test("iOS 26: os alertas deixam o app inactive enquanto estão na tela", async () => {
        state.alerts = "ios26";
        autoAnswer = {att: [3000, "denied"], push: [3000, "granted"]};
        await open();
        await advance(9000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario",
            "0s anuncios:initialize", "0s att:le", "0s att:pede", "0s att:aparece", "0s attPendente=true",
            "3s att:responde=denied", "3s att_status=denied", "3s fb:init", "3s fb:tracking=false", "3s consentimento:fim",
            "3s atribuicao:fase2 att=denied", "3s push:pede", "3s push:aparece", "3s attPendente=false",
            "6s push:responde=granted", "6s consent_flow not_required|denied|granted 1/1", "6s cadeia:fim",
        ]);
    });

    test("iOS: ATT descartado (app saiu e voltou) → pede de novo no próximo active", async () => {
        state.attDiscard = 1;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"]};
        await open();
        await advance(3000);
        await setAppState("background");
        await setAppState("active");
        await advance(4000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario",
            "0s anuncios:initialize", "0s att:le", "0s att:pede", "0s att:descartado", "0s attPendente=true", "3s att:le",
            "3s att:pede", "3s att:aparece", "4s att:responde=granted", "4s att_status=granted", "4s fb:init",
            "4s fb:tracking=true", "4s consentimento:fim", "4s atribuicao:fase2 att=granted", "4s push:pede",
            "4s push:aparece", "4s attPendente=false", "5s push:responde=granted",
            "5s consent_flow not_required|granted|granted 2/1", "5s cadeia:fim",
        ]);
    });

    test("Android, Brasil: notificação", async () => {
        state.os = "android";
        autoAnswer = {push: [2000, "granted"]};
        await open();
        await advance(4000);
        golden([
            "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario", "0s anuncios:initialize",
            "0s att_status=na", "0s fb:init", "0s fb:tracking=true", "0s push:le", "0s consentimento:fim",
            "0s atribuicao:fase2 att=na", "0s push:pede", "0s push:aparece", "2s push:responde=granted",
            "2s consent_flow not_required|na|granted 0/1", "2s cadeia:fim",
        ]);
    });

    test("Android, Europa: formulário e notificação", async () => {
        state.os = "android";
        state.region = "EU";
        autoAnswer = {ump: [4000, "aceita"], push: [2000, "granted"]};
        await open();
        await advance(8000);
        golden([
            "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario", "0s ump:aparece",
            "4s ump:responde=aceita", "4s anuncios:initialize", "4s att_status=na", "4s fb:init", "4s fb:tracking=true",
            "4s push:le", "4s consentimento:fim", "4s atribuicao:fase2 att=na", "4s push:pede", "4s push:aparece",
            "6s push:responde=granted", "6s consent_flow obtained|na|granted 0/1", "6s cadeia:fim",
        ]);
    });

    test("ads_wait_consent_enabled, iPhone, Brasil: anúncio liberado na resposta do ATT", async () => {
        state.rcUtils = {ads_wait_consent_enabled: true};
        autoAnswer = {att: [3000, "granted"], push: [2000, "granted"]};
        await open();
        await advance(7000);
        golden([
            "0s att:le", "0s premium", "0s ump:consulta", "0s ump:formulario", "0s anuncios:initialize", "0s att:le",
            "0s att:pede", "0s att:aparece", "0s attPendente=true", "3s att:responde=granted", "3s att_status=granted",
            "3s fb:init", "3s fb:tracking=true", "3s consentimento:fim", "3s atribuicao:fase2 att=granted",
            "3s anuncio:liberado", "3s push:pede", "3s push:aparece", "3s attPendente=false", "5s push:responde=granted",
            "5s consent_flow not_required|granted|granted 1/1", "5s cadeia:fim",
        ]);
    });

    test("ads_wait_consent_enabled, Android: consulta do UMP travada → a cadeia segue aos 20 s e o anúncio sai em 1 min", async () => {
        state.os = "android";
        state.infoHang = true;
        state.androidPush = true; // já respondida: nenhum diálogo pausa o app (o limite não corre no segundo plano)
        state.rcUtils = {ads_wait_consent_enabled: true};
        await open();
        await advance(62000, 1000);
        golden([
            "0s premium", "0s ump:consulta", "20s aviso setupMobileAds: gatherConsent não respondeu em 2",
            "20s anuncios:initialize", "20s att_status=na", "20s fb:init", "20s fb:tracking=true", "20s push:le",
            "20s consentimento:fim", "20s atribuicao:fase2 att=na", "20s consent_flow timeout|na|granted 0/0",
            "20s cadeia:fim", "60s aviso ads_wait_consent_enabled: o UMP não respondeu em", "60s anuncio:liberado",
        ]);
    });

    test("ads_wait_consent_enabled, Europa: formulário recusado → nenhum anúncio na sessão", async () => {
        state.region = "EU";
        state.att = "denied";
        state.push = 1;
        state.rcUtils = {ads_wait_consent_enabled: true};
        autoAnswer = {ump: [2000, "recusa"]};
        await open();
        await advance(65000, 1000);
        golden([
            "0s att:le", "0s premium", "0s ump:consulta", "0s ump:formulario", "0s ump:aparece", "2s ump:responde=recusa",
            "2s att:le", "2s att_status=denied", "2s fb:init", "2s fb:tracking=false", "2s consentimento:fim",
            "2s anuncio:negado", "2s atribuicao:fase2 att=denied", "2s push:pede",
            "2s consent_flow denied|denied|granted 0/1", "2s cadeia:fim",
        ]);
    });

    test("localização da 1ª tela pela trava, antes do handleReady: sai antes do ATT e da notificação", async () => {
        autoAnswer = {location: [3000, "granted"], att: [2000, "granted"], push: [2000, "granted"]};
        await open(undefined, {beforeReady: (m) => askLocation(m)});
        await advance(9000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s location:aparece", "0s ump:formulario",
            "0s anuncios:initialize", "0s att:le", "0s attPendente=true", "3s location:responde=granted",
            "3s app:localizacao=granted", "3s att:pede", "3s att:aparece", "5s att:responde=granted",
            "5s att_status=granted", "5s fb:init", "5s fb:tracking=true", "5s consentimento:fim",
            "5s atribuicao:fase2 att=granted", "5s push:pede", "5s push:aparece", "5s attPendente=false",
            "7s push:responde=granted", "7s consent_flow not_required|granted|granted 1/1", "7s cadeia:fim",
        ]);
    });

    test("requestAttPermission do app durante a consulta do UMP (Europa): espera o formulário", async () => {
        state.region = "EU";
        state.infoMs = 1000;
        autoAnswer = {ump: [2000, "aceita"], att: [2000, "granted"], push: [2000, "granted"]};
        const m = await open();
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        await advance(8000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s attPendente=true", "1s ump:formulario",
            "1s ump:aparece", "3s ump:responde=aceita", "3s anuncios:initialize", "3s att:le", "3s att:pede",
            "3s att:aparece", "5s att:responde=granted", "5s app:att=granted", "5s att_status=granted", "5s fb:init",
            "5s fb:tracking=true", "5s consentimento:fim", "5s atribuicao:fase2 att=granted", "5s push:pede",
            "5s push:aparece", "5s attPendente=false", "7s push:responde=granted",
            "7s consent_flow obtained|granted|granted 1/1", "7s cadeia:fim",
        ]);
    });

    test("umpDialogOnOpen, attDialogOnOpen e pushDialogOnOpen false: a cadeia não pede nada; o app pede depois", async () => {
        state.region = "EU";
        autoAnswer = {ump: [2000, "aceita"], att: [2000, "granted"], push: [2000, "granted"]};
        const m = await open({umpDialogOnOpen: false, attDialogOnOpen: false, pushDialogOnOpen: false});
        await advance(2000);
        m.default.requestUmpConsent().then((status: string) => log(`app:ump=${status}`));
        await advance(3000);
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        await advance(3000);
        m.default.requestPushPermission().then((status: string) => log(`app:push=${status}`));
        await advance(3000);
        golden([
            "0s att:le", "0s anuncio:liberado", "0s att_status=not_asked", "0s fb:init", "0s fb:tracking=false",
            "0s consentimento:fim", "0s atribuicao:fase2 att=not_asked", "0s consent_flow not_asked|not_asked|skipped 0/0",
            "0s cadeia:fim", "2s premium", "2s ump:consulta", "2s ump:formulario", "2s ump:aparece",
            "4s ump:responde=aceita", "4s anuncios:initialize", "4s app:ump=obtained",
            "4s consent_flow obtained|not_asked|skipped 0/0", "5s att:le", "5s att:pede", "5s att:aparece",
            "5s attPendente=true", "7s att:responde=granted", "7s att_status=granted", "7s fb:tracking=true",
            "7s app:att=granted", "7s atribuicao:recoleta", "7s consent_flow obtained|granted|skipped 1/0",
            "7s attPendente=false", "8s push:pede", "8s push:aparece", "10s push:responde=granted", "10s app:push=granted",
            "10s consent_flow obtained|granted|granted 1/1",
        ]);
    });

    test("formato antigo: prepare(..., false) = sem a notificação na abertura", async () => {
        autoAnswer = {att: [1000, "granted"]};
        await open(false);
        await advance(3000);
        golden([
            "0s att:le", "0s premium", "0s anuncio:liberado", "0s ump:consulta", "0s ump:formulario",
            "0s anuncios:initialize", "0s att:le", "0s att:pede", "0s att:aparece", "0s attPendente=true",
            "1s att:responde=granted", "1s att_status=granted", "1s fb:init", "1s fb:tracking=true", "1s consentimento:fim",
            "1s atribuicao:fase2 att=granted", "1s consent_flow not_required|granted|skipped 1/0", "1s cadeia:fim",
            "1s attPendente=false",
        ]);
    });

    test("sem handleReady: o aviso de 30 s libera os anúncios (ads_wait_consent_enabled)", async () => {
        state.rcUtils = {ads_wait_consent_enabled: true};
        await open(undefined, {ready: false});
        await advance(31000, 1000);
        golden([
            "30s aviso handleReady nunca foi chamado: ATT, push, FB, Ti", "30s anuncio:liberado",
        ]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 2. dialogOrder
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A ordem dos apps de eleição: ATT, notificação e, por último, o UMP (que no Brasil não aparece).
const ELEICAO = {dialogOrder: ["att", "push", "ump"]};
// Os diálogos que apareceram, em ordem.
const shown = () => only(":aparece").map((line) => line.split(" ")[1].split(":")[0]);

describe("dialogOrder", () => {
    test('["att", "push", "ump"], iPhone no Brasil: consulta do UMP e initialize no começo; ATT e notificação; o formulário não aparece', async () => {
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"]};
        await open(ELEICAO);
        await advance(6000);
        expect(dialogs()).toEqual(["0s att:aparece", "2s att:responde=granted", "2s push:aparece", "4s push:responde=granted"]);
        // A consulta e o initialize saem com o ATT na tela; o loadAndShowConsentFormIfRequired volta sem mostrar nada.
        expect(only("ump:", "anuncios:")).toEqual(["0s ump:consulta", "0s ump:formulario", "0s anuncios:initialize"]);
        expect(trace.indexOf("0s anuncios:initialize")).toBeLessThan(trace.indexOf("2s att:responde=granted"));
        // FB e atribuição logo depois do ATT; o fim do consentimento (UMP e ATT) e o consent_flow depois do último.
        expect(only("fb:", "atribuicao:", "consentimento:fim", "consent_flow", "cadeia:fim")).toEqual([
            "2s fb:init",
            "2s fb:tracking=true",
            "2s atribuicao:fase2 att=granted",
            "4s consentimento:fim",
            "4s consent_flow not_required|granted|granted 1/1",
            "4s cadeia:fim",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test('["att", "push", "ump"], iPhone na Europa: consulta no começo; ATT, notificação e o formulário; initialize depois da resposta', async () => {
        state.region = "EU";
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], ump: [3000, "aceita"]};
        await open(ELEICAO);
        await advance(9000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "2s att:responde=granted",
            "2s push:aparece",
            "4s push:responde=granted",
            "4s ump:aparece",
            "7s ump:responde=aceita",
        ]);
        expect(only("ump:", "anuncios:")).toEqual([
            "0s ump:consulta",
            "4s ump:formulario",
            "4s ump:aparece",
            "7s ump:responde=aceita",
            "7s anuncios:initialize",
        ]);
        expect(only("consentimento:fim", "consent_flow", "cadeia:fim")).toEqual([
            "7s consentimento:fim",
            "7s consent_flow obtained|granted|granted 1/1",
            "7s cadeia:fim",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test('["att", "push", "ump"], Android na Europa: a notificação, depois o formulário', async () => {
        state.os = "android";
        state.region = "EU";
        autoAnswer = {push: [2000, "granted"], ump: [3000, "aceita"]};
        await open(ELEICAO);
        await advance(7000);
        expect(dialogs()).toEqual(["0s push:aparece", "2s push:responde=granted", "2s ump:aparece", "5s ump:responde=aceita"]);
        expect(only("anuncios:")).toEqual(["5s anuncios:initialize"]);
        expect(mostOnScreen).toBe(1);
    });

    test("ordem inválida ou incompleta: o que não vale é ignorado e o que falta entra depois, na ordem padrão", async () => {
        const run = async (dialogOrder: any) => {
            reset();
            state.region = "EU";
            autoAnswer = {ump: [1000, "aceita"], att: [1000, "granted"], push: [1000, "granted"]};
            await open({dialogOrder});
            await advance(5000);
            return shown();
        };
        expect(await run(["push", "x", "push", "att"])).toEqual(["push", "att", "ump"]);
        expect(await run(["att"])).toEqual(["att", "ump", "push"]);
        expect(await run(["ump", "ump", 3, null])).toEqual(["ump", "att", "push"]);
        // Repetido não vira passo a mais: o ATT da cadeia (e o FB e a atribuição depois dele) uma vez só.
        expect(await run(["att", "att", "push"])).toEqual(["att", "push", "ump"]);
        expect(only("fb:init")).toHaveLength(1);
        for (const invalid of [[], "att", null, undefined, {att: 1}]) expect(await run(invalid)).toEqual(["ump", "att", "push"]);
    });

    test("*DialogOnOpen false continua tirando o diálogo da abertura, em qualquer ordem", async () => {
        // ATT fora da abertura: notificação e formulário; o requestAttPermission do app pede depois.
        state.region = "EU";
        autoAnswer = {ump: [1000, "aceita"], att: [1000, "granted"], push: [1000, "granted"]};
        const m = await open({...ELEICAO, attDialogOnOpen: false});
        await advance(3000);
        expect(shown()).toEqual(["push", "ump"]);
        expect(only("consent_flow")).toEqual(["2s consent_flow obtained|not_asked|granted 0/1"]);
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        await advance(2000);
        expect(shown()).toEqual(["push", "ump", "att"]);
        expect(only("app:att")).toEqual(["4s app:att=granted"]);

        // UMP fora da abertura: nem a consulta sai.
        reset();
        state.region = "EU";
        autoAnswer = {ump: [1000, "aceita"], att: [1000, "granted"], push: [1000, "granted"]};
        await open({dialogOrder: ["push", "att", "ump"], umpDialogOnOpen: false});
        await advance(3000);
        expect(shown()).toEqual(["push", "att"]);
        expect(only("ump:", "premium")).toEqual([]);

        // Notificação fora da abertura.
        reset();
        state.region = "EU";
        autoAnswer = {ump: [1000, "aceita"], att: [1000, "granted"], push: [1000, "granted"]};
        await open({dialogOrder: ["att", "ump", "push"], pushDialogOnOpen: false});
        await advance(3000);
        expect(shown()).toEqual(["att", "ump"]);
        expect(only("push:")).toEqual([]);
    });

    test("notificação antes do ATT: o ATT só pede depois do fim dela, também o requestAttPermission do app", async () => {
        autoAnswer = {push: [3000, "granted"], att: [1000, "denied"]};
        const m = await open({dialogOrder: ["push", "att", "ump"]});
        await advance(1000);
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        await advance(5000);
        expect(dialogs()).toEqual(["0s push:aparece", "3s push:responde=granted", "3s att:aparece", "4s att:responde=denied"]);
        expect(only("app:att")).toEqual(["4s app:att=denied"]);
        // O anúncio de abertura fica de fora enquanto a notificação, antes do ATT, está na tela.
        expect(only("attPendente")).toEqual(["0s attPendente=true", "4s attPendente=false"]);
        expect(mostOnScreen).toBe(1);
    });

    test("notificação antes do ATT, na tela 25 s (iOS 27): a cadeia segue aos 20 s sem esperar mais 20 s pelo ATT, que pede depois", async () => {
        autoAnswer = {push: [25000, "granted"], att: [1000, "granted"]};
        await open({dialogOrder: ["push", "att", "ump"]});
        await advance(30000);
        expect(dialogs()).toEqual(["0s push:aparece", "25s push:responde=granted", "25s att:aparece", "26s att:responde=granted"]);
        // Como a notificação com o ATT pendente na ordem padrão: o consent_flow sai no limite e de novo com cada resposta.
        expect(only("consent_flow", "cadeia:fim")).toEqual([
            "20s consent_flow not_required|undetermined|timeout 0/1",
            "20s cadeia:fim",
            "25s consent_flow not_required|undetermined|granted 0/1",
            "26s consent_flow not_required|granted|granted 1/1",
        ]);
    });

    test("notificação antes do ATT e o requestAttPermission do app junto com a abertura: a cadeia espera a notificação normalmente", async () => {
        autoAnswer = {push: [2000, "granted"], att: [1000, "granted"]};
        await open(
            {dialogOrder: ["push", "att", "ump"]},
            {beforeReady: (m) => void m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`))},
        );
        await advance(5000);
        expect(dialogs()).toEqual(["0s push:aparece", "2s push:responde=granted", "2s att:aparece", "3s att:responde=granted"]);
        // O ATT do app em andamento não vira "push=timeout": a notificação vem antes dele na ordem.
        expect(only("consent_flow", "app:att")).toEqual(["3s app:att=granted", "3s consent_flow not_required|granted|granted 1/1"]);
    });

    test("notificação antes do ATT, na tela mais de 60 s (iOS 27): quando a trava solta, o ATT continua esperando a resposta dela", async () => {
        autoAnswer = {push: [70000, "granted"], att: [1000, "granted"]};
        await open({dialogOrder: ["push", "att", "ump"]});
        await advance(75000, 1000);
        expect(dialogs()).toEqual(["0s push:aparece", "70s push:responde=granted", "70s att:aparece", "71s att:responde=granted"]);
        expect(mostOnScreen).toBe(1);
    });

    test("notificação antes do ATT, na tela 70 s, e o requestAttPermission do app no 1º segundo: o ATT só depois da resposta dela", async () => {
        autoAnswer = {push: [70000, "granted"], att: [1000, "granted"]};
        const m = await open({dialogOrder: ["push", "att", "ump"]});
        await advance(1000, 1000);
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        await advance(75000, 1000);
        expect(dialogs()).toEqual(["0s push:aparece", "70s push:responde=granted", "70s att:aparece", "71s att:responde=granted"]);
        expect(only("app:att")).toEqual(["71s app:att=granted"]);
        expect(mostOnScreen).toBe(1);
    });

    test("notificação antes do ATT e a resposta dela que não volta ao app (iOS 27): o ATT sai mesmo assim, com limite", async () => {
        state.pushHang = true;
        autoAnswer = {push: [2000, "granted"], att: [1000, "granted"]};
        const m = await open({dialogOrder: ["push", "att", "ump"]});
        let appAtt = "sem resposta";
        await advance(3000, 1000);
        m.default.requestAttPermission().then((status: string) => (appAtt = status));
        await advance(200000, 1000);
        // 60 s da trava com a notificação (resposta presa) e mais 60 s esperando a resposta dela, só com o app ativo.
        expect(dialogs()).toEqual(["0s push:aparece", "2s push:responde=granted", "120s att:aparece", "121s att:responde=granted"]);
        expect(appAtt).toBe("granted");
        // O anúncio de abertura não fica de fora a sessão inteira.
        expect(m.isAttPending()).toBe(false);
    });

    test("chamada direta da cadeia com a ordem no parâmetro (sem a opção no prepare): os portões seguem a ordem dela", async () => {
        autoAnswer = {push: [70000, "granted"], att: [1000, "granted"]};
        const m = await load();
        m.default.requestTrackingWhenActive(appConfig, appStrings, true, {order: ["push", "att", "ump"]});
        await advance(75000, 1000);
        expect(dialogs()).toEqual(["0s push:aparece", "70s push:responde=granted", "70s att:aparece", "71s att:responde=granted"]);
        expect(mostOnScreen).toBe(1);
    });

    test("requestAttPermission do app antes da abertura, com a notificação antes do ATT na ordem: o ATT do app sai primeiro e a cadeia espera a notificação normalmente", async () => {
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"]};
        const m = await open({dialogOrder: ["push", "att", "ump"]}, {ready: false});
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        await advance(1000);
        m.default.handleReady();
        await advance(6000);
        expect(dialogs()).toEqual(["0s att:aparece", "2s att:responde=granted", "2s push:aparece", "4s push:responde=granted"]);
        expect(only("consent_flow", "app:att")).toEqual(["2s app:att=granted", "4s consent_flow not_required|granted|granted 1/1"]);
    });

    test("formulário depois do ATT e da notificação: antes da vez dele nada espera por ele; na vez dele, as funções do app esperam", async () => {
        state.region = "EU";
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"]};
        const m = await open(ELEICAO);
        await advance(1000);
        // ATT na tela: o requestPushPermission do app espera o ATT, não o formulário (que só vem depois da notificação).
        m.default.requestPushPermission().then((status: string) => log(`app:push=${status}`));
        await advance(4000);
        expect(only("app:push", ":aparece")).toEqual(["0s att:aparece", "2s push:aparece", "4s app:push=granted", "4s ump:aparece"]);
        // Formulário na tela: o requestAttPermission do app espera ele fechar.
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        await advance(3000);
        expect(only("app:att")).toEqual([]);
        await answer("ump", "aceita");
        expect(only("app:att")).toEqual(["8s app:att=granted"]);
        expect(mostOnScreen).toBe(1);
    });

    test("UMP depois de outro diálogo: o formulário entra na trava, um diálogo por vez (também atrás da localização do app)", async () => {
        state.region = "EU";
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], location: [2000, "granted"], ump: [2000, "aceita"]};
        const m = await open(ELEICAO);
        await advance(3000);
        askLocation(m); // chega com a notificação na tela: entra na trava atrás dela
        await advance(8000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "2s att:responde=granted",
            "2s push:aparece",
            "4s push:responde=granted",
            "4s location:aparece",
            "6s location:responde=granted",
            "6s ump:aparece",
            "8s ump:responde=aceita",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("UMP depois de outro diálogo: o diálogo seguinte e a localização do app não esperam o initialize do SDK", async () => {
        state.region = "EU";
        state.initMs = 5000;
        autoAnswer = {att: [1000, "granted"], ump: [1000, "aceita"], push: [1000, "granted"], location: [1000, "granted"]};
        await open({dialogOrder: ["att", "ump", "push"], appDialogsAfterOpen: true}, {beforeReady: (m) => askLocation(m)});
        await advance(10000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "1s att:responde=granted",
            "1s ump:aparece",
            "2s ump:responde=aceita",
            "2s push:aparece",
            "3s push:responde=granted",
            "3s location:aparece",
            "4s location:responde=granted",
        ]);
        expect(only("anuncios:")).toEqual(["2s anuncios:initialize"]);
    });

    test("formulário na vez dele, aberto mais de 20 s: a cadeia segue no limite e a resposta vale quando chegar", async () => {
        state.region = "EU";
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], ump: [25000, "aceita"]};
        await open(ELEICAO);
        await advance(30000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "1s att:responde=granted",
            "1s push:aparece",
            "2s push:responde=granted",
            "2s ump:aparece",
            "27s ump:responde=aceita",
        ]);
        // O limite de 20 s conta da vez do formulário (2 s), não do começo da abertura.
        expect(only("anuncios:", "consent_flow", "cadeia:fim")).toEqual([
            "22s anuncios:initialize",
            "22s consent_flow timeout|granted|granted 1/1",
            "22s cadeia:fim",
        ]);
    });

    test("formulário na vez dele: segura a trava até a resposta, além do limite dos alertas (20 s no Android, 60 s no iOS)", async () => {
        // O pedido do app feito com o formulário aberto espera ele fechar.
        state.os = "android";
        state.region = "EU";
        autoAnswer = {push: [2000, "granted"], ump: [40000, "aceita"], location: [2000, "granted"]};
        const m = await open(ELEICAO);
        await advance(5000, 1000);
        askLocation(m);
        await advance(45000, 1000);
        expect(dialogs()).toEqual([
            "0s push:aparece",
            "2s push:responde=granted",
            "2s ump:aparece",
            "42s ump:responde=aceita",
            "42s location:aparece",
            "44s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);

        // O diálogo da lib que vem depois dele na ordem também (a cadeia segue no limite de 20 s, como sempre).
        reset();
        state.os = "android";
        state.region = "EU";
        autoAnswer = {push: [2000, "granted"], ump: [40000, "aceita"]};
        await open({dialogOrder: ["att", "ump", "push"]});
        await advance(50000, 1000);
        expect(dialogs()).toEqual(["0s ump:aparece", "40s ump:responde=aceita", "40s push:aparece", "42s push:responde=granted"]);
        expect(only("cadeia:fim")).toEqual(["40s cadeia:fim"]);
        expect(mostOnScreen).toBe(1);
    });

    test("formulário na vez dele: o anúncio de abertura fica de fora até a resposta (isAttPending), no iPhone e no Android", async () => {
        state.region = "EU";
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], ump: [4000, "aceita"]};
        let m = await open(ELEICAO);
        await advance(9000);
        expect(only("attPendente", "ump:aparece", "ump:responde")).toEqual([
            "0s attPendente=true",
            "2s attPendente=false",
            "4s ump:aparece",
            "4s attPendente=true",
            "8s ump:responde=aceita",
            "8s attPendente=false",
        ]);

        reset();
        state.os = "android";
        state.region = "EU";
        autoAnswer = {push: [2000, "granted"], ump: [4000, "aceita"]};
        m = await open(ELEICAO);
        await advance(3000);
        expect(onScreen).toEqual(["ump"]);
        expect(m.isAttPending()).toBe(true);
        await advance(4000);
        expect(m.isAttPending()).toBe(false);
    });

    // O fim do consentimento (whenConsentFlowDone/waitAttFlowDone) segura a pré-carga do 1º intersticial, a do app open e o
    // promo: na ordem padrão ele sempre veio depois do initialize do SDK (a cadeia espera o setupMobileAds na posição do UMP).
    test("abertura seguinte (ATT e notificação já respondidos), initialize de 4 s: o consentimento termina aos 4 s nas duas ordens, no iPhone e no Android", async () => {
        const results: string[] = [];
        for (const os of ["ios", "android"] as const) {
            for (const options of [undefined, ELEICAO]) {
                reset();
                state.os = os;
                state.initMs = 4000;
                state.att = "granted";
                state.push = 1;
                state.androidPush = true;
                await open(options);
                await advance(6000);
                results.push(`${os} ${options ? "nova" : "padrão"}: consentimento ${times("consentimento:fim")}, cadeia ${times("cadeia:fim")}`);
            }
        }
        // Na ordem nova a cadeia não espera o initialize (acaba aos 0 s); só o fim do consentimento espera.
        expect(results).toEqual([
            "ios padrão: consentimento 4s, cadeia 4s",
            "ios nova: consentimento 4s, cadeia 0s",
            "android padrão: consentimento 4s, cadeia 4s",
            "android nova: consentimento 4s, cadeia 0s",
        ]);
    });

    test("1ª abertura na ordem nova, ATT e notificação respondidos em 1 s cada e initialize de 6 s: o consentimento termina aos 6 s", async () => {
        state.initMs = 6000;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"]};
        await open(ELEICAO);
        await advance(8000);
        expect(dialogs()).toEqual(["0s att:aparece", "1s att:responde=granted", "1s push:aparece", "2s push:responde=granted"]);
        expect([times("anuncios:initialize"), times("cadeia:fim"), times("consentimento:fim")]).toEqual([["0s"], ["2s"], ["6s"]]);

        reset();
        state.os = "android";
        state.initMs = 6000;
        autoAnswer = {push: [1000, "granted"]};
        await open(ELEICAO);
        await advance(8000);
        expect(dialogs()).toEqual(["0s push:aparece", "1s push:responde=granted"]);
        expect([times("anuncios:initialize"), times("cadeia:fim"), times("consentimento:fim")]).toEqual([["0s"], ["1s"], ["6s"]]);
    });

    test("ordem nova na Europa: o consentimento termina depois da resposta do formulário e do initialize", async () => {
        state.region = "EU";
        state.initMs = 3000;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], ump: [2000, "aceita"]};
        await open(ELEICAO);
        await advance(12000);
        expect(only("ump:responde", "anuncios:")).toEqual(["4s ump:responde=aceita", "4s anuncios:initialize"]);
        expect([times("cadeia:fim"), times("consentimento:fim")]).toEqual([["4s"], ["7s"]]);
    });

    test("ordem nova: a cadeia, o diálogo seguinte, a localização e o ads_wait_consent_enabled não esperam o initialize", async () => {
        state.initMs = 5000;
        state.rcUtils = {ads_wait_consent_enabled: true};
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(7000);
        expect(only(":aparece")).toEqual(["0s att:aparece", "1s push:aparece", "2s location:aparece"]);
        expect([times("anuncio:liberado"), times("cadeia:fim"), times("consentimento:fim")]).toEqual([["1s"], ["2s"], ["5s"]]);
    });

    test("ordem nova com o resetAdsConsent (QA) no meio da abertura: o consentimento continua esperando o initialize do setup da cadeia", async () => {
        state.initMs = 4000;
        autoAnswer = {att: [2000, "granted"], push: [1000, "granted"]};
        const m = await open(ELEICAO);
        await advance(1000);
        m.default.resetAdsConsent();
        await advance(5000);
        expect(only("ump:reset", "anuncios:", "cadeia:fim", "consentimento:fim")).toEqual([
            "0s anuncios:initialize",
            "1s ump:reset",
            "3s cadeia:fim",
            "4s consentimento:fim",
        ]);
    });

    test("ordem nova com o requestUmpConsent do app antes do handleReady: o consentimento também espera o initialize desse UMP", async () => {
        state.initMs = 3000;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"]};
        await open(ELEICAO, {beforeReady: (m) => void m.default.requestUmpConsent()});
        await advance(5000);
        expect(only("anuncios:", "cadeia:fim", "consentimento:fim")).toEqual(["0s anuncios:initialize", "2s cadeia:fim", "3s consentimento:fim"]);
    });

    test("umpDialogOnOpen false fica como está: o consentimento termina com o ATT, sem UMP nem initialize", async () => {
        state.initMs = 4000;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"]};
        await open({...ELEICAO, umpDialogOnOpen: false});
        await advance(6000);
        expect(only("anuncios:", "ump:")).toEqual([]);
        expect([times("cadeia:fim"), times("consentimento:fim")]).toEqual([["2s"], ["2s"]]);
    });

    test("premium e anúncio desligado na ordem nova: o consentimento termina com o ATT e a notificação, sem esperar nada do SDK", async () => {
        for (const setup of [() => (state.premium = true), () => (state.rcUtils = {is_ads_enabled: false})]) {
            reset();
            setup();
            state.initMs = 4000;
            autoAnswer = {att: [1000, "granted"], push: [1000, "granted"]};
            await open(ELEICAO);
            await advance(5000);
            expect(only("anuncios:")).toEqual([]);
            expect([times("cadeia:fim"), times("consentimento:fim")]).toEqual([["2s"], ["2s"]]);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 3. appDialogsAfterOpen
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ELEICAO_APP = {...ELEICAO, appDialogsAfterOpen: true};

describe("appDialogsAfterOpen", () => {
    test("Eleições no iPhone (Brasil): localização pedida ao montar a Início, antes do handleReady → ATT, notificação e só então a localização", async () => {
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(8000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "2s att:responde=granted",
            "2s push:aparece",
            "4s push:responde=granted",
            "4s location:aparece",
            "6s location:responde=granted",
        ]);
        expect(only("app:localizacao")).toEqual(["6s app:localizacao=granted"]);
        expect(mostOnScreen).toBe(1);
    });

    test("Eleições no Android (Brasil): notificação → localização", async () => {
        state.os = "android";
        autoAnswer = {push: [2000, "granted"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(6000);
        expect(dialogs()).toEqual(["0s push:aparece", "2s push:responde=granted", "2s location:aparece", "4s location:responde=granted"]);
    });

    test("Europa: ATT, notificação, formulário e só então a localização", async () => {
        state.region = "EU";
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], ump: [1000, "aceita"], location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(6000);
        expect(shown()).toEqual(["att", "push", "ump", "location"]);
        expect(mostOnScreen).toBe(1);
    });

    test("pedido durante a cadeia: espera o fim dela; pedido depois do fim: na hora", async () => {
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], location: [1000, "granted"]};
        const m = await open(ELEICAO_APP);
        await advance(1000);
        askLocation(m); // com o ATT na tela
        await advance(6000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "2s att:responde=granted",
            "2s push:aparece",
            "4s push:responde=granted",
            "4s location:aparece",
            "5s location:responde=granted",
        ]);
        askLocation(m); // a cadeia já acabou
        await flush();
        expect(only("location:aparece").at(-1)).toBe("7s location:aparece");
    });

    test("ordem padrão com appDialogsAfterOpen: UMP, ATT, notificação e depois a localização", async () => {
        state.region = "EU";
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], ump: [1000, "aceita"], location: [1000, "granted"]};
        await open({appDialogsAfterOpen: true}, {beforeReady: (m) => askLocation(m)});
        await advance(6000);
        expect(shown()).toEqual(["ump", "att", "push", "location"]);
        expect(mostOnScreen).toBe(1);
    });

    test("sem handleReady: a localização sai no aviso de 30 s (nunca fica presa)", async () => {
        autoAnswer = {location: [1000, "granted"]};
        await open(ELEICAO_APP, {ready: false, beforeReady: (m) => askLocation(m)});
        await advance(29000, 1000);
        expect(dialogs()).toEqual([]);
        await advance(2000, 1000);
        expect(dialogs()).toEqual(["30s location:aparece", "31s location:responde=granted"]);
    });

    test("(a) ATT respondido depois do limite da cadeia (iOS 27, 25 s): a cadeia segue aos 20 s, mas a localização só sai depois do ATT e da notificação", async () => {
        autoAnswer = {att: [25000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(20000);
        expect(only("cadeia:fim")).toEqual(["20s cadeia:fim"]);
        await advance(12000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "25s att:responde=granted",
            "25s push:aparece",
            "27s push:responde=granted",
            "27s location:aparece",
            "29s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("(a) localização pedida aos 25 s, depois do fim da cadeia, com o ATT ainda na tela: também espera o ATT e a notificação", async () => {
        autoAnswer = {att: [30000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        const m = await open(ELEICAO_APP);
        await advance(25000);
        expect(only("cadeia:fim")).toEqual(["20s cadeia:fim"]);
        askLocation(m);
        await advance(10000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "30s att:responde=granted",
            "30s push:aparece",
            "32s push:responde=granted",
            "32s location:aparece",
            "34s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("(b) iOS 27, ATT na tela 70 s: quando a trava solta (60 s), a localização não sai por cima dele", async () => {
        autoAnswer = {att: [70000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(80000, 1000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "70s att:responde=granted",
            "70s push:aparece",
            "72s push:responde=granted",
            "72s location:aparece",
            "74s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("(b) iOS 27, notificação na tela 70 s: quando a trava solta (60 s), a localização espera a resposta dela", async () => {
        autoAnswer = {att: [2000, "granted"], push: [70000, "granted"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(80000, 1000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "2s att:responde=granted",
            "2s push:aparece",
            "72s push:responde=granted",
            "72s location:aparece",
            "74s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("(b) ordem padrão com appDialogsAfterOpen, iOS 27, ATT na tela 70 s: a localização também espera", async () => {
        autoAnswer = {att: [70000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        await open({appDialogsAfterOpen: true}, {beforeReady: (m) => askLocation(m)});
        await advance(80000, 1000);
        expect(shown()).toEqual(["att", "push", "location"]);
        expect(only("location:aparece")).toEqual(["72s location:aparece"]);
        expect(mostOnScreen).toBe(1);
    });

    test("(c) ATT descartado pelo iOS sem evento de active: a localização espera a nova tentativa (ATT e notificação antes dela)", async () => {
        state.attDiscard = 1;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(40000, 1000);
        // A cadeia segue no limite dela; o ATT espera o próximo "ficou ativo" e a notificação espera o ATT.
        expect(only("att:descartado", "cadeia:fim")).toEqual(["0s att:descartado", "20s cadeia:fim"]);
        expect(dialogs()).toEqual([]);
        // A pessoa sai do app e volta: o ATT sai de novo, depois a notificação e só então a localização.
        await setAppState("background");
        await setAppState("active");
        await advance(4000, 1000);
        expect(dialogs()).toEqual([
            "40s att:aparece",
            "41s att:responde=granted",
            "41s push:aparece",
            "42s push:responde=granted",
            "42s location:aparece",
            "43s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("(c) sem evento de active nenhum: a localização sai no limite de segurança de 3 min com o app ativo (nunca fica presa)", async () => {
        state.attDiscard = 1;
        autoAnswer = {location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(199000, 1000);
        expect(only("location:")).toEqual([]);
        await advance(3000, 1000);
        // 3 min contados do fim da cadeia (20 s).
        expect(only("location:")).toEqual(["200s location:aparece", "201s location:responde=granted"]);
    });

    test("limite de segurança só com o app ativo: iOS 26, ATT na tela 5 min (o app fica inactive) → a localização espera a resposta", async () => {
        state.alerts = "ios26";
        autoAnswer = {att: [300000, "granted"], push: [2000, "granted"], location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(305000, 1000);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "300s att:responde=granted",
            "300s push:aparece",
            "302s push:responde=granted",
            "302s location:aparece",
            "303s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("o que sobra: iOS 27, ATT deixado na tela além do limite de segurança → a localização sai aos 3 min do fim da cadeia, por cima dele", async () => {
        autoAnswer = {att: [300000, "granted"], push: [2000, "granted"], location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(199000, 1000);
        expect(only("location:")).toEqual([]);
        await advance(2000, 1000);
        expect(only("location:aparece")).toEqual(["200s location:aparece"]);
        expect(onScreen).toEqual(["att"]);
    });

    test("armadilha: Android com a notificação negada para sempre (o pedido volta never_ask_again na hora, sem diálogo) → localização na hora", async () => {
        state.os = "android";
        state.androidPushBlocked = true;
        autoAnswer = {location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(2000);
        // O portão da notificação fica esperando o próximo "ficou ativo" (pedido perdido), mas não segura a localização. Ela
        // pausa a Activity, e a volta dela é esse "ficou ativo": a 2ª tentativa volta never_ask_again na hora, de novo sem nada.
        expect(only("location:")).toEqual(["0s location:aparece", "1s location:responde=granted"]);
        expect(only("push:", "consent_flow", "cadeia:fim")).toEqual([
            "0s push:le",
            "0s push:pede",
            "0s consent_flow not_required|na|never_ask_again 0/1",
            "0s cadeia:fim",
            "1s push:le",
            "1s push:pede",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("iOS: notificação que volta perdida na hora, sem diálogo (não determinada) → localização na hora, sem esperar a nova tentativa", async () => {
        state.pushLost = true;
        autoAnswer = {att: [1000, "granted"], location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(3000);
        expect([times("push:pede"), times("cadeia:fim")]).toEqual([["1s"], ["1s"]]);
        expect(only("location:")).toEqual(["1s location:aparece", "2s location:responde=granted"]);
    });

    test("Android: pedido de notificação com a promessa pendurada (sem diálogo, o app segue active) → a localização sai no limite da trava (20 s), sem espera a mais", async () => {
        state.os = "android";
        state.androidPushHang = true;
        autoAnswer = {location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(19000, 1000);
        expect(only("location:")).toEqual([]);
        await advance(2000, 1000);
        expect([times("cadeia:fim"), times("location:aparece")]).toEqual([["20s"], ["20s"]]);
    });

    test("ATT da abertura sem a notificação depois dele (pushDialogOnOpen false, ou a notificação antes do ATT): a localização também espera o ATT na tela além de 60 s", async () => {
        autoAnswer = {att: [70000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        await open({...ELEICAO_APP, pushDialogOnOpen: false}, {beforeReady: (m) => askLocation(m)});
        await advance(75000, 1000);
        expect(dialogs()).toEqual(["0s att:aparece", "70s att:responde=granted", "70s location:aparece", "72s location:responde=granted"]);

        reset();
        autoAnswer = {att: [70000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        await open({dialogOrder: ["push", "att", "ump"], appDialogsAfterOpen: true}, {beforeReady: (m) => askLocation(m)});
        await advance(80000, 1000);
        expect(dialogs()).toEqual([
            "0s push:aparece",
            "2s push:responde=granted",
            "2s att:aparece",
            "72s att:responde=granted",
            "72s location:aparece",
            "74s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("2ª abertura com tudo respondido: localização na hora, no iPhone e no Android", async () => {
        for (const os of ["ios", "android"] as const) {
            reset();
            state.os = os;
            state.att = "denied";
            state.push = 0;
            state.androidPush = true;
            autoAnswer = {location: [1000, "granted"]};
            await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
            await advance(2000);
            expect(only("location:")).toEqual(["0s location:aparece", "1s location:responde=granted"]);
        }
    });

    test("premium e anúncio desligado: nada a mais segura a localização (1ª abertura: depois do ATT e da notificação; 2ª: na hora)", async () => {
        for (const setup of [() => (state.premium = true), () => (state.rcUtils = {is_ads_enabled: false})]) {
            reset();
            setup();
            autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], location: [1000, "granted"]};
            await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
            await advance(4000);
            expect(dialogs()).toEqual([
                "0s att:aparece",
                "1s att:responde=granted",
                "1s push:aparece",
                "2s push:responde=granted",
                "2s location:aparece",
                "3s location:responde=granted",
            ]);
            expect(only("ump:", "anuncios:")).toEqual([]);

            reset();
            setup();
            state.att = "granted";
            state.push = 1;
            autoAnswer = {location: [1000, "granted"]};
            await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
            await advance(2000);
            expect(only("location:")).toEqual(["0s location:aparece", "1s location:responde=granted"]);
            expect(times("consentimento:fim")).toEqual(["0s"]);
        }
    });

    test("diálogo fora da abertura não segura nada: ATT do app (attDialogOnOpen false) descartado, e sem a notificação na abertura", async () => {
        // ATT pedido pelo app e descartado pelo iOS (espera o próximo active): não é da abertura, a localização não espera por ele.
        state.attDiscard = 1;
        autoAnswer = {push: [1000, "granted"], location: [1000, "granted"]};
        const m = await open({...ELEICAO_APP, attDialogOnOpen: false});
        await advance(2000);
        m.default.requestAttPermission();
        await advance(1000);
        askLocation(m);
        await advance(2000);
        expect(only("att:descartado", ":aparece")).toEqual(["0s push:aparece", "2s att:descartado", "3s location:aparece"]);

        // pushDialogOnOpen false: a localização sai logo depois do ATT.
        reset();
        autoAnswer = {att: [1000, "granted"], location: [1000, "granted"]};
        await open({...ELEICAO_APP, pushDialogOnOpen: false}, {beforeReady: (mm) => askLocation(mm)});
        await advance(3000);
        expect(dialogs()).toEqual(["0s att:aparece", "1s att:responde=granted", "1s location:aparece", "2s location:responde=granted"]);
    });

    test("iOS 27, resposta da notificação que não volta: a localização espera no máximo mais um limite da trava (60 s) depois do dela", async () => {
        state.pushHang = true;
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(121000, 1000);
        expect(only("location:")).toEqual([]);
        await advance(4000, 1000);
        // Pedido aos 2 s: 60 s da trava (62 s) e mais 60 s esperando a resposta, só com o app ativo (como o ATT da af6172a).
        expect(only("location:")).toEqual(["122s location:aparece", "124s location:responde=granted"]);
    });

    test("pedidos da lib não esperam: requestAttPermission e requestPushPermission do app com o ATT da abertura na tela além do limite", async () => {
        autoAnswer = {att: [25000, "granted"], push: [2000, "granted"], location: [2000, "granted"]};
        const m = await open(ELEICAO_APP, {beforeReady: (mm) => askLocation(mm)});
        await advance(21000, 1000);
        m.default.requestAttPermission().then((status: string) => log(`app:att=${status}`));
        m.default.requestPushPermission().then((status: string) => log(`app:push=${status}`));
        await advance(10000, 1000);
        // O ATT do app é o mesmo da abertura; a notificação do app espera o ATT e entra na trava junto com a da cadeia (a 2ª
        // volta na hora, já respondida). Nenhum dos dois espera a localização nem o limite de 3 min.
        expect([times("app:att="), times("app:push="), times("app:localizacao=")]).toEqual([["25s"], ["27s"], ["29s"]]);
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "25s att:responde=granted",
            "25s push:aparece",
            "27s push:responde=granted",
            "27s location:aparece",
            "29s location:responde=granted",
        ]);
        expect(mostOnScreen).toBe(1);
    });

    test("formulário aberto além do limite da cadeia: a localização espera a resposta dele (Android 40 s, iOS 27 90 s)", async () => {
        state.os = "android";
        state.region = "EU";
        autoAnswer = {push: [2000, "granted"], ump: [40000, "aceita"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(50000, 1000);
        expect(dialogs()).toEqual([
            "0s push:aparece",
            "2s push:responde=granted",
            "2s ump:aparece",
            "42s ump:responde=aceita",
            "42s location:aparece",
            "44s location:responde=granted",
        ]);
        expect(only("cadeia:fim")).toEqual(["22s cadeia:fim"]);
        expect(mostOnScreen).toBe(1);

        reset();
        state.region = "EU";
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], ump: [90000, "aceita"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(100000, 1000);
        expect(only("location:aparece", "ump:aparece", "ump:responde")).toEqual(["2s ump:aparece", "92s ump:responde=aceita", "92s location:aparece"]);
        expect(mostOnScreen).toBe(1);
    });

    test("formulário que nunca responde: a localização sai no limite de segurança de 3 min da trava", async () => {
        state.os = "android";
        state.region = "EU";
        autoAnswer = {push: [2000, "granted"], location: [2000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(181000, 1000);
        expect(only("location:")).toEqual([]);
        await advance(3000, 1000);
        expect(only("location:")).toEqual(["182s location:aparece", "184s location:responde=granted"]);
    });

    test("cadeia parada (premium sem resposta): a localização sai em 3 min mesmo assim", async () => {
        state.premiumHang = true;
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], location: [1000, "granted"]};
        await open(ELEICAO_APP, {beforeReady: (m) => askLocation(m)});
        await advance(179000, 1000);
        expect(shown()).toEqual(["att", "push"]);
        await advance(2000, 1000);
        expect(only("location:")).toEqual(["180s location:aparece", "181s location:responde=granted"]);
    });

    test("não vale para os pedidos da lib: o requestPushPermission do app (pushDialogOnOpen false) não espera a cadeia", async () => {
        state.region = "EU";
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], ump: [2000, "aceita"]};
        const m = await open({...ELEICAO_APP, pushDialogOnOpen: false});
        await advance(500);
        m.default.requestPushPermission().then((status: string) => log(`app:push=${status}`));
        await advance(8000);
        // Espera só o ATT (como sempre); o formulário, na vez dele, espera a notificação na trava.
        expect(dialogs()).toEqual([
            "0s att:aparece",
            "2s att:responde=granted",
            "2s push:aparece",
            "4s push:responde=granted",
            "4s ump:aparece",
            "6s ump:responde=aceita",
        ]);
        expect(only("app:push")).toEqual(["4s app:push=granted"]);
    });

    test("padrão false: quem pede primeiro vai primeiro, como hoje (a localização da 1ª tela sai antes do ATT)", async () => {
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], location: [1000, "granted"]};
        await open(ELEICAO, {beforeReady: (m) => askLocation(m)});
        await advance(4000);
        expect(shown()).toEqual(["location", "att", "push"]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 4. ads_wait_consent_enabled com a ordem nova
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("ads_wait_consent_enabled com a ordem nova", () => {
    test("iPhone, Brasil: anúncio liberado logo depois da resposta do ATT (o UMP respondeu no começo)", async () => {
        state.rcUtils = {ads_wait_consent_enabled: true};
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"]};
        await open(ELEICAO);
        await advance(6000);
        expect(only("anuncio:", ":responde")).toEqual(["2s att:responde=granted", "2s anuncio:liberado", "4s push:responde=granted"]);
    });

    test("iPhone, Europa: anúncio liberado na resposta do formulário (depois do ATT e da notificação)", async () => {
        state.region = "EU";
        state.rcUtils = {ads_wait_consent_enabled: true};
        autoAnswer = {att: [2000, "granted"], push: [2000, "granted"], ump: [2000, "aceita"]};
        await open(ELEICAO);
        await advance(8000);
        expect(only("anuncio:", ":responde")).toEqual([
            "2s att:responde=granted",
            "4s push:responde=granted",
            "6s ump:responde=aceita",
            "6s anuncio:liberado",
        ]);
    });

    test("Europa: formulário recusado → nenhum anúncio na sessão", async () => {
        state.region = "EU";
        state.rcUtils = {ads_wait_consent_enabled: true};
        autoAnswer = {att: [1000, "granted"], push: [1000, "granted"], ump: [1000, "recusa"]};
        await open(ELEICAO);
        await advance(200000, 1000);
        expect(only("anuncio:")).toEqual(["3s anuncio:negado"]);
    });

    test("Android, Brasil: anúncio liberado logo depois da consulta do UMP (não há ATT)", async () => {
        state.os = "android";
        state.rcUtils = {ads_wait_consent_enabled: true};
        autoAnswer = {push: [2000, "granted"]};
        await open(ELEICAO);
        await advance(3000);
        expect(only("anuncio:", "ump:", ":responde")).toEqual([
            "0s ump:consulta",
            "0s ump:formulario",
            "0s anuncio:liberado",
            "2s push:responde=granted",
        ]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 5. Sem trava circular
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Todas as ordens × *DialogOnOpen × appDialogsAfterOpen, com a localização da 1ª tela e, metade das vezes, também as
// funções do app (requestAttPermission, requestPushPermission, requestUmpConsent) pedidas antes do handleReady; cada
// diálogo respondido em 1,5 s. Em 1 min de abertura tudo responde: a cadeia termina, todo pedido do app volta e nada fica
// na tela. Um diálogo por vez onde a lib garante: sem as funções do app no meio (o requestUmpConsent e o requestAttPermission
// pedidos antes do handleReady podem sair junto com o formulário, como hoje) e, com o UMP em 1º na Europa, só com
// appDialogsAfterOpen (sem ela, a localização da 1ª tela sai junto com o formulário, que fica fora da trava, como hoje).
const ORDERS = [
    ["ump", "att", "push"],
    ["ump", "push", "att"],
    ["att", "ump", "push"],
    ["att", "push", "ump"],
    ["push", "ump", "att"],
    ["push", "att", "ump"],
];

const combo = async (os: "ios" | "android", region: "BR" | "EU", order: string[], mask: number, appAfterOpen: boolean, appCalls: boolean) => {
    reset();
    state.os = os;
    state.region = region;
    autoAnswer = {ump: [1500, "aceita"], att: [1500, "granted"], push: [1500, "granted"], location: [1500, "granted"]};
    const onOpen = {ump: (mask & 1) > 0, att: (mask & 2) > 0, push: (mask & 4) > 0};
    const options = {
        dialogOrder: order,
        umpDialogOnOpen: onOpen.ump,
        attDialogOnOpen: onOpen.att,
        pushDialogOnOpen: onOpen.push,
        appDialogsAfterOpen: appAfterOpen,
    };
    const asked: string[] = [];
    const answered: string[] = [];
    const track = (name: string, promise: Promise<unknown>) => {
        asked.push(name);
        promise.then(
            () => answered.push(name),
            () => answered.push(`${name}(rejeitou)`),
        );
    };
    await open(options, {
        beforeReady: (m) => {
            track("localizacao", m.withPermissionPrompt(() => show("location")));
            if (!appCalls) return;
            track("att", m.default.requestAttPermission());
            track("push", m.default.requestPushPermission());
            track("ump", m.default.requestUmpConsent());
        },
    });
    await advance(60000, 1000);
    const label = `${os} ${region} [${order}] ump=${onOpen.ump} att=${onOpen.att} push=${onOpen.push} appDialogsAfterOpen=${appAfterOpen} funções=${appCalls}`;
    const problems: string[] = [];
    if (!only("cadeia:fim").length) problems.push(`${label}: a cadeia não terminou`);
    if ([...answered].sort().join() !== [...asked].sort().join()) problems.push(`${label}: sem resposta: ${asked.filter((name) => !answered.includes(name))}`);
    if (onScreen.length) problems.push(`${label}: ficou na tela: ${onScreen}`);
    const oneAtATime = !appCalls && (appAfterOpen || region === "BR" || !onOpen.ump || order[0] !== "ump");
    if (oneAtATime && mostOnScreen > 1) problems.push(`${label}: dois diálogos juntos: ${dialogs()}`);
    return problems;
};

describe("sem trava circular: ordem × *DialogOnOpen × appDialogsAfterOpen × pedidos do app", () => {
    for (const os of ["ios", "android"] as const) {
        for (const region of ["BR", "EU"] as const) {
            test(`${os}, ${region === "BR" ? "Brasil" : "Europa"}: tudo responde e nada fica preso`, async () => {
                const problems: string[] = [];
                for (const order of ORDERS) {
                    for (let mask = 0; mask < 8; mask++) {
                        for (const appAfterOpen of [false, true]) {
                            for (const appCalls of [false, true]) problems.push(...(await combo(os, region, order, mask, appAfterOpen, appCalls)));
                        }
                    }
                }
                expect(problems).toEqual([]);
            });
        }
    }
});
