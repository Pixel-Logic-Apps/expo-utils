// Fixtures do RevenueCat no formato real do SDK: PurchasesEntitlementInfo / CustomerInfo de
// @revenuecat/purchases-typescript-internal 19.2.0 (dist/customerInfo.d.ts). Usadas por
// rc-status.test.ts e premium.test.ts — o mesmo customer tem que dar o mesmo veredito nos dois.

export const NOW = Date.parse("2026-09-24T12:00:00Z");
export const DAY = 24 * 60 * 60 * 1000;
export const iso = (ms: number) => new Date(ms).toISOString();

export const entitlement = ({expiresInDays = 7, ...over}: {expiresInDays?: number | null} & Record<string, any> = {}) => {
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

export const subscription = (over: Record<string, any> = {}) => ({
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

export const customerInfo = (entitlements: Array<Record<string, any>> = [], extra: Record<string, any> = {}): any => ({
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

// willRenew falso com o MOTIVO junto, como os SDKs entregam (ver isPremiumEntitlement).
export const CANCELLED = {willRenew: false, unsubscribeDetectedAt: iso(NOW - DAY), unsubscribeDetectedAtMillis: NOW - DAY};
export const BILLING = {willRenew: false, billingIssueDetectedAt: iso(NOW - DAY), billingIssueDetectedAtMillis: NOW - DAY};
