import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import Utils from "./Utils";

export default function BannerAdComponent({ unitId = "" }) {
    const [IS_ADS_ENABLED, setIsAdsEnabled] = useState(global.isAdsEnabled);

    useEffect(() => {
        const didLoaded = async () => {
            const remoteConfigSettings = await Utils.getRemoteConfigSettings();
            //Se for verdadeiro pode ir pesquisar. Caso contrário é proibido mudar o status.
            if(global.isAdsEnabled !== false) {
                setIsAdsEnabled(remoteConfigSettings.is_ads_enabled);
            }
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
                    unitId={unitId}
                />
            </View>
        )
    );
}
