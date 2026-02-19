import {getApp} from "@react-native-firebase/app";
import {getAnalytics, logEvent} from "@react-native-firebase/analytics";
import type {RemoteConfigUtilsType} from "./types";
import {md5} from "./md5";

type IntegrityPayload = Partial<RemoteConfigUtilsType> & {
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
            payload.is_ads_enabled,
            payload.trends_tracking_url,
            payload.tiktokads,
            payload.clarity_id,
            payload.min_version,
            payload.review_type,
            payload.repeat_ads_count,
            payload.ios_app_id,
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

        const rawParams: Record<string, any> = {
            cfg_hash: checksum,
            remote_hash: toEventValue(payload.hash),

            is_ads_enabled: payload.is_ads_enabled ?? null,
            trends_tracking_url: toEventValue(payload.trends_tracking_url),
            tiktokads: toEventValue(payload.tiktokads, {hash: true}),
            clarity_id: toEventValue(payload.clarity_id),
            min_version: payload.min_version ?? null,
            review_type: payload.review_type ?? null,
            repeat_ads_count: payload.repeat_ads_count ?? null,
            ios_app_id: toEventValue(payload.ios_app_id),

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

        const eventParams = Object.fromEntries(
            Object.entries(rawParams).filter(([, v]) => v !== null && v !== undefined)
        );

        await logEvent(analytics, "cfg_integrity", eventParams);
    } catch (e) {
        expoUtilsWarn("reportConfigIntegrity:", e);
    }
};
