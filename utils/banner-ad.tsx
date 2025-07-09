import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import Utils, { expoUtilsLog } from "./Utils";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BannerAdComponent({ unitId }: { unitId?: string }) {
    const [IS_ADS_ENABLED, setIsAdsEnabled] = useState(global.isAdsEnabled);
    const adUnits = (global as any).adUnits || {};
    const bannerUnitId = unitId ?? adUnits.banner;

    useEffect(() => {
        const didLoaded = async () => {
            const isPremium = await AsyncStorage.getItem('@isPremium');
            if (isPremium === 'true') {
                setIsAdsEnabled(false);
                return;
            }
            const remoteConfigSettings = await Utils.getRemoteConfigSettings();
            if(global.isAdsEnabled !== false) {
                setIsAdsEnabled(remoteConfigSettings.is_ads_enabled);
            }
            expoUtilsLog("bannerUnitIds", bannerUnitId);
        };
        didLoaded().then();
    }, []);

    return (
        IS_ADS_ENABLED && (
            <View style={{ position: "absolute", bottom: 0, zIndex: 1000 }}>
                <BannerAd
                    size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                    requestOptions={{
                        networkExtras: {
                            collapsible: "bottom",
                        },
                    }}
                    unitId={bannerUnitId}
                />
            </View>
        )
    );
}
