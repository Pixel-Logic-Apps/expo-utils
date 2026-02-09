import {StatusBar} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    AdEventListener,
    AdEventType,
    InterstitialAd,
    RewardedAd,
    RewardedAdEventType,
} from "react-native-google-mobile-ads";
import {getAnalytics, logEvent} from "@react-native-firebase/analytics";
import {expoUtilsWarn, expoUtilsLog} from "./Utils";
import {generatePlacementId, isPlacementBlocked} from "./AdPlacementTracker";

type LoadAdsManagerType = {
    showInterstitial: (unitId?: string, tag?: string) => Promise<boolean>;
    showRewarded: (unitId?: string, tag?: string) => Promise<boolean>;
};

const getFirebaseApp = () => {
    try {
        const {getApp} = require("@react-native-firebase/app");
        return getApp();
    } catch (error) {
        expoUtilsWarn("Firebase app not configured. Some features will be disabled.");
        return null;
    }
};

const LoadAdsManager: LoadAdsManagerType = {
    showInterstitial: (unitId?: string, tag?: string): Promise<boolean> => {
        return new Promise(async (resolve, reject) => {
            const placementId = generatePlacementId("interstitial", tag);

            if (isPlacementBlocked(placementId)) {
                expoUtilsLog(`[expo-utils] Interstitial blocked: ${placementId}`);
                resolve(true);
                return;
            }

            const isPremium = await AsyncStorage.getItem("@isPremium");
            expoUtilsLog("isPremium", isPremium);
            if (isPremium === "true") {
                resolve(true);
                return;
            }
            const app = getFirebaseApp();
            const analytics = app ? getAnalytics(app) : null;
            if (global.isAdsEnabled === false || global?.remoteConfigs?.is_ads_enabled === false) {
                resolve(true);
                return;
            }
            expoUtilsLog("isAdsEnabled", global.isAdsEnabled);
            const adUnits = (global as any).adUnits || {};
            expoUtilsLog("interstitialUnitIds", adUnits);

            const interstitialAdUnitId = unitId ?? adUnits.interstitial;
            const interstitial = InterstitialAd.createForAdRequest(interstitialAdUnitId, {});
            const onAdLoaded: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdLOADED", {...(e as any), placementId});
                interstitial.show().then();
            };
            const onAdClosed: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdCLOSED", {...(e as any), placementId});
                StatusBar.setHidden(false);
                resolve(true);
            };
            const onAdOpened: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "OPENED", {...(e as any), placementId});
                StatusBar.setHidden(true);
            };
            const onAdError: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdERROR", {...(e as any), placementId});
                resolve(false);
            };
            interstitial.addAdEventListener(AdEventType.LOADED, onAdLoaded);
            interstitial.addAdEventListener(AdEventType.CLOSED, onAdClosed);
            interstitial.addAdEventListener(AdEventType.OPENED, onAdOpened);
            interstitial.addAdEventListener(AdEventType.ERROR, onAdError);
            interstitial.load();
        });
    },
    showRewarded: (unitId?: string, tag?: string): Promise<boolean> => {
        return new Promise(async (resolve, reject) => {
            const placementId = generatePlacementId("rewarded", tag);

            if (isPlacementBlocked(placementId)) {
                expoUtilsLog(`[expo-utils] Rewarded blocked: ${placementId}`);
                resolve(true);
                return;
            }

            const isPremium = await AsyncStorage.getItem("@isPremium");
            if (isPremium === "true") {
                resolve(true);
                return;
            }
            const app = getFirebaseApp();
            const analytics = app ? getAnalytics(app) : null;
            if (global.isAdsEnabled === false || global?.remoteConfigs?.is_ads_enabled === false) {
                resolve(true);
                return;
            }
            const adUnits = (global as any).adUnits || {};
            const adUnitId = unitId ?? adUnits.rewarded;
            const ad = RewardedAd.createForAdRequest(adUnitId, {});
            const onAdLoaded: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdLOADED", {...(e as any), placementId});
                ad.show().then();
            };
            const onAdClosed: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdCLOSED", {...(e as any), placementId});
                StatusBar.setHidden(false);
                resolve(false);
            };
            const onEarnedReward: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "REWARDED", {...(e as any), placementId});
                StatusBar.setHidden(true);
                resolve(true);
            };
            const onAdOpened: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "OPENED", {...(e as any), placementId});
                StatusBar.setHidden(true);
            };
            const onAdError: AdEventListener = async (e) => {
                if (analytics) await logEvent(analytics, "AdERROR", {...(e as any), placementId});
                resolve(false);
            };
            ad.addAdEventListener(RewardedAdEventType.LOADED, onAdLoaded);
            ad.addAdEventListener(AdEventType.CLOSED, onAdClosed);
            ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onEarnedReward);
            ad.addAdEventListener(AdEventType.OPENED, onAdOpened);
            ad.addAdEventListener(AdEventType.ERROR, onAdError);
            ad.load();
        });
    },
};

export default LoadAdsManager;
