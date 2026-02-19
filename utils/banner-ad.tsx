import React, {useEffect, useRef, useState} from "react";
import {BannerAd, BannerAdSize} from "react-native-google-mobile-ads";
import Utils, {expoUtilsLog} from "./Utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {generatePlacementId, isPlacementBlocked} from "./AdPlacementTracker";

export default function BannerAdComponent({unitId, tag}: {unitId?: string; tag?: string}) {
    const [IS_ADS_ENABLED, setIsAdsEnabled] = useState(global.isAdsEnabled);
    const adUnits = (global as any).adUnits || {};
    const bannerUnitId = unitId ?? adUnits.banner;

    // Generate placement ID once on mount for stability
    const placementIdRef = useRef<string | null>(null);
    if (placementIdRef.current === null) {
        placementIdRef.current = generatePlacementId("banner", tag);
    }
    const placementId = placementIdRef.current;

    const [isBlocked, setIsBlocked] = useState(() => isPlacementBlocked(placementId));

    useEffect(() => {
        const didLoaded = async () => {
            // Re-check blocklist in case it was loaded after mount
            if (isPlacementBlocked(placementId)) {
                setIsBlocked(true);
                return;
            }

            const isPremium = await AsyncStorage.getItem("@isPremium");
            expoUtilsLog("isPremium", isPremium);
            if (isPremium === "true") {
                setIsAdsEnabled(false);
                return;
            }
            const remoteConfigSettings = await Utils.getRemoteConfigUtils();
            expoUtilsLog("isAdsEnabled", global.isAdsEnabled);
            if (global.isAdsEnabled !== false) {
                setIsAdsEnabled(remoteConfigSettings.is_ads_enabled);
            }
            expoUtilsLog("bannerUnitIds", bannerUnitId);
        };
        didLoaded().then();
    }, []);

    if (isBlocked) {
        expoUtilsLog(`[expo-utils] Banner blocked: ${placementId}`);
        return null;
    }

    return (
        IS_ADS_ENABLED && (
            <BannerAd
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{
                    networkExtras: {
                        collapsible: "bottom",
                    },
                }}
                unitId={bannerUnitId}
            />
        )
    );
}
