import {afterAll, beforeAll, expect, jest, test} from "bun:test";
import {advance, callsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
const attribution = await import("../utils/attribution");

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

test("erro de configuração/ofertas (23) NÃO é falha de atribuição: resolve 2 e não gera warn", async () => {
    // caso real medido em 2026-09-21: projeto do RC sem offering — o método rejeita, mas os
    // atributos já estavam no customer
    state.fail.add("syncAttributesAndOfferingsIfNeeded");
    state.failCode.syncAttributesAndOfferingsIfNeeded = "23";
    expect(await attribution.scheduleRcSync(true)).toBe(2);
    expect(state.warns).toEqual([]);
});

test("erro de rede (10) é falha de verdade: resolve 0 e avisa", async () => {
    state.failCode.syncAttributesAndOfferingsIfNeeded = "10";
    expect(await attribution.scheduleRcSync(true)).toBe(0);
    expect(String(state.warns[0][0])).toContain("attribution/sync");
    expect(callsOf("syncAttributesAndOfferingsIfNeeded")).toHaveLength(2);
    await advance(10);
});
