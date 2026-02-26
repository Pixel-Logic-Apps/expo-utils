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
const safeGetLocales = (): Array<{languageCode?: string; regionCode?: string}> => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("expo-localization");
        if (mod && typeof mod.getLocales === "function") {
            return mod.getLocales();
        }
    } catch {}
    return [{languageCode: "en"}];
};

// Static imports for runtime dependencies
import {requestTrackingPermissionsAsync} from "expo-tracking-transparency";
import * as Application from "expo-application";
import {AppEventsLogger, Settings as FbsdkSettings} from "react-native-fbsdk-next";
import Purchases, {LOG_LEVEL} from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {Alert, Platform, Linking, LogBox} from "react-native";
import {HotUpdater} from "@hot-updater/react-native";
import {logConfigIntegrityValues, reportConfigIntegrity} from "./config-integrity";
import {setBlocklist} from "./AdPlacementTracker";

// Importações modulares do Firebase
import {
    getRemoteConfig,
    setConfigSettings,
    setDefaults,
    fetchAndActivate,
    getValue,
} from "@react-native-firebase/remote-config";
import {getMessaging, requestPermission, onMessage, subscribeToTopic, getToken, setBackgroundMessageHandler, experimentalSetDeliveryMetricsExportedToBigQueryEnabled} from "@react-native-firebase/messaging";
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
        if (!app) {
            expoUtilsWarn("Firebase not configured, using default settings");
            return {is_ads_enabled: false, min_version: 1.0} as any;
        }
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

    initFBSDK: async (appConfig?: AppConfig) => {
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
            await FbsdkSettings.setAdvertiserTrackingEnabled(true);
        } catch (error) {
            console.error("Error setting up Facebook SDK:", error);
        }
    },

    setupClarity: async (remoteConfigs: RemoteConfigUtilsType) => {
        const clarityProjectId = remoteConfigs?.clarity_id;
        if (!clarityProjectId) {
            expoUtilsWarn("Clarity project ID not provided, skipping initialization.");
            return;
        }
        try {
            const Clarity = require("@microsoft/react-native-clarity");
            Clarity.initialize(clarityProjectId, {logLevel: Clarity.LogLevel.None});
        } catch {}
    },
    setupPushNotifications: async (appConfig?: AppConfig) => {
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

                const topicName = appConfig?.expo?.slug || "default-topic";
                subscribeToTopic(messaging, topicName)
                    .then(() => expoUtilsWarn("Subscribed to topic:", topicName))
                    .catch(() => expoUtilsWarn("Failed to subscribe to topic:", topicName));
                const localeInfo = safeGetLocales()[0];
                const regionCode = localeInfo?.regionCode;
                if (regionCode) {
                    const countryTopic = `${topicName}-${regionCode.toLowerCase()}`;
                    subscribeToTopic(messaging, countryTopic)
                        .then(() => expoUtilsWarn("Subscribed to country topic:", countryTopic))
                        .catch(() => expoUtilsWarn("Failed to subscribe to country topic:", countryTopic));
                }
                const languageCode = localeInfo?.languageCode;
                if (languageCode) {
                    const langTopic = `${topicName}-lang-${languageCode.toLowerCase()}`;
                    subscribeToTopic(messaging, langTopic)
                        .then(() => expoUtilsWarn("Subscribed to language topic:", langTopic))
                        .catch(() => expoUtilsWarn("Failed to subscribe to language topic:", langTopic));
                }
            }
        } catch (error) {
            console.error("Error setting up push notifications:", error);
        }
    },

    checkForRequiredUpdateDialog: async (remoteConfigSettings: RemoteConfigUtilsType) => {
        try {
            if (!Application.nativeApplicationVersion) return;
            const version = parseFloat(Application.nativeApplicationVersion);
            const minVersion = parseFloat((remoteConfigSettings?.min_version ?? 0).toString());

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
                        const fallbackAppId = remoteConfigSettings.ios_app_id;
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

    prepare: async (setAppIsReady: (ready: boolean) => void, appConfig?: any, appStrings?: AppStrings, requestPermissions: boolean = true) => {
        LogBox.ignoreAllLogs(true);
        const rckey = appStrings?.rckey;
        const adUnits = appStrings?.adUnits;
        try {
            //Caso não queira charmar os trackings no início.
            if (requestPermissions) {
                const {status} = await requestTrackingPermissionsAsync();
                await requestPermission(getMessaging(getApp()));
            }

            //Setup do remoteconfig (Precisa de internet).
            const remoteConfigs = await Utils.getRemoteConfigUtils();
            try { await Utils.maybeApplyUpdate(); }                                    catch (e) { expoUtilsWarn("maybeApplyUpdate:", e); }
            try { await Utils.checkForRequiredUpdateDialog(remoteConfigs); }           catch (e) { expoUtilsWarn("checkForRequiredUpdateDialog:", e); }
            try { await Utils.setupRevenueCat(rckey); }                                catch (e) { expoUtilsWarn("setupRevenueCat:", e); }
            try { await Utils.setupGlobalConfigs(appConfig, remoteConfigs, adUnits); } catch (e) { expoUtilsWarn("setupGlobalConfigs:", e); }
            try { await reportConfigIntegrity(remoteConfigs, appConfig); }             catch (e) { expoUtilsWarn("reportConfigIntegrity:", e); }

            //Precisa de carregar todas as libs pra setar os ids.
            (async () => {
                try { await Utils.initFBSDK(appConfig); }                            catch (e) { expoUtilsWarn("initFBSDK:", e); }
                try { await Utils.initTikTokSDK(remoteConfigs, rckey); }             catch (e) { expoUtilsWarn("initTikTokSDK:", e); }
                try { await Utils.setupClarity(remoteConfigs); }                     catch (e) { expoUtilsWarn("setupClarity:", e); }
                try { await Utils.setupPushNotifications(appConfig); }               catch (e) { expoUtilsWarn("setupPushNotifications:", e); }
                try { await Utils.initLinkInBioTracking(remoteConfigs, appConfig); } catch (e) { expoUtilsWarn("initLinkInBioTracking:", e); }
                try { await Utils.setupAttribution(rckey); }                         catch (e) { expoUtilsWarn("setupAttribution:", e); }
                try { await Utils.updateMessagingTopic(appConfig, rckey); }          catch (e) { expoUtilsWarn("updateMessagingTopic:", e); }
            })();

            //Listener se mudou informacao do Usuário.
            try {
                if (rckey) {
                    Purchases.addCustomerInfoUpdateListener(() => {
                        Utils.updateMessagingTopic(appConfig, rckey);
                    });
                }
            } catch (e) { expoUtilsWarn("addCustomerInfoUpdateListener:", e); }
        } catch (e) {
            expoUtilsWarn("Error in prepare:", e);
        } finally {
            setAppIsReady(true);
        }
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

    // Função para verificar e aplicar updates do HotUpdater
    maybeApplyUpdate: async () => {
        const updateInfo = await HotUpdater.checkForUpdate({
            updateStrategy: "appVersion",
        });
        if (updateInfo) {
            await updateInfo.updateBundle();
            if (updateInfo.shouldForceUpdate) {
                await HotUpdater.reload();
            }
        }
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

    updateMessagingTopic: async (appConfig: AppConfig, rckey?: string) => {
        if (!rckey) return;
        try {
            const slug = appConfig?.expo?.slug || "default-topic";
            const customerInfo = await Purchases.getCustomerInfo();

            // Determina o status detalhado
            const status = Utils.getRevenueCatStatus(customerInfo);

            const newTopic = `${slug}-purchase-${status}`;
            const previousTopic = await AsyncStorage.getItem("FCM_CURRENT_TOPIC");

            // Se o topic mudou, desinscreve do anterior e inscreve no novo
            if (previousTopic && previousTopic !== newTopic) {
                await getMessaging(getApp()).unsubscribeFromTopic(previousTopic);
                console.log("Unsubscribed from topic:", previousTopic);
            }

            if (previousTopic !== newTopic) {
                await getMessaging(getApp()).subscribeToTopic(newTopic);
                await AsyncStorage.setItem("FCM_CURRENT_TOPIC", newTopic);
                console.log("Subscribed to topic:", newTopic);
            }
        } catch (error) {
            console.log("Failed to update messaging topic:", error);
        }
    },

    setupAttribution: async (rckey?: string) => {
        if (!rckey) return;
        await Purchases.enableAdServicesAttributionTokenCollection();
        await Purchases.collectDeviceIdentifiers();
        await Purchases.setFBAnonymousID(await AppEventsLogger.getAnonymousID());
        await Purchases.setPushToken(await getToken(getMessaging(getApp())));
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
