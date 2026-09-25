import {beforeEach, describe, expect, test} from "bun:test";
import {eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
let serial = 0;
// Módulo NOVO por teste = sessão nova do app (fila e tópicos reafirmados são estado de sessão).
const load = () => import(`../utils/rc-status.ts?s=${++serial}`);
const {getRevenueCatStatus, getReachedMilestones} = await load();

const NOW = Date.parse("2026-09-24T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

// Formato real do SDK: PurchasesEntitlementInfo / CustomerInfo de
// @revenuecat/purchases-typescript-internal 19.2.0 (dist/customerInfo.d.ts).
const entitlement = ({expiresInDays = 7, ...over}: {expiresInDays?: number | null} & Record<string, any> = {}) => {
    const expiration = expiresInDays === null ? null : NOW + expiresInDays * DAY;
    return {
        identifier: "premium",
        isActive: expiration === null || expiration > NOW,
        willRenew: true,
        periodType: "NORMAL",
        latestPurchaseDate: iso(NOW - DAY),
        latestPurchaseDateMillis: NOW - DAY,
        originalPurchaseDate: iso(NOW - 30 * DAY),
        originalPurchaseDateMillis: NOW - 30 * DAY,
        expirationDate: expiration === null ? null : iso(expiration),
        expirationDateMillis: expiration,
        store: "PLAY_STORE",
        productIdentifier: "premium_mensal",
        productPlanIdentifier: "mensal",
        isSandbox: false,
        unsubscribeDetectedAt: null,
        unsubscribeDetectedAtMillis: null,
        billingIssueDetectedAt: null,
        billingIssueDetectedAtMillis: null,
        ownershipType: "PURCHASED",
        verification: "NOT_REQUESTED",
        ...over,
    };
};

const subscription = (over: Record<string, any> = {}) => ({
    productIdentifier: "premium_mensal",
    purchaseDate: iso(NOW - DAY),
    originalPurchaseDate: iso(NOW - 30 * DAY),
    expiresDate: iso(NOW - DAY),
    store: "PLAY_STORE",
    unsubscribeDetectedAt: null,
    isSandbox: false,
    billingIssuesDetectedAt: null,
    gracePeriodExpiresDate: null,
    ownershipType: "PURCHASED",
    periodType: "NORMAL",
    refundedAt: null,
    storeTransactionId: "GPA.3300-0000",
    isActive: false,
    willRenew: false,
    ...over,
});

const customerInfo = (entitlements: Array<Record<string, any>> = [], extra: Record<string, any> = {}): any => ({
    entitlements: {
        all: Object.fromEntries(entitlements.map((e) => [e.identifier, e])),
        active: Object.fromEntries(entitlements.filter((e) => e.isActive).map((e) => [e.identifier, e])),
        verification: "NOT_REQUESTED",
    },
    activeSubscriptions: entitlements.filter((e) => e.isActive && e.expirationDate).map((e) => e.productIdentifier),
    allPurchasedProductIdentifiers: entitlements.map((e) => e.productIdentifier),
    latestExpirationDate: null,
    firstSeen: iso(NOW - 60 * DAY),
    originalAppUserId: "$RCAnonymousID:de39831ab3284a198b7310d7411cddcc",
    requestDate: iso(NOW),
    allExpirationDates: {},
    allPurchaseDates: {},
    originalApplicationVersion: null,
    originalPurchaseDate: null,
    managementURL: null,
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
    ...extra,
});

const CANCELLED = {willRenew: false, unsubscribeDetectedAt: iso(NOW - DAY), unsubscribeDetectedAtMillis: NOW - DAY};
const BILLING = {willRenew: false, billingIssueDetectedAt: iso(NOW - DAY), billingIssueDetectedAtMillis: NOW - DAY};
const status = (info: any) => getRevenueCatStatus(info, NOW);

describe("estado", () => {
    test("nunca comprou → free (inclusive sem customerInfo)", () => {
        expect(status(customerInfo())).toBe("free");
        expect(status(null)).toBe("free");
        expect(status(undefined)).toBe("free");
    });

    test("trial: renovação ligada → trial; desligada → trial_cancelled", () => {
        expect(status(customerInfo([entitlement({periodType: "TRIAL"})]))).toBe("trial");
        expect(status(customerInfo([entitlement({periodType: "TRIAL", ...CANCELLED})]))).toBe("trial_cancelled");
    });

    test("cobrança do fim do trial que falhou (carência) → billing_issue, não trial", () => {
        expect(status(customerInfo([entitlement({periodType: "TRIAL", ...BILLING, expiresInDays: 3})]))).toBe("billing_issue");
    });

    test("intro: ligado → intro; cancelado → cancelled", () => {
        expect(status(customerInfo([entitlement({periodType: "INTRO"})]))).toBe("intro");
        expect(status(customerInfo([entitlement({periodType: "INTRO", ...CANCELLED})]))).toBe("cancelled");
    });

    test("pago sem cancelar → active (NORMAL, PREPAID sem renovação, vitalício, promocional)", () => {
        expect(status(customerInfo([entitlement()]))).toBe("active");
        expect(status(customerInfo([entitlement({periodType: "PREPAID", willRenew: false})]))).toBe("active");
        expect(status(customerInfo([entitlement({expiresInDays: null})]))).toBe("active");
        expect(status(customerInfo([entitlement({store: "PROMOTIONAL", willRenew: false})]))).toBe("active");
    });

    test("pago com renovação desligada → cancelled; com falha de cobrança → billing_issue", () => {
        expect(status(customerInfo([entitlement(CANCELLED)]))).toBe("cancelled");
        expect(status(customerInfo([entitlement({...BILLING, expiresInDays: 5})]))).toBe("billing_issue");
    });

    test("falha de cobrança SEM acesso: billing_issue até 60 dias, depois expirou", () => {
        expect(status(customerInfo([entitlement({...BILLING, expiresInDays: -10})]))).toBe("billing_issue");
        expect(status(customerInfo([entitlement({periodType: "TRIAL", ...BILLING, expiresInDays: -10})]))).toBe("billing_issue");
        expect(status(customerInfo([entitlement({...BILLING, expiresInDays: -61})]))).toBe("expired");
        expect(status(customerInfo([entitlement({periodType: "TRIAL", ...BILLING, expiresInDays: -61})]))).toBe("trial_expired");
    });

    test("trial que acabou sem pagar → trial_expired; período pago que acabou → expired", () => {
        expect(status(customerInfo([entitlement({periodType: "TRIAL", ...CANCELLED, expiresInDays: -2})]))).toBe("trial_expired");
        expect(status(customerInfo([entitlement({...CANCELLED, expiresInDays: -5})]))).toBe("expired");
    });

    test("reembolso → refunded (regra anterior mantida)", () => {
        const info = customerInfo([entitlement({expiresInDays: -3})], {subscriptionsByProductIdentifier: {premium_mensal: subscription({refundedAt: iso(NOW - 3 * DAY)})}});
        expect(status(info)).toBe("refunded");
    });

    test("compra fora de entitlement → expired (regra anterior mantida)", () => {
        expect(status(customerInfo([], {allPurchasedProductIdentifiers: ["moedas_100"]}))).toBe("expired");
    });

    test("vitalício + trial de assinatura → trial (a assinatura decide o ciclo)", () => {
        const removeAds = entitlement({identifier: "remove_ads", productIdentifier: "remove_ads", expiresInDays: null});
        expect(status(customerInfo([removeAds, entitlement({periodType: "TRIAL"})]))).toBe("trial");
    });

    test("duas assinaturas ativas → vale a que vence por último", () => {
        const trial = entitlement({identifier: "a", periodType: "TRIAL", expiresInDays: 3});
        const paid = entitlement({identifier: "b", ...CANCELLED, expiresInDays: 20});
        expect(status(customerInfo([trial, paid]))).toBe("cancelled");
    });
});

describe("marcos", () => {
    test("trial_started: trial ativo, trial expirado ou trial só em subscriptionsByProductIdentifier", () => {
        expect(getReachedMilestones(customerInfo([entitlement({periodType: "TRIAL"})]))).toEqual(["trial_started"]);
        expect(getReachedMilestones(customerInfo([entitlement({periodType: "TRIAL", expiresInDays: -2})]))).toEqual(["trial_started"]);
        expect(getReachedMilestones(customerInfo([], {subscriptionsByProductIdentifier: {premium_mensal: subscription({periodType: "TRIAL"})}}))).toEqual([
            "trial_started",
        ]);
    });

    test("converted: trial já visto + período pago ATIVO sem falha de cobrança", () => {
        expect(getReachedMilestones(customerInfo([entitlement()]), ["trial_started"])).toEqual(["trial_started", "converted"]);
        expect(getReachedMilestones(customerInfo([entitlement({periodType: "INTRO"})]), ["trial_started"])).toEqual(["trial_started", "converted"]);
        expect(getReachedMilestones(customerInfo([entitlement({periodType: "PREPAID", willRenew: false})]), ["trial_started"])).toEqual([
            "trial_started",
            "converted",
        ]);
    });

    test("carência depois do trial e período pago expirado NÃO contam como conversão", () => {
        expect(getReachedMilestones(customerInfo([entitlement({...BILLING, expiresInDays: 3})]), ["trial_started"])).toEqual(["trial_started"]);
        expect(getReachedMilestones(customerInfo([entitlement({expiresInDays: -5})]), ["trial_started"])).toEqual(["trial_started"]);
    });

    test("compra direta (sem trial visto) não gera marco", () => {
        expect(getReachedMilestones(customerInfo([entitlement()]))).toEqual([]);
    });

    test("marco gravado nunca some, mesmo com customerInfo vazio", () => {
        expect(getReachedMilestones(customerInfo(), ["trial_started", "converted"])).toEqual(["trial_started", "converted"]);
    });
});

describe("sincronização dos tópicos", () => {
    const TRIAL = customerInfo([entitlement({periodType: "TRIAL"})]);
    const TRIAL_CANCELLED = customerInfo([entitlement({periodType: "TRIAL", ...CANCELLED})]);
    const PAID = customerInfo([entitlement()]);

    // "+tópico" = subscribe, "-tópico" = unsubscribe, na ordem em que chegaram ao SDK.
    const topicOps = () =>
        state.calls.filter(([name]) => name === "subscribeToTopic" || name === "unsubscribeFromTopic").map(([name, , topic]) => `${name === "subscribeToTopic" ? "+" : "-"}${topic}`);
    const topicEvents = () => state.events.filter((e) => e.name.startsWith("fcm_topic_")).map((e) => ({name: e.name, ...e.params}));
    const resetCalls = () => {
        state.calls.length = 0;
        state.events.length = 0;
    };

    beforeEach(() => {
        resetCalls();
        state.warns.length = 0;
        state.storage.clear();
        state.fail.clear();
        state.apnsReady = true;
        state.userProps = {};
        state.userId = undefined;
    });

    test("1ª execução: tópico de estado + marco, eventos e fatos gravados", async () => {
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL);
        expect(topicOps()).toEqual(["+lab-purchase-trial", "+lab-purchase-trial_started"]);
        expect(state.storage.get("FCM_CURRENT_TOPIC")).toBe("lab-purchase-trial");
        expect(JSON.parse(state.storage.get("@expo_utils_rc_milestones")!)).toEqual(["trial_started"]);
        expect(topicEvents()).toEqual([
            {name: "fcm_topic_subscribe", fcm_topic: "lab-purchase-trial", status: "trial"},
            {name: "fcm_topic_subscribe", fcm_topic: "lab-purchase-trial_started", milestone: "trial_started"},
        ]);
        expect(state.userProps.rc_status).toBe("trial");
        expect(state.userId).toBe("$RCAnonymousID:de39831ab3284a198b7310d7411cddcc");
    });

    test("trial → trial_cancelled troca só o tópico de estado", async () => {
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL);
        resetCalls();
        await rc.syncRcStatus("lab", TRIAL_CANCELLED);
        expect(topicOps()).toEqual(["-lab-purchase-trial", "+lab-purchase-trial_cancelled"]);
        expect(topicEvents()).toEqual([
            {name: "fcm_topic_unsubscribe", fcm_topic: "lab-purchase-trial"},
            {name: "fcm_topic_subscribe", fcm_topic: "lab-purchase-trial_cancelled", status: "trial_cancelled"},
        ]);
        expect(state.userProps.rc_status).toBe("trial_cancelled");
    });

    test("trial → pago: estado vira active e o marco converted entra (e fica gravado)", async () => {
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL);
        resetCalls();
        await rc.syncRcStatus("lab", PAID); // o período virou NORMAL: a prova do trial sumiu do customerInfo
        expect(topicOps()).toEqual(["-lab-purchase-trial", "+lab-purchase-active", "+lab-purchase-converted"]);
        expect(JSON.parse(state.storage.get("@expo_utils_rc_milestones")!)).toEqual(["trial_started", "converted"]);
        expect(eventsOf("fcm_topic_subscribe").map((e) => e.params)).toContainEqual({fcm_topic: "lab-purchase-converted", milestone: "converted"});
    });

    test("mesmo estado de novo na mesma sessão: nenhuma chamada, nenhum evento", async () => {
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL);
        resetCalls();
        await rc.syncRcStatus("lab", TRIAL);
        expect(topicOps()).toEqual([]);
        expect(topicEvents()).toEqual([]);
    });

    test("compra direta: só o estado, nenhum marco", async () => {
        const rc = await load();
        await rc.syncRcStatus("lab", PAID);
        expect(topicOps()).toEqual(["+lab-purchase-active"]);
        expect(state.storage.has("@expo_utils_rc_milestones")).toBe(false);
    });

    test("sem APNS (simulador): property e fato do marco gravados, nenhum tópico", async () => {
        state.apnsReady = false;
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL);
        expect(topicOps()).toEqual([]);
        expect(state.userProps.rc_status).toBe("trial");
        expect(JSON.parse(state.storage.get("@expo_utils_rc_milestones")!)).toEqual(["trial_started"]);
        expect(state.storage.has("FCM_CURRENT_TOPIC")).toBe(false);
    });

    test("unsubscribe falhando: não inscreve, não mexe na chave, não lança — e a próxima tenta de novo", async () => {
        state.storage.set("FCM_CURRENT_TOPIC", "lab-purchase-free");
        state.fail.add("unsubscribeFromTopic");
        const rc = await load();
        await rc.syncRcStatus("lab", PAID);
        expect(topicOps()).toEqual(["-lab-purchase-free"]);
        expect(state.storage.get("FCM_CURRENT_TOPIC")).toBe("lab-purchase-free");
        expect(state.warns.map((w) => w[0])).toContain("Failed to update messaging topic:");

        state.fail.clear();
        resetCalls();
        await rc.syncRcStatus("lab", PAID);
        expect(topicOps()).toEqual(["-lab-purchase-free", "+lab-purchase-active"]);
        expect(state.storage.get("FCM_CURRENT_TOPIC")).toBe("lab-purchase-active");
    });

    test("saiu do tópico, o novo falhou e o estado voltou: reinscreve no tópico de antes", async () => {
        state.storage.set("FCM_CURRENT_TOPIC", "lab-purchase-trial");
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL); // reafirma lab-purchase-trial nesta sessão
        state.fail.add("subscribeToTopic");
        await rc.syncRcStatus("lab", TRIAL_CANCELLED); // unsubscribe do trial OK, subscribe do novo falha
        expect(state.storage.get("FCM_CURRENT_TOPIC")).toBe("lab-purchase-trial");

        state.fail.clear();
        resetCalls();
        await rc.syncRcStatus("lab", TRIAL); // reativou a renovação antes da próxima execução
        expect(topicOps()).toEqual(["+lab-purchase-trial"]);
    });

    test("subscribe falhando: o fato do marco fica gravado e a próxima execução inscreve", async () => {
        state.fail.add("subscribeToTopic");
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL);
        expect(state.storage.has("FCM_CURRENT_TOPIC")).toBe(false);
        expect(JSON.parse(state.storage.get("@expo_utils_rc_milestones")!)).toEqual(["trial_started"]);

        state.fail.clear();
        resetCalls();
        await rc.syncRcStatus("lab", PAID); // converteu: sem o fato gravado, o trial teria sumido
        expect(topicOps()).toEqual(["+lab-purchase-active", "+lab-purchase-trial_started", "+lab-purchase-converted"]);
    });

    test("boot + listener ao mesmo tempo rodam EM SÉRIE e terminam em 1 só tópico de estado", async () => {
        const rc = await load();
        await Promise.all([rc.syncRcStatus("lab", TRIAL), rc.syncRcStatus("lab", TRIAL_CANCELLED)]);
        expect(topicOps()).toEqual(["+lab-purchase-trial", "+lab-purchase-trial_started", "-lab-purchase-trial", "+lab-purchase-trial_cancelled"]);
        expect(state.storage.get("FCM_CURRENT_TOPIC")).toBe("lab-purchase-trial_cancelled");
    });

    test("sessão nova reafirma estado e marcos 1x, sem evento (backup restaurado = token novo)", async () => {
        state.storage.set("FCM_CURRENT_TOPIC", "lab-purchase-active");
        state.storage.set("@expo_utils_rc_milestones", JSON.stringify(["trial_started", "converted"]));
        const rc = await load();
        await rc.syncRcStatus("lab", PAID);
        expect(topicOps()).toEqual(["+lab-purchase-active", "+lab-purchase-trial_started", "+lab-purchase-converted"]);
        expect(topicEvents()).toEqual([]);

        resetCalls();
        await rc.syncRcStatus("lab", PAID);
        expect(topicOps()).toEqual([]);
    });

    test("tópico gravado pela versão anterior (trial cancelado era 'trial') é trocado", async () => {
        state.storage.set("FCM_CURRENT_TOPIC", "lab-purchase-trial");
        const rc = await load();
        await rc.syncRcStatus("lab", TRIAL_CANCELLED);
        expect(topicOps()).toEqual(["-lab-purchase-trial", "+lab-purchase-trial_cancelled", "+lab-purchase-trial_started"]);
    });
});
