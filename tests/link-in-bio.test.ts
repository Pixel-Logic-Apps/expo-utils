import {beforeEach, expect, test} from "bun:test";
import {callsOf, eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
const {TrendingsTracker} = await import("../utils/TrendingsTracker");

// Servidor do link-in-bio (install.php) de mentira, no lugar do fetch.
let server: "match" | "no_match" | "offline" | "timeout" | "html" = "match";
const requests: string[] = [];
(globalThis as any).fetch = (url: string) => {
    requests.push(String(url));
    if (server === "offline") return Promise.reject(new TypeError("Network request failed"));
    if (server === "timeout") return Promise.reject(Object.assign(new Error("Aborted"), {name: "AbortError"}));
    if (server === "html") return Promise.resolve({ok: false, status: 502, json: () => Promise.reject(new SyntaxError("JSON Parse error: Unexpected character: <"))});
    const body = server === "match" ? {success: true, matched: true, campaign_id: "bio_outubro", time_to_install: 42} : {success: true, matched: false};
    return Promise.resolve({ok: true, status: 200, json: async () => body});
};

let serial = 0;
// Módulo NOVO = abertura nova do app (o "1x por sessão" é estado de módulo; o tracker zera o dele).
const openApp = async () => {
    TrendingsTracker.reset();
    const {trackLinkInBioInstall} = await import(`../utils/link-in-bio.ts?s=${++serial}`);
    await trackLinkInBioInstall("https://trendings.app/api/", "com.exemplo.app");
};
const DONE_KEY = "tr_is_first_launch_tracking";
const installEvents = () => eventsOf("install_attribution").map((e) => e.params);
const errorEvents = () => eventsOf("install_attribution_error").map((e) => e.params);

beforeEach(() => {
    state.storage.clear();
    state.events.length = 0;
    state.calls.length = 0;
    requests.length = 0;
    server = "match";
});

test("offline na 1ª abertura: sem flag, erro DISTINTO do sem-match, e a abertura seguinte reenvia e casa", async () => {
    server = "offline";
    await openApp();
    expect(state.storage.has(DONE_KEY)).toBe(false);
    expect(installEvents()).toEqual([]); // antes: install_attribution com matched 0, igual a um sem-match real
    expect(errorEvents()).toEqual([{source: "link_in_bio", error: "Network request failed"}]);
    expect(callsOf("setMediaSource")).toEqual([]);

    server = "match";
    await openApp();
    expect(requests).toEqual(["https://trendings.app/api/install.php", "https://trendings.app/api/install.php"]);
    expect(state.storage.get(DONE_KEY)).toBe("true");
    expect(installEvents()).toEqual([{source: "link_in_bio", matched: 1, campaign: "bio_outubro"}]);
    expect(callsOf("setMediaSource")).toEqual([["setMediaSource", "link_in_bio"]]);
    expect(callsOf("setCampaign")).toEqual([["setCampaign", "bio_outubro"]]);
});

test("timeout e resposta que não é JSON também tentam de novo (com o motivo no evento de erro)", async () => {
    server = "timeout";
    await openApp();
    server = "html";
    await openApp();
    expect(state.storage.has(DONE_KEY)).toBe(false);
    expect(errorEvents()).toEqual([
        {source: "link_in_bio", error: "Request timeout"},
        {source: "link_in_bio", error: "JSON Parse error: Unexpected character: <"},
    ]);
    expect(installEvents()).toEqual([]);
});

test("sem match de verdade: flag gravada, matched 0 uma vez e nunca mais reenvia", async () => {
    server = "no_match";
    await openApp();
    await openApp();
    expect(requests).toHaveLength(1);
    expect(state.storage.get(DONE_KEY)).toBe("true");
    expect(installEvents()).toEqual([{source: "link_in_bio", matched: 0}]);
    expect(errorEvents()).toEqual([]);
    expect(callsOf("setMediaSource")).toEqual([]);
});

test("install que já resolveu numa versão anterior (flag legada): não envia nada, mas o tracker sobe", async () => {
    state.storage.set(DONE_KEY, "true");
    await openApp();
    expect(requests).toEqual([]);
    expect(state.events).toEqual([]);
    expect(TrendingsTracker.isInitialized()).toBe(true);
});

test("1x por sessão: chamar de novo na mesma abertura não reenvia nem duplica evento", async () => {
    server = "offline";
    TrendingsTracker.reset();
    const {trackLinkInBioInstall} = await import(`../utils/link-in-bio.ts?s=${++serial}`);
    await Promise.all([trackLinkInBioInstall("https://trendings.app/api", "com.exemplo.app"), trackLinkInBioInstall("https://trendings.app/api", "com.exemplo.app")]);
    expect(requests).toHaveLength(1);
    expect(errorEvents()).toHaveLength(1);
});
