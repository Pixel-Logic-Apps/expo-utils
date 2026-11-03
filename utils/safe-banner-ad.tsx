import {memo, useEffect, useState} from "react";
import {BannerAd, BannerAdSize, TestIds} from "react-native-google-mobile-ads";
import Utils, {expoUtilsLog} from "./Utils";
import {PremiumUtils} from "./PremiumUtils";
import {logAdRevenue} from "./ad-revenue";

/**
 * Banner protegido contra o erro “The specified child already has a parent…”.
 * Ele:
 *  • destrói o AdView no unmount;
 *  • evita múltiplas instâncias simultâneas usando `React.memo`;
 *  • troca o unitId automaticamente em modo DEV;
 *  • reserva o espaço enquanto carrega e sai da tela se a 1ª carga não tiver anúncio (no fill).
 */
const SafeBanner = memo(({unitId}: {unitId: string | undefined}) => {
    // carregando: o BannerAd já reserva a altura do tamanho adaptativo (o nativo manda onSizeChange antes do
    // anúncio), então o anúncio entra sem mover o conteúdo, como o AdMob pede (reservar o espaço ao carregar).
    // aberto: depois do 1º anúncio, falha de refresh é ignorada; o AdView continua mostrando o anúncio anterior.
    // falhou: a 1ª carga não teve anúncio; o BannerAd sai da árvore (o AdView é destruído), sem espaço em branco
    // e sem anúncio escondido. Nova tentativa só quando o componente montar de novo.
    const [status, setStatus] = useState<"carregando" | "aberto" | "falhou">("carregando");
    if (status === "falhou") return null;
    return (
        <BannerAd
            unitId={__DEV__ ? TestIds.BANNER : unitId!}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            onAdLoaded={() => setStatus("aberto")}
            onAdFailedToLoad={() => setStatus((s) => (s === "aberto" ? s : "falhou"))}
            // ILRD: receita da impressão (valor/moeda/precisão) — ver utils/ad-revenue.ts.
            onPaid={(e) => logAdRevenue("banner", "safe-banner", e)}
        />
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
