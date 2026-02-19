import {SplashScreen, Stack} from "expo-router";
import {useEffect, useState} from "react";
import Utils from "expo-utils/utils/Utils";
import {setupAppOpenListener} from "expo-utils/utils/appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "expo-utils/utils/ask-for-review";
import PromotionalContent, {usePromotional} from "expo-utils/utils/modal-promotional-content";
import appConfig from "../../app.json";
import Strings from "../constants/Strings";
import {HotUpdater} from "@hot-updater/react-native";

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
    var adUnits: any;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional();

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, Strings).then(() => {
            setupAppOpenListener();
            showPromoModal();
        });
        
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
            <PromotionalContent visible={showPromo} onClose={hidePromoModal} />
            <AskForReviewOverlay
                visible={showReviewOverlay}
                onClose={() => setShowReviewOverlay(false)}
                delay={global.remoteConfigs?.review_type_delay || 0}
            />
        </>
    );
}

export default HotUpdater.wrap({
    baseURL: "https://YOUR-WORKER.workers.dev/api/check-update",
    updateMode: "manual",
})(RootLayout);
