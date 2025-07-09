// Firebase imports com fallback seguro
const getFirebaseApp = () => {
    try {
        const { getApp } = require("@react-native-firebase/app");
        return getApp();
    } catch (error) {
        console.warn("Firebase app not configured. Some features will be disabled.");
        return null;
    }
};

const getFirebaseRemoteConfig = () => {
    try {
        const { getRemoteConfig } = require("@react-native-firebase/remote-config");
        return getRemoteConfig;
    } catch (error) {
        console.warn("Firebase remote config not configured.");
        return null;
    }
};

const getFirebaseAnalytics = () => {
    try {
        const { getAnalytics, logEvent } = require('@react-native-firebase/analytics');
        return { getAnalytics, logEvent };
    } catch (error) {
        console.warn("Firebase analytics not configured.");
        return { getAnalytics: () => null, logEvent: () => {} };
    }
};

const getFirebaseMessaging = () => {
    try {
        const { getMessaging } = require('@react-native-firebase/messaging');
        return getMessaging;
    } catch (error) {
        console.warn("Firebase messaging not configured.");
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

const Utils = {
    getRemoteConfigSettings: async (): Promise<RemoteConfigSettings> => {
        const app = getFirebaseApp();
        const getRemoteConfig = getFirebaseRemoteConfig();
        
        if (!app || !getRemoteConfig) {
            console.warn("Firebase not configured, using default settings");
            return {
                is_ads_enabled: false,
                min_version: 1.0
            } as any;
        }

        const remoteConfig = getRemoteConfig(app);
        await remoteConfig.setConfigSettings({ minimumFetchIntervalMillis: 0 });
        await remoteConfig.setDefaults({
            settings: JSON.stringify({ is_ads_enabled: false }),
        });
        try {
            await remoteConfig.fetchAndActivate();
            return JSON.parse(remoteConfig.getValue("settings").asString());
        } catch (e) {
            return JSON.parse(remoteConfig.getValue("settings").asString());
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
        const getApp = getFirebaseApp();
        const { getAnalytics } = getFirebaseAnalytics();
        try {
            
            if (getApp && getAnalytics) {
                getAnalytics(getApp).logEvent("checking_update");
            }
            
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                if (getApp && getAnalytics) {
                    getAnalytics(getApp).logEvent("checking_update_success");
                }
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
            }
        } catch (e) {         
            if (getApp && getAnalytics) {
                getAnalytics(getApp).logEvent("checking_update_error", { error: e.message });
            }
        }
    },

    setupRevenueCat: async (revenueCatKeys?: { androidApiKey: string, iosApiKey: string }) => {
        try {
            if (!revenueCatKeys) {
                return;
            }
            
            const apiKey = Platform.OS === "android" 
                ? revenueCatKeys.androidApiKey
                : revenueCatKeys.iosApiKey;

            if (!apiKey) {
                console.warn('RevenueCat API key not found for platform:', Platform.OS);
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
                console.warn('Facebook App ID not found in app.config. Configure the react-native-fbsdk-next plugin.');
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
            console.warn('Clarity project ID not provided, skipping initialization.');
            return;
        }

        Clarity.initialize(clarityProjectId, {
            logLevel: Clarity.LogLevel.None, 
        });
    },

    setupPushNotifications: async (appConfig?: AppConfig) => {
        try {
            const app = getFirebaseApp();
            const getMessaging = getFirebaseMessaging();
            
            if (app && getMessaging) {
                getMessaging(app).onMessage(async (remoteMessage) => {
                    if (remoteMessage.notification) {
                        const messages = getLocalizedMessages();
                        Alert.alert(messages.newMessage, remoteMessage.notification.body);
                    }
                });
                
                const topicName = appConfig?.expo?.slug || 'default-topic';
                await getMessaging(app)
                    .subscribeToTopic(topicName)
                    .then(() => console.log("Subscribed to topic all!"))
                    .catch(() => console.log("Not Subscribed"));
            }
        } catch (error) {
            console.error('Error setting up push notifications:', error);
        }
    },

    checkForRequiredUpdateAsync: async (remoteConfigSettings: RemoteConfigSettings) => {
        try {
            if (!Application.nativeApplicationVersion) return;

            const version = parseFloat(Application.nativeApplicationVersion);
            const minVersion = parseFloat(remoteConfigSettings.min_version.toString());
            
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
                                // This recursive call might cause issues, re-alerting immediately.
                                // Consider a less aggressive update flow.
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

            if (adUnits) {
                (global as any).adUnits = adUnits;
            }

            await Utils.setupRevenueCat(revenueCatKeys);
            
            const remoteConfigs = await Utils.getRemoteConfigSettings();
            if(remoteConfigs.is_ads_enabled === false) {
                (global as any).isAdsEnabled = false;
            }
            (global as any).remoteConfigs = remoteConfigs;

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
            console.error("Error in prepare:", e);
        } finally {
            try {
                const app = getFirebaseApp();
                const getMessaging = getFirebaseMessaging();
                if (app && getMessaging) {
                    await getMessaging(app).requestPermission();
                }
                await Utils.setupPushNotifications(appConfig);
            } catch(e) {
                console.error("Error setting up notifications:", e);
            } finally {
                setAppIsReady(true);
                await SplashScreen.hideAsync();
            }
        }
    },
};

export default Utils; 