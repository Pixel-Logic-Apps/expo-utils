// Telemetria dos warns: cada mensagem única vira 1 evento "expo_utils_warn" no Analytics
// (dedup por sessão + cap de 50 pra nunca inundar; roda MESMO com disableWarnings — o ponto
// é enxergar em produção o que o console não mostra). Best-effort: nunca lança nem recursa
// (o logUtilsEvent engole a própria falha, então não gera outro warn).
const warnEventSent = new Set<string>();
function reportWarnEvent(args: any[]) {
    try {
        const message = args
            .map((a) => {
                if (typeof a === "string") return a;
                if (a instanceof Error) return String(a);
                try { return JSON.stringify(a); } catch { return String(a); }
            })
            .join(" ")
            .slice(0, 100); // limite de valor de parâmetro do Analytics
        if (!message || warnEventSent.has(message) || warnEventSent.size >= 50) return;
        warnEventSent.add(message);
        logUtilsEvent("expo_utils_warn", {message});
    } catch {}
}

// Função para warnings configuráveis do expo-utils
export function expoUtilsWarn(...args: any[]) {
    if (!(global as any).disableExpoUtilsWarnings) {
        // eslint-disable-next-line no-console
        console.warn(...args);
    }
    reportWarnEvent(args);
}

// Função para logs configuráveis do expo-utils
export function expoUtilsLog(...args: any[]) {
    if (!(global as any).disableExpoUtilsLogs) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}

import {AppConfig, AppStrings, RemoteConfigUtilsType} from "./types";
import {getLocalizedMessages} from "./i18n";
import {getLocales} from "expo-localization";
const safeGetLocales = (): Array<{languageCode?: string | null; regionCode?: string | null}> => {
    try {
        return getLocales();
    } catch {
        return [{languageCode: "en"}];
    }
};

// Static imports for runtime dependencies
import {requestTrackingPermissionsAsync, getTrackingPermissionsAsync} from "expo-tracking-transparency";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as SplashScreen from "expo-splash-screen";
import * as Clarity from "@microsoft/react-native-clarity";
import {Settings as FbsdkSettings} from "react-native-fbsdk-next";
import Purchases, {LOG_LEVEL, type CustomerInfo} from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {Alert, AppState, Platform, Linking, LogBox, DevSettings, NativeModules, PermissionsAndroid} from "react-native";
import {registerDevMenuItems} from "expo-dev-menu";
import {initHotUpdater as runHotUpdater, type InitHotUpdaterOptions} from "./hot-updater";
import mobileAds, {AdsConsent, AdsConsentDebugGeography} from "react-native-google-mobile-ads";
import {reportConfigIntegrity} from "./config-integrity";
import {mergeRemoteConfigBlocks, readRemoteConfigBlocks, type RemoteConfigSource} from "./settings";
import {setBlocklist} from "./AdPlacementTracker";
import {PremiumUtils} from "./PremiumUtils";

// Importações modulares do Firebase
import {
    getRemoteConfig,
    fetchAndActivate,
    getValue,
} from "@react-native-firebase/remote-config";
import {getMessaging, requestPermission, onMessage, subscribeToTopic, getToken, setBackgroundMessageHandler, experimentalSetDeliveryMetricsExportedToBigQueryEnabled, registerDeviceForRemoteMessages, isDeviceRegisteredForRemoteMessages, getAPNSToken, onNotificationOpenedApp, getInitialNotification} from "@react-native-firebase/messaging";
import {getApp} from "@react-native-firebase/app";
import TiktokAdsEvents, {TikTokStandardEvents, TikTokWaitForConfig} from "expo-tiktok-ads-events";
import {trackLinkInBioInstall} from "./link-in-bio";
import {logUtilsEvent, setUtilsUserProperty} from "./analytics";
import {initAdRevenue} from "./ad-revenue";
import {refreshAttributionAfterAtt, runAttributionPhase1, runAttributionPhase2, setRcAttributesLate} from "./attribution";
import {createPermissionGate, createPermissionLock, TIMED_OUT, withActiveLimit, withTimeout, type PermissionFlow} from "./permission-gate";
import {createResumeConfig, type ConfigSnapshot} from "./resume-config";
import {addAppLifecycleListener, APP_LIFECYCLE_MODULE, pickAppLifecycleSource} from "./app-lifecycle";
import {logPushOpened, logPushReceived} from "./push-analytics";
import {getRevenueCatStatus as classifyRevenueCatStatus, syncRcStatus, type RcStatus} from "./rc-status";
import {showRetentionPreview} from "./retention-events";

// RNFB v22+ marca a API namespaced como deprecated. No v25 sumiram setConfigSettings/
// setDefaults do modular; a forma web-compatible é atribuir `settings` / `defaultConfig`.
// Chamadas namespaced ainda funcionam se passarem o sentinel modular (mesmo token interno
// do RNFB) — silencia o warn e filtra o arg antes de chegar no SDK nativo.
const RNFB_MODULAR = "react-native-firebase-modular-method-call";

/** Configura settings + defaults do Remote Config sem warn de API namespaced. */
async function applyRemoteConfigDefaults(
    remoteConfig: any,
    defaults: Record<string, string>,
    settings: {minimumFetchIntervalMillis: number},
): Promise<void> {
    // RNFB proxy: qualquer .setDefaults()/.setConfigSettings() namespaced avisa deprecation
    // a menos que o call leve o sentinel modular (filtrado antes do nativo).
    if (typeof remoteConfig?.setConfigSettings === "function") {
        await remoteConfig.setConfigSettings(settings, RNFB_MODULAR);
    } else {
        remoteConfig.settings = settings;
    }
    if (typeof remoteConfig?.setDefaults === "function") {
        await remoteConfig.setDefaults(defaults, RNFB_MODULAR);
    } else {
        remoteConfig.defaultConfig = defaults;
    }
}

function getExpoUtilsDisableWarnings(appConfig?: any): boolean {
    if (!appConfig?.expo?.plugins) return false;
    const plugins = appConfig.expo.plugins;
    for (const plugin of plugins) {
        if (Array.isArray(plugin) && plugin[0] === "expo-utils" && plugin[1]?.disableWarnings === true) {
            return true;
        }
        if (plugin === "expo-utils") {
            // Se for só a string, não desabilita warnings
            continue;
        }
    }
    return false;
}

function getExpoUtilsDisableLogs(appConfig?: any): boolean {
    if (!appConfig?.expo?.plugins) return false;
    const plugins = appConfig.expo.plugins;
    for (const plugin of plugins) {
        if (Array.isArray(plugin) && plugin[0] === "expo-utils" && plugin[1]?.disableLogs === true) {
            return true;
        }
        if (plugin === "expo-utils") {
            // Se for só a string, não desabilita logs
            continue;
        }
    }
    return false;
}

// Ligada por padrão desde a 1.5.4: a checagem automática de versão da loja roda no prepare() de todo app. Só
// ["expo-utils", {"disableAdsIfBuildIsNewerThanStore": false}] desliga (lida em RUNTIME, como disableWarnings/disableLogs).
function getExpoUtilsDisableAdsIfBuildIsNewerThanStore(appConfig?: any): boolean {
    const plugins = appConfig?.expo?.plugins;
    if (!Array.isArray(plugins)) return true;
    for (const plugin of plugins) {
        if (Array.isArray(plugin) && plugin[0] === "expo-utils" && plugin[1]?.disableAdsIfBuildIsNewerThanStore === false) {
            return false;
        }
    }
    return true;
}

// Lê uma opção qualquer do ["expo-utils", {...}] do app.json em RUNTIME (mesma ideia dos
// getters acima, sem precisar de um getter novo por chave). Usado pelas flags de QA do UMP.
function getExpoUtilsOption(appConfig: any, key: string): any {
    const plugins = appConfig?.expo?.plugins;
    if (!Array.isArray(plugins)) return undefined;
    for (const plugin of plugins) {
        if (Array.isArray(plugin) && plugin[0] === "expo-utils") return plugin[1]?.[key];
    }
    return undefined;
}

// OTA (Hot Updater v0 e v1): implementação em ./hot-updater; exposto aqui porque os apps importam `initHotUpdater` de
// "expo-utils/utils/Utils" e chamam no próprio layout, antes do prepare. A busca do Remote Config sai junto com a checagem
// de OTA, e o prepare usa a mesma (memoizada): os apps de layout próprio ganham o tempo sem mudar nada (ver
// startBootRequests).
export const initHotUpdater = (target?: string | object | null, options?: InitHotUpdaterOptions): Promise<void> => {
    Utils.getRemoteConfigUtils().catch(() => {});
    return runHotUpdater(target, {beforeReload: () => Utils.getRemoteConfigUtils(), ...options});
};

// Memoiza o portão de APNs: o token (ou a ausência dele) não muda dentro de uma sessão,
// então pollamos uma única vez e reusamos o resultado em requestFCMToken/setupMessagingTopics/etc.
let apnsReadyPromise: Promise<boolean> | null = null;

// Boot: appConfig/appStrings capturados no prepare() e usados pelo Utils.handleReady
// (chamado via <View onLayout={Utils.handleReady} />). bootDone garante que rode 1x.
let bootAppConfig: any;
let bootAppStrings: AppStrings | undefined;
/** AppStrings do boot (Utils.prepare), para a UI da lib que não recebe props do app (ex.: o seedColor do alerta). */
export const getBootAppStrings = (): AppStrings | undefined => bootAppStrings;
let bootFcmTrackingAllowed = true;
let bootDone = false;
// Prazo pro layout chamar o handleReady depois do prepare() (o normal é no 1º frame).
const HANDLE_READY_WATCHDOG_MS = 30000;
// Resultado do UMP na sessão, lido pelo evento `consent_flow`.
let umpOutcome = "skipped";

// O template (templates/Strings.ts) ships rckey como "appl_YOUR_REVENUECAT_IOS_KEY"/
// "goog_YOUR_REVENUECAT_ANDROID_KEY". Chave placeholder é o mesmo que não ter chave:
// sem este guard o Purchases.configure roda com key inválida (401 SILENCIOSO — o
// logHandler é no-op) e toda a cadeia dependente de RC (atribuição, tópicos de status,
// TikTok identify) gira à toa contra um app RC inexistente.
let warnedPlaceholderRcKey = false;
export const usableRcKey = (rckey?: string): string | undefined => {
    if (!rckey) return undefined;
    if (!rckey.includes("YOUR_REVENUECAT")) return rckey;
    if (!warnedPlaceholderRcKey) {
        warnedPlaceholderRcKey = true;
        expoUtilsWarn("rckey é o placeholder do template (YOUR_REVENUECAT_…) — RevenueCat e atribuição desativados até configurar a key real em Strings.ts.");
    }
    return undefined;
};

// RevenueCat "ativo" DE VERDADE: isConfigured() sozinho mente — fica true até com key
// inválida (401 silencioso, logHandler no-op) e não garante que getCustomerInfo funcione.
// Aqui exigimos configure feito E uma chamada real funcionando (getCustomerInfo; barata
// após o 1º sucesso — cache do SDK). Memoiza o sucesso; falha limpa o memo pra tentar de
// novo na próxima chamada (configure tardio / rede que voltou).
let rcActivePromise: Promise<boolean> | null = null;
export const isRevenueCatActive = (): Promise<boolean> => {
    if (rcActivePromise) return rcActivePromise;
    const attempt = (async () => {
        try {
            if (!(await Purchases.isConfigured())) return false;
            await Purchases.getCustomerInfo();
            return true;
        } catch (e) {
            expoUtilsWarn("isRevenueCatActive:", e);
            return false;
        }
    })();
    rcActivePromise = attempt;
    attempt.then((ok) => {
        if (!ok) rcActivePromise = null;
    });
    return attempt;
};

// iOS descarta Alert.alert sobrepostos (RN não enfileira UIAlertController) — o 2º some.
// Fila simples: cada alert só aparece quando o anterior foi fechado.
let alertQueue: Promise<void> = Promise.resolve();
export const queueAlert = (title: string, message?: string) => {
    alertQueue = alertQueue
        .then(
            () =>
                new Promise<void>((resolve) => {
                    Alert.alert(title, message, [{text: "OK", onPress: () => resolve()}], {
                        cancelable: true,
                        onDismiss: () => resolve(),
                    });
                }),
        )
        .catch(() => {});
};

// Promo × ATT: o modal promocional só agenda a exibição depois que o fluxo do ATT terminou
// (ou 15s de fallback), pra Modal do RN não disputar a janela do prompt do sistema.
// O gate só arma quando o boot da lib roda (prepare) — usePromotional standalone não espera.
let attGateArmed = false;
let settleAttFlow: () => void = () => {};
const attFlowDonePromise = new Promise<void>((resolve) => {
    settleAttFlow = resolve;
});
export const waitAttFlowDone = (timeoutMs = 15000): Promise<void> => {
    if (!attGateArmed) return Promise.resolve();
    return Promise.race([attFlowDonePromise, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
};

/**
 * Resolve quando o fluxo de consentimento da abertura termina (UMP e, no iOS, ATT respondido ou no limite da cadeia),
 * sem teto. Sem o boot da lib (handleReady), nunca resolve. Para pedir anúncio só depois do consentimento.
 */
export const whenConsentFlowDone = (): Promise<void> => attFlowDonePromise;

// Quanto a cadeia espera o ATT e a notificação. É limite, não espera: o pedido sai assim que chega a vez dele com o app
// ativo (utils/permission-gate.ts) e o limite só vale quando a resposta não vem — pedido na fila atrás de um diálogo,
// promessa nativa pendurada, ou app que não volta a ficar ativo (iPad em tela dividida). Aí a cadeia segue sem travar FB,
// atribuição, TikTok e o diálogo de update; a resposta que vier depois atualiza FB, atribuição e telemetria. O pedido de
// notificação é a exceção: espera o fim do ATT sem limite (ATT antes da notificação, um pedido por vez).
const PERMISSION_LIMIT_MS = 20000;

// A trava única dos pedidos de permissão (utils/permission-gate.ts). O limite dela só corre com o app ativo. No Android e
// no iOS 26 o diálogo tira o app de `active`, então estourar lá é promessa pendurada e 20 s bastam. No iOS 27 o alerta não
// deixa o app `inactive`: o limite corre com ele na tela e nada no JS o separa de um pedido pendurado (no iOS nenhum caso
// de pendurar é conhecido), por isso 60 s. Passou disso com o alerta aberto, o próximo sai por cima dele, como já acontecia
// sem a trava (medido no iOS 27: o ATT aparece por cima do alerta de localização, 6 de 6).
const PERMISSION_LOCK_LIMIT_MS = Platform.OS === "ios" ? 60000 : PERMISSION_LIMIT_MS;
const permissionLock = createPermissionLock(AppState, PERMISSION_LOCK_LIMIT_MS);

/**
 * Faz um pedido de permissão do app na mesma trava de ATT e notificação da lib: uma permissão de cada vez, nos dois
 * sistemas, quem pede primeiro vai primeiro. Espera a vez e o app ativo (por evento), roda `fn` e solta a trava.
 *
 * Todo pedido do app que possa sair na abertura passa por aqui. No Android, sem isso, ele pode cair na mesma janela do
 * pedido da lib: a resposta se perde, a promessa do Expo nunca resolve e todo pedido do Expo depois dele fica parado até
 * a próxima abertura. Em `fn` vai só o pedido, sem rede nem outra permissão dentro.
 *
 * No limite a trava solta para o próximo pedido. O limite não corre com o diálogo tirando o app de `active`. No iOS 27 o
 * alerta não tira o app de `active`: no limite ele pode seguir na tela, e quem pediu continua esperando a resposta de
 * verdade por mais um limite (o "Permitir" depois de 60 s vale, como antes da trava); sem resposta nem assim, rejeita
 * (promessa nativa pendurada não prende quem chama). No Android, estourar com o app ativo é promessa pendurada: rejeita.
 * Rejeitou: trate como "sem permissão".
 *
 * @example const {status} = await Utils.withPermissionPrompt(() => Location.requestForegroundPermissionsAsync());
 */
export const withPermissionPrompt = async <T>(fn: () => Promise<T>): Promise<T> => {
    const asked: {pending?: Promise<T>} = {};
    const result = await permissionLock(() => (asked.pending = fn()));
    if (result !== TIMED_OUT) return result;
    if (Platform.OS === "ios" && asked.pending) {
        const late = await withActiveLimit(AppState, asked.pending, PERMISSION_LOCK_LIMIT_MS);
        if (late !== TIMED_OUT) return late;
    }
    throw new Error("withPermissionPrompt: pedido de permissão sem resposta no limite");
};

// AuthorizationStatus do RNFB: -1 não determinado, 0 negado, 1 autorizado, 2 provisório, 3 efêmero
const pushStatusLabel = (status: number): string =>
    status === 1 ? "granted" : status === 2 ? "provisional" : status === 3 ? "ephemeral" : status === 0 ? "denied" : "undetermined";

// Status da notificação no Android (POST_NOTIFICATIONS concedida ou não; o RN não diz se já foi perguntada). Não pendura.
// No iOS não há leitura: o getNotificationSettings do push às vezes não voltava (iOS 27) e o pedido não saía; o portão
// pede direto (já respondido, o iOS devolve a resposta sem mostrar nada).
const readAndroidPushPermission = async (): Promise<string> =>
    (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) ? "granted" : "denied";

// Pedido real da notificação (Android: POST_NOTIFICATIONS; iOS: Firebase messaging), sem a trava: quem chama já está nela.
// Já respondido, o sistema devolve a resposta sem mostrar nada.
const askPushPermission = async (): Promise<string> => {
    try {
        if (Platform.OS === "android") {
            // "granted" | "denied" | "never_ask_again" (Android < 13 resolve sem diálogo)
            return String(await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS));
        }
        return pushStatusLabel(Number(await requestPermission(getMessaging(getApp()))));
    } catch (e) {
        expoUtilsWarn("requestPushPermission:", e);
        return "error";
    }
};

// ATT: um fluxo por abertura. Pede só com o app ativo e, se o iOS descartar (volta `undetermined`), pede de novo no
// próximo "ficou ativo", até 3 vezes. Regras e motivo em utils/permission-gate.ts.
const attGate = createPermissionGate<string>({
    appState: AppState,
    // Leitura síncrona no nativo (ATTrackingManager.trackingAuthorizationStatus): não pendura. Já respondido, acaba sem
    // entrar na trava nem esperar o app ativo.
    read: async () => String((await getTrackingPermissionsAsync()).status),
    request: async () => String((await requestTrackingPermissionsAsync()).status),
    canAsk: (status) => status === "undetermined",
    noAnswer: "undetermined",
    lock: permissionLock,
});

// Fim do fluxo do ATT nesta abertura (resposta ou 3 pedidos perdidos; nunca rejeita). Android/web: já resolvido.
let attFlowEnded: Promise<unknown> = Promise.resolve();

// Notificação (Android 13+: POST_NOTIFICATIONS; iOS: Firebase messaging) pela mesma regra. No Android a resposta não
// separa "negado" de "o sistema cancelou", então o pedido conta como perdido quando volta negado SEM o app sair de
// `active`: o diálogo nem apareceu (o sistema cancela o pedido concorrente). Antes do Android 13 não há diálogo (o RN
// resolve na hora): um pedido só, como antes. O pedido só sai depois do fim do ATT (`after`, sem limite): ATT antes da
// notificação e um pedido por vez, também quando o ATT passou do limite da cadeia — alerta ainda na tela (no iOS 27 ele
// não deixa o app `inactive`) ou app fora de `active` com os dois portões esperando o mesmo "ficou ativo".
const pushGate = createPermissionGate<string>({
    appState: AppState,
    read: Platform.OS === "android" ? readAndroidPushPermission : undefined,
    request: askPushPermission,
    noAnswer: "undetermined",
    canAsk: (status) => (Platform.OS === "android" ? status !== "granted" : status === "undetermined"),
    lost: (status, leftActive) =>
        Platform.OS === "android"
            ? Number(Platform.Version) >= 33 && !leftActive && (status === "denied" || status === "never_ask_again")
            : status === "undetermined",
    lock: permissionLock,
    after: () => attFlowEnded,
});

// iOS: a cadeia começou, o ATT está sem resposta e o portão ainda não rodou porque o UMP vem antes (até 20 s). Para o
// anúncio de abertura, isso já é ATT pendente.
let attWaitingUmp = false;

/**
 * O ATT ainda vai pedir (ou está pedindo) nesta abertura, inclusive enquanto o UMP roda antes dele: o anúncio de
 * abertura não aparece nessa volta ao app, para os dois não saírem juntos (utils/appopen-ads.tsx).
 */
export const isAttPending = (): boolean => attWaitingUmp || attGate.isPending();

// `consent_flow`: resultado do UMP, do ATT e do push num evento só — 1x por instalação e de
// novo apenas quando algum dos três muda (taxa de opt-in por país/versão mexe direto no eCPM).
// `att_attempts`/`push_attempts`: quantos pedidos cada um precisou nesta abertura. Sai também quando a resposta chega
// depois do limite da cadeia (nova tentativa no próximo active) e muda algum dos três.
const consent = {att: "na", attAttempts: 0, push: "skipped", pushAttempts: 0, reported: false};
let consentReport: Promise<void> = Promise.resolve();
const reportConsentFlow = (): Promise<void> => {
    // Em fila: a cadeia e uma resposta tardia não leem o AsyncStorage ao mesmo tempo (sairia 2x o mesmo valor).
    consentReport = consentReport
        .then(async () => {
            const value = `${umpOutcome}|${consent.att}|${consent.push}`;
            if ((await AsyncStorage.getItem("@expo_utils_consent")) === value) return;
            await AsyncStorage.setItem("@expo_utils_consent", value);
            logUtilsEvent("consent_flow", {
                ump: umpOutcome,
                att: consent.att,
                push: consent.push,
                att_attempts: consent.attAttempts,
                push_attempts: consent.pushAttempts,
            });
        })
        .catch(() => {});
    return consentReport;
};

// ATT concedido numa nova tentativa depois de o FB e a fase 2 da atribuição terem subido com granted=false: o FB passa
// a coletar o IDFA e a atribuição recoleta os identificadores, agora com ele.
const applyLateAttGrant = async (rckey?: string): Promise<void> => {
    try {
        FbsdkSettings.setAdvertiserIDCollectionEnabled(true);
        await FbsdkSettings.setAdvertiserTrackingEnabled(true);
    } catch (e) {
        expoUtilsWarn("applyLateAttGrant:", e);
    }
    await refreshAttributionAfterAtt(rckey);
};

// Memos de boot: Remote Config compartilhado entre prepare() e banners; prepare roda 1x.
let remoteConfigUtilsPromise: Promise<RemoteConfigUtilsType> | null = null;
// O bloco `screens` sai da mesma leitura do `utils` (settings ou parâmetros de antes). `default` = o boot seguiu
// com os defaults (sem Firebase, erro ou teto de 10s) e vai no `cfg_source` do cfg_integrity.
let remoteConfigScreensBlock: Record<string, any> | null = null;
let remoteConfigSource: RemoteConfigSource | "default" = "default";
// Os blocos da rede que a sessão usa, como chegaram (sem o que a trava da loja muda nos globais): a volta ao app compara
// a config nova com eles (utils/resume-config.ts). null = a abertura seguiu com os defaults.
let sessionConfig: ConfigSnapshot | null = null;
let preparePromise: Promise<void> | null = null;
// UMP + mobileAds().initialize() rodam UMA vez por sessão (o fluxo do ATT pode ser reentrante).
let mobileAdsSetupPromise: Promise<void> | null = null;
// O initialize da sessão terminou (UMP liberou). Sem ele, anúncio religado pelo Remote Config na volta ao app fica para a
// próxima abertura: religar aqui pediria anúncio sem o consentimento do UMP.
let mobileAdsReady = false;

// Compara versões "a.b.c": >0 se current > store, 0 se iguais, <0 se current < store.
const compareVersions = (current: string, store: string): number => {
    const currentParts = current.split(".").map((part) => Number(part) || 0);
    const storeParts = store.split(".").map((part) => Number(part) || 0);
    const length = Math.max(currentParts.length, storeParts.length);

    for (let index = 0; index < length; index += 1) {
        const diff = (currentParts[index] ?? 0) - (storeParts[index] ?? 0);
        if (diff !== 0) return diff;
    }

    return 0;
};

// Fallback: versão da loja informada via Remote Config (ios_store_version/android_store_version e aliases).
const getRemoteStoreVersion = (): string | null => {
    const remote: Record<string, any> = (global as any).remoteConfigs ?? (global as any).remoteConfigUtils ?? {};
    const keys =
        Platform.OS === "android"
            ? ["android_store_version", "store_version_android", "storeVersionAndroid"]
            : ["ios_store_version", "store_version_ios", "storeVersionIos"];

    for (const key of keys) {
        const value = remote[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }

    return null;
};

// Aborta consultas de loja penduradas. O gate é AGUARDADO no boot (ver prepare), então o
// pior caso precisa ser limitado — sem isso um lookup pendurado seguraria o app no splash.
const fetchWithTimeout = (url: string, ms = 5000): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, {signal: controller.signal}).finally(() => clearTimeout(timer));
};

// Versão publicada na loja, pela rede: iTunes lookup (iOS) / página do Play Store (Android). null quando não achou.
// Memo: a consulta sai no começo da abertura, junto com o Remote Config e a checagem de OTA (startBootRequests), e a
// trava da loja usa a mesma. NUNCA rejeita.
let storeLookupPromise: Promise<string | null> | null = null;
const lookupStoreVersion = (): Promise<string | null> => {
    if (!storeLookupPromise) storeLookupPromise = fetchStoreVersion();
    return storeLookupPromise;
};

// Versão da loja para a trava: a da rede, ou o fallback do Remote Config, para a válvula pós-lançamento
// (ios_store_version/android_store_version) valer até com o lookup fora do ar. Lê o Remote Config na hora, depois
// do setupGlobalConfigs.
const getStoreVersion = async (): Promise<string | null> => (await lookupStoreVersion()) ?? getRemoteStoreVersion();

const fetchStoreVersion = async (): Promise<string | null> => {
    try {
        if (!Application.applicationId) return null;

        if (Platform.OS === "ios") {
            // Sem `country` o lookup consulta a storefront US — um app publicado SÓ em outras
            // storefronts viria vazio (e o gate FAIL-CLOSED desligaria ads de app já lançado).
            // A storefront do usuário (regionCode) certamente tem o app (foi de onde ele
            // instalou), então tentamos ela primeiro e caímos para a US/global depois.
            const region = safeGetLocales()[0]?.regionCode?.toLowerCase();
            const base = `https://itunes.apple.com/lookup?bundleId=${Application.applicationId}`;
            const urls = region ? [`${base}&country=${region}`, base] : [base];
            for (const url of urls) {
                try {
                    const response = await fetchWithTimeout(url);
                    const data = await response.json();
                    const version = data?.results?.[0]?.version;
                    if (version) return version;
                } catch {}
            }
        }

        if (Platform.OS === "android") {
            const response = await fetchWithTimeout(
                `https://play.google.com/store/apps/details?id=${Application.applicationId}`,
            );
            const html = await response.text();
            const version = html.match(/"141":\[\[\["([^"]+)"/)?.[1];
            if (version) return version;
        }
    } catch (error) {
        expoUtilsWarn("getStoreVersion:", error);
    }
    return null;
};

// Desliga os ads da sessão. adsDisabledByStoreGate é flag PRÓPRIA do gate (prepare()/
// setupGlobalConfigs não encostam nela) — apps podem ler p/ ex. esconder o espaço do banner.
const disableAdsByStoreGate = () => {
    global.adsDisabledByStoreGate = true;
    global.isAdsEnabled = false;
    (global as any).remoteConfigUtils = {...((global as any).remoteConfigUtils ?? {}), is_ads_enabled: false};
    (global as any).remoteConfigs = {...((global as any).remoteConfigs ?? {}), is_ads_enabled: false};
};

// Memo: 1x por sessão (a versão da loja não muda durante a sessão; idempotente sob
// StrictMode/chamada dupla — mesmo padrão do apnsReadyPromise).
let storeGatePromise: Promise<boolean> | null = null;

// Volta ao app com `resume_config: "on_leave"` (utils/resume-config.ts): no máximo uma busca a cada 30 s, para quem troca
// de app várias vezes seguidas não disparar uma busca por troca.
const RESUME_MIN_INTERVAL_MS = 30_000;

// Busca a config de novo, na saída do app. Sem gravar settings/defaults: no iOS o setter cancela o fetch em voo, e o
// intervalo 0 já foi gravado na abertura. Falhou (sem rede, limite do Firebase): null, e a config fica como está.
const refreshRemoteConfig = async (): Promise<ConfigSnapshot | null> => {
    try {
        const remoteConfig = getRemoteConfig(getApp());
        await fetchAndActivate(remoteConfig);
        const blocks = readRemoteConfigBlocks((key) => getValue(remoteConfig, key).asString());
        return {utils: {is_ads_enabled: !__DEV__, min_version: 1.0, ...blocks.utils}, screens: blocks.screens};
    } catch {
        return null;
    }
};

const currentConfig = (): ConfigSnapshot =>
    sessionConfig ?? {utils: (global as any).remoteConfigUtils ?? {}, screens: (global as any).remoteConfigScreens ?? {}};

// Troca a config da sessão pela nova, como o boot faz (setupGlobalConfigs). O liga-desliga dos anúncios só muda quando o
// `is_ads_enabled` mudou: desligar vale na hora; religar só se o UMP e o initialize da sessão já rodaram (senão, na próxima
// abertura). O veredito da trava da loja continua valendo (a versão da loja não muda na sessão).
const applyRemoteConfig = (next: ConfigSnapshot) => {
    const adsChanged = currentConfig().utils.is_ads_enabled !== next.utils.is_ads_enabled;
    const adsOn = !__DEV__ && next.utils.is_ads_enabled !== false;
    sessionConfig = next;
    remoteConfigScreensBlock = next.screens;
    remoteConfigUtilsPromise = Promise.resolve(next.utils as RemoteConfigUtilsType);
    (global as any).remoteConfigUtils = {...next.utils};
    (global as any).remoteConfigScreens = next.screens;
    (global as any).remoteConfigs = mergeRemoteConfigBlocks((global as any).remoteConfigUtils, next.screens);
    if (adsChanged && (!adsOn || mobileAdsReady)) global.isAdsEnabled = adsOn;
    if (global.adsDisabledByStoreGate) disableAdsByStoreGate();
    setBlocklist(next.utils.ad_blocklist);
    expoUtilsLog("[expo-utils] Remote Config novo aplicado na saída do app.");
};

let resumeConfigStarted = false;
// Versão da config da sessão: sobe a cada Remote Config novo aplicado na saída do app (useConfigVersion).
let configVersion = 0;
const configListeners = new Set<() => void>();
export const getConfigVersion = (): number => configVersion;
export const onConfigApplied = (listener: () => void): (() => void) => {
    configListeners.add(listener);
    return () => {
        configListeners.delete(listener);
    };
};

// FAIL-CLOSED: ads só permanecem ligados com versão da loja CONFIRMADA e build local <= loja.
// App não publicado (review da 1ª versão!), lookup vazio, erro de rede ou timeout → ads OFF.
// Fail-open não cobre justamente a 1ª submissão: app sem versão na loja mostraria ads durante
// o review. Custo real do fail-closed: zero — sem rede o AdMob não serviria mesmo, e
// pós-lançamento o Remote Config é a válvula para forçar ON. Resolve true = ads bloqueados.
const runStoreGate = async (): Promise<boolean> => {
    const localVersion = Application.nativeApplicationVersion;
    if (!localVersion) {
        disableAdsByStoreGate();
        return true;
    }
    let storeVersion: string | null = null;
    try {
        storeVersion = await getStoreVersion();
    } catch (error) {
        expoUtilsWarn("disableAdsIfBuildIsNewerThanStore:", error);
    }
    if (!storeVersion || compareVersions(localVersion, storeVersion) > 0) {
        disableAdsByStoreGate();
        expoUtilsLog("Store gate: ads OFF — loja:", storeVersion, "local:", localVersion);
        return true;
    }
    expoUtilsLog("Store gate: ads ON — loja:", storeVersion, "local:", localVersion);
    return false;
};

/**
 * Corpo real do boot — extraído do prepare() para rodar UMA vez por sessão (preparePromise):
 * StrictMode/remount chamavam prepare 2x e duplicavam Purchases.configure e o
 * addCustomerInfoUpdateListener. Nunca rejeita: cada bloco é isolado em try/catch próprio.
 */
const runPrepare = async (appConfig?: any, appStrings?: AppStrings): Promise<void> => {
    initAdRevenue();
    try {
        LogBox.ignoreAllLogs(true);
        global.isAdsEnabled = !__DEV__;
    } catch (e) {
        expoUtilsWarn("ignoreAllLogs:", e);
    }

    try {
        if (__DEV__) {
            // Dev menu: limpar storage + toggles de Premium e Ads + simular trial cancelado + reload manual.
            // Premium persiste (@isPremium). Ads flipa global.isAdsEnabled em RUNTIME (não persiste —
            // volta ao Remote Config no próximo reload). Os toggles só setam; use "Reload" pra reaplicar a UI.
            registerDevMenuItems([
                {name: "Clear Storage And Reload", callback: async () => { await AsyncStorage.clear(); DevSettings.reload(); }},
                {name: `Premium → toggle`, callback: async () => {
                    const isPrem = (await AsyncStorage.getItem("@isPremium")) === "true";
                    await AsyncStorage.setItem("@isPremium", JSON.stringify(!isPrem));
                }},
                {name: `Ads → toggle`, callback: async () => {
                    global.isAdsEnabled = global.isAdsEnabled === false;
                }},
                // Modal de retenção com dados falsos (sem RevenueCat). Fica nesta MESMA lista: cada
                // registerDevMenuItems troca o mapa inteiro de callbacks (expo-dev-menu/build/DevMenu.js).
                {name: "Simular trial cancelado", callback: () => { showRetentionPreview(); }},
                {name: "Reload", callback: async () => { DevSettings.reload(); }},
            ]);
        }
    } catch (e) {
        expoUtilsWarn("registerDevMenuItems:", e);
    }
    const rckey = usableRcKey(appStrings?.rckey);
    const adUnits = appStrings?.adUnits;
    // A consulta da loja sai aqui nos layouts próprios (o Remote Config já saiu no initHotUpdater); no ExpoUtilsLayout as
    // duas já saíram junto com a checagem de OTA.
    Utils.startBootRequests(appConfig);
    try {
        //Setup do remoteconfig (Precisa de internet). Trabalho NÃO-tracking — sempre roda.
        //HotUpdater: já é disparado no module-scope do RootLayout (initHotUpdater) — não duplicamos aqui.
        //checkForRequiredUpdateDialog: movido para DEPOIS do ATT (RootLayout) para o Alert não
        //colidir/suprimir o prompt do ATT (iOS exibe um modal de sistema por vez).
        const remoteConfigs = await Utils.getRemoteConfigUtils();
        try { await Utils.setupRevenueCat(rckey); }                                catch (e) { expoUtilsWarn("setupRevenueCat:", e); }
        // Atribuição FASE 1 (nada aqui depende de ATT/UMP): dispara já, fora do caminho do
        // splash, pro 1º recibo sair com atributos — quem compra no 1º minuto postava o recibo
        // antes de a fila pós-ATT chegar na atribuição e o customer ficava vazio no RevenueCat.
        runAttributionPhase1(rckey, {metaInstallReferrerKey: appStrings?.metaInstallReferrerKey}).catch((e) => expoUtilsWarn("runAttributionPhase1:", e));
        try { await Utils.setupGlobalConfigs(appConfig, remoteConfigs, adUnits); } catch (e) { expoUtilsWarn("setupGlobalConfigs:", e); }
        try { await reportConfigIntegrity(remoteConfigs, appConfig, remoteConfigSource); } catch (e) { expoUtilsWarn("reportConfigIntegrity:", e); }

        // Ligado por padrão (desliga com ["expo-utils", {"disableAdsIfBuildIsNewerThanStore": false}] no
        // app.json): gate FAIL-CLOSED de ads por versão da loja. AGUARDADO de propósito — o
        // veredito precisa chegar ANTES do setAppIsReady(true), porque banner-ad lê
        // global.isAdsEnabled UMA vez no mount e os filhos do ExpoUtilsLayout montam assim que
        // appIsReady vira true. Também precisa rodar DEPOIS do setupGlobalConfigs (que reseta/
        // sobrescreve os globals que o gate lê/escreve). Não pendura o boot: fetch com timeout
        // de 5s e runStoreGate nunca rejeita.
        if (getExpoUtilsDisableAdsIfBuildIsNewerThanStore(appConfig)) {
            try { await Utils.disableAdsIfBuildIsNewerThanStore(); } catch (e) { expoUtilsWarn("disableAdsIfBuildIsNewerThanStore:", e); }
        }

        //Trabalho NÃO-tracking que pode rodar sem consentimento (push topics + clarity).
        (async () => {
            try { await Utils.logFirstOpenOnce(appConfig); }                        catch (e) { expoUtilsWarn("logFirstOpenOnce:", e); }
            try { await Utils.setupClarity(remoteConfigs); }                        catch (e) { expoUtilsWarn("setupClarity:", e); }
            try { await Utils.requestFCMToken(); }                                  catch (e) { expoUtilsWarn("requestFCMToken:", e); }
            try { await Utils.setupMessagingTopics(appConfig, rckey); }             catch (e) { expoUtilsWarn("setupMessagingTopics:", e); }
        })();


        //Listener se mudou informacao do Usuário.
        try {
            if (rckey) {
                Purchases.addCustomerInfoUpdateListener((customerInfo) => {
                    Utils.updateRCStatusMessagingTopic(appConfig, rckey, customerInfo);
                });
            }
        } catch (e) { expoUtilsWarn("addCustomerInfoUpdateListener:", e); }


    } catch (e) {
        expoUtilsWarn("Error in prepare:", e);
    }
};

const Utils = {
    // Função para buscar App ID iOS a partir do bundle ID
    getIOSAppId: async (): Promise<string | null> => {
        try {
            if (Platform.OS !== "ios") {
                return null;
            }

            const bundleId = Application.applicationId;
            if (!bundleId) {
                expoUtilsWarn("Bundle ID not found for iOS app lookup");
                return null;
            }

            // Mesmo padrão do getStoreVersion: storefront do usuário primeiro (sem `country`
            // o lookup cai na US e app publicado só em outras storefronts vem vazio → botão
            // de review morto) e fetch com timeout (sem ele o lookup pendurado trava o botão).
            const region = safeGetLocales()[0]?.regionCode?.toLowerCase();
            const base = `https://itunes.apple.com/lookup?bundleId=${bundleId}`;
            const urls = region ? [`${base}&country=${region}`, base] : [base];
            expoUtilsLog("Looking up iOS App ID for bundle:", bundleId);

            for (const url of urls) {
                try {
                    const response = await fetchWithTimeout(url);
                    const data = await response.json();
                    const trackId = data?.results?.[0]?.trackId;
                    if (trackId) {
                        const appId = String(trackId);
                        expoUtilsLog("Found iOS App ID:", appId);
                        return appId;
                    }
                } catch {}
            }
            expoUtilsWarn("App not found in App Store for bundle ID:", bundleId);
            return null;
        } catch (error) {
            expoUtilsWarn("Error looking up iOS App ID:", error);
            return null;
        }
    },

    /**
     * Dispara as idas à rede de que a abertura depende — Remote Config e, com a trava da loja ligada, a versão na loja
     * — sem esperar. Chame antes do `await initHotUpdater` (o ExpoUtilsLayout faz isso): as duas correm junto com a
     * checagem de OTA em vez de uma depois da outra (medido no iOS: OTA 0,7–1,0 s, Remote Config 0,5–1,0 s, loja
     * ~0,2 s em fila). O initHotUpdater já dispara o Remote Config sozinho (layouts próprios); sem esta chamada, a loja
     * sai no começo do prepare. As regras não mudam: o app só aparece com o Remote Config da rede, e o veredito da loja
     * sai antes do setAppIsReady. Idempotente (as duas são memoizadas).
     */
    startBootRequests: (appConfig?: any): void => {
        Utils.getRemoteConfigUtils().catch(() => {});
        if (getExpoUtilsDisableAdsIfBuildIsNewerThanStore(appConfig)) lookupStoreVersion().catch(() => {});
    },

    /**
     * Remote Config na volta ao app (`resume_config` no bloco `utils`; regra em utils/resume-config.ts). Com `on_leave`,
     * a lib busca a config quando o app sai de vista e, se mudou com a pessoa ainda fora, troca a config e sobe a versão
     * (getConfigVersion/onConfigApplied) para o layout redesenhar as telas. Quem liga é o useConfigVersion (o
     * ExpoUtilsLayout usa; layout próprio usa no navegador): app que não redesenha não troca nada. No Android precisa do
     * react-native-applifecycle (sem ele o AppState vira `background` em todo diálogo de permissão, anúncio e compra):
     * sem o módulo, fica como `off`. Idempotente.
     */
    setupResumeConfig: (): void => {
        if (resumeConfigStarted) return;
        resumeConfigStarted = true;
        const nativeModule = Platform.OS === "android" ? NativeModules[APP_LIFECYCLE_MODULE] : undefined;
        if (Platform.OS === "android" && pickAppLifecycleSource(Platform.OS, nativeModule) !== "process-lifecycle") {
            // O layout monta antes de o Remote Config chegar: o aviso espera a config da abertura.
            Utils.getRemoteConfigUtils()
                .then((config) => {
                    if (config?.resume_config === "on_leave") {
                        expoUtilsWarn("resume_config on_leave: no Android precisa do react-native-applifecycle instalado no app. Fica desligado.");
                    }
                })
                .catch(() => {});
            return;
        }
        addAppLifecycleListener(
            createResumeConfig({
                mode: () => (global as any).remoteConfigUtils?.resume_config,
                refresh: refreshRemoteConfig,
                current: currentConfig,
                apply: (next) => {
                    applyRemoteConfig(next);
                    configVersion += 1;
                    configListeners.forEach((listener) => listener());
                },
                now: () => Date.now(),
                minIntervalMs: RESUME_MIN_INTERVAL_MS,
                // iOS: o JS para poucos segundos depois do background e, na volta, a busca pode terminar antes do evento de
                // `active`: aplicar ali seria com a pessoa já no app. A config buscada vale no começo da próxima saída. No
                // Android o ProcessLifecycleOwner mantém o JS rodando fora de vista, e ela vale na mesma saída.
                applyAfterFetch: Platform.OS === "android",
            }),
        );
    },

    getRemoteConfigUtils: (): Promise<RemoteConfigUtilsType> => {
        // Memoizado: prepare() e cada mount de banner compartilham o MESMO fetch. Antes,
        // cada banner refazia setDefaults+fetchAndActivate (minimumFetchInterval 0) — uma
        // request de rede por tela e risco de throttle do Remote Config.
        if (remoteConfigUtilsPromise) return remoteConfigUtilsPromise;
        remoteConfigUtilsPromise = (async (): Promise<RemoteConfigUtilsType> => {
            // Default de ads: ON em produção, OFF em dev. O Remote Config ainda pode
            // desligar explicitamente (is_ads_enabled:false) — isso é só o fallback quando não há valor.
            const DEFAULT = {is_ads_enabled: !__DEV__, min_version: 1.0} as any;
            let app: any = null;
            try { app = getApp(); } catch {}
            if (!app) {
                expoUtilsWarn("Firebase not configured, using default settings");
                return DEFAULT;
            }
            const fetchConfigs = async (): Promise<RemoteConfigUtilsType> => {
                try {
                    const remoteConfig = getRemoteConfig(app);
                    const defaults = {
                        settings: JSON.stringify({}),
                        utils: JSON.stringify({is_ads_enabled: !__DEV__}),
                        screens: JSON.stringify({}),
                    };
                    await applyRemoteConfigDefaults(remoteConfig, defaults, {
                        minimumFetchIntervalMillis: 0,
                    });
                    try {
                        await fetchAndActivate(remoteConfig);
                    } catch {}
                    // `settings` ({utils, screens}) quando o app já está no formato novo; senão `utils` + `screens`.
                    const blocks = readRemoteConfigBlocks((key) => getValue(remoteConfig, key).asString());
                    remoteConfigScreensBlock = blocks.screens;
                    remoteConfigSource = blocks.source;
                    // Coalesce com DEFAULT: se o bloco `utils` existir mas vier sem is_ads_enabled,
                    // não cai em undefined (que apagaria o banner) — herda o default (ON em prod).
                    const utils = {...DEFAULT, ...blocks.utils};
                    sessionConfig = {utils, screens: blocks.screens};
                    return utils;
                } catch {
                    return DEFAULT;
                }
            };
            // Timeout de segurança: se o Remote Config (rede/nativo) pendurar, NÃO trava o boot —
            // seguimos com os defaults e o app renderiza normalmente. 10s (era 60s: ninguém
            // deve encarar 1 minuto de splash por um RC nativo pendurado).
            return Promise.race([
                fetchConfigs(),
                new Promise<RemoteConfigUtilsType>((resolve) => setTimeout(() => resolve(DEFAULT), 10000)),
            ]);
        })();
        return remoteConfigUtilsPromise;
    },

    /**
     * Bloco `screens`: do `settings` no formato novo ou do parâmetro `screens`. Sai da mesma leitura do
     * getRemoteConfigUtils (memoizada). Se essa leitura ainda não terminou (teto de 10s), lê os valores ativos
     * agora — os da última sessão, como antes.
     */
    getRemoteConfigScreens: async (): Promise<any> => {
        try { await Utils.getRemoteConfigUtils(); } catch {}
        if (remoteConfigScreensBlock) return remoteConfigScreensBlock;
        try {
            const app = getApp();
            if (!app) return {};
            const remoteConfig = getRemoteConfig(app);
            return readRemoteConfigBlocks((key) => getValue(remoteConfig, key).asString()).screens;
        } catch {
            return {};
        }
    },

    setupRevenueCat: async (rckey?: string) => {
        try {
            const key = usableRcKey(rckey);
            if (!key) {
                if (!rckey) expoUtilsWarn("RevenueCat key not provided, skipping configuration");
                return;
            }
            Purchases.configure({apiKey: key});
            Purchases.setLogLevel(LOG_LEVEL.ERROR);
            Purchases.setLogHandler(() => {}); //Erro de js quando n usa.
        } catch (error) {
            expoUtilsWarn("Error setting up RevenueCat:", error);
        }
    },

    initFBSDK: async (appConfig?: AppConfig, attGranted: boolean = false) => {
        try {
            FbsdkSettings.initializeSDK();
            const fbConfig = appConfig?.expo?.plugins?.find(
                (plugin: any) => Array.isArray(plugin) && plugin[0] === "react-native-fbsdk-next",
            );
            const appID = fbConfig?.[1]?.appID;

            if (!appID) {
                expoUtilsWarn("Facebook App ID not found in app.config. Configure the react-native-fbsdk-next plugin.");
                return;
            }
            FbsdkSettings.setAppID(appID);
            // A coleta de IDFA é desligada por padrão no plugin (advertiserIDCollectionEnabled:false).
            // Aqui seguimos o resultado REAL do ATT: advertiser/IDFA só ligam quando attGranted === true.
            FbsdkSettings.setAdvertiserIDCollectionEnabled(attGranted);
            await FbsdkSettings.setAdvertiserTrackingEnabled(attGranted);
        } catch (error) {
            expoUtilsWarn("Error setting up Facebook SDK:", error);
        }
    },

    setupClarity: async (remoteConfigs: RemoteConfigUtilsType) => {
        const clarityProjectId = remoteConfigs?.clarity_id;
        if (!clarityProjectId) {
            // Sem clarity_id é config normal (Clarity opcional) — não é problema, então não polui o console.
            return;
        }
        try {
            Clarity.initialize(clarityProjectId, {logLevel: Clarity.LogLevel.None});
        } catch {}
    },

    /**
     * Garante que o token de push (APNs → FCM) esteja disponível ANTES de inscrever em tópicos.
     * NÃO pede permissão de notificação (não dispara prompt) — apenas registra o device e aguarda
     * o token, evitando a janela de fresh install em que subscribeToTopic falharia por token ainda
     * inexistente. No iOS o auto-register (default true) já cobre o registro; o `if` é só fallback.
     */
    /**
     * Portão de APNs: no iOS o APNS token chega via callback NATIVO assíncrono.
     * `registerDeviceForRemoteMessages` só INICIA o registro — não espera o token.
     * Se chamarmos getToken/subscribeToTopic antes do APNS token existir, o Firebase
     * solta "No APNS token specified before fetching FCM Token" (Code 505).
     * Aqui registramos e fazemos polling do getAPNSToken até ele aparecer (ou timeout).
     * Retorna false quando o APNS nunca chega (ex.: simulador sem push) — aí o caller
     * pula getToken/inscrições em vez de falhar com erro.
     */
    ensureApnsReady: async (timeoutMs = 10000): Promise<boolean> => {
        if (Platform.OS !== "ios") return true; // Android não usa APNs
        if (apnsReadyPromise) return apnsReadyPromise; // pollamos só 1x por sessão
        apnsReadyPromise = (async () => {
            try {
                // Em simulador/emulador o APNS NUNCA chega — pulamos o poll INTEIRO. Isso zera o
                // spam nativo "getAPNSToken - Simulator without APNS support" (cada getAPNSToken
                // que chamaríamos viraria 1 linha no console DEBUG) e não trava 10s no boot.
                // Em device físico segue o backoff normal abaixo.
                let isSimulator = false;
                try {
                    isSimulator = Device.isDevice === false; // false só em simulador/emulador
                } catch {}
                if (isSimulator) {
                    expoUtilsWarn("Simulador/emulador sem APNS — pulando FCM token/tópicos.");
                    return false;
                }
                const messaging = getMessaging(getApp());
                // no-op se auto-register (default true) já registrou
                if (!isDeviceRegisteredForRemoteMessages(messaging)) {
                    await registerDeviceForRemoteMessages(messaging);
                }
                // Poll com BACKOFF (300→600→1200→…→2000ms): em DEVICE FÍSICO o APNS chega em <1-2s
                // e é capturado nas 1ªs tentativas. (No simulador nem chega aqui — saiu acima.)
                // É o fallback p/ device com APNS lento.
                const start = Date.now();
                let apnsToken = await getAPNSToken(messaging);
                let pollDelay = 300;
                while (!apnsToken && Date.now() - start < timeoutMs) {
                    await new Promise((resolve) => setTimeout(resolve, pollDelay));
                    pollDelay = Math.min(pollDelay * 2, 2000);
                    apnsToken = await getAPNSToken(messaging);
                }
                if (!apnsToken) {
                    expoUtilsWarn("APNS token indisponível (ex.: simulador sem push) — pulando FCM token/tópicos.");
                    return false;
                }
                return true;
            } catch (e) {
                expoUtilsWarn("ensureApnsReady:", e);
                return false;
            }
        })();
        return apnsReadyPromise;
    },

    requestFCMToken: async () =>{
        // Espera o APNS token de verdade antes de buscar o FCM token (iOS).
        if (!(await Utils.ensureApnsReady())) return;
        const messaging = getMessaging(getApp());
        await getToken(messaging);
    },

    setupMessagingTopics: async (appConfig?: AppConfig, rckey?: string) => {

        // Sem await: o tópico de estado passa por uma fila serial (utils/rc-status.ts) e um subscribe
        // pendurado (offline) atrasaria o registro do onMessage e da push aberta logo abaixo.
        Utils.updateRCStatusMessagingTopic(appConfig, rckey).catch((e) => expoUtilsWarn("updateRCStatusMessagingTopic:", e));

        try {
            const app = getApp();
            if (app) {
                const messaging = getMessaging(app);

                // Enable BigQuery export for delivery metrics (Android)
                try {
                    await experimentalSetDeliveryMetricsExportedToBigQueryEnabled(messaging, true);
                } catch (e) { expoUtilsWarn("setDeliveryMetricsExportToBigQuery:", e); }

                // Push ABERTA (toque na notificação): app em background → onNotificationOpenedApp;
                // app fechado → getInitialNotification (a notificação que abriu o app).
                try {
                    onNotificationOpenedApp(messaging, (remoteMessage) => { logPushOpened(remoteMessage, "background"); });
                    getInitialNotification(messaging)
                        .then((remoteMessage) => logPushOpened(remoteMessage, "quit"))
                        .catch((e) => expoUtilsWarn("getInitialNotification:", e));
                } catch (e) { expoUtilsWarn("push opened tracking:", e); }

                // Foreground message handler with analytics tracking
                onMessage(messaging, async (remoteMessage) => {
                    logPushReceived(remoteMessage, "foreground");
                    if (remoteMessage.notification) {
                        const languageCode = safeGetLocales()[0]?.languageCode ?? "en";
                        const messages = getLocalizedMessages(languageCode);
                        // Enfileirado: 2 pushes seguidos em foreground não perdem o 2º alert (iOS
                        // descarta UIAlertController sobreposto).
                        queueAlert(messages.newMessage, remoteMessage.notification.body);
                    }
                });

                // Background message handler with analytics tracking
                try {
                    setBackgroundMessageHandler(messaging, async (remoteMessage) => {
                        logPushReceived(remoteMessage, "background");
                        return Promise.resolve();
                    });
                } catch (e) { expoUtilsWarn("setBackgroundMessageHandler:", e); }

                // Inscrições em tópico exigem o APNS token no iOS (senão "No APNS token specified").
                // Esperamos ele aqui; se não chegar (ex.: simulador), pulamos sem spammar erro.
                if (!(await Utils.ensureApnsReady())) return;

                const topicName = appConfig?.expo?.slug || "default-topic";
                subscribeToTopic(messaging, topicName)
                    .then(() => { expoUtilsLog("Subscribed to topic:", topicName); logUtilsEvent("fcm_topic_subscribe", {fcm_topic: topicName}); })
                    .catch(() => expoUtilsWarn("Failed to subscribe to topic:", topicName));
                const localeInfo = safeGetLocales()[0];
                const regionCode = localeInfo?.regionCode;
                if (regionCode) {
                    const countryTopic = `${topicName}-${regionCode.toLowerCase()}`;
                    subscribeToTopic(messaging, countryTopic)
                        .then(() => { expoUtilsLog("Subscribed to country topic:", countryTopic); logUtilsEvent("fcm_topic_subscribe", {fcm_topic: countryTopic}); })
                        .catch(() => expoUtilsWarn("Failed to subscribe to country topic:", countryTopic));
                }
                const languageCode = localeInfo?.languageCode;
                if (languageCode) {
                    const langTopic = `${topicName}-lang-${languageCode.toLowerCase()}`;
                    subscribeToTopic(messaging, langTopic)
                        .then(() => { expoUtilsLog("Subscribed to language topic:", langTopic); logUtilsEvent("fcm_topic_subscribe", {fcm_topic: langTopic}); })
                        .catch(() => expoUtilsWarn("Failed to subscribe to language topic:", langTopic));
                }
            }
        } catch (error) {
            expoUtilsWarn("Error setting up push notifications:", error);
        }
    },

    checkForRequiredUpdateDialog: async () => {
        try {
            const remoteConfigs = (global as any).remoteConfigUtils as RemoteConfigUtilsType;
            if (!Application.nativeApplicationVersion) return;
            // compareVersions, não parseFloat: "1.10" parseava como 1.1 (< "1.9") e "1.2.3"
            // virava 1.2 — comparação semanticamente errada de versões multi-segmento.
            const minVersion = String(remoteConfigs?.min_version ?? "").trim();
            if (!minVersion || compareVersions(Application.nativeApplicationVersion, minVersion) >= 0) {
                return;
            }

            const languageCode = safeGetLocales()[0]?.languageCode ?? "en";
            const messages = getLocalizedMessages(languageCode);

            const openStore = async () => {
                let url: string;
                if (Platform.OS === "android") {
                    url = `https://play.google.com/store/apps/details?id=${Application.applicationId}`;
                } else {
                    const iosAppId = await Utils.getIOSAppId();
                    if (iosAppId) {
                        url = `https://apps.apple.com/app/apple-store/id${iosAppId}`;
                    } else {
                        const fallbackAppId = remoteConfigs.ios_app_id;
                        url = fallbackAppId
                            ? `https://apps.apple.com/app/apple-store/id${fallbackAppId}`
                            : "https://apps.apple.com/";
                    }
                }
                await Linking.openURL(url);
            };

            const present = () => {
                Alert.alert(
                    messages.updateRequired,
                    messages.updateMessage,
                    [
                        {
                            text: messages.updateNow,
                            onPress: async () => {
                                // openURL pode rejeitar (sem handler p/ URL) — sem o catch o alert
                                // sumia e nunca era reapresentado (fura o update obrigatório).
                                try {
                                    await openStore();
                                } catch (e) {
                                    expoUtilsWarn("checkForRequiredUpdateDialog/openStore:", e);
                                }
                                present();
                            },
                        },
                    ],
                    {cancelable: false},
                );
            };
            present();
        } catch (error) {
            expoUtilsWarn("Error checking for required update:", error);
        }
    },

    /** Pedido de permissão do app, na mesma trava de ATT e notificação da lib. Ver `withPermissionPrompt`. */
    withPermissionPrompt,

    /**
     * Solicita a permissão de Push Notifications (Android: POST_NOTIFICATIONS; iOS: Firebase
     * messaging), um pedido só, na trava de permissão (espera a vez e o app ativo). NÃO chama ATT —
     * é permissão separada. A cadeia da lib (requestTrackingWhenActive, depois do ATT) pede pelo
     * portão de permissões (nova tentativa no próximo active, limite de tempo —
     * utils/permission-gate.ts). Não é pré-requisito para inscrição em tópicos: a permissão só
     * controla a EXIBIÇÃO da notificação, não a inscrição/recebimento.
     */
    requestPushPermission: (): Promise<string> =>
        withPermissionPrompt(askPushPermission).catch((e) => {
            expoUtilsWarn("requestPushPermission:", e);
            return "error";
        }),

    /**
     * Boot do app — roda APENAS trabalho que NÃO depende de consentimento de tracking:
     * Remote Config, Hot Updater, diálogo de update obrigatório, RevenueCat, configs globais,
     * Clarity, token FCM e inscrição em tópicos de messaging. Define appIsReady ao final (no
     * finally), então o app SEMPRE renderiza — o boot nunca espera por ATT/push.
     *
     * prepare() NÃO chama ATT, push, nem inicializa SDKs de tracking (FB/TikTok/atribuição).
     * Tudo isso é feito DEPOIS do primeiro frame por Utils.requestTrackingWhenActive(), chamado
     * no RootLayout — garantindo que o prompt ATT apareça de forma confiável e que nenhum dado
     * de tracking seja coletado antes do consentimento.
     */
    prepare: async (setAppIsReady: (ready: boolean) => void, appConfig?: any, appStrings?: AppStrings, fcmTrackingAllowed: boolean = true) => {
        bootAppConfig = appConfig;
        bootAppStrings = appStrings;
        bootFcmTrackingAllowed = fcmTrackingAllowed;
        // Boot 1x por sessão (StrictMode/remount chamam prepare de novo): a 2ª chamada apenas
        // espera o MESMO boot terminar antes de liberar a UI — sem configurar RevenueCat nem
        // registrar o customerInfoUpdateListener em dobro. runPrepare nunca rejeita.
        if (!preparePromise) {
            attGateArmed = true; // o promo passa a esperar o fluxo do ATT (waitAttFlowDone)
            preparePromise = runPrepare(appConfig, appStrings);
            // Watchdog: UMP, ATT, push, FB, TikTok e a fase 2 da atribuição SÓ rodam se o layout
            // renderizar <View onLayout={Utils.handleReady} /> (ExpoUtilsLayout / template).
            // Layout legado que chama só o prepare() perde tudo isso em silêncio — o warn vira
            // `expo_utils_warn` no Analytics e denuncia o app em produção.
            preparePromise.then(() => {
                setTimeout(() => {
                    if (!bootDone) expoUtilsWarn("handleReady nunca foi chamado: ATT, push, FB, TikTok e atribuição não rodam. Use o ExpoUtilsLayout ou <View onLayout={Utils.handleReady} />.");
                }, HANDLE_READY_WATCHDOG_MS);
            });
        }
        try {
            await preparePromise;
        } finally {
            setAppIsReady(true);
        }
    },

    /**
     * Chamado via <View onLayout={Utils.handleReady} /> no layout, logo após o primeiro frame.
     * Esconde o splash e dispara a cadeia de consentimento (UMP → ATT → push → …) na hora, sem espera fixa.
     *
     * Até a 1.5.6 havia 3s aqui antes do hideAsync, mais 2s até a cadeia, e o ATT ainda esperava 1s e
     * "até 4s pelo active, depois pede mesmo assim". O motivo dos 3s era o ATT (dito pelo dono em
     * 06/11/2026): às vezes o app abria e o ATT não aparecia. Era gambiarra: o splash não bloqueia o
     * ATT (o alerta do iOS aparece por cima dele) e nenhuma espera fixa garante o app ativo — elas só
     * afastavam, por acaso, o pedido da lib do alerta de localização e do ATT que a home pede ao montar.
     * A causa é o iOS descartar o ATT pedido com o app fora de `active` ou com outro pedido pendente, e
     * a correção é o portão de permissões (utils/permission-gate.ts): pede com o app ativo e pede de novo
     * no próximo "ficou ativo". Não recoloque espera fixa aqui nem antes de um pedido de permissão.
     *
     * O catch do hideAsync é obrigatório: rejeitado sem catch, pararia UMP, ATT, push e a fase 2 da sessão.
     * Roda uma única vez; usa o appConfig/appStrings capturados no prepare().
     */
    handleReady: () => {
        if (bootDone) return;
        bootDone = true;
        SplashScreen.hideAsync().catch((e) => expoUtilsWarn("SplashScreen.hideAsync:", e));
        Utils.requestTrackingWhenActive(bootAppConfig, bootAppStrings, bootFcmTrackingAllowed).catch((e) => expoUtilsWarn("requestTrackingWhenActive:", e));
    },

    /**
     * UMP (consentimento de ads) + `mobileAds().initialize()`, UMA vez por sessão.
     *
     * Ordem importa: o formulário do UMP vem ANTES do ATT (recomendação do Google, e o iOS só
     * mostra um modal de sistema por vez) e o SDK só inicializa quando `canRequestAds` permite.
     * Inicializar explicitamente é o que faz os ADAPTERS de mediation subirem cedo — o retorno
     * (`AdapterStatus[]`) é logado e é a prova em runtime de que cada rede está no build.
     *
     * Fora de EEA/UK/estados regulados dos EUA o gatherConsent resolve sem exibir nada.
     * Sem ads (premium / is_ads_enabled=false) não roda: não há consentimento a coletar.
     * Nunca lança e nunca pendura (timeout no passo de consentimento).
     *
     * QA fora da Europa: `["expo-utils", {"umpDebugGeography": "EEA", "umpTestDeviceIds": ["..."]}]`.
     */
    setupMobileAds: async (appConfig?: any): Promise<void> => {
        if (mobileAdsSetupPromise) return mobileAdsSetupPromise;

        mobileAdsSetupPromise = (async () => {
            try {
                if ((global as any).isAdsEnabled === false || (global as any).remoteConfigUtils?.is_ads_enabled === false) return;
                if (await PremiumUtils.getIsPremiumStatus()) return;

                const debugGeography = getExpoUtilsOption(appConfig, "umpDebugGeography");
                const testDeviceIdentifiers = getExpoUtilsOption(appConfig, "umpTestDeviceIds");
                const consentOptions: any = {};
                if (typeof debugGeography === "string" && debugGeography in AdsConsentDebugGeography) {
                    consentOptions.debugGeography = (AdsConsentDebugGeography as any)[debugGeography];
                }
                if (Array.isArray(testDeviceIdentifiers)) consentOptions.testDeviceIdentifiers = testDeviceIdentifiers;

                // Timeout só do passo de consentimento: se o requestInfoUpdate travar (rede ruim),
                // o boot segue para ATT/push em vez de ficar preso — contrato do resto do arquivo.
                const consentInfo = await Promise.race([
                    AdsConsent.gatherConsent(consentOptions),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
                ]);
                if (!consentInfo) expoUtilsWarn("setupMobileAds: gatherConsent não respondeu em 20s — seguindo.");
                // Para o `consent_flow`: timeout | denied | not_required | obtained | required | unknown.
                umpOutcome = !consentInfo ? "timeout" : consentInfo.canRequestAds === false ? "denied" : String(consentInfo.status ?? "unknown").toLowerCase();
                if (consentInfo && consentInfo.canRequestAds === false) {
                    expoUtilsLog("[expo-utils] UMP: consentimento nega ads nesta sessão (canRequestAds=false).");
                    return;
                }

                const statuses = await mobileAds().initialize();
                mobileAdsReady = true;
                expoUtilsLog(
                    "[expo-utils] mobileAds().initialize():",
                    (statuses || [])
                        .map((s: any) => `${s.name}=${s.state === 1 ? "ready" : "NOT_READY"}${s.description ? ` (${s.description})` : ""}`)
                        .join(" | ") || "sem adapters",
                );
            } catch (e) {
                // Só quando o erro veio ANTES do veredito do UMP (não apaga um "obtained").
                if (umpOutcome === "skipped") umpOutcome = "error";
                expoUtilsWarn("setupMobileAds:", e);
            }
        })();

        return mobileAdsSetupPromise;
    },

    /**
     * O botão "Privacidade dos anúncios" deve existir na tela de ajustes? Só quando o UMP diz
     * que as opções de privacidade são exigidas (usuário de EEA/UK/US regulado que já consentiu).
     * Fora disso NÃO existe formulário para abrir e o botão deve ficar escondido — é o que o
     * Google recomenda e evita o botão que "não faz nada".
     */
    isPrivacyOptionsRequired: async (): Promise<boolean> => {
        try {
            const info = await AdsConsent.getConsentInfo();
            return String(info?.privacyOptionsRequirementStatus) === "REQUIRED";
        } catch (e) {
            expoUtilsWarn("isPrivacyOptionsRequired:", e);
            return false;
        }
    },

    /**
     * Reabre o formulário de opções de privacidade do UMP. Nunca lança e SEMPRE diz o porquê
     * quando não abre — o `showPrivacyOptionsForm` do SDK não exibe nada quando o formulário não
     * é exigido, o que na tela vira "o botão não faz nada".
     *
     * Retorna `{shown:true}` quando o usuário viu (e fechou) o formulário; `{shown:false, reason}`
     * com "not-required" (nada a exibir nesta região/estado de consentimento) ou com o código e a
     * mensagem do SDK. Ex.: `const {shown, reason} = await Utils.showPrivacyOptionsForm();`
     *
     * O carregamento leva 1–3s (o form vem da rede): mostre um loading no botão.
     */
    showPrivacyOptionsForm: async (): Promise<{shown: boolean; reason?: string}> => {
        try {
            if (!(await Utils.isPrivacyOptionsRequired())) {
                expoUtilsLog("[expo-utils] UMP: privacy options não são exigidas — nada a exibir.");
                return {shown: false, reason: "not-required"};
            }
            await AdsConsent.showPrivacyOptionsForm();
            return {shown: true};
        } catch (e: any) {
            const reason = `${e?.code ?? "erro"}: ${e?.message ?? String(e)}`;
            expoUtilsWarn("showPrivacyOptionsForm:", reason);
            return {shown: false, reason};
        }
    },

    /**
     * Zera o estado do UMP (só faz sentido em QA: força o formulário a aparecer de novo no
     * próximo setupMobileAds/reload). Libera também o memo de sessão.
     */
    resetAdsConsent: (): void => {
        try {
            AdsConsent.reset();
            mobileAdsSetupPromise = null;
        } catch (e) {
            expoUtilsWarn("resetAdsConsent:", e);
        }
    },

    /**
     * Orquestra, DEPOIS do primeiro frame, toda a etapa que depende de consentimento. Deve ser
     * chamada uma única vez pelo RootLayout (no effect de appIsReady), nunca durante o boot.
     *
     * Ordem de execução:
     *   1. UMP + init do Google Mobile Ads (setupMobileAds): consentimento de ads vem ANTES do
     *      ATT — ordem recomendada pelo Google e o iOS só exibe um modal de sistema por vez.
     *      Fora de EEA/UK/US regulado não mostra nada e sai rápido.
     *   2. ATT (somente iOS), pelo portão de permissões (utils/permission-gate.ts): lê o status (leitura
     *      síncrona) e só pede quando 'undetermined'; pede só com o app `active` (senão espera o evento, nunca
     *      timer) e na trava única de permissão (withPermissionPrompt: se a home já pediu localização,
     *      espera a resposta dela); se o iOS descartar (volta 'undetermined'), pede de novo no próximo
     *      "ficou ativo", até 3 vezes por abertura. A cadeia espera o resultado por no máximo PERMISSION_LIMIT_MS e
     *      segue; a resposta que vier depois atualiza `att_status`, o `consent_flow`, o FB e a atribuição.
     *   3. FB SDK + fase 2 da atribuição do RevenueCat, em cadeia DESTACADA (não aguardada):
     *      sai assim que o ATT resolve e não fica atrás de push/TikTok. O advertiser/IDFA do FB
     *      recebe o resultado REAL do ATT (granted); sem consentimento o IDFA fica zerado. ATT
     *      concedido numa nova tentativa, depois disso: FB avisado (setAdvertiserTrackingEnabled(true))
     *      e identificadores recoletados.
     *   4. Push permission (iOS + Android), se fcmTrackingAllowed, pelo mesmo portão e na mesma trava
     *      (no Android, pedido cancelado pelo sistema ou pendurado pede de novo no próximo active). O pedido só
     *      sai depois do fim do ATT, sem limite nessa espera (ATT antes da notificação e um pedido por
     *      vez, mesmo com o ATT além do limite); a cadeia espera o 1º desfecho do push por no máximo
     *      PERMISSION_LIMIT_MS. Em seguida o evento `consent_flow` (ump/att/push + tentativas) — 1x por
     *      instalação e quando algum muda.
     *   5. TikTok, link-in-bio e o diálogo de update obrigatório.
     *
     * @param appConfig   app.json (para FB App ID, bundle/package, etc.)
     * @param appStrings  Strings do app (de onde sai o rckey)
     * @param fcmTrackingAllowed  se false, pula a permissão de push (default true)
     * @returns true se o tracking (ATT) foi concedido. No Android/web retorna true.
     */
    requestTrackingWhenActive: async (appConfig?: any, appStrings?: AppStrings, fcmTrackingAllowed: boolean = true): Promise<boolean> => {
        let granted = true;
        consent.att = "na"; // Android/web: não existe ATT

        // ATT sem resposta: o anúncio de abertura já fica de fora enquanto o UMP roda (isAttPending).
        if (Platform.OS === "ios") {
            attWaitingUmp = true;
            getTrackingPermissionsAsync().then(
                ({status}) => {
                    if (status !== "undetermined") attWaitingUmp = false;
                },
                () => {},
            );
        }

        // UMP antes do ATT (ver ordem no comentário acima). Memoizado e com timeout próprio.
        await Utils.setupMobileAds(appConfig ?? bootAppConfig);
        attWaitingUmp = false; // daqui em diante quem diz é o portão (attGate.run logo abaixo, sem await no meio)

        let attFlow: PermissionFlow<string> | null = null;
        if (Platform.OS === "ios") {
            try {
                attFlow = attGate.run();
                attFlowEnded = attFlow.final.then(
                    () => {},
                    () => {},
                );
                const outcome = await withTimeout(attFlow.final, PERMISSION_LIMIT_MS);
                // No limite a cadeia segue com o status de agora; o portão continua e a resposta tardia é tratada abaixo.
                consent.att = outcome === TIMED_OUT ? String((await getTrackingPermissionsAsync()).status) : outcome.status;
                consent.attAttempts = attGate.attempts();
                granted = consent.att === "granted";
            } catch (e) {
                expoUtilsWarn("requestTrackingWhenActive:", e);
                granted = false;
                consent.att = "error";
            }
        }

        // ATT resolvido, no limite ou plataforma sem ATT: libera o gate do promo (waitAttFlowDone).
        settleAttFlow();
        setUtilsUserProperty("att_status", consent.att);

        const rckey = usableRcKey(appStrings?.rckey);
        const remoteConfigs = (global as any).remoteConfigUtils as RemoteConfigUtilsType;

        // Cadeia DESTACADA, disparada assim que o ATT resolve: FB (advertiser/IDFA seguem o
        // resultado REAL do ATT; a fase 2 lê o anonymous id dele) → fase 2 da atribuição.
        // Não é aguardada: o prompt de push e o resto da fila não ficam atrás dela, nem ela
        // atrás deles. Antes a atribuição era o ÚLTIMO passo (depois de push, TikTok com até
        // 10s, link-in-bio e update dialog) — quem comprava no 1º minuto saía sem atributo.
        const attStatus = consent.att;
        const fbAndAttribution = (async () => {
            try { await Utils.initFBSDK(appConfig, granted); } catch (e) { expoUtilsWarn("initFBSDK:", e); }
            await Utils.setupAttribution(rckey, granted, attStatus);
        })().catch((e) => expoUtilsWarn("setupAttribution:", e));

        // Resposta do ATT depois do limite (nova tentativa no próximo active): atualiza a telemetria e, se concedido,
        // avisa o FB e recoleta os identificadores da atribuição — depois de eles terem subido com granted=false.
        attFlow?.final.then(
            (late) => {
                consent.attAttempts = late.attempts;
                if (late.status === consent.att) return;
                consent.att = late.status;
                setUtilsUserProperty("att_status", late.status);
                if (late.status === "granted" && !granted) fbAndAttribution.then(() => applyLateAttGrant(rckey)).catch((e) => expoUtilsWarn("applyLateAttGrant:", e));
                if (consent.reported) reportConsentFlow();
            },
            () => {},
        );

        // Push (iOS e Android) — não é tracking de IDFA. O portão só PEDE depois do fim do ATT (`after`, sem limite).
        // A cadeia espera só o 1º desfecho, por no máximo PERMISSION_LIMIT_MS: pedido perdido, pendurado ou ainda na vez
        // do ATT não segura TikTok, link-in-bio e o diálogo de update.
        consent.push = "skipped";
        if (fcmTrackingAllowed) {
            try {
                const pushFlow = pushGate.run();
                // ATT ainda pendente (a cadeia passou do limite dele): o push só pede depois do fim do ATT, então a cadeia não
                // espera mais 20 s por ele; a resposta que vier depois atualiza o consent_flow.
                const outcome = attGate.isPending() ? TIMED_OUT : await withTimeout(pushFlow.first, PERMISSION_LIMIT_MS);
                // timeout: sem 1º desfecho no limite (pedido pendurado, app fora de `active`, ainda na vez do ATT ou na fila da trava).
                consent.push = outcome === TIMED_OUT ? "timeout" : outcome.status;
                consent.pushAttempts = pushGate.attempts();
                pushFlow.final.then(
                    (late) => {
                        if (late.status === consent.push && late.attempts === consent.pushAttempts) return;
                        consent.push = late.status;
                        consent.pushAttempts = late.attempts;
                        if (consent.reported) reportConsentFlow();
                    },
                    () => {},
                );
            } catch (e) {
                expoUtilsWarn("requestPushPermission:", e);
                consent.push = "error";
            }
        }
        consent.reported = true;
        reportConsentFlow();

        // TikTok/link-in-bio inicializam para SKAdNetwork/atribuição agregada (não recebem IDFA
        // do nosso código); cada um grava o próprio atributo no RevenueCat quando sobe.
        try { await Utils.initTikTokSDK(remoteConfigs, rckey); }             catch (e) { expoUtilsWarn("initTikTokSDK:", e); }
        try { await Utils.initLinkInBioTracking(remoteConfigs, appConfig); } catch (e) { expoUtilsWarn("initLinkInBioTracking:", e); }
        try { await Utils.checkForRequiredUpdateDialog(); }                  catch (e) { expoUtilsWarn("checkForRequiredUpdateDialog:", e); }

        return granted;
    },

    // Nome do evento = slug do app, 1x por instalação (flag no AsyncStorage). O replace é
    // obrigatório: nome de evento GA4 só aceita [A-Za-z0-9_] (máx. 40) e todo slug tem hífen.
    logFirstOpenOnce: async (appConfig?: AppConfig) => {
        await initAdRevenue();
        if (await AsyncStorage.getItem("@first_open_logged")) return;
        await AsyncStorage.setItem("@first_open_logged", "true");
        logUtilsEvent((appConfig?.expo?.slug || "unknown").replace(/\W/g, "_").slice(0, 40));
    },

    initLinkInBioTracking: async (remoteConfig: RemoteConfigUtilsType, appConfig: AppConfig) => {
        const apiUrl = remoteConfig?.trends_tracking_url;
        if (!apiUrl) return;
        const {ios, android} = appConfig?.expo ?? {};
        const appId = Platform.OS === "ios" ? ios?.bundleIdentifier : android?.package;
        // O backend casa o install com a impressão web (match por IP) e devolve a campanha →
        // Media Source / Campaign no RevenueCat. Regras de flag/reenvio em utils/link-in-bio.ts.
        // Não é aguardado: o trackInstall tem timeout próprio (5s) e nada abaixo na fila depende dele.
        trackLinkInBioInstall(apiUrl, appId);
    },

    initTikTokSDK: async (remoteConfigs: RemoteConfigUtilsType, rckey?: string) => {
        if (!remoteConfigs?.tiktokads) return;
        const tkads = remoteConfigs?.tiktokads;
        if (!tkads.token || !tkads.appid || !tkads.tkappid) return;
        await TiktokAdsEvents.initializeSdk(tkads.token, tkads.appid, tkads.tkappid, tkads.isdebug);
        if (await TikTokWaitForConfig(10 * 1000)) {
            // identify depende do RevenueCat REALMENTE ativo (getAppUserID lança se o configure
            // falhou) — isolado pra nunca abortar o launch_app/install_app abaixo.
            if (rckey && (await isRevenueCatActive())) {
                try {
                    await TiktokAdsEvents.identify(await Purchases.getAppUserID());
                } catch (e) {
                    expoUtilsWarn("initTikTokSDK/identify:", e);
                }
            }
            await TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.launch_app);
            if ((await AsyncStorage.getItem("tk_is_first_launch")) != "true") {
                TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.install_app);
                await AsyncStorage.setItem("tk_is_first_launch", "true");
            }
            // Anonymous id do TikTok no customer do RevenueCat — gravado AQUI, onde o SDK já
            // está de pé (antes ficava no fim da setupAttribution, atrás da fila inteira).
            if (rckey) {
                setRcAttributesLate("tt", async () => Purchases.setAttributes({TikTokGetAnonymousID: await TiktokAdsEvents.getAnonymousID()}));
            }
        }
    },

    maybeApplyUpdate: async (target?: string | object | null, options?: InitHotUpdaterOptions) => {
        await runHotUpdater(target, {beforeReload: () => Utils.getRemoteConfigUtils(), ...options});
    },

    // Estado do assinante (free/trial/trial_cancelled/intro/active/cancelled/billing_issue/
    // trial_expired/expired/refunded) — regras em utils/rc-status.ts.
    getRevenueCatStatus: (customerInfo: any): RcStatus => classifyRevenueCatStatus(customerInfo),

    // User property `rc_status` + tópico de estado `{slug}-purchase-{status}` + marcos
    // (`-trial_started`, `-converted`). Sem `customerInfo`, busca no RevenueCat.
    updateRCStatusMessagingTopic: async (appConfig?: AppConfig, rckey?: string, customerInfo?: CustomerInfo) => {
        if (!rckey) return;
        try {
            await syncRcStatus(appConfig?.expo?.slug || "default-topic", customerInfo ?? (await Purchases.getCustomerInfo()));
        } catch (error) {
            expoUtilsWarn("Failed to update messaging topic:", error);
        }
    },

    /**
     * Fase 2 da atribuição do RevenueCat: device identifiers, FB anonymous id, push token e geo
     * (utils/attribution.ts). A fase 1 — AdServices, Firebase app instance id, atributos de
     * contexto, user_id do GA4 — sai no boot, logo após o Purchases.configure, e é garantida
     * aqui também para quem chama esta função na mão. Cada etapa tem timeout próprio, a fase
     * termina com um sync FORÇADO e emite `rc_attribution` (a prova de que saiu do aparelho).
     * Memoizada (1x por sessão). Nunca lança.
     * @param attStatus  status do ATT para a telemetria; omitido, é derivado de attGranted.
     */
    setupAttribution: async (rckey?: string, attGranted: boolean = false, attStatus?: string) => {
        await runAttributionPhase2(rckey, attStatus ?? (Platform.OS === "ios" ? (attGranted ? "granted" : "denied") : "na"));
    },

    setupGlobalConfigs: async (appConfig?: any, remoteConfigs?: RemoteConfigUtilsType, adUnits?: object) => {
        if (getExpoUtilsDisableWarnings(appConfig)) {
            (global as any).disableExpoUtilsWarnings = true;
        }
        if (getExpoUtilsDisableLogs(appConfig)) {
            (global as any).disableExpoUtilsLogs = true;
        }
        // Geo por IP (utils/geo.ts) é LIGADA por padrão; ["expo-utils", {"geoAttributes": false}]
        // desliga no app.json (o Remote Config `geo_lookup_enabled: false` desliga sem build).
        if (getExpoUtilsOption(appConfig, "geoAttributes") === false) {
            (global as any).expoUtilsGeoDisabled = true;
        }
        if (adUnits) {
            (global as any).adUnits = adUnits;
        }
        if (remoteConfigs?.is_ads_enabled === false) {
            (global as any).isAdsEnabled = false;
        }
        (global as any).remoteConfigUtils = remoteConfigs;
        let screens: Record<string, any> = {};
        try { screens = (await Utils.getRemoteConfigScreens()) ?? {}; } catch {}
        (global as any).remoteConfigScreens = screens;
        // Os dois blocos juntos (em conflito vale o utils), como era antes de fevereiro de 2026. Até a 1.4 era
        // apelido do remoteConfigUtils: quem lê chave da lib aqui (gate da loja, apps) continua achando.
        (global as any).remoteConfigs = mergeRemoteConfigBlocks(remoteConfigs, screens);
        if (remoteConfigs?.ad_blocklist) {
            setBlocklist(remoteConfigs.ad_blocklist);
        }
    },

    /**
     * Kill switch de ads por versão da loja — FAIL-CLOSED: ads só permanecem ligados com a
     * versão da loja CONFIRMADA e build local <= loja. Desligam quando o build instalado é
     * mais novo que a loja (App Review/TestFlight/teste interno), quando o app ainda NÃO foi
     * publicado (review da 1ª versão — lookup vazio), e em erro de rede/timeout. Ao desligar,
     * zera global.isAdsEnabled + is_ads_enabled nos remote configs globais e seta
     * global.adsDisabledByStoreGate (flag própria, que o prepare() não sobrescreve).
     * Versão da loja: iTunes lookup (storefront do usuário → US) / página do Play Store,
     * com ios_store_version/android_store_version do Remote Config como válvula pós-lançamento.
     * Memoizada — roda 1x por sessão. Resolve true = ads bloqueados.
     * LIGADA por padrão desde a 1.5.4 (desligue no app.json com ["expo-utils", {"disableAdsIfBuildIsNewerThanStore": false}]).
     * Roda no boot: o prepare() AGUARDA o veredito antes do setAppIsReady(true), então os
     * banners (que leem global.isAdsEnabled 1x no mount) já montam com o valor final.
     * Chamada manual: sempre DEPOIS do prepare() (que reseta/sobrescreve os globals de ads).
     */
    disableAdsIfBuildIsNewerThanStore: (): Promise<boolean> => {
        if (!storeGatePromise) storeGatePromise = runStoreGate();
        return storeGatePromise;
    },

    openReviewURL: async (preferNativeStore = true) => {
        try {
            if (Platform.OS === "android") {
                const packageName = Application.applicationId;
                if (!packageName) {
                    expoUtilsWarn("Android package name could not be detected automatically");
                    return false;
                }

                const storeUrl = preferNativeStore
                    ? `market://details?id=${packageName}&showAllReviews=true`
                    : `https://play.google.com/store/apps/details?id=${packageName}&showAllReviews=true`;

                expoUtilsLog("Opening Android review URL:", storeUrl);
                await Linking.openURL(storeUrl);
                return true;
            } else if (Platform.OS === "ios") {
                const iosAppId = await Utils.getIOSAppId();
                if (!iosAppId) {
                    expoUtilsWarn("iOS App ID could not be found automatically");
                    return false;
                }

                const storeUrl = preferNativeStore
                    ? `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${iosAppId}?action=write-review`
                    : `https://apps.apple.com/app/apple-store/id${iosAppId}?action=write-review`;

                expoUtilsLog("Opening iOS review URL:", storeUrl);
                await Linking.openURL(storeUrl);
                return true;
            } else {
                expoUtilsWarn("Platform not supported for review URL:", Platform.OS);
                return false;
            }
        } catch (error) {
            expoUtilsWarn("Error opening review URL:", error);
            return false;
        }
    },
};

export default Utils;
