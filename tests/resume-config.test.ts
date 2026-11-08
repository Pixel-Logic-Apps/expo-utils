// Remote Config na volta ao app (utils/resume-config.ts): com `on_leave`, busca ao sair; aplica só com a pessoa fora;
// se ela voltou antes, guarda e aplica na próxima saída; `off` não busca; uma busca por vez e um intervalo mínimo.
import {describe, expect, test} from "bun:test";
import {createResumeConfig, type ConfigSnapshot} from "../utils/resume-config";

const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};

const setup = (initial: ConfigSnapshot, modeValue = "on_leave") => {
    let clock = 0;
    let answer: (snapshot: ConfigSnapshot | null) => void = () => {};
    const log = {fetches: 0, applied: [] as ConfigSnapshot[]};
    let inUse = initial;
    const mode = {value: modeValue as unknown};
    const onState = createResumeConfig({
        mode: () => mode.value,
        refresh: () => {
            log.fetches++;
            return new Promise((resolve) => (answer = resolve));
        },
        current: () => inUse,
        apply: (snapshot) => {
            inUse = snapshot;
            log.applied.push(snapshot);
        },
        now: () => clock,
        minIntervalMs: 30_000,
    });
    return {
        log,
        mode,
        onState,
        answer: async (snapshot: ConfigSnapshot | null) => {
            answer(snapshot);
            await flush();
        },
        tick: (ms: number) => (clock += ms),
        inUse: () => inUse,
    };
};

const v1: ConfigSnapshot = {utils: {is_ads_enabled: true, resume_config: "on_leave"}, screens: {botao: true}};
const v2: ConfigSnapshot = {utils: {is_ads_enabled: false, resume_config: "on_leave"}, screens: {botao: false}};

describe("resume_config", () => {
    test("off (padrão): não busca", async () => {
        const s = setup(v1, "off");
        s.onState("background");
        s.mode.value = undefined;
        s.onState("background");
        expect(s.log.fetches).toBe(0);
    });

    test("on_leave: busca ao sair; mudou e a pessoa segue fora → aplica escondido", async () => {
        const s = setup(v1);
        s.onState("inactive"); // alerta do sistema no iOS: não é saída
        expect(s.log.fetches).toBe(0);
        s.onState("background");
        expect(s.log.fetches).toBe(1);
        await s.answer(v2);
        expect(s.log.applied).toEqual([v2]);
    });

    test("igual à config em uso: não redesenha", async () => {
        const s = setup(v1);
        s.onState("background");
        await s.answer({utils: {...v1.utils}, screens: {...v1.screens}});
        expect(s.log.applied).toEqual([]);
    });

    test("a pessoa voltou antes de a busca terminar: nada muda na frente dela; vale na próxima saída", async () => {
        const s = setup(v1);
        s.onState("background");
        s.onState("active");
        await s.answer(v2);
        expect(s.log.applied).toEqual([]);
        expect(s.inUse()).toBe(v1);
        s.onState("background");
        expect(s.log.applied).toEqual([v2]); // aplicada na saída, antes de qualquer busca nova
        expect(s.log.fetches).toBe(1); // saiu há menos de 30 s: sem busca nova
    });

    test("busca que falha: a config fica como está", async () => {
        const s = setup(v1);
        s.onState("background");
        await s.answer(null);
        expect(s.log.applied).toEqual([]);
    });

    test("uma busca por vez e no máximo uma a cada 30 s", async () => {
        const s = setup(v1);
        s.onState("background");
        s.onState("active");
        s.onState("background"); // a 1ª ainda não voltou
        expect(s.log.fetches).toBe(1);
        await s.answer(null);
        s.onState("active");
        s.tick(29_000);
        s.onState("background");
        expect(s.log.fetches).toBe(1);
        s.onState("active");
        s.tick(1_000);
        s.onState("background");
        expect(s.log.fetches).toBe(2);
    });

    test("a config nova desliga o modo: a próxima saída não busca", async () => {
        const s = setup(v1);
        s.onState("background");
        const off: ConfigSnapshot = {utils: {...v2.utils, resume_config: "off"}, screens: v2.screens};
        await s.answer(off);
        s.mode.value = "off";
        s.onState("active");
        s.tick(60_000);
        s.onState("background");
        expect(s.log.fetches).toBe(1);
    });
});
