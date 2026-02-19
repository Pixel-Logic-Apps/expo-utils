import {memo, useEffect, useRef, useState} from "react";
import {BannerAd, BannerAdSize, TestIds} from "react-native-google-mobile-ads";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Utils, {expoUtilsLog} from "./Utils";

/**
 * Banner protegido contra o erro “The specified child already has a parent…”.
 * Ele:
 *  • destrói o AdView no unmount;
 *  • evita múltiplas instâncias simultâneas usando `React.memo`;
 *  • troca o unitId automaticamente em modo DEV.
 */
const SafeBanner = memo(({unitId}: {unitId: string | undefined}) => {
    return <BannerAd unitId={__DEV__ ? TestIds.BANNER : unitId!} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />;
});

export default function BannerAdComponent({unitId}: {unitId?: string}) {
    const [isAdsEnabled, setIsAdsEnabled] = useState(global.isAdsEnabled);
    const adUnits = (global as any).adUnits || {};
    const bannerUnitId = unitId ?? adUnits.banner;

    useEffect(() => {
        (async () => {
            const isPremium = await AsyncStorage.getItem("@isPremium");
            expoUtilsLog("isPremium", isPremium);

            if (isPremium === "true") {
                setIsAdsEnabled(false);
                return;
            }

            const remote = await Utils.getRemoteConfigUtils();
            expoUtilsLog("remote.is_ads_enabled", remote.is_ads_enabled);

            if (global.isAdsEnabled !== false) {
                setIsAdsEnabled(remote.is_ads_enabled);
            }

            expoUtilsLog("bannerUnitId", bannerUnitId);
        })();
    }, []);

    return isAdsEnabled ? <SafeBanner unitId={bannerUnitId} /> : null;
}
