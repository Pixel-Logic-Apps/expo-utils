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
    bannerImg?: string;
    bannerVideo?: string;
    bannerHeight?: number;
    showDontShowAgain?: boolean;
    timerSeconds?: number;
    shadow?: PromotionalShadow;
    notificationTitle?: string;
    notificationBody?: string;
    position?: "top" | "bottom";
    notificationCompact?: boolean;
    targetScreens?: string[];
    nthImpression?: string;
};

export interface RemoteConfigSettings {
    is_ads_enabled: boolean;
    min_version: number;
    ios_app_id: string;
    review_type?: string;
    review_type_delay?: number;
    repeat_ads_count?: number;
    ad_blocklist?: string[];
    promotional?: PromotionalConfig;
    tiktokads?: {token: string; appid: string; tkappid: string; isdebug: boolean};
    clarity_id?: string;
    trends_tracking_url?: string;
}