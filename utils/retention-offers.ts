// Ofertas do modal de retenção: o que cada tipo mostra e faz em cada segmento, preço, período e os
// dados falsos da pré-visualização. Tudo puro (sem UI e sem módulo nativo), testado em
// `tests/retention-offers.test.ts`. Plano: docs/PLANO-RETENCAO-OFERTAS.md (seções 3, 4, 7 e 8).
//
// A lib não tem regra própria de "quem vê o quê": o Remote Config lista as ofertas de cada segmento, na
// ordem. A 1ª vira o botão principal; a 2ª, um cartão abaixo dele; as outras o modal ignora. O preço vem
// sempre da loja: `utils/retention-store.ts` confere cada oferta e preenche `RetentionOffer` (preço, ação e
// a referência de compra); a pré-visualização preenche com dados falsos.
import type {PurchasesStoreProduct, PurchasesStoreProductDiscount, PurchasesWinBackOffer, SubscriptionOption} from "react-native-purchases";
import type {RetentionPluralForms} from "./i18n";
import {baseLanguage} from "./retention-texts";
import type {RetentionOfferConfig, RetentionOfferType, RetentionPeriodUnit, RetentionSegment} from "./types";

export const RETENTION_SEGMENTS: readonly RetentionSegment[] = ["trial_cancelled", "cancelled", "billing_issue", "expired", "trial_expired", "free"];
export const RETENTION_OFFER_TYPES: readonly RetentionOfferType[] = ["resubscribe", "winback", "discount", "subscription", "lifetime", "offer_code"];
export const RETENTION_PERIOD_UNITS: readonly RetentionPeriodUnit[] = ["day", "week", "month", "year"];

/** Embutidas: valem no Remote Config sem declaração em `retention.offers`. */
export const BUILTIN_RETENTION_OFFERS: Readonly<Record<string, RetentionOfferConfig>> = {
    resubscribe: {type: "resubscribe"},
    winback: {type: "winback"},
};

/** Período da loja: cobrança (`/mês`) ou duração do desconto (`nos 3 primeiros meses`). */
export interface RetentionPeriod {
    unit: RetentionPeriodUnit;
    count: number;
}

/** Preço da loja. `formatted` (o `priceString` da loja) vence; sem ele, `Intl.NumberFormat` na língua. */
export interface RetentionPrice {
    amount: number;
    /** ISO 4217 ("BRL", "USD"). */
    currency: string;
    formatted?: string | null;
}

/** Oferta pronta para o modal: o que o Remote Config pediu + o que a loja (ou a pré-visualização) disse. */
export interface RetentionOffer {
    /** Nome no Remote Config ("discount_50", "resubscribe"…): escolhe os textos `offers.<nome>.*`. */
    name: string;
    type: RetentionOfferType;
    config?: RetentionOfferConfig;
    /** O que a pessoa paga agora (com desconto, se houver). */
    price?: RetentionPrice;
    /** Preço normal ou de comparação: vira o preço riscado e o selo "−50%". */
    originalPrice?: RetentionPrice;
    /** Cobrança da assinatura (vira o "/mês"). Vitalício e código não têm. */
    billingPeriod?: RetentionPeriod;
    /** Quanto tempo vale o desconto ("nos 3 primeiros meses"). */
    discountPeriod?: RetentionPeriod;
    /** Código de `offer_code` (já escolhido para a plataforma). */
    code?: string;
    /**
     * O que o toque faz, decidido na conferência da loja (ex.: `resubscribe` com a renovação desligada é
     * `purchase` no Android e `reactivate` no iOS). Sem ele: `retentionOfferAction(type, segmento)`.
     */
    action?: RetentionOfferAction;
    /** Referência da loja para comprar/resgatar (`utils/retention-store.ts`). A view não lê. */
    store?: RetentionStoreRef;
}

/**
 * Como a oferta é comprada (preenchido por `resolveRetentionOffers`, usado por `purchaseRetentionOffer`):
 *  - `product`: `purchaseStoreProduct` (vitalício, assinatura no iOS, Android com uma opção só);
 *  - `option`: `purchaseSubscriptionOption` (Android: base plan explícito ou a oferta com a tag);
 *  - `promotional`: promotional offer do iOS (`getPromotionalOffer` de novo na hora + `purchaseDiscountedProduct`);
 *  - `winback`: win-back do iOS 18+ (`purchaseProductWithWinBackOffer`);
 *  - `redeem`: código (`url` = link da loja; null no iOS = `presentCodeRedemptionSheet`);
 *  - `manage`: reativar/atualizar o pagamento na loja (o produto, quando veio, só dá o preço do cartão).
 */
export type RetentionStoreRef =
    | {kind: "product"; product: PurchasesStoreProduct}
    | {kind: "option"; product: PurchasesStoreProduct; option: SubscriptionOption}
    | {kind: "promotional"; product: PurchasesStoreProduct; discount: PurchasesStoreProductDiscount}
    | {kind: "winback"; product: PurchasesStoreProduct; offer: PurchasesWinBackOffer}
    | {kind: "redeem"; url: string | null}
    | {kind: "manage"; product?: PurchasesStoreProduct};

/** Na pré-visualização: nome (embutida, do Remote Config ou do catálogo de exemplo) ou objeto no formato do Remote Config. */
export type RetentionOfferInput = string | (RetentionOfferConfig & {name?: string});

/** `lifetime_notice`: aviso depois do vitalício comprado com falha de pagamento ("cancele a assinatura antiga"). */
export type RetentionModalState = "offer" | "lifetime_notice";

export type RetentionOfferRole = "primary" | "secondary";

/** Texto do botão (`RetentionTranslations.ctas`; `reactivate` é o `cta` da fase 1). */
export type RetentionCtaKey = "reactivate" | "updatePayment" | "subscribeAgain" | "subscribe" | "discount" | "winback" | "lifetime" | "code";

/** `price`: preço por período; `discount`: preço novo + riscado + selo + período + regra; `lifetime`; `code`. */
export type RetentionCardKind = "discount" | "lifetime" | "price" | "code";

/**
 * O que o toque faz fora da pré-visualização: `reactivate`/`update_payment` abrem a gestão da assinatura
 * na loja; `purchase` compra (`purchaseRetentionOffer`); `redeem` abre o resgate do código.
 */
export type RetentionOfferAction = "reactivate" | "update_payment" | "purchase" | "redeem";

/** Pré-visualização: o estado depois do toque. */
export type RetentionPreviewNext = "checking" | "lifetime_notice" | "close";

export type RetentionPluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

export const isRetentionSegment = (value: unknown): value is RetentionSegment =>
    typeof value === "string" && (RETENTION_SEGMENTS as readonly string[]).includes(value);

export const isRetentionOfferType = (value: unknown): value is RetentionOfferType =>
    typeof value === "string" && (RETENTION_OFFER_TYPES as readonly string[]).includes(value);

/** A assinatura ainda está ativa, só com a renovação desligada. */
const renewalOff = (segment: RetentionSegment) => segment === "trial_cancelled" || segment === "cancelled";

/** Texto do botão de uma oferta. O `resubscribe` muda com o segmento (seção 4 do plano). */
export function retentionCtaKey(type: RetentionOfferType, segment: RetentionSegment): RetentionCtaKey {
    switch (type) {
        case "resubscribe":
            if (renewalOff(segment)) return "reactivate";
            if (segment === "billing_issue") return "updatePayment";
            return segment === "free" ? "subscribe" : "subscribeAgain";
        case "discount":
            return "discount";
        case "winback":
            return "winback";
        case "subscription":
            return "subscribe";
        case "lifetime":
            return "lifetime";
        case "offer_code":
            return "code";
    }
}

export function retentionOfferAction(type: RetentionOfferType, segment: RetentionSegment): RetentionOfferAction {
    if (type === "resubscribe") {
        if (renewalOff(segment)) return "reactivate";
        if (segment === "billing_issue") return "update_payment";
        return "purchase";
    }
    return type === "offer_code" ? "redeem" : "purchase";
}

/**
 * Pré-visualização: reativar e atualizar o pagamento vão para o "conferindo"; o vitalício comprado com
 * falha de pagamento vai para o aviso de cancelar a assinatura antiga; o resto fecha (compra simulada).
 */
export function retentionPreviewNext(type: RetentionOfferType, segment: RetentionSegment): RetentionPreviewNext {
    const action = retentionOfferAction(type, segment);
    if (action === "reactivate" || action === "update_payment") return "checking";
    if (type === "lifetime" && segment === "billing_issue") return "lifetime_notice";
    return "close";
}

/**
 * Cartão que a oferta desenha (`null` = só o botão). Reativar e atualizar o pagamento não mudam o
 * preço, então como ação principal não têm cartão; como 2ª oferta, todo tipo vira cartão tocável.
 */
export function retentionCardKind(type: RetentionOfferType, segment: RetentionSegment, role: RetentionOfferRole): RetentionCardKind | null {
    switch (type) {
        case "discount":
        case "winback":
            return "discount";
        case "lifetime":
            return "lifetime";
        case "offer_code":
            return "code";
        case "subscription":
            return "price";
        case "resubscribe":
            return role === "primary" && (renewalOff(segment) || segment === "billing_issue") ? null : "price";
    }
}

/** Oferta mínima do `resubscribe` (pedido sem lista de ofertas = fase 1). */
export const RESUBSCRIBE_OFFER: RetentionOffer = {name: "resubscribe", type: "resubscribe"};

/** 1ª oferta válida = principal; a 2ª = cartão; as outras ficam de fora. Sem nenhuma válida: `resubscribe`. */
export function splitRetentionOffers(offers?: readonly RetentionOffer[] | null): {primary: RetentionOffer; secondary: RetentionOffer | null} {
    const valid = (Array.isArray(offers) ? offers : []).filter(
        (offer): offer is RetentionOffer => Boolean(offer) && typeof offer.name === "string" && offer.name.trim().length > 0 && isRetentionOfferType(offer.type),
    );
    return {primary: valid[0] ?? RESUBSCRIBE_OFFER, secondary: valid[1] ?? null};
}

/** Percentual de desconto (inteiro) entre o preço e o original, na mesma moeda. Abaixo de 1%: null. */
export function retentionDiscountPercent(price?: RetentionPrice | null, original?: RetentionPrice | null): number | null {
    if (!price || !original) return null;
    if (price.currency && original.currency && price.currency !== original.currency) return null;
    if (!Number.isFinite(price.amount) || !Number.isFinite(original.amount)) return null;
    if (original.amount <= 0 || price.amount < 0 || price.amount >= original.amount) return null;
    const percent = Math.round((1 - price.amount / original.amount) * 100);
    return percent >= 1 ? percent : null;
}

const localeTag = (locale?: string | null): string => String(locale || "en").trim().replace(/_/g, "-") || "en";

/** Formata com Intl na língua; tag inválida cai no inglês e, sem Intl, em "BRL 19.90". */
const withIntl = (locale: string | null | undefined, options: Intl.NumberFormatOptions, value: number, fallback: () => string): string => {
    try {
        return new Intl.NumberFormat(localeTag(locale), options).format(value);
    } catch {
        try {
            return new Intl.NumberFormat("en", options).format(value);
        } catch {
            return fallback();
        }
    }
};

/** "R$ 19,90" / "$4.99": o texto da loja quando veio, senão `Intl.NumberFormat` (moeda) na língua. */
export function formatRetentionPrice(price: RetentionPrice | null | undefined, locale?: string | null): string | null {
    if (!price) return null;
    if (typeof price.formatted === "string" && price.formatted.trim()) return price.formatted;
    if (!Number.isFinite(price.amount) || typeof price.currency !== "string" || !price.currency.trim()) return null;
    const currency = price.currency.trim().toUpperCase();
    return withIntl(locale, {style: "currency", currency}, price.amount, () => `${currency} ${price.amount.toFixed(2)}`);
}

/** 50 → "50%" ("50 %" em francês e alemão, "٥٠٪" onde a língua usa algarismos arábicos). */
export function formatRetentionPercent(percent: number, locale?: string | null): string {
    return withIntl(locale, {style: "percent", maximumFractionDigits: 0}, percent / 100, () => `${percent}%`);
}

/**
 * Categoria de plural do CLDR para as 12 línguas da lib. Feita à mão porque o Hermes não traz
 * `Intl.PluralRules` (conferido em 08/10/2026 com `strings` no hermesvm do expo-utils-lab: tem
 * NumberFormat, DateTimeFormat e Collator; PluralRules, nenhuma ocorrência). Língua fora da lista
 * segue a regra do inglês.
 */
export function retentionPluralCategory(language: string | null | undefined, n: number): RetentionPluralCategory {
    const integer = Number.isInteger(n);
    const i = Math.abs(Math.trunc(n));
    switch (baseLanguage(language)) {
        case "ja":
        case "ko":
        case "zh":
            return "other";
        case "pt":
        case "fr":
            return i === 0 || i === 1 ? "one" : "other";
        case "ru": {
            if (!integer) return "other";
            const mod10 = i % 10;
            const mod100 = i % 100;
            if (mod10 === 1 && mod100 !== 11) return "one";
            if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
            return "many";
        }
        case "ar": {
            if (!integer) return "other";
            if (i === 0) return "zero";
            if (i === 1) return "one";
            if (i === 2) return "two";
            const mod100 = i % 100;
            if (mod100 >= 3 && mod100 <= 10) return "few";
            if (mod100 >= 11 && mod100 <= 99) return "many";
            return "other";
        }
        default:
            return n === 1 ? "one" : "other";
    }
}

/**
 * Escolhe a forma e troca o `{n}` (algarismos da língua). `one` é só para exatamente 1: o "21" do
 * russo (categoria `one`) usa a forma geral, que tem o número.
 */
export function pickRetentionPlural(forms: RetentionPluralForms, language: string | null | undefined, n: number, locale?: string | null): string {
    if (n === 1) return forms.one;
    const category = retentionPluralCategory(language, n);
    const form = category === "two" || category === "few" || category === "many" ? forms[category] : undefined;
    const number = withIntl(locale ?? language, {maximumFractionDigits: 0}, n, () => String(n));
    return (form ?? forms.other).replace(/\{n\}/g, number);
}

/** Período válido (unidade conhecida, contagem inteira ≥ 1) ou null. */
export const validRetentionPeriod = (period?: RetentionPeriod | null): RetentionPeriod | null =>
    period && RETENTION_PERIOD_UNITS.includes(period.unit) && Number.isInteger(period.count) && period.count >= 1 ? period : null;

// ─── Pré-visualização ─────────────────────────────────────────────────────────

/**
 * Catálogo de exemplo (os nomes do plano). Só a pré-visualização usa, e só quando o nome não está
 * declarado em `retention.offers` do Remote Config.
 */
export const RETENTION_PREVIEW_OFFERS: Readonly<Record<string, RetentionOfferConfig>> = {
    discount_50: {type: "discount", ios_offer_id: "retention_50", android_offer_tag: "retention-50"},
    lifetime_deal: {type: "lifetime", product_id: "lifetime_retention", compare_product_id: "lifetime"},
    promo_code: {type: "offer_code", ios_code: "COMEBACK50", android_code: "COMEBACK50"},
};

/**
 * Preços falsos (BRL para quem lê em português, USD para as outras línguas): mensal, o mesmo com 50%
 * nos 3 primeiros meses, vitalício de retenção e o vitalício normal (comparação, −40%).
 */
export const RETENTION_PREVIEW_PRICES = {
    BRL: {monthly: 19.9, discounted: 9.9, lifetime: 59.9, lifetimeRegular: 99.9},
    USD: {monthly: 4.99, discounted: 2.49, lifetime: 14.99, lifetimeRegular: 24.99},
} as const;

export type RetentionPreviewCurrency = keyof typeof RETENTION_PREVIEW_PRICES;

export const retentionPreviewCurrency = (language?: string | null): RetentionPreviewCurrency => (baseLanguage(language) === "pt" ? "BRL" : "USD");

/**
 * Nome → configuração: Remote Config (`retention.offers`) → embutidas → catálogo de exemplo → o
 * próprio tipo ("lifetime", "discount"…). Objeto: precisa de `type` válido; o nome padrão é o tipo.
 */
export function resolveRetentionOfferInput(
    input: RetentionOfferInput,
    remoteOffers?: Record<string, RetentionOfferConfig> | null,
    catalog: Readonly<Record<string, RetentionOfferConfig>> = RETENTION_PREVIEW_OFFERS,
): {name: string; config: RetentionOfferConfig} | null {
    if (typeof input === "string") {
        const name = input.trim();
        if (!name) return null;
        const remote = remoteOffers && typeof remoteOffers === "object" ? remoteOffers[name] : undefined;
        const config = remote ?? BUILTIN_RETENTION_OFFERS[name] ?? catalog[name] ?? (isRetentionOfferType(name) ? {type: name} : undefined);
        return config && isRetentionOfferType(config.type) ? {name, config} : null;
    }
    if (!input || typeof input !== "object" || !isRetentionOfferType(input.type)) return null;
    const {name, ...config} = input;
    return {name: typeof name === "string" && name.trim() ? name.trim() : input.type, config};
}

/** Oferta com os preços falsos da pré-visualização. Nenhuma chamada à loja. */
export function buildRetentionPreviewOffer(
    name: string,
    config: RetentionOfferConfig,
    options: {currency?: RetentionPreviewCurrency; platform?: "ios" | "android"} = {},
): RetentionOffer {
    const currency: RetentionPreviewCurrency = options.currency === "BRL" ? "BRL" : "USD";
    const prices = RETENTION_PREVIEW_PRICES[currency];
    const money = (amount: number): RetentionPrice => ({amount, currency});
    const monthly: RetentionPeriod = {unit: "month", count: 1};
    const base: RetentionOffer = {name, type: config.type, config};
    switch (config.type) {
        case "resubscribe":
        case "subscription":
            return {...base, price: money(prices.monthly), billingPeriod: monthly};
        case "discount":
        case "winback":
            return {...base, price: money(prices.discounted), originalPrice: money(prices.monthly), billingPeriod: monthly, discountPeriod: {unit: "month", count: 3}};
        case "lifetime":
            return {...base, price: money(prices.lifetime), ...(config.compare_product_id ? {originalPrice: money(prices.lifetimeRegular)} : {})};
        case "offer_code": {
            const code = options.platform === "android" ? config.android_code || config.ios_code : config.ios_code || config.android_code;
            return code ? {...base, code} : base;
        }
    }
}
