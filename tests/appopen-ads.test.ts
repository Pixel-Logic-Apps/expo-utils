import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "bun:test";
import {FakeAd, ads, flush, installAdsMocks, resetAds} from "./helpers/ads-mocks";

installAdsMocks();
const {setBlocklist, setCurrentRoute} = await import("../utils/AdPlacementTracker");

// Instância nova do módulo por teste: o registro único e a reserva da pré-carga são estado de sessão.
let serial = 0;
const load = async (): Promise<typeof import("../utils/appopen-ads")> => import(`../utils/appopen-ads.tsx?boot=${++serial}`);
const lifecycle = async (type: string) => {
    for (const listener of ads.lifecycleListeners) listener.fn({type});
    await flush();
};
const appState = async (state: string) => {
    for (const listener of ads.appStateListeners) listener(state);
    await flush();
};
// Saída e volta do app inteiro pelo ProcessLifecycleOwner (Android com o react-native-applifecycle).
const leaveAndReturn = async () => {
    await lifecycle("ON_STOP");
    await lifecycle("ON_START");
};
const appOpens = () => FakeAd.created.filter((ad) => ad.format === "app_open");
const MIN = 60_000;

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
    resetAds();
    jest.clearAllTimers(); // a janela de 10 s de um teste não vaza para o próximo
    jest.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    setBlocklist([]);
    setCurrentRoute("/home");
    (globalThis as any).isAdsEnabled = true;
    (globalThis as any).adUnits = {appOpen: "ca-app-pub-1/appopen"};
    (globalThis as any).remoteConfigUtils = {};
});

describe("gatilho da volta", () => {
    test("Android com o módulo nativo: ProcessLifecycleOwner; o AppState (diálogo, intersticial, compra) não é assinado", async () => {
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        expect(ads.lifecycleListeners.map((l) => l.event)).toEqual(["ReactNativeAppLifecycle"]);
        expect(ads.appStateListeners).toHaveLength(0);
        await appState("background");
        await appState("active");
        expect(appOpens()).toHaveLength(0);
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(1);
        expect(appOpens()[0].loads).toBe(1);
    });

    test("Android sem o módulo: AppState, como antes", async () => {
        ads.lifecycleModule = false;
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        expect(ads.emitterModules).toHaveLength(0);
        expect(ads.appStateListeners).toHaveLength(1);
        await appState("background");
        await appState("active");
        expect(appOpens()).toHaveLength(1);
    });

    test("iOS: AppState, mesmo que exista um módulo com esse nome", async () => {
        ads.os = "ios";
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        expect(ads.emitterModules).toHaveLength(0);
        expect(ads.appStateListeners).toHaveLength(1);
        await appState("inactive");
        await appState("active");
        expect(appOpens()).toHaveLength(0); // inactive → active não é volta
        await appState("background");
        await appState("active");
        expect(appOpens()).toHaveLength(1);
    });

    test("o ON_START que o ProcessLifecycleOwner reenvia logo depois de assinar não conta como volta", async () => {
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await lifecycle("ON_START");
        expect(appOpens()).toHaveLength(0);
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(1);
    });

    test("registro único: chamar de novo não assina outra vez", async () => {
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        setupAppOpenListener();
        expect(ads.lifecycleListeners).toHaveLength(1);
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(1);
    });
});

describe("tudo desligado = comportamento de antes", () => {
    test("nada carrega no boot; na volta carrega e mostra no LOADED; PAID com o placement; janela de 10 s depois do CLOSED", async () => {
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await flush();
        expect(appOpens()).toHaveLength(0);
        expect(ads.attTimeouts).toEqual([]); // pré-carga desligada: nem espera o UMP/ATT

        await leaveAndReturn();
        const [ad] = appOpens();
        expect(ad.unitId).toBe("ca-app-pub-1/appopen");
        expect([ad.loads, ad.shows]).toEqual([1, 0]);
        ad.emit("loaded");
        await flush();
        expect(ad.shows).toBe(1);
        ad.emit("paid", {value: 0.001, currency: "USD"});
        expect(ads.revenue).toEqual([{format: "appopen", placementId: expect.stringMatching(/^home_appopen_\d+$/)}]);
        ad.emit("closed");
        await flush();
        expect(appOpens()).toHaveLength(1); // nada pré-carregado depois de fechar

        await leaveAndReturn();
        expect(appOpens()).toHaveLength(1); // janela fechada
        jest.advanceTimersByTime(10_000);
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(2);
    });

    test("erro de carga e exibição que falha reabrem a janela na hora", async () => {
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await leaveAndReturn();
        appOpens()[0].emit("error", new Error("no fill"));
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(2);
        const second = appOpens()[1];
        second.showFails = true;
        second.emit("loaded");
        await flush();
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(3);
    });

    test("premium, ads desligados, sem unitId e placement bloqueado: nada carrega", async () => {
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        ads.premium = true;
        await leaveAndReturn();
        ads.premium = false;
        (globalThis as any).isAdsEnabled = false;
        await leaveAndReturn();
        (globalThis as any).isAdsEnabled = true;
        (globalThis as any).adUnits = {};
        await leaveAndReturn();
        (globalThis as any).adUnits = {appOpen: "ca-app-pub-1/appopen"};
        setBlocklist(["home"]);
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(0);
        setBlocklist([]);
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(1);
    });
});

describe("pré-carga ligada (appopen_preload_enabled)", () => {
    test("o 1º carrega só depois do UMP/ATT; a volta mostra o pronto na hora, com placement e PAID da volta; ao fechar carrega o próximo", async () => {
        (globalThis as any).remoteConfigUtils = {appopen_preload_enabled: true};
        let releaseAtt!: () => void;
        ads.attGate = new Promise<void>((resolve) => (releaseAtt = resolve));
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await flush();
        expect(appOpens()).toHaveLength(0);
        expect(ads.attTimeouts).toEqual([120_000]); // não o teto de 15 s do promo
        releaseAtt();
        await flush();
        expect(appOpens()).toHaveLength(1);
        const [ready] = appOpens();
        expect(ready.loads).toBe(1);
        ready.emit("loaded");
        await flush();
        expect(ready.shows).toBe(0); // carregar nunca mostra

        setCurrentRoute("/result");
        await leaveAndReturn();
        expect(ready.shows).toBe(1);
        expect(appOpens()).toHaveLength(1); // nenhuma carga nova na volta
        ready.emit("paid", {value: 0.002, currency: "USD"});
        expect(ads.revenue).toEqual([{format: "appopen", placementId: expect.stringMatching(/^result_appopen_\d+$/)}]);
        ready.emit("closed");
        await flush();
        expect(appOpens()).toHaveLength(2);
        expect(appOpens()[1].loads).toBe(1);
        expect(appOpens()[1].shows).toBe(0);
    });

    test("pronto com 240 min (o padrão) é descartado e a volta carrega na hora", async () => {
        (globalThis as any).remoteConfigUtils = {appopen_preload_enabled: true};
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await flush();
        const [old] = appOpens();
        old.emit("loaded");
        jest.advanceTimersByTime(240 * MIN);
        await leaveAndReturn();
        expect(old.shows).toBe(0);
        expect(old.removedAll).toBe(1);
        const fresh = appOpens()[1];
        expect(fresh.loads).toBe(1);
        fresh.emit("loaded");
        await flush();
        expect(fresh.shows).toBe(1);
    });

    test("appopen_preload_max_age_minutes troca o prazo", async () => {
        (globalThis as any).remoteConfigUtils = {appopen_preload_enabled: true, appopen_preload_max_age_minutes: 30};
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await flush();
        appOpens()[0].emit("loaded");
        jest.advanceTimersByTime(29 * MIN);
        await leaveAndReturn();
        expect(appOpens()[0].shows).toBe(1);
        appOpens()[0].emit("closed");
        await flush();
        const next = appOpens()[1];
        next.emit("loaded");
        jest.advanceTimersByTime(31 * MIN);
        await leaveAndReturn();
        expect(next.shows).toBe(0);
        expect(appOpens()).toHaveLength(3);
    });

    test("pausa por erro: erro de carga segura nova pré-carga pelo tempo da chave, medido no relógio", async () => {
        (globalThis as any).remoteConfigUtils = {appopen_preload_enabled: true, ad_preload_error_pause_seconds: 60};
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await flush();
        appOpens()[0].emit("error", new Error("no fill"));
        await flush();
        expect(jest.getTimerCount()).toBe(0); // a pausa não usa timer
        expect(appOpens()).toHaveLength(1); // e a pré-carga não tenta de novo sozinha

        await leaveAndReturn(); // sem pronto: carrega na hora, como antes
        const onTheSpot = appOpens()[1];
        onTheSpot.emit("loaded");
        await flush();
        expect(onTheSpot.shows).toBe(1);
        jest.advanceTimersByTime(20_000);
        onTheSpot.emit("closed"); // 20 s depois do erro: ainda na pausa
        await flush();
        expect(appOpens()).toHaveLength(2);

        jest.advanceTimersByTime(41_000);
        await leaveAndReturn();
        const third = appOpens()[2];
        third.emit("loaded");
        await flush();
        third.emit("closed"); // 61 s depois do erro: pausa acabou
        await flush();
        expect(appOpens()).toHaveLength(4);
        expect(appOpens()[3].shows).toBe(0);
    });

    test("checagens na pré-carga: premium, ads desligados, bloqueio do tipo e sem unitId não pré-carregam", async () => {
        (globalThis as any).remoteConfigUtils = {appopen_preload_enabled: true};
        const cases: Array<[string, () => unknown, number]> = [
            ["premium", () => (ads.premium = true), 0],
            ["isAdsEnabled false", () => ((globalThis as any).isAdsEnabled = false), 0],
            ["bloqueio do tipo", () => setBlocklist(["appopen"]), 0],
            ["bloqueio de tudo", () => setBlocklist(["*"]), 0],
            ["sem unitId", () => ((globalThis as any).adUnits = {}), 0],
            ["controle: nada mudou", () => {}, 1],
        ];
        for (const [label, setup, expected] of cases) {
            resetAds();
            setBlocklist([]);
            (globalThis as any).isAdsEnabled = true;
            (globalThis as any).adUnits = {appOpen: "ca-app-pub-1/appopen"};
            setup();
            const {setupAppOpenListener} = await load();
            setupAppOpenListener();
            await flush();
            expect({label, count: appOpens().length}).toEqual({label, count: expected});
        }
    });

    test("bloqueio de página vale na volta: não mostra e o pronto fica para a próxima", async () => {
        (globalThis as any).remoteConfigUtils = {appopen_preload_enabled: true};
        setBlocklist(["result"]);
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await flush();
        const [ready] = appOpens();
        ready.emit("loaded");
        setCurrentRoute("/result");
        await leaveAndReturn();
        expect(ready.shows).toBe(0);
        setCurrentRoute("/home");
        await leaveAndReturn();
        expect(ready.shows).toBe(1);
        expect(appOpens()).toHaveLength(1);
    });
});

describe("espera máxima (ad_load_max_wait_seconds)", () => {
    test("sem pré-carga: o app open que carrega depois do limite não aparece, é descartado e a janela reabre", async () => {
        (globalThis as any).remoteConfigUtils = {ad_load_max_wait_seconds: 3};
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await leaveAndReturn();
        const late = appOpens()[0];
        jest.advanceTimersByTime(3_000);
        late.emit("loaded");
        await flush();
        expect(late.shows).toBe(0);
        expect(late.removedAll).toBe(1);
        expect(jest.getTimerCount()).toBe(0); // o app open não usa timer para a espera
        await leaveAndReturn();
        expect(appOpens()).toHaveLength(2);
        const inTime = appOpens()[1];
        jest.advanceTimersByTime(2_999);
        inTime.emit("loaded");
        await flush();
        expect(inTime.shows).toBe(1);
    });

    test("com a pré-carga ligada, o atrasado vira o pronto da próxima volta (sem outro pedido)", async () => {
        (globalThis as any).remoteConfigUtils = {appopen_preload_enabled: true, ad_load_max_wait_seconds: 3};
        const {setupAppOpenListener} = await load();
        setupAppOpenListener();
        await flush();
        appOpens()[0].emit("error", new Error("no fill")); // pré-carga do boot falhou
        await leaveAndReturn();
        const late = appOpens()[1];
        jest.advanceTimersByTime(5_000);
        late.emit("loaded");
        await flush();
        expect(late.shows).toBe(0);
        await leaveAndReturn();
        expect(late.shows).toBe(1);
        expect(appOpens()).toHaveLength(2);
    });
});
