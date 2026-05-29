import {SplashScreen, Stack, usePathname} from "expo-router";
import {useEffect, useState} from "react";
import Utils, {initHotUpdater} from "expo-utils/utils/Utils";
import {setupAppOpenListener} from "expo-utils/utils/appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "expo-utils/utils/ask-for-review";
import PromotionalContent, {usePromotional} from "expo-utils/utils/modal-promotional-content";
import appConfig from "../../app.json";
import appStrings from "../constants/Strings";
import type {RemoteConfigUtilsType} from "expo-utils/utils/types";

declare global {
    var remoteConfigUtils: RemoteConfigUtilsType;
    var remoteConfigScreens: any;
    var isAdsEnabled: boolean;
    var adUnits: any;
}

SplashScreen.preventAutoHideAsync().catch(() => {});
initHotUpdater(appStrings.hotUpdaterUrl);

function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const pathname = usePathname();
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional(pathname);

    // 1) Boot: só trabalho que NÃO depende de consentimento (remote config, hot updater,
    //    RevenueCat, configs, token FCM e tópicos). prepare() não pede ATT/push nem inicia
    //    SDKs de tracking, e define appIsReady ao final — então o app sempre renderiza
    //    (sem risco de tela travada esperando permissão).
    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, appStrings);
        const unsubscribe = AskForReviewEvents.onShowPopup(() => {
            setShowReviewOverlay(true);
        });
        return unsubscribe;
    }, []);

    // 2) Só DEPOIS do primeiro frame (splash escondido, app em foreground) chamamos o ATT.
    //    Pedir durante o splash/launch é o que fazia o prompt sumir de forma intermitente em
    //    devices físicos. requestTrackingWhenActive() orquestra, nesta ordem: prompt ATT (iOS) →
    //    permissão de push (iOS/Android) → SDKs de tracking (FB/TikTok/atribuição) já com o
    //    resultado do consentimento, garantindo que nenhum IDFA/advertiser seja coletado antes
    //    do "Permitir".
    useEffect(() => {
        if (!appIsReady) return;
        (async () => {
            await SplashScreen.hideAsync().catch(() => {});
            await Utils.requestTrackingWhenActive(appConfig, appStrings);
            setupAppOpenListener();
            showPromoModal();
        })();
    }, [appIsReady]);

    if (!appIsReady) {
        return null;
    }

    return (
        <>
            <Stack>
                <Stack.Screen name="index" options={{headerShown: false}} />
            </Stack>
            <PromotionalContent visible={showPromo} onClose={hidePromoModal} />
            <AskForReviewOverlay
                visible={showReviewOverlay}
                onClose={() => setShowReviewOverlay(false)}
                delay={global.remoteConfigUtils?.review_type_delay || 0}
            />
        </>
    );
}

export default RootLayout;
