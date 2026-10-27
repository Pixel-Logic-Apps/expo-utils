import {AppOpenAd, AdEventType} from "react-native-google-mobile-ads";
import {generatePlacementId, isAdTypeBlocked, isPlacementBlocked} from "./AdPlacementTracker";
import {expoUtilsLog, expoUtilsWarn, waitAttFlowDone} from "./Utils";
import {PremiumUtils} from "./PremiumUtils";
import {logAdRevenue} from "./ad-revenue";
import {addAppLifecycleListener} from "./app-lifecycle";
import {createAdPreloader, isPastMaxWait, readAdPreloadSettings} from "./ad-preload";

let canShowAppOpenAgain = true;
let listenerRegistered = false;
const appState = {current: "active"};
// Reserva da pré-carga (`appopen_preload_enabled`, desligada por padrão): um app open pronto para a próxima volta.
const preloader = createAdPreloader("appopen", (unitId) => AppOpenAd.createForAdRequest(unitId));

// Pré-carga com as checagens da exibição que não dependem do placement: ads desligados, unitId, bloqueio do tipo
// (`appopen` ou `*` no ad_blocklist) e premium. Bloqueio por página ou placement é conferido na volta, como sempre.
const preloadAppOpen = async (adUnitId?: string) => {
    try {
        if (!preloader.wants()) return;
        if (!(global as any).isAdsEnabled) return;
        const unitId = adUnitId ?? (global as any).adUnits?.appOpen;
        if (!unitId || isAdTypeBlocked("appopen")) return;
        if (await PremiumUtils.getIsPremiumStatus()) return;
        preloader.preload(unitId);
    } catch (e) {
        expoUtilsWarn("preloadAppOpen:", e);
    }
};

// Mostra um app open já carregado. Placement e PAID são os da volta que mostra, nunca os da pré-carga.
const presentAppOpen = (appOpenAd: AppOpenAd, placementId: string, adUnitId?: string) => {
    appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        setTimeout(() => {
            canShowAppOpenAgain = true;
        }, 10 * 1000);
        // Pré-carga ligada: já prepara o da próxima volta.
        void preloadAppOpen(adUnitId);
    });
    appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
        canShowAppOpenAgain = true;
    });
    // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
    appOpenAd.addAdEventListener(AdEventType.PAID, (e) => {
        logAdRevenue("appopen", placementId, e, appOpenAd);
    });
    try {
        appOpenAd.show().catch(() => {
            canShowAppOpenAgain = true;
        });
    } catch {
        canShowAppOpenAgain = true;
    }
};

export const setupAppOpenListener = (adUnitId?: string) => {
    // Registro único: remount do layout (StrictMode/dev) não pode duplicar o listener global —
    // dois listeners passavam juntos pela janela async e dobravam o app-open.
    if (listenerRegistered) return;
    listenerRegistered = true;
    // Volta ao app: no Android com o react-native-applifecycle, o ProcessLifecycleOwner (fechar diálogo de permissão,
    // intersticial, compra ou compartilhamento não conta); sem ele, ou no iOS, o AppState. Ver utils/app-lifecycle.ts.
    const source = addAppLifecycleListener((nextAppState) => {
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

                // Pré-carga ligada: o pronto (mesmo unitId, dentro da idade) aparece na hora.
                const ready = preloader.take(unitId);
                if (ready) {
                    presentAppOpen(ready, placementId, adUnitId);
                    return;
                }

                // Sem pronto: carrega agora e mostra quando carregar, como sempre. Com `ad_load_max_wait_seconds`, o
                // que carregar depois do limite não aparece (conferido pela hora no LOADED, sem timer).
                const {maxWaitMs} = readAdPreloadSettings("appopen");
                const startedAt = Date.now();
                const appOpenAd = AppOpenAd.createForAdRequest(unitId);
                const offs = [
                    appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
                        offs.forEach((off) => off());
                        if (isPastMaxWait(startedAt, Date.now(), maxWaitMs)) {
                            expoUtilsLog("[expo-utils] AppOpen carregou depois da espera máxima — não aparece.");
                            preloader.adopt(appOpenAd, unitId);
                            canShowAppOpenAgain = true;
                            return;
                        }
                        presentAppOpen(appOpenAd, placementId, adUnitId);
                    }),
                    appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
                        offs.forEach((off) => off());
                        preloader.noteLoadError();
                        canShowAppOpenAgain = true;
                    }),
                ];
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
    expoUtilsLog(`[expo-utils] AppOpen trigger: ${source}`);
    // Pré-carga ligada: o 1º app open carrega quando o fluxo de UMP/ATT da lib termina, para o pedido não sair antes
    // do consentimento. O teto padrão de 15 s (o do promo) passaria com o formulário do UMP ainda aberto; 2 min só
    // existe para layout sem handleReady, onde o fluxo nunca termina.
    if (readAdPreloadSettings("appopen").enabled) void waitAttFlowDone(2 * 60_000).then(() => preloadAppOpen(adUnitId));
};
