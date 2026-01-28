import {SplashScreen, Stack} from "expo-router";
import React, {useEffect, useState} from "react";
import Utils from "expo-utils/utils/Utils";
import AskForReviewOverlay, {AskForReviewEvents} from "expo-utils/utils/ask-for-review";
import ModalPromotionalContent, {usePromotionalModal} from "expo-utils/utils/modal-promotional-content";
import appConfig from "../../app.json";

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
    var adUnits: any;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotionalModal();

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig).then(() => {
            showPromoModal();
        });
    }, []);

    useEffect(() => {
        const unsubscribe = AskForReviewEvents.onShowPopup(() => {
            setShowReviewOverlay(true);
        });
        return unsubscribe;
    }, []);

    if (!appIsReady) {
        return null;
    } else {
        setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
        }, 1000);
    }

    return (
        <>
            <Stack>
                <Stack.Screen name="index" options={{headerShown: false}} />
            </Stack>
            <ModalPromotionalContent visible={showPromo} onClose={hidePromoModal} />
            <AskForReviewOverlay
                visible={showReviewOverlay}
                onClose={() => setShowReviewOverlay(false)}
                delay={global.remoteConfigs?.review_type_delay || 0}
            />
        </>
    );
}
