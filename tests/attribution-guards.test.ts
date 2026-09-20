import {afterAll, beforeAll, expect, jest, test} from "bun:test";
import {advance, callNames, callsOf, eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
state.os = "ios";
state.apnsReady = false; // simulador / APNS que nunca chega
state.fail.add("setFirebaseAppInstanceID");
state.storefront = null;
(globalThis as any).remoteConfigUtils = {geo_lookup_enabled: false}; // geo desligada pelo Remote Config
const attribution = await import("../utils/attribution");

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

test("sem rckey utilizável: nada roda", async () => {
    await attribution.runAttributionPhase1(undefined);
    await attribution.runAttributionPhase2(undefined, "granted");
    await advance(2500);
    expect(state.calls).toEqual([]);
    expect(state.events).toEqual([]);
});

test("setRevenueCatAttributes: false e nenhum set quando o RC não está configurado", async () => {
    state.configured = false;
    expect(await attribution.setRevenueCatAttributes({plano: "pro"})).toBe(false);
    expect(state.calls).toEqual([]);
    state.configured = true;
});

test("etapa que falha não derruba as seguintes; push 'skip' não gasta um 2º envio", async () => {
    attribution.runAttributionPhase2("appl_real_key", "granted");
    await advance(200);
    expect(callNames()).toContain("collectDeviceIdentifiers");
    expect(callNames()).not.toContain("getToken"); // APNS indisponível → pula o push inteiro
    await advance(4500);
    const phase1 = eventsOf("rc_attribution").find((e) => e.params.phase === 1)!;
    const phase2 = eventsOf("rc_attribution").find((e) => e.params.phase === 2)!;
    expect(phase1.params).toMatchObject({steps_ok: "adsvc,ctx,uid", steps_fail: "fid:fail"}); // store = skip (sem storefront)
    expect(phase2.params).toMatchObject({steps_ok: "ids,fb", steps_fail: "", synced: 1}); // push e geo = skip
    expect(state.fetched).toEqual([]); // geo desligada: nenhuma chamada de rede
    expect(callsOf("syncAttributesAndOfferingsIfNeeded").length).toBeLessThanOrEqual(2);
});

test("janela de envios: o 5º em 60s NÃO é descartado — espera a janela abrir e sai", async () => {
    const already = callsOf("syncAttributesAndOfferingsIfNeeded").length;
    for (let i = already; i < 4; i++) {
        const pending = attribution.scheduleRcSync();
        await advance(2100);
        expect(await pending).toBe(1);
    }
    expect(callsOf("syncAttributesAndOfferingsIfNeeded")).toHaveLength(4); // abaixo do limite do SDK (5/min)

    let fifth: number | undefined;
    attribution.scheduleRcSync().then((result) => (fifth = result));
    await advance(5000);
    expect(callsOf("syncAttributesAndOfferingsIfNeeded")).toHaveLength(4); // janela cheia: segura
    expect(fifth).toBeUndefined();
    await advance(60000);
    expect(callsOf("syncAttributesAndOfferingsIfNeeded")).toHaveLength(5); // janela abriu: envia
    expect(fifth).toBe(1);
});

test("sets seguidos dentro do debounce viram UM envio", async () => {
    const a = attribution.scheduleRcSync();
    await advance(500);
    const b = attribution.scheduleRcSync();
    await advance(70000);
    expect(await a).toBe(await b);
});
