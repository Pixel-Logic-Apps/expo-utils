import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "bun:test";
import {FakeAd, ads, flush, installAdsMocks, resetAds} from "./helpers/ads-mocks";

installAdsMocks();
const {setBlocklist, setCurrentRoute} = await import("../utils/AdPlacementTracker");

// Instância nova do módulo por teste: a reserva da pré-carga é estado de sessão.
let serial = 0;
const load = async () => (await import(`../utils/LoadAdsManager.ts?boot=${++serial}`)).default as typeof import("../utils/LoadAdsManager").default;
const interstitials = () => FakeAd.created.filter((ad) => ad.format === "interstitial");
const names = () => ads.events.map((event) => event.name);
const placements = () => [...new Set(ads.events.map((event) => event.params.placementId))];
const MIN = 60_000;
const UNIT = "ca-app-pub-1/interstitial";

// Mostra até o fim: carrega (se for o caso), abre, paga e fecha.
const watch = async (ad: FakeAd, {load = true} = {}) => {
    if (load) ad.emit("loaded");
    await flush();
    ad.emit("opened");
    ad.emit("paid", {value: 0.001, currency: "USD"});
    ad.emit("closed");
    await flush();
};

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
    resetAds();
    jest.clearAllTimers();
    jest.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    setBlocklist([]);
    setCurrentRoute("/home");
    (globalThis as any).isAdsEnabled = true;
    (globalThis as any).adUnits = {interstitial: UNIT};
    (globalThis as any).remoteConfigUtils = {};
});

describe("tudo desligado = comportamento de antes", () => {
    test("carrega na chamada; AdLOADED → OPENED → AdCLOSED com o placement da chamada; true; nada pré-carregado; nenhum timer", async () => {
        const manager = await load();
        const result = manager.showInterstitial(undefined, "fim");
        await flush();
        const [ad] = interstitials();
        expect([ad.unitId, ad.loads, ad.shows]).toEqual([UNIT, 1, 0]);
        expect(jest.getTimerCount()).toBe(0);
        ad.emit("loaded");
        await flush();
        expect(ad.shows).toBe(1);
        await watch(ad, {load: false});
        expect(await result).toBe(true);
        expect(names()).toEqual(["AdLOADED", "OPENED", "AdCLOSED"]);
        expect(placements()).toEqual([expect.stringMatching(/^home_interstitial_\d+$/)]);
        expect(ads.revenue).toEqual([{format: "interstitial", placementId: placements()[0]}]);
        expect(ads.statusBar).toEqual([true, false]);
        expect(interstitials()).toHaveLength(1);
    });

    test("erro de carga: AdERROR e false; exibição que falha: false", async () => {
        const manager = await load();
        const failed = manager.showInterstitial();
        await flush();
        interstitials()[0].emit("error", new Error("no fill"));
        expect(await failed).toBe(false);
        expect(names()).toEqual(["AdERROR"]);

        const notShown = manager.showInterstitial();
        await flush();
        interstitials()[1].showFails = true;
        interstitials()[1].emit("loaded");
        expect(await notShown).toBe(false);
        expect(interstitials()).toHaveLength(2);
    });

    test("premium, ads desligados, bloqueio e sem unitId: true sem carregar", async () => {
        const manager = await load();
        ads.premium = true;
        expect(await manager.showInterstitial()).toBe(true);
        ads.premium = false;
        (globalThis as any).remoteConfigUtils = {is_ads_enabled: false};
        expect(await manager.showInterstitial()).toBe(true);
        (globalThis as any).remoteConfigUtils = {};
        setBlocklist(["interstitial"]);
        expect(await manager.showInterstitial()).toBe(true);
        setBlocklist([]);
        (globalThis as any).adUnits = {};
        expect(await manager.showInterstitial()).toBe(true);
        expect(interstitials()).toHaveLength(0);
    });
});

describe("pré-carga ligada (interstitial_preload_enabled)", () => {
    test("o 1º carrega na chamada; ao fechar pré-carrega; o 2º aparece na hora com AdLOADED e PAID do placement da chamada", async () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
        const manager = await load();
        const first = manager.showInterstitial(undefined, "a");
        await flush();
        await watch(interstitials()[0]);
        expect(await first).toBe(true);
        expect(interstitials()).toHaveLength(2);
        const ready = interstitials()[1];
        expect([ready.unitId, ready.loads, ready.shows]).toEqual([UNIT, 1, 0]);
        ready.emit("loaded");
        await flush();
        expect(ready.shows).toBe(0); // carregar nunca mostra
        expect(ads.events.filter((event) => event.name === "AdLOADED")).toHaveLength(1); // o da pré-carga não sai

        ads.events.length = 0;
        ads.revenue.length = 0;
        setCurrentRoute("/result");
        const second = manager.showInterstitial(undefined, "b");
        await flush();
        expect(ready.shows).toBe(1);
        expect(interstitials()).toHaveLength(2); // nenhuma carga na chamada
        await watch(ready, {load: false});
        expect(await second).toBe(true);
        expect(names()).toEqual(["AdLOADED", "OPENED", "AdCLOSED"]);
        expect(placements()).toEqual([expect.stringMatching(/^result_interstitial_\d+$/)]);
        expect(ads.revenue).toEqual([{format: "interstitial", placementId: placements()[0]}]);
        expect(interstitials()).toHaveLength(3); // e já pré-carregou o próximo
    });

    test("pronto vencido (60 min por padrão; a chave troca) é descartado e a chamada carrega na hora", async () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
        const manager = await load();
        const first = manager.showInterstitial();
        await flush();
        await watch(interstitials()[0]);
        await first;
        const old = interstitials()[1];
        old.emit("loaded");
        jest.advanceTimersByTime(60 * MIN);
        const second = manager.showInterstitial();
        await flush();
        expect(old.shows).toBe(0);
        expect(old.removedAll).toBe(1);
        const onTheSpot = interstitials()[2];
        expect(onTheSpot.loads).toBe(1);
        await watch(onTheSpot);
        expect(await second).toBe(true);

        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true, interstitial_preload_max_age_minutes: 90};
        const next = interstitials()[3];
        next.emit("loaded");
        jest.advanceTimersByTime(89 * MIN);
        const third = manager.showInterstitial();
        await flush();
        expect(next.shows).toBe(1);
        await watch(next, {load: false});
        expect(await third).toBe(true);
    });

    test("unitId diferente do pronto: carrega na hora e o pronto continua guardado", async () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
        const manager = await load();
        const first = manager.showInterstitial();
        await flush();
        await watch(interstitials()[0]);
        await first;
        const ready = interstitials()[1];
        ready.emit("loaded");

        const custom = manager.showInterstitial("ca-app-pub-1/outro");
        await flush();
        expect(ready.shows).toBe(0);
        const other = interstitials()[2];
        expect(other.unitId).toBe("ca-app-pub-1/outro");
        await watch(other);
        expect(await custom).toBe(true);
        expect(interstitials()).toHaveLength(3); // já havia pronto: não pré-carrega outro

        const back = manager.showInterstitial();
        await flush();
        expect(ready.shows).toBe(1);
    });

    test("pausa por erro: o erro da pré-carga segura a próxima até passar a pausa", async () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true, ad_preload_error_pause_seconds: 120};
        const manager = await load();
        const first = manager.showInterstitial();
        await flush();
        await watch(interstitials()[0]);
        await first;
        interstitials()[1].emit("error", new Error("no fill")); // a pré-carga falhou
        await flush();
        expect(jest.getTimerCount()).toBe(0);

        const second = manager.showInterstitial(); // sem pronto: carrega na hora
        await flush();
        await watch(interstitials()[2]);
        await second;
        expect(interstitials()).toHaveLength(3); // fechou dentro da pausa: não pré-carrega

        jest.advanceTimersByTime(120_000);
        const third = manager.showInterstitial();
        await flush();
        await watch(interstitials()[3]);
        await third;
        expect(interstitials()).toHaveLength(5); // pausa acabou: pré-carregou
    });

    test("checagens na pré-carga: premium, ads desligados e bloqueio do tipo não pré-carregam", async () => {
        const cases: Array<[string, () => unknown, number]> = [
            ["premium", () => (ads.premium = true), 1],
            ["is_ads_enabled false", () => ((globalThis as any).remoteConfigUtils.is_ads_enabled = false), 1],
            ["isAdsEnabled false", () => ((globalThis as any).isAdsEnabled = false), 1],
            ["bloqueio do tipo", () => setBlocklist(["interstitial"]), 1],
            ["bloqueio de tudo", () => setBlocklist(["*"]), 1],
            ["bloqueio só da página (vale na chamada)", () => setBlocklist(["home"]), 2],
            ["controle: nada mudou", () => {}, 2],
        ];
        for (const [label, setup, expected] of cases) {
            resetAds();
            setBlocklist([]);
            (globalThis as any).isAdsEnabled = true;
            (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
            const manager = await load();
            const shown = manager.showInterstitial();
            await flush();
            const [ad] = interstitials();
            ad.emit("loaded");
            await flush();
            setup(); // muda com o anúncio aberto: quem confere é a pré-carga do fechamento
            ad.emit("closed");
            expect(await shown).toBe(true);
            await flush();
            expect({label, count: interstitials().length}).toEqual({label, count: expected});
        }
    });
});

describe("espera máxima (ad_load_max_wait_seconds)", () => {
    test("passou do limite: resolve true; o que chega depois não aparece nem gera evento; sem pré-carga é descartado", async () => {
        (globalThis as any).remoteConfigUtils = {ad_load_max_wait_seconds: 3};
        const manager = await load();
        let result: boolean | undefined;
        manager.showInterstitial().then((value) => (result = value));
        await flush();
        jest.advanceTimersByTime(2_999);
        await flush();
        expect(result).toBeUndefined();
        jest.advanceTimersByTime(1);
        await flush();
        expect(result).toBe(true); // o fluxo do app segue sem anúncio
        const late = interstitials()[0];
        late.emit("loaded");
        await flush();
        expect(late.shows).toBe(0);
        expect(late.removedAll).toBe(1);
        expect(names()).toEqual([]);
    });

    test("com a pré-carga ligada, o atrasado vira o pronto da próxima chamada", async () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true, ad_load_max_wait_seconds: 3};
        const manager = await load();
        const first = manager.showInterstitial();
        await flush();
        jest.advanceTimersByTime(3_000);
        expect(await first).toBe(true);
        const late = interstitials()[0];
        late.emit("loaded");
        await flush();
        expect(late.shows).toBe(0);
        const second = manager.showInterstitial();
        await flush();
        expect(late.shows).toBe(1);
        expect(interstitials()).toHaveLength(1);
        await watch(late, {load: false});
        expect(await second).toBe(true);
    });

    test("timer suspenso (Activity pausada no Android): o LOADED depois do limite pela hora também não aparece", async () => {
        (globalThis as any).remoteConfigUtils = {ad_load_max_wait_seconds: 3};
        const manager = await load();
        const result = manager.showInterstitial();
        await flush();
        jest.setSystemTime(Date.now() + 10_000); // relógio andou, timer não disparou
        const late = interstitials()[0];
        late.emit("loaded");
        expect(await result).toBe(true);
        expect(late.shows).toBe(0);
        expect(jest.getTimerCount()).toBe(0); // o LOADED limpou o timer
    });

    test("erro depois do limite não gera AdERROR (a chamada já terminou); dentro do limite aparece normalmente", async () => {
        (globalThis as any).remoteConfigUtils = {ad_load_max_wait_seconds: 3};
        const manager = await load();
        const gaveUp = manager.showInterstitial();
        await flush();
        jest.advanceTimersByTime(3_000);
        expect(await gaveUp).toBe(true);
        interstitials()[0].emit("error", new Error("no fill"));
        await flush();
        expect(names()).toEqual([]);

        const inTime = manager.showInterstitial();
        await flush();
        jest.advanceTimersByTime(2_000);
        const ad = interstitials()[1];
        ad.emit("loaded");
        await flush();
        expect(ad.shows).toBe(1);
        expect(jest.getTimerCount()).toBe(0);
        await watch(ad, {load: false});
        expect(await inTime).toBe(true);
        expect(names()).toEqual(["AdLOADED", "OPENED", "AdCLOSED"]);
    });
});
