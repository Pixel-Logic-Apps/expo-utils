/// <reference path="../types/peer-deps.d.ts" />
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

// Firebase imports com fallback seguro
const getFirebaseApp = () => {
    try {
        const {getApp} = require("@react-native-firebase/app");
        return getApp();
    } catch (error) {
        expoUtilsWarn("Firebase app not configured. Some features will be disabled.");
        return null;
    }
};

import {AppConfig, RemoteConfigSettings} from "./types";
import {getLocalizedMessages} from "./i18n";
import {getLocales} from "expo-localization";

// Static imports for runtime dependencies
import {requestTrackingPermissionsAsync} from "expo-tracking-transparency";
import * as Application from "expo-application";
import {AppEventsLogger, Settings as FbsdkSettings} from "react-native-fbsdk-next";
import Purchases from "react-native-purchases";
import * as SplashScreen from "expo-splash-screen";
import {Alert, Platform} from "react-native";
// Importações modulares do Firebase
import {
    getRemoteConfig,
    setConfigSettings,
    setDefaults,
    fetchAndActivate,
    getValue,
} from "@react-native-firebase/remote-config";
import {getMessaging, requestPermission, onMessage, subscribeToTopic} from "@react-native-firebase/messaging";
import {getAnalytics, logEvent} from "@react-native-firebase/analytics";

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
        const app = getFirebaseApp();
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

    setupAttributions: async (clarityProjectId?: string) => {
        try {

            await Purchases.enableAdServicesAttributionTokenCollection();
            await Purchases.collectDeviceIdentifiers();

            const anonymousId = await AppEventsLogger.getAnonymousID();
            if (anonymousId) {
                await Purchases.setFBAnonymousID(anonymousId);
            }

            if(clarityProjectId){
                const Clarity = require("@microsoft/react-native-clarity");
                Clarity.setCustomUserId(anonymousId || ""); 
            }

        } catch (error) {
            console.error("Error setting up attributions:", error);
        }
    },

    didUpdate: async () => {
        const app = getFirebaseApp();
        if (!app) return;
        const analytics = getAnalytics(app);
        try {
            await logEvent(analytics, "checking_update");
            const Updates = require("expo-updates");
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                await logEvent(analytics, "checking_update_success");
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
            }
        } catch (e) {
            expoUtilsWarn("expo-updates is not installed. Skipping update check.");
            await logEvent(analytics, "checking_update_error", {error: e?.message});
        }
    },

    setupRevenueCat: async (revenueCatKeys?: {androidApiKey: string; iosApiKey: string}) => {
        try {
            if (!revenueCatKeys) {
                expoUtilsWarn("RevenueCat keys not provided, skipping configuration");
                return;
            }

            const apiKey = Platform.OS === "android" ? revenueCatKeys.androidApiKey : revenueCatKeys.iosApiKey;

            if (!apiKey) {
                expoUtilsWarn("RevenueCat API key not found for platform:", Platform.OS);
                return;
            }

            Purchases.configure({apiKey});
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

    setupClarity: async (clarityProjectId?: string) => {
        if (!clarityProjectId) {
            expoUtilsWarn("Clarity project ID not provided, skipping initialization.");
            return;
        }
        try {
            const Clarity = require("@microsoft/react-native-clarity");
            Clarity.initialize(clarityProjectId, { logLevel: Clarity.LogLevel.None });
        } catch {}
    },

    setupPushNotifications: async (appConfig?: AppConfig) => {
        try {
            const app = getFirebaseApp();
            if (app) {
                const messaging = getMessaging(app);
                onMessage(messaging, async (remoteMessage) => {
                    if (remoteMessage.notification) {
                        const languageCode = getLocales()[0]?.languageCode ?? "en";
                        const messages = getLocalizedMessages(languageCode);
                        Alert.alert(messages.newMessage, remoteMessage.notification.body);
                    }
                });
                const topicName = appConfig?.expo?.slug || "default-topic";
                await subscribeToTopic(messaging, topicName)
                    .then(() => expoUtilsWarn("Subscribed to topic:", topicName))
                    .catch(() => expoUtilsWarn("Failed to subscribe to topic:", topicName));
            }
        } catch (error) {
            console.error("Error setting up push notifications:", error);
        }
    },

    checkForRequiredUpdateAsync: async (remoteConfigSettings: RemoteConfigSettings) => {
        try {

            if (!Application.nativeApplicationVersion) return;
            const version = parseFloat(Application.nativeApplicationVersion);
            const minVersion = parseFloat((remoteConfigSettings?.min_version ?? 0).toString());

            if (isNaN(minVersion) || isNaN(version) || version >= minVersion) {
                return;
            }

            const languageCode = getLocales()[0]?.languageCode ?? "en";
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
                require("react-native").Linking.openURL(url);
            };

            const present = () => {
                Alert.alert(
                    messages.updateRequired,
                    messages.updateMessage,
                    [{text: messages.updateNow, onPress: async () => { await openStore(); present(); }}],
                    {cancelable: false},
                );
            };
            present();

        } catch (error) {
            console.error("Error checking for required update:", error);
        }
    },

    prepare: async (
        setAppIsReady: (ready: boolean) => void,
        appConfig?: any,
        adUnits?: any,
        revenueCatKeys?: {androidApiKey: string; iosApiKey: string},
        clarityProjectId?: string,
    ) => {
        try {
            const remoteConfigs = await Utils.getRemoteConfigSettings();
            await Utils.setupGlobalConfigs(appConfig, adUnits, remoteConfigs);
            await Utils.setupRevenueCat(revenueCatKeys);
            await Utils.didUpdate();
            await Utils.checkForRequiredUpdateAsync(remoteConfigs);
            await Utils.initFBSDK(appConfig);
            await Utils.setupClarity(clarityProjectId);
            if (revenueCatKeys) {
                await Utils.setupAttributions(clarityProjectId);
            }
            await requestTrackingPermissionsAsync();
            // After the user grants or denies permission, Facebook SDK will automatically handle it
            // via the setAdvertiserTrackingEnabled call made during init.
            // No need for a separate setAdvertiserIDCollectionEnabled call here.
        } catch (e) {
            expoUtilsWarn("Error in prepare:", e);
        } finally {
            try {
                const app = getFirebaseApp();
                if (app) {
                    const messaging = getMessaging(app);
                    await requestPermission(messaging);
                }
                await Utils.setupPushNotifications(appConfig);
            } catch (e) {
                expoUtilsWarn("Error setting up notifications:", e);
            } finally {
                setAppIsReady(true);
            }
        }
    },

    setupGlobalConfigs: async (appConfig?: any, adUnits?: any, remoteConfigs?: any) => {
        if (getExpoUtilsDisableWarnings(appConfig)) {
            (global as any).disableExpoUtilsWarnings = true;
        }
        if (getExpoUtilsDisableLogs(appConfig)) {
            (global as any).disableExpoUtilsLogs = true;
        }
        if (adUnits) {
            (global as any).adUnits = adUnits;
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
                await require("react-native").Linking.openURL(storeUrl);
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
                await require("react-native").Linking.openURL(storeUrl);
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
