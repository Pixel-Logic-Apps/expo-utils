import {AppState} from "react-native";
import {AppOpenAd, AdEventType} from "react-native-google-mobile-ads";
import {generatePlacementId, isPlacementBlocked} from "./AdPlacementTracker";
import {expoUtilsLog, expoUtilsWarn} from "./Utils";
import {PremiumUtils} from "./PremiumUtils";
import {logAdRevenue} from "./ad-revenue";

let canShowAppOpenAgain = true;
let listenerRegistered = false;
const appState = {current: "active"};

export const setupAppOpenListener = (adUnitId?: string) => {
    // Registro único: remount do layout (StrictMode/dev) não pode duplicar o listener global —
    // dois listeners passavam juntos pela janela async e dobravam o app-open.
    if (listenerRegistered) return;
    listenerRegistered = true;
    AppState.addEventListener("change", (nextAppState) => {
        (async () => {
            try {
                if (!(global as any).isAdsEnabled) return;

                const unitId = adUnitId ?? (global as any).adUnits?.appOpen;
                if (!unitId) return;

                if (!(canShowAppOpenAgain && appState.current === "background" && nextAppState === "active")) return;
                // Fecha a janela ANTES de qualquer await — transições rápidas não disparam 2 loads.
                canShowAppOpenAgain = false;

                // Premium unificado (DEV: @isPremium; produção: RevenueCat) — consultado só
                // quando um ad realmente iria aparecer (bg→active), não em toda transição.
                if (await PremiumUtils.getIsPremiumStatus()) {
                    canShowAppOpenAgain = true;
                    return;
                }

                const placementId = generatePlacementId("appopen");
                if (isPlacementBlocked(placementId)) {
                    expoUtilsLog(`[expo-utils] AppOpen blocked: ${placementId}`);
                    canShowAppOpenAgain = true;
                    return;
                }

                const appOpenAd = AppOpenAd.createForAdRequest(unitId);
                appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
                    appOpenAd.show().catch(() => {
                        canShowAppOpenAgain = true;
                    });
                });
                appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
                    setTimeout(() => {
                        canShowAppOpenAgain = true;
                    }, 10 * 1000);
                });
                appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
                    canShowAppOpenAgain = true;
                });
                // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
                appOpenAd.addAdEventListener(AdEventType.PAID, (e) => {
                    logAdRevenue("appopen", placementId, e);
                });
                appOpenAd.load();
            } catch (e) {
                // getCustomerInfo pode rejeitar mesmo configurado (1º launch offline, RC fora
                // do ar) — sem este catch o listener morria em unhandled rejection ANTES de
                // atualizar appState.current e o rastreamento bg→active corrompia.
                canShowAppOpenAgain = true;
                expoUtilsWarn("setupAppOpenListener:", e);
            } finally {
                appState.current = nextAppState;
            }
        })();
    });
};
