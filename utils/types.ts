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
        plugins?: Array<string | [string, any]>;
    };
}

export interface RemoteConfigSettings {
    is_ads_enabled: boolean;
    min_version: number;
    min_version_force?: boolean;
    review_mode: number;
    repeat_ads_count: number;
    delay_close_paywall_button: number;
    ios_app_id: string;
    is_paywall_disabled: boolean;
}
