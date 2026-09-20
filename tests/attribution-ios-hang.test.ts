import {afterAll, beforeAll, expect, jest, test} from "bun:test";
import {advance, callNames, callsOf, eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
state.os = "ios";
state.hang.add("fb.getAnonymousID"); // SDK do FB com promise nativa que nunca resolve
const attribution = await import("../utils/attribution");

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

test("iOS, ATT negado, FB pendurado: a fila NÃO trava, a fase 1 roda antes e o push vai com APNS", async () => {
    // chamada direta da fase 2 (app que usa só Utils.setupAttribution): a fase 1 é garantida
    attribution.runAttributionPhase2("appl_real_key", "denied");
    await advance(100);
    expect(callNames().slice(0, 2)).toEqual(["enableAdServicesAttributionTokenCollection", "getAppInstanceId"]);
    expect(callNames()).toContain("collectDeviceIdentifiers"); // mesmo com ATT negado
    expect(callNames()).not.toContain("setFBAnonymousID");
    expect(callNames()).not.toContain("setPushToken"); // ainda preso no timeout do FB

    await advance(3000); // estoura o timeout de 3s da etapa do FB
    expect(state.warns.some((warn) => String(warn[0]).includes("attribution/fb: timeout"))).toBe(true);
    expect(callsOf("setPushToken")).toEqual([["setPushToken", "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"]]);
    expect(callsOf("setAttributes").map((call) => call[1])).toContainEqual({fcm_token: "fcm-token:APA91b"});

    await advance(2500);
    const event = eventsOf("rc_attribution").find((e) => e.params.phase === 2)!;
    expect(event.params).toMatchObject({steps_ok: "ids,push,geo", steps_fail: "fb:timeout", synced: 1, att: "denied"});
    expect(eventsOf("rc_attribution").find((e) => e.params.phase === 1)!.params.steps_ok).toBe("adsvc,fid,ctx,store,uid");
});
