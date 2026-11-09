/**
 * Portão dos pedidos de permissão da lib (ATT no iOS, notificação no Android e no iOS). Uma regra só, por evento:
 *
 *   1. Pede com o app ativo (`AppState === "active"`, conferido pela trava logo antes do pedido). Se não estiver (alerta
 *      do sistema ou diálogo do app na frente, tela dividida no iPad), espera o evento de "ficou ativo" do AppState. Nunca
 *      timer.
 *   2. Nunca pede o que já foi respondido: com `read`, lê o status antes (fora da trava) e no limite. Só use `read` com
 *      leitura que não pendura (ATT: propriedade síncrona do ATTrackingManager; Android: PermissionsAndroid.check). Sem
 *      `read`, pede direto: o pedido do sistema já respondido devolve a resposta na hora, sem mostrar nada. É o caso do
 *      push no iOS, cuja leitura (`getNotificationSettings`) às vezes não voltava e o pedido não saía naquela abertura
 *      (medido no iOS 27, 07/11/2026).
 *   3. Pedido descartado ou cancelado sem resposta: pede de novo no próximo "ficou ativo", até 3 vezes por abertura.
 *      Depois desiste; a próxima abertura tenta de novo, porque o status continua sem resposta.
 *   4. Todo pedido tem limite de tempo, que só corre com o app ativo: promessa nativa que nunca resolve não trava quem
 *      espera, e diálogo na tela não vira estouro.
 *   5. Um pedido por vez, em todo pedido real que passa pela trava (`createPermissionLock`): quem pede primeiro vai
 *      primeiro, sem ordem fixa e sem reserva de lugar. Os pedidos do app que possam sair na abertura usam a mesma trava
 *      (`Utils.withPermissionPrompt`). Chamadas concorrentes do mesmo portão recebem o mesmo fluxo, e `after` faz um
 *      portão esperar o fim do outro (a notificação só pede depois do fim do ATT).
 *
 * Por que existe (06–07/11/2026). O iOS descarta o ATT em silêncio quando o app não está `active` na hora da chamada ou
 * quando há outro pedido de permissão pendente: o retorno chega em milissegundos como `notDetermined`, igual a "nunca
 * perguntado". A doc da Apple manda chamar de novo nesse caso (requestTrackingAuthorization; ATTrackingManager.h), e o
 * expo-tracking-transparency pede uma vez só. O `active` do RN é o didBecomeActive nativo (RCTAppState.mm). No
 * laboratório (simulador, iOS 26.5 e 27.0), pedir de novo no próximo `active` mostrou o ATT em 9 de 9 rodadas. No
 * Android, o RN guarda um listener de permissão só (ReactActivityDelegate.requestPermissions): um 2º pedido antes de o
 * 1º diálogo pausar a Activity troca o listener e a resposta do 1º se perde. Se o 1º era do Expo, o PermissionsService
 * fica com o listener preso: a promessa nunca resolve e todo pedido do Expo depois dela entra numa fila que só anda na
 * próxima abertura. É isso que a trava evita. As esperas fixas de antes (3 s no splash, 2 s, 1 s e "4 s e pede mesmo
 * assim") só afastavam os pedidos uns dos outros por acaso. Não recoloque espera fixa.
 *
 * Módulo-folha e sem dependência: recebe o AppState (o do RN, nos apps) para ser testável.
 */

/** O pedaço do AppState do RN que o portão usa. */
export type AppStateLike = {
    readonly currentState: string | null | undefined;
    addEventListener(type: "change", listener: (state: string) => void): {remove(): void};
};

export const TIMED_OUT = Symbol("timed-out");

const noop = () => {};

/** Corre a promessa contra o limite. A que perde a corrida não vira rejeição solta. */
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), ms);
    });
    return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
};

/**
 * Resolve quando o app está ativo: na hora, se já está; senão, no evento de "ficou ativo". Não tem limite próprio
 * (pedir com o app inativo é descarte certo): quem não pode esperar para sempre corre isto com `withTimeout`.
 */
export const waitForActive = (appState: AppStateLike): Promise<void> => {
    if (appState.currentState === "active") return Promise.resolve();
    return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            subscription.remove();
            resolve();
        };
        const subscription = appState.addEventListener("change", (state) => {
            if (state === "active") finish();
        });
        // Virou active entre a checagem e a assinatura.
        if (appState.currentState === "active") finish();
    });
};

/**
 * Observa o AppState durante um pedido: se o app saiu de `active` (no Android, o diálogo de permissão pausa a Activity e
 * o RN manda `background`; é o sinal de que o diálogo apareceu) e o próximo "ficou ativo".
 */
const watchAppState = (appState: AppStateLike) => {
    let left = false;
    let wake: () => void = noop;
    const nextActive = new Promise<void>((resolve) => {
        wake = resolve;
    });
    const subscription = appState.addEventListener("change", (state) => {
        if (state === "active") wake();
        else left = true;
    });
    return {nextActive, leftActive: () => left, stop: () => subscription.remove()};
};

/**
 * Limite de um pedido na trava. Só corre com o app ativo e recomeça a cada "ficou ativo", porque fora de `active` há um
 * diálogo na tela ou nada pode ser pedido, e estourar aí soltaria a trava por cima do diálogo. Os timers do JS no Android
 * não bastam: congelam com a Activity pausada (JavaTimerManager), mas seguem durante uma tarefa headless, e o que venceu
 * dispara na retomada, junto com a resposta do diálogo.
 */
const limitWhileActive = (appState: AppStateLike, ms: number) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expire: () => void = noop;
    const expired = new Promise<typeof TIMED_OUT>((resolve) => {
        expire = () => resolve(TIMED_OUT);
    });
    const arm = () => {
        timer = setTimeout(expire, ms);
    };
    if (appState.currentState === "active") arm();
    const subscription = appState.addEventListener("change", (state) => {
        clearTimeout(timer);
        if (state === "active") arm();
    });
    return {
        expired,
        stop: () => {
            clearTimeout(timer);
            subscription.remove();
        },
    };
};

/** Corre a promessa contra um limite que só corre com o app ativo (o mesmo da trava). A que perde não vira rejeição solta. */
export const withActiveLimit = <T>(appState: AppStateLike, promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> => {
    const limit = limitWhileActive(appState, ms);
    return Promise.race([promise, limit.expired]).finally(limit.stop);
};

/** Roda `fn` quando chegar a vez e o app estiver ativo. Com o limite estourado devolve `TIMED_OUT` e solta a trava. */
export type PermissionLock = <T>(fn: () => Promise<T>) => Promise<T | typeof TIMED_OUT>;

/**
 * A trava única dos pedidos de permissão: uma fila na ordem de chegada, um `fn` por vez. O app ativo é conferido depois de
 * chegar a vez, logo antes de `fn`, porque o diálogo anterior pode ter acabado de responder com o app ainda fora de
 * `active`. Essa espera é por evento, sem limite: pedir com o app inativo é descarte certo. A trava sai quando `fn`
 * termina (resposta ou rejeição) ou no limite, e `fn` que pendura não prende a fila.
 */
export const createPermissionLock = (appState: AppStateLike, limitMs: number): PermissionLock => {
    let tail: Promise<unknown> = Promise.resolve();
    return <T>(fn: () => Promise<T>) => {
        const turn = tail.then(async () => {
            await waitForActive(appState);
            const limit = limitWhileActive(appState, limitMs);
            try {
                return await Promise.race([fn(), limit.expired]);
            } finally {
                limit.stop();
            }
        });
        tail = turn.then(noop, noop);
        return turn;
    };
};

export type PermissionOutcome<S> = {status: S; attempts: number};

export type PermissionFlow<S> = {
    /** 1º desfecho: a resposta, a desistência ou o 1º pedido perdido (a nova tentativa fica armada para o próximo active). */
    first: Promise<PermissionOutcome<S>>;
    /** Desfecho da abertura: respondido ou 3 pedidos perdidos. Não chega se o app não voltar a ficar ativo. */
    final: Promise<PermissionOutcome<S>>;
};

export type PermissionGateOptions<S> = {
    appState: AppStateLike;
    /**
     * Status atual, sem pedir nada. Só com leitura que não pendura: já respondido, o fluxo acaba sem entrar na trava nem
     * esperar o app ativo; e no limite vale o status lido. Sem ela, pede direto e no limite vale `noAnswer`.
     */
    read?: () => Promise<S>;
    /** Mostra o pedido do sistema e devolve o status. Já respondido, devolve a resposta sem mostrar nada. */
    request: () => Promise<S>;
    /** Status sem resposta: pode pedir. */
    canAsk: (status: S) => boolean;
    /**
     * O pedido se perdeu sem a pessoa responder (descartado ou cancelado pelo sistema). `leftActive`: o app saiu de
     * `active` durante o pedido. Padrão: `canAsk(status)` (o status continua sem resposta).
     */
    lost?: (status: S, leftActive: boolean) => boolean;
    /** Status de um pedido que passou do limite sem resposta, quando não há `read`. Vale a mesma regra do `lost`. */
    noAnswer: S;
    /** A trava que faz cada pedido sair sozinho e com limite. */
    lock: PermissionLock;
    /** Pedidos por abertura. Padrão 3. */
    maxAttempts?: number;
    /**
     * Ordem entre portões: cada pedido só sai depois que esta promessa termina (ex.: o fim do fluxo do ATT, para a
     * notificação não sair junto nem antes dele). Sem limite, porque é ordem e não espera de tempo; é aguardada antes de
     * entrar na fila da trava, e o AppState é conferido de novo na vez do pedido. `undefined`: nada a esperar desta vez.
     */
    after?: () => Promise<unknown> | undefined;
};

export type PermissionGate<S> = {
    /** Inicia o fluxo da abertura, ou devolve o que já está em andamento (ou terminado). */
    run: () => PermissionFlow<S>;
    /** O fluxo começou e ainda vai pedir (ou está pedindo) nesta abertura. */
    isPending: () => boolean;
    /** Pedidos feitos nesta abertura. */
    attempts: () => number;
};

export const createPermissionGate = <S>(options: PermissionGateOptions<S>): PermissionGate<S> => {
    const {appState, read, request, canAsk, noAnswer, lock, maxAttempts = 3, after} = options;
    const lost = options.lost ?? ((status: S) => canAsk(status));
    let flow: PermissionFlow<S> | null = null;
    let running = false;
    let attempts = 0;

    const start = (): PermissionFlow<S> => {
        let settleFirst: (outcome: PermissionOutcome<S>) => void = noop;
        let failFirst: (error: unknown) => void = noop;
        const first = new Promise<PermissionOutcome<S>>((resolve, reject) => {
            settleFirst = resolve;
            failFirst = reject;
        });
        running = true;
        const final = (async (): Promise<PermissionOutcome<S>> => {
            for (;;) {
                if (read) {
                    const current = await read();
                    if (!canAsk(current) || attempts >= maxAttempts) return {status: current, attempts};
                }
                const before = after?.();
                if (before) await before.then(noop, noop);
                const asked: {watch?: ReturnType<typeof watchAppState>; pending?: Promise<S>} = {};
                try {
                    // A trava só roda o pedido com o app ativo, logo depois do evento: entre os dois não há ida ao nativo.
                    const result = await lock((): Promise<S> => {
                        attempts += 1;
                        asked.watch = watchAppState(appState);
                        asked.pending = request();
                        return asked.pending;
                    });
                    const {watch, pending} = asked;
                    if (!watch || !pending) return {status: noAnswer, attempts};
                    const timedOut = result === TIMED_OUT;
                    const status = timedOut ? (read ? await read() : noAnswer) : result;
                    if (!lost(status, watch.leftActive()) || attempts >= maxAttempts) return {status, attempts};
                    settleFirst({status, attempts});
                    // Nova tentativa no próximo "ficou ativo". O pedido que estourou o limite ainda pode responder (o
                    // alerta pode seguir na tela): se a resposta vier antes, ela vale.
                    if (timedOut) {
                        const none = (): typeof TIMED_OUT => TIMED_OUT;
                        const late = await Promise.race([watch.nextActive.then(none), pending.catch(none)]);
                        if (late !== TIMED_OUT && !lost(late, watch.leftActive())) return {status: late, attempts};
                    } else {
                        await watch.nextActive;
                    }
                } finally {
                    asked.watch?.stop();
                }
            }
        })();
        final.then(
            (outcome) => {
                running = false;
                settleFirst(outcome);
            },
            (error) => {
                running = false;
                failFirst(error);
            },
        );
        // Marcadas como tratadas: quem espera continua recebendo a rejeição.
        first.catch(noop);
        final.catch(noop);
        return {first, final};
    };

    return {
        run: () => {
            if (!flow) flow = start();
            return flow;
        },
        isPending: () => running,
        attempts: () => attempts,
    };
};
