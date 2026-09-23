import {afterAll, beforeEach, expect, mock, spyOn, test} from "bun:test";

const KEY = "@expo_utils_taichi_v1";
const HOUR = 3_600_000;
const storage = new Map<string, string>();
const events: Array<{name: string; params: any}> = [];
let now = 0, serial = 0, failRead = false, failWrite = false;
let readGate: Promise<void> | undefined;
const clock = spyOn(Date, "now").mockImplementation(() => now);
mock.module("@react-native-async-storage/async-storage", () => ({default: {
    getItem: async (key: string) => {
        await readGate;
        if (failRead) throw Error("read failed");
        return storage.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
        if (failWrite) throw Error("write failed");
        storage.set(key, value);
    },
}}));
mock.module("@react-native-firebase/app", () => ({getApp: () => ({})}));
mock.module("@react-native-firebase/analytics", () => ({
    getAnalytics: () => ({}),
    logEvent: (_: any, name: string, params: any) => { events.push({name, params}); },
    setUserId: () => {}, setUserProperty: () => {},
}));

// Instância de módulo nova simula outro boot sem API de reset no código de produção.
const load = () => import(`../utils/ad-revenue.ts?boot=${++serial}`);
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const milestones = () => events.filter(({name}) => name.startsWith("taichi_rev_"));
beforeEach(() => {
    storage.clear(); events.length = 0;
    now = Date.UTC(2026, 8, 23);
    failRead = failWrite = false; readGate = undefined;
    (globalThis as any).remoteConfigUtils = {};
});
afterAll(() => clock.mockRestore());

test("US$ 0,25 cruza os 60 marcos, sem value monetário e sem repetir no mesmo boot", async () => {
    const ads = await load();
    await ads.initAdRevenue();
    ads.logAdRevenue("rewarded", "export", {value: 0.25, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(60);
    expect(new Set(milestones().map((e) => e.name)).size).toBe(60);
    expect(milestones().every((e) => e.name.length <= 40 && Object.keys(e.params).length === 0)).toBe(true);
    expect(milestones().map((e) => e.name)).toContain("taichi_rev_0_10usd_24h");
    ads.logAdRevenue("banner", "home", {value: 0.01, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(60);
});

test("impressões concorrentes somam frações de centavo sem perder atualização nem arredondar cada ad", async () => {
    const ads = await load();
    await ads.initAdRevenue();
    for (let i = 0; i < 300; i++) ads.logAdRevenue("banner", "home", {value: 0.00000025, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(0); // US$ 0,000075 ainda não chega ao primeiro corte.
    ads.logAdRevenue("interstitial", "result", {value: 0.000025, currencyCode: "USD"});
    await flush();
    expect(milestones().map((e) => e.name)).toEqual([
        "taichi_rev_0_0001usd_24h", "taichi_rev_0_0001usd_72h", "taichi_rev_0_0001usd_7d",
    ]);
    expect(JSON.parse(storage.get(KEY)!).usd).toBeCloseTo(0.0001, 12);
});

test("novo boot conserva receita, início e marcos; init repetido não reinicia a janela", async () => {
    let ads = await load();
    await ads.initAdRevenue();
    const start = now;
    ads.logAdRevenue("banner", "home", {value: 0.00015, currency: "USD"});
    await flush();
    storage.set("@first_open_logged", "true");
    now += HOUR;
    ads = await load();
    await Promise.all([ads.initAdRevenue(), ads.initAdRevenue()]);
    ads.logAdRevenue("appopen", "return", {value: 0.0001, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(6);
    expect(new Set(milestones().map((e) => e.name)).size).toBe(6);
    expect(JSON.parse(storage.get(KEY)!)).toMatchObject({firstOpen: start, usd: 0.00025});
});

test.each([[24, 40], [72, 20], [168, 0]])("ao completar %i horas, só emite as janelas ainda abertas (%i eventos)", async (hours, count) => {
    const ads = await load();
    await ads.initAdRevenue();
    now += hours * HOUR;
    ads.logAdRevenue("rewarded", "export", {value: 0.25, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(count);
    expect(milestones().some((e) => e.name.endsWith("_24h"))).toBe(false);
    if (hours >= 72) expect(milestones().some((e) => e.name.endsWith("_72h"))).toBe(false);
});

test("callback enfileirado usa a hora da impressão mesmo quando o storage termina depois do prazo", async () => {
    const ads = await load();
    let release!: () => void;
    readGate = new Promise<void>((resolve) => { release = resolve; });
    const ready = ads.initAdRevenue();
    now += 23 * HOUR;
    expect(ads.logAdRevenue("banner", "home", {value: 0.0001, currency: "USD"})).toBeUndefined();
    now += 2 * HOUR;
    release(); await ready; await flush();
    expect(milestones()).toHaveLength(3);
});

test("usuário legado não ganha primeiro uso novo; chamadas sem prepare não iniciam Taichi", async () => {
    const standalone = await load();
    standalone.logAdRevenue("banner", "home", {value: 0.25, currency: "USD"});
    await flush();
    expect(storage.has(KEY)).toBe(false);
    storage.set("@first_open_logged", "true");
    const ads = await load();
    await ads.initAdRevenue();
    ads.logAdRevenue("banner", "home", {value: 0.25, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(0);
    expect(JSON.parse(storage.get(KEY)!).firstOpen).toBe(0);
});

test("valor/moeda desconhecidos, negativos, infinitos e relógio anterior ao primeiro uso não qualificam", async () => {
    const ads = await load();
    await ads.initAdRevenue();
    for (const event of [undefined, {}, {value: 1}, {value: NaN, currency: "USD"},
        {value: Infinity, currency: "USD"}, {value: -1, currency: "USD"}, {value: 0, currency: "USD"}, {value: 1, currency: "BRL"}]) {
        expect(() => ads.logAdRevenue("banner", "home", event)).not.toThrow();
    }
    now -= 1;
    ads.logAdRevenue("banner", "home", {value: 1, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(0);
    expect(JSON.parse(storage.get(KEY)!).usd).toBe(0);
    expect(events[0].params).not.toHaveProperty("value");
    expect(events[0].params).not.toHaveProperty("currency");
});

test("dedup fullscreen e responseId; refreshes de banner com mesmo preço continuam contando", async () => {
    const ads = await load();
    await ads.initAdRevenue();
    const fullscreen = {};
    for (let i = 0; i < 2; i++) ads.logAdRevenue("rewarded", "export", {value: 0.0001, currency: "USD"}, fullscreen);
    for (const id of ["request-1", "request-1", "request-2"]) {
        ads.logAdRevenue("banner", "home", {value: 0.0001, currency: "USD", responseInfo: {responseId: id}});
    }
    const payload = {value: 0.0001, currency: "USD"};
    ads.logAdRevenue("banner", "home", payload);
    ads.logAdRevenue("banner", "home", payload);
    ads.logAdRevenue("banner", "home", {...payload});
    await flush();
    expect(events.filter((e) => e.name === "ad_revenue")).toHaveLength(5);
    expect(JSON.parse(storage.get(KEY)!).usd).toBeCloseTo(0.0005, 12);
});

test("Remote Config seleciona nomes; [] desliga emissões sem perder o acumulado", async () => {
    const ads = await load();
    await ads.initAdRevenue();
    (globalThis as any).remoteConfigUtils = {taichi_events: []};
    ads.logAdRevenue("banner", "home", {value: 0.0001, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(0);
    (globalThis as any).remoteConfigUtils.taichi_events = ["taichi_rev_0_0002usd_24h", "nome_inexistente"];
    ads.logAdRevenue("banner", "home", {value: 0.0001, currency: "USD"});
    await flush();
    expect(milestones().map((e) => e.name)).toEqual(["taichi_rev_0_0002usd_24h"]);
});

test.each(["{broken", "null", '{"firstOpen":1,"usd":-1,"sent":[]}'])("estado inválido é preservado e não reinicia a contagem: %s", async (saved) => {
    storage.set(KEY, saved);
    const ads = await load();
    await ads.initAdRevenue();
    ads.logAdRevenue("banner", "home", {value: 0.25, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(0);
    expect(storage.get(KEY)).toBe(saved);
});

test("falha de gravação não emite antes de persistir nem mata a fila; receita pendente se recupera", async () => {
    const ads = await load();
    await ads.initAdRevenue();
    failWrite = true;
    ads.logAdRevenue("banner", "home", {value: 0.0001, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(0);
    failWrite = false;
    ads.logAdRevenue("banner", "home", {value: 0.0001, currency: "USD"});
    await flush();
    expect(milestones()).toHaveLength(6);
    expect(JSON.parse(storage.get(KEY)!).usd).toBe(0.0002);
});

test("falha de leitura mantém a API sem rejeição e não inventa histórico", async () => {
    failRead = true;
    const ads = await load();
    await expect(ads.initAdRevenue()).resolves.toBeUndefined();
    expect(() => ads.logAdRevenue("banner", "home", {value: 0.25, currency: "USD"})).not.toThrow();
    await flush();
    expect(milestones()).toHaveLength(0);
    expect(storage.has(KEY)).toBe(false);
});
