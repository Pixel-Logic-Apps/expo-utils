// Mocks para testar app open, intersticial e pré-carga com `bun test`: SDK de anúncios falso (o teste dispara
// LOADED/ERROR/OPENED/PAID/CLOSED na mão), react-native com AppState e o módulo nativo do react-native-applifecycle,
// e os módulos da lib que tocam SDK ou rede (Utils, PremiumUtils, ad-revenue). Nada disso está instalado neste repo.
import {mock} from "bun:test";

export const AdEventType = {
    LOADED: "loaded",
    ERROR: "error",
    OPENED: "opened",
    PAID: "paid",
    CLICKED: "clicked",
    CLOSED: "closed",
} as const;

type Listener = (payload?: any) => void;

/** Anúncio falso com o mesmo contrato da react-native-google-mobile-ads (MobileAd) que a lib usa. */
export class FakeAd {
    static created: FakeAd[] = [];
    loaded = false;
    loads = 0;
    shows = 0;
    showFails = false;
    removedAll = 0;
    private listeners = new Map<string, Set<Listener>>();

    constructor(
        public format: "app_open" | "interstitial" | "rewarded",
        public unitId: string,
    ) {
        FakeAd.created.push(this);
    }

    addAdEventListener(type: string, listener: Listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(listener);
        return () => {
            this.listeners.get(type)?.delete(listener);
        };
    }

    removeAllListeners() {
        this.removedAll++;
        this.listeners.clear();
    }

    listenerCount() {
        let count = 0;
        this.listeners.forEach((set) => (count += set.size));
        return count;
    }

    load() {
        this.loads++;
    }

    // Como o SDK: lança na hora se não carregou; a promise rejeita quando a exibição falha.
    show() {
        if (!this.loaded) throw new Error("not loaded");
        this.shows++;
        return this.showFails ? Promise.reject(new Error("show failed")) : Promise.resolve();
    }

    // Como o `_handleAdEvent` do SDK: atualiza o `loaded` antes de chamar os listeners.
    emit(type: string, payload?: any) {
        if (type === AdEventType.LOADED) this.loaded = true;
        if (type === AdEventType.CLOSED || type === AdEventType.ERROR) this.loaded = false;
        for (const listener of [...(this.listeners.get(type) ?? [])]) listener(payload);
    }
}

export const ads = {
    os: "android" as "android" | "ios",
    lifecycleModule: true, // NativeModules.ReactNativeAppLifecycle presente (app instalou o react-native-applifecycle)
    premium: false,
    attGate: Promise.resolve() as Promise<void>, // waitAttFlowDone()
    attTimeouts: [] as Array<number | undefined>,
    appStateListeners: [] as Array<(state: string) => void>,
    lifecycleListeners: [] as Array<{event: string; fn: (event: any) => void}>,
    emitterModules: [] as any[],
    revenue: [] as Array<{format: string; placementId: string}>,
    events: [] as Array<{name: string; params: any}>,
    statusBar: [] as boolean[],
    warns: [] as any[][],
};

export function resetAds() {
    ads.os = "android";
    ads.lifecycleModule = true;
    ads.premium = false;
    ads.attGate = Promise.resolve();
    ads.attTimeouts.length = 0;
    ads.appStateListeners.length = 0;
    ads.lifecycleListeners.length = 0;
    ads.emitterModules.length = 0;
    ads.revenue.length = 0;
    ads.events.length = 0;
    ads.statusBar.length = 0;
    ads.warns.length = 0;
    FakeAd.created.length = 0;
}

/** Esvazia as microtasks (os listeners da lib são async e encadeiam awaits). */
export const flush = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
};

export function installAdsMocks() {
    mock.module("react-native", () => ({
        Platform: {
            get OS() {
                return ads.os;
            },
        },
        AppState: {
            addEventListener: (_type: string, listener: (state: string) => void) => {
                ads.appStateListeners.push(listener);
                return {remove() {}};
            },
        },
        NativeModules: {
            get ReactNativeAppLifecycle() {
                return ads.lifecycleModule ? {addListener() {}, removeListeners() {}} : undefined;
            },
        },
        NativeEventEmitter: class {
            constructor(nativeModule: any) {
                ads.emitterModules.push(nativeModule);
            }
            addListener(event: string, fn: (event: any) => void) {
                ads.lifecycleListeners.push({event, fn});
                return {remove() {}};
            }
        },
        StatusBar: {setHidden: (hidden: boolean) => ads.statusBar.push(hidden)},
    }));
    mock.module("react-native-google-mobile-ads", () => ({
        AdEventType,
        RewardedAdEventType: {LOADED: "rewarded_loaded", EARNED_REWARD: "rewarded_earned_reward"},
        AppOpenAd: {createForAdRequest: (unitId: string) => new FakeAd("app_open", unitId)},
        InterstitialAd: {createForAdRequest: (unitId: string) => new FakeAd("interstitial", unitId)},
        RewardedAd: {createForAdRequest: (unitId: string) => new FakeAd("rewarded", unitId)},
    }));
    mock.module("@react-native-firebase/app", () => ({getApp: () => ({})}));
    mock.module("@react-native-firebase/analytics", () => ({
        getAnalytics: () => ({}),
        logEvent: (_analytics: any, name: string, params: any) => {
            ads.events.push({name, params});
            return Promise.resolve();
        },
    }));
    mock.module("../../utils/Utils", () => ({
        expoUtilsLog: () => {},
        expoUtilsWarn: (...args: any[]) => {
            ads.warns.push(args);
        },
        waitAttFlowDone: (timeoutMs?: number) => {
            ads.attTimeouts.push(timeoutMs);
            return ads.attGate;
        },
    }));
    mock.module("../../utils/PremiumUtils", () => ({
        PremiumUtils: {getIsPremiumStatus: () => Promise.resolve(ads.premium)},
    }));
    mock.module("../../utils/ad-revenue", () => ({
        logAdRevenue: (format: string, placementId: string) => {
            ads.revenue.push({format, placementId});
        },
    }));
}
