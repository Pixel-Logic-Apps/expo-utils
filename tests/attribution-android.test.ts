import {afterAll, beforeAll, expect, jest, test} from "bun:test";
import {advance, callNames, callsOf, eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
state.os = "android";
const attribution = await import("../utils/attribution");

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

test("fase 1: grava contexto + firebase id + storefront + user_id, força o sync e reporta", async () => {
    attribution.runAttributionPhase1("goog_real_key");
    await advance(100);

    expect(callNames()).not.toContain("enableAdServicesAttributionTokenCollection"); // só iOS
    expect(callsOf("setFirebaseAppInstanceID")).toEqual([["setFirebaseAppInstanceID", "fid-123"]]);
    const [context, store, referrer] = callsOf("setAttributes").map((call) => call[1]);
    expect(referrer).toMatchObject({install_medium: "organic"});
    expect(referrer.$mediaSource).toBeUndefined(); // orgânico não queima o Media Source (1ª gravação vence no RC)
    expect(context).toMatchObject({
        language: "pt",
        locale: "pt-BR",
        device_region: "BR",
        currency: "BRL",
        timezone: "America/Sao_Paulo",
        app_version: "2.1.0",
        build_number: "42",
        os_version: "14",
        device_model: "Pixel 8",
        install_date: "2026-08-15",
    });
    expect(context.expo_utils_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(store).toEqual({store_country: "GB"});
    expect(state.userId).toBe("$RCAnonymousID:de39831ab3284a198b7310d7411cddcc");

    // envio IMEDIATO ao fim da fase (sem debounce: o Android suspende timers do JS enquanto um
    // diálogo do sistema está na frente — medido no emulador)
    expect(callsOf("syncAttributesAndOfferingsIfNeeded")).toHaveLength(1);

    const [event] = eventsOf("rc_attribution");
    expect(event.params).toMatchObject({phase: 1, steps_ok: "fid,ctx,store,ref,uid", steps_fail: "", synced: 1});
});

test("fase 2: device ids SEMPRE + fb + push (FCM no Android) + geo, num envio só e sem depender de timer", async () => {
    attribution.runAttributionPhase2("goog_real_key", "na");
    await advance(100);
    // ordem: ids → fb → (push ‖ geo) → envio imediato, tudo sem avançar 1 timer sequer
    expect(callNames().slice(-7)).toEqual(["collectDeviceIdentifiers", "fb.getAnonymousID", "setFBAnonymousID", "getToken", "setPushToken", "setAttributes", "syncAttributesAndOfferingsIfNeeded"]);
    // geo por IP (ligada por padrão) vira atributos do customer
    expect(callsOf("setAttributes").at(-1)![1]).toEqual({geo_country: "GB", geo_state: "England", geo_state_code: "ENG", geo_city: "London", geo_source: "ipwho.is"});
    expect(state.fetched).toHaveLength(1);
    expect(callsOf("setFBAnonymousID")[0][1]).toBe("fb-anon-1");
    expect(callsOf("setPushToken")[0][1]).toBe("fcm-token:APA91b");
    expect(callNames()).not.toContain("getAPNSToken");

    expect(callsOf("syncAttributesAndOfferingsIfNeeded")).toHaveLength(2); // fase 1 + fase 2 (push já tinha terminado: 1 envio só)
    const event = eventsOf("rc_attribution")[1];
    expect(event.params).toMatchObject({phase: 2, steps_ok: "ids,fb,push,geo", steps_fail: "", synced: 1, att: "na"});
});

test("memoizado: chamar de novo não repete nada", async () => {
    const before = state.calls.length;
    await attribution.runAttributionPhase1("goog_real_key");
    await attribution.runAttributionPhase2("goog_real_key", "na");
    await advance(2500);
    expect(state.calls.length).toBe(before);
    expect(eventsOf("rc_attribution")).toHaveLength(2);
});
