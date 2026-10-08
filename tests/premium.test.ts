import {afterEach, describe, expect, test} from "bun:test";
import {BILLING, CANCELLED, NOW, customerInfo, entitlement} from "./helpers/rc-fixtures";
import {callNames, installMocks, state} from "./helpers/rn-mocks";

installMocks();
// Produção: o veredito vem do RevenueCat (em __DEV__ é o toggle @isPremium do dev menu).
(globalThis as any).__DEV__ = false;
const {PremiumUtils, isPremiumEntitlement} = await import("../utils/PremiumUtils");
const {getRevenueCatStatus} = await import("../utils/rc-status");

// willRenew como os SDKs do RevenueCat calculam (iOS EntitlementInfo.willRenewWithExpirationDate /
// Android EntitlementInfoHelper.getWillRenew): falso em vitalício, PREPAID, promocional, cancelado e
// falha de cobrança.
const CASES: Array<[string, Record<string, any>, boolean]> = [
    ["assinatura normal renovando", entitlement(), true],
    ["compra vitalícia (remover anúncios, sem expirationDate)", entitlement({identifier: "remove_ads", productIdentifier: "remove_ads", expiresInDays: null, willRenew: false}), true],
    ["plano pré-pago do Play (PREPAID)", entitlement({periodType: "PREPAID", willRenew: false}), true],
    ["concessão promocional com prazo", entitlement({store: "PROMOTIONAL", willRenew: false, productIdentifier: "rc_promo_premium_monthly"}), true],
    ["concessão promocional vitalícia", entitlement({store: "PROMOTIONAL", willRenew: false, expiresInDays: null}), true],
    ["trial renovando", entitlement({periodType: "TRIAL"}), true],
    ["intro renovando", entitlement({periodType: "INTRO"}), true],
    ["assinatura cancelada (ainda dentro do período pago)", entitlement(CANCELLED), false],
    ["falha de cobrança (carência, ainda ativo)", entitlement({...BILLING, expiresInDays: 5}), false],
    ["trial cancelado", entitlement({periodType: "TRIAL", ...CANCELLED}), false],
    ["vencida (fora do active)", entitlement({expiresInDays: -3, willRenew: false}), false],
];

describe("isPremiumEntitlement", () => {
    for (const [name, value, premium] of CASES) {
        test(`${name} → ${premium ? "Premium" : "sem Premium"}`, () => {
            expect(isPremiumEntitlement(value as any)).toBe(premium);
        });
    }

    test("mesmo veredito do rc_status: Premium ⇔ trial / intro / active", () => {
        for (const [name, value] of CASES) {
            const status = getRevenueCatStatus(customerInfo([value]), NOW);
            expect(isPremiumEntitlement(value as any), `${name} (rc_status = ${status})`).toBe(["trial", "intro", "active"].includes(status));
        }
    });

    test("nada / null não é Premium", () => {
        expect(isPremiumEntitlement(null)).toBe(false);
        expect(isPremiumEntitlement(undefined)).toBe(false);
    });
});

describe("PremiumUtils.getIsPremiumStatus (produção)", () => {
    afterEach(() => {
        state.customerInfo = null;
        state.rcActive = true;
        state.calls.length = 0;
        state.storage.clear();
        (globalThis as any).__DEV__ = false;
        (globalThis as any).remoteConfigUtils = {};
    });

    test("comprou o vitalício: Premium (antes voltava a ver anúncios)", async () => {
        state.customerInfo = customerInfo([entitlement({identifier: "remove_ads", expiresInDays: null, willRenew: false})]);
        expect(await PremiumUtils.getIsPremiumStatus()).toBe(true);
    });

    test("vitalício + assinatura cancelada: o vitalício segura o Premium", async () => {
        const removeAds = entitlement({identifier: "remove_ads", productIdentifier: "remove_ads", expiresInDays: null, willRenew: false});
        state.customerInfo = customerInfo([removeAds, entitlement(CANCELLED)]);
        expect(await PremiumUtils.getIsPremiumStatus()).toBe(true);
    });

    test("cancelou / falha de cobrança / trial cancelado: sem Premium (regra mantida)", async () => {
        for (const value of [entitlement(CANCELLED), entitlement({...BILLING, expiresInDays: 5}), entitlement({periodType: "TRIAL", ...CANCELLED})]) {
            state.customerInfo = customerInfo([value]);
            expect(await PremiumUtils.getIsPremiumStatus()).toBe(false);
        }
    });

    test("is_opted_out_trial_enabled: ramo intocado — assinatura ativa basta, mesmo cancelada", async () => {
        (globalThis as any).remoteConfigUtils = {is_opted_out_trial_enabled: true};
        state.customerInfo = customerInfo([entitlement({periodType: "TRIAL", ...CANCELLED})]);
        expect(await PremiumUtils.getIsPremiumStatus()).toBe(true);
    });

    test("is_opted_out_trial_enabled: vitalício e promocional também são Premium (não estão em activeSubscriptions)", async () => {
        (globalThis as any).remoteConfigUtils = {is_opted_out_trial_enabled: true};
        for (const value of [
            entitlement({identifier: "remove_ads", productIdentifier: "remove_ads", expiresInDays: null, willRenew: false}),
            entitlement({store: "PROMOTIONAL", willRenew: false, expiresInDays: null}),
        ]) {
            state.customerInfo = customerInfo([value]);
            expect(state.customerInfo.activeSubscriptions).toHaveLength(0);
            expect(await PremiumUtils.getIsPremiumStatus()).toBe(true);
        }
        state.customerInfo = customerInfo([]);
        expect(await PremiumUtils.getIsPremiumStatus()).toBe(false);
    });

    test("RevenueCat fora do ar: não-Premium e nem consulta o customer", async () => {
        state.rcActive = false;
        state.customerInfo = customerInfo([entitlement()]);
        expect(await PremiumUtils.getIsPremiumStatus()).toBe(false);
        expect(callNames()).not.toContain("getCustomerInfo");
    });

    test("__DEV__: continua lendo só o toggle @isPremium", async () => {
        (globalThis as any).__DEV__ = true;
        state.customerInfo = customerInfo([entitlement({expiresInDays: null, willRenew: false})]);
        expect(await PremiumUtils.getIsPremiumStatus()).toBe(false);
        state.storage.set("@isPremium", "true");
        expect(await PremiumUtils.getIsPremiumStatus()).toBe(true);
        expect(callNames()).not.toContain("getCustomerInfo");
    });
});
