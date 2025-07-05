import { Platform } from "react-native";

export default {
    ...Platform.select({
        ios: {
            appOpen: "ca-app-pub-2433070529807798/9820983809",
            banner: "ca-app-pub-2433070529807798/1426638402",
            interstitial: "ca-app-pub-2433070529807798/9113556734",
            rewarded: "ca-app-pub-2433070529807798/6413858317",
        },
        android: {
            appOpen: "ca-app-pub-2433070529807798/4027599634",
            banner: "ca-app-pub-2433070529807798/5189472212",
            interstitial: "ca-app-pub-2433070529807798/5340681306",
            rewarded: "ca-app-pub-2433070529807798/3077480041",
        },
    }),
};
