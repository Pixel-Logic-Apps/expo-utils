import {afterEach, beforeEach, describe, expect, test} from "bun:test";
import {CANCELLED, customerInfo, entitlement} from "./helpers/rc-fixtures";
import {testStore} from "./helpers/rc-store-fixtures";
import {installStoreMocks, resetStore, store} from "./helpers/rc-store-mock";
import {callNames, eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
installStoreMocks();

const {showRetention} = await import("../utils/retention-show");
const {RetentionEvents} = await import("../utils/retention-events");

/** O cliente do Pixel no lab (08/10/2026): monthly da loja de teste, vencido em 24/09. */
const PIXEL = () =>
    customerInfo(
        [
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
        ],
        {managementURL: "https://play.google.com/store/account/subscriptions"},
    );

const setRetention = (retention: Record<string, any> | undefined) => {
    (globalThis as any).remoteConfigUtils = retention === undefined ? {} : {retention};
};

beforeEach(() => {
    resetStore();
    state.os = "android";
    const shop = testStore("android");
    store.catalog = [shop.monthly, shop.yearly, shop.lifetime];
    store.offerings = shop.offerings;
    state.customerInfo = PIXEL();
    setRetention(undefined);
});

afterEach(() => {
    RetentionEvents.hide();
    resetStore();
});

describe("showRetention: quando não abre", () => {
    test("retention.enabled false desliga (nem lê o RevenueCat), mesmo com ofertas do app", async () => {
        setRetention({enabled: false, segments: {expired: {offers: ["resubscribe"]}}});
        expect(await showRetention({offers: ["lifetime"]})).toEqual({request: null, segment: null, skipped: [], reason: "disabled"});
        expect(callNames()).toEqual([]);
        expect(RetentionEvents.isVisible()).toBe(false);
    });

    test("RevenueCat fora (sem customerInfo): não abre", async () => {
        store.customerInfoError = new Error("There is no singleton instance");
        expect((await showRetention({offers: ["lifetime"]})).reason).toBe("rc_unavailable");
        expect(RetentionEvents.isVisible()).toBe(false);
    });

    test("pagante renovando: não é segmento de retenção", async () => {
        state.customerInfo = customerInfo([entitlement({identifier: "expoutils_lab_pro", productIdentifier: "monthly"})]);
        const result = await showRetention({offers: ["lifetime"]});
        expect(result).toMatchObject({request: null, segment: "active", reason: "not_retention_segment"});
        expect(callNames()).toEqual(["getCustomerInfo"]);
    });

    test("Premium ativo não recebe oferta: vitalício ativo + assinatura cancelada (o rc_status diz cancelled)", async () => {
        state.customerInfo = customerInfo([
            entitlement({identifier: "premium", productIdentifier: "monthly", ...CANCELLED}),
            entitlement({identifier: "remove_ads", productIdentifier: "lifetime", expiresInDays: null, willRenew: false}),
        ]);
        setRetention({segments: {cancelled: {offers: ["resubscribe"]}}});
        expect(await showRetention()).toMatchObject({request: null, segment: "cancelled", reason: "premium"});
    });

    test("sem lista de ofertas para o segmento (nem do app nem do Remote Config): não abre", async () => {
        expect((await showRetention()).reason).toBe("no_offers");
        setRetention({segments: {trial_cancelled: {offers: ["resubscribe"]}, expired: {offers: []}}});
        expect(await showRetention()).toMatchObject({segment: "expired", reason: "no_offers"});
        expect(RetentionEvents.isVisible()).toBe(false);
    });

    test("nenhuma oferta válida na loja: não abre, devolve os motivos e manda retention_offer_unavailable", async () => {
        const result = await showRetention({offers: [{name: "discount_50", type: "discount", android_offer_tag: "retention-50"}, "winback", "nao_existe"]});
        expect(result).toMatchObject({request: null, segment: "expired", reason: "no_valid_offers"});
        expect(result.skipped).toEqual([
            {name: "discount_50", type: "discount", reason: "offer_not_found"},
            {name: "winback", type: "winback", reason: "unsupported_platform"},
            {name: "nao_existe", type: null, reason: "unknown_offer"},
        ]);
        expect(eventsOf("retention_offer_unavailable").map((event) => [event.params.offer_id, event.params.reason, event.params.segment])).toEqual([
            ["discount_50", "offer_not_found", "expired"],
            ["winback", "unsupported_platform", "expired"],
            ["nao_existe", "unknown_offer", "expired"],
        ]);
        expect(RetentionEvents.isVisible()).toBe(false);
    });

    test("nunca lança (erro inesperado vira reason error)", async () => {
        Object.defineProperty(globalThis, "remoteConfigUtils", {
            configurable: true,
            get() {
                throw new Error("Remote Config quebrado");
            },
        });
        try {
            expect((await showRetention()).reason).toBe("error");
        } finally {
            Object.defineProperty(globalThis, "remoteConfigUtils", {configurable: true, writable: true, value: {}});
        }
        expect(state.warns.some((warn) => String(warn[0]).includes("showRetention"))).toBe(true);
    });
});

describe("showRetention: quando abre", () => {
    test("lista do Remote Config para o segmento real (vencido), ofertas conferidas e o pedido completo", async () => {
        setRetention({segments: {expired: {offers: ["volta", "lifetime"]}}, offers: {volta: {type: "resubscribe"}}});
        const result = await showRetention();
        expect(result.reason).toBeNull();
        expect(result.segment).toBe("expired");
        expect(result.skipped).toEqual([]);
        const request = result.request!;
        expect(RetentionEvents.getCurrent()).toBe(request);
        expect(request).toMatchObject({
            segment: "expired",
            state: "offer",
            variant: "premium_lost",
            productIdentifier: "monthly",
            expirationDate: "2026-09-24T21:39:28.000Z",
            managementURL: "https://play.google.com/store/account/subscriptions",
            defaultBullets: false,
        });
        expect(request.preview).toBeUndefined();
        expect(request.offers.map((offer) => [offer.name, offer.type, offer.action, offer.price?.formatted])).toEqual([
            ["volta", "resubscribe", "purchase", "US$ 9,99"],
            ["lifetime", "lifetime", "purchase", "US$ 99,99"],
        ]);
    });

    test("ofertas do app vencem a lista do Remote Config; opções de tela passam para o pedido", async () => {
        setRetention({segments: {expired: {offers: ["resubscribe"]}}, is_opted_out_trial_enabled: true});
        const result = await showRetention({offers: ["lifetime"], locale: "ar", imageUrl: "https://example.com/r.png", defaultBullets: true, variant: "premium_kept"});
        expect(result.request?.offers.map((offer) => offer.name)).toEqual(["lifetime"]);
        expect(result.request).toMatchObject({locale: "ar", imageUrl: "https://example.com/r.png", defaultBullets: true, variant: "premium_kept"});
    });

    test("pula a oferta que a loja não tem e abre com as próximas (no máximo 2)", async () => {
        const result = await showRetention({offers: [{name: "discount_50", type: "discount", android_offer_tag: "retention-50"}, "resubscribe", "lifetime", {type: "subscription", product_id: "yearly"}]});
        expect(result.reason).toBeNull();
        expect(result.skipped.map((item) => [item.name, item.reason])).toEqual([["discount_50", "offer_not_found"]]);
        expect(result.request?.offers.map((offer) => offer.name)).toEqual(["resubscribe", "lifetime"]);
        expect(eventsOf("retention_offer_unavailable")).toHaveLength(1);
    });

    test("segmento forçado abre mesmo com Premium ativo (lab)", async () => {
        state.customerInfo = customerInfo([entitlement({identifier: "expoutils_lab_pro", productIdentifier: "lifetime", expiresInDays: null, willRenew: false})]);
        const result = await showRetention({segment: "billing_issue", offers: ["resubscribe", "lifetime"]});
        expect(result.reason).toBeNull();
        expect(result.request?.segment).toBe("billing_issue");
        expect(result.request?.offers.map((offer) => [offer.name, offer.action])).toEqual([
            ["resubscribe", "update_payment"],
            ["lifetime", "purchase"],
        ]);
    });

    test("cliente que nunca assinou (iPhone do lab): segmento free real; forçado como vencido com o override do produto", async () => {
        state.os = "ios";
        const shop = testStore("ios");
        store.catalog = [shop.monthly, shop.yearly, shop.lifetime];
        store.offerings = shop.offerings;
        state.customerInfo = customerInfo();
        setRetention({segments: {free: {offers: ["lifetime"]}}});
        const free = await showRetention();
        expect(free).toMatchObject({segment: "free", reason: null});
        expect(free.request?.offers.map((offer) => offer.name)).toEqual(["lifetime"]);

        const withoutOverride = await showRetention({segment: "expired", offers: ["resubscribe"]});
        expect(withoutOverride).toMatchObject({reason: "no_valid_offers", skipped: [{name: "resubscribe", type: "resubscribe", reason: "no_previous_product"}]});
        const forced = await showRetention({segment: "expired", offers: ["resubscribe", "lifetime"], productIdentifier: "monthly"});
        expect(forced.request?.productIdentifier).toBe("monthly");
        expect(forced.request?.offers.map((offer) => [offer.name, offer.action, offer.price?.formatted])).toEqual([
            ["resubscribe", "purchase", "US$ 9,99"],
            ["lifetime", "purchase", "US$ 99,99"],
        ]);
    });
});
