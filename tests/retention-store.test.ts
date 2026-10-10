import {afterEach, beforeEach, describe, expect, test} from "bun:test";
import {BILLING, CANCELLED, DAY, NOW, customerInfo, entitlement, iso} from "./helpers/rc-fixtures";
import {appStorePremium, playPremium, testStore} from "./helpers/rc-store-fixtures";
import {DEFAULT_PROMO, installStoreMocks, resetStore, store} from "./helpers/rc-store-mock";
import {callNames, callsOf, eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
installStoreMocks();

const {
    appleOfferCodeUrl,
    findRetentionPreviousProduct,
    mapRetentionPurchaseError,
    parseRetentionPeriod,
    pickRetentionProduct,
    purchaseRetentionOffer,
    redeemRetentionCode,
    resolveRetentionOffers,
    RETENTION_MAX_OFFERS,
} = await import("../utils/retention-store");
const {logRetentionClick, logRetentionClose, logRetentionImpression, logRetentionOfferUnavailable, logRetentionPurchase, logRetentionPurchaseError} = await import("../utils/retention-analytics");
const {buildRetentionView} = await import("../utils/retention-view");

type Segment = import("../utils/types").RetentionSegment;
type Input = import("../utils/retention-offers").RetentionOfferInput;

/** O cliente do Pixel no lab (08/10/2026): comprou o monthly na loja de teste e venceu em 24/09. */
const PIXEL = () =>
    customerInfo([
        entitlement({
            identifier: "expoutils_lab_pro",
            productIdentifier: "monthly",
            productPlanIdentifier: null,
            store: "TEST_STORE",
            isActive: false,
            willRenew: true,
            expiresInDays: null,
            expirationDate: "2026-09-24T21:39:28.000Z",
            expirationDateMillis: Date.parse("2026-09-24T21:39:28.000Z"),
        }),
    ]);

/** Cliente com Premium ativo (o que o customerInfo traz depois de uma compra que libera o entitlement). */
const PREMIUM = () => customerInfo([entitlement({identifier: "expoutils_lab_pro", productIdentifier: "lifetime", expiresInDays: null, willRenew: false})]);

const resolve = (segment: Segment, inputs: Input[], extra: Record<string, any> = {}) =>
    resolveRetentionOffers({segment, inputs, customerInfo: state.customerInfo, platform: state.os, ...extra});

const useTestStore = (platform: "ios" | "android") => {
    state.os = platform;
    const shop = testStore(platform);
    store.catalog = [shop.monthly, shop.yearly, shop.lifetime];
    store.offerings = shop.offerings;
    return shop;
};

beforeEach(() => {
    resetStore();
    state.os = "ios";
    state.customerInfo = customerInfo();
    (globalThis as any).remoteConfigUtils = {};
});

afterEach(() => {
    resetStore();
});

describe("produto que a pessoa tinha (por segmento)", () => {
    test("trial cancelado: o entitlement ativo com a renovação desligada (produto, base plan e fim do teste)", () => {
        const trial = entitlement({periodType: "TRIAL", ...CANCELLED, productIdentifier: "premium", productPlanIdentifier: "mensal", expiresInDays: 5});
        expect(findRetentionPreviousProduct("trial_cancelled", customerInfo([trial]))).toEqual({productIdentifier: "premium", productPlanIdentifier: "mensal", expirationDate: trial.expirationDate});
        expect(findRetentionPreviousProduct("cancelled", customerInfo([entitlement({...CANCELLED, productIdentifier: "anual"})]))?.productIdentifier).toBe("anual");
    });

    test("falha de pagamento: o ativo na carência ou, sem ativo, o da janela de nova tentativa (o mesmo do rc_status)", () => {
        const grace = entitlement({...BILLING, productIdentifier: "premium_mensal", expiresInDays: 3});
        expect(findRetentionPreviousProduct("billing_issue", customerInfo([grace]))?.productIdentifier).toBe("premium_mensal");
        const hold = entitlement({...BILLING, productIdentifier: "premium_mensal", expiresInDays: -5});
        expect(findRetentionPreviousProduct("billing_issue", customerInfo([hold]))?.productIdentifier).toBe("premium_mensal");
    });

    test("vencido: a assinatura vencida mais recente (vitalício ativo e entitlement sem data não contam)", () => {
        const older = entitlement({identifier: "a", productIdentifier: "mensal_antigo", expiresInDays: -40, willRenew: false});
        const newer = entitlement({identifier: "b", productIdentifier: "anual", expiresInDays: -3, willRenew: false});
        const lifetime = entitlement({identifier: "c", productIdentifier: "remove_ads", expiresInDays: null, willRenew: false});
        expect(findRetentionPreviousProduct("expired", customerInfo([older, lifetime, newer]))).toEqual({productIdentifier: "anual", productPlanIdentifier: "mensal", expirationDate: newer.expirationDate});
        expect(findRetentionPreviousProduct("trial_expired", customerInfo([entitlement({periodType: "TRIAL", expiresInDays: -1, willRenew: false, productIdentifier: "semanal"})]))?.productIdentifier).toBe(
            "semanal",
        );
        expect(findRetentionPreviousProduct("expired", customerInfo([lifetime]))).toBeNull();
    });

    test("cliente do Pixel no lab (loja de teste, venceu em 24/09): monthly", () => {
        expect(findRetentionPreviousProduct("expired", PIXEL())).toEqual({productIdentifier: "monthly", productPlanIdentifier: null, expirationDate: "2026-09-24T21:39:28.000Z"});
    });

    test("nunca assinou: nenhum; o override de teste troca o produto em qualquer segmento", () => {
        expect(findRetentionPreviousProduct("free", customerInfo())).toBeNull();
        expect(findRetentionPreviousProduct("expired", customerInfo())).toBeNull();
        expect(findRetentionPreviousProduct("expired", customerInfo(), "monthly")).toEqual({productIdentifier: "monthly", productPlanIdentifier: null, expirationDate: null});
        // mesmo produto do entitlement: mantém o base plan e a data; outro produto: não
        expect(findRetentionPreviousProduct("expired", PIXEL(), "monthly")?.expirationDate).toBe("2026-09-24T21:39:28.000Z");
        expect(findRetentionPreviousProduct("expired", PIXEL(), "yearly")).toEqual({productIdentifier: "yearly", productPlanIdentifier: null, expirationDate: null});
    });

    test("escolha do produto devolvido: id exato; no Android o base plan da pessoa; senão o 1º da assinatura", () => {
        const {mensal, anual} = playPremium();
        expect(pickRetentionProduct([mensal, anual], "premium:anual")).toBe(anual);
        expect(pickRetentionProduct([mensal, anual], "premium", "anual")).toBe(anual);
        expect(pickRetentionProduct([mensal, anual], "premium")).toBe(mensal);
        expect(pickRetentionProduct([mensal, anual], "outro")).toBeNull();
        expect(pickRetentionProduct(null, "premium")).toBeNull();
    });

    test("período ISO da loja", () => {
        expect(parseRetentionPeriod("P1M")).toEqual({unit: "month", count: 1});
        expect(parseRetentionPeriod("P3M")).toEqual({unit: "month", count: 3});
        expect(parseRetentionPeriod("P1Y")).toEqual({unit: "year", count: 1});
        expect(parseRetentionPeriod("P1W")).toEqual({unit: "week", count: 1});
        expect(parseRetentionPeriod("P7D")).toEqual({unit: "day", count: 7});
        expect(parseRetentionPeriod(null)).toBeNull();
        expect(parseRetentionPeriod("P0M")).toBeNull();
        expect(parseRetentionPeriod("1 mês")).toBeNull();
    });
});

describe("resubscribe", () => {
    test("vencido: compra do produto que a pessoa tinha, com o preço da loja de teste", async () => {
        const shop = useTestStore("ios");
        state.customerInfo = PIXEL();
        const {offers, skipped, previous} = await resolve("expired", ["resubscribe"]);
        expect(skipped).toEqual([]);
        expect(previous?.productIdentifier).toBe("monthly");
        expect(offers).toEqual([
            {
                name: "resubscribe",
                type: "resubscribe",
                config: {type: "resubscribe"},
                action: "purchase",
                price: {amount: 9.99, currency: "USD", formatted: "US$ 9,99"},
                billingPeriod: {unit: "month", count: 1},
                store: {kind: "product", product: shop.monthly},
            },
        ]);
        expect(callsOf("getProducts")).toEqual([["getProducts", ["monthly"], "SUBSCRIPTION"]]);
    });

    test("vencido sem produto anterior: pula; com o override de teste, vale", async () => {
        useTestStore("ios");
        const without = await resolve("expired", ["resubscribe"]);
        expect(without.offers).toEqual([]);
        expect(without.skipped).toEqual([{name: "resubscribe", type: "resubscribe", reason: "no_previous_product"}]);
        const withOverride = await resolve("trial_expired", ["resubscribe"], {productIdentifier: "monthly"});
        expect(withOverride.offers[0]).toMatchObject({action: "purchase", price: {formatted: "US$ 9,99"}});
    });

    test("vencido: produto que a loja não tem pula; erro da loja pula com a mensagem", async () => {
        useTestStore("ios");
        state.customerInfo = customerInfo([entitlement({productIdentifier: "nao_existe", expiresInDays: -2, willRenew: false})]);
        expect((await resolve("expired", ["resubscribe"])).skipped).toEqual([{name: "resubscribe", type: "resubscribe", reason: "product_not_found"}]);
        state.customerInfo = PIXEL();
        store.productsError = Object.assign(new Error("There was a problem with the store."), {code: "2"});
        store.offeringsError = new Error("sem rede");
        expect((await resolve("expired", ["resubscribe"])).skipped).toEqual([
            {name: "resubscribe", type: "resubscribe", reason: "store_error", detail: "There was a problem with the store."},
        ]);
    });

    test("getProducts sem o produto: a reserva são os pacotes dos offerings", async () => {
        const shop = testStore("ios");
        state.os = "ios";
        store.catalog = []; // a loja não devolveu pelo getProducts
        store.offerings = shop.offerings;
        state.customerInfo = PIXEL();
        const {offers} = await resolve("expired", ["resubscribe"]);
        expect(offers[0].store).toEqual({kind: "product", product: shop.monthly});
    });

    test("nunca assinou: pula (não há o que reativar)", async () => {
        useTestStore("ios");
        expect((await resolve("free", ["resubscribe"])).skipped).toEqual([{name: "resubscribe", type: "resubscribe", reason: "not_for_segment"}]);
        expect(callsOf("getProducts")).toEqual([]);
    });

    test("renovação desligada no iOS: reativar pela gestão (o produto só dá o preço do cartão)", async () => {
        const shop = useTestStore("ios");
        state.customerInfo = customerInfo([entitlement({periodType: "TRIAL", ...CANCELLED, productIdentifier: "monthly", productPlanIdentifier: null})]);
        const {offers} = await resolve("trial_cancelled", ["resubscribe"]);
        expect(offers[0]).toMatchObject({action: "reactivate", price: {formatted: "US$ 9,99"}, billingPeriod: {unit: "month", count: 1}, store: {kind: "manage", product: shop.monthly}});
    });

    test("renovação desligada no Android: compra de novo o mesmo base plan; sem o produto, reativar", async () => {
        const shop = useTestStore("android");
        state.customerInfo = customerInfo([entitlement({...CANCELLED, productIdentifier: "monthly", productPlanIdentifier: "testBasePlanId"})]);
        const bought = await resolve("cancelled", ["resubscribe"]);
        expect(bought.offers[0]).toMatchObject({action: "purchase", store: {kind: "product", product: shop.monthly}, price: {formatted: "US$ 9,99"}});
        store.catalog = [];
        store.offerings = {all: {}, current: null};
        const fallback = await resolve("cancelled", ["resubscribe"]);
        expect(fallback.offers).toEqual([{name: "resubscribe", type: "resubscribe", config: {type: "resubscribe"}, action: "reactivate", store: {kind: "manage"}}]);
        expect(fallback.skipped).toEqual([]);
    });

    test("falha de pagamento: atualizar o pagamento (mesmo sem loja)", async () => {
        useTestStore("android");
        store.productsError = new Error("offline");
        store.offeringsError = new Error("offline");
        state.customerInfo = customerInfo([entitlement({...BILLING, productIdentifier: "monthly", expiresInDays: 2})]);
        const {offers, skipped} = await resolve("billing_issue", ["resubscribe"]);
        expect(skipped).toEqual([]);
        expect(offers[0]).toMatchObject({action: "update_payment", store: {kind: "manage"}});
    });
});

describe("Android: preço normal com várias opções compra o base plan explicitamente", () => {
    test("assinatura com trial, base plan e oferta: preço e compra do base plan (não o defaultOption)", async () => {
        state.os = "android";
        const {mensal, anual} = playPremium();
        store.catalog = [mensal, anual];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium", productPlanIdentifier: "mensal", expiresInDays: -3, willRenew: false})]);
        const {offers} = await resolve("expired", ["resubscribe"]);
        const basePlan = mensal.subscriptionOptions[1];
        expect(offers[0]).toMatchObject({action: "purchase", price: {amount: 19.9, currency: "BRL", formatted: "R$ 19,90"}, billingPeriod: {unit: "month", count: 1}});
        expect(offers[0].store).toEqual({kind: "option", product: mensal, option: basePlan});

        state.customerInfo = customerInfo([], {}); // compra com o customerInfo "depois" padrão
        await purchaseRetentionOffer(offers[0]);
        expect(callNames()).toContain("purchaseSubscriptionOption");
        expect(callNames()).not.toContain("purchaseStoreProduct");
        expect(callsOf("purchaseSubscriptionOption")[0][1]).toBe(basePlan);
    });

    test("o base plan da pessoa vence o 1º devolvido (anual)", async () => {
        state.os = "android";
        const {mensal, anual} = playPremium();
        store.catalog = [mensal, anual];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium", productPlanIdentifier: "anual", expiresInDays: -3, willRenew: false})]);
        const {offers} = await resolve("expired", ["resubscribe"]);
        expect(offers[0]).toMatchObject({price: {formatted: "R$ 199,90"}, billingPeriod: {unit: "year", count: 1}, store: {kind: "option", option: anual.subscriptionOptions[0]}});
    });

    test("uma opção só (loja de teste): purchaseStoreProduct", async () => {
        const shop = useTestStore("android");
        state.customerInfo = PIXEL();
        const {offers} = await resolve("expired", ["resubscribe"]);
        expect(offers[0].store).toEqual({kind: "product", product: shop.monthly});
        await purchaseRetentionOffer(offers[0]);
        expect(callsOf("purchaseStoreProduct")[0][1]).toBe(shop.monthly);
    });
});

describe("subscription e comparação", () => {
    test("sem product_id: pula", async () => {
        useTestStore("ios");
        expect((await resolve("free", [{type: "subscription"}])).skipped).toEqual([{name: "subscription", type: "subscription", reason: "missing_product_id"}]);
    });

    test("anual × mensal (períodos diferentes): o mensal normalizado por ano, sem formatted, e o selo", async () => {
        useTestStore("ios");
        const {offers} = await resolve("free", [{name: "anual", type: "subscription", product_id: "yearly", compare_product_id: "monthly"}]);
        expect(offers[0]).toMatchObject({
            name: "anual",
            action: "purchase",
            price: {amount: 79.99, currency: "USD", formatted: "US$ 79,99"},
            billingPeriod: {unit: "year", count: 1},
            originalPrice: {amount: 119.88, currency: "USD"},
        });
        expect(offers[0].originalPrice?.formatted).toBeUndefined();
        const view = buildRetentionView({segment: "free", variant: "premium_lost", offers, language: "en", appName: "Lab"});
        expect(view.primary.card).toMatchObject({kind: "price", price: "US$ 79,99", per: "/year", originalPrice: "$119.88", badge: "−33%"});
    });

    test("mesmo período: o preço da loja como está (com o texto dela); igual ou mais barato não vira riscado", async () => {
        useTestStore("ios");
        store.catalog.push({...store.catalog[0], identifier: "monthly_full", price: 14.99, priceString: "US$ 14,99", pricePerMonth: 14.99});
        const pricier = await resolve("free", [{type: "subscription", product_id: "monthly", compare_product_id: "monthly_full"}]);
        expect(pricier.offers[0].originalPrice).toEqual({amount: 14.99, currency: "USD", formatted: "US$ 14,99"});
        const same = await resolve("free", [{type: "subscription", product_id: "monthly", compare_product_id: "monthly"}]);
        expect(same.offers[0].originalPrice).toBeUndefined(); // mesmo preço: sem desconto
        const cheaper = await resolve("free", [{type: "subscription", product_id: "monthly", compare_product_id: "yearly"}]);
        // 6,67/mês do anual é mais barato que 9,99: sem riscado
        expect(cheaper.offers[0].originalPrice).toBeUndefined();
    });

    test("semanal × mensal: pricePerWeek do mensal × semanas; comparação que a loja não tem é ignorada", async () => {
        useTestStore("ios");
        store.catalog.push({...store.catalog[0], identifier: "weekly", price: 1.99, priceString: "US$ 1,99", subscriptionPeriod: "P1W", pricePerWeek: 1.99, pricePerMonth: 8.62, pricePerYear: 103.48});
        const {offers} = await resolve("free", [{type: "subscription", product_id: "weekly", compare_product_id: "monthly"}]);
        expect(offers[0].originalPrice).toEqual({amount: 2.3, currency: "USD"});
        const missing = await resolve("free", [{type: "subscription", product_id: "weekly", compare_product_id: "nao_existe"}]);
        expect(missing.offers[0].originalPrice).toBeUndefined();
        expect(missing.offers).toHaveLength(1);
    });
});

describe("lifetime", () => {
    test("sem product_id: o pacote vitalício do offering atual (loja de teste)", async () => {
        const shop = useTestStore("android");
        const {offers} = await resolve("free", ["lifetime"]);
        expect(offers).toEqual([
            {name: "lifetime", type: "lifetime", config: {type: "lifetime"}, action: "purchase", price: {amount: 99.99, currency: "USD", formatted: "US$ 99,99"}, store: {kind: "product", product: shop.lifetime}},
        ]);
        expect(callNames()).toEqual(["getOfferings"]);
    });

    test("sem vitalício no atual: o de qualquer offering; em nenhum, pula", async () => {
        const shop = useTestStore("ios");
        store.offerings = {current: {...shop.offerings.current, identifier: "sem", lifetime: null}, all: {sem: {lifetime: null}, outro: shop.offerings.current}};
        expect((await resolve("free", ["lifetime"])).offers[0].store).toEqual({kind: "product", product: shop.lifetime});
        store.offerings = {current: null, all: {}};
        expect((await resolve("free", ["lifetime"])).skipped).toEqual([{name: "lifetime", type: "lifetime", reason: "product_not_found"}]);
    });

    test("com product_id: busca direto na loja (NON_SUBSCRIPTION); comparação com outro vitalício", async () => {
        useTestStore("ios");
        store.catalog.push({...store.catalog[2], identifier: "lifetime_retention", price: 59.99, priceString: "US$ 59,99"});
        const {offers} = await resolve("billing_issue", [{name: "lifetime_deal", type: "lifetime", product_id: "lifetime_retention", compare_product_id: "lifetime"}]);
        expect(offers[0]).toMatchObject({name: "lifetime_deal", price: {formatted: "US$ 59,99"}, originalPrice: {amount: 99.99, currency: "USD", formatted: "US$ 99,99"}});
        expect(callsOf("getProducts")[0]).toEqual(["getProducts", ["lifetime_retention"], "NON_SUBSCRIPTION"]);
    });
});

describe("discount", () => {
    test("iOS: promotional offer do produto, assinada pelo RevenueCat (preço, riscado, período × ciclos)", async () => {
        state.os = "ios";
        const product = appStorePremium();
        store.catalog = [product];
        state.customerInfo = customerInfo([entitlement({...CANCELLED, productIdentifier: "premium_mensal", productPlanIdentifier: null})]);
        const {offers, skipped} = await resolve("cancelled", [{name: "discount_50", type: "discount", ios_offer_id: "retention_50", android_offer_tag: "retention-50"}]);
        expect(skipped).toEqual([]);
        expect(offers[0]).toMatchObject({
            action: "purchase",
            price: {amount: 9.9, currency: "BRL", formatted: "R$ 9,90"},
            originalPrice: {amount: 19.9, currency: "BRL", formatted: "R$ 19,90"},
            billingPeriod: {unit: "month", count: 1},
            discountPeriod: {unit: "month", count: 3},
            store: {kind: "promotional", product, discount: product.discounts[0]},
        });
        expect(callsOf("getPromotionalOffer")).toEqual([["getPromotionalOffer", "premium_mensal", "retention_50"]]);
        const view = buildRetentionView({segment: "cancelled", variant: "premium_lost", offers, language: "pt", appName: "App"});
        expect(view.primary.card).toMatchObject({kind: "discount", price: "R$ 9,90", originalPrice: "R$ 19,90", badge: "−50%", period: "nos 3 primeiros meses", terms: "depois R$ 19,90/mês"});
    });

    test("iOS: id fora do produto, sem assinatura, sem id ou sem produto: pula com o motivo", async () => {
        state.os = "ios";
        store.catalog = [appStorePremium()];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium_mensal", expiresInDays: -2, willRenew: false})]);
        expect((await resolve("expired", [{type: "discount", ios_offer_id: "outra"}])).skipped[0].reason).toBe("offer_not_found");
        store.promo = undefined;
        expect((await resolve("expired", [{type: "discount", ios_offer_id: "retention_50"}])).skipped[0].reason).toBe("not_eligible");
        store.promo = DEFAULT_PROMO;
        store.promoError = new Error("Ineligible for the offer");
        expect((await resolve("expired", [{type: "discount", ios_offer_id: "retention_50"}])).skipped[0]).toMatchObject({reason: "not_eligible", detail: "Ineligible for the offer"});
        expect((await resolve("expired", [{type: "discount", android_offer_tag: "retention-50"}])).skipped[0].reason).toBe("missing_offer_id");
        state.customerInfo = customerInfo();
        expect((await resolve("expired", [{type: "discount", ios_offer_id: "retention_50"}])).skipped[0].reason).toBe("no_previous_product");
    });

    test("iOS: na compra pede a assinatura de novo e usa purchaseDiscountedProduct", async () => {
        state.os = "ios";
        const product = appStorePremium();
        store.catalog = [product];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium_mensal", expiresInDays: -2, willRenew: false})]);
        const {offers} = await resolve("expired", [{type: "discount", ios_offer_id: "retention_50"}]);
        state.calls.length = 0;
        const fresh = {...DEFAULT_PROMO, nonce: "outro", timestamp: DEFAULT_PROMO.timestamp + 1};
        store.promo = fresh;
        state.customerInfo = PREMIUM();
        const result = await purchaseRetentionOffer(offers[0]);
        expect(result.status).toBe("purchased");
        expect(callNames()).toEqual(["getPromotionalOffer", "purchaseDiscountedProduct"]);
        expect(callsOf("purchaseDiscountedProduct")[0]).toEqual(["purchaseDiscountedProduct", product, fresh]);
        store.promo = undefined;
        expect(await purchaseRetentionOffer(offers[0])).toMatchObject({status: "failed", code: "promotional_offer_unsigned"});
    });

    test("Android: oferta do base plan com a tag (preço da fase com desconto, preço cheio, período × ciclos)", async () => {
        state.os = "android";
        const {mensal, anual} = playPremium();
        store.catalog = [mensal, anual];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium", productPlanIdentifier: "mensal", expiresInDays: -3, willRenew: false})]);
        const {offers} = await resolve("expired", [{name: "discount_50", type: "discount", ios_offer_id: "retention_50", android_offer_tag: "retention-50"}]);
        expect(offers[0]).toMatchObject({
            name: "discount_50",
            action: "purchase",
            price: {amount: 9.9, currency: "BRL", formatted: "R$ 9,90"},
            originalPrice: {amount: 19.9, currency: "BRL", formatted: "R$ 19,90"},
            billingPeriod: {unit: "month", count: 1},
            discountPeriod: {unit: "month", count: 3},
        });
        expect(offers[0].store).toEqual({kind: "option", product: mensal, option: mensal.subscriptionOptions[2]});
        expect(callNames()).not.toContain("getPromotionalOffer");
        await purchaseRetentionOffer(offers[0]);
        expect(callsOf("purchaseSubscriptionOption")[0][1]).toBe(mensal.subscriptionOptions[2]);
    });

    test("Android: a tag em outro base plan da mesma assinatura também vale; tag inexistente pula", async () => {
        state.os = "android";
        const {mensal, anual} = playPremium();
        store.catalog = [mensal, anual];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium", productPlanIdentifier: "mensal", expiresInDays: -3, willRenew: false})]);
        const other = await resolve("expired", [{type: "discount", android_offer_tag: "winback-anual"}]);
        expect(other.offers[0]).toMatchObject({price: {formatted: "R$ 99,90"}, originalPrice: {formatted: "R$ 199,90"}, discountPeriod: {unit: "year", count: 1}, store: {kind: "option", product: anual}});
        const none = await resolve("expired", [{type: "discount", android_offer_tag: "retention-70"}]);
        expect(none.skipped).toEqual([{name: "discount", type: "discount", reason: "offer_not_found"}]);
    });

    test("Android: tag só no base plan não é desconto; loja de teste (sem tags) pula", async () => {
        state.os = "android";
        const {mensal} = playPremium();
        mensal.subscriptionOptions[1].tags = ["retention-50"]; // a tag no base plan aparece nele e nas ofertas
        mensal.subscriptionOptions[2].tags = [];
        store.catalog = [mensal];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium", productPlanIdentifier: "mensal", expiresInDays: -3, willRenew: false})]);
        expect((await resolve("expired", [{type: "discount", android_offer_tag: "retention-50"}])).skipped[0].reason).toBe("offer_not_found");
        useTestStore("android");
        state.customerInfo = PIXEL();
        expect((await resolve("expired", [{type: "discount", android_offer_tag: "retention-50", product_id: "monthly"}])).skipped[0].reason).toBe("offer_not_found");
    });
});

describe("winback", () => {
    const winbackOffer = {identifier: "volta_50", price: 9.9, priceString: "R$ 9,90", cycles: 2, period: "P1M", periodUnit: "MONTH", periodNumberOfUnits: 1};

    test("iOS: a 1ª oferta elegível (preço, riscado, período) e a compra com purchaseProductWithWinBackOffer", async () => {
        state.os = "ios";
        const product = appStorePremium();
        store.catalog = [product];
        store.winback = [winbackOffer];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium_mensal", expiresInDays: -10, willRenew: false})]);
        const {offers} = await resolve("expired", ["winback"]);
        expect(offers[0]).toMatchObject({
            name: "winback",
            action: "purchase",
            price: {amount: 9.9, currency: "BRL", formatted: "R$ 9,90"},
            originalPrice: {formatted: "R$ 19,90"},
            discountPeriod: {unit: "month", count: 2},
            store: {kind: "winback", product, offer: winbackOffer},
        });
        await purchaseRetentionOffer(offers[0]);
        expect(callsOf("purchaseProductWithWinBackOffer")[0]).toEqual(["purchaseProductWithWinBackOffer", product, winbackOffer]);
    });

    test("iOS: vazio, undefined (iOS antigo) ou erro: pula", async () => {
        state.os = "ios";
        store.catalog = [appStorePremium()];
        state.customerInfo = customerInfo([entitlement({productIdentifier: "premium_mensal", expiresInDays: -10, willRenew: false})]);
        store.winback = [];
        expect((await resolve("expired", ["winback"])).skipped[0].reason).toBe("not_eligible");
        store.winback = undefined;
        expect((await resolve("expired", ["winback"])).skipped[0].reason).toBe("not_eligible");
        store.winbackError = new Error("Win-back offers require iOS 18");
        expect((await resolve("expired", ["winback"])).skipped[0]).toMatchObject({reason: "store_error", detail: "Win-back offers require iOS 18"});
    });

    test("Android: não existe (nem chama a loja)", async () => {
        useTestStore("android");
        state.customerInfo = PIXEL();
        expect((await resolve("expired", ["winback"])).skipped).toEqual([{name: "winback", type: "winback", reason: "unsupported_platform"}]);
        expect(callNames()).toEqual([]);
    });
});

describe("offer_code", () => {
    test("iOS: link da App Store com o código (App ID do Remote Config); sem App ID ou sem código, a folha", async () => {
        state.os = "ios";
        (globalThis as any).remoteConfigUtils = {ios_app_id: "1234567890"};
        const withLink = await resolve("expired", [{name: "promo_code", type: "offer_code", ios_code: "COMEBACK50", android_code: "VOLTA"}]);
        expect(withLink.offers[0]).toMatchObject({action: "redeem", code: "COMEBACK50", store: {kind: "redeem", url: "https://apps.apple.com/redeem?ctx=offercodes&id=1234567890&code=COMEBACK50"}});
        (globalThis as any).remoteConfigUtils = {};
        const sheet = await resolve("expired", [{type: "offer_code", ios_code: "COMEBACK50"}]);
        expect(sheet.offers[0]).toMatchObject({code: "COMEBACK50", store: {kind: "redeem", url: null}});
        const noCode = await resolve("expired", [{type: "offer_code", android_code: "VOLTA"}]);
        expect(noCode.offers[0].code).toBeUndefined(); // o código do Android não aparece no iOS
        expect(noCode.offers[0].store).toEqual({kind: "redeem", url: null});
        expect(callNames()).toEqual([]);
    });

    test("Android: precisa do android_code (link do Play); sem ele, pula", async () => {
        state.os = "android";
        const {offers} = await resolve("free", [{type: "offer_code", ios_code: "IOS", android_code: "VOLTA 50"}]);
        expect(offers[0]).toMatchObject({action: "redeem", code: "VOLTA 50", store: {kind: "redeem", url: "https://play.google.com/redeem?code=VOLTA%2050"}});
        expect((await resolve("free", [{type: "offer_code", ios_code: "IOS"}])).skipped[0]).toEqual({name: "offer_code", type: "offer_code", reason: "missing_code"});
    });

    test("App ID: número ou 'id…'; inválido = folha", () => {
        expect(appleOfferCodeUrl("id123", "A B")).toBe("https://apps.apple.com/redeem?ctx=offercodes&id=123&code=A%20B");
        expect(appleOfferCodeUrl(undefined, "X")).toBeNull();
        expect(appleOfferCodeUrl("abc", "X")).toBeNull();
        expect(appleOfferCodeUrl("123", "  ")).toBeNull();
    });
});

describe("ordem, motivos e limite de 2", () => {
    test("nome desconhecido e o catálogo de exemplo da pré-visualização não valem; Remote Config vale", async () => {
        useTestStore("ios");
        const {offers, skipped} = await resolve("free", ["nao_existe", "lifetime_deal", "discount_50", "", "vitalicio"], {remoteOffers: {vitalicio: {type: "lifetime"}}});
        expect(skipped).toEqual([
            {name: "nao_existe", type: null, reason: "unknown_offer"},
            {name: "lifetime_deal", type: null, reason: "unknown_offer"},
            {name: "discount_50", type: null, reason: "unknown_offer"},
            {name: "(vazio)", type: null, reason: "unknown_offer"},
        ]);
        expect(offers.map((offer) => [offer.name, offer.type])).toEqual([["vitalicio", "lifetime"]]);
    });

    test("pula a que a loja não tem e segue; para em 2 válidas (a 3ª nem é conferida)", async () => {
        useTestStore("ios");
        state.customerInfo = PIXEL();
        const {offers, skipped} = await resolve("expired", [
            {name: "discount_50", type: "discount", ios_offer_id: "retention_50", product_id: "monthly"},
            "resubscribe",
            "lifetime",
            {type: "subscription", product_id: "yearly"},
        ]);
        expect(RETENTION_MAX_OFFERS).toBe(2);
        expect(skipped).toEqual([{name: "discount_50", type: "discount", reason: "offer_not_found"}]);
        expect(offers.map((offer) => offer.name)).toEqual(["resubscribe", "lifetime"]);
        expect(callsOf("getProducts").map((call) => call[1][0])).not.toContain("yearly");
    });

    test("duas ofertas do mesmo produto: uma chamada à loja só", async () => {
        useTestStore("ios");
        state.customerInfo = PIXEL();
        await resolve("expired", ["resubscribe", {type: "subscription", product_id: "monthly"}]);
        expect(callsOf("getProducts")).toHaveLength(1);
    });

    test("sem lista: nada; nunca lança mesmo com a loja fora", async () => {
        useTestStore("ios");
        expect(await resolve("expired", [])).toEqual({offers: [], skipped: [], previous: null});
        store.productsError = new Error("x");
        store.offeringsError = new Error("y");
        const result = await resolve("expired", ["lifetime", {type: "subscription", product_id: "yearly"}]);
        expect(result.offers).toEqual([]);
        expect(result.skipped.map((item) => item.reason)).toEqual(["store_error", "store_error"]);
    });
});

describe("compra", () => {
    test("comprou e liberou o Premium: purchased, premium e @isPremium gravado (como o PaywallUtils)", async () => {
        const shop = useTestStore("ios");
        store.purchaseInfo = PREMIUM();
        const result = await purchaseRetentionOffer({name: "lifetime", type: "lifetime", store: {kind: "product", product: shop.lifetime}});
        expect(result).toEqual({status: "purchased", customerInfo: store.purchaseInfo, premium: true, productIdentifier: "lifetime"});
        expect(state.storage.get("@isPremium")).toBe("true");
    });

    test("comprou mas o produto não está em entitlement nenhum: purchased sem Premium (não grava @isPremium)", async () => {
        const shop = useTestStore("ios");
        store.purchaseInfo = customerInfo();
        expect(await purchaseRetentionOffer({name: "lifetime", type: "lifetime", store: {kind: "product", product: shop.lifetime}})).toMatchObject({status: "purchased", premium: false});
        expect(state.storage.has("@isPremium")).toBe(false);
    });

    test("erros: cancelou (userCancelled ou código 1), pendente (20), falhou (42 da loja de teste, sem código)", async () => {
        const shop = useTestStore("ios");
        const offer = {name: "lifetime", type: "lifetime" as const, store: {kind: "product" as const, product: shop.lifetime}};
        store.purchaseError = {code: "1", userCancelled: true, message: "Purchase was cancelled."};
        expect(await purchaseRetentionOffer(offer)).toEqual({status: "cancelled"});
        store.purchaseError = {code: "20", userCancelled: false, message: "The payment is pending."};
        expect(await purchaseRetentionOffer(offer)).toEqual({status: "pending"});
        store.purchaseError = {code: "42", userCancelled: false, message: "Purchase failure simulated successfully in Test Store."};
        expect(await purchaseRetentionOffer(offer)).toEqual({status: "failed", code: "42", message: "Purchase failure simulated successfully in Test Store."});
        store.purchaseError = new Error("boom");
        expect(await purchaseRetentionOffer(offer)).toEqual({status: "failed", code: "unknown", message: "boom"});
        expect(state.storage.has("@isPremium")).toBe(false);
    });

    test("mapeamento direto do erro do SDK", () => {
        expect(mapRetentionPurchaseError({userCancelled: true})).toEqual({status: "cancelled"});
        expect(mapRetentionPurchaseError({code: "1", userCancelled: null})).toEqual({status: "cancelled"});
        expect(mapRetentionPurchaseError({code: "20"})).toEqual({status: "pending"});
        expect(mapRetentionPurchaseError({code: "6", message: "This product is already active for the user."})).toEqual({status: "failed", code: "6", message: "This product is already active for the user."});
        expect(mapRetentionPurchaseError(undefined)).toMatchObject({status: "failed", code: "unknown"});
    });

    test("oferta sem compra conferida (reativar, código, pré-visualização): falha sem chamar a loja", async () => {
        expect(await purchaseRetentionOffer({name: "resubscribe", type: "resubscribe", store: {kind: "manage"}})).toMatchObject({status: "failed", code: "not_purchasable"});
        expect(await purchaseRetentionOffer({name: "x", type: "lifetime"})).toMatchObject({status: "failed", code: "not_purchasable"});
        expect(callNames()).toEqual([]);
    });
});

describe("resgate do código", () => {
    test("link da loja; iOS sem link: folha da Apple; Android sem link: nada", async () => {
        state.os = "ios";
        expect(await redeemRetentionCode({name: "c", type: "offer_code", store: {kind: "redeem", url: "https://apps.apple.com/redeem?ctx=offercodes&id=1&code=A"}})).toEqual({ok: true, method: "link"});
        expect(callsOf("openURL")).toEqual([["openURL", "https://apps.apple.com/redeem?ctx=offercodes&id=1&code=A"]]);
        expect(await redeemRetentionCode({name: "c", type: "offer_code", store: {kind: "redeem", url: null}})).toEqual({ok: true, method: "sheet"});
        expect(callNames()).toContain("presentCodeRedemptionSheet");
        state.calls.length = 0;
        state.os = "android";
        expect(await redeemRetentionCode({name: "c", type: "offer_code", store: {kind: "redeem", url: null}})).toEqual({ok: false, method: null});
        expect(callNames()).toEqual([]);
    });

    test("link que não abre: no iOS cai na folha; no Android avisa", async () => {
        state.os = "ios";
        store.openURLError = new Error("no handler");
        expect(await redeemRetentionCode({name: "c", type: "offer_code", store: {kind: "redeem", url: "https://x"}})).toEqual({ok: true, method: "sheet"});
        state.os = "android";
        expect(await redeemRetentionCode({name: "c", type: "offer_code", store: {kind: "redeem", url: "https://play.google.com/redeem?code=A"}})).toEqual({ok: false, method: "link"});
        expect(state.warns.length).toBeGreaterThan(0);
    });
});

describe("analytics (fora da pré-visualização)", () => {
    const request = (over: Record<string, any> = {}): any => ({
        id: 7,
        segment: "expired",
        variant: "premium_lost",
        state: "offer",
        style: "bottomsheet",
        offers: [
            {name: "discount_50", type: "discount", price: {amount: 9.9, currency: "BRL", formatted: "R$ 9,90"}, originalPrice: {amount: 19.9, currency: "BRL"}, store: {kind: "option", product: {identifier: "premium:mensal"}}},
            {name: "lifetime", type: "lifetime", price: {amount: 99.99, currency: "USD"}},
        ],
        ...over,
    });

    test("retention_impression 1x por pedido, com a oferta principal; pré-visualização não conta", () => {
        logRetentionImpression(request());
        logRetentionImpression(request()); // mesmo id (host remontou)
        logRetentionImpression(request({id: 8, preview: true}));
        expect(eventsOf("retention_impression").map((event) => event.params)).toEqual([
            {segment: "expired", variant: "premium_lost", style: "bottomsheet", offer_type: "discount", offer_id: "discount_50", product_id: "premium:mensal", price: 9.9, price_currency: "BRL", discount_pct: 50, secondary_offer_id: "lifetime"},
        ]);
    });

    test("retention_purchase: preço em price/price_currency (nunca value/currency), produto da loja, premium 1/0", () => {
        const req = request();
        logRetentionPurchase(req, req.offers[0], {premium: true, productIdentifier: "premium:mensal"});
        const params = eventsOf("retention_purchase")[0].params;
        expect(params).toEqual({segment: "expired", style: "bottomsheet", offer_type: "discount", offer_id: "discount_50", product_id: "premium:mensal", price: 9.9, price_currency: "BRL", discount_pct: 50, premium: 1});
        expect(Object.keys(params)).not.toContain("currency");
        expect(Object.keys(params)).not.toContain("value");
    });

    test("retention_purchase_error, retention_click, retention_close e retention_offer_unavailable", () => {
        const req = request();
        logRetentionPurchaseError(req, req.offers[1], {status: "failed", code: "42", message: "simulada"});
        logRetentionPurchaseError(req, req.offers[1], {status: "pending", code: "20"});
        logRetentionClick(req, "purchase", req.offers[1], "secondary");
        logRetentionClick(req, "confirm");
        logRetentionClose(req, "purchased");
        logRetentionClose({...req, preview: true}, "dismiss");
        logRetentionOfferUnavailable("expired", [
            {name: "discount_50", type: "discount", reason: "offer_not_found"},
            {name: "winback", type: "winback", reason: "store_error", detail: "iOS 18"},
        ]);
        expect(eventsOf("retention_purchase_error").map((event) => [event.params.status, event.params.code, event.params.offer_id])).toEqual([
            ["failed", "42", "lifetime"],
            ["pending", "20", "lifetime"],
        ]);
        expect(eventsOf("retention_click").map((event) => [event.params.action, event.params.role ?? null, event.params.offer_id ?? null])).toEqual([
            ["purchase", "secondary", "lifetime"],
            ["confirm", null, null],
        ]);
        expect(eventsOf("retention_close").map((event) => event.params)).toEqual([{segment: "expired", style: "bottomsheet", close_method: "purchased", offer_type: "discount", offer_id: "discount_50"}]);
        // `style` em todo evento do modal (o `retention_offer_unavailable` sai antes de abrir, sem formato)
        for (const name of ["retention_purchase_error", "retention_click"]) for (const event of eventsOf(name)) expect(event.params.style).toBe("bottomsheet");
        expect(eventsOf("retention_offer_unavailable").map((event) => event.params)).toEqual([
            {segment: "expired", offer_id: "discount_50", offer_type: "discount", reason: "offer_not_found"},
            {segment: "expired", offer_id: "winback", offer_type: "winback", reason: "store_error", detail: "iOS 18"},
        ]);
        for (const event of state.events) expect(event.name.length).toBeLessThanOrEqual(40);
    });
});

describe("tela com as ofertas da loja", () => {
    test("a ação vem da conferência (Android: reativar comprando); textos de compra que falhou/pendente", async () => {
        const shop = useTestStore("android");
        state.customerInfo = customerInfo([entitlement({...CANCELLED, productIdentifier: "monthly", productPlanIdentifier: "testBasePlanId", expiresInDays: 9})]);
        const {offers} = await resolve("cancelled", ["resubscribe", "lifetime"]);
        const view = buildRetentionView({segment: "cancelled", variant: "premium_lost", offers, language: "pt", appName: "Lab"});
        expect(view.primary).toMatchObject({ctaKey: "reactivate", cta: "Reativar", action: "purchase", card: null});
        expect(view.primary.offer.store).toEqual({kind: "product", product: shop.monthly});
        expect(view.secondary).toMatchObject({ctaKey: "lifetime", action: "purchase", card: {kind: "lifetime", price: "US$ 99,99"}});
        expect(view.purchase).toEqual({error: "Não deu para concluir a compra. Tente de novo.", pending: "Pagamento pendente. O Premium libera assim que a loja confirmar."});
        // sem a ação da loja (pré-visualização): tipo × segmento, como antes
        const preview = buildRetentionView({segment: "cancelled", variant: "premium_lost", offers: [{name: "resubscribe", type: "resubscribe"}], language: "pt", appName: "Lab"});
        expect(preview.primary.action).toBe("reactivate");
    });
});

// Datas das fixtures: o NOW delas (24/09) é anterior ao relógio real; nada aqui depende do "agora".
test("fixtures coerentes", () => {
    expect(iso(NOW + DAY)).toBe("2026-09-25T12:00:00.000Z");
});
