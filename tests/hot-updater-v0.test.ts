import {afterEach, expect, mock, test} from "bun:test";

// Hot Updater v0 (0.35/0.36): métodos ESTÁTICOS — `init` não devolve nada e o `checkForUpdate` existe.
// O módulo guarda estado de sessão (init feito, id em execução): os testes rodam em ordem, de propósito.
const calls: any[][] = [];
const warns: any[][] = [];
let bundleId = "builtin-0001";
let checkResult: any = null;
let checkError: Error | null = null;

const HotUpdaterV0 = {
    init: (options: any) => {
        calls.push(["init", options]);
    },
    checkForUpdate: async (options: any) => {
        calls.push(["checkForUpdate", options]);
        if (checkError) throw checkError;
        return checkResult;
    },
    getBundleId: () => bundleId,
    reload: async () => {
        calls.push(["reload"]);
    },
};
mock.module("@hot-updater/react-native", () => ({HotUpdater: HotUpdaterV0}));
mock.module("../utils/Utils", () => ({
    expoUtilsWarn: (...args: any[]) => warns.push(args),
    expoUtilsLog: () => {},
}));

const hu = await import("../utils/hot-updater");
const V0_URL = "https://app-hotupdater.workers.dev/api/check-update";

const update = (fields: Record<string, any>) => ({
    id: "bundle-0002",
    status: "UPDATE",
    shouldForceUpdate: false,
    updateBundle: async () => {
        calls.push(["updateBundle"]);
        bundleId = "bundle-0002";
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

test("detecção: checkForUpdate estático = v0; getHotUpdater é o próprio HotUpdater", () => {
    expect(hu.hotUpdaterGeneration()).toBe(0);
    expect(hu.getHotUpdater()).toBe(HotUpdaterV0);
    expect(hu.getRunningBundleId()).toBeNull();
});

test("sem alvo, ou em __DEV__, não chama nada", async () => {
    await hu.initHotUpdater(undefined);
    await hu.initHotUpdater("");
    (globalThis as any).__DEV__ = true;
    await hu.initHotUpdater(V0_URL);
    expect(calls).toEqual([]);
    expect(warns).toEqual([]);
});

test("URL: init({baseURL}) sem header, check appVersion, baixa e reinicia no shouldForceUpdate; id em execução lido antes", async () => {
    checkResult = update({shouldForceUpdate: true});
    await hu.initHotUpdater(V0_URL, {apiKey: "ignorada-no-v0"});
    expect(calls).toEqual([["init", {baseURL: V0_URL}], ["checkForUpdate", {updateStrategy: "appVersion"}], ["updateBundle"], ["reload"]]);
    expect(hu.getRunningBundleId()).toBe("builtin-0001");
    expect(warns).toEqual([]);
});

test("2ª chamada (maybeApplyUpdate) não repete o init; sem update não baixa nem reinicia", async () => {
    await hu.initHotUpdater(V0_URL);
    expect(calls).toEqual([["checkForUpdate", {updateStrategy: "appVersion"}]]);
    expect(hu.getRunningBundleId()).toBe("builtin-0001");
});

test("sem shouldForceUpdate só baixa; download que falhou não reinicia", async () => {
    checkResult = update({shouldForceUpdate: false});
    await hu.initHotUpdater(V0_URL);
    expect(calls.map((c) => c[0])).toEqual(["checkForUpdate", "updateBundle"]);

    calls.length = 0;
    checkResult = update({shouldForceUpdate: true, updateBundle: async () => false});
    await hu.initHotUpdater(V0_URL);
    expect(calls.map((c) => c[0])).toEqual(["checkForUpdate"]);
});

test("instância no v0 vira aviso e não chama nada", async () => {
    await hu.initHotUpdater({checkForUpdate: () => null});
    expect(calls).toEqual([]);
    expect(String(warns[0]?.[0])).toContain("v0");
});

test("erro no check vira aviso, nunca lança", async () => {
    checkError = new Error("rede fora");
    await hu.initHotUpdater(V0_URL);
    expect(warns).toHaveLength(1);
    expect(warns[0][0]).toBe("initHotUpdater:");
    expect(String(warns[0][1])).toContain("rede fora");
});
