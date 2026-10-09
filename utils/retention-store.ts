// Retenção na loja: confere cada oferta pedida (Remote Config ou o app) no RevenueCat, preenche o preço real
// e guarda como comprar; depois compra (`purchaseRetentionOffer`) ou abre o resgate do código
// (`redeemRetentionCode`). Sem UI. Plano: docs/PLANO-RETENCAO-OFERTAS.md (seções 2 a 5 e 9). Testado em
// `tests/retention-store.test.ts`, com o react-native-purchases mockado no formato do SDK.
//
// Regras (seção 4 do plano):
//  - o preço vem sempre da loja (`priceString` / `formatted`). Oferta que a loja não tem é pulada com o
//    motivo e vale a próxima da lista; para em 2 válidas (botão principal + cartão);
//  - `resubscribe`: renovação desligada → iOS abre a gestão (`reactivate`); Android compra de novo o mesmo base
//    plan (doc da Google: pedido de US$ 0,00 e a cobrança volta na data original) e, sem o produto, cai no
//    `reactivate`. Falha de pagamento → `update_payment`. Vencidos → compra do produto que a pessoa tinha;
//  - Android, preço normal com mais de uma opção no produto: compra o base plan explicitamente (o
//    `defaultOption` do RevenueCat pode escolher uma oferta com desconto);
//  - o catálogo de exemplo (`RETENTION_PREVIEW_OFFERS`) é só da pré-visualização: aqui não vale.
import {Linking, Platform} from "react-native";
import Purchases, {
    PRODUCT_CATEGORY,
    type CustomerInfo,
    type Period,
    type PricingPhase,
    type PurchasesEntitlementInfo,
    type PurchasesOfferings,
    type PurchasesStoreProduct,
    type PurchasesStoreProductDiscount,
    type SubscriptionOption,
} from "react-native-purchases";
import {PremiumUtils, isPremiumEntitlement} from "./PremiumUtils";
import {getLifecycleEntitlement} from "./rc-status";
import {resolveRetentionOfferInput, retentionDiscountPercent, type RetentionOffer, type RetentionOfferInput, type RetentionPeriod, type RetentionPrice, type RetentionStoreRef} from "./retention-offers";
import type {RetentionOfferConfig, RetentionOfferType, RetentionPeriodUnit, RetentionSegment} from "./types";
import {expoUtilsWarn} from "./Utils";

export type RetentionPlatform = "ios" | "android";

/** Ofertas válidas que bastam: a 1ª é o botão principal, a 2ª o cartão (o modal ignora o resto). */
export const RETENTION_MAX_OFFERS = 2;

/**
 * Códigos do `PURCHASES_ERROR_CODE` usados aqui (@revenuecat/purchases-typescript-internal 19.2.0,
 * `dist/generated/error-codes.d.ts`). Strings de propósito: o SDK manda `error.code` como string.
 */
export const RC_ERROR_CODES = {cancelled: "1", productAlreadyPurchased: "6", paymentPending: "20", testStoreSimulated: "42"} as const;

/**
 * Por que a oferta ficou de fora (vai no `retention_offer_unavailable`):
 *  - `unknown_offer`: nome que não está em `retention.offers`, não é embutido nem é um tipo;
 *  - `not_for_segment`: `resubscribe` para quem nunca assinou;
 *  - `no_previous_product`: precisa do produto que a pessoa tinha e ele não existe no customerInfo;
 *  - `missing_product_id` (`subscription`), `missing_offer_id` (`discount` sem `ios_offer_id`/`android_offer_tag`),
 *    `missing_code` (`offer_code` no Android sem `android_code`);
 *  - `unsupported_platform`: win-back no Android;
 *  - `product_not_found`: a loja não devolveu o produto (ou não há pacote vitalício nos offerings);
 *  - `offer_not_found`: o desconto (iOS) ou a tag (Android) não está no produto;
 *  - `not_eligible`: a promotional offer não foi assinada ou não há win-back elegível;
 *  - `store_error`: a chamada à loja deu erro (`detail` traz a mensagem).
 */
export type RetentionSkipReason =
    | "unknown_offer"
    | "not_for_segment"
    | "no_previous_product"
    | "missing_product_id"
    | "missing_offer_id"
    | "missing_code"
    | "unsupported_platform"
    | "product_not_found"
    | "offer_not_found"
    | "not_eligible"
    | "store_error";

export interface RetentionSkippedOffer {
    name: string;
    /** null quando nem o tipo deu para saber (`unknown_offer`). */
    type: RetentionOfferType | null;
    reason: RetentionSkipReason;
    /** Mensagem do erro da loja (`store_error`, `not_eligible`), até 100 caracteres. */
    detail?: string;
}

/** O produto de assinatura que a pessoa tinha (ou tem, com a renovação desligada / falha de pagamento). */
export interface RetentionPreviousProduct {
    /** Id do produto no entitlement ("premium_mensal"; no Android pode vir só a assinatura, sem o base plan). */
    productIdentifier: string;
    /** Base plan no Android (`productPlanIdentifier` do entitlement); null no iOS. */
    productPlanIdentifier: string | null;
    /** Fim do teste/período (ISO). */
    expirationDate: string | null;
}

export interface ResolveRetentionOffersOptions {
    segment: RetentionSegment;
    /** Ofertas na ordem: nomes (`retention.offers` do Remote Config, as embutidas ou o próprio tipo) e/ou objetos no formato do Remote Config. */
    inputs: readonly RetentionOfferInput[];
    customerInfo?: CustomerInfo | null;
    /** Padrão: `Platform.OS`. */
    platform?: RetentionPlatform;
    /** `retention.offers` do Remote Config. */
    remoteOffers?: Record<string, RetentionOfferConfig> | null;
    /** Troca o produto que a pessoa tinha (teste: cliente que nunca assinou). */
    productIdentifier?: string | null;
    /** App ID numérico da App Store para o link do offer code. Padrão: `remoteConfigUtils.ios_app_id`. */
    iosAppId?: string | null;
}

export interface ResolvedRetentionOffers {
    /** No máximo `RETENTION_MAX_OFFERS`, na ordem pedida, já com preço, ação e a referência da loja. */
    offers: RetentionOffer[];
    skipped: RetentionSkippedOffer[];
    previous: RetentionPreviousProduct | null;
}

export type RetentionPurchaseResult =
    | {status: "purchased"; customerInfo: CustomerInfo; premium: boolean; productIdentifier: string}
    | {status: "cancelled"}
    | {status: "pending"}
    | {status: "failed"; code: string; message: string};

export interface RetentionRedeemResult {
    ok: boolean;
    /** `link`: link da loja com o código; `sheet`: folha de resgate da Apple; null: nada a abrir. */
    method: "link" | "sheet" | null;
}

const currentPlatform = (): RetentionPlatform => (Platform.OS === "android" ? "android" : "ios");

const nonEmpty = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** "premium:mensal" → "premium" (no Android o RevenueCat junta assinatura e base plan no id do produto). */
const subscriptionIdOf = (productIdentifier: string): string => productIdentifier.split(":")[0];

const errorDetail = (error: unknown): string => String((error as any)?.message ?? error ?? "").slice(0, 100);

// ─── O produto que a pessoa tinha ─────────────────────────────────────────────

const expirationMillis = (entitlement: PurchasesEntitlementInfo): number => {
    if (typeof entitlement.expirationDateMillis === "number") return entitlement.expirationDateMillis;
    return entitlement.expirationDate ? Date.parse(entitlement.expirationDate) : NaN;
};

/**
 * Produto da pessoa por segmento: `trial_cancelled`/`cancelled`/`billing_issue` → o entitlement que decide o
 * `rc_status` (ativo com a renovação desligada / falha de pagamento); `expired`/`trial_expired` → a assinatura
 * vencida mais recente; `free` → nenhum. `productIdentifier` troca o produto (teste).
 */
export function findRetentionPreviousProduct(
    segment: RetentionSegment,
    customerInfo: CustomerInfo | null | undefined,
    productIdentifier?: string | null,
): RetentionPreviousProduct | null {
    let entitlement: PurchasesEntitlementInfo | undefined;
    if (segment === "trial_cancelled" || segment === "cancelled" || segment === "billing_issue") {
        entitlement = getLifecycleEntitlement(customerInfo);
    } else if (segment === "expired" || segment === "trial_expired") {
        entitlement = Object.values(customerInfo?.entitlements?.all ?? {})
            .filter((item) => item && !item.isActive && Number.isFinite(expirationMillis(item)))
            .reduce<PurchasesEntitlementInfo | undefined>((best, item) => (!best || expirationMillis(item) > expirationMillis(best) ? item : best), undefined);
    }
    const override = nonEmpty(productIdentifier);
    if (override) {
        const same = entitlement?.productIdentifier === override;
        return {
            productIdentifier: override,
            productPlanIdentifier: same ? entitlement?.productPlanIdentifier ?? null : null,
            expirationDate: same ? entitlement?.expirationDate ?? null : null,
        };
    }
    if (!entitlement || !nonEmpty(entitlement.productIdentifier)) return null;
    return {productIdentifier: entitlement.productIdentifier, productPlanIdentifier: entitlement.productPlanIdentifier ?? null, expirationDate: entitlement.expirationDate ?? null};
}

/**
 * O produto pedido entre os que a loja devolveu: o id exato; senão (Android, assinatura com vários base
 * plans) o base plan da pessoa e, por fim, o 1º da mesma assinatura.
 */
export function pickRetentionProduct(products: readonly PurchasesStoreProduct[] | null | undefined, productIdentifier: string, plan?: string | null): PurchasesStoreProduct | null {
    const list = (Array.isArray(products) ? products : []).filter((product): product is PurchasesStoreProduct => Boolean(product && typeof product.identifier === "string"));
    const exact = list.find((product) => product.identifier === productIdentifier);
    if (exact) return exact;
    const subscriptionId = subscriptionIdOf(productIdentifier);
    const sameSubscription = list.filter((product) => subscriptionIdOf(product.identifier) === subscriptionId);
    if (plan) {
        const byPlan = sameSubscription.find(
            (product) => product.identifier === `${subscriptionId}:${plan}` || (product.subscriptionOptions ?? []).some((option) => option?.isBasePlan && option.id === plan),
        );
        if (byPlan) return byPlan;
    }
    return sameSubscription[0] ?? null;
}

// ─── Preço e período no formato do modal ──────────────────────────────────────

const UNITS: Record<string, RetentionPeriodUnit> = {D: "day", W: "week", M: "month", Y: "year", DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year"};

/** ISO 8601 da loja ("P1M", "P3M", "P1Y", "P1W") → período do modal; outro formato → null. */
export function parseRetentionPeriod(iso: string | null | undefined): RetentionPeriod | null {
    const match = /^P(\d+)([DWMY])$/i.exec(String(iso ?? "").trim());
    if (!match) return null;
    const count = Number(match[1]);
    return count >= 1 ? {unit: UNITS[match[2].toUpperCase()], count} : null;
}

const fromSdkPeriod = (period: Period | null | undefined): RetentionPeriod | null => {
    if (!period) return null;
    const unit = UNITS[String(period.unit ?? "").toUpperCase()];
    const count = Number(period.value);
    if (unit && Number.isInteger(count) && count >= 1) return {unit, count};
    return parseRetentionPeriod(period.iso8601);
};

/** Período × ciclos ("1 mês × 3" = "nos 3 primeiros meses"). Ciclos ausentes ou inválidos = 1. */
const times = (period: RetentionPeriod, cycles: number | null | undefined): RetentionPeriod => ({
    unit: period.unit,
    count: period.count * (typeof cycles === "number" && Number.isInteger(cycles) && cycles >= 1 ? cycles : 1),
});

/** Duração de um desconto do iOS (promotional offer / win-back): unidade × número de unidades × ciclos. */
const discountDuration = (discount: Pick<PurchasesStoreProductDiscount, "period" | "periodUnit" | "periodNumberOfUnits" | "cycles">): RetentionPeriod | null => {
    const unit = UNITS[String(discount.periodUnit ?? "").toUpperCase()];
    const each =
        unit && Number.isInteger(discount.periodNumberOfUnits) && discount.periodNumberOfUnits >= 1 ? {unit, count: discount.periodNumberOfUnits} : parseRetentionPeriod(discount.period);
    return each ? times(each, discount.cycles) : null;
};

const productPrice = (product: PurchasesStoreProduct): RetentionPrice => ({amount: product.price, currency: product.currencyCode, formatted: product.priceString});

const phasePrice = (phase: PricingPhase): RetentionPrice => ({amount: phase.price.amountMicros / 1_000_000, currency: phase.price.currencyCode, formatted: phase.price.formatted});

/** Fase de preço cheio de uma opção do Android (a última fase quando o SDK não marcou). */
const fullPhaseOf = (option: SubscriptionOption): PricingPhase | null => option.fullPricePhase ?? option.pricingPhases?.[option.pricingPhases.length - 1] ?? null;

interface RegularPlan {
    store: RetentionStoreRef;
    price: RetentionPrice;
    billingPeriod: RetentionPeriod | null;
}

/**
 * Preço normal do produto e como comprar: no Android, o preço do base plan e, com mais de uma opção no
 * produto, a compra explícita do base plan (`option`); com uma opção só (ou no iOS), `purchaseStoreProduct`.
 */
function regularPlan(product: PurchasesStoreProduct, platform: RetentionPlatform): RegularPlan {
    const options = platform === "android" ? (product.subscriptionOptions ?? []).filter(Boolean) : [];
    const basePlan = options.find((option) => option.isBasePlan) ?? null;
    const phase = basePlan ? fullPhaseOf(basePlan) : null;
    return {
        store: basePlan && options.length > 1 ? {kind: "option", product, option: basePlan} : {kind: "product", product},
        price: phase ? phasePrice(phase) : productPrice(product),
        billingPeriod: fromSdkPeriod(phase?.billingPeriod) ?? fromSdkPeriod(basePlan?.billingPeriod) ?? parseRetentionPeriod(product.subscriptionPeriod),
    };
}

/** Oferta com o preço normal do plano (e o de comparação, quando há desconto de verdade). */
const withPlan = (offer: RetentionOffer, plan: RegularPlan, original?: RetentionPrice | null): RetentionOffer => ({
    ...offer,
    price: plan.price,
    ...(plan.billingPeriod ? {billingPeriod: plan.billingPeriod} : {}),
    ...(original ? {originalPrice: original} : {}),
    store: plan.store,
});

// ─── Conferência na loja ─────────────────────────────────────────────────────

interface Context {
    segment: RetentionSegment;
    platform: RetentionPlatform;
    previous: RetentionPreviousProduct | null;
    iosAppId: string | null;
    /** Produto pelo id (getProducts; sem ele, os pacotes dos offerings). Erro da loja sobe. */
    product: (productIdentifier: string, category: PRODUCT_CATEGORY, plan?: string | null) => Promise<PurchasesStoreProduct | null>;
    /** Todos os produtos devolvidos para o id (Android: um por base plan da assinatura). */
    products: (productIdentifier: string, category: PRODUCT_CATEGORY) => Promise<PurchasesStoreProduct[]>;
    offerings: () => Promise<PurchasesOfferings>;
}

type Outcome = {ok: true; offer: RetentionOffer} | {ok: false; reason: RetentionSkipReason; detail?: string};

const valid = (offer: RetentionOffer): Outcome => ({ok: true, offer});
const skip = (reason: RetentionSkipReason, detail?: string): Outcome => ({ok: false, reason, ...(detail ? {detail} : {})});

/** Uma chamada por produto/categoria em cada conferência (duas ofertas do mesmo produto não repetem a loja). */
function createContext(segment: RetentionSegment, platform: RetentionPlatform, previous: RetentionPreviousProduct | null, iosAppId: string | null): Context {
    const productCache = new Map<string, Promise<PurchasesStoreProduct[]>>();
    let offeringsPromise: Promise<PurchasesOfferings> | null = null;

    const offerings = () => (offeringsPromise ??= Purchases.getOfferings());
    const products = (productIdentifier: string, category: PRODUCT_CATEGORY) => {
        const key = `${category}|${productIdentifier}`;
        let pending = productCache.get(key);
        if (!pending) {
            pending = Purchases.getProducts([productIdentifier], category).then((list) => (Array.isArray(list) ? list.filter(Boolean) : []));
            productCache.set(key, pending);
        }
        return pending;
    };
    /** Pacotes de todos os offerings (o atual primeiro): reserva quando o getProducts não devolve o produto. */
    const fromOfferings = async (productIdentifier: string, plan?: string | null) => {
        const all = await offerings();
        const packages = [...(all?.current?.availablePackages ?? []), ...Object.values(all?.all ?? {}).flatMap((offering) => offering?.availablePackages ?? [])];
        return pickRetentionProduct(
            packages.map((item) => item?.product),
            productIdentifier,
            plan,
        );
    };
    const product = async (productIdentifier: string, category: PRODUCT_CATEGORY, plan?: string | null) => {
        let failure: unknown = null;
        try {
            const found = pickRetentionProduct(await products(productIdentifier, category), productIdentifier, plan);
            if (found) return found;
        } catch (error) {
            failure = error;
        }
        try {
            const found = await fromOfferings(productIdentifier, plan);
            if (found) return found;
        } catch (error) {
            failure ??= error;
        }
        if (failure) throw failure;
        return null;
    };
    return {segment, platform, previous, iosAppId, product, products, offerings};
}

/** Base plan da pessoa quando o id pedido é o produto dela. */
const planFor = (ctx: Context, productIdentifier: string): string | null =>
    ctx.previous && ctx.previous.productIdentifier === productIdentifier ? ctx.previous.productPlanIdentifier : null;

/** Produto + motivo de erro já no formato da conferência. */
async function loadProduct(ctx: Context, productIdentifier: string, category: PRODUCT_CATEGORY): Promise<PurchasesStoreProduct | Outcome> {
    try {
        return (await ctx.product(productIdentifier, category, planFor(ctx, productIdentifier))) ?? skip("product_not_found");
    } catch (error) {
        return skip("store_error", errorDetail(error));
    }
}

const isOutcome = (value: PurchasesStoreProduct | Outcome): value is Outcome => typeof (value as Outcome).ok === "boolean";

/**
 * Preço de comparação (`compare_product_id`): do outro produto saem o riscado e o selo. Mesmo período (ou os
 * dois sem período): o preço da loja. Períodos diferentes: normalizado pelo período da oferta
 * (`pricePerWeek`/`pricePerMonth`/`pricePerYear` × quantidade), sem `formatted` (o Intl formata). Só vale se
 * for mais caro que a oferta (senão o "riscado" mentiria).
 */
async function comparePrice(ctx: Context, compareId: string, offer: {price: RetentionPrice; billingPeriod: RetentionPeriod | null}, category: PRODUCT_CATEGORY): Promise<RetentionPrice | null> {
    const categories = category === PRODUCT_CATEGORY.SUBSCRIPTION ? [PRODUCT_CATEGORY.SUBSCRIPTION, PRODUCT_CATEGORY.NON_SUBSCRIPTION] : [PRODUCT_CATEGORY.NON_SUBSCRIPTION, PRODUCT_CATEGORY.SUBSCRIPTION];
    let compare: PurchasesStoreProduct | null = null;
    for (const item of categories) {
        try {
            compare = await ctx.product(compareId, item, null);
        } catch {
            compare = null;
        }
        if (compare) break;
    }
    if (!compare) return null;
    const plan = regularPlan(compare, ctx.platform);
    const period = offer.billingPeriod;
    const comparePeriod = plan.billingPeriod;
    let original: RetentionPrice | null = null;
    if (!period && !comparePeriod) original = plan.price;
    else if (period && comparePeriod && period.unit === comparePeriod.unit && period.count === comparePeriod.count) original = plan.price;
    else if (period && comparePeriod) {
        const perUnit = period.unit === "week" ? compare.pricePerWeek : period.unit === "month" ? compare.pricePerMonth : period.unit === "year" ? compare.pricePerYear : null;
        if (typeof perUnit === "number" && Number.isFinite(perUnit) && perUnit > 0) original = {amount: perUnit * period.count, currency: plan.price.currency};
    }
    return original && retentionDiscountPercent(offer.price, original) !== null ? original : null;
}

async function resolveResubscribe(base: RetentionOffer, ctx: Context): Promise<Outcome> {
    const {segment, platform, previous} = ctx;
    if (segment === "free") return skip("not_for_segment");
    const renewalOff = segment === "trial_cancelled" || segment === "cancelled";
    if (renewalOff || segment === "billing_issue") {
        // Reativar/atualizar o pagamento não dependem da loja: o produto, quando vem, dá o preço do cartão
        // "Seu plano" e, no Android com a renovação desligada, a compra do mesmo base plan.
        let product: PurchasesStoreProduct | null = null;
        if (previous) {
            try {
                product = await ctx.product(previous.productIdentifier, PRODUCT_CATEGORY.SUBSCRIPTION, previous.productPlanIdentifier);
            } catch (error) {
                expoUtilsWarn("retention/resubscribe: produto anterior indisponível:", error);
            }
        }
        if (renewalOff && platform === "android" && product) return valid(withPlan({...base, action: "purchase"}, regularPlan(product, platform)));
        const action = renewalOff ? "reactivate" : "update_payment";
        if (!product) return valid({...base, action, store: {kind: "manage"}});
        const plan = regularPlan(product, platform);
        return valid({...base, action, price: plan.price, ...(plan.billingPeriod ? {billingPeriod: plan.billingPeriod} : {}), store: {kind: "manage", product}});
    }
    if (!previous) return skip("no_previous_product");
    const product = await loadProduct(ctx, previous.productIdentifier, PRODUCT_CATEGORY.SUBSCRIPTION);
    if (isOutcome(product)) return product;
    return valid(withPlan({...base, action: "purchase"}, regularPlan(product, platform)));
}

async function resolveSubscription(base: RetentionOffer, config: RetentionOfferConfig, ctx: Context): Promise<Outcome> {
    const productId = nonEmpty(config.product_id);
    if (!productId) return skip("missing_product_id");
    const product = await loadProduct(ctx, productId, PRODUCT_CATEGORY.SUBSCRIPTION);
    if (isOutcome(product)) return product;
    const plan = regularPlan(product, ctx.platform);
    const compareId = nonEmpty(config.compare_product_id);
    const original = compareId ? await comparePrice(ctx, compareId, plan, PRODUCT_CATEGORY.SUBSCRIPTION) : null;
    return valid(withPlan({...base, action: "purchase"}, plan, original));
}

async function resolveLifetime(base: RetentionOffer, config: RetentionOfferConfig, ctx: Context): Promise<Outcome> {
    const productId = nonEmpty(config.product_id);
    let product: PurchasesStoreProduct | null;
    if (productId) {
        const loaded = await loadProduct(ctx, productId, PRODUCT_CATEGORY.NON_SUBSCRIPTION);
        if (isOutcome(loaded)) return loaded;
        product = loaded;
    } else {
        // Sem product_id: o pacote vitalício do offering atual e, sem ele, o de qualquer offering.
        try {
            const offerings = await ctx.offerings();
            const lifetime = offerings?.current?.lifetime ?? Object.values(offerings?.all ?? {}).map((offering) => offering?.lifetime).find(Boolean) ?? null;
            product = lifetime?.product ?? null;
        } catch (error) {
            return skip("store_error", errorDetail(error));
        }
        if (!product) return skip("product_not_found");
    }
    const plan = regularPlan(product, ctx.platform);
    const compareId = nonEmpty(config.compare_product_id);
    const original = compareId ? await comparePrice(ctx, compareId, plan, PRODUCT_CATEGORY.NON_SUBSCRIPTION) : null;
    return valid(withPlan({...base, action: "purchase"}, plan, original));
}

async function resolveDiscount(base: RetentionOffer, config: RetentionOfferConfig, ctx: Context): Promise<Outcome> {
    const productId = nonEmpty(config.product_id) ?? ctx.previous?.productIdentifier ?? null;
    if (!productId) return skip("no_previous_product");

    if (ctx.platform === "ios") {
        const offerId = nonEmpty(config.ios_offer_id);
        if (!offerId) return skip("missing_offer_id");
        const product = await loadProduct(ctx, productId, PRODUCT_CATEGORY.SUBSCRIPTION);
        if (isOutcome(product)) return product;
        const discount = (product.discounts ?? []).find((item) => item?.identifier === offerId);
        if (!discount) return skip("offer_not_found");
        // A Apple só aceita a promotional offer assinada (RevenueCat + chave de In-App Purchase). Sem assinatura
        // agora, a compra também falharia: pula. Na compra assina de novo (a assinatura vence).
        try {
            if (!(await Purchases.getPromotionalOffer(product, discount))) return skip("not_eligible");
        } catch (error) {
            return skip("not_eligible", errorDetail(error));
        }
        const billingPeriod = parseRetentionPeriod(product.subscriptionPeriod);
        const discountPeriod = discountDuration(discount);
        return valid({
            ...base,
            action: "purchase",
            price: {amount: discount.price, currency: product.currencyCode, formatted: discount.priceString},
            originalPrice: productPrice(product),
            ...(billingPeriod ? {billingPeriod} : {}),
            ...(discountPeriod ? {discountPeriod} : {}),
            store: {kind: "promotional", product, discount},
        });
    }

    const tag = nonEmpty(config.android_offer_tag);
    if (!tag) return skip("missing_offer_id");
    const preferred = await loadProduct(ctx, productId, PRODUCT_CATEGORY.SUBSCRIPTION);
    if (isOutcome(preferred)) return preferred;
    // O base plan da pessoa primeiro; depois os outros base plans da mesma assinatura (um produto cada no Android).
    let siblings: PurchasesStoreProduct[] = [];
    try {
        siblings = await ctx.products(productId, PRODUCT_CATEGORY.SUBSCRIPTION);
    } catch {
        siblings = [];
    }
    const products = [preferred, ...siblings.filter((item) => item !== preferred && subscriptionIdOf(item.identifier) === subscriptionIdOf(preferred.identifier))];
    // A Play só devolve as ofertas em que a pessoa é elegível. A tag do base plan também aparece nas ofertas
    // dele (Google `getOfferTags`), então o base plan em si nunca conta como desconto.
    for (const product of products) {
        const option = (product.subscriptionOptions ?? []).find((item) => item && !item.isBasePlan && Array.isArray(item.tags) && item.tags.includes(tag));
        if (!option) continue;
        const discounted = option.introPhase ?? option.freePhase ?? null;
        const full = fullPhaseOf(option);
        if (!discounted || !full) continue;
        const billingPeriod = fromSdkPeriod(full.billingPeriod);
        const each = fromSdkPeriod(discounted.billingPeriod);
        return valid({
            ...base,
            action: "purchase",
            price: phasePrice(discounted),
            originalPrice: phasePrice(full),
            ...(billingPeriod ? {billingPeriod} : {}),
            ...(each ? {discountPeriod: times(each, discounted.billingCycleCount)} : {}),
            store: {kind: "option", product, option},
        });
    }
    return skip("offer_not_found");
}

async function resolveWinback(base: RetentionOffer, config: RetentionOfferConfig, ctx: Context): Promise<Outcome> {
    if (ctx.platform !== "ios") return skip("unsupported_platform");
    const productId = nonEmpty(config.product_id) ?? ctx.previous?.productIdentifier ?? null;
    if (!productId) return skip("no_previous_product");
    const product = await loadProduct(ctx, productId, PRODUCT_CATEGORY.SUBSCRIPTION);
    if (isOutcome(product)) return product;
    let offers: unknown;
    try {
        // iOS 18+ com StoreKit 2; a Apple decide quem é elegível.
        offers = await Purchases.getEligibleWinBackOffersForProduct(product);
    } catch (error) {
        return skip("store_error", errorDetail(error));
    }
    const offer = Array.isArray(offers) ? offers.find(Boolean) : undefined;
    if (!offer) return skip("not_eligible");
    const billingPeriod = parseRetentionPeriod(product.subscriptionPeriod);
    const discountPeriod = discountDuration(offer);
    return valid({
        ...base,
        action: "purchase",
        price: {amount: offer.price, currency: product.currencyCode, formatted: offer.priceString},
        originalPrice: productPrice(product),
        ...(billingPeriod ? {billingPeriod} : {}),
        ...(discountPeriod ? {discountPeriod} : {}),
        store: {kind: "winback", product, offer},
    });
}

/** Link da App Store com o código já preenchido (App ID numérico; "id123" também vale). */
export const appleOfferCodeUrl = (appId: string | null | undefined, code: string | null | undefined): string | null => {
    const id = String(appId ?? "").trim().replace(/^id/i, "");
    const value = nonEmpty(code);
    return /^\d+$/.test(id) && value ? `https://apps.apple.com/redeem?ctx=offercodes&id=${id}&code=${encodeURIComponent(value)}` : null;
};

/** Link de resgate do Google Play com o código. */
export const playRedeemUrl = (code: string): string => `https://play.google.com/redeem?code=${encodeURIComponent(code)}`;

function resolveOfferCode(base: RetentionOffer, config: RetentionOfferConfig, ctx: Context): Outcome {
    if (ctx.platform === "ios") {
        // Sem App ID ou sem código: a folha de resgate da Apple (a pessoa digita o código).
        const code = nonEmpty(config.ios_code);
        return valid({...base, action: "redeem", ...(code ? {code} : {}), store: {kind: "redeem", url: appleOfferCodeUrl(ctx.iosAppId, code)}});
    }
    const code = nonEmpty(config.android_code);
    if (!code) return skip("missing_code");
    return valid({...base, action: "redeem", code, store: {kind: "redeem", url: playRedeemUrl(code)}});
}

function resolveOne(name: string, config: RetentionOfferConfig, ctx: Context): Promise<Outcome> | Outcome {
    const base: RetentionOffer = {name, type: config.type, config};
    switch (config.type) {
        case "resubscribe":
            return resolveResubscribe(base, ctx);
        case "subscription":
            return resolveSubscription(base, config, ctx);
        case "lifetime":
            return resolveLifetime(base, config, ctx);
        case "discount":
            return resolveDiscount(base, config, ctx);
        case "winback":
            return resolveWinback(base, config, ctx);
        case "offer_code":
            return resolveOfferCode(base, config, ctx);
    }
}

const inputName = (input: RetentionOfferInput): string => {
    if (typeof input === "string") return input.trim() || "(vazio)";
    if (input && typeof input === "object") return nonEmpty(input.name) ?? nonEmpty((input as {type?: unknown}).type) ?? "(sem nome)";
    return String(input);
};

/**
 * Confere as ofertas na loja, na ordem, e para quando tiver `RETENTION_MAX_OFFERS` válidas. Cada uma vira um
 * `RetentionOffer` com o preço da loja, a ação do toque e a referência de compra (`store`); as que a loja não
 * tem saem em `skipped`, com o motivo. Nunca lança.
 */
export async function resolveRetentionOffers(options: ResolveRetentionOffersOptions): Promise<ResolvedRetentionOffers> {
    const platform = options.platform ?? currentPlatform();
    const previous = findRetentionPreviousProduct(options.segment, options.customerInfo, options.productIdentifier);
    const remoteAppId: unknown = (global as any).remoteConfigUtils?.ios_app_id;
    const iosAppId = options.iosAppId !== undefined ? options.iosAppId : typeof remoteAppId === "number" ? String(remoteAppId) : nonEmpty(remoteAppId);
    const ctx = createContext(options.segment, platform, previous, iosAppId ?? null);
    const offers: RetentionOffer[] = [];
    const skipped: RetentionSkippedOffer[] = [];
    for (const input of Array.isArray(options.inputs) ? options.inputs : []) {
        if (offers.length >= RETENTION_MAX_OFFERS) break;
        // Catálogo vazio: o de exemplo é só da pré-visualização.
        const resolved = resolveRetentionOfferInput(input, options.remoteOffers, {});
        if (!resolved) {
            skipped.push({name: inputName(input), type: null, reason: "unknown_offer"});
            continue;
        }
        let outcome: Outcome;
        try {
            outcome = await resolveOne(resolved.name, resolved.config, ctx);
        } catch (error) {
            outcome = skip("store_error", errorDetail(error));
        }
        if (outcome.ok) offers.push(outcome.offer);
        else skipped.push({name: resolved.name, type: resolved.config.type, reason: outcome.reason, ...(outcome.detail ? {detail: outcome.detail} : {})});
    }
    return {offers, skipped, previous};
}

// ─── Compra e resgate ────────────────────────────────────────────────────────

/** Erro do SDK → resultado: cancelou (`userCancelled`/código 1), pendente (código 20) ou falhou. */
export function mapRetentionPurchaseError(error: unknown): Exclude<RetentionPurchaseResult, {status: "purchased"}> {
    const raw = (error ?? {}) as {code?: unknown; userCancelled?: unknown; message?: unknown};
    const code = raw.code === undefined || raw.code === null ? "" : String(raw.code);
    if (raw.userCancelled === true || code === RC_ERROR_CODES.cancelled) return {status: "cancelled"};
    if (code === RC_ERROR_CODES.paymentPending) return {status: "pending"};
    return {status: "failed", code: code || "unknown", message: String(raw.message ?? error ?? "").slice(0, 300)};
}

const hasPremium = (customerInfo: CustomerInfo | null | undefined): boolean =>
    Object.values(customerInfo?.entitlements?.active ?? {}).some((entitlement) => isPremiumEntitlement(entitlement));

/**
 * Compra a oferta conferida por `resolveRetentionOffers` (usa a referência `store`). Com Premium depois da
 * compra, grava `@isPremium` como o PaywallUtils. Nunca lança.
 */
export async function purchaseRetentionOffer(offer: RetentionOffer): Promise<RetentionPurchaseResult> {
    const store = offer?.store;
    try {
        let result: {customerInfo: CustomerInfo; productIdentifier: string};
        switch (store?.kind) {
            case "product":
                result = await Purchases.purchaseStoreProduct(store.product);
                break;
            case "option":
                result = await Purchases.purchaseSubscriptionOption(store.option);
                break;
            case "promotional": {
                // A assinatura da Apple vence: pede de novo na hora da compra.
                const signed = await Purchases.getPromotionalOffer(store.product, store.discount);
                if (!signed) return {status: "failed", code: "promotional_offer_unsigned", message: "getPromotionalOffer não devolveu a assinatura da oferta"};
                result = await Purchases.purchaseDiscountedProduct(store.product, signed);
                break;
            }
            case "winback":
                result = await Purchases.purchaseProductWithWinBackOffer(store.product, store.offer);
                break;
            default:
                return {status: "failed", code: "not_purchasable", message: `a oferta "${offer?.name}" não tem compra conferida na loja`};
        }
        const customerInfo = result.customerInfo;
        const premium = hasPremium(customerInfo);
        if (premium) {
            try {
                await PremiumUtils.setIsPremiumStatus(true);
            } catch (error) {
                expoUtilsWarn("retention/setIsPremiumStatus:", error);
            }
        }
        return {status: "purchased", customerInfo, premium, productIdentifier: result.productIdentifier};
    } catch (error) {
        return mapRetentionPurchaseError(error);
    }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Abre o resgate do código: o link da loja com o código (`store.url`) ou, no iOS sem link, a folha de
 * resgate da Apple. `sheetDelayMs` espera o modal sair antes da folha (apresentada por cima dele, ela sumiria
 * junto). Nunca lança.
 */
export async function redeemRetentionCode(offer: RetentionOffer, options: {sheetDelayMs?: number} = {}): Promise<RetentionRedeemResult> {
    const url = offer?.store?.kind === "redeem" ? offer.store.url : null;
    const ios = Platform.OS === "ios";
    if (url) {
        try {
            await Linking.openURL(url);
            return {ok: true, method: "link"};
        } catch (error) {
            expoUtilsWarn("retention/redeem openURL:", error);
            if (!ios) return {ok: false, method: "link"};
        }
    }
    if (!ios) return {ok: false, method: null};
    if (options.sheetDelayMs && options.sheetDelayMs > 0) await wait(options.sheetDelayMs);
    try {
        await Purchases.presentCodeRedemptionSheet();
        return {ok: true, method: "sheet"};
    } catch (error) {
        expoUtilsWarn("retention/presentCodeRedemptionSheet:", error);
        return {ok: false, method: "sheet"};
    }
}
