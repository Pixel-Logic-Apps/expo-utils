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

export interface RemoteConfigSettings {
    is_ads_enabled: boolean;
    rckey: string;
    hotupdater_url: string;
    trends_tracking_url: string;
    adunits: object;
    tiktokads: {token: string; appid: string; tkappid: string; isdebug: boolean};
    clarity_id: string;
    min_version: number;
    review_mode: number;
    repeat_ads_count: number;
    delay_close_paywall_button: number;
    ios_app_id: string;
    is_paywall_disabled: boolean;
}