// Portão de permissões (utils/permission-gate.ts): pede só com o app ativo (evento do AppState, nunca timer), relê o
// status antes de cada pedido, pede de novo no próximo "ficou ativo" quando o pedido se perde (até 3 por abertura),
// todo pedido tem limite de tempo e chamadas concorrentes recebem o mesmo fluxo. E a trava única: um pedido por vez, na
// ordem de chegada, com o limite correndo só com o app ativo.
import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "bun:test";
import {createPermissionGate, createPermissionLock, TIMED_OUT, waitForActive, withTimeout, type AppStateLike} from "../utils/permission-gate";

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
        lock: createPermissionLock(appState, LIMIT),
    });

// Como a lib configura a notificação no Android 13+: negado sem o app sair de active = diálogo não apareceu.
const androidPushGate = (permission: ReturnType<typeof fakePermission>) =>
    createPermissionGate<string>({
        appState,
        read: permission.read,
        request: permission.request,
        canAsk: (status) => status !== "granted",
        lost: (status, leftActive) => !leftActive && (status === "denied" || status === "never_ask_again"),
        lock: createPermissionLock(appState, LIMIT),
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

    test("o app sai de active durante a releitura (ida ao nativo antes do pedido): não pede inativo; pede no próximo active", async () => {
        const att = fakePermission("undetermined", ["granted"]);
        let reads = 0;
        const flow = createPermissionGate<string>({
            appState,
            read: async () => {
                if (++reads === 2) appState.currentState = "inactive"; // a releitura logo antes do pedido
                return att.read();
            },
            request: att.request,
            canAsk: (status) => status === "undetermined",
            lock: createPermissionLock(appState, LIMIT),
        }).run();
        await advance(60_000);
        expect(att.requests).toBe(0);
        await setAppState("active");
        expect(await flow.final).toEqual({status: "granted", attempts: 1});
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
        for (let i = 0; i < 4; i++) await flush(); // o pedido sai, o diálogo pausa a Activity e ela volta
        await advance(LIMIT); // o limite conta a partir da volta a active
        expect(await flow.final).toEqual({status: "denied", attempts: 1});
        await leaveAndReturn("background");
        expect(push.requests).toBe(1);
    });
});

describe("ordem entre portões (after)", () => {
    test("só pede depois que a vez do outro termina, sem limite; relê e confere o AppState depois", async () => {
        let attEnded: () => void = () => {};
        const attEnd = new Promise<void>((resolve) => (attEnded = resolve));
        const push = fakePermission("undetermined", ["granted"]);
        const flow = createPermissionGate<string>({
            appState,
            read: push.read,
            request: push.request,
            canAsk: (status) => status === "undetermined",
            lock: createPermissionLock(appState, LIMIT),
            after: () => attEnd,
        }).run();
        let first: unknown;
        flow.first.then((value) => (first = value));
        await advance(10 * LIMIT); // o ATT segue na tela: a notificação não sai por cima nem no limite
        expect(push.requests).toBe(0);
        expect(first).toBeUndefined();
        appState.currentState = "inactive"; // o ATT foi respondido; o app ainda não voltou a active
        attEnded();
        await flush();
        expect(push.requests).toBe(0);
        await setAppState("active");
        expect(await flow.final).toEqual({status: "granted", attempts: 1});
    });

    test("já respondido: não espera a vez do outro", async () => {
        const push = fakePermission("granted", []);
        const flow = createPermissionGate<string>({
            appState,
            read: push.read,
            request: push.request,
            canAsk: (status) => status === "undetermined",
            lock: createPermissionLock(appState, LIMIT),
            after: () => never<void>(),
        }).run();
        expect(await flow.final).toEqual({status: "granted", attempts: 0});
    });
});

// Pedido controlado pelo teste: `open` conta os que estão de pé ao mesmo tempo, e `answer` responde.
const prompts = () => {
    const log = {started: [] as string[], open: 0, maxOpen: 0};
    const answers = new Map<string, (value: string) => void>();
    const fails = new Map<string, (error: Error) => void>();
    const prompt = (name: string) => () => {
        log.started.push(name);
        log.maxOpen = Math.max(log.maxOpen, ++log.open);
        return new Promise<string>((resolve, reject) => {
            answers.set(name, (value) => {
                log.open--;
                resolve(value);
            });
            fails.set(name, (error) => {
                log.open--;
                reject(error);
            });
        });
    };
    return {log, prompt, answer: (name: string, value = "ok") => answers.get(name)?.(value), fail: (name: string, error: Error) => fails.get(name)?.(error)};
};
const track = <T>(promise: Promise<T>) => {
    const seen: {value?: T; error?: unknown; settled: boolean} = {settled: false};
    promise.then(
        (value) => Object.assign(seen, {value, settled: true}),
        (error) => Object.assign(seen, {error, settled: true}),
    );
    return seen;
};

describe("trava de permissão", () => {
    const lockUnderTest = () => createPermissionLock(appState, LIMIT);

    test("dois pedidos concorrentes nunca rodam juntos", async () => {
        const lock = lockUnderTest();
        const {log, prompt, answer} = prompts();
        const a = track(lock(prompt("a")));
        const b = track(lock(prompt("b")));
        await flush();
        expect(log.started).toEqual(["a"]);
        await advance(LIMIT - 1);
        expect(log.started).toEqual(["a"]); // sem a resposta do 1º, o 2º não sai
        answer("a");
        await flush();
        expect(a.value).toBe("ok");
        expect(log.started).toEqual(["a", "b"]);
        answer("b");
        await flush();
        expect(b.value).toBe("ok");
        expect(log.maxOpen).toBe(1);
    });

    test("ordem de chegada, com pedido chegando no meio da fila", async () => {
        const lock = lockUnderTest();
        const {log, prompt, answer} = prompts();
        lock(prompt("a"));
        lock(prompt("b"));
        await flush();
        lock(prompt("c"));
        answer("a");
        await flush();
        answer("b");
        await flush();
        answer("c");
        await flush();
        expect(log.started).toEqual(["a", "b", "c"]);
        expect(log.maxOpen).toBe(1);
    });

    test("fn que rejeita: quem pediu recebe a rejeição e a trava solta", async () => {
        const lock = lockUnderTest();
        const {log, prompt, fail, answer} = prompts();
        const a = track(lock(prompt("a")));
        const b = track(lock(prompt("b")));
        await flush();
        fail("a", new Error("nativo falhou"));
        await flush();
        expect((a.error as Error).message).toBe("nativo falhou");
        expect(log.started).toEqual(["a", "b"]);
        answer("b");
        await flush();
        expect(b.value).toBe("ok");
    });

    test("fn que lança na hora: a trava solta", async () => {
        const lock = lockUnderTest();
        const a = track(
            lock(() => {
                throw new Error("sem módulo");
            }),
        );
        const b = track(lock(async () => "segue"));
        await flush();
        expect((a.error as Error).message).toBe("sem módulo");
        expect(b.value).toBe("segue");
    });

    test("fn que pendura: no limite quem pediu segue, a trava solta e a resposta tardia não atrapalha", async () => {
        const lock = lockUnderTest();
        const {log, prompt, answer} = prompts();
        const hung = track(lock(prompt("hung")));
        const next = track(lock(prompt("next")));
        await advance(LIMIT - 1);
        expect(hung.settled).toBe(false);
        expect(log.started).toEqual(["hung"]);
        await advance(1);
        expect(hung.value).toBe(TIMED_OUT);
        expect(log.started).toEqual(["hung", "next"]);
        answer("hung", "tarde");
        await flush();
        expect(hung.value).toBe(TIMED_OUT);
        expect(next.settled).toBe(false);
        answer("next");
        await flush();
        expect(next.value).toBe("ok");
    });

    test("app inativo: espera o active, sem limite e sem timer; na fila, a ordem continua a de chegada", async () => {
        appState.currentState = "inactive";
        const lock = lockUnderTest();
        const {log, prompt, answer} = prompts();
        const a = track(lock(prompt("a")));
        lock(prompt("b"));
        await advance(60 * 60_000);
        expect(log.started).toEqual([]);
        expect(a.settled).toBe(false);
        await setAppState("background");
        expect(log.started).toEqual([]);
        await setAppState("active");
        expect(log.started).toEqual(["a"]);
        answer("a");
        await flush();
        expect(log.started).toEqual(["a", "b"]);
    });

    test("nenhum ouvinte do AppState fica para trás", async () => {
        const lock = lockUnderTest();
        const {prompt, answer} = prompts();
        const a = lock(prompt("a"));
        await flush();
        expect(listeners.size).toBe(1);
        answer("a");
        await a;
        expect(listeners.size).toBe(0);
        const hung = lock(prompt("b"));
        await advance(LIMIT);
        await hung;
        expect(listeners.size).toBe(0);
    });
});

describe("trava: limite estourado com diálogo real na tela", () => {
    const lockUnderTest = () => createPermissionLock(appState, LIMIT);

    test("Android: pessoa demora além do limite → nada sai por cima; a resposta vale, mesmo chegando depois do active", async () => {
        const lock = lockUnderTest();
        const {log, prompt, answer} = prompts();
        const location = track(lock(prompt("location")));
        const push = track(lock(prompt("push")));
        await flush();
        await setAppState("background"); // o diálogo pausa a Activity
        // Tarefa headless mantém os timers do JS correndo com a Activity pausada: o limite não corre mesmo assim.
        await advance(10 * LIMIT);
        expect(location.settled).toBe(false);
        expect(log.started).toEqual(["location"]);
        // ReactActivityDelegate.onResume: primeiro o host volta (AppState active), depois entrega a resposta.
        await setAppState("active");
        expect(location.settled).toBe(false);
        expect(log.started).toEqual(["location"]);
        answer("location", "granted");
        await flush();
        expect(location.value).toBe("granted");
        expect(log.started).toEqual(["location", "push"]);
        expect(push.settled).toBe(false);
    });

    test("Android: pendurada depois do diálogo (a resposta nunca vem) → o limite recomeça no active e solta a trava", async () => {
        const lock = lockUnderTest();
        const {log, prompt} = prompts();
        const location = track(lock(prompt("location")));
        lock(prompt("push"));
        await advance(LIMIT - 1);
        await setAppState("background");
        await advance(10 * LIMIT);
        await setAppState("active");
        await advance(LIMIT - 1); // recomeçou do zero: não herda o tempo de antes
        expect(location.settled).toBe(false);
        expect(log.started).toEqual(["location"]);
        await advance(1);
        expect(location.value).toBe(TIMED_OUT);
        expect(log.started).toEqual(["location", "push"]);
    });

    test("iOS 26: alerta deixa o app inactive além do limite → nada sai por cima; o próximo espera o active depois da resposta", async () => {
        const lock = lockUnderTest();
        const {log, prompt, answer} = prompts();
        const location = track(lock(prompt("location")));
        lock(prompt("att"));
        await flush();
        await setAppState("inactive");
        await advance(10 * LIMIT);
        expect(location.settled).toBe(false);
        expect(log.started).toEqual(["location"]);
        answer("location", "granted"); // a resposta chega antes do didBecomeActive
        await flush();
        expect(location.value).toBe("granted");
        expect(log.started).toEqual(["location"]);
        await setAppState("active");
        expect(log.started).toEqual(["location", "att"]);
    });

    test("iOS 27: alerta não deixa o app inactive → não há como separar de pendurado; só no limite o próximo sai", async () => {
        const lock = lockUnderTest();
        const {log, prompt} = prompts();
        const location = track(lock(prompt("location")));
        lock(prompt("att"));
        await advance(LIMIT - 1);
        expect(log.started).toEqual(["location"]);
        await advance(1);
        expect(location.value).toBe(TIMED_OUT);
        expect(log.started).toEqual(["location", "att"]);
    });

    test("limite estoura e o app saiu de active logo depois: o próximo não pede inativo", async () => {
        const lock = lockUnderTest();
        const {log, prompt} = prompts();
        lock(prompt("hung"));
        lock(prompt("next"));
        await advance(LIMIT - 1);
        appState.currentState = "inactive"; // o evento ainda não chegou, e o timer dispara
        jest.advanceTimersByTime(1);
        await flush();
        expect(log.started).toEqual(["hung"]);
        await setAppState("active");
        expect(log.started).toEqual(["hung", "next"]);
    });
});

describe("portões na trava: ATT e localização em sequência", () => {
    const att = (permission: ReturnType<typeof fakePermission>, lock: ReturnType<typeof createPermissionLock>) =>
        createPermissionGate<string>({
            appState,
            read: permission.read,
            request: permission.request,
            canAsk: (status) => status === "undetermined",
            lock,
        });

    test("a home pede localização primeiro: o ATT espera a resposta dela, sem gastar tentativa, e sai no active", async () => {
        const lock = createPermissionLock(appState, LIMIT);
        const {log, prompt, answer} = prompts();
        const attPermission = fakePermission("undetermined", ["granted"]);
        const location = track(lock(prompt("location")));
        const gate = att(attPermission, lock);
        const flow = gate.run();
        await flush();
        await setAppState("inactive"); // alerta de localização no iOS 26
        await advance(10 * LIMIT);
        expect(attPermission.requests).toBe(0);
        expect(gate.attempts()).toBe(0);
        expect(gate.isPending()).toBe(true);
        answer("location", "granted");
        await flush();
        expect(location.value).toBe("granted");
        expect(attPermission.requests).toBe(0); // respondida, mas o app ainda não voltou a active
        await setAppState("active");
        expect(attPermission.requests).toBe(1);
        expect(await flow.final).toEqual({status: "granted", attempts: 1});
        expect(log.started).toEqual(["location"]);
    });

    test("o ATT pede primeiro: a localização espera a resposta dele", async () => {
        const lock = createPermissionLock(appState, LIMIT);
        const {log, prompt, answer} = prompts();
        let answerAtt: (status: string) => void = () => {};
        const attPermission = fakePermission("undetermined", [() => new Promise((resolve) => (answerAtt = resolve))]);
        const flow = att(attPermission, lock).run();
        await flush();
        expect(attPermission.requests).toBe(1);
        const location = track(lock(prompt("location")));
        await advance(LIMIT - 1);
        expect(log.started).toEqual([]);
        attPermission.status = "denied";
        answerAtt("denied");
        await flush();
        expect(await flow.final).toEqual({status: "denied", attempts: 1});
        expect(log.started).toEqual(["location"]);
        answer("location", "granted");
        await flush();
        expect(location.value).toBe("granted");
    });

    test("ATT descartado: a localização pedida depois dele sai, e a nova tentativa vem depois dela, no active", async () => {
        const lock = createPermissionLock(appState, LIMIT);
        const {log, prompt, answer} = prompts();
        const attPermission = fakePermission("undetermined", ["undetermined", "granted"]);
        const flow = att(attPermission, lock).run();
        await flush();
        expect(attPermission.requests).toBe(1); // o iOS descartou: volta `undetermined` na hora
        lock(prompt("location"));
        await flush();
        expect(log.started).toEqual(["location"]);
        await setAppState("inactive");
        answer("location", "granted");
        await flush();
        expect(attPermission.requests).toBe(1);
        await setAppState("active");
        expect(attPermission.requests).toBe(2);
        expect(await flow.final).toEqual({status: "granted", attempts: 2});
    });

    test("respondido enquanto esperava a vez: não pede", async () => {
        const lock = createPermissionLock(appState, LIMIT);
        const {prompt, answer} = prompts();
        const attPermission = fakePermission("undetermined", []);
        lock(prompt("location"));
        const flow = att(attPermission, lock).run();
        await flush();
        attPermission.status = "granted";
        answer("location");
        expect(await flow.final).toEqual({status: "granted", attempts: 0});
        expect(attPermission.requests).toBe(0);
    });

    test("alerta do ATT além do limite: a trava solta, mas o portão não pede de novo e acaba na resposta", async () => {
        const lock = createPermissionLock(appState, LIMIT);
        const {log, prompt} = prompts();
        let answerAtt: (status: string) => void = () => {};
        const attPermission = fakePermission("undetermined", [() => new Promise((resolve) => (answerAtt = resolve))]);
        const flow = att(attPermission, lock).run();
        lock(prompt("next"));
        await advance(LIMIT);
        expect(log.started).toEqual(["next"]);
        expect(attPermission.requests).toBe(1);
        attPermission.status = "denied";
        answerAtt("denied");
        expect(await flow.final).toEqual({status: "denied", attempts: 1});
        expect(attPermission.requests).toBe(1);
    });
});
