/**
 * Portão dos pedidos de permissão da lib (ATT no iOS, notificação no Android e no iOS). Uma regra só, por evento:
 *
 *   1. Pede com o app ativo (`AppState === "active"`, conferido de novo logo antes do pedido). Se não estiver (alerta do
 *      sistema ou diálogo do app na frente, tela dividida no iPad), espera o evento de "ficou ativo" do AppState. Nunca
 *      timer.
 *   2. Relê o status logo antes de cada pedido e nunca pede o que já foi respondido.
 *   3. Pedido descartado ou cancelado sem resposta: pede de novo no próximo "ficou ativo", até 3 vezes por abertura.
 *      Depois desiste; a próxima abertura tenta de novo, porque o status continua sem resposta.
 *   4. Todo pedido tem limite de tempo: promessa nativa que nunca resolve não trava quem espera.
 *   5. Um pedido por vez: chamadas concorrentes recebem o mesmo fluxo, e `after` faz um portão esperar a vez dele (a
 *      notificação só pede depois do fim do ATT).
 *
 * Por que existe (06–07/11/2026). O iOS descarta o ATT em silêncio quando o app não está `active` na hora da chamada ou
 * quando há outro pedido de permissão pendente: o retorno chega em milissegundos como `notDetermined`, igual a "nunca
 * perguntado". A doc da Apple manda chamar de novo nesse caso (requestTrackingAuthorization; ATTrackingManager.h), e o
 * expo-tracking-transparency pede uma vez só. O `active` do RN é o didBecomeActive nativo (RCTAppState.mm). No
 * laboratório (simulador, iOS 26.5 e 27.0), pedir de novo no próximo `active` mostrou o ATT em 9 de 9 rodadas. No
 * Android, um pedido concorrente é cancelado pelo sistema, e o RN guarda um listener de permissão só: a promessa pode
 * ficar pendurada. As esperas fixas de antes (3 s no splash, 2 s, 1 s e "4 s e pede mesmo assim") só afastavam os
 * pedidos uns dos outros por acaso. Não recoloque espera fixa.
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

export type PermissionOutcome<S> = {status: S; attempts: number};

export type PermissionFlow<S> = {
    /** 1º desfecho: a resposta, a desistência ou o 1º pedido perdido (a nova tentativa fica armada para o próximo active). */
    first: Promise<PermissionOutcome<S>>;
    /** Desfecho da abertura: respondido ou 3 pedidos perdidos. Não chega se o app não voltar a ficar ativo. */
    final: Promise<PermissionOutcome<S>>;
};

export type PermissionGateOptions<S> = {
    appState: AppStateLike;
    /** Status atual, sem pedir nada. */
    read: () => Promise<S>;
    /** Mostra o pedido do sistema e devolve o status. */
    request: () => Promise<S>;
    /** Status sem resposta: pode pedir. */
    canAsk: (status: S) => boolean;
    /**
     * O pedido se perdeu sem a pessoa responder (descartado ou cancelado pelo sistema). `leftActive`: o app saiu de
     * `active` durante o pedido. Padrão: `canAsk(status)` (o status continua sem resposta).
     */
    lost?: (status: S, leftActive: boolean) => boolean;
    /** Limite de cada pedido. No limite o status é relido e vale a mesma regra do `lost`. */
    requestLimitMs: number;
    /** Pedidos por abertura. Padrão 3. */
    maxAttempts?: number;
    /**
     * Ordem entre portões: cada pedido só sai depois que esta promessa termina (ex.: o fim do fluxo do ATT, para a
     * notificação não sair junto nem antes dele). Sem limite, porque é ordem e não espera de tempo; só é aguardada quando
     * há o que pedir, e o status e o AppState são conferidos de novo depois dela.
     */
    after?: () => Promise<unknown>;
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
    const {appState, read, request, canAsk, requestLimitMs, maxAttempts = 3, after} = options;
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
                let status = await read();
                if (!canAsk(status) || attempts >= maxAttempts) return {status, attempts};
                if (after) await after().then(noop, noop);
                await waitForActive(appState);
                // Relido logo antes do pedido: pode ter sido respondido enquanto o app estava inativo.
                status = await read();
                if (!canAsk(status)) return {status, attempts};
                // A releitura vai ao nativo: se o app saiu de `active` nesse meio-tempo, volta a esperar o "ficou ativo".
                if (appState.currentState !== "active") continue;
                attempts += 1;
                const watch = watchAppState(appState);
                try {
                    const pending = request();
                    const result = await withTimeout(pending, requestLimitMs);
                    const timedOut = result === TIMED_OUT;
                    status = result === TIMED_OUT ? await read() : result;
                    if (!lost(status, watch.leftActive()) || attempts >= maxAttempts) return {status, attempts};
                    settleFirst({status, attempts});
                    // Nova tentativa no próximo "ficou ativo". O pedido que estourou o limite ainda pode responder (o
                    // alerta pode seguir na tela): o que vier antes acorda a releitura do status.
                    await (timedOut ? Promise.race([watch.nextActive, pending.then(noop, noop)]) : watch.nextActive);
                } finally {
                    watch.stop();
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
