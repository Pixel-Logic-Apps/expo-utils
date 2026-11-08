/**
 * Remote Config na volta ao app (`resume_config` no bloco `utils`). Regra do dono: o app só aparece com a config da rede
 * e nada aparece e some na frente da pessoa. Por isso a config é a da abertura e só muda escondida:
 *
 *   - `off` (padrão): nada muda até fechar o app, como sempre foi.
 *   - `on_leave`: quando o app vai para o 2º plano, busca a config de novo. Se mudou e a pessoa ainda está fora, aplica
 *     e as telas são redesenhadas escondidas: ela volta já com a config nova. Se ela voltar antes de a busca terminar,
 *     nada muda na frente dela: a config nova fica guardada e vale na próxima saída (ou na próxima abertura). No iOS a
 *     config buscada sempre vale no começo da próxima saída (`applyAfterFetch`: lá o callback da busca pode rodar já com
 *     a pessoa no app).
 *
 * "2º plano" é o app inteiro fora de vista: no iOS o `background` do AppState (alerta do sistema, folha de compra e
 * anúncio não chegam a ele); no Android só com o ProcessLifecycleOwner (utils/app-lifecycle.ts), porque o AppState do RN
 * vira `background` em todo diálogo de permissão, intersticial e compra. Sem ele, no Android, fica como `off`.
 *
 * Busca no máximo uma por vez, e não repete se a última saiu há menos de `minIntervalMs` (quem troca de app várias vezes
 * seguidas não dispara uma busca por troca). Busca que falha deixa a config como está.
 *
 * Módulo-folha e sem dependência: recebe tudo de fora para ser testável.
 */

export type ResumeConfigMode = "off" | "on_leave";

/** A config que a sessão usa: os blocos `utils` e `screens`. */
export type ConfigSnapshot = {utils: Record<string, any>; screens: Record<string, any>};

export type ResumeConfigOptions = {
    /** Modo atual (`resume_config` da config em uso). */
    mode: () => unknown;
    /** Busca a config na rede e devolve os blocos, ou null se falhou. */
    refresh: () => Promise<ConfigSnapshot | null>;
    /** A config em uso agora. */
    current: () => ConfigSnapshot;
    /** Troca a config em uso e redesenha as telas. Só é chamado com o app fora de vista. */
    apply: (snapshot: ConfigSnapshot) => void;
    now: () => number;
    minIntervalMs: number;
    /**
     * Aplicar na mesma saída, quando a busca termina com o app ainda fora (Android). false: a config buscada só vale no
     * começo da próxima saída, dentro do próprio evento (iOS, onde o callback da busca pode rodar já com a pessoa no app).
     */
    applyAfterFetch: boolean;
};

const sameConfig = (a: ConfigSnapshot, b: ConfigSnapshot): boolean => {
    try {
        return JSON.stringify([a.utils, a.screens]) === JSON.stringify([b.utils, b.screens]);
    } catch {
        return false;
    }
};

/** Devolve o ouvinte de primeiro/segundo plano (`active` / `background`). */
export const createResumeConfig = (options: ResumeConfigOptions) => {
    const {mode, refresh, current, apply, now, minIntervalMs, applyAfterFetch} = options;
    let state = "active";
    let fetching = false;
    let lastFetchAt = Number.NEGATIVE_INFINITY;
    let pending: ConfigSnapshot | null = null;

    const applyIfChanged = (snapshot: ConfigSnapshot) => {
        if (!sameConfig(snapshot, current())) apply(snapshot);
    };

    return (next: string) => {
        state = next;
        if (next !== "background" || mode() !== "on_leave") return;
        // A config que chegou com a pessoa no app vale agora, escondida.
        if (pending) {
            const snapshot = pending;
            pending = null;
            applyIfChanged(snapshot);
        }
        if (fetching || now() - lastFetchAt < minIntervalMs) return;
        fetching = true;
        lastFetchAt = now();
        refresh()
            .then((snapshot) => {
                if (!snapshot) return;
                if (applyAfterFetch && state === "background") applyIfChanged(snapshot);
                else if (!sameConfig(snapshot, current())) pending = snapshot;
            })
            .catch(() => {})
            .finally(() => {
                fetching = false;
            });
    };
};
