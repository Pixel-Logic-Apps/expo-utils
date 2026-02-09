import {expoUtilsLog} from "./Utils";

// Current route tracked by RouteTracker component
let currentRoute = "unknown";

// Registry: callerKey -> { adType -> index }
const callerRegistry: Map<string, Map<string, number>> = new Map();

// Counter per route+adType for assigning indices
const indexCounters: Map<string, number> = new Map();

// Blocklist loaded from Remote Config
let blocklist: string[] = [];

/**
 * Called by RouteTracker to update the current route.
 */
export function setCurrentRoute(pathname: string) {
    // Normalize: remove leading slash, replace slashes with dashes, default to "index"
    let normalized = pathname.replace(/^\/+/, "").replace(/\//g, "-");
    if (!normalized) normalized = "index";
    currentRoute = normalized;
    expoUtilsLog(`[expo-utils] Route set: ${currentRoute}`);
}

/**
 * Get the current route (for external use).
 */
export function getCurrentRoute(): string {
    return currentRoute;
}

/**
 * Extract a caller key from the stack trace.
 * This identifies the unique call site in the user's code.
 */
export function getCallerKey(): string {
    try {
        const err = new Error();
        const stack = err.stack || "";
        const lines = stack.split("\n");

        // Walk the stack to find the first frame NOT from expo-utils internals
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            // Skip frames from this file and other expo-utils internals
            if (
                line.includes("AdPlacementTracker") ||
                line.includes("LoadAdsManager") ||
                line.includes("appopen-ads") ||
                line.includes("banner-ad") ||
                line.includes("BannerAdComponent")
            ) {
                continue;
            }
            // Extract file:line:col - works for both Metro (dev) and Hermes (prod)
            // Metro format: "at functionName (file:line:col)" or "at file:line:col"
            // Hermes format: "at functionName (address)" or similar
            const match = line.match(/(?:at\s+.*?\s+\(|at\s+)(.*?:\d+:\d+)/);
            if (match) {
                return match[1];
            }
            // Hermes prod fallback: use the raw line trimmed
            const trimmed = line.trim();
            if (trimmed && trimmed !== "Error") {
                return trimmed;
            }
        }
    } catch {}
    return "unknown_caller";
}

/**
 * Generate a deterministic placement ID for an ad.
 *
 * Format: {route}_{adType}_{index}
 *
 * The same call site always produces the same ID.
 * Different call sites on the same page get different indices.
 *
 * @param adType - "interstitial" | "rewarded" | "banner" | "appopen"
 * @param tag - Optional manual tag to override automatic caller detection
 */
export function generatePlacementId(adType: string, tag?: string): string {
    const route = currentRoute;
    const callerKey = tag || getCallerKey();

    // Check if this caller already has an assigned index for this adType on this route
    if (!callerRegistry.has(callerKey)) {
        callerRegistry.set(callerKey, new Map());
    }
    const callerMap = callerRegistry.get(callerKey)!;
    const registryKey = `${route}_${adType}`;

    if (!callerMap.has(registryKey)) {
        // Assign next index for this route+adType combination
        const counterKey = `${route}_${adType}`;
        const currentIndex = (indexCounters.get(counterKey) || 0) + 1;
        indexCounters.set(counterKey, currentIndex);
        callerMap.set(registryKey, currentIndex);
    }

    const index = callerMap.get(registryKey)!;
    const placementId = `${route}_${adType}_${index}`;
    expoUtilsLog(`[expo-utils] Ad placement: ${placementId}`);
    return placementId;
}

/**
 * Load blocklist from Remote Config.
 */
export function setBlocklist(list?: string[]) {
    blocklist = list || [];
    expoUtilsLog(`[expo-utils] Ad blocklist loaded: ${JSON.stringify(blocklist)}`);
}

/**
 * Check if a placement ID is blocked by the blocklist.
 *
 * Matching hierarchy:
 * 1. Wildcard: "*" blocks everything
 * 2. Exact match: "index_interstitial_2"
 * 3. Prefix (page+type): "index_interstitial" matches "index_interstitial_2"
 * 4. Type only: "interstitial" matches any ID containing "_interstitial_"
 * 5. Page only: "index" matches any ID starting with "index_"
 */
export function isPlacementBlocked(placementId: string): boolean {
    if (!blocklist || blocklist.length === 0) return false;

    for (const pattern of blocklist) {
        // Wildcard
        if (pattern === "*") {
            expoUtilsLog(`[expo-utils] Ad blocked by wildcard: ${placementId}`);
            return true;
        }

        // Exact match
        if (pattern === placementId) {
            expoUtilsLog(`[expo-utils] Ad blocked (exact): ${placementId}`);
            return true;
        }

        // Prefix match: e.g. "index_interstitial" matches "index_interstitial_2"
        if (placementId.startsWith(pattern + "_")) {
            expoUtilsLog(`[expo-utils] Ad blocked (prefix): ${placementId} by ${pattern}`);
            return true;
        }

        // Type-only match: e.g. "interstitial" matches anything with "_interstitial_"
        const adTypes = ["interstitial", "rewarded", "banner", "appopen"];
        if (adTypes.includes(pattern) && placementId.includes(`_${pattern}_`)) {
            expoUtilsLog(`[expo-utils] Ad blocked (type): ${placementId} by ${pattern}`);
            return true;
        }

        // Page-only match: e.g. "index" matches "index_interstitial_2"
        // Only if pattern is not an ad type and placementId starts with pattern_
        if (!adTypes.includes(pattern) && !pattern.includes("_") && placementId.startsWith(pattern + "_")) {
            expoUtilsLog(`[expo-utils] Ad blocked (page): ${placementId} by ${pattern}`);
            return true;
        }
    }

    return false;
}
