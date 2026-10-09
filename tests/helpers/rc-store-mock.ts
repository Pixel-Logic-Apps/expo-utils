// Mock da parte de loja do react-native-purchases (getProducts, getOfferings, ofertas, compras, resgate) para
// tests/retention-store.test.ts e tests/retention-show.test.ts. Chamar DEPOIS do `installMocks()` de
// rn-mocks.ts: troca o `react-native` (ganha Linking e DeviceEventEmitter) e o `react-native-purchases`.
// O getProducts filtra como o core do SDK Android 10.22.1 (`PurchasesOrchestrator.getProducts`, lido no AAR):
// id exato; id de assinatura sem ":" devolve todos os base plans dela; a categoria tem que bater.
import {mock} from "bun:test";
import {state} from "./rn-mocks";

export const DEFAULT_PROMO = {identifier: "retention_50", keyIdentifier: "KEY123", nonce: "nonce", signature: "assinatura", timestamp: 1759900000000};

export const store = {
    /** Produtos que a loja tem. */
    catalog: [] as any[],
    offerings: {all: {}, current: null} as any,
    productsError: null as any,
    offeringsError: null as any,
    customerInfoError: null as any,
    /** O que o getPromotionalOffer devolve (undefined = não assinou). */
    promo: DEFAULT_PROMO as any,
    promoError: null as any,
    /** O que o getEligibleWinBackOffersForProduct devolve. */
    winback: undefined as any,
    winbackError: null as any,
    /** Erro das compras (objeto no formato do SDK: code, userCancelled, message). */
    purchaseError: null as any,
    /** customerInfo depois da compra (padrão: o `state.customerInfo`). */
    purchaseInfo: null as any,
    openURLError: null as any,
    sheetError: null as any,
};

export function resetStore() {
    store.catalog = [];
    store.offerings = {all: {}, current: null};
    store.productsError = null;
    store.offeringsError = null;
    store.customerInfoError = null;
    store.promo = DEFAULT_PROMO;
    store.promoError = null;
    store.winback = undefined;
    store.winbackError = null;
    store.purchaseError = null;
    store.purchaseInfo = null;
    store.openURLError = null;
    store.sheetError = null;
    state.calls.length = 0;
    state.events.length = 0;
    state.warns.length = 0;
    state.storage.clear();
}

const listeners = new Map<string, Set<(...args: any[]) => void>>();

const purchase = (name: string, product: any, extra?: any) => {
    state.calls.push(extra === undefined ? [name, product] : [name, product, extra]);
    if (store.purchaseError) return Promise.reject(store.purchaseError);
    const identifier = product?.identifier ?? product?.storeProductId ?? "?";
    return Promise.resolve({productIdentifier: identifier, customerInfo: store.purchaseInfo ?? state.customerInfo, transaction: {transactionIdentifier: "GPA.1", productIdentifier: identifier, purchaseDate: "2026-10-08T12:00:00Z"}});
};

export function installStoreMocks() {
    mock.module("react-native", () => ({
        Platform: {
            get OS() {
                return state.os;
            },
            Version: 34,
        },
        NativeModules: {},
        Linking: {
            openURL: (url: string) => {
                state.calls.push(["openURL", url]);
                return store.openURLError ? Promise.reject(store.openURLError) : Promise.resolve(true);
            },
        },
        DeviceEventEmitter: {
            emit: (name: string, ...args: any[]) => listeners.get(name)?.forEach((listener) => listener(...args)),
            addListener: (name: string, listener: (...args: any[]) => void) => {
                if (!listeners.has(name)) listeners.set(name, new Set());
                listeners.get(name)!.add(listener);
                return {remove: () => listeners.get(name)?.delete(listener)};
            },
        },
    }));
    mock.module("react-native-purchases", () => ({
        PRODUCT_CATEGORY: {SUBSCRIPTION: "SUBSCRIPTION", NON_SUBSCRIPTION: "NON_SUBSCRIPTION", UNKNOWN: "UNKNOWN"},
        default: {
            isConfigured: () => Promise.resolve(true),
            getAppUserID: () => Promise.resolve("$RCAnonymousID:de39831ab3284a198b7310d7411cddcc"),
            getCustomerInfo: () => {
                state.calls.push(["getCustomerInfo"]);
                return store.customerInfoError ? Promise.reject(store.customerInfoError) : Promise.resolve(state.customerInfo);
            },
            getProducts: (ids: string[], category = "SUBSCRIPTION") => {
                state.calls.push(["getProducts", ids, category]);
                if (store.productsError) return Promise.reject(store.productsError);
                return Promise.resolve(
                    store.catalog.filter(
                        (product) => product.productCategory === category && ids.some((id) => product.identifier === id || (!id.includes(":") && product.identifier.split(":")[0] === id)),
                    ),
                );
            },
            getOfferings: () => {
                state.calls.push(["getOfferings"]);
                return store.offeringsError ? Promise.reject(store.offeringsError) : Promise.resolve(store.offerings);
            },
            getPromotionalOffer: (product: any, discount: any) => {
                state.calls.push(["getPromotionalOffer", product?.identifier, discount?.identifier]);
                return store.promoError ? Promise.reject(store.promoError) : Promise.resolve(store.promo);
            },
            getEligibleWinBackOffersForProduct: (product: any) => {
                state.calls.push(["getEligibleWinBackOffersForProduct", product?.identifier]);
                return store.winbackError ? Promise.reject(store.winbackError) : Promise.resolve(store.winback);
            },
            purchaseStoreProduct: (product: any) => purchase("purchaseStoreProduct", product),
            purchaseSubscriptionOption: (option: any) => purchase("purchaseSubscriptionOption", option),
            purchaseDiscountedProduct: (product: any, promo: any) => purchase("purchaseDiscountedProduct", product, promo),
            purchaseProductWithWinBackOffer: (product: any, offer: any) => purchase("purchaseProductWithWinBackOffer", product, offer),
            presentCodeRedemptionSheet: () => {
                state.calls.push(["presentCodeRedemptionSheet"]);
                return store.sheetError ? Promise.reject(store.sheetError) : Promise.resolve();
            },
            invalidateCustomerInfoCache: () => Promise.resolve(),
            showManageSubscriptions: () => Promise.resolve(),
        },
    }));
}
