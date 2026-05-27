import AsyncStorage from "@react-native-async-storage/async-storage";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";

type PurchasesModule = any;

declare const __DEV__: boolean;

let purchasesReady = false;

export type PaywallProductSource = "auto" | "offerings" | "products";

export type PaywallTranslator = (key: string, fallback?: string) => string;

export interface PaywallProductConfig {
    id: string;
    price_string?: string;
    period_string?: string;
    price_info?: string;
    discount_info?: string;
    discount_percentage?: string;
    most_popular?: boolean;
    title?: string;
    subtitle?: string;
    badge?: string;
    [key: string]: any;
}

export interface PaywallConfig {
    is_paywall_enabled?: boolean;
    provider?: string;
    campaign_name?: string;
    close_button_delay?: number;
    close_delay?: number;
    seconds_show_close?: number;
    paywall_delay?: number;
    disclaimer_text?: string;
    primary_button_text?: string;
    selected_product?: string;
    default_product?: number | string;
    paywall_default_product?: number | string;
    products_to_show?: string[];
    product_to_show?: string[];
    list_of_products?: PaywallProductConfig[];
    offer?: string[];
    discount_enabled?: boolean;
    extras?: Record<string, any>;
    [key: string]: any;
}

export interface PaywallStoreProduct {
    identifier: string;
    title?: string;
    description?: string;
    price?: number;
    priceString?: string;
    pricePerWeekString?: string;
    pricePerMonthString?: string;
    pricePerYearString?: string;
    introPrice?: any;
    [key: string]: any;
}

export interface PaywallItem {
    id: string;
    kind: "package" | "store-product";
    product: PaywallStoreProduct;
    package?: any;
    config?: PaywallProductConfig;
    title: string;
    period: string;
    billedPrice: string;
    secondaryPrice: string;
    secondaryPeriod: string;
    badge: string;
    discountPercentage: string;
    mostPopular: boolean;
    trialDays: number;
    periodCount: number;
}

export interface PaywallLoadResult {
    config: PaywallConfig;
    items: PaywallItem[];
    selectedProductId: string;
    selectedItem: PaywallItem | null;
    closeDelay: number;
}

export interface PaywallOptions {
    config?: PaywallConfig;
    configKey?: string;
    productIds?: string[];
    productSource?: PaywallProductSource;
    revenueCatApiKey?: string;
    storageKey?: string;
    entitlementIds?: string[];
    selectedProductId?: string;
    defaultCloseDelay?: number;
    t?: PaywallTranslator;
    markPremiumOnAnyPurchase?: boolean;
    simulatePurchaseInDev?: boolean;
}

export interface PaywallPurchaseResult {
    ok: boolean;
    cancelled: boolean;
    premiumGranted: boolean;
    customerInfo?: any;
    rawResult?: any;
    error?: any;
    simulated?: boolean;
}

export interface UsePaywallOptions extends PaywallOptions {
    autoLoad?: boolean;
    reloadKey?: any;
    onPurchaseSuccess?: (result: PaywallPurchaseResult) => void;
    onRestoreSuccess?: (result: PaywallPurchaseResult) => void;
}

export interface UsePaywallResult extends PaywallLoadResult {
    loading: boolean;
    purchasing: boolean;
    restoring: boolean;
    error: any;
    canClose: boolean;
    select: (productId: string) => void;
    reload: () => Promise<PaywallLoadResult>;
    purchaseSelected: () => Promise<PaywallPurchaseResult>;
    restore: () => Promise<PaywallPurchaseResult>;
    getButtonText: () => string;
    getDisclaimerText: () => string;
}

function getPurchases(): PurchasesModule {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-purchases");
    return mod.default || mod;
}

function uniq(values: string[]) {
    return Array.from(new Set(values.filter((value) => typeof value === "string" && value.length > 0)));
}

function translate(t: PaywallTranslator | undefined, key: string, fallback = "") {
    if (!key) return fallback;
    try {
        return String(t ? t(key, fallback) : fallback || key);
    } catch {
        return fallback || key;
    }
}

function numberOrDefault(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanTitle(title?: string) {
    const raw = (title || "").replace(/\s*\(.*?\)\s*/g, "").trim();
    const looksLikeProductId = raw.includes(".") && raw.toLowerCase().startsWith("com.");
    return looksLikeProductId ? "" : raw;
}

function getProduct(input: PaywallItem | PaywallStoreProduct | any): PaywallStoreProduct | undefined {
    if (!input) return undefined;
    if (input.product?.identifier) return input.product;
    if (input.identifier) return input;
    return undefined;
}

function getGlobalObject() {
    return global as any;
}

function isDevRuntime() {
    try {
        return typeof __DEV__ !== "undefined" && __DEV__;
    } catch {
        return false;
    }
}

export class PaywallUtils {
    static getConfig(options: Pick<PaywallOptions, "config" | "configKey"> = {}): PaywallConfig {
        if (options.config) return options.config;

        const globals = getGlobalObject();
        const screens = globals.remoteConfigScreens || {};
        const legacy = globals.remoteConfigs || {};
        const selected = options.configKey
            ? screens[options.configKey]
            : screens.paywallData || screens.paywall || screens.paywallConfig || {};

        return {...legacy, ...selected};
    }

    static getProductConfigs(config: PaywallConfig = {}): PaywallProductConfig[] {
        return Array.isArray(config.list_of_products)
            ? config.list_of_products.filter((item) => item && typeof item.id === "string" && item.id.length > 0)
            : [];
    }

    static getProductIds(config: PaywallConfig = {}, explicitProductIds?: string[]): string[] {
        if (explicitProductIds?.length) return uniq(explicitProductIds);

        const listIds = PaywallUtils.getProductConfigs(config).map((item) => item.id);
        const productsToShow = Array.isArray(config.products_to_show) ? config.products_to_show : [];
        const productToShow = Array.isArray(config.product_to_show) ? config.product_to_show : [];
        const legacyProducts = [config.paywall_product_a, config.paywall_product_b].filter(Boolean) as string[];
        const selected = typeof config.selected_product === "string" ? [config.selected_product] : [];

        return uniq([...productsToShow, ...productToShow, ...legacyProducts, ...listIds, ...selected]);
    }

    static getCloseDelay(config: PaywallConfig = {}, fallback = 5000) {
        return numberOrDefault(
            config.close_button_delay ?? config.close_delay ?? config.seconds_show_close ?? config.paywall_delay,
            fallback,
        );
    }

    static parseText(value = "", options: {t?: PaywallTranslator; product?: PaywallStoreProduct; item?: PaywallItem | null} = {}) {
        const product = options.product || getProduct(options.item);
        return value
            .replace(/%\{([^}]+)\}/g, (_match, key) => translate(options.t, key, key))
            .replace(/\$\{priceString\}/g, product?.priceString || "")
            .replace(/\$\{pricePerWeekString\}/g, product?.pricePerWeekString || product?.priceString || "")
            .replace(/\$\{pricePerMonthString\}/g, product?.pricePerMonthString || "")
            .replace(/\$\{pricePerYearString\}/g, product?.pricePerYearString || "")
            .replace(/\$\{productIdentifier\}/g, product?.identifier || "")
            .replace(/\$\{productTitle\}/g, cleanTitle(product?.title));
    }

    static getProductConfig(config: PaywallConfig = {}, productId: string) {
        return PaywallUtils.getProductConfigs(config).find((item) => item.id === productId);
    }

    static getTitle(product: PaywallStoreProduct, config: PaywallProductConfig | undefined, t?: PaywallTranslator) {
        const id = product.identifier.toLowerCase();
        const configured = PaywallUtils.parseText(config?.title || "", {t, product}).trim();
        if (configured) return configured;

        const title = cleanTitle(product.title);
        if (title) return title;

        if (id.includes("annual") || id.includes("year")) return translate(t, "paywall.plan_access.yearly", "Yearly");
        if (id.includes("month")) return translate(t, "paywall.plan_access.monthly", "Monthly");
        if (id.includes("week")) return translate(t, "paywall.plan_access.weekly", "Weekly");
        if (id.includes("lifetime")) return translate(t, "paywall.plan_access.lifetime", "Lifetime");
        return translate(t, "paywall.plan_access.premium", "Premium");
    }

    static getPeriod(product: PaywallStoreProduct, config: PaywallProductConfig | undefined, t?: PaywallTranslator) {
        const configured = PaywallUtils.parseText(config?.period_string || "", {t, product}).trim();
        if (configured) return configured;

        const id = product.identifier.toLowerCase();
        if (id.includes("annual") || id.includes("year")) return translate(t, "paywall.plans.annual.duration", "year");
        if (id.includes("month")) return translate(t, "paywall.plans.monthly.duration", "month");
        if (id.includes("week")) return translate(t, "paywall.plans.weekly.duration", "week");
        if (id.includes("lifetime")) return translate(t, "paywall.plans.lifetime.duration", "lifetime");
        return "";
    }

    static createItem(raw: any, config: PaywallConfig = {}, t?: PaywallTranslator): PaywallItem {
        const isPackage = Boolean(raw?.product?.identifier);
        const product = (isPackage ? raw.product : raw) as PaywallStoreProduct;
        const productConfig = PaywallUtils.getProductConfig(config, product.identifier);
        const billedPrice =
            PaywallUtils.parseText(productConfig?.price_string || "", {t, product}).trim() || product.priceString || "";
        const secondaryPrice =
            PaywallUtils.parseText(productConfig?.price_info || "", {t, product}).trim() ||
            (product.pricePerWeekString && product.pricePerWeekString !== billedPrice ? product.pricePerWeekString : "");

        return {
            id: product.identifier,
            kind: isPackage ? "package" : "store-product",
            product,
            package: isPackage ? raw : undefined,
            config: productConfig,
            title: PaywallUtils.getTitle(product, productConfig, t),
            period: PaywallUtils.getPeriod(product, productConfig, t),
            billedPrice,
            secondaryPrice,
            secondaryPeriod: secondaryPrice === product.pricePerWeekString ? translate(t, "paywall.per_week", "per week") : "",
            badge:
                PaywallUtils.parseText(productConfig?.badge || productConfig?.discount_info || "", {t, product}).trim(),
            discountPercentage: PaywallUtils.parseText(productConfig?.discount_percentage || "", {t, product}).trim(),
            mostPopular: productConfig?.most_popular === true,
        };
    }

    static getSelectedProductId(items: PaywallItem[], config: PaywallConfig = {}, explicitSelectedProductId?: string) {
        const itemIds = items.map((item) => item.id);
        const configuredSelected = explicitSelectedProductId || config.selected_product;
        if (configuredSelected && itemIds.includes(configuredSelected)) return configuredSelected;

        const defaultIndex = Number(config.default_product ?? config.paywall_default_product);
        if (Number.isInteger(defaultIndex) && defaultIndex >= 0 && items[defaultIndex]) return items[defaultIndex].id;

        const popular = items.find((item) => item.mostPopular);
        return popular?.id || items[0]?.id || "";
    }

    static async ensureRevenueCat(apiKey?: string) {
        if (purchasesReady) return;

        const Purchases = getPurchases();
        const isConfigured = typeof Purchases.isConfigured === "function" ? await Purchases.isConfigured() : false;

        if (!isConfigured) {
            if (!apiKey) throw new Error("RevenueCat is not configured and no apiKey was provided");
            Purchases.configure({apiKey});
        }

        purchasesReady = true;
    }

    static getOfferingPackages(offerings: any) {
        const current = offerings?.current?.availablePackages || [];
        const allOfferings = Object.values(offerings?.all || {}) as any[];
        const allPackages = allOfferings.flatMap((offering) => offering?.availablePackages || []);
        const byProductId = new Map<string, any>();

        [...current, ...allPackages].forEach((pkg) => {
            const id = pkg?.product?.identifier;
            if (id && !byProductId.has(id)) byProductId.set(id, pkg);
        });

        return Array.from(byProductId.values());
    }

    static sortRawProducts<T extends any>(items: T[], productIds: string[], getId: (item: T) => string | undefined) {
        if (!productIds.length) return items;
        return productIds
            .map((id) => items.find((item) => getId(item) === id))
            .filter(Boolean) as T[];
    }

    static async load(options: PaywallOptions = {}): Promise<PaywallLoadResult> {
        const config = PaywallUtils.getConfig(options);
        const productIds = PaywallUtils.getProductIds(config, options.productIds);
        const source = options.productSource || "auto";
        const Purchases = getPurchases();
        const t = options.t;

        await PaywallUtils.ensureRevenueCat(options.revenueCatApiKey);

        let items: PaywallItem[] = [];

        if (source !== "products") {
            const offerings = await Purchases.getOfferings();
            const packages = PaywallUtils.sortRawProducts(
                PaywallUtils.getOfferingPackages(offerings),
                productIds,
                (pkg) => pkg?.product?.identifier,
            );
            items = packages.map((pkg) => PaywallUtils.createItem(pkg, config, t));
        }

        if ((source === "products" || (source === "auto" && items.length === 0)) && productIds.length > 0) {
            const products = await Purchases.getProducts(productIds);
            const orderedProducts = PaywallUtils.sortRawProducts(products || [], productIds, (product: any) => product?.identifier);
            items = orderedProducts.map((product) => PaywallUtils.createItem(product, config, t));
        }

        const selectedProductId = PaywallUtils.getSelectedProductId(items, config, options.selectedProductId);
        return {
            config,
            items,
            selectedProductId,
            selectedItem: items.find((item) => item.id === selectedProductId) || null,
            closeDelay: PaywallUtils.getCloseDelay(config, options.defaultCloseDelay ?? 5000),
        };
    }

    static hasPremiumAccess(customerInfo: any, entitlementIds?: string[]) {
        const active = customerInfo?.entitlements?.active || {};
        if (entitlementIds?.length) {
            return entitlementIds.some((id) => Boolean(active[id]));
        }
        return Object.keys(active).length > 0;
    }

    static async setPremiumStatus(isPremium: boolean, storageKey = "@isPremium") {
        await AsyncStorage.setItem(storageKey, JSON.stringify(isPremium));
    }

    static async purchaseItem(item: PaywallItem, options: PaywallOptions = {}): Promise<PaywallPurchaseResult> {
        try {
            if (options.simulatePurchaseInDev && isDevRuntime()) {
                await PaywallUtils.setPremiumStatus(true, options.storageKey);
                return {ok: true, cancelled: false, premiumGranted: true, simulated: true};
            }

            await PaywallUtils.ensureRevenueCat(options.revenueCatApiKey);
            const Purchases = getPurchases();
            const rawResult = item.package
                ? await Purchases.purchasePackage(item.package)
                : await Purchases.purchaseStoreProduct(item.product);
            const customerInfo = rawResult?.customerInfo || rawResult;
            const premiumGranted =
                PaywallUtils.hasPremiumAccess(customerInfo, options.entitlementIds) ||
                options.markPremiumOnAnyPurchase === true;

            if (premiumGranted) {
                await PaywallUtils.setPremiumStatus(true, options.storageKey);
            }

            return {ok: true, cancelled: false, premiumGranted, customerInfo, rawResult};
        } catch (error: any) {
            return {ok: false, cancelled: Boolean(error?.userCancelled), premiumGranted: false, error};
        }
    }

    static async restore(options: PaywallOptions = {}): Promise<PaywallPurchaseResult> {
        try {
            await PaywallUtils.ensureRevenueCat(options.revenueCatApiKey);
            const Purchases = getPurchases();
            const customerInfo = await Purchases.restorePurchases();
            const premiumGranted = PaywallUtils.hasPremiumAccess(customerInfo, options.entitlementIds);

            if (premiumGranted) {
                await PaywallUtils.setPremiumStatus(true, options.storageKey);
            }

            return {ok: true, cancelled: false, premiumGranted, customerInfo, rawResult: customerInfo};
        } catch (error: any) {
            return {ok: false, cancelled: Boolean(error?.userCancelled), premiumGranted: false, error};
        }
    }

    static async getIsPremium(options: PaywallOptions = {}) {
        try {
            await PaywallUtils.ensureRevenueCat(options.revenueCatApiKey);
            const customerInfo = await getPurchases().getCustomerInfo();
            return PaywallUtils.hasPremiumAccess(customerInfo, options.entitlementIds);
        } catch {
            return AsyncStorage.getItem(options.storageKey || "@isPremium").then((value) => value === "true");
        }
    }

    static getButtonText(config: PaywallConfig = {}, t?: PaywallTranslator, item?: PaywallItem | null) {
        return (
            PaywallUtils.parseText(config.primary_button_text || "", {t, item}).trim() ||
            translate(t, "paywall.continue", "Continue")
        );
    }

    static getDisclaimerText(config: PaywallConfig = {}, t?: PaywallTranslator) {
        return PaywallUtils.parseText(config.disclaimer_text || "", {t}).trim();
    }
}

export class PaywallController {
    options: PaywallOptions;
    config: PaywallConfig = {};
    items: PaywallItem[] = [];
    selectedProductId = "";
    closeDelay = 5000;

    constructor(options: PaywallOptions = {}) {
        this.options = options;
    }

    setOptions(options: PaywallOptions = {}) {
        this.options = {...this.options, ...options};
    }

    async load() {
        const result = await PaywallUtils.load(this.options);
        this.config = result.config;
        this.items = result.items;
        this.selectedProductId = result.selectedProductId;
        this.closeDelay = result.closeDelay;
        return result;
    }

    select(productId: string) {
        if (this.items.some((item) => item.id === productId)) {
            this.selectedProductId = productId;
        }
    }

    get selectedItem() {
        return this.items.find((item) => item.id === this.selectedProductId) || null;
    }

    async purchaseSelected() {
        const item = this.selectedItem;
        if (!item) {
            return {ok: false, cancelled: false, premiumGranted: false, error: new Error("No paywall item selected")};
        }
        return PaywallUtils.purchaseItem(item, this.options);
    }

    restore() {
        return PaywallUtils.restore(this.options);
    }

    getButtonText() {
        return PaywallUtils.getButtonText(this.config, this.options.t, this.selectedItem);
    }

    getDisclaimerText() {
        return PaywallUtils.getDisclaimerText(this.config, this.options.t);
    }

    startCloseTimer(onShow: () => void) {
        return setTimeout(onShow, this.closeDelay);
    }
}

export function usePaywall(options: UsePaywallOptions = {}): UsePaywallResult {
    const controllerRef = useRef(new PaywallController(options));
    controllerRef.current.setOptions(options);

    const [config, setConfig] = useState<PaywallConfig>({});
    const [items, setItems] = useState<PaywallItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [closeDelay, setCloseDelay] = useState(options.defaultCloseDelay ?? 5000);
    const [loading, setLoading] = useState(options.autoLoad !== false);
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState<any>(null);
    const [canClose, setCanClose] = useState(false);

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedProductId) || null,
        [items, selectedProductId],
    );

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        setCanClose(false);
        try {
            const result = await controllerRef.current.load();
            setConfig(result.config);
            setItems(result.items);
            setSelectedProductId(result.selectedProductId);
            setCloseDelay(result.closeDelay);
            return result;
        } catch (e) {
            setError(e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (options.autoLoad === false) return;
        void reload();
    }, [reload, options.autoLoad, options.reloadKey]);

    useEffect(() => {
        if (loading) return;
        const timer = setTimeout(() => setCanClose(true), closeDelay);
        return () => clearTimeout(timer);
    }, [closeDelay, loading]);

    const select = useCallback((productId: string) => {
        controllerRef.current.select(productId);
        setSelectedProductId(controllerRef.current.selectedProductId);
    }, []);

    const purchaseSelected = useCallback(async () => {
        if (!selectedItem) {
            return {ok: false, cancelled: false, premiumGranted: false, error: new Error("No paywall item selected")};
        }
        setPurchasing(true);
        const result = await PaywallUtils.purchaseItem(selectedItem, controllerRef.current.options);
        setPurchasing(false);
        if (result.ok && result.premiumGranted) options.onPurchaseSuccess?.(result);
        return result;
    }, [options, selectedItem]);

    const restore = useCallback(async () => {
        setRestoring(true);
        const result = await PaywallUtils.restore(controllerRef.current.options);
        setRestoring(false);
        if (result.ok && result.premiumGranted) options.onRestoreSuccess?.(result);
        return result;
    }, [options]);

    const getButtonText = useCallback(
        () => PaywallUtils.getButtonText(config, options.t, selectedItem),
        [config, options.t, selectedItem],
    );

    const getDisclaimerText = useCallback(
        () => PaywallUtils.getDisclaimerText(config, options.t),
        [config, options.t],
    );

    return {
        config,
        items,
        selectedProductId,
        selectedItem,
        closeDelay,
        loading,
        purchasing,
        restoring,
        error,
        canClose,
        select,
        reload,
        purchaseSelected,
        restore,
        getButtonText,
        getDisclaimerText,
    };
}



/*
 * Exemplo de paywall usando o hook headless.
 *
 * A ideia e deixar o expo-utils cuidar de:
 * - carregar Remote Config/RevenueCat
 * - montar os produtos na ordem certa
 * - selecionar plano
 * - comprar/restaurar
 * - marcar @isPremium quando o entitlement for liberado
 *
 * O app fica livre para renderizar qualquer UI.
 *
 * import {router} from "expo-router";
 * import {ActivityIndicator, Alert, Text, TouchableOpacity, View} from "react-native";
 * import {usePaywall} from "expo-utils";
 *
 * export default function PaywallScreen() {
 *     const paywall = usePaywall({
 *         t,
 *         productSource: "auto",
 *         onPurchaseSuccess: () => router.back(),
 *         onRestoreSuccess: () => router.back(),
 *     });
 *
 *     async function buy() {
 *         const result = await paywall.purchaseSelected();
 *
 *         if (!result.ok && !result.cancelled) {
 *             Alert.alert("Erro", "Nao foi possivel concluir a compra.");
 *         }
 *     }
 *
 *     if (paywall.loading) {
 *         return <ActivityIndicator />;
 *     }
 *
 *     return (
 *         <View>
 *             {paywall.canClose && (
 *                 <TouchableOpacity onPress={() => router.back()}>
 *                     <Text>Fechar</Text>
 *                 </TouchableOpacity>
 *             )}
 *
 *             {paywall.items.map((item) => {
 *                 const selected = paywall.selectedProductId === item.id;
 *
 *                 return (
 *                     <TouchableOpacity key={item.id} onPress={() => paywall.select(item.id)}>
 *                         <Text>{selected ? "Selecionado" : ""}</Text>
 *                         <Text>{item.title}</Text>
 *                         <Text>{item.billedPrice}</Text>
 *                         <Text>{item.period}</Text>
 *                         {!!item.badge && <Text>{item.badge}</Text>}
 *                     </TouchableOpacity>
 *                 );
 *             })}
 *
 *             <TouchableOpacity
 *                 disabled={!paywall.selectedItem || paywall.purchasing || paywall.restoring}
 *                 onPress={buy}>
 *                 <Text>{paywall.purchasing ? "Comprando..." : paywall.getButtonText()}</Text>
 *             </TouchableOpacity>
 *
 *             <TouchableOpacity disabled={paywall.restoring} onPress={paywall.restore}>
 *                 <Text>{paywall.restoring ? "Restaurando..." : "Restaurar compras"}</Text>
 *             </TouchableOpacity>
 *
 *             {!!paywall.getDisclaimerText() && <Text>{paywall.getDisclaimerText()}</Text>}
 *         </View>
 *     );
 * }
 */