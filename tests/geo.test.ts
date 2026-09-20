import {beforeEach, expect, test} from "bun:test";
import {installMocks, state} from "./helpers/rn-mocks";

installMocks();

// Formatos REAIS capturados dos três provedores em 2026-09-20 (IP e coordenadas removidos).
const REAL = {
    "ipwho.is": {success: true, country_code: "BR", region: "Para", region_code: "PA", city: "Paragominas"},
    bigdatacloud: {lookupSource: "ip geolocation", countryName: "Brazil", countryCode: "BR", principalSubdivision: "Para", principalSubdivisionCode: "BR-PA", city: "Paragominas", locality: "Paragominas"},
    geojs: {city: "Paragominas", country: "Brazil", country_code: "BR", country_code3: "BRA", region: "Pará", timezone: "America/Belem"},
};

type Route = {status?: number; body?: any; hang?: boolean};
let routes: Record<string, Route> = {};
let requested: string[] = [];
(globalThis as any).fetch = (url: string, init?: {signal?: AbortSignal}) => {
    requested.push(url);
    const host = Object.keys(routes).find((key) => url.includes(key));
    const route = host ? routes[host] : {status: 500};
    if (route.hang) {
        return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    }
    const status = route.status ?? 200;
    return Promise.resolve({ok: status >= 200 && status < 300, status, json: async () => route.body});
};

// módulo novo por teste (o lookup é memoizado por sessão)
let seq = 0;
const freshGeo = () => import(`../utils/geo.ts?fresh=${++seq}`);

beforeEach(() => {
    routes = {};
    requested = [];
    state.storage.clear();
    (globalThis as any).remoteConfigUtils = {};
    (globalThis as any).expoUtilsGeoDisabled = undefined;
});

test("parsers batem com o formato real de cada provedor", async () => {
    const {GEO_PROVIDERS} = await freshGeo();
    const byName = Object.fromEntries(GEO_PROVIDERS.map((p: any) => [p.name, p]));
    expect(byName["ipwho.is"].parse(REAL["ipwho.is"])).toEqual({country: "BR", state: "Para", stateCode: "PA", city: "Paragominas"});
    expect(byName.bigdatacloud.parse(REAL.bigdatacloud)).toEqual({country: "BR", state: "Para", stateCode: "PA", city: "Paragominas"}); // "BR-PA" → "PA"
    expect(byName.geojs.parse(REAL.geojs)).toEqual({country: "BR", state: "Pará", city: "Paragominas"});
    expect(byName["ipwho.is"].parse({success: false, message: "limit reached"})).toBeNull();
    expect(GEO_PROVIDERS.every((p: any) => p.url.startsWith("https://"))).toBe(true); // ATS do iOS bloqueia http
});

test("1º provedor responde: usa ele, grava cache e vira atributos do RC", async () => {
    routes = {"ipwho.is": {body: REAL["ipwho.is"]}};
    const geo = await freshGeo();
    const result = await geo.lookupGeo();
    expect(result).toEqual({country: "BR", state: "Para", stateCode: "PA", city: "Paragominas", source: "ipwho.is"});
    expect(requested).toHaveLength(1);
    expect(geo.toGeoAttributes(result)).toEqual({geo_country: "BR", geo_state: "Para", geo_state_code: "PA", geo_city: "Paragominas", geo_source: "ipwho.is"});
    expect(JSON.parse(state.storage.get("@expo_utils_geo")!).geo.source).toBe("ipwho.is");
});

test("cadeia: limite estourado no 1º + HTTP 402 (ban) no 2º → cai no 3º", async () => {
    routes = {"ipwho.is": {body: {success: false, message: "You've hit the daily limit"}}, bigdatacloud: {status: 402}, geojs: {body: REAL.geojs}};
    const result = await (await freshGeo()).lookupGeo();
    expect(result).toMatchObject({country: "BR", state: "Pará", city: "Paragominas", source: "geojs"});
    expect(requested).toHaveLength(3);
});

test("provedor pendurado é abortado no timeout e a cadeia segue", async () => {
    routes = {"ipwho.is": {hang: true}, bigdatacloud: {body: REAL.bigdatacloud}};
    const started = Date.now();
    const result = await (await freshGeo()).lookupGeo();
    expect(result?.source).toBe("bigdatacloud");
    expect(Date.now() - started).toBeLessThan(4500); // 3s do timeout + folga
}, 10000);

test("cache de 7 dias: não faz rede; cache vencido refaz", async () => {
    state.storage.set("@expo_utils_geo", JSON.stringify({at: Date.now() - 6 * 86400000, geo: {country: "GB", state: "England", stateCode: "ENG", city: "London", source: "ipwho.is"}}));
    expect((await (await freshGeo()).lookupGeo())?.city).toBe("London");
    expect(requested).toHaveLength(0);

    state.storage.set("@expo_utils_geo", JSON.stringify({at: Date.now() - 8 * 86400000, geo: {country: "GB", source: "ipwho.is"}}));
    routes = {"ipwho.is": {body: REAL["ipwho.is"]}};
    expect((await (await freshGeo()).lookupGeo())?.country).toBe("BR");
    expect(requested).toHaveLength(1);
});

test("desliga pelo Remote Config e pelo app.json — sem NENHUMA chamada de rede", async () => {
    routes = {"ipwho.is": {body: REAL["ipwho.is"]}};
    (globalThis as any).remoteConfigUtils = {geo_lookup_enabled: false};
    expect(await (await freshGeo()).lookupGeo()).toBeNull();
    (globalThis as any).remoteConfigUtils = {};
    (globalThis as any).expoUtilsGeoDisabled = true;
    expect(await (await freshGeo()).lookupGeo()).toBeNull();
    expect(requested).toHaveLength(0);
});

test("geo_lookup_url (endpoint próprio, só https) é tentado primeiro; http é ignorado", async () => {
    (globalThis as any).remoteConfigUtils = {geo_lookup_url: "https://geo.meuworker.dev/"};
    routes = {"meuworker.dev": {body: {country: "pt", region: "Lisboa", regionCode: "PT-11", city: "Lisboa"}}};
    expect(await (await freshGeo()).lookupGeo()).toEqual({country: "PT", state: "Lisboa", stateCode: "11", city: "Lisboa", source: "custom"});
    expect(requested).toEqual(["https://geo.meuworker.dev/"]);

    state.storage.clear();
    requested = [];
    (globalThis as any).remoteConfigUtils = {geo_lookup_url: "http://inseguro.example/"};
    routes = {"ipwho.is": {body: REAL["ipwho.is"]}};
    expect((await (await freshGeo()).lookupGeo())?.source).toBe("ipwho.is");
    expect(requested.some((url) => url.startsWith("http://"))).toBe(false);
});

test("tudo falhou: resolve null, não lança e NÃO memoiza (tenta de novo depois)", async () => {
    const geo = await freshGeo();
    expect(await geo.lookupGeo()).toBeNull();
    routes = {"ipwho.is": {body: REAL["ipwho.is"]}};
    expect((await geo.lookupGeo())?.source).toBe("ipwho.is");
});

test("resposta sem país válido é rejeitada (não grava lixo no RevenueCat)", async () => {
    routes = {"ipwho.is": {body: {success: true, country_code: "", city: "X"}}, bigdatacloud: {body: {countryCode: "BRA"}}, geojs: {body: "<html>"}};
    expect(await (await freshGeo()).lookupGeo()).toBeNull();
});
