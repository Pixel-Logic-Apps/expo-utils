import {HotUpdater} from "@hot-updater/react-native";
import {expoUtilsLog, expoUtilsWarn} from "./Utils";

// OTA do Hot Updater nas DUAS gerações, com a mesma chamada (`initHotUpdater`):
//
//   v0 (0.35/0.36)  métodos estáticos: `HotUpdater.init({baseURL})` não devolve nada e o
//                   `HotUpdater.checkForUpdate` existe. Servidor v0: URL terminada em `/api/check-update`.
//   v1 (1.1.3+)     o `HotUpdater` só tem `init`, que DEVOLVE a instância; checkForUpdate, getBundleId e
//                   reload ficam nela. Servidor v1 novo (outro Worker): `baseURL` é a raiz dele e a chave de
//                   cliente vai no `x-api-key`. Um não fala com o servidor do outro (guia "Move from v0 to v1").
//
// `any` de propósito: o tsc do app confere este arquivo contra o @hot-updater/react-native que o APP tem,
// e os tipos das duas gerações não são compatíveis entre si.
const HU: any = HotUpdater;

export type HotUpdaterGeneration = 0 | 1;

export interface InitHotUpdaterOptions {
    /** Chave de cliente do servidor v1 (`x-api-key`), a `HOT_UPDATER_API_KEY` do `hot-updater init`. O v0 ignora. */
    apiKey?: string;
}

const V0_CHECK_PATH = "/api/check-update";

let instance: any = null; // v1: a instância em uso (criada aqui ou passada pelo app)
let v0Ready = false; // v0: HotUpdater.init já rodou nesta sessão
let runningBundleId: string | null = null;

/** Geração do @hot-updater/react-native instalado: 0 quando o `checkForUpdate` é estático, senão 1. */
export function hotUpdaterGeneration(): HotUpdaterGeneration {
    return typeof HU?.checkForUpdate === "function" ? 0 : 1;
}

/**
 * O que chama o Hot Updater: no v0 o próprio `HotUpdater` (métodos estáticos); no v1 a instância do
 * `initHotUpdater` (`null` antes dele, e sempre em `__DEV__`, onde o init não roda).
 */
export function getHotUpdater(): any {
    return hotUpdaterGeneration() === 0 ? HU : instance;
}

/**
 * Id do pacote que está RODANDO nesta sessão, lido no `initHotUpdater` antes de qualquer download. No v1 o
 * `getBundleId()` passa a devolver o pacote baixado assim que o download termina, antes de reiniciar.
 * `null` sem o init (inclusive em `__DEV__`).
 */
export function getRunningBundleId(): string | null {
    return runningBundleId;
}

function readBundleId(source: any): string | null {
    try {
        const id = source?.getBundleId?.();
        return typeof id === "string" && id ? id : null;
    } catch {
        return null;
    }
}

/** Motivo para não ligar o v1 com esta URL/chave, ou null se estiver tudo certo. */
function v1ConfigProblem(baseURL: string, apiKey?: string): string | null {
    if (baseURL.includes(V0_CHECK_PATH)) {
        return `URL de servidor v0 (${V0_CHECK_PATH}) com o Hot Updater v1 instalado: o v1 usa a raiz do Worker v1, que é outro servidor`;
    }
    const key = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!key || /^YOUR[_-]/i.test(key)) {
        return "Hot Updater v1 sem a chave de cliente (AppStrings.hotUpdaterApiKey / {apiKey})";
    }
    return null;
}

async function checkAndApply(updater: any): Promise<void> {
    const update = await updater.checkForUpdate({updateStrategy: "appVersion"});
    if (!update) return;
    expoUtilsLog("[expo-utils] OTA:", update.status ?? "UPDATE", update.id ?? "", update.transitionKind ?? "");
    // USE_BUILTIN (v1): o updateBundle() apaga na hora os pacotes baixados e o app volta ao embutido no
    // próximo início; no boot isso é aceitável.
    const applied = await update.updateBundle();
    if (update.shouldForceUpdate && applied !== false) {
        await updater.reload();
    }
}

/**
 * Confere e baixa o OTA do Hot Updater (estratégia `appVersion`); com `shouldForceUpdate`, reinicia.
 *
 * `target`: a URL do servidor (v0: `…/api/check-update`; v1: a raiz do Worker v1, com `{apiKey}`) ou, no
 * v1, a instância que o app já criou com `HotUpdater.init` (a lib usa essa e não cria outra). Nunca lança:
 * erro vira `expoUtilsWarn`. No v1, URL de servidor v0 ou chave ausente também viram aviso e o OTA não roda.
 * No-op em `__DEV__`: o bundle vem do Metro, e um OTA baixado em dev carregaria no lugar do embutido no
 * próximo cold launch (o isolation_key não muda num rebuild da mesma versão).
 */
export async function initHotUpdater(target?: string | object | null, options: InitHotUpdaterOptions = {}): Promise<void> {
    if (typeof __DEV__ !== "undefined" && __DEV__) return;
    if (!target) return;
    try {
        if (hotUpdaterGeneration() === 0) {
            if (typeof target !== "string") {
                expoUtilsWarn("initHotUpdater: o Hot Updater instalado é o v0, que não tem instância — passe a URL do servidor.");
                return;
            }
            if (!v0Ready) {
                HU.init({baseURL: target});
                v0Ready = true;
                runningBundleId = readBundleId(HU);
            }
            await checkAndApply(HU);
            return;
        }

        let updater = typeof target === "string" ? instance : target;
        if (!updater && typeof target === "string") {
            const problem = v1ConfigProblem(target, options.apiKey);
            if (problem) {
                expoUtilsWarn(`initHotUpdater: ${problem}. OTA desligado.`);
                return;
            }
            updater = HU.init({
                baseURL: target,
                requestHeaders: {"x-api-key": options.apiKey!.trim()},
                onError: (error: unknown) => expoUtilsWarn("initHotUpdater:", error),
            });
        }
        if (updater !== instance) {
            instance = updater;
            runningBundleId = readBundleId(updater);
        }
        await checkAndApply(updater);
    } catch (e) {
        expoUtilsWarn("initHotUpdater:", e);
    }
}
