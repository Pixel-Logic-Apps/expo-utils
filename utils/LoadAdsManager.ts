import { StatusBar } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    AdEventListener,
    AdEventType,
    InterstitialAd,
    RewardedAd, RewardedAdEventType,
} from "react-native-google-mobile-ads";
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

type LoadAdsManagerType = {
    showInterstitial: (unitId?: string) => Promise<boolean>;
    showRewarded: (unitId?: string) => Promise<boolean>;
};

const getFirebaseApp = () => {
    try {
        const { getApp } = require("@react-native-firebase/app");
        return getApp();
    } catch (error) {
        console.warn("Firebase app not configured. Some features will be disabled.");
        return null;
    }
};

const LoadAdsManager: LoadAdsManagerType = {
    showInterstitial: (unitId?: string): Promise<boolean> => {
        return new Promise(async (resolve, reject) => {
            const isPremium = await AsyncStorage.getItem('@isPremium');
            if (isPremium === 'true') {
                resolve(true);
                return;
            }
            const app = getFirebaseApp();
            const analytics = app ? getAnalytics(app) : null;
            if(global.isAdsEnabled === false || global?.remoteConfigs?.is_ads_enabled === false){
                resolve(true);
                return;
            }
            const adUnits = (global as any).adUnits || {};
            const interstitialAdUnitId = unitId ?? adUnits.interstitial;
            const interstitial = InterstitialAd.createForAdRequest(
                interstitialAdUnitId,
                {}
            );
            const onAdLoaded: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdLOADED", e);
                interstitial.show().then();
            };
            const onAdClosed: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdCLOSED", e);
                StatusBar.setHidden(false);
                resolve(true);
            };
            const onAdOpened: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "OPENED", e);
                StatusBar.setHidden(true);
            };
            const onAdError: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdERROR", e);
                resolve(false);
            };
            interstitial.addAdEventListener(AdEventType.LOADED, onAdLoaded);
            interstitial.addAdEventListener(AdEventType.CLOSED, onAdClosed);
            interstitial.addAdEventListener(AdEventType.OPENED, onAdOpened);
            interstitial.addAdEventListener(AdEventType.ERROR, onAdError);
            interstitial.load();
        });
    },
    showRewarded: (unitId?: string): Promise<boolean> =>  {
        return new Promise(async (resolve, reject) => {
            const isPremium = await AsyncStorage.getItem('@isPremium');
            if (isPremium === 'true') {
                resolve(true);
                return;
            }
            const app = getFirebaseApp();
            const analytics = app ? getAnalytics(app) : null;
            if(global.isAdsEnabled === false || global?.remoteConfigs?.is_ads_enabled === false){
                resolve(true);
                return;
            }
            const adUnits = (global as any).adUnits || {};
            const adUnitId = unitId ?? adUnits.rewarded;
            const ad = RewardedAd.createForAdRequest(
                adUnitId,
                {}
            );
            const onAdLoaded: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdLOADED", e);
                ad.show().then();
            };
            const onAdClosed: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdCLOSED", e);
                StatusBar.setHidden(false);
                resolve(false);
            };
            const onEarnedReward: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "REWARDED", e);
                StatusBar.setHidden(true);
                resolve(true);
            };
            const onAdOpened: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "OPENED", e);
                StatusBar.setHidden(true);
            };
            const onAdError: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdERROR", e);
                resolve(false);
            };
            ad.addAdEventListener(RewardedAdEventType.LOADED, onAdLoaded);
            ad.addAdEventListener(AdEventType.CLOSED, onAdClosed);
            ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onEarnedReward);
            ad.addAdEventListener(AdEventType.OPENED, onAdOpened);
            ad.addAdEventListener(AdEventType.ERROR, onAdError);
            ad.load();
        });
    }
};

export default LoadAdsManager;
