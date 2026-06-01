// Função para warnings configuráveis do expo-utils
export function expoUtilsWarn(...args: any[]) {
    if (!(global as any).disableExpoUtilsWarnings) {
        // eslint-disable-next-line no-console
        console.warn(...args);
    }
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
import * as Clarity from "@microsoft/react-native-clarity";
import {AppEventsLogger, Settings as FbsdkSettings} from "react-native-fbsdk-next";
import Purchases, {LOG_LEVEL} from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {Alert, AppState, Platform, Linking, LogBox, DevSettings, PermissionsAndroid} from "react-native";
import {registerDevMenuItems} from "expo-dev-menu";
import {HotUpdater} from "@hot-updater/react-native";
import {reportConfigIntegrity} from "./config-integrity";
import {setBlocklist} from "./AdPlacementTracker";

// Importações modulares do Firebase
import {
    getRemoteConfig,
    setConfigSettings,
    setDefaults,
    fetchAndActivate,
    getValue,
} from "@react-native-firebase/remote-config";
import {getMessaging, requestPermission, onMessage, subscribeToTopic, unsubscribeFromTopic, getToken, setBackgroundMessageHandler, experimentalSetDeliveryMetricsExportedToBigQueryEnabled, registerDeviceForRemoteMessages, isDeviceRegisteredForRemoteMessages, getAPNSToken} from "@react-native-firebase/messaging";
import {getAnalytics, getAppInstanceId, logEvent} from "@react-native-firebase/analytics";
import {getApp} from "@react-native-firebase/app";
import TiktokAdsEvents, {TikTokStandardEvents, TikTokWaitForConfig} from "expo-tiktok-ads-events";
import {TrendingsTracker} from "./TrendingsTracker";

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

export async function initHotUpdater(baseURL?: string) {
    if (!baseURL) return;
    try {
        HotUpdater.init({baseURL});
        const updateInfo = await HotUpdater.checkForUpdate({updateStrategy: "appVersion"});
        if (updateInfo) {
            await updateInfo.updateBundle();
            if (updateInfo.shouldForceUpdate) {
                await HotUpdater.reload();
            }
        }
    } catch (e) {
        expoUtilsWarn("initHotUpdater:", e);
    }
}

// Memoiza o portão de APNs: o token (ou a ausência dele) não muda dentro de uma sessão,
// então pollamos uma única vez e reusamos o resultado em requestFCMToken/setupMessagingTopics/etc.
let apnsReadyPromise: Promise<boolean> | null = null;

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

            const lookupUrl = `https://itunes.apple.com/lookup?bundleId=${bundleId}`;
            expoUtilsLog("Looking up iOS App ID for bundle:", bundleId);

            const response = await fetch(lookupUrl);
            const data = await response.json();

            if (data.resultCount > 0 && data.results && data.results.length > 0) {
                const appId = data.results[0].trackId.toString();
                expoUtilsLog("Found iOS App ID:", appId);
                return appId;
            } else {
                expoUtilsWarn("App not found in App Store for bundle ID:", bundleId);
                return null;
            }
        } catch (error) {
            expoUtilsWarn("Error looking up iOS App ID:", error);
            return null;
        }
    },

    getRemoteConfigUtils: async (): Promise<RemoteConfigUtilsType> => {
        const app = getApp();
        // Default de ads: ON em produção, OFF. O Remote Config ainda pode
        // desligar explicitamente (is_ads_enabled:false) — isso é só o fallback quando não há valor.
        const DEFAULT = {is_ads_enabled: false, min_version: 1.0} as any;
        if (!app) {
            expoUtilsWarn("Firebase not configured, using default settings");
            return DEFAULT;
        }
        const fetchConfigs = async (): Promise<RemoteConfigUtilsType> => {
            try {
                const remoteConfig = getRemoteConfig(app);
                await setConfigSettings(remoteConfig, {minimumFetchIntervalMillis: 0});
                await setDefaults(remoteConfig, {
                    utils: JSON.stringify({is_ads_enabled: false}),
                    screens: JSON.stringify({}),
                });
                try {
                    await fetchAndActivate(remoteConfig);
                } catch {}
                return JSON.parse(getValue(remoteConfig, "utils").asString());
            } catch {
                return DEFAULT;
            }
        };
        // Timeout de segurança: se o Remote Config (rede/nativo) pendurar, NÃO trava o boot —
        // seguimos com os defaults e o app renderiza normalmente.
        return Promise.race([
            fetchConfigs(),
            new Promise<RemoteConfigUtilsType>((resolve) => setTimeout(() => resolve(DEFAULT), 60000)),
        ]);
    },

    getRemoteConfigScreens: async (): Promise<any> => {
        try {
            const app = getApp();
            if (!app) return {};
            const remoteConfig = getRemoteConfig(app);
            return JSON.parse(getValue(remoteConfig, "screens").asString());
        } catch {
            return {};
        }
    },

    setupRevenueCat: async (rckey?: string) => {
        try {
            if (!rckey) {
                expoUtilsWarn("RevenueCat key not provided, skipping configuration");
                return;
            }
            Purchases.configure({apiKey: rckey});
            Purchases.setLogLevel(LOG_LEVEL.ERROR);
            Purchases.setLogHandler(() => {}); //Erro de js quando n usa.
        } catch (error) {
            console.error("Error setting up RevenueCat:", error);
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
            console.error("Error setting up Facebook SDK:", error);
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
                // expo-device é peer OPCIONAL: o require em try/catch faz o Metro tratá-lo como
                // dependência opcional (não quebra o bundle de quem não instalou). Sem ele, assume
                // device físico e mantém o backoff (comportamento anterior, ~7-8 linhas).
                let isSimulator = false;
                try {
                    const Device = require("expo-device");
                    isSimulator = Device?.isDevice === false; // false só em simulador/emulador
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
                // É o fallback p/ quem não tem expo-device ou device com APNS lento.
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

        try { 
            await Utils.updateRCStatusMessagingTopic(appConfig, rckey); 
        }  catch (e) { 
            expoUtilsWarn("updateRCStatusMessagingTopic:", e); 
        }

        try {
            const app = getApp();
            if (app) {
                const messaging = getMessaging(app);
                const analytics = getAnalytics(app);

                // Enable BigQuery export for delivery metrics (Android)
                try {
                    await experimentalSetDeliveryMetricsExportedToBigQueryEnabled(messaging, true);
                } catch (e) { expoUtilsWarn("setDeliveryMetricsExportToBigQuery:", e); }

                // Foreground message handler with analytics tracking
                onMessage(messaging, async (remoteMessage) => {
                    try {
                        await logEvent(analytics, "push_received", {
                            message_id: remoteMessage.messageId ?? "",
                            topic: (remoteMessage as any).topic ?? "",
                            title: remoteMessage.notification?.title?.substring(0, 100) ?? "",
                        });
                    } catch (e) { expoUtilsWarn("logEvent push_received:", e); }
                    if (remoteMessage.notification) {
                        const languageCode = safeGetLocales()[0]?.languageCode ?? "en";
                        const messages = getLocalizedMessages(languageCode);
                        Alert.alert(messages.newMessage, remoteMessage.notification.body);
                    }
                });

                // Background message handler with analytics tracking
                try {
                    setBackgroundMessageHandler(messaging, async (remoteMessage) => {
                        try {
                            await logEvent(analytics, "push_received_bg", {
                                message_id: remoteMessage.messageId ?? "",
                            });
                        } catch {}
                        return Promise.resolve();
                    });
                } catch (e) { expoUtilsWarn("setBackgroundMessageHandler:", e); }

                // Inscrições em tópico exigem o APNS token no iOS (senão "No APNS token specified").
                // Esperamos ele aqui; se não chegar (ex.: simulador), pulamos sem spammar erro.
                if (!(await Utils.ensureApnsReady())) return;

                const topicName = appConfig?.expo?.slug || "default-topic";
                subscribeToTopic(messaging, topicName)
                    .then(() => { expoUtilsWarn("Subscribed to topic:", topicName); logEvent(analytics, "fcm_topic_subscribe", {topic: topicName}); })
                    .catch(() => expoUtilsWarn("Failed to subscribe to topic:", topicName));
                const localeInfo = safeGetLocales()[0];
                const regionCode = localeInfo?.regionCode;
                if (regionCode) {
                    const countryTopic = `${topicName}-${regionCode.toLowerCase()}`;
                    subscribeToTopic(messaging, countryTopic)
                        .then(() => { expoUtilsWarn("Subscribed to country topic:", countryTopic); logEvent(analytics, "fcm_topic_subscribe", {topic: countryTopic}); })
                        .catch(() => expoUtilsWarn("Failed to subscribe to country topic:", countryTopic));
                }
                const languageCode = localeInfo?.languageCode;
                if (languageCode) {
                    const langTopic = `${topicName}-lang-${languageCode.toLowerCase()}`;
                    subscribeToTopic(messaging, langTopic)
                        .then(() => { expoUtilsWarn("Subscribed to language topic:", langTopic); logEvent(analytics, "fcm_topic_subscribe", {topic: langTopic}); })
                        .catch(() => expoUtilsWarn("Failed to subscribe to language topic:", langTopic));
                }
            }
        } catch (error) {
            console.error("Error setting up push notifications:", error);
        }
    },

    checkForRequiredUpdateDialog: async () => {
        try {
            const remoteConfigs = (global as any).remoteConfigUtils as RemoteConfigUtilsType;
            if (!Application.nativeApplicationVersion) return;
            const version = parseFloat(Application.nativeApplicationVersion);
            const minVersion = parseFloat((remoteConfigs?.min_version ?? 0).toString());

            if (isNaN(minVersion) || isNaN(version) || version >= minVersion) {
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
                Linking.openURL(url);
            };

            const present = () => {
                Alert.alert(
                    messages.updateRequired,
                    messages.updateMessage,
                    [
                        {
                            text: messages.updateNow,
                            onPress: async () => {
                                await openStore();
                                present();
                            },
                        },
                    ],
                    {cancelable: false},
                );
            };
            present();
        } catch (error) {
            console.error("Error checking for required update:", error);
        }
    },

    /**
     * Solicita a permissão de Push Notifications (Android: POST_NOTIFICATIONS; iOS: Firebase
     * messaging). NÃO chama ATT — é permissão separada. É invocada por requestTrackingWhenActive
     * (depois do prompt ATT, em ambas as plataformas). Não é pré-requisito para inscrição em
     * tópicos: a permissão só controla a EXIBIÇÃO da notificação, não a inscrição/recebimento.
     */
    requestPushPermission: async () => {
        try {
            if (Platform.OS === "android") {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            } else {
                await requestPermission(getMessaging(getApp()));
            }
        } catch (e) {
            expoUtilsWarn("requestPushPermission:", e);
        }
    },

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
    prepare: async (setAppIsReady: (ready: boolean) => void, appConfig?: any, appStrings?: AppStrings) => {
        LogBox.ignoreAllLogs(true);
        global.isAdsEnabled = !__DEV__;
        if (__DEV__) {
            // Dev menu: limpar storage + toggles de Premium e Ads + reload manual.
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
                {name: "Reload", callback: async () => { DevSettings.reload(); }},
            ]);
        }
        const rckey = appStrings?.rckey;
        const adUnits = appStrings?.adUnits;
        try {
            //Setup do remoteconfig (Precisa de internet). Trabalho NÃO-tracking — sempre roda.
            //HotUpdater: já é disparado no module-scope do RootLayout (initHotUpdater) — não duplicamos aqui.
            //checkForRequiredUpdateDialog: movido para DEPOIS do ATT (RootLayout) para o Alert não
            //colidir/suprimir o prompt do ATT (iOS exibe um modal de sistema por vez).
            const remoteConfigs = await Utils.getRemoteConfigUtils();
            try { await Utils.setupRevenueCat(rckey); }                                catch (e) { expoUtilsWarn("setupRevenueCat:", e); }
            try { await Utils.setupGlobalConfigs(appConfig, remoteConfigs, adUnits); } catch (e) { expoUtilsWarn("setupGlobalConfigs:", e); }
            try { await reportConfigIntegrity(remoteConfigs, appConfig); }             catch (e) { expoUtilsWarn("reportConfigIntegrity:", e); }

            //Trabalho NÃO-tracking que pode rodar sem consentimento (push topics + clarity).
            (async () => {
                try { await Utils.setupClarity(remoteConfigs); }                        catch (e) { expoUtilsWarn("setupClarity:", e); }
                try { await Utils.requestFCMToken(); }                                  catch (e) { expoUtilsWarn("requestFCMToken:", e); }
                try { await Utils.setupMessagingTopics(appConfig, rckey); }             catch (e) { expoUtilsWarn("setupMessagingTopics:", e); }
            })();


            //Listener se mudou informacao do Usuário.
            try {
                if (rckey) {
                    Purchases.addCustomerInfoUpdateListener(() => {
                        Utils.updateRCStatusMessagingTopic(appConfig, rckey);
                    });
                }
            } catch (e) { expoUtilsWarn("addCustomerInfoUpdateListener:", e); }


        } catch (e) {
            expoUtilsWarn("Error in prepare:", e);
        } finally {
            setAppIsReady(true);
        }
    },

    /**
     * Orquestra, DEPOIS do primeiro frame, toda a etapa que depende de consentimento. Deve ser
     * chamada uma única vez pelo RootLayout (no effect de appIsReady), nunca durante o boot.
     *
     * Ordem de execução:
     *   1. ATT (somente iOS): garante app em foreground/active antes de requestTrackingAuthorization
     *      — requisito do iOS 15+, senão o prompt é descartado silenciosamente. Pré-checa o status
     *      e só pede quando 'undetermined'. A espera por foreground tem timeout (NÃO trava o app).
     *   2. Push permission (iOS + Android), se fcmTrackingAllowed.
     *   3. SDKs de tracking (FB, TikTok, link-in-bio, atribuição) — rodam APÓS o prompt. O
     *      advertiser/IDFA do FB recebe o resultado REAL do ATT (granted); sem consentimento o
     *      IDFA fica zerado/desligado.
     *
     * @param appConfig   app.json (para FB App ID, bundle/package, etc.)
     * @param appStrings  Strings do app (de onde sai o rckey)
     * @param fcmTrackingAllowed  se false, pula a permissão de push (default true)
     * @returns true se o tracking (ATT) foi concedido. No Android/web retorna true.
     */
    requestTrackingWhenActive: async (appConfig?: any, appStrings?: AppStrings, fcmTrackingAllowed: boolean = true): Promise<boolean> => {
        let granted = true;

        if (Platform.OS === "ios") {
            try {
                const current = await getTrackingPermissionsAsync();
                if (current.status === "undetermined") {
                    // O prompt do ATT só é exibido com o app em foreground/active. Esperamos esse
                    // estado, mas SEMPRE com timeout de fallback para NUNCA travar o boot do app
                    // (ex.: iPad em multitarefa/Split View pode reportar "inactive" indefinidamente).
                    if (AppState.currentState !== "active") {
                        await new Promise<void>((resolve) => {
                            let done = false;
                            const finish = () => {
                                if (done) return;
                                done = true;
                                sub.remove();
                                clearTimeout(timer);
                                resolve();
                            };
                            const sub = AppState.addEventListener("change", (next) => {
                                if (next === "active") finish();
                            });
                            const timer = setTimeout(finish, 4000);
                            // Caso já tenha virado active entre a checagem e o registro do listener.
                            if (AppState.currentState === "active") finish();
                        });
                    }
                    // O useEffect roda no COMMIT do React, que NÃO é o frame apresentado na tela.
                    // O iOS descarta o prompt se ele dispara antes do 1º frame — então damos um
                    // tempo conservador para o frame ser apresentado antes de pedir o ATT.
                    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
                    const result = await requestTrackingPermissionsAsync();
                    granted = result.status === "granted";
                } else {
                    granted = current.status === "granted";
                }
            } catch (e) {
                expoUtilsWarn("requestTrackingWhenActive:", e);
                granted = false;
            }
        }

        // Push (iOS e Android) — não é tracking de IDFA, roda independente do ATT.
        if (fcmTrackingAllowed) {
            try { await Utils.requestPushPermission(); } catch (e) { expoUtilsWarn("requestPushPermission:", e); }
        }

        // SDKs de tracking rodam DEPOIS do prompt. FB advertiser/IDFA e a coleta de IDFA do
        // RevenueCat (collectDeviceIdentifiers) seguem o resultado real do ATT (granted). TikTok/
        // link-in-bio inicializam para SKAdNetwork/atribuição agregada (não recebem IDFA do nosso código).
        const rckey = appStrings?.rckey;
        const remoteConfigs = (global as any).remoteConfigUtils as RemoteConfigUtilsType;
        try { await Utils.initFBSDK(appConfig, granted); }                   catch (e) { expoUtilsWarn("initFBSDK:", e); }
        try { await Utils.initTikTokSDK(remoteConfigs, rckey); }             catch (e) { expoUtilsWarn("initTikTokSDK:", e); }
        try { await Utils.initLinkInBioTracking(remoteConfigs, appConfig); } catch (e) { expoUtilsWarn("initLinkInBioTracking:", e); }
        try { await Utils.setupAttribution(rckey, granted); }                catch (e) { expoUtilsWarn("setupAttribution:", e); }
        try { await Utils.checkForRequiredUpdateDialog(); }                  catch (e) { expoUtilsWarn("checkForRequiredUpdateDialog:", e); }

        return granted;
    },

    initLinkInBioTracking: async (remoteConfig: RemoteConfigUtilsType, appConfig: AppConfig) => {
        const apiUrl = remoteConfig?.trends_tracking_url;
        if (!apiUrl) return;
        const {ios, android} = appConfig?.expo ?? {};
        const appId = Platform.OS === "ios" ? ios?.bundleIdentifier : android?.package;
        try {
            TrendingsTracker.init({apiUrl, appId});
            if ((await AsyncStorage.getItem("tr_is_first_launch_tracking")) != "true") {
                await AsyncStorage.setItem("tr_is_first_launch_tracking", "true");
                TrendingsTracker.trackInstall();
            }
        } catch {}
    },

    initTikTokSDK: async (remoteConfigs: RemoteConfigUtilsType, rckey?: string) => {
        if (!remoteConfigs?.tiktokads) return;
        const tkads = remoteConfigs?.tiktokads;
        if (!tkads.token || !tkads.appid || !tkads.tkappid) return;
        await TiktokAdsEvents.initializeSdk(tkads.token, tkads.appid, tkads.tkappid, tkads.isdebug);
        if (await TikTokWaitForConfig(10 * 1000)) {
            if (rckey) await TiktokAdsEvents.identify(await Purchases.getAppUserID());
            await TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.launch_app);
            if ((await AsyncStorage.getItem("tk_is_first_launch")) != "true") {
                TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.install_app);
                await AsyncStorage.setItem("tk_is_first_launch", "true");
            }
        }
    },

    maybeApplyUpdate: async (baseURL?: string) => {
        await initHotUpdater(baseURL);
    },

    getRevenueCatStatus: (customerInfo: any): string => {
        const entitlements = customerInfo.entitlements?.active || {};
        const allEntitlements = customerInfo.entitlements?.all || {};
        const subscriptions = customerInfo.subscriptionsByProductIdentifier || {};

        // Verifica se há algum entitlement ativo
        const activeEntitlementKeys = Object.keys(entitlements);
        if (activeEntitlementKeys.length > 0) {
            const entitlement = entitlements[activeEntitlementKeys[0]];

            // Verifica se está em trial
            if (entitlement.periodType === "TRIAL") {
                return "trial";
            }

            // Verifica se está em período introdutório
            if (entitlement.periodType === "INTRO") {
                return "intro";
            }

            // Verifica se há problema de cobrança
            if (entitlement.billingIssueDetectedAt) {
                return "billing_issue";
            }

            // Verifica se cancelou mas ainda está ativo (não vai renovar)
            if (!entitlement.willRenew && entitlement.unsubscribeDetectedAt) {
                return "cancelled";
            }

            // Assinatura ativa normal
            return "active";
        }

        // Se não há entitlements ativos, verifica o histórico
        const allEntitlementKeys = Object.keys(allEntitlements);
        if (allEntitlementKeys.length > 0) {
            const entitlement = allEntitlements[allEntitlementKeys[0]];

            // Verifica se foi reembolsado
            const subscriptionKeys = Object.keys(subscriptions);
            for (const key of subscriptionKeys) {
                if (subscriptions[key].refundedAt) {
                    return "refunded";
                }
            }

            // Verifica se expirou (tinha assinatura mas não está mais ativa)
            if (entitlement.expirationDate) {
                const expirationDate = new Date(entitlement.expirationDate);
                if (expirationDate < new Date()) {
                    return "expired";
                }
            }

            // Cancelou e já expirou
            if (entitlement.unsubscribeDetectedAt) {
                return "expired";
            }
        }

        // Verifica se já fez alguma compra (pode ser não-subscription)
        if (customerInfo.allPurchasedProductIdentifiers?.length > 0) {
            return "expired";
        }

        // Nunca comprou nada
        return "free";
    },

    updateRCStatusMessagingTopic: async (appConfig?: AppConfig, rckey?: string) => {
        if (!rckey) return;
        // subscribe/unsubscribe exigem APNS token no iOS — pula se indisponível (ex.: simulador)
        if (!(await Utils.ensureApnsReady())) return;
        try {

            const messaging = getMessaging(getApp());

            const slug = appConfig?.expo?.slug || "default-topic";
            const customerInfo = await Purchases.getCustomerInfo();

            // Determina o status detalhado
            const status = Utils.getRevenueCatStatus(customerInfo);

            const newTopic = `${slug}-purchase-${status}`;
            const previousTopic = await AsyncStorage.getItem("FCM_CURRENT_TOPIC");

            // Se o topic mudou, desinscreve do anterior e inscreve no novo
            if (previousTopic && previousTopic !== newTopic) {
                await unsubscribeFromTopic(messaging, previousTopic);
                logEvent(getAnalytics(getApp()), "fcm_topic_unsubscribe", {topic: previousTopic});
                console.log("Unsubscribed from topic:", previousTopic);
            }

            if (previousTopic !== newTopic) {
                await subscribeToTopic(messaging, newTopic);
                await AsyncStorage.setItem("FCM_CURRENT_TOPIC", newTopic);
                logEvent(getAnalytics(getApp()), "fcm_topic_subscribe", {topic: newTopic, status});
                console.log("Subscribed to topic:", newTopic);
            }
        } catch (error) {
            console.log("Failed to update messaging topic:", error);
        }
    },

    setupAttribution: async (rckey?: string, attGranted: boolean = false) => {
        if (!rckey) return;
        await Purchases.enableAdServicesAttributionTokenCollection(); // Apple AdServices: permitido sem ATT
        if (attGranted) {
            // collectDeviceIdentifiers lê o IDFA — só coletamos com consentimento ATT concedido.
            await Purchases.collectDeviceIdentifiers();
        }
        await Purchases.setFBAnonymousID(await AppEventsLogger.getAnonymousID());
        // Push token exige APNS no iOS — pula só esta linha se indisponível (ex.: simulador),
        // mantendo o restante da atribuição (AdServices/FB/Firebase instance id/TikTok) rodando.
        if (await Utils.ensureApnsReady()) {
            await Purchases.setPushToken(await getToken(getMessaging(getApp())));
        }
        await Purchases.setFirebaseAppInstanceID(await getAppInstanceId(getAnalytics(getApp())));
        await Purchases.setAttributes({TikTokGetAnonymousID: await TiktokAdsEvents.getAnonymousID()});
    },

    setupGlobalConfigs: async (appConfig?: any, remoteConfigs?: RemoteConfigUtilsType, adUnits?: object) => {
        if (getExpoUtilsDisableWarnings(appConfig)) {
            (global as any).disableExpoUtilsWarnings = true;
        }
        if (getExpoUtilsDisableLogs(appConfig)) {
            (global as any).disableExpoUtilsLogs = true;
        }
        if (adUnits) {
            (global as any).adUnits = adUnits;
        }
        if (remoteConfigs?.is_ads_enabled === false) {
            (global as any).isAdsEnabled = false;
        }
        (global as any).remoteConfigUtils = remoteConfigs;
        try { (global as any).remoteConfigScreens = await Utils.getRemoteConfigScreens(); } catch {}
        if (remoteConfigs?.ad_blocklist) {
            setBlocklist(remoteConfigs.ad_blocklist);
        }
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
            console.error("Error opening review URL:", error);
            return false;
        }
    },
};

export default Utils;
