import React, {useEffect, useState} from "react";
import {usePathname} from "expo-router";
import {View} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Utils, {initHotUpdater} from "./Utils";
import {setupAppOpenListener} from "./appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "./ask-for-review";
import PromotionalContent, {usePromotional} from "./modal-promotional-content";
import type {AppStrings} from "./types";

// Mantém o splash visível até o app estar pronto (roda no import, antes do mount).
SplashScreen.setOptions({duration: 150, fade: true});
SplashScreen.preventAutoHideAsync().catch(() => {});

type Props = {
    appConfig: any;
    appStrings: AppStrings;
    children: React.ReactNode;
    onReady?: () => void | Promise<void>;
    fcmTrackingAllowed?: boolean;
};

/**
 * Wrapper de layout do expo-utils. Encapsula TODO o boot do app:
 * hot updater, prepare (Remote Config/RevenueCat/push/etc.), ATT pós-primeiro-frame,
 * app-open ads, promo e ask-for-review — além de renderizar os overlays.
 *
 * O _layout.tsx do projeto só precisa envolver suas telas (Stack) com este componente,
 * passando appConfig (app.json) e appStrings (constants/Strings).
 */
export function ExpoUtilsLayout({appConfig, appStrings, children, onReady, fcmTrackingAllowed = true}: Props) {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const pathname = usePathname();
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional(pathname);

    useEffect(() => {
        (async () => {
            await initHotUpdater(appStrings.hotUpdaterUrl);
            await Utils.prepare(setAppIsReady, appConfig, appStrings, fcmTrackingAllowed);
            setupAppOpenListener();
            showPromoModal();
        })();
        return AskForReviewEvents.onShowPopup(() => setShowReviewOverlay(true));
    }, []);

    if (!appIsReady) return null;

    return (
        <>
            {children}
            <PromotionalContent visible={showPromo} onClose={hidePromoModal} />
            <AskForReviewOverlay
                visible={showReviewOverlay}
                onClose={() => setShowReviewOverlay(false)}
                delay={global.remoteConfigUtils?.review_type_delay || 0}
            />
            <View onLayout={Utils.handleReady} />
        </>
    );
}

export default ExpoUtilsLayout;
