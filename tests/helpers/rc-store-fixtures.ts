// Produtos da loja no formato do SDK (PurchasesStoreProduct / SubscriptionOption / PricingPhase de
// @revenuecat/purchases-typescript-internal 19.2.0, dist/offerings.d.ts), para tests/retention-store.test.ts e
// tests/retention-show.test.ts. Os da loja de teste da RevenueCat usam os valores medidos no expo-utils-lab em
// 08/10/2026: offering "default" com monthly (US$ 9,99, P1M, base plan `testBasePlanId` sem tags), yearly
// (US$ 79,99, P1Y) e lifetime (US$ 99,99, NON_SUBSCRIPTION; CONSUMABLE no Android, NON_CONSUMABLE no iOS).

type Unit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export const sdkPeriod = (unit: Unit, value = 1) => ({unit, value, iso8601: `P${value}${unit[0]}`});

/** Fase de preço do Android. `cycles` só nas fases finitas (desconto por N cobranças). */
export const phase = (amount: number, formatted: string, {unit = "MONTH" as Unit, value = 1, cycles = null as number | null, currency = "BRL"} = {}) => ({
    billingPeriod: sdkPeriod(unit, value),
    recurrenceMode: cycles === null ? 1 : 2,
    billingCycleCount: cycles,
    price: {formatted, amountMicros: Math.round(amount * 1_000_000), currencyCode: currency},
    offerPaymentMode: null,
});

/** Opção de assinatura do Android: base plan (`id` sem ":") ou oferta (`basePlan:oferta`). A última fase é o preço cheio. */
export const option = (productId: string, id: string, phases: Array<ReturnType<typeof phase>>, tags: string[] = []) => {
    const full = phases[phases.length - 1];
    const discounted = phases.slice(0, -1);
    return {
        id,
        storeProductId: `${productId}:${id.split(":")[0]}`,
        productId,
        pricingPhases: phases,
        tags,
        isBasePlan: !id.includes(":"),
        billingPeriod: full.billingPeriod,
        isPrepaid: false,
        fullPricePhase: full,
        freePhase: discounted.find((item) => item.price.amountMicros === 0) ?? null,
        introPhase: discounted.find((item) => item.price.amountMicros > 0) ?? null,
        presentedOfferingIdentifier: null,
        presentedOfferingContext: null,
        installmentsInfo: null,
    };
};

export const storeProduct = (over: Record<string, any>): any => ({
    identifier: "produto",
    description: "",
    title: "",
    price: 0,
    priceString: "",
    pricePerWeek: null,
    pricePerMonth: null,
    pricePerYear: null,
    pricePerWeekString: null,
    pricePerMonthString: null,
    pricePerYearString: null,
    currencyCode: "USD",
    introPrice: null,
    discounts: null,
    productCategory: "SUBSCRIPTION",
    productType: "AUTO_RENEWABLE_SUBSCRIPTION",
    subscriptionPeriod: "P1M",
    defaultOption: null,
    subscriptionOptions: null,
    presentedOfferingIdentifier: null,
    presentedOfferingContext: null,
    ...over,
});

// ─── Loja de teste da RevenueCat (o que o lab mede) ───────────────────────────

const testBasePlan = (productId: string, amount: number, formatted: string, unit: Unit) => [option(productId, "testBasePlanId", [phase(amount, formatted, {unit, currency: "USD"})])];

/** `android`: com a opção única do base plan (`testBasePlanId`); iOS: sem opções, como o SDK entrega. */
export const testStore = (platform: "ios" | "android") => {
    const options = (productId: string, amount: number, formatted: string, unit: Unit) => (platform === "android" ? testBasePlan(productId, amount, formatted, unit) : null);
    const monthly = storeProduct({
        identifier: "monthly",
        price: 9.99,
        priceString: "US$ 9,99",
        pricePerWeek: 2.3,
        pricePerMonth: 9.99,
        pricePerYear: 119.88,
        subscriptionPeriod: "P1M",
        subscriptionOptions: options("monthly", 9.99, "US$ 9,99", "MONTH"),
    });
    const yearly = storeProduct({
        identifier: "yearly",
        price: 79.99,
        priceString: "US$ 79,99",
        pricePerWeek: 1.53,
        pricePerMonth: 6.67,
        pricePerYear: 79.99,
        subscriptionPeriod: "P1Y",
        subscriptionOptions: options("yearly", 79.99, "US$ 79,99", "YEAR"),
    });
    const lifetime = storeProduct({
        identifier: "lifetime",
        price: 99.99,
        priceString: "US$ 99,99",
        productCategory: "NON_SUBSCRIPTION",
        productType: platform === "android" ? "CONSUMABLE" : "NON_CONSUMABLE",
        subscriptionPeriod: null,
    });
    const pkg = (identifier: string, packageType: string, product: any) => ({identifier, packageType, product, offeringIdentifier: "default", presentedOfferingContext: {offeringIdentifier: "default", placementIdentifier: null, targetingContext: null}, webCheckoutUrl: null});
    const offering = {
        identifier: "default",
        serverDescription: "",
        metadata: {},
        availablePackages: [pkg("$rc_monthly", "MONTHLY", monthly), pkg("$rc_annual", "ANNUAL", yearly), pkg("$rc_lifetime", "LIFETIME", lifetime)],
        lifetime: pkg("$rc_lifetime", "LIFETIME", lifetime),
        annual: pkg("$rc_annual", "ANNUAL", yearly),
        sixMonth: null,
        threeMonth: null,
        twoMonth: null,
        monthly: pkg("$rc_monthly", "MONTHLY", monthly),
        weekly: null,
        webCheckoutUrl: null,
    };
    return {monthly, yearly, lifetime, offerings: {all: {default: offering}, current: offering}};
};

// ─── Play de verdade: assinatura "premium" com 2 base plans e ofertas ─────────

/**
 * Como o RevenueCat entrega uma assinatura do Play com vários base plans: um produto por base plan
 * (`premium:mensal`, `premium:anual`), cada um com o base plan e as ofertas dele em `subscriptionOptions`.
 */
export const playPremium = () => {
    const mensalFull = () => phase(19.9, "R$ 19,90");
    const mensal = storeProduct({
        identifier: "premium:mensal",
        price: 19.9,
        priceString: "R$ 19,90",
        currencyCode: "BRL",
        pricePerWeek: 4.59,
        pricePerMonth: 19.9,
        pricePerYear: 238.8,
        subscriptionPeriod: "P1M",
        subscriptionOptions: [
            // 7 dias grátis: o `defaultOption` do RevenueCat escolheria esta (por isso o base plan vai explícito).
            option("premium", "mensal:trial7", [phase(0, "Grátis", {unit: "DAY", value: 7, cycles: 1}), mensalFull()], ["trial"]),
            option("premium", "mensal", [mensalFull()]),
            option("premium", "mensal:retencao50", [phase(9.9, "R$ 9,90", {cycles: 3}), mensalFull()], ["retention-50"]),
        ],
    });
    mensal.defaultOption = mensal.subscriptionOptions[0];
    const anual = storeProduct({
        identifier: "premium:anual",
        price: 199.9,
        priceString: "R$ 199,90",
        currencyCode: "BRL",
        pricePerWeek: 3.84,
        pricePerMonth: 16.66,
        pricePerYear: 199.9,
        subscriptionPeriod: "P1Y",
        subscriptionOptions: [option("premium", "anual", [phase(199.9, "R$ 199,90", {unit: "YEAR"})]), option("premium", "anual:volta", [phase(99.9, "R$ 99,90", {unit: "YEAR", cycles: 1}), phase(199.9, "R$ 199,90", {unit: "YEAR"})], ["winback-anual"])],
    });
    anual.defaultOption = anual.subscriptionOptions[0];
    return {mensal, anual};
};

/** App Store: assinatura com a promotional offer `retention_50` (R$ 9,90 por 3 meses). */
export const appStorePremium = () =>
    storeProduct({
        identifier: "premium_mensal",
        price: 19.9,
        priceString: "R$ 19,90",
        currencyCode: "BRL",
        pricePerWeek: 4.59,
        pricePerMonth: 19.9,
        pricePerYear: 238.8,
        subscriptionPeriod: "P1M",
        discounts: [{identifier: "retention_50", price: 9.9, priceString: "R$ 9,90", cycles: 3, period: "P1M", periodUnit: "MONTH", periodNumberOfUnits: 1}],
    });
