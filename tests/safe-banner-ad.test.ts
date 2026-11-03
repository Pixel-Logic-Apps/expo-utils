// Banner fechado até carregar (utils/safe-banner-ad.tsx): sem anúncio não pode sobrar espaço em branco, e um
// refresh do AdMob que carregar depois abre de novo. React não está instalado neste repo: os hooks são por
// índice e o re-render é na mão, lendo a árvore de elementos que o componente devolve.
import {beforeEach, expect, mock, test} from "bun:test";

let states: any[] = [];
let hook = 0;
const element = (type: any, props: any) => ({type, props});
mock.module("react", () => ({
    memo: (fn: any) => fn,
    useState: (initial: any) => {
        const i = hook++;
        if (!(i in states)) states[i] = initial;
        return [states[i], (value: any) => (states[i] = value)];
    },
    useEffect: () => {},
}));
mock.module("react/jsx-runtime", () => ({jsx: element, jsxs: element, Fragment: "Fragment"}));
mock.module("react/jsx-dev-runtime", () => ({jsxDEV: element, Fragment: "Fragment"}));
mock.module("react-native", () => ({View: "View"}));
const BannerAd = () => null;
mock.module("react-native-google-mobile-ads", () => ({
    BannerAd,
    BannerAdSize: {ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER"},
    TestIds: {BANNER: "test-banner"},
}));
mock.module("../utils/Utils", () => ({default: {getRemoteConfigUtils: async () => ({})}, expoUtilsLog: () => {}}));
mock.module("../utils/PremiumUtils", () => ({PremiumUtils: {getIsPremiumStatus: async () => false}}));
mock.module("../utils/ad-revenue", () => ({logAdRevenue: () => {}}));

(globalThis as any).__DEV__ = false;
const {default: BannerAdComponent} = await import("../utils/safe-banner-ad");

/** Renderiza e devolve o container (View) e as props do BannerAd. */
const render = () => {
    hook = 0;
    const outer: any = BannerAdComponent({});
    const view = outer.type(outer.props);
    expect(view.type).toBe("View");
    expect(view.props.children.type).toBe(BannerAd);
    return {style: view.props.style, collapsable: view.props.collapsable, banner: view.props.children.props};
};

beforeEach(() => {
    states = [];
    (globalThis as any).isAdsEnabled = true;
    (globalThis as any).adUnits = {banner: "ca-app-pub-1/banner"};
});

test("monta fechado (altura 0, BannerAd montado) e só abre no onAdLoaded", () => {
    const closed = render();
    expect(closed.style).toEqual({height: 0, overflow: "hidden"});
    expect(closed.collapsable).toBe(false);
    expect(closed.banner.unitId).toBe("ca-app-pub-1/banner");
    expect(closed.banner.size).toBe("ANCHORED_ADAPTIVE_BANNER");

    closed.banner.onAdFailedToLoad({code: "googleMobileAds/error-code-no-fill"});
    expect(render().style).toEqual({height: 0, overflow: "hidden"});

    closed.banner.onAdLoaded({width: 411, height: 62});
    expect(render().style).toBeUndefined();
});

test("refresh que falha fecha; refresh seguinte que carrega abre de novo", () => {
    render().banner.onAdLoaded({width: 411, height: 62});
    render().banner.onAdFailedToLoad({code: "googleMobileAds/error-code-no-fill"});
    expect(render().style).toEqual({height: 0, overflow: "hidden"});
    render().banner.onAdLoaded({width: 411, height: 62});
    expect(render().style).toBeUndefined();
});
