import {Stack, usePathname} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {useEffect, useState} from "react";
import {View} from "react-native";
import Utils, {initHotUpdater} from "expo-utils/utils/Utils";
import {setupAppOpenListener} from "expo-utils/utils/appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "expo-utils/utils/ask-for-review";
import PromotionalContent, {usePromotional} from "expo-utils/utils/modal-promotional-content";
import appConfig from "../../app.json";
import appStrings from "../constants/Strings";

SplashScreen.setOptions({duration: 150, fade: true});
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const pathname = usePathname();
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional(pathname);

    useEffect(() => {
        (async () => {
            await initHotUpdater(appStrings.hotUpdaterUrl);
            await Utils.prepare(setAppIsReady, appConfig, appStrings);
            setupAppOpenListener();
            showPromoModal();
        })();
        return AskForReviewEvents.onShowPopup(() => setShowReviewOverlay(true));
    }, []);

    if (!appIsReady) return null;

    return (
        <>
            <Stack screenOptions={{headerShown: false, contentStyle: {backgroundColor: "#FFFFFF"}}}>
                <Stack.Screen name="index" />
            </Stack>
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
