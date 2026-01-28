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

import {AppConfig, RemoteConfigSettings} from "./types";
import {getLocalizedMessages} from "./i18n";
const safeGetLocales = (): Array<{languageCode?: string}> => {
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
import {getUpdateSource, HotUpdater} from "@hot-updater/react-native";

// Importações modulares do Firebase
import {
    getRemoteConfig,
    setConfigSettings,
    setDefaults,
    fetchAndActivate,
    getValue,
} from "@react-native-firebase/remote-config";
import {getMessaging, requestPermission, onMessage, subscribeToTopic, getToken} from "@react-native-firebase/messaging";
import {getAnalytics, getAppInstanceId} from "@react-native-firebase/analytics";
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

    getRemoteConfigSettings: async (): Promise<RemoteConfigSettings> => {
        const app = getApp();
        if (!app) {
            expoUtilsWarn("Firebase not configured, using default settings");
            return {
                is_ads_enabled: false,
                min_version: 1.0,
            } as any;
        }
        const remoteConfig = getRemoteConfig(app);
        await setConfigSettings(remoteConfig, {minimumFetchIntervalMillis: 0});
        await setDefaults(remoteConfig, {
            settings: JSON.stringify({is_ads_enabled: false}),
        });
        try {
            await fetchAndActivate(remoteConfig);
            return JSON.parse(getValue(remoteConfig, "settings").asString());
        } catch (e) {
            return JSON.parse(getValue(remoteConfig, "settings").asString());
        }
    },

    setupRevenueCat: async (remoteConfigSettings: RemoteConfigSettings) => {
        try {
            if (!remoteConfigSettings || !remoteConfigSettings?.rckey) {
                expoUtilsWarn("RevenueCat keys not provided, skipping configuration");
                return;
            }
            const apiKey: string = remoteConfigSettings.rckey;
            Purchases.configure({apiKey});
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

    setupClarity: async (remoteConfigs: RemoteConfigSettings) => {
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
                onMessage(messaging, async (remoteMessage) => {
                    if (remoteMessage.notification) {
                        const languageCode = safeGetLocales()[0]?.languageCode ?? "en";
                        const messages = getLocalizedMessages(languageCode);
                        Alert.alert(messages.newMessage, remoteMessage.notification.body);
                    }
                });
                const topicName = appConfig?.expo?.slug || "default-topic";
                subscribeToTopic(messaging, topicName)
                    .then(() => expoUtilsWarn("Subscribed to topic:", topicName))
                    .catch(() => expoUtilsWarn("Failed to subscribe to topic:", topicName));
            }
        } catch (error) {
            console.error("Error setting up push notifications:", error);
        }
    },

    checkForRequiredUpdateDialog: async (remoteConfigSettings: RemoteConfigSettings) => {
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

    prepare: async (setAppIsReady: (ready: boolean) => void, appConfig?: any, requestPermissions: boolean = true) => {
        LogBox.ignoreAllLogs(true);
        try {
            //Caso não queira charmar os trackings no início.
            if (requestPermissions) {
                const {status} = await requestTrackingPermissionsAsync();
                await requestPermission(getMessaging(getApp()));
            }

            //Setup do remoteconfig (Precisa de internet).
            const remoteConfigs = await Utils.getRemoteConfigSettings();
            await Utils.maybeApplyUpdate(remoteConfigs);
            await Utils.checkForRequiredUpdateDialog(remoteConfigs);
            await Utils.setupRevenueCat(remoteConfigs);
            await Utils.setupGlobalConfigs(appConfig, remoteConfigs);

            //Precisa de carregar todas as libs pra setar os ids.
            (async () => {
                await Utils.initFBSDK(appConfig);
                await Utils.initTikTokSDK(remoteConfigs);
                await Utils.setupClarity(remoteConfigs);
                await Utils.initLinkInBioTracking(remoteConfigs, appConfig);
                await Utils.setupAttribution(remoteConfigs);
                await Utils.updateMessagingTopic(appConfig, remoteConfigs);
            })();

            //Listener se mudou informacao do Usuário.
            if (remoteConfigs?.rckey) {
                Purchases.addCustomerInfoUpdateListener(() => {
                    Utils.updateMessagingTopic(appConfig, remoteConfigs);
                });
            }
        } catch (e) {
            // expoUtilsWarn("Error in prepare:", e);
        } finally {
            setAppIsReady(true);
        }
    },

    initLinkInBioTracking: async (remoteConfig: RemoteConfigSettings, appConfig: AppConfig) => {
        const {ios, android} = appConfig?.expo ?? {};
        const appId = Platform.OS === "ios" ? ios?.bundleIdentifier : android?.package;
        const apiUrl = remoteConfig?.trends_tracking_url ?? "https://trendings.app/api";
        (async () => {
            TrendingsTracker.init({apiUrl, appId});
            if ((await AsyncStorage.getItem("tr_is_first_launch_tracking")) != "true") {
                await AsyncStorage.setItem("tr_is_first_launch_tracking", "true");
                TrendingsTracker.trackInstall();
            }
        })();
    },

    initTikTokSDK: async (remoteConfigs: RemoteConfigSettings) => {
        if (!remoteConfigs?.tiktokads) return;
        const tkads = remoteConfigs?.tiktokads;
        if (!tkads.token || !tkads.appid || !tkads.tkappid) return;
        await TiktokAdsEvents.initializeSdk(tkads.token, tkads.appid, tkads.tkappid, tkads.isdebug);
        if (await TikTokWaitForConfig(10 * 1000)) {
            if (remoteConfigs?.rckey) await TiktokAdsEvents.identify(await Purchases.getAppUserID());
            await TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.launch_app);
            if ((await AsyncStorage.getItem("tk_is_first_launch")) != "true") {
                TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.install_app);
                await AsyncStorage.setItem("tk_is_first_launch", "true");
            }
        }
    },

    // Função para verificar e aplicar updates do HotUpdater
    maybeApplyUpdate: async (remoteConfigs: RemoteConfigSettings) => {
        if (!remoteConfigs?.hotupdater_url) return;
        const result = await HotUpdater.runUpdateProcess({
            source: getUpdateSource(remoteConfigs?.hotupdater_url, {
                updateStrategy: "appVersion",
            }),
        });
        if (result.status !== "UP_TO_DATE" && result.shouldForceUpdate && HotUpdater.isUpdateDownloaded()) {
            await HotUpdater.reload();
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

    updateMessagingTopic: async (appConfig: AppConfig, remoteConfigs?: RemoteConfigSettings) => {
        if (!remoteConfigs?.rckey) return;
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

    setupAttribution: async (remoteConfig: RemoteConfigSettings) => {
        if (!remoteConfig?.rckey) return;
        await Purchases.enableAdServicesAttributionTokenCollection();
        await Purchases.collectDeviceIdentifiers();
        await Purchases.setFBAnonymousID(await AppEventsLogger.getAnonymousID());
        await Purchases.setPushToken(await getToken(getMessaging(getApp())));
        await Purchases.setFirebaseAppInstanceID(await getAppInstanceId(getAnalytics(getApp())));
        await Purchases.setAttributes({TikTokGetAnonymousID: await TiktokAdsEvents.getAnonymousID()});
    },

    setupGlobalConfigs: async (appConfig?: any, remoteConfigs?: any) => {
        if (getExpoUtilsDisableWarnings(appConfig)) {
            (global as any).disableExpoUtilsWarnings = true;
        }
        if (getExpoUtilsDisableLogs(appConfig)) {
            (global as any).disableExpoUtilsLogs = true;
        }
        if (remoteConfigs.adunits) {
            (global as any).adUnits = remoteConfigs.adunits;
        }
        if (remoteConfigs.is_ads_enabled === false) {
            (global as any).isAdsEnabled = false;
        }
        (global as any).remoteConfigs = remoteConfigs;
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