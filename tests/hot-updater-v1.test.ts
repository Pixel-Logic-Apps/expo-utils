import {afterEach, expect, mock, test} from "bun:test";

// Hot Updater v1 (1.1.3+): o `HotUpdater` só tem `init`, que DEVOLVE a instância; checkForUpdate, getBundleId e
// reload ficam nela. getBundleId() devolve o pacote SELECIONADO, que muda quando o download termina.
// O módulo guarda estado de sessão (a instância, o id em execução): os testes rodam em ordem, de propósito.
const calls: any[][] = [];
const warns: any[][] = [];
const created: any[] = [];
let checkResult: any = null;
let checkError: Error | null = null;

function makeInstance(label: string, options?: any) {
    let selected = `${label}-running`;
    return {
        label,
        options,
        checkForUpdate: async (opts: any) => {
            calls.push([label, "checkForUpdate", opts]);
            if (checkError) throw checkError;
            return checkResult;
        },
        getBundleId: () => selected,
        reload: async () => {
            calls.push([label, "reload"]);
        },
        select: (id: string) => {
            selected = id;
        },
    };
}

mock.module("@hot-updater/react-native", () => ({
    HotUpdater: {
        init: (options: any) => {
            calls.push(["init", options]);
            const instance = makeInstance("lib", options);
            created.push(instance);
            return instance;
        },
    },
}));
mock.module("../utils/Utils", () => ({
    expoUtilsWarn: (...args: any[]) => warns.push(args),
    expoUtilsLog: () => {},
}));

const hu = await import("../utils/hot-updater");
const V1_URL = "https://app-hotupdater-v1.workers.dev";
const KEY = "hu_live_0123456789";

const update = (instance: () => any, fields: Record<string, any>) => ({
    id: "rel-0002",
    status: "UPDATE",
    message: null,
    releaseId: "rel-0002",
    transitionKind: "INSTALL",
    shouldForceUpdate: false,
    updateBundle: async () => {
        calls.push(["updateBundle"]);
        instance().select("rel-0002");
        return true;
    },
    ...fields,
});

afterEach(() => {
    calls.length = 0;
    warns.length = 0;
    checkResult = null;
    checkError = null;
    delete (globalThis as any).__DEV__;
});

test("detecção: sem checkForUpdate estático = v1; antes do init não há instância nem id", () => {
    expect(hu.hotUpdaterGeneration()).toBe(1);
    expect(hu.getHotUpdater()).toBeNull();
    expect(hu.getRunningBundleId()).toBeNull();
});

test("guardas: URL de servidor v0 ou chave ausente/de exemplo viram aviso e o OTA não roda", async () => {
    await hu.initHotUpdater(`${V1_URL}/api/check-update`, {apiKey: KEY});
    await hu.initHotUpdater(V1_URL);
    await hu.initHotUpdater(V1_URL, {apiKey: "   "});
    await hu.initHotUpdater(V1_URL, {apiKey: "YOUR_HOT_UPDATER_API_KEY"});
    expect(calls).toEqual([]);
    expect(warns).toHaveLength(4);
    expect(String(warns[0][0])).toContain("/api/check-update");
    for (const warn of warns.slice(1)) expect(String(warn[0])).toContain("chave de cliente");
    for (const warn of warns) expect(String(warn[0])).toContain("OTA desligado");
    expect(hu.getHotUpdater()).toBeNull();
});

test("URL + chave: init com baseURL, x-api-key e onError; check appVersion; baixa, reinicia no shouldForceUpdate", async () => {
    checkResult = update(() => created[0], {shouldForceUpdate: true});
    await hu.initHotUpdater(V1_URL, {apiKey: ` ${KEY} `});
    expect(calls[0]).toEqual(["init", {baseURL: V1_URL, requestHeaders: {"x-api-key": KEY}, onError: expect.any(Function)}]);
    expect(calls.slice(1)).toEqual([["lib", "checkForUpdate", {updateStrategy: "appVersion"}], ["updateBundle"], ["lib", "reload"]]);
    expect(hu.getHotUpdater()).toBe(created[0]);
    // getBundleId() do v1 já aponta para o baixado; o id em execução foi guardado no init
    expect(hu.getHotUpdater().getBundleId()).toBe("rel-0002");
    expect(hu.getRunningBundleId()).toBe("lib-running");
    // onError do init vai para o expoUtilsWarn
    calls[0][1].onError(new Error("catálogo 401"));
    expect(warns).toEqual([["initHotUpdater:", new Error("catálogo 401")]]);
});

test("2ª chamada (maybeApplyUpdate) reaproveita a instância: não cria outra", async () => {
    await hu.initHotUpdater(V1_URL, {apiKey: KEY});
    expect(calls).toEqual([["lib", "checkForUpdate", {updateStrategy: "appVersion"}]]);
    expect(created).toHaveLength(1);
    expect(hu.getRunningBundleId()).toBe("lib-running");
});

test("USE_BUILTIN sem shouldForceUpdate: chama o updateBundle e não reinicia", async () => {
    checkResult = update(() => created[0], {status: "ROLLBACK", transitionKind: "USE_BUILTIN", shouldForceUpdate: false});
    await hu.initHotUpdater(V1_URL, {apiKey: KEY});
    expect(calls.map((c) => c[c.length === 1 ? 0 : 1])).toEqual(["checkForUpdate", "updateBundle"]);
});

test("instância criada pelo app: a lib usa a dele, sem init, e guarda o id em execução dela", async () => {
    const appInstance = makeInstance("app");
    checkResult = update(() => appInstance, {shouldForceUpdate: false});
    await hu.initHotUpdater(appInstance, {apiKey: "ignorada"});
    expect(calls).toEqual([["app", "checkForUpdate", {updateStrategy: "appVersion"}], ["updateBundle"]]);
    expect(hu.getHotUpdater()).toBe(appInstance);
    expect(hu.getRunningBundleId()).toBe("app-running");
    expect(created).toHaveLength(1);

    // depois disso, a URL também usa a instância do app
    calls.length = 0;
    checkResult = null;
    await hu.initHotUpdater(V1_URL, {apiKey: KEY});
    expect(calls).toEqual([["app", "checkForUpdate", {updateStrategy: "appVersion"}]]);
});

test("erro no check vira aviso, nunca lança; __DEV__ não chama nada", async () => {
    checkError = new Error("timeout");
    await hu.initHotUpdater(V1_URL, {apiKey: KEY});
    expect(warns).toHaveLength(1);
    expect(String(warns[0][1])).toContain("timeout");

    calls.length = 0;
    (globalThis as any).__DEV__ = true;
    await hu.initHotUpdater(V1_URL, {apiKey: KEY});
    expect(calls).toEqual([]);
});
