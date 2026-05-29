import {SplashScreen, Stack, usePathname} from "expo-router";
import {useEffect, useState} from "react";
import Utils, {initHotUpdater} from "expo-utils/utils/Utils";
import {setupAppOpenListener} from "expo-utils/utils/appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "expo-utils/utils/ask-for-review";
import PromotionalContent, {usePromotional} from "expo-utils/utils/modal-promotional-content";
import appConfig from "../../app.json";
import appStrings from "../constants/Strings";

// As globais (global.remoteConfigUtils, isAdsEnabled, etc.) e o próprio nome `global` já vêm
// tipados pelo expo-utils — não precisa declarar nada aqui nem criar um global.d.ts.
SplashScreen.preventAutoHideAsync().catch(() => {});
initHotUpdater(appStrings.hotUpdaterUrl);

function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const pathname = usePathname();
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional(pathname);

    // Boot numa função só. O useEffect roda no mount e usa o retorno (unsubscribe) como cleanup.
    useEffect(() => bootstrap(), []);

    function bootstrap() {
        global.isAdsEnabled = !__DEV__;
        (async () => {
            // Boot NÃO-tracking (prepare marca appIsReady -> renderiza a UI real). Só DEPOIS do
            // primeiro frame (splash escondido) pedimos o ATT — timing confiável p/ o prompt e
            // nenhum dado de tracking coletado antes do consentimento.
            await Utils.prepare(setAppIsReady, appConfig, appStrings);
            await SplashScreen.hideAsync().catch(() => {});
            await Utils.requestTrackingWhenActive(appConfig, appStrings);
            setupAppOpenListener();
            showPromoModal();
        })();
        return AskForReviewEvents.onShowPopup(() => setShowReviewOverlay(true));
    }

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
