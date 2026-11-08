// Banner do utils/safe-banner-ad.tsx: só aparece com o anúncio confirmado ligado (bannerConfirmed), reserva o espaço
// enquanto carrega (o anúncio entra sem mover o conteúdo), sai da tela se a 1ª carga não tiver anúncio e, depois do 1º
// anúncio, ignora falha de refresh. React não está
// instalado neste repo: os hooks são por índice e o re-render é na mão, lendo a árvore que o componente devolve.
import {beforeEach, expect, mock, test} from "bun:test";

let states: any[] = [];
let hook = 0;
let effects: Array<() => unknown> = [];
const session = {remote: {is_ads_enabled: true} as any, premium: false};
const element = (type: any, props: any) => ({type, props});
mock.module("react", () => ({
    memo: (fn: any) => fn,
    useState: (initial: any) => {
        const i = hook++;
        if (!(i in states)) states[i] = initial;
        return [states[i], (value: any) => (states[i] = typeof value === "function" ? value(states[i]) : value)];
    },
    useEffect: (fn: () => unknown) => effects.push(fn),
}));
mock.module("react/jsx-runtime", () => ({jsx: element, jsxs: element, Fragment: "Fragment"}));
mock.module("react/jsx-dev-runtime", () => ({jsxDEV: element, Fragment: "Fragment"}));
const BannerAd = () => null;
mock.module("react-native-google-mobile-ads", () => ({
    BannerAd,
    BannerAdSize: {ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER"},
    TestIds: {BANNER: "test-banner"},
}));
mock.module("../utils/Utils", () => ({default: {getRemoteConfigUtils: async () => session.remote}, expoUtilsLog: () => {}}));
mock.module("../utils/PremiumUtils", () => ({PremiumUtils: {getIsPremiumStatus: async () => session.premium}}));
mock.module("../utils/ad-revenue", () => ({logAdRevenue: () => {}}));

(globalThis as any).__DEV__ = false;
const {default: BannerAdComponent} = await import("../utils/safe-banner-ad");

/** Monta: o 1º render e o efeito que confirma o anúncio (premium, Remote Config da sessão, isAdsEnabled). */
const mount = async () => {
    hook = 0;
    const first = BannerAdComponent({});
    for (const fn of effects.splice(0)) fn();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    return first;
};

/** Renderiza e devolve as props do BannerAd, ou null quando o banner (ou o componente inteiro) saiu da árvore. */
const render = () => {
    hook = 0;
    const outer: any = BannerAdComponent({});
    if (outer === null) return null;
    const banner = outer.type(outer.props);
    if (banner === null) return null;
    expect(banner.type).toBe(BannerAd);
    return banner.props;
};

beforeEach(() => {
    states = [];
    effects = [];
    session.remote = {is_ads_enabled: true};
    session.premium = false;
    (globalThis as any).isAdsEnabled = true;
    (globalThis as any).adUnits = {banner: "ca-app-pub-1/banner"};
});

test("monta com o BannerAd (espaço reservado enquanto carrega) e continua depois do onAdLoaded", async () => {
    await mount();
    const loading = render();
    expect(loading.unitId).toBe("ca-app-pub-1/banner");
    expect(loading.size).toBe("ANCHORED_ADAPTIVE_BANNER");
    loading.onAdLoaded({width: 411, height: 62});
    expect(render()).not.toBeNull();
});

test("1ª carga sem anúncio: o BannerAd sai da árvore (sem espaço vazio e sem AdView escondido)", async () => {
    await mount();
    render().onAdFailedToLoad({code: "googleMobileAds/error-code-no-fill"});
    expect(render()).toBeNull();
});

test("depois do 1º anúncio, falha de refresh é ignorada (o anúncio anterior continua na tela)", async () => {
    await mount();
    render().onAdLoaded({width: 411, height: 62});
    render().onAdFailedToLoad({code: "googleMobileAds/error-code-no-fill"});
    expect(render()).not.toBeNull();
    render().onAdLoaded({width: 411, height: 62});
    expect(render()).not.toBeNull();
});

test("antes da confirmação não aparece; confirmado, aparece", async () => {
    expect(await mount()).toBeNull();
    expect(render()).not.toBeNull();
});

test("Remote Config sem is_ads_enabled true: não aparece", async () => {
    for (const remote of [{}, {is_ads_enabled: false}, {is_ads_enabled: "true"}, null]) {
        states = [];
        session.remote = remote;
        await mount();
        expect(render()).toBeNull();
    }
});

test("anúncio desligado na sessão (trava da loja, app ou boot sem a lib): não aparece mesmo com o Remote Config ligado", async () => {
    for (const value of [false, undefined]) {
        states = [];
        (globalThis as any).isAdsEnabled = value;
        await mount();
        expect(render()).toBeNull();
    }
});

test("premium: não aparece", async () => {
    session.premium = true;
    await mount();
    expect(render()).toBeNull();
});
