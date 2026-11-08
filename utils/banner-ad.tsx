import React, {useEffect, useRef, useState} from "react";
import {BannerAd, BannerAdSize} from "react-native-google-mobile-ads";
import Utils, {expoUtilsLog} from "./Utils";
import {generatePlacementId, isPlacementBlocked} from "./AdPlacementTracker";
import {PremiumUtils} from "./PremiumUtils";
import {logAdRevenue} from "./ad-revenue";
import {bannerConfirmed} from "./safe-banner-ad";

export default function BannerAdComponent({unitId, tag}: {unitId?: string; tag?: string}) {
    // Só aparece com o anúncio confirmado ligado (bannerConfirmed), nunca antes da confirmação.
    const [IS_ADS_ENABLED, setIsAdsEnabled] = useState(false);
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
        let mounted = true;
        const didLoaded = async () => {
            // Re-check blocklist in case it was loaded after mount
            if (isPlacementBlocked(placementId)) {
                setIsBlocked(true);
                return;
            }

            // Premium unificado (DEV: @isPremium; produção: RevenueCat).
            const isPremium = await PremiumUtils.getIsPremiumStatus();
            expoUtilsLog("isPremium", isPremium);
            if (isPremium) return;
            // Memoizado no Utils — todos os banners compartilham o fetch do prepare().
            const remoteConfigSettings = await Utils.getRemoteConfigUtils();
            expoUtilsLog("isAdsEnabled", global.isAdsEnabled);
            if (mounted) setIsAdsEnabled(bannerConfirmed(remoteConfigSettings));
            expoUtilsLog("bannerUnitIds", bannerUnitId);
        };
        didLoaded().catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);

    if (isBlocked) {
        expoUtilsLog(`[expo-utils] Banner blocked: ${placementId}`);
        return null;
    }

    // Sem unitId o <BannerAd> lança no render (validação do react-native-google-mobile-ads)
    // e derruba o app sem error boundary — sem ad é melhor que crash.
    if (!bannerUnitId) return null;

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
                // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
                onPaid={(e) => logAdRevenue("banner", placementId, e)}
            />
        )
    );
}
