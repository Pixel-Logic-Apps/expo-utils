import {StatusBar} from "react-native";
import {
    AdEventType,
    InterstitialAd,
    RewardedAd,
    RewardedAdEventType,
} from "react-native-google-mobile-ads";
import {getAnalytics, logEvent} from "@react-native-firebase/analytics";
import {getApp} from "@react-native-firebase/app";
import {expoUtilsWarn, expoUtilsLog} from "./Utils";
import {generatePlacementId, isPlacementBlocked} from "./AdPlacementTracker";
import {PremiumUtils} from "./PremiumUtils";
import {logAdRevenue} from "./ad-revenue";

type LoadAdsManagerType = {
    showInterstitial: (unitId?: string, tag?: string) => Promise<boolean>;
    showRewarded: (unitId?: string, tag?: string) => Promise<boolean>;
};

const getFirebaseApp = () => {
    try {
        return getApp();
    } catch (error) {
        expoUtilsWarn("Firebase app not configured. Some features will be disabled.");
        return null;
    }
};

// Telemetria fora do caminho crítico: fire-and-forget com catch. Antes o logEvent era
// AGUARDADO dentro do listener LOADED — se rejeitasse, o show() nunca rodava e o await do
// app pendurava pra sempre.
const logAdEvent = (analytics: any, name: string, e: any, placementId: string) => {
    if (!analytics) return;
    try {
        // Promise.resolve: o RNFB novo tipa logEvent como void, mas em runtime é promise.
        Promise.resolve(logEvent(analytics, name, {...(e ?? {}), placementId})).catch(() => {});
    } catch {}
};

// Checks compartilhados dos dois formatos. Retorna a request pronta, ou null quando o fluxo
// deve seguir SEM ad (bloqueado/premium/ads off/sem unitId) — nunca lança.
const resolveAdRequest = async (kind: "interstitial" | "rewarded", unitId?: string, tag?: string) => {
    const placementId = generatePlacementId(kind, tag);
    if (isPlacementBlocked(placementId)) {
        expoUtilsLog(`[expo-utils] ${kind} blocked: ${placementId}`);
        return null;
    }
    // Premium unificado (DEV: @isPremium; produção: RevenueCat).
    const isPremium = await PremiumUtils.getIsPremiumStatus();
    expoUtilsLog("isPremium", isPremium);
    if (isPremium) return null;
    if (global.isAdsEnabled === false || global?.remoteConfigUtils?.is_ads_enabled === false) return null;
    expoUtilsLog("isAdsEnabled", global.isAdsEnabled);
    const adUnitId = unitId ?? ((global as any).adUnits || {})[kind];
    if (!adUnitId || typeof adUnitId !== "string") {
        // Sem o guard, createForAdRequest(undefined) lançava DENTRO do executor async da
        // promise (engolido) e o await do app pendurava pra sempre.
        expoUtilsWarn(`show ${kind}: sem unitId (global.adUnits/prepare ainda não prontos?) — seguindo sem ad.`);
        return null;
    }
    return {placementId, adUnitId};
};

const LoadAdsManager: LoadAdsManagerType = {
    // Contrato: NUNCA pendura nem lança — resolve true quando o fluxo do app deve seguir
    // (fechou o ad / premium / ads off / bloqueado / sem unitId) e false em erro de ad.
    showInterstitial: async (unitId?: string, tag?: string): Promise<boolean> => {
        try {
            const request = await resolveAdRequest("interstitial", unitId, tag);
            if (!request) return true;
            const app = getFirebaseApp();
            const analytics = app ? getAnalytics(app) : null;
            return await new Promise<boolean>((resolve) => {
                const interstitial = InterstitialAd.createForAdRequest(request.adUnitId, {});
                interstitial.addAdEventListener(AdEventType.LOADED, (e) => {
                    logAdEvent(analytics, "AdLOADED", e, request.placementId);
                    interstitial.show().catch(() => resolve(false));
                });
                interstitial.addAdEventListener(AdEventType.OPENED, (e) => {
                    logAdEvent(analytics, "OPENED", e, request.placementId);
                    StatusBar.setHidden(true);
                });
                interstitial.addAdEventListener(AdEventType.CLOSED, (e) => {
                    logAdEvent(analytics, "AdCLOSED", e, request.placementId);
                    StatusBar.setHidden(false);
                    resolve(true);
                });
                interstitial.addAdEventListener(AdEventType.ERROR, (e) => {
                    logAdEvent(analytics, "AdERROR", e, request.placementId);
                    resolve(false);
                });
                // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
                interstitial.addAdEventListener(AdEventType.PAID, (e) => {
                    logAdRevenue("interstitial", request.placementId, e, interstitial);
                });
                interstitial.load();
            });
        } catch (e) {
            expoUtilsWarn("showInterstitial:", e);
            return false;
        }
    },
    showRewarded: async (unitId?: string, tag?: string): Promise<boolean> => {
        try {
            const request = await resolveAdRequest("rewarded", unitId, tag);
            if (!request) return true;
            const app = getFirebaseApp();
            const analytics = app ? getAnalytics(app) : null;
            return await new Promise<boolean>((resolve) => {
                const ad = RewardedAd.createForAdRequest(request.adUnitId, {});
                ad.addAdEventListener(RewardedAdEventType.LOADED, (e) => {
                    logAdEvent(analytics, "AdLOADED", e, request.placementId);
                    ad.show().catch(() => resolve(false));
                });
                ad.addAdEventListener(AdEventType.OPENED, (e) => {
                    logAdEvent(analytics, "OPENED", e, request.placementId);
                    StatusBar.setHidden(true);
                });
                ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (e) => {
                    logAdEvent(analytics, "REWARDED", e, request.placementId);
                    StatusBar.setHidden(true);
                    resolve(true);
                });
                ad.addAdEventListener(AdEventType.CLOSED, (e) => {
                    logAdEvent(analytics, "AdCLOSED", e, request.placementId);
                    StatusBar.setHidden(false);
                    resolve(false);
                });
                ad.addAdEventListener(AdEventType.ERROR, (e) => {
                    logAdEvent(analytics, "AdERROR", e, request.placementId);
                    resolve(false);
                });
                // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
                ad.addAdEventListener(AdEventType.PAID, (e) => {
                    logAdRevenue("rewarded", request.placementId, e, ad);
                });
                ad.load();
            });
        } catch (e) {
            expoUtilsWarn("showRewarded:", e);
            return false;
        }
    },
};

export default LoadAdsManager;
