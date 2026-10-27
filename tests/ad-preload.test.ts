import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "bun:test";
import {FakeAd, ads, installAdsMocks, resetAds} from "./helpers/ads-mocks";

installAdsMocks();
const preload = await import("../utils/ad-preload");
const lifecycle = await import("../utils/app-lifecycle");
const {isAdTypeBlocked, setBlocklist} = await import("../utils/AdPlacementTracker");
const {createAdPreloader, isAdFresh, isInErrorPause, isPastMaxWait, readAdPreloadSettings} = preload;

const MIN = 60_000;
const config = (values: Record<string, unknown>) => values as any;

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
    resetAds();
    jest.clearAllTimers();
    jest.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    (globalThis as any).remoteConfigUtils = {};
});

describe("readAdPreloadSettings (chaves do Remote Config)", () => {
    test("sem chave nenhuma = comportamento de antes: sem pré-carga, sem pausa e sem limite de espera", () => {
        for (const value of [undefined, {}]) {
            expect(readAdPreloadSettings("appopen", value)).toEqual({enabled: false, maxAgeMs: 240 * MIN, errorPauseMs: 0, maxWaitMs: 0});
            expect(readAdPreloadSettings("interstitial", value)).toEqual({enabled: false, maxAgeMs: 60 * MIN, errorPauseMs: 0, maxWaitMs: 0});
        }
    });

    test("lê as chaves de cada formato e as compartilhadas", () => {
        const values = config({
            appopen_preload_enabled: true,
            appopen_preload_max_age_minutes: 120,
            interstitial_preload_enabled: false,
            interstitial_preload_max_age_minutes: 30,
            ad_preload_error_pause_seconds: 90,
            ad_load_max_wait_seconds: 3.5,
        });
        expect(readAdPreloadSettings("appopen", values)).toEqual({enabled: true, maxAgeMs: 120 * MIN, errorPauseMs: 90_000, maxWaitMs: 3500});
        expect(readAdPreloadSettings("interstitial", values)).toEqual({enabled: false, maxAgeMs: 30 * MIN, errorPauseMs: 90_000, maxWaitMs: 3500});
    });

    test("valor inválido cai no padrão: só true liga; número negativo, NaN, infinito ou texto não valem; idade 0 é o padrão", () => {
        for (const bad of ["true", 1, "1", null, -5, NaN, Infinity, "30", {}]) {
            const values = config({
                appopen_preload_enabled: bad,
                appopen_preload_max_age_minutes: bad,
                ad_preload_error_pause_seconds: bad,
                ad_load_max_wait_seconds: bad,
            });
            const settings = readAdPreloadSettings("appopen", values);
            expect({bad, enabled: settings.enabled}).toEqual({bad, enabled: false});
            if (bad !== 1) expect({bad, maxAgeMs: settings.maxAgeMs}).toEqual({bad, maxAgeMs: 240 * MIN});
            if (bad !== 1) expect({bad, pause: settings.errorPauseMs, wait: settings.maxWaitMs}).toEqual({bad, pause: 0, wait: 0});
        }
        expect(readAdPreloadSettings("interstitial", config({interstitial_preload_max_age_minutes: 0})).maxAgeMs).toBe(60 * MIN);
    });

    test("sem argumento lê o global.remoteConfigUtils", () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true, ad_load_max_wait_seconds: 2};
        expect(readAdPreloadSettings("interstitial")).toMatchObject({enabled: true, maxWaitMs: 2000});
        (globalThis as any).remoteConfigUtils = undefined;
        expect(readAdPreloadSettings("interstitial").enabled).toBe(false);
    });
});

describe("conferências pela hora (sem timer)", () => {
    test("idade: vale até o limite (exclusive); relógio que voltou conta como vencido", () => {
        const loadedAt = 1_000_000;
        expect(isAdFresh(loadedAt, loadedAt, 60 * MIN)).toBe(true);
        expect(isAdFresh(loadedAt, loadedAt + 60 * MIN - 1, 60 * MIN)).toBe(true);
        expect(isAdFresh(loadedAt, loadedAt + 60 * MIN, 60 * MIN)).toBe(false);
        expect(isAdFresh(loadedAt, loadedAt - 1, 60 * MIN)).toBe(false);
    });

    test("pausa por erro: só com pausa > 0 e erro registrado; acaba no limite", () => {
        const errorAt = 5_000_000;
        expect(isInErrorPause(0, errorAt, 60_000)).toBe(false);
        expect(isInErrorPause(errorAt, errorAt + 1, 0)).toBe(false);
        expect(isInErrorPause(errorAt, errorAt, 60_000)).toBe(true);
        expect(isInErrorPause(errorAt, errorAt + 59_999, 60_000)).toBe(true);
        expect(isInErrorPause(errorAt, errorAt + 60_000, 60_000)).toBe(false);
        expect(isInErrorPause(errorAt, errorAt - 1, 60_000)).toBe(false);
    });

    test("espera máxima: 0 é sem limite; passa no limite", () => {
        expect(isPastMaxWait(0, 10 * MIN, 0)).toBe(false);
        expect(isPastMaxWait(1000, 3999, 3000)).toBe(false);
        expect(isPastMaxWait(1000, 4000, 3000)).toBe(true);
    });
});

describe("gatilho do app open (app-lifecycle)", () => {
    test("ProcessLifecycleOwner só no Android com o módulo nativo", () => {
        const module = {addListener() {}};
        expect(lifecycle.pickAppLifecycleSource("android", module)).toBe("process-lifecycle");
        expect(lifecycle.pickAppLifecycleSource("android", undefined)).toBe("app-state");
        expect(lifecycle.pickAppLifecycleSource("android", null)).toBe("app-state");
        expect(lifecycle.pickAppLifecycleSource("ios", module)).toBe("app-state");
    });

    test("ON_START = active, ON_STOP = background; o resto é ignorado", () => {
        expect(lifecycle.processLifecycleState({type: "ON_START"})).toBe("active");
        expect(lifecycle.processLifecycleState({type: "ON_STOP"})).toBe("background");
        for (const event of [{type: "ON_RESUME"}, {type: "on_start"}, {}, null, undefined, "ON_START"]) {
            expect(lifecycle.processLifecycleState(event)).toBeNull();
        }
    });

    test("assina o evento ReactNativeAppLifecycle e traduz os estados; evento estranho não chega", () => {
        const states: string[] = [];
        expect(lifecycle.addAppLifecycleListener((state) => states.push(state))).toBe("process-lifecycle");
        expect(ads.lifecycleListeners.map((l) => l.event)).toEqual(["ReactNativeAppLifecycle"]);
        for (const type of ["ON_START", "ON_PAUSE", "ON_STOP"]) ads.lifecycleListeners[0].fn({type});
        expect(states).toEqual(["active", "background"]);
        expect(ads.appStateListeners).toHaveLength(0);
    });
});

describe("isAdTypeBlocked (bloqueio na pré-carga)", () => {
    test("só `*` e o nome do tipo bloqueiam; página, prefixo e placement exato ficam para a hora de mostrar", () => {
        setBlocklist(["index", "result_interstitial", "home_appopen_512"]);
        expect(isAdTypeBlocked("interstitial")).toBe(false);
        expect(isAdTypeBlocked("appopen")).toBe(false);
        setBlocklist(["interstitial"]);
        expect(isAdTypeBlocked("interstitial")).toBe(true);
        expect(isAdTypeBlocked("appopen")).toBe(false);
        setBlocklist(["*"]);
        expect(isAdTypeBlocked("appopen")).toBe(true);
        setBlocklist(undefined);
        expect(isAdTypeBlocked("appopen")).toBe(false);
    });
});

describe("createAdPreloader (reserva de um anúncio pronto)", () => {
    const make = () => createAdPreloader("interstitial", (unitId) => new FakeAd("interstitial", unitId));

    test("desligada: não carrega nada", () => {
        const reserve = make();
        expect(reserve.wants()).toBe(false);
        reserve.preload("unit-a");
        expect(FakeAd.created).toHaveLength(0);
    });

    test("ligada: uma carga por vez, guarda o carregado e entrega uma vez só, para o mesmo unitId", () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
        const reserve = make();
        reserve.preload("unit-a");
        reserve.preload("unit-a");
        expect(FakeAd.created).toHaveLength(1);
        const [ad] = FakeAd.created;
        expect(ad.loads).toBe(1);
        expect(reserve.take("unit-a")).toBeNull(); // ainda carregando
        ad.emit("loaded");
        expect(ad.listenerCount()).toBe(0); // listeners da pré-carga saem quando ela termina
        expect(reserve.wants()).toBe(false); // já tem pronto
        expect(reserve.take("unit-b")).toBeNull(); // outro unitId não leva o pronto
        expect(reserve.take("unit-a")).toBe(ad as any);
        expect(reserve.take("unit-a")).toBeNull();
        expect(reserve.wants()).toBe(true);
    });

    test("erro na pré-carga não tenta de novo sozinho; com pausa, o próximo gatilho espera o relógio", () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true, ad_preload_error_pause_seconds: 30};
        const reserve = make();
        reserve.preload("unit-a");
        FakeAd.created[0].emit("error", new Error("no fill"));
        expect(FakeAd.created).toHaveLength(1);
        expect(jest.getTimerCount()).toBe(0); // a pausa não usa timer
        jest.setSystemTime(Date.now() + 29_000);
        reserve.preload("unit-a");
        expect(FakeAd.created).toHaveLength(1);
        jest.setSystemTime(Date.now() + 1_000);
        reserve.preload("unit-a");
        expect(FakeAd.created).toHaveLength(2);
    });

    test("erro de carga na hora de mostrar também começa a pausa", () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true, ad_preload_error_pause_seconds: 10};
        const reserve = make();
        reserve.noteLoadError();
        reserve.preload("unit-a");
        expect(FakeAd.created).toHaveLength(0);
        jest.setSystemTime(Date.now() + 10_000);
        reserve.preload("unit-a");
        expect(FakeAd.created).toHaveLength(1);
    });

    test("pronto vencido sai da reserva (listeners removidos) e libera nova pré-carga", () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
        const reserve = make();
        reserve.preload("unit-a");
        const [old] = FakeAd.created;
        old.emit("loaded");
        jest.setSystemTime(Date.now() + 60 * MIN);
        expect(reserve.wants()).toBe(true);
        expect(old.removedAll).toBe(1);
        expect(reserve.take("unit-a")).toBeNull();
    });

    test("adopt: guarda com a pré-carga ligada (o mais novo fica), descarta com ela desligada", () => {
        const reserve = make();
        const late = new FakeAd("interstitial", "unit-a");
        late.emit("loaded");
        reserve.adopt(late as any, "unit-a");
        expect(late.removedAll).toBe(1);
        expect(reserve.take("unit-a")).toBeNull();

        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
        const first = new FakeAd("interstitial", "unit-a");
        const second = new FakeAd("interstitial", "unit-a");
        first.emit("loaded");
        second.emit("loaded");
        reserve.adopt(first as any, "unit-a");
        reserve.adopt(second as any, "unit-a");
        expect(first.removedAll).toBe(1);
        expect(reserve.take("unit-a")).toBe(second as any);
    });

    test("criar ou carregar que lança não trava a reserva", () => {
        (globalThis as any).remoteConfigUtils = {interstitial_preload_enabled: true};
        let fail = true;
        const reserve = createAdPreloader("interstitial", (unitId) => {
            if (fail) throw new Error("createForAdRequest falhou");
            return new FakeAd("interstitial", unitId);
        });
        expect(() => reserve.preload("unit-a")).not.toThrow();
        fail = false;
        reserve.preload("unit-a");
        expect(FakeAd.created).toHaveLength(1);
    });
});
