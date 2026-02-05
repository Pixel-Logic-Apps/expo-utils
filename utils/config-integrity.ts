import {getApp} from "@react-native-firebase/app";
import {getAnalytics, logEvent} from "@react-native-firebase/analytics";
import type {RemoteConfigSettings} from "./types";
import {md5} from "./md5";

type IntegrityPayload = Partial<RemoteConfigSettings> & {
    hash?: string;
};

const expoUtilsWarn = (...args: any[]) => {
    if (!(global as any).disableExpoUtilsWarnings) {
        // eslint-disable-next-line no-console
        console.warn(...args);
    }
};

const expoUtilsLog = (...args: any[]) => {
    if (!(global as any).disableExpoUtilsLogs) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
};

const deepSort = (value: any): any => {
    if (Array.isArray(value)) return value.map((v) => deepSort(v));
    if (value && typeof value === "object") {
        const out: Record<string, any> = {};
        Object.keys(value)
            .sort()
            .forEach((key) => {
                const v = value[key];
                if (v !== undefined) out[key] = deepSort(v);
            });
        return out;
    }
    return value;
};

const stableStringify = (value: any): string => {
    return JSON.stringify(deepSort(value));
};

const getAdCount = (adunits: any): number => {
    if (!adunits) return 0;
    if (Array.isArray(adunits)) return adunits.length;
    if (typeof adunits === "object") return Object.keys(adunits).length;
    return 0;
};

const getPluginConfig = (appConfig: any, pluginName: string): any | null => {
    const plugins = appConfig?.expo?.plugins;
    if (!Array.isArray(plugins)) return null;
    for (const plugin of plugins) {
        if (Array.isArray(plugin) && plugin[0] === pluginName) return plugin[1] ?? null;
    }
    return null;
};

const valueForLog = (value: any): string | number | boolean => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") return stableStringify(value);
    return value;
};

const hashForLog = (value: any): string => {
    if (value === undefined) return md5("undefined");
    if (value === null) return md5("null");
    if (typeof value === "object") return md5(stableStringify(value));
    return md5(String(value));
};

const toEventValue = (value: any, options: {hash?: boolean} = {}): string | number | boolean | null => {
    if (value === undefined || value === null) return null;
    if (options.hash) return md5(stableStringify(value));
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;

    return md5(stableStringify(value));
};

export const logConfigIntegrityValues = (remoteConfigs: any, appConfig?: any): void => {
    try {
        const payload = remoteConfigs as IntegrityPayload;
        const checksum = md5(stableStringify(payload));
        const admobConfig = getPluginConfig(appConfig, "react-native-google-mobile-ads");
        const facebookConfig = getPluginConfig(appConfig, "react-native-fbsdk-next");

        const values = [
            checksum, // cfg_hash
            payload.hash, // remote_hash
            getAdCount(payload.adunits), // ad_count
            payload.is_ads_enabled,
            payload.rckey,
            payload.hotupdater_url,
            payload.trends_tracking_url,
            payload.adunits,
            payload.tiktokads,
            payload.clarity_id,
            payload.min_version,
            payload.review_mode,
            payload.repeat_ads_count,
            payload.delay_close_paywall_button,
            payload.ios_app_id,
            payload.is_paywall_disabled,
            appConfig?.expo?.android?.package,
            appConfig?.expo?.slug,
            appConfig?.expo?.ios?.bundleIdentifier,
            appConfig?.expo?.version,
            appConfig?.expo?.runtimeVersion,
            appConfig?.expo?.extra?.eas?.projectId,
            admobConfig?.androidAppId,
            admobConfig?.iosAppId,
            facebookConfig?.appID,
        ];

        for (const value of values) {
            expoUtilsLog(valueForLog(value), hashForLog(value));
        }
    } catch (e) {
        expoUtilsWarn("logConfigIntegrityValues:", e);
    }
};

export const reportConfigIntegrity = async (remoteConfigs: any, appConfig?: any): Promise<void> => {
    try {
        const app = getApp();
        const analytics = getAnalytics(app);
        const payload = remoteConfigs as IntegrityPayload;
        const checksum = md5(stableStringify(payload));
        const admobConfig = getPluginConfig(appConfig, "react-native-google-mobile-ads");
        const facebookConfig = getPluginConfig(appConfig, "react-native-fbsdk-next");

        const eventParams = {
            cfg_hash: checksum,
            remote_hash: toEventValue(payload.hash),
            ad_count: getAdCount(payload.adunits),

            is_ads_enabled: payload.is_ads_enabled ?? null,
            rckey: toEventValue(payload.rckey, {hash: true}),
            hotupdater_url: toEventValue(payload.hotupdater_url),
            trends_tracking_url: toEventValue(payload.trends_tracking_url),
            adunits: toEventValue(payload.adunits, {hash: true}),
            tiktokads: toEventValue(payload.tiktokads, {hash: true}),
            clarity_id: toEventValue(payload.clarity_id),
            min_version: payload.min_version ?? null,
            review_mode: payload.review_mode ?? null,
            repeat_ads_count: payload.repeat_ads_count ?? null,
            delay_close_paywall_button: payload.delay_close_paywall_button ?? null,
            ios_app_id: toEventValue(payload.ios_app_id),
            is_paywall_disabled: payload.is_paywall_disabled ?? null,

            id: appConfig?.expo?.android?.package ?? null,
            slug: appConfig?.expo?.slug ?? null,
            bundleid: appConfig?.expo?.ios?.bundleIdentifier ?? null,
            version: appConfig?.expo?.version ?? null,
            runtimeversion: appConfig?.expo?.runtimeVersion ?? null,
            projectId: appConfig?.expo?.extra?.eas?.projectId ?? null,
            admob_android_app_id: toEventValue(admobConfig?.androidAppId),
            admob_ios_app_id: toEventValue(admobConfig?.iosAppId),
            facebook_app_id: toEventValue(facebookConfig?.appID),
        };

        await logEvent(analytics, "cfg_integrity", eventParams);
    } catch (e) {
        expoUtilsWarn("reportConfigIntegrity:", e);
    }
};
