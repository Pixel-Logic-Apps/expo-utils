import {Platform} from "react-native";

// Valores COMUNS às duas plataformas — escritos 1x e aplicados no iOS e no Android via spread.
// O hotUpdaterUrl (servidor de OTA do Hot Updater) é o mesmo para iOS e Android.
const common = {
    hotUpdaterUrl: "https://YOUR-WORKER.workers.dev/api/check-update",
};

const ios = {
    ...common,
    rckey: "appl_YOUR_REVENUECAT_IOS_KEY",
    adUnits: {
        appOpen: "ca-app-pub-xxx/appopen",
        banner: "ca-app-pub-xxx/banner",
        interstitial: "ca-app-pub-xxx/interstitial",
        rewarded: "ca-app-pub-xxx/rewarded",
    },
};

const android = {
    ...common,
    rckey: "goog_YOUR_REVENUECAT_ANDROID_KEY",
    adUnits: {
        appOpen: "ca-app-pub-xxx/appopen",
        banner: "ca-app-pub-xxx/banner",
        interstitial: "ca-app-pub-xxx/interstitial",
        rewarded: "ca-app-pub-xxx/rewarded",
    },
};

export default Platform.OS === "android" ? android : ios;
