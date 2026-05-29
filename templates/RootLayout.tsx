import {SplashScreen, Stack, usePathname} from "expo-router";
import {useEffect, useState} from "react";
import Utils, {initHotUpdater} from "expo-utils/utils/Utils";
import {setupAppOpenListener} from "expo-utils/utils/appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "expo-utils/utils/ask-for-review";
import PromotionalContent, {usePromotional} from "expo-utils/utils/modal-promotional-content";
import appConfig from "../../app.json";
import appStrings from "../constants/Strings";

// Prefere um _layout enxuto? Troque tudo abaixo por <ExpoUtilsLayout> (de "expo-utils/utils/ExpoUtilsLayout"),
// que encapsula esse boot e expõe um callback onReady. Este template explícito é o default por dar
// controle total de CADA fase do boot.

// Module-scope: roda no IMPORT, antes do mount/prepare (Hot Updater aplica OTA o quanto antes).
SplashScreen.preventAutoHideAsync().catch(() => {});
initHotUpdater(appStrings.hotUpdaterUrl);

function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const pathname = usePathname();
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional(pathname);

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        (async () => {
            await Utils.prepare(setAppIsReady, appConfig, appStrings);
            await SplashScreen.hideAsync().catch(() => {});
            await Utils.requestTrackingWhenActive(appConfig, appStrings);
            setupAppOpenListener();
            showPromoModal();

            // 👉 SEU CÓDIGO PÓS-PREPARE AQUI (global.remoteConfigUtils já disponível).
            // Só DEPOIS do primeiro frame (splash escondido) pedimos o ATT — timing confiável
            // do prompt e nada de tracking coletado antes do consentimento.

        })();
        return AskForReviewEvents.onShowPopup(() => setShowReviewOverlay(true));
    }, []);

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
