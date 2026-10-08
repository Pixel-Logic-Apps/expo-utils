import {beforeEach, expect, test} from "bun:test";
import {callsOf, eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
state.os = "android";

let serial = 0;
// Módulo NOVO = abertura nova do app (a fase 1 é memoizada por sessão); o AsyncStorage persiste.
const openApp = async () => {
    const attribution = await import(`../utils/attribution.ts?s=${++serial}`);
    await attribution.runAttributionPhase1("goog_real_key");
    await new Promise((resolve) => setTimeout(resolve, 0)); // o rc_attribution sai num .then destacado
};
const KEY = "@expo_utils_install_referrer";
const GOOGLE_ADS = "gbraid=0AAAAA&utm_source=google&utm_medium=cpc&utm_campaign=app_br";
const referrerReads = () => callsOf("getInstallReferrerAsync").length;
const referrerAttributes = () => callsOf("setAttributes").map((call) => call[1]).filter((attributes) => "install_referrer" in attributes);
const installEvents = () => eventsOf("install_attribution").map((e) => e.params);

beforeEach(() => {
    state.storage.clear();
    state.calls.length = 0;
    state.events.length = 0;
    state.fail.clear();
    state.installReferrer = GOOGLE_ADS;
    state.installedAt = "2026-08-15T07:53:00Z";
});

test("1ª abertura: lê a API 1x, grava o resultado e emite install_attribution 1x", async () => {
    await openApp();
    expect(referrerReads()).toBe(1);
    expect(JSON.parse(state.storage.get(KEY)!)).toEqual({referrer: GOOGLE_ADS, installedAt: "2026-08-15T07:53:00.000Z"});
    expect(installEvents()).toEqual([{source: "play_referrer", matched: 1, media_source: "Google Ads", campaign: "app_br"}]);
    // o id do clique vai para o customer com o tipo (gbraid NÃO é gclid)
    expect(referrerAttributes()).toEqual([
        {$mediaSource: "Google Ads", $campaign: "app_br", install_referrer: GOOGLE_ADS, install_medium: "cpc", gclid: "0AAAAA", click_id_type: "gbraid"},
    ]);
});

test("aberturas seguintes: não chamam a API nem repetem o evento, mas regravam os atributos", async () => {
    await openApp();
    await openApp();
    await openApp();
    expect(referrerReads()).toBe(1); // antes: 1 leitura e 1 install_attribution POR ABERTURA
    expect(installEvents()).toHaveLength(1);
    expect(referrerAttributes()).toHaveLength(3);
    expect(new Set(referrerAttributes().map((attributes) => JSON.stringify(attributes))).size).toBe(1);
    const phase1 = eventsOf("rc_attribution").filter((e) => e.params.phase === 1);
    expect(phase1.map((e) => e.params.steps_ok)).toEqual(Array(3).fill("fid,ctx,store,ref,uid"));
});

test("reinstalação / backup restaurado em outro aparelho (outro firstInstallTime): lê e emite de novo", async () => {
    await openApp();
    state.installedAt = "2026-10-01T10:00:00Z";
    state.installReferrer = "utm_source=google-play&utm_medium=organic";
    await openApp();
    expect(referrerReads()).toBe(2);
    expect(installEvents()).toEqual([
        {source: "play_referrer", matched: 1, media_source: "Google Ads", campaign: "app_br"},
        {source: "play_referrer", matched: 0},
    ]);
    expect(JSON.parse(state.storage.get(KEY)!).installedAt).toBe("2026-10-01T10:00:00.000Z");
});

test("API falhou (Play indisponível): nada gravado, sem evento — a próxima abertura tenta de novo", async () => {
    state.fail.add("getInstallReferrerAsync");
    await openApp();
    expect(state.storage.has(KEY)).toBe(false);
    expect(installEvents()).toEqual([]);
    expect(eventsOf("rc_attribution")[0].params.steps_fail).toBe("ref:fail");

    state.fail.clear();
    await openApp();
    expect(referrerReads()).toBe(2);
    expect(installEvents()).toHaveLength(1);
    expect(state.storage.has(KEY)).toBe(true);
});

test("referrer vazio também é resultado: gravado e a API não é chamada de novo", async () => {
    state.installReferrer = "";
    await openApp();
    await openApp();
    expect(referrerReads()).toBe(1);
    expect(installEvents()).toEqual([]);
    expect(eventsOf("rc_attribution").map((e) => e.params.steps_ok)).toEqual(["fid,ctx,store,uid", "fid,ctx,store,uid"]); // ref = skip
});
