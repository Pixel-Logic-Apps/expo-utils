// ATT concedido numa nova tentativa do portão, depois de a fase 2 ter coletado os identificadores sem o IDFA:
// refreshAttributionAfterAtt espera a fase 2, recoleta e envia já.
import {afterAll, beforeAll, expect, jest, test} from "bun:test";
import {advance, callNames, callsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
state.os = "ios";
state.apnsReady = false;
(globalThis as any).remoteConfigUtils = {geo_lookup_enabled: false};
const attribution = await import("../utils/attribution");

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

test("sem rckey utilizável: nada roda", async () => {
    await attribution.refreshAttributionAfterAtt(undefined);
    expect(state.calls).toEqual([]);
});

test("espera a fase 2, recoleta os identificadores (agora com o IDFA) e envia na hora", async () => {
    attribution.runAttributionPhase2("appl_real_key", "undetermined");
    let refreshed = false;
    attribution.refreshAttributionAfterAtt("appl_real_key").then(() => (refreshed = true));
    await advance(5000);
    expect(refreshed).toBe(true);
    expect(callsOf("collectDeviceIdentifiers")).toHaveLength(2);
    const names = callNames();
    const phase2Sync = names.lastIndexOf("syncAttributesAndOfferingsIfNeeded", names.lastIndexOf("collectDeviceIdentifiers"));
    expect(phase2Sync).toBeGreaterThan(names.indexOf("collectDeviceIdentifiers")); // a 2ª coleta veio depois do envio da fase 2
    expect(names.at(-1)).toBe("syncAttributesAndOfferingsIfNeeded"); // e foi enviada
});
