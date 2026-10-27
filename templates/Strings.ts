import {Platform} from "react-native";

// Valores COMUNS às duas plataformas — escritos 1x e aplicados no iOS e no Android via spread.
// hotUpdaterUrl = servidor de OTA do Hot Updater, o mesmo para iOS e Android:
//   v0 (padrão do expo-utils-install --hot-updater): a URL do Worker, terminada em /api/check-update;
//   v1 (--hot-updater-v1): a raiz do Worker v1 (servidor novo, sem /api/check-update) + hotUpdaterApiKey.
const common = {
    hotUpdaterUrl: "https://YOUR-WORKER.workers.dev/api/check-update",
    // Só no Hot Updater v1: chave de cliente do servidor (vai no x-api-key), a HOT_UPDATER_API_KEY do hot-updater init.
    hotUpdaterApiKey: "",
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
