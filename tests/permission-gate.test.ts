// Portão de permissões (utils/permission-gate.ts): pede só com o app ativo (evento do AppState, nunca timer), relê o
// status antes de cada pedido, pede de novo no próximo "ficou ativo" quando o pedido se perde (até 3 por abertura),
// todo pedido tem limite de tempo e chamadas concorrentes recebem o mesmo fluxo.
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "bun:test";
import {createPermissionGate, TIMED_OUT, waitForActive, withTimeout, type AppStateLike} from "../utils/permission-gate";

const LIMIT = 20000;

const flush = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
};
const advance = async (ms: number) => {
    await flush(); // o pedido (e o timer do limite) sai depois de alguns awaits
    jest.advanceTimersByTime(ms);
    await flush();
};

// AppState falso: muda o estado e avisa os ouvintes, como o RN.
const listeners = new Set<(state: string) => void>();
const appState: AppStateLike & {currentState: string} = {
    currentState: "active",
    addEventListener: (_type, listener) => {
        listeners.add(listener);
        return {remove: () => listeners.delete(listener)};
    },
};
const setAppState = async (state: string) => {
    appState.currentState = state;
    for (const listener of [...listeners]) listener(state);
    await flush();
};
// Volta ao app: sai de active e volta (alerta do sistema respondido, ou 2º plano e volta).
const leaveAndReturn = async (via = "inactive") => {
    await setAppState(via);
    await setAppState("active");
};

const never = <T>() => new Promise<T>(() => {});

// Permissão falsa. `answers`: o que cada pedido devolve, em ordem — um status (que passa a ser o status lido quando
// é uma resposta), "hang" (nunca resolve) ou uma função. Sem resposta na fila, o pedido é descartado.
const fakePermission = (initial: string, answers: Array<string | (() => Promise<string>)>, unanswered = "undetermined") => {
    const permission = {
        status: initial,
        reads: 0,
        requests: 0,
        read: async () => {
            permission.reads++;
            return permission.status;
        },
        request: (): Promise<string> => {
            permission.requests++;
            const answer = answers.shift() ?? unanswered;
            if (typeof answer === "function") return answer();
            if (answer === "hang") return never<string>();
            if (answer !== unanswered) permission.status = answer;
            return Promise.resolve(answer);
        },
    };
    return permission;
};

const attGate = (permission: ReturnType<typeof fakePermission>) =>
    createPermissionGate<string>({
        appState,
        read: permission.read,
        request: permission.request,
        canAsk: (status) => status === "undetermined",
        requestLimitMs: LIMIT,
    });

// Como a lib configura a notificação no Android 13+: negado sem o app sair de active = diálogo não apareceu.
const androidPushGate = (permission: ReturnType<typeof fakePermission>) =>
    createPermissionGate<string>({
        appState,
        read: permission.read,
        request: permission.request,
        canAsk: (status) => status !== "granted",
        lost: (status, leftActive) => !leftActive && (status === "denied" || status === "never_ask_again"),
        requestLimitMs: LIMIT,
    });

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
    jest.clearAllTimers();
    listeners.clear();
    appState.currentState = "active";
});

describe("esperar o app ativo", () => {
    test("já ativo: resolve na hora, sem assinar o AppState", async () => {
        let done = false;
        waitForActive(appState).then(() => (done = true));
        await flush();
        expect(done).toBe(true);
        expect(listeners.size).toBe(0);
    });

    test("inativo → ativo: resolve no evento de active (background e inactive não contam) e solta o ouvinte", async () => {
        appState.currentState = "inactive";
        let done = false;
        waitForActive(appState).then(() => (done = true));
        await setAppState("background");
        await advance(60 * 60_000);
        expect(done).toBe(false);
        await setAppState("active");
        expect(done).toBe(true);
        expect(listeners.size).toBe(0);
    });

    test("nunca fica ativo: não resolve sozinho; quem espera corre contra o limite e segue", async () => {
        appState.currentState = "inactive";
        const waited = withTimeout(waitForActive(appState), LIMIT);
        let result: unknown;
        waited.then((value) => (result = value));
        await advance(LIMIT - 1);
        expect(result).toBeUndefined();
        await advance(1);
        expect(result).toBe(TIMED_OUT);
    });
});

describe("ATT", () => {
    test("concedido na 1ª: um pedido só e o fluxo termina", async () => {
        const att = fakePermission("undetermined", ["granted"]);
        const gate = attGate(att);
        const flow = gate.run();
        expect(await flow.final).toEqual({status: "granted", attempts: 1});
        expect(await flow.first).toEqual({status: "granted", attempts: 1});
        expect(att.requests).toBe(1);
        expect(gate.isPending()).toBe(false);
    });

    test("já respondido: não pede", async () => {
        const att = fakePermission("denied", []);
        expect(await attGate(att).run().final).toEqual({status: "denied", attempts: 0});
        expect(att.requests).toBe(0);
    });

    test("descartado na 1ª e concedido na 2ª, no próximo active — nunca por timer", async () => {
        const att = fakePermission("undetermined", ["undetermined", "granted"]);
        const gate = attGate(att);
        const flow = gate.run();
        expect(await flow.first).toEqual({status: "undetermined", attempts: 1});
        let final: unknown;
        flow.final.then((value) => (final = value));
        await advance(60 * 60_000);
        expect(att.requests).toBe(1);
        expect(gate.isPending()).toBe(true);
        await leaveAndReturn();
        expect(att.requests).toBe(2);
        expect(final).toEqual({status: "granted", attempts: 2});
        expect(gate.isPending()).toBe(false);
    });

    test("sempre descartado: para em 3 e não pede mais nesta abertura", async () => {
        const att = fakePermission("undetermined", []);
        const gate = attGate(att);
        const flow = gate.run();
        let final: unknown;
        flow.final.then((value) => (final = value));
        await flush();
        await leaveAndReturn("background");
        await leaveAndReturn("background");
        expect(att.requests).toBe(3);
        expect(final).toEqual({status: "undetermined", attempts: 3});
        await leaveAndReturn("background");
        expect(gate.run()).toBe(flow);
        await flush();
        expect(att.requests).toBe(3);
    });

    test("negado na 1ª: não repete", async () => {
        const att = fakePermission("undetermined", ["denied"]);
        const flow = attGate(att).run();
        expect(await flow.final).toEqual({status: "denied", attempts: 1});
        await leaveAndReturn("background");
        expect(att.requests).toBe(1);
    });

    test("chamadas concorrentes: o mesmo fluxo e um pedido só", async () => {
        let answer: (status: string) => void = () => {};
        const att = fakePermission("undetermined", [() => new Promise((resolve) => (answer = resolve))]);
        const gate = attGate(att);
        const [a, b] = [gate.run(), gate.run()];
        await flush();
        expect(a).toBe(b);
        expect(att.requests).toBe(1);
        att.status = "granted";
        answer("granted");
        expect(await b.final).toEqual({status: "granted", attempts: 1});
        expect(att.requests).toBe(1);
    });

    test("app inativo (alerta de outro pedido na frente): espera o active para pedir", async () => {
        appState.currentState = "inactive";
        const att = fakePermission("undetermined", ["granted"]);
        const gate = attGate(att);
        gate.run();
        await advance(60_000);
        expect(att.requests).toBe(0);
        expect(gate.isPending()).toBe(true);
        await setAppState("active");
        expect(att.requests).toBe(1);
    });

    test("relê o status logo antes de pedir: respondido enquanto esperava o active, não pede", async () => {
        appState.currentState = "inactive";
        const att = fakePermission("undetermined", []);
        const flow = attGate(att).run();
        await flush();
        att.status = "granted"; // o pedido próprio da home foi respondido
        await setAppState("active");
        expect(await flow.final).toEqual({status: "granted", attempts: 0});
        expect(att.requests).toBe(0);
    });

    test("alerta na tela além do limite: relê, não pede de novo e acaba quando a pessoa responde", async () => {
        let answer: (status: string) => void = () => {};
        const att = fakePermission("undetermined", [() => new Promise((resolve) => (answer = resolve))]);
        const flow = attGate(att).run();
        await advance(LIMIT);
        expect(await flow.first).toEqual({status: "undetermined", attempts: 1});
        att.status = "granted";
        answer("granted");
        expect(await flow.final).toEqual({status: "granted", attempts: 1});
        expect(att.requests).toBe(1);
    });
});

describe("notificação no Android", () => {
    test("cancelada pelo sistema (negada sem o diálogo aparecer): pede de novo no próximo active", async () => {
        const push = fakePermission("denied", ["never_ask_again", "granted"], "-");
        const gate = androidPushGate(push);
        const flow = gate.run();
        expect(await flow.first).toEqual({status: "never_ask_again", attempts: 1});
        await leaveAndReturn("background"); // o diálogo da home pausou a Activity e foi respondido
        expect(await flow.final).toEqual({status: "granted", attempts: 2});
    });

    test("negada no diálogo (a Activity pausou durante o pedido): é resposta, não repete", async () => {
        const push = fakePermission("denied", [
            async () => {
                await setAppState("background");
                await setAppState("active");
                return "denied";
            },
        ], "-");
        const flow = androidPushGate(push).run();
        expect(await flow.final).toEqual({status: "denied", attempts: 1});
        await leaveAndReturn("background");
        expect(push.requests).toBe(1);
    });

    test("pendurada: no limite a lib segue; sem o diálogo ter aparecido, pede de novo no próximo active", async () => {
        const push = fakePermission("denied", ["hang", "granted"], "-");
        const gate = androidPushGate(push);
        const flow = gate.run();
        let first: unknown;
        flow.first.then((value) => (first = value));
        await advance(LIMIT - 1);
        expect(first).toBeUndefined();
        await advance(1);
        expect(first).toEqual({status: "denied", attempts: 1});
        expect(push.requests).toBe(1);
        await leaveAndReturn("background");
        expect(await flow.final).toEqual({status: "granted", attempts: 2});
    });

    test("pendurada depois do diálogo (listener do RN trocado por outro pedido): no limite relê e encerra", async () => {
        const push = fakePermission("denied", [
            async () => {
                await setAppState("background");
                await setAppState("active");
                return never<string>();
            },
        ], "-");
        const flow = androidPushGate(push).run();
        await advance(LIMIT);
        expect(await flow.final).toEqual({status: "denied", attempts: 1});
        await leaveAndReturn("background");
        expect(push.requests).toBe(1);
    });
});
