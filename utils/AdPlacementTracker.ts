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

// Expo-utils internal module names to skip in stack traces
const INTERNAL_MODULES = [
    "AdPlacementTracker",
    "LoadAdsManager",
    "appopen-ads",
    "banner-ad",
    "BannerAdComponent",
    "generatePlacementId",
    "getCallerKey",
    "showInterstitial",
    "showRewarded",
];

/**
 * Check if a stack frame is infrastructure (async/Promise/React internals)
 * and should be skipped when looking for the user's call site.
 */
function isInfrastructureFrame(line: string): boolean {
    // Hermes anonymous async functions (compiled from async/await)
    if (line.includes("?anon_")) return true;
    // Native frames
    if (line.includes("(native)")) return true;
    // Promise/async infrastructure
    if (/\bat\s+(asyncGeneratorStep|_next|_asyncToGenerator|tryCallOne|tryCallTwo|doResolve|Promise|apply|anonymous)\b/.test(line)) return true;
    // InternalBytecode (Hermes internals)
    if (line.includes("InternalBytecode")) return true;
    // React rendering pipeline
    if (/\bat\s+(react-stack-bottom-frame|renderWithHooks|updateFunctionComponent|beginWork|performUnitOfWork|workLoop|renderRoot|performWorkOnRoot|runWithFiberInDEV|flushSync)\b/.test(line)) return true;
    // React event system
    if (/\bat\s+(executeDispatch|onResponderRelease|_receiveSignal|_performTransitionSideEffects|dispatchEvent|batchedUpdates|forEachAccumulated|executeDispatchesAndReleaseTopLevel)\b/.test(line)) return true;
    return false;
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

        // Walk the stack to find the first frame from user code
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            // Skip expo-utils internal frames
            if (INTERNAL_MODULES.some((f) => line.includes(f))) {
                continue;
            }

            // Skip async/Promise/React infrastructure frames
            if (isInfrastructureFrame(line)) {
                continue;
            }

            // Extract file:line:col as caller key

            // V8/Metro: "at funcName (url:line:col)" or "at url:line:col"
            const v8Match = line.match(/at\s+(?:.*?\s+\()?(.*:\d+:\d+)/);
            if (v8Match) {
                return v8Match[1];
            }

            // JSC: "funcName@file:line:col"
            const jscMatch = line.match(/(.+)@(.*:\d+:\d+)/);
            if (jscMatch) {
                return jscMatch[2];
            }

            // Fallback: full trimmed line
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
