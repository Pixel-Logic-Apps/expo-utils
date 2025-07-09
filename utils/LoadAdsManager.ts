import { StatusBar } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    AdEventListener,
    AdEventType,
    InterstitialAd,
    RewardedAd, RewardedAdEventType,
} from "react-native-google-mobile-ads";
import AdUnits from '../constants/Strings';

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

const getFirebaseAnalytics = () => {
    try {
        const { getAnalytics } = require('@react-native-firebase/analytics');
        return { getAnalytics };
    } catch (error) {
        console.warn("Firebase analytics not configured.");
        return { getAnalytics: () => null, logEvent: () => {} };
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

            const getApp = getFirebaseApp();
            const { getAnalytics } = getFirebaseAnalytics();

            

            if(global.isAdsEnabled === false || global?.remoteConfigs?.is_ads_enabled === false){
                resolve(true);
                return;
            }
                
            const interstitialAdUnitId = unitId ?? AdUnits.interstitial;
            const interstitial = InterstitialAd.createForAdRequest(
                interstitialAdUnitId,
                {}
            );

            const onAdLoaded: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("AdLOADED",e).then();
                interstitial.show().then();
            };

            const onAdClosed: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("AdCLOSED", e).then();
                StatusBar.setHidden(false);
                resolve(true);
            };

            const onAdOpened: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("OPENED", e).then();
                StatusBar.setHidden(true);
            };

            const onAdError: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("AdERROR", e).then();
                console.log("AdERROR", e);
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
            const getApp = getFirebaseApp();
            const { getAnalytics } = getFirebaseAnalytics();

            if(global.isAdsEnabled === false || global?.remoteConfigs?.is_ads_enabled === false){
                resolve(true);
                return;
            }

            const adUnitId = unitId ?? AdUnits.rewarded;
            const ad = RewardedAd.createForAdRequest(
                adUnitId,
                {}
            );

            const onAdLoaded: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("AdLOADED", e).then();
                ad.show().then();
            };

            const onAdClosed: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("AdCLOSED", e).then();
                StatusBar.setHidden(false);
                resolve(false);
            };


            const onEarnedReward: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("REWARDED", e).then();
                StatusBar.setHidden(true);
                resolve(true);
            };

            const onAdOpened: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("OPENED", e).then();
                StatusBar.setHidden(true);
            };

            const onAdError: AdEventListener = (e) => {
                getAnalytics(getApp).logEvent("AdERROR", e).then();
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
