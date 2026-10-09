// Abre o modal de retenção com compra de verdade (docs/PLANO-RETENCAO-OFERTAS.md, seções 3 a 5): lê o
// customerInfo, decide o segmento, pega a lista de ofertas (do app ou do Remote Config), confere cada uma na
// loja (`utils/retention-store.ts`) e só abre com pelo menos uma válida. Nunca lança. Testado em
// `tests/retention-show.test.ts`.
//
// NÃO é a detecção automática (quando abrir sozinho, `max_shows`, intervalo mínimo, episódio): quem chama
// decide o momento. Mora fora do `retention-events.ts` porque importa o SDK do RevenueCat (aquele é
// módulo-folha, importado pelo Utils.ts).
import Purchases, {type CustomerInfo} from "react-native-purchases";
import {isPremiumEntitlement} from "./PremiumUtils";
import {getRevenueCatStatus, type RcStatus} from "./rc-status";
import {logRetentionOfferUnavailable} from "./retention-analytics";
import {RetentionEvents, type RetentionRequest, type RetentionVariant} from "./retention-events";
import {isRetentionSegment, type RetentionOfferInput} from "./retention-offers";
import {resolveRetentionOffers, type RetentionSkippedOffer} from "./retention-store";
import type {RetentionConfig, RetentionSegment} from "./types";
import {expoUtilsWarn} from "./Utils";

export interface ShowRetentionOptions {
    /**
     * Força o segmento (lab/teste): abre mesmo para quem tem Premium. Sem ele, o `rc_status` do RevenueCat
     * (`getRevenueCatStatus`) — fora dos segmentos de retenção, não abre.
     */
    segment?: RetentionSegment;
    /** Ofertas na ordem (nomes e/ou objetos no formato do Remote Config). Sem elas: `retention.segments.<segmento>.offers`. */
    offers?: RetentionOfferInput[];
    /** Troca o produto que a pessoa tinha (teste: cliente que nunca assinou). */
    productIdentifier?: string;
    /** Sem ela, sai do Remote Config (`is_opted_out_trial_enabled: true` → `premium_kept`). */
    variant?: RetentionVariant;
    /** Força a língua do texto ("ar", "ja", "pt-BR"…). */
    locale?: string;
    /** Imagem no lugar do `retention.image_url`. */
    imageUrl?: string;
    /** Sem bullets no Remote Config, mostra os da lib. */
    defaultBullets?: boolean;
}

/**
 * Por que não abriu: `disabled` (`retention.enabled: false`), `rc_unavailable` (sem customerInfo),
 * `not_retention_segment` (pagante, trial normal, reembolsado…), `premium` (Premium ativo, sem segmento
 * forçado), `no_offers` (sem lista de ofertas para o segmento), `no_valid_offers` (a loja não tinha nenhuma),
 * `error` (inesperado).
 */
export type ShowRetentionReason = "disabled" | "rc_unavailable" | "not_retention_segment" | "premium" | "no_offers" | "no_valid_offers" | "error";

export interface ShowRetentionResult {
    /** O pedido aberto (`request.offers` já com preço da loja), ou null. */
    request: RetentionRequest | null;
    /** O segmento usado (o forçado ou o `rc_status`); null quando nem chegou a ler o RevenueCat. */
    segment: RcStatus | null;
    /** Ofertas puladas na conferência da loja, com o motivo (também vão no `retention_offer_unavailable`). */
    skipped: RetentionSkippedOffer[];
    /** null = abriu. */
    reason: ShowRetentionReason | null;
}

const closed = (reason: ShowRetentionReason, segment: RcStatus | null = null, skipped: RetentionSkippedOffer[] = []): ShowRetentionResult => ({request: null, segment, skipped, reason});

/**
 * Abre o modal de retenção para a pessoa, com as ofertas conferidas na loja e a compra de verdade. Ordem:
 * `retention.enabled === false` desliga → customerInfo → segmento (forçado ou `rc_status`) → quem tem Premium
 * ativo não recebe oferta (a não ser com segmento forçado) → lista de ofertas → conferência na loja → abre.
 */
export async function showRetention(options: ShowRetentionOptions = {}): Promise<ShowRetentionResult> {
    try {
        const retention: RetentionConfig | undefined = (global as any).remoteConfigUtils?.retention;
        if (retention?.enabled === false) return closed("disabled");

        let customerInfo: CustomerInfo;
        try {
            customerInfo = await Purchases.getCustomerInfo();
        } catch (error) {
            expoUtilsWarn("retention/getCustomerInfo:", error);
            return closed("rc_unavailable");
        }

        const forced = isRetentionSegment(options.segment) ? options.segment : null;
        const status: RcStatus = forced ?? getRevenueCatStatus(customerInfo);
        if (!isRetentionSegment(status)) return closed("not_retention_segment", status);
        const segment: RetentionSegment = status;
        // Mesmo critério do Premium da lib: assinatura cancelada ou com falha de pagamento não conta.
        if (!forced && Object.values(customerInfo?.entitlements?.active ?? {}).some((entitlement) => isPremiumEntitlement(entitlement))) return closed("premium", segment);

        const inputs = options.offers ?? retention?.segments?.[segment]?.offers;
        if (!Array.isArray(inputs) || inputs.length === 0) return closed("no_offers", segment);

        const {offers, skipped, previous} = await resolveRetentionOffers({
            segment,
            inputs,
            customerInfo,
            remoteOffers: retention?.offers,
            productIdentifier: options.productIdentifier,
        });
        logRetentionOfferUnavailable(segment, skipped);
        if (offers.length === 0) return closed("no_valid_offers", segment, skipped);

        const request = RetentionEvents.show({
            segment,
            offers,
            variant: options.variant,
            productIdentifier: previous?.productIdentifier ?? null,
            expirationDate: previous?.expirationDate ?? null,
            managementURL: customerInfo?.managementURL ?? null,
            locale: options.locale,
            imageUrl: options.imageUrl,
            defaultBullets: options.defaultBullets === true,
        });
        return {request, segment, skipped, reason: null};
    } catch (error) {
        expoUtilsWarn("retention/showRetention:", error);
        return closed("error");
    }
}
