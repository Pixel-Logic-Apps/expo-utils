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

// Helper para importação segura de peer dependencies usando require
const safeRequire = (moduleName: string) => {
    try {
        return require(moduleName);
    } catch (error) {
        console.warn(`${moduleName} not found. Make sure it's installed in your project.`);
        return null;
    }
};

// Funções para importação de dependências
const getSplashScreen = () => safeRequire('expo-splash-screen');
const getReactNative = () => safeRequire('react-native');
const getTracking = () => safeRequire('expo-tracking-transparency');
const getUpdates = () => safeRequire('expo-updates');
const getApplication = () => safeRequire('expo-application');
const getFbsdk = () => safeRequire('react-native-fbsdk-next');
const getPurchases = () => safeRequire('react-native-purchases');
const getClarity = () => safeRequire('@microsoft/react-native-clarity');

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
            const fetchedRemotely = await remoteConfig.fetchAndActivate();
            return JSON.parse(remoteConfig.getValue("settings").asString());
        } catch (e) {
            return JSON.parse(remoteConfig.getValue("settings").asString());
        }
    },

    setupAttributions: async () => {
        try {
            const Purchases = getPurchases();
            const Fbsdk = getFbsdk();
            if (!Purchases || !Fbsdk) return;
            
            await Purchases.enableAdServicesAttributionTokenCollection()
            await Purchases.collectDeviceIdentifiers()
            
            const anonymousId = await Fbsdk.AppEventsLogger.getAnonymousID()
            if (anonymousId) {
                await Purchases.setFBAnonymousID(anonymousId)
            }
        } catch (error) {
            console.error('Error setting up attributions:', error);
        }
    },

    didUpdate: async () => {
        try {
            const Updates = getUpdates();
            if (!Updates) return;

            const app = getFirebaseApp();
            const { getAnalytics, logEvent } = getFirebaseAnalytics();
            
            if (app && getAnalytics) {
                const analytics = getAnalytics(app);
                logEvent(analytics, "checking_update");
            }
            
            const update = await Updates.checkForUpdateAsync()
            if (update.isAvailable) {
                if (app && getAnalytics) {
                    const analytics = getAnalytics(app);
                    logEvent(analytics, "checking_update_success");
                }
                await Updates.fetchUpdateAsync()
                await Updates.reloadAsync()
            }
        } catch (e) {
            const app = getFirebaseApp();
            const { getAnalytics, logEvent } = getFirebaseAnalytics();
            
            if (app && getAnalytics) {
                const analytics = getAnalytics(app);
                logEvent(analytics, "checking_update_error");
            }
        }
    },

    setupRevenueCat: async (revenueCatKeys?: { androidApiKey: string, iosApiKey: string }) => {
        try {
            const ReactNative = getReactNative();
            const Purchases = getPurchases();
            if (!ReactNative || !Purchases) return;

            const platform = ReactNative.Platform.OS;
            
            if (!revenueCatKeys) {
                console.warn('RevenueCat keys not provided, skipping configuration');
                return;
            }
            
            const apiKey = platform === "android" 
                ? revenueCatKeys.androidApiKey
                : revenueCatKeys.iosApiKey;

            if (!apiKey) {
                console.warn('RevenueCat API key not found for platform:', platform);
                return;
            }
            
            Purchases.configure({ apiKey });
        } catch (error) {
            console.error('Error setting up RevenueCat:', error);
        }
    },

    initFBSDK: async (appConfig?: AppConfig) => {
        try {
            const Fbsdk = getFbsdk();
            if (!Fbsdk) return;
            const { Settings, AppEventsLogger } = Fbsdk;

            Settings.initializeSDK();
            const fbConfig = appConfig?.expo?.plugins?.find((plugin: any) => 
                Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next'
            );
            const appID = fbConfig?.[1]?.appID;
            
            if (!appID) {
                console.warn('Facebook App ID not found in app.config. Configure the react-native-fbsdk-next plugin.');
                return;
            }
            Settings.setAppID(appID);
            Settings.setAdvertiserIDCollectionEnabled(true)
            await Settings.setAdvertiserTrackingEnabled(false)
            Settings.setAutoLogAppEventsEnabled(false)
            AppEventsLogger.logEvent("app_started")
            AppEventsLogger.logEvent("fb_mobile_launch_source")
        } catch (error) {
            console.error('Error setting up Facebook SDK:', error);
        }
    },


    setupClarity: async (clarityProjectId?: string) => {
        const Clarity = getClarity();
        if (!Clarity) return;

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
            const ReactNative = getReactNative();
            const app = getFirebaseApp();
            const getMessaging = getFirebaseMessaging();
            
            if (app && getMessaging) {
                getMessaging(app).onMessage(async (remoteMessage) => {
                    if (remoteMessage.notification && ReactNative?.Alert) {
                        const messages = getLocalizedMessages();
                        ReactNative.Alert.alert(messages.newMessage, remoteMessage.notification.body);
                    }
                });
                
                const topicName = appConfig?.expo?.slug || 'default-topic';
                await getMessaging(app)
                    .subscribeToTopic(topicName)
                    .then(() => console.log("Subscribed to topic all!"))
                    .catch(() => console.log("Not Subscribed"));
            } else {
                console.log("Firebase messaging not available");
            }
        } catch (error) {
            console.error('Error setting up push notifications:', error);
        }
    },

    checkForRequiredUpdateAsync: async (remoteConfigSettings: RemoteConfigSettings) => {
        try {
            const Application = getApplication();
            if (!Application || !Application.nativeApplicationVersion) return;

            const version = parseFloat(Application.nativeApplicationVersion);
            const minVersion = parseFloat(remoteConfigSettings.min_version.toString())
            console.log('App Version:', version);
            console.log('App Remote Min Version:', minVersion);

            if (minVersion === null || minVersion === undefined || isNaN(minVersion) || isNaN(version)) {
                return
            }
            
            console.log('Minimum version:', remoteConfigSettings.min_version);
            console.log('native Application  version:', Application.nativeApplicationVersion);

            if (Application.nativeApplicationVersion >= remoteConfigSettings.min_version.toString()) {
                return
            }

            const ReactNative = getReactNative();
            if (!ReactNative?.Alert || !ReactNative?.Platform) return;

            const messages = getLocalizedMessages();
            const AsyncAlert = async () =>
                new Promise((resolve) => {
                    ReactNative.Alert.alert(
                        messages.updateRequired,
                        messages.updateMessage,
                        [{
                            text: messages.updateNow,
                            onPress: () => {
                                const url = ReactNative.Platform.OS === 'android' ?
                                    `https://play.google.com/store/apps/details?id=${Application.applicationId}` :
                                    `https://apps.apple.com/app/${remoteConfigSettings.ios_app_id}`;
                                ReactNative.Linking.openURL(url);
                                Utils.checkForRequiredUpdateAsync(remoteConfigSettings)
                            },
                        }],
                        { cancelable: false },
                    );
                });
            await AsyncAlert()
        } catch (error) {
            console.error('Error checking for required update:', error);
        }
    },

    prepare: async (
        setAppIsReady: (ready: boolean) => void, 
        appConfig?: AppConfig,
        revenueCatKeys?: { androidApiKey: string, iosApiKey: string },
        clarityProjectId?: string
    ) => {
        try {
            const Tracking = getTracking();
            if (!Tracking) { // Se o tracking não estiver disponível, seguimos sem ele
                console.warn('expo-tracking-transparency not found, skipping tracking permission request.');
                await Utils.continuePrepare(setAppIsReady, appConfig);
                return;
            }

            await Utils.setupRevenueCat(revenueCatKeys);
            
            const remoteConfigs = await Utils.getRemoteConfigSettings();
            if(remoteConfigs.is_ads_enabled === false) {
                (global as any).isAdsEnabled = false
            }
            (global as any).remoteConfigs = remoteConfigs;

            await Utils.didUpdate();
            await Utils.checkForRequiredUpdateAsync(remoteConfigs)
            await Utils.initFBSDK(appConfig);
            await Utils.setupClarity(clarityProjectId);
            await Utils.setupAttributions();
            
            Tracking.requestTrackingPermissionsAsync().finally(async () => {
                await Utils.continuePrepare(setAppIsReady, appConfig);
            });
            
        } catch (e) {
            console.error("Error in prepare:", e);
            setAppIsReady(true);
            const SplashScreen = getSplashScreen();
            if (SplashScreen) await SplashScreen.hideAsync();
        }
    },

    continuePrepare: async (
        setAppIsReady: (ready: boolean) => void,
        appConfig?: AppConfig
    ) => {
        try {
            const app = getFirebaseApp();
            const getMessaging = getFirebaseMessaging();

            const finalize = async () => {
                await Utils.setupPushNotifications(appConfig || { expo: { slug: 'default-topic' } });
                setAppIsReady(true);
                const SplashScreen = getSplashScreen();
                if (SplashScreen) await SplashScreen.hideAsync();
            };
            
            if (app && getMessaging) {
                await getMessaging(app).requestPermission().finally(finalize);
            } else {
                await finalize();
            }
        } catch(e) {
            console.error("Error in continuePrepare:", e);
            setAppIsReady(true);
            const SplashScreen = getSplashScreen();
            if (SplashScreen) await SplashScreen.hideAsync();
        }
    }
};

export default Utils; 