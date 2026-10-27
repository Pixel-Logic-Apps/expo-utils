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
import {generatePlacementId, isAdTypeBlocked, isPlacementBlocked} from "./AdPlacementTracker";
import {PremiumUtils} from "./PremiumUtils";
import {logAdRevenue} from "./ad-revenue";
import {createAdPreloader, isPastMaxWait, readAdPreloadSettings} from "./ad-preload";

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

const adsDisabled = () => global.isAdsEnabled === false || global?.remoteConfigUtils?.is_ads_enabled === false;

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
    if (adsDisabled()) return null;
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

type AdRequest = {placementId: string; adUnitId: string};

// Reserva da pré-carga (`interstitial_preload_enabled`, desligada por padrão): um intersticial pronto para a próxima
// chamada. O primeiro da sessão carrega na chamada; a pré-carga começa quando ele fecha.
const interstitialPreloader = createAdPreloader("interstitial", (adUnitId) => InterstitialAd.createForAdRequest(adUnitId, {}));

// Pré-carga com as checagens da exibição que não dependem do placement: bloqueio do tipo (`interstitial` ou `*` no
// ad_blocklist), premium e ads desligados. O unitId é o da exibição que acabou de fechar. Bloqueio por página ou
// placement é conferido na chamada, como sempre.
const preloadInterstitial = async (adUnitId: string) => {
    try {
        if (!interstitialPreloader.wants() || isAdTypeBlocked("interstitial")) return;
        if (await PremiumUtils.getIsPremiumStatus()) return;
        if (adsDisabled()) return;
        interstitialPreloader.preload(adUnitId);
    } catch (e) {
        expoUtilsWarn("preloadInterstitial:", e);
    }
};

// Mostra um intersticial já carregado, com os listeners desta chamada: placement e PAID são os da exibição, nunca os
// da pré-carga. Resolve true no CLOSED e false em erro.
const presentInterstitial = (interstitial: InterstitialAd, request: AdRequest, analytics: any) =>
    new Promise<boolean>((resolve) => {
        interstitial.addAdEventListener(AdEventType.OPENED, (e) => {
            logAdEvent(analytics, "OPENED", e, request.placementId);
            StatusBar.setHidden(true);
        });
        interstitial.addAdEventListener(AdEventType.CLOSED, (e) => {
            logAdEvent(analytics, "AdCLOSED", e, request.placementId);
            StatusBar.setHidden(false);
            resolve(true);
            // Pré-carga ligada: já prepara o próximo.
            void preloadInterstitial(request.adUnitId);
        });
        interstitial.addAdEventListener(AdEventType.ERROR, (e) => {
            logAdEvent(analytics, "AdERROR", e, request.placementId);
            resolve(false);
        });
        // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
        interstitial.addAdEventListener(AdEventType.PAID, (e) => {
            logAdRevenue("interstitial", request.placementId, e, interstitial);
        });
        try {
            interstitial.show().catch(() => resolve(false));
        } catch {
            resolve(false);
        }
    });

// Sem pronto: carrega agora e mostra quando carregar, como sempre. Com `ad_load_max_wait_seconds` (0 = sem limite),
// o fluxo segue sem anúncio quando a carga passa do limite, e o que chegar depois não aparece.
const loadInterstitial = (request: AdRequest, analytics: any) =>
    new Promise<boolean>((resolve) => {
        const {maxWaitMs} = readAdPreloadSettings("interstitial");
        const startedAt = Date.now();
        let gaveUp = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const interstitial = InterstitialAd.createForAdRequest(request.adUnitId, {});
        const offs = [
            interstitial.addAdEventListener(AdEventType.LOADED, (e) => {
                offs.forEach((off) => off());
                if (timer) clearTimeout(timer);
                // A hora também é conferida aqui: com a Activity pausada o Android suspende o timer.
                if (gaveUp || isPastMaxWait(startedAt, Date.now(), maxWaitMs)) {
                    resolve(true);
                    interstitialPreloader.adopt(interstitial, request.adUnitId);
                    return;
                }
                logAdEvent(analytics, "AdLOADED", e, request.placementId);
                presentInterstitial(interstitial, request, analytics).then(resolve);
            }),
            interstitial.addAdEventListener(AdEventType.ERROR, (e) => {
                offs.forEach((off) => off());
                if (timer) clearTimeout(timer);
                interstitialPreloader.noteLoadError();
                // Depois da espera máxima a chamada já terminou: o erro não é mais dela.
                if (!gaveUp) logAdEvent(analytics, "AdERROR", e, request.placementId);
                resolve(false);
            }),
        ];
        // O timer só libera o fluxo na hora do limite. Se o Android o suspender (Activity pausada), quem encerra é o
        // LOADED/ERROR, como antes: a espera nunca passa da de hoje.
        if (maxWaitMs > 0) {
            timer = setTimeout(() => {
                gaveUp = true;
                resolve(true);
            }, maxWaitMs);
        }
        interstitial.load();
    });

const LoadAdsManager: LoadAdsManagerType = {
    // Contrato: NUNCA pendura nem lança — resolve true quando o fluxo do app deve seguir
    // (fechou o ad / premium / ads off / bloqueado / sem unitId / passou da espera máxima) e false em erro de ad.
    showInterstitial: async (unitId?: string, tag?: string): Promise<boolean> => {
        try {
            const request = await resolveAdRequest("interstitial", unitId, tag);
            if (!request) return true;
            const app = getFirebaseApp();
            const analytics = app ? getAnalytics(app) : null;
            // Pré-carga ligada: o pronto (mesmo unitId, dentro da idade) aparece na hora. O AdLOADED sai aqui, com o
            // placement desta chamada (na pré-carga ainda não havia placement).
            const ready = interstitialPreloader.take(request.adUnitId);
            if (ready) {
                logAdEvent(analytics, "AdLOADED", undefined, request.placementId);
                return await presentInterstitial(ready, request, analytics);
            }
            return await loadInterstitial(request, analytics);
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
