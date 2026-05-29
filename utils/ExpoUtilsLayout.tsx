import React, {useEffect, useState} from "react";
import {SplashScreen, usePathname} from "expo-router";
import Utils from "./Utils";
import {setupAppOpenListener} from "./appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "./ask-for-review";
import PromotionalContent, {usePromotional} from "./modal-promotional-content";
import type {AppStrings} from "./types";

// Mantém o splash visível até o app estar pronto (roda no import, antes do mount).
SplashScreen.preventAutoHideAsync().catch(() => {});

type Props = {
    appConfig: any;
    appStrings: AppStrings;
    children: React.ReactNode;
    /** Roda no fim do boot (depois de prepare + ATT + overlays), com global.remoteConfigUtils disponível. */
    onReady?: () => void | Promise<void>;
};

/**
 * Wrapper de layout do expo-utils. Encapsula TODO o boot do app:
 * hot updater, prepare (Remote Config/RevenueCat/push/etc.), ATT pós-primeiro-frame,
 * app-open ads, promo e ask-for-review — além de renderizar os overlays.
 *
 * O _layout.tsx do projeto só precisa envolver suas telas (Stack) com este componente,
 * passando appConfig (app.json) e appStrings (constants/Strings).
 */
export function ExpoUtilsLayout({appConfig, appStrings, children, onReady}: Props) {
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
            await onReady?.(); // seu código pós-prepare (config disponível)
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
        </>
    );
}

export default ExpoUtilsLayout;
