import {memo, useEffect, useState} from "react";
import {View} from "react-native";
import {BannerAd, BannerAdSize, TestIds} from "react-native-google-mobile-ads";
import Utils, {expoUtilsLog} from "./Utils";
import {PremiumUtils} from "./PremiumUtils";
import {logAdRevenue} from "./ad-revenue";

// Fechado: altura 0, mas o BannerAd segue montado (o pedido e o refresh automático do AdMob continuam).
const closedStyle = {height: 0, overflow: "hidden"} as const;

/**
 * Banner protegido contra o erro “The specified child already has a parent…”.
 * Ele:
 *  • destrói o AdView no unmount;
 *  • evita múltiplas instâncias simultâneas usando `React.memo`;
 *  • troca o unitId automaticamente em modo DEV;
 *  • fica fechado até o anúncio carregar: sem anúncio (no fill), não sobra espaço em branco.
 */
const SafeBanner = memo(({unitId}: {unitId: string | undefined}) => {
    // O BannerAd reserva a altura do tamanho adaptativo antes de ter anúncio (o nativo manda onSizeChange
    // assim que recebe o size), então quem controla a altura é o container: abre no onAdLoaded e fecha no
    // onAdFailedToLoad. Se um refresh do AdMob carregar depois, o onAdLoaded abre de novo.
    const [loaded, setLoaded] = useState(false);
    return (
        // collapsable={false}: a View nunca é achatada ao trocar de estilo, então o AdView não troca de pai.
        <View collapsable={false} style={loaded ? undefined : closedStyle}>
            <BannerAd
                unitId={__DEV__ ? TestIds.BANNER : unitId!}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                onAdLoaded={() => setLoaded(true)}
                onAdFailedToLoad={() => setLoaded(false)}
                // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
                onPaid={(e) => logAdRevenue("banner", "safe-banner", e)}
            />
        </View>
    );
});

export default function BannerAdComponent({unitId}: {unitId?: string}) {
    const [isAdsEnabled, setIsAdsEnabled] = useState(global.isAdsEnabled);
    const adUnits = (global as any).adUnits || {};
    const bannerUnitId = unitId ?? adUnits.banner;

    useEffect(() => {
        (async () => {
            // Premium unificado (DEV: @isPremium; produção: RevenueCat).
            const isPremium = await PremiumUtils.getIsPremiumStatus();
            expoUtilsLog("isPremium", isPremium);

            if (isPremium) {
                setIsAdsEnabled(false);
                return;
            }

            // Memoizado no Utils — todos os banners compartilham o fetch do prepare().
            const remote = await Utils.getRemoteConfigUtils();
            expoUtilsLog("remote.is_ads_enabled", remote.is_ads_enabled);

            if (global.isAdsEnabled === true) {
                // Ligado EXPLICITAMENTE (toggle "Ads" do dev-menu, app de teste) vence o default
                // do Remote Config (is_ads_enabled=false em DEV). Mesma regra do banner-ad.
                setIsAdsEnabled(true);
            } else if (global.isAdsEnabled !== false) {
                setIsAdsEnabled(remote.is_ads_enabled);
            }

            expoUtilsLog("bannerUnitId", bannerUnitId);
        })().catch(() => {});
    }, []);

    // Em produção, sem unitId o <BannerAd> lança no render — sem ad é melhor que crash.
    // (Em DEV o SafeBanner usa TestIds.BANNER, então unitId ausente é permitido.)
    if (!__DEV__ && !bannerUnitId) return null;

    return isAdsEnabled ? <SafeBanner unitId={bannerUnitId} /> : null;
}
