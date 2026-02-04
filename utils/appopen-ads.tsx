import {AppState} from "react-native";
import {AppOpenAd, AdEventType} from "react-native-google-mobile-ads";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";

let canShowAppOpenAgain = true;
const appState = {current: "active"};

export const setupAppOpenListener = (adUnitId?: string) => {
    AppState.addEventListener("change", (nextAppState) => {
        (async () => {

            if (!(global as any).isAdsEnabled) {
                appState.current = nextAppState;
                return;
            }

            if (await Purchases.isConfigured()) {
                const customerInfo = await Purchases.getCustomerInfo();
                const isPremium = Object.keys(customerInfo.entitlements.active).length > 0;
                if (isPremium) {
                    appState.current = nextAppState;
                    return;
                }
            }

            const isPremiumStorage = JSON.parse((await AsyncStorage.getItem("@isPremium")) || "false");
            if (isPremiumStorage) {
                appState.current = nextAppState;
                return;
            }


            

            const unitId = adUnitId ?? (global as any).remoteConfigs?.adunits?.appOpen;
            if (!unitId) return;

            if (canShowAppOpenAgain && appState.current === "background" && nextAppState === "active") {
                canShowAppOpenAgain = false;
                const appOpenAd = AppOpenAd.createForAdRequest(unitId);

                appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
                    appOpenAd.show();
                });
                appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
                    setTimeout(() => {
                        canShowAppOpenAgain = true;
                    }, 10 * 1000);
                });
                appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
                    canShowAppOpenAgain = true;
                });
                appOpenAd.load();
            }
            appState.current = nextAppState;
        })();
    });
};
