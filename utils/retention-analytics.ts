// Eventos do Analytics do modal de retenção (catálogo: docs/ANALYTICS-EVENTS.md, seção "Retenção"). Só fora
// da pré-visualização, tudo pelo `logUtilsEvent` (nunca lança, nunca é aguardado). Testado em
// `tests/retention-store.test.ts`.
//
// Preço em `price` + `price_currency`, como no paywall: `value`/`currency` fariam o GA4 tratar o evento como
// receita e somar com o `in_app_purchase` automático (a receita de verdade vem da integração do RevenueCat).
import {logUtilsEvent, type AnalyticsParams} from "./analytics";
import type {RetentionCloseMethod, RetentionRequest} from "./retention-events";
import {retentionDiscountPercent, type RetentionOffer, type RetentionOfferRole} from "./retention-offers";
import type {RetentionSkippedOffer} from "./retention-store";
import type {RetentionSegment} from "./types";

/** O que o toque fez: a ação da oferta, "Já reativei" (`confirm`) ou o botão do aviso pós-compra (`manage`). */
export type RetentionClickAction = "purchase" | "reactivate" | "update_payment" | "redeem" | "confirm" | "manage";

/** Produto da loja por trás da oferta (vazio no código promocional e no reativar sem produto). */
const storeProductId = (offer?: RetentionOffer | null): string | undefined => {
    const store = offer?.store;
    return store && store.kind !== "redeem" ? store.product?.identifier : undefined;
};

/** `offer_type`, `offer_id` (o nome no Remote Config), `product_id`, `price`, `price_currency`, `discount_pct`. */
export const retentionOfferParams = (offer?: RetentionOffer | null): AnalyticsParams => ({
    offer_type: offer?.type,
    offer_id: offer?.name,
    product_id: storeProductId(offer),
    price: offer?.price?.amount,
    price_currency: offer?.price?.currency,
    discount_pct: retentionDiscountPercent(offer?.price, offer?.originalPrice) ?? undefined,
});

// Último pedido contado: o host do modal pode remontar (troca de dono do slot) com o mesmo pedido aberto.
let lastImpressionId: number | null = null;

/** `retention_impression`: 1 por pedido aberto (a oferta principal + o nome da 2ª). `style` em todo evento do modal. */
export function logRetentionImpression(request: RetentionRequest): void {
    if (request.preview || lastImpressionId === request.id) return;
    lastImpressionId = request.id;
    const [primary, secondary] = request.offers;
    logUtilsEvent("retention_impression", {segment: request.segment, variant: request.variant, style: request.style, ...retentionOfferParams(primary), secondary_offer_id: secondary?.name});
}

/** `retention_click`: toque numa oferta (`role` principal/secundária), no "Já reativei" ou no aviso pós-compra. */
export function logRetentionClick(request: RetentionRequest, action: RetentionClickAction, offer?: RetentionOffer | null, role?: RetentionOfferRole): void {
    if (request.preview) return;
    logUtilsEvent("retention_click", {segment: request.segment, style: request.style, action, role, ...retentionOfferParams(offer)});
}

/** `retention_close`: como fechou (`close_method` = `RetentionCloseMethod`). */
export function logRetentionClose(request: RetentionRequest, method: RetentionCloseMethod): void {
    if (request.preview) return;
    const [primary] = request.offers;
    logUtilsEvent("retention_close", {segment: request.segment, style: request.style, close_method: method, offer_type: primary?.type, offer_id: primary?.name});
}

/** `retention_purchase`: compra concluída na loja. `premium` = algum entitlement ativo dá Premium depois dela. */
export function logRetentionPurchase(request: RetentionRequest, offer: RetentionOffer, result: {premium: boolean; productIdentifier?: string | null}): void {
    if (request.preview) return;
    logUtilsEvent("retention_purchase", {segment: request.segment, style: request.style, ...retentionOfferParams(offer), product_id: result.productIdentifier || storeProductId(offer), premium: result.premium});
}

/** `retention_purchase_error`: `status` `failed` (com o `code` do RevenueCat) ou `pending` (código 20). Cancelar não conta. */
export function logRetentionPurchaseError(request: RetentionRequest, offer: RetentionOffer, error: {status: "failed" | "pending"; code: string; message?: string}): void {
    if (request.preview) return;
    logUtilsEvent("retention_purchase_error", {segment: request.segment, style: request.style, ...retentionOfferParams(offer), status: error.status, code: error.code, message: error.message});
}

/** `retention_offer_unavailable`: 1 por oferta pulada na conferência da loja. */
export function logRetentionOfferUnavailable(segment: RetentionSegment, skipped: readonly RetentionSkippedOffer[]): void {
    for (const item of skipped) {
        logUtilsEvent("retention_offer_unavailable", {segment, offer_id: item.name, offer_type: item.type ?? undefined, reason: item.reason, detail: item.detail});
    }
}
