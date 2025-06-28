import { getApp } from "@react-native-firebase/app";
import { getRemoteConfig } from "@react-native-firebase/remote-config";
import { AppConfig, RemoteConfigSettings } from './types';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { getMessaging } from '@react-native-firebase/messaging';
// Dependências são importadas dinamicamente
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import * as Updates from 'expo-updates';
// React Native será importado dinamicamente
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import Purchases from 'react-native-purchases';

import { getLocalizedMessages } from './i18n';

// Helper para imports dinâmicos seguros de peer dependencies
const dynamicImport = async (moduleName: string) => {
    try {
        return await import(moduleName);
    } catch (error) {
        console.warn(`${moduleName} not found. Make sure it's installed in your project.`);
        return null;
    }
};

// Funções para importação dinâmica de dependências peer
const getApplication = () => dynamicImport('expo-application');
const getSplashScreen = () => dynamicImport('expo-splash-screen');
const getReactNative = () => dynamicImport('react-native');


const Utils = {
    getRemoteConfigSettings: async (): Promise<RemoteConfigSettings> => {
        const remoteConfig = getRemoteConfig(getApp());
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
            await Purchases.enableAdServicesAttributionTokenCollection()
            await Purchases.collectDeviceIdentifiers()
            
            const anonymousId = await AppEventsLogger.getAnonymousID()
            if (anonymousId) {
                await Purchases.setFBAnonymousID(anonymousId)
            }
        } catch (error) {
            console.error('Error setting up attributions:', error);
        }
    },

    didUpdate: async () => {
        try {
            const analytics = getAnalytics(getApp());
            logEvent(analytics, "checking_update");
            
            const update = await Updates.checkForUpdateAsync()
            if (update.isAvailable) {
                logEvent(analytics, "checking_update_success");
                await Updates.fetchUpdateAsync()
                await Updates.reloadAsync()
            }
        } catch (e) {
            const analytics = getAnalytics(getApp());
            logEvent(analytics, "checking_update_error");
        }
    },

    setupRevenueCat: async (appConfig?: AppConfig) => {
        try {
            const ReactNative = await getReactNative();
            const platform = ReactNative?.Platform?.OS || 'ios';
            
            // Busca configurações do RevenueCat no appConfig
            const purchasesConfig = appConfig?.expo?.plugins?.find((plugin: any) => 
                Array.isArray(plugin) && plugin[0] === 'react-native-purchases'
            );
            
            const apiKey = platform === "android" 
                ? purchasesConfig?.[1]?.androidApiKey
                : purchasesConfig?.[1]?.iosApiKey;

            if (!apiKey) {
                console.warn('RevenueCat API key not found in app.config. Configure the react-native-purchases plugin.');
                return;
            }
            
            Purchases.configure({ apiKey });
        } catch (error) {
            console.error('Error setting up RevenueCat:', error);
        }
    },

    initFBSDK: async (appConfig?: AppConfig) => {
        try {
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

    setupPushNotifications: async (appConfig?: AppConfig) => {
        try {
            const ReactNative = await getReactNative();
            
            getMessaging(getApp()).onMessage(async (remoteMessage) => {
                if (remoteMessage.notification && ReactNative?.Alert) {
                    const messages = getLocalizedMessages();
                    ReactNative.Alert.alert(messages.newMessage, remoteMessage.notification.body);
                }
            });
            
            const topicName = appConfig?.expo?.slug || 'default-topic';
            await getMessaging(getApp())
                .subscribeToTopic(topicName)
                .then(() => console.log("Subscribed to topic all!"))
                .catch(() => console.log("Not Subscribed"));
        } catch (error) {
            console.error('Error setting up push notifications:', error);
        }
    },

    checkForRequiredUpdateAsync: async (remoteConfigSettings: RemoteConfigSettings) => {
        try {
            const Application = await getApplication();
            if (!Application) return;

            const version = parseFloat(Application.nativeApplicationVersion);
            const minVersion = parseFloat(remoteConfigSettings.min_version.toString())
            console.log('App Version:', version);
            console.log('App Remote Min Version:', minVersion);

            if (minVersion === null || minVersion === undefined) {
                return
            }
            if (isNaN(minVersion) || isNaN(version)) {
                return
            }
            console.log('Minimum version:', remoteConfigSettings.min_version);
            console.log('native Application  version:', Application.nativeApplicationVersion);

            if (Application.nativeApplicationVersion >= remoteConfigSettings.min_version.toString()) {
                return
            }

            const ReactNative = await getReactNative();
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
                                    "https://play.google.com/store/apps/details?id=" + Application.applicationId :
                                    "https://apps.apple.com/app/" + remoteConfigSettings.ios_app_id;
                                alert(url);
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

    prepare: async (setAppIsReady: (ready: boolean) => void, appConfig?: AppConfig) => {
        try {

            await Utils.setupRevenueCat(appConfig);
            
            const remoteConfigs = await Utils.getRemoteConfigSettings();
            if(remoteConfigs.is_ads_enabled === false) {
                (global as any).isAdsEnabled = false
            }
            (global as any).remoteConfigs = remoteConfigs;

            await Utils.didUpdate();
            await Utils.checkForRequiredUpdateAsync(remoteConfigs)
            await Utils.initFBSDK(appConfig);
            await Utils.setupAttributions();
            
            requestTrackingPermissionsAsync().finally(async () => {
                await getMessaging(getApp()).requestPermission().finally(async () => {
                    await Utils.setupPushNotifications(appConfig || { expo: { slug: 'default-topic' } });
                    setAppIsReady(true);
                    const SplashScreen = await getSplashScreen();
                    if (SplashScreen) await SplashScreen.hideAsync();
                });
            });
            
        } catch (e) {
            console.log("error----------------------------->>>>", e);
            console.error(e);
            setAppIsReady(true);
            const SplashScreen = await getSplashScreen();
            if (SplashScreen) await SplashScreen.hideAsync();
            requestTrackingPermissionsAsync().finally(async () => {
                await getMessaging(getApp()).requestPermission().finally(async () => {
                    await Utils.setupPushNotifications(appConfig || { expo: { slug: 'default-topic' } });
                });
            });
        }
    }
};

export default Utils; 