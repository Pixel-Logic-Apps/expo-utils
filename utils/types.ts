export interface FacebookConfig {
    appID: string;
    clientToken?: string;
    displayName?: string;
    scheme?: string;
    advertiserIDCollectionEnabled?: boolean;
    autoLogAppEventsEnabled?: boolean;
    isAutoInitEnabled?: boolean;
}

export interface RevenueCatKeys {
    androidApiKey: string;
    iosApiKey: string;
}

export interface AppConfig {
    expo: {
        slug: string;
        ios: {bundleIdentifier: string};
        android: {package: string};
        plugins?: Array<string | [string, any]>;
    };
}

export interface AdUnits {
    appOpen?: string;
    banner?: string;
    interstitial?: string;
    rewarded?: string;
}

export interface AppStrings {
    rckey?: string;
    adUnits?: AdUnits;
    hotUpdaterUrl?: string;
    [key: string]: any;
}

export type PromotionalType = "bottom-sheet" | "card-banner-bottom" | "banner" | "fullscreen" | "notification";

export type PromotionalShadow = {
    color?: string;
    offsetX?: number;
    offsetY?: number;
    opacity?: number;
    radius?: number;
    elevation?: number;
};

export type PromotionalConfig = {
    enabled: boolean;
    type: PromotionalType;
    icon: string;
    name: string;
    description: string;
    buttonText: string;
    gradientColors: [string, string];
    primaryColor: string;
    storeUrl: string;
    delayMs?: number;
    imageUrl?: string;
    videoUrl?: string;
    bannerHeight?: number;
    showDontShowAgain?: boolean;
    closeBtnDelayMs?: number;
    shadow?: PromotionalShadow;
    notificationTitle?: string;
    notificationBody?: string;
    position?: "top" | "bottom";
    notificationCompact?: boolean;
    targetScreens?: string[];
    nthImpression?: string;
};

export interface RemoteConfigUtilsType {
    is_ads_enabled: boolean;
    min_version: number;
    ios_app_id: string;
    review_type?: string; // "store-review" | "popup" | "dialog"
    /** ms até habilitar "Agora não" no AskForReviewOverlay (prop `delay`). */
    review_type_delay?: number;
    /** ms antes do review aparecer (askForReview). Override local: 3º arg `showDelay`. */
    review_show_delay?: number;
    repeat_ads_count?: number;
    ad_blocklist?: string[];
    promotional?: PromotionalConfig;
    tiktokads?: {token: string; appid: string; tkappid: string; isdebug: boolean};
    clarity_id?: string;
    trends_tracking_url?: string;
    is_opted_out_trial_enabled?: boolean;
    // Fallback de versão da loja para Utils.disableAdsIfBuildIsNewerThanStore
    // (usado quando o lookup na loja falha ou o app ainda não é encontrado).
    ios_store_version?: string;
    android_store_version?: string;
}

/**
 * Config do cross-promo de portfólio (card que anuncia outro app da casa).
 * Lida de `remoteConfigScreens.cross_promo` — ver `CrossPromoCard`.
 */
export type CrossPromoConfig = {
    enabled?: boolean;
    title?: string;
    app_name?: string;
    subtitle?: string;
    icon_url?: string;
    cta?: string;
    url?: string;
    ios_url?: string;
    android_url?: string;
    screens?: string[];
};

/**
 * Mapa da key `screens` do Remote Config (features/telas configuráveis do app).
 *
 * `cross_promo` é OBRIGATÓRIO: todo app do portfólio deve ter cross-promo
 * implementado em algum lugar (home, resultado, histórico, settings…). O type
 * força a presença da config; apps que montarem o objeto na mão sem a key
 * quebram no typecheck — é a enforcement da regra de portfólio.
 */
export interface RemoteConfigScreensType {
    cross_promo: CrossPromoConfig;
    [key: string]: any;
}

/**
 * Augmentação global injetada pela própria lib. Como este arquivo é importado em toda a cadeia
 * que usa o expo-utils (Utils -> ./types, o template, o index), o TypeScript carrega esta
 * declaração automaticamente no projeto que instala o pacote — o dev NÃO precisa criar nenhum
 * global.d.ts. Pode acessar via `global.X` ou `globalThis.X` (em runtime são o mesmo objeto).
 */
declare global {
    // Tipa o NOME `global` (Expo/RN não declara por padrão). É idêntico ao @types/node moderno
    // (typeof globalThis), então faz merge sem conflito em apps que já tenham @types/node.
    // eslint-disable-next-line no-var
    var global: typeof globalThis;
    var remoteConfigUtils: RemoteConfigUtilsType;
    // Alias de remoteConfigUtils (mesmo objeto), setado pelo setupGlobalConfigs — nome
    // documentado no CLAUDE.md; o store gate e apps legados leem/escrevem por ele.
    var remoteConfigs: RemoteConfigUtilsType;
    var remoteConfigScreens: RemoteConfigScreensType;
    var isAdsEnabled: boolean;
    // Setada (true) pelo gate fail-closed de versão da loja (Utils.disableAdsIfBuildIsNewerThanStore)
    // quando ele bloqueia os ads. Flag própria do gate — o prepare() não encosta nela; apps podem
    // ler p/ ex. esconder o espaço reservado do banner.
    var adsDisabledByStoreGate: boolean | undefined;
    var adUnits: any;
}