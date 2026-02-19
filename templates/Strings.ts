import {Platform} from "react-native";

const ios = {
    rckey: "appl_YOUR_REVENUECAT_IOS_KEY",
    adUnits: {
        appOpen: "ca-app-pub-xxx/appopen",
        banner: "ca-app-pub-xxx/banner",
        interstitial: "ca-app-pub-xxx/interstitial",
        rewarded: "ca-app-pub-xxx/rewarded",
    },
};

const android = {
    rckey: "goog_YOUR_REVENUECAT_ANDROID_KEY",
    adUnits: {
        appOpen: "ca-app-pub-xxx/appopen",
        banner: "ca-app-pub-xxx/banner",
        interstitial: "ca-app-pub-xxx/interstitial",
        rewarded: "ca-app-pub-xxx/rewarded",
    },
};

export default Platform.OS === "android" ? android : ios;
