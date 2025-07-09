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
        const { getApp } = require("@react-native-firebase/app");
        return getApp();
    } catch (error) {
        expoUtilsWarn("Firebase app not configured. Some features will be disabled.");
        return null;
    }
};

const getFirebaseRemoteConfig = () => {
    try {
        const { getRemoteConfig } = require("@react-native-firebase/remote-config");
        return getRemoteConfig;
    } catch (error) {
        expoUtilsWarn("Firebase remote config not configured.");
        return null;
    }
};

const getFirebaseAnalytics = () => {
    try {
        const { getAnalytics, logEvent } = require('@react-native-firebase/analytics');
        return { getAnalytics, logEvent };
    } catch (error) {
        expoUtilsWarn("Firebase analytics not configured.");
        return { getAnalytics: () => null, logEvent: () => {} };
    }
};

const getFirebaseMessaging = () => {
    try {
        const { getMessaging } = require('@react-native-firebase/messaging');
        return getMessaging;
    } catch (error) {
        expoUtilsWarn("Firebase messaging not configured.");
        return () => ({ 
            onMessage: () => {},
            requestPermission: () => Promise.resolve(),
            subscribeToTopic: () => Promise.resolve()
        });
    }
};

import { AppConfig, RemoteConfigSettings } from './types';
import { getLocalizedMessages } from './i18n';

// Static imports for runtime dependencies
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import { AppEventsLogger, Settings as FbsdkSettings } from 'react-native-fbsdk-next';
import Purchases from 'react-native-purchases';
import * as Clarity from '@microsoft/react-native-clarity';
import * as SplashScreen from 'expo-splash-screen';
import { Alert, Platform, Linking } from 'react-native';
// Importações modulares do Firebase
import {
    getRemoteConfig,
    setConfigSettings,
    setDefaults,
    fetchAndActivate,
    getValue
} from '@react-native-firebase/remote-config';
import {
    getMessaging,
    requestPermission,
    onMessage,
    subscribeToTopic
} from '@react-native-firebase/messaging';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import fs from 'fs';
import path from 'path';

function getExpoUtilsDisableWarnings(appConfig?: any): boolean {
    if (!appConfig?.expo?.plugins) return false;
    const plugins = appConfig.expo.plugins;
    for (const plugin of plugins) {
        if (Array.isArray(plugin) && plugin[0] === 'expo-utils' && plugin[1]?.disableWarnings === true) {
            return true;
        }
        if (plugin === 'expo-utils') {
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
        if (Array.isArray(plugin) && plugin[0] === 'expo-utils' && plugin[1]?.disableLogs === true) {
            return true;
        }
        if (plugin === 'expo-utils') {
            // Se for só a string, não desabilita logs
            continue;
        }
    }
    return false;
}


const Utils = {
    getRemoteConfigSettings: async (): Promise<RemoteConfigSettings> => {
        const app = getFirebaseApp();
        if (!app) {
            expoUtilsWarn("Firebase not configured, using default settings");
            return {
                is_ads_enabled: false,
                min_version: 1.0
            } as any;
        }
        const remoteConfig = getRemoteConfig(app);
        await setConfigSettings(remoteConfig, { minimumFetchIntervalMillis: 0 });
        await setDefaults(remoteConfig, {
            settings: JSON.stringify({ is_ads_enabled: false }),
        });
        try {
            await fetchAndActivate(remoteConfig);
            return JSON.parse(getValue(remoteConfig, "settings").asString());
        } catch (e) {
            return JSON.parse(getValue(remoteConfig, "settings").asString());
        }
    },

    setupAttributions: async () => {
        
        try {
            await Purchases.enableAdServicesAttributionTokenCollection();
            await Purchases.collectDeviceIdentifiers();
            const anonymousId = await AppEventsLogger.getAnonymousID();
            if (anonymousId) {
                await Purchases.setFBAnonymousID(anonymousId);
            }
        } catch (error) {
            console.error('Error setting up attributions:', error);
        }
    },

    didUpdate: async () => {
        const app = getFirebaseApp();
        if (!app) return;
        const analytics = getAnalytics(app);
        try {
            await logEvent(analytics, "checking_update");
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                await logEvent(analytics, "checking_update_success");
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
            }
        } catch (e) {
            await logEvent(analytics, "checking_update_error", { error: e?.message });
        }
    },

    setupRevenueCat: async (revenueCatKeys?: { androidApiKey: string, iosApiKey: string }) => {
        try {
            if (!revenueCatKeys) {
                expoUtilsWarn('RevenueCat keys not provided, skipping configuration');
                return;
            }
            
            const apiKey = Platform.OS === "android" 
                ? revenueCatKeys.androidApiKey
                : revenueCatKeys.iosApiKey;

            if (!apiKey) {
                expoUtilsWarn('RevenueCat API key not found for platform:', Platform.OS);
                return;
            }
            
            Purchases.configure({ apiKey });
        } catch (error) {
            console.error('Error setting up RevenueCat:', error);
        }
    },

    initFBSDK: async (appConfig?: AppConfig) => {
        try {
            FbsdkSettings.initializeSDK();
            const fbConfig = appConfig?.expo?.plugins?.find((plugin: any) => 
                Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next'
            );
            const appID = fbConfig?.[1]?.appID;
            
            if (!appID) {
                expoUtilsWarn('Facebook App ID not found in app.config. Configure the react-native-fbsdk-next plugin.');
                return;
            }
            FbsdkSettings.setAppID(appID);
            await FbsdkSettings.setAdvertiserTrackingEnabled(true);
        } catch (error) {
            console.error('Error setting up Facebook SDK:', error);
        }
    },


    setupClarity: async (clarityProjectId?: string) => {
        if (!clarityProjectId) {
            expoUtilsWarn('Clarity project ID not provided, skipping initialization.');
            return;
        }

        Clarity.initialize(clarityProjectId, {
            logLevel: Clarity.LogLevel.None, 
        });
    },

    setupPushNotifications: async (appConfig?: AppConfig) => {
        try {
            const app = getFirebaseApp();
            if (app) {
                const messaging = getMessaging(app);
                onMessage(messaging, async (remoteMessage) => {
                    if (remoteMessage.notification) {
                        const messages = getLocalizedMessages();
                        Alert.alert(messages.newMessage, remoteMessage.notification.body);
                    }
                });
                const topicName = appConfig?.expo?.slug || 'default-topic';
                await subscribeToTopic(messaging, topicName)
                    .then(() => expoUtilsWarn("Subscribed to topic:", topicName))
                    .catch(() => expoUtilsWarn("Failed to subscribe to topic:", topicName));
            }
        } catch (error) {
            console.error('Error setting up push notifications:', error);
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
            const messages = getLocalizedMessages();
            const AsyncAlert = () =>
                new Promise<void>((resolve) => {
                    Alert.alert(
                        messages.updateRequired,
                        messages.updateMessage,
                        [{
                            text: messages.updateNow,
                            onPress: () => {
                                const url = Platform.OS === 'android' ?
                                    `https://play.google.com/store/apps/details?id=${Application.applicationId}` :
                                    `https://apps.apple.com/app/${remoteConfigSettings.ios_app_id}`;
                                Linking.openURL(url);
                                resolve();
                            },
                        }],
                        { cancelable: false },
                    );
                });
            await AsyncAlert();
        } catch (error) {
            console.error('Error checking for required update:', error);
        }
    },

    prepare: async (
        setAppIsReady: (ready: boolean) => void, 
        appConfig?: any,
        adUnits?: any,
        revenueCatKeys?: { androidApiKey: string, iosApiKey: string },
        clarityProjectId?: string
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
                await Utils.setupAttributions();
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
            } catch(e) {
                expoUtilsWarn("Error setting up notifications:", e);
            } finally {
                setAppIsReady(true);
                await SplashScreen.hideAsync();
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
        if(remoteConfigs.is_ads_enabled === false) {
            (global as any).isAdsEnabled = false;
        }
        (global as any).remoteConfigs = remoteConfigs;
    },

    openReviewURL: async (preferNativeStore = true) => {
        try {
            if (Platform.OS === 'android') {
                const packageName = Application.applicationId;
                if (!packageName) {
                    expoUtilsWarn('Android package name could not be detected automatically');
                    return false;
                }
                
                const storeUrl = preferNativeStore
                    ? `market://details?id=${packageName}&showAllReviews=true`
                    : `https://play.google.com/store/apps/details?id=${packageName}&showAllReviews=true`;
                
                expoUtilsLog('Opening Android review URL:', storeUrl);
                await Linking.openURL(storeUrl);
                return true;
                
            } else if (Platform.OS === 'ios') {
                const iosAppId = (global as any).remoteConfigs?.ios_app_id;
                if (!iosAppId) {
                    expoUtilsWarn('iOS App ID not found in remote configs. Make sure ios_app_id is configured in Firebase Remote Config.');
                    return false;
                }
                
                const storeUrl = preferNativeStore
                    ? `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${iosAppId}?action=write-review`
                    : `https://apps.apple.com/app/apple-store/id${iosAppId}?action=write-review`;
                
                expoUtilsLog('Opening iOS review URL:', storeUrl);
                await Linking.openURL(storeUrl);
                return true;
            } else {
                expoUtilsWarn('Platform not supported for review URL:', Platform.OS);
                return false;
            }
        } catch (error) {
            console.error('Error opening review URL:', error);
            return false;
        }
    }
};

export default Utils; 