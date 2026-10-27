import {AppState, NativeEventEmitter, NativeModules, Platform} from "react-native";

/**
 * Primeiro × segundo plano para o gatilho do app open.
 *
 * No Android o AppState do RN vira `background` no onPause da Activity: fechar um diálogo de permissão, um
 * intersticial, a folha de compra ou a de compartilhamento contava como "saiu e voltou" e mostrava app open indevido.
 * A correção do Google (a mesma dos plugins oficiais para Flutter e Unity) é o ProcessLifecycleOwner, que só avisa
 * quando o app inteiro sai de vista (ON_STOP) e quando volta (ON_START).
 *
 * A peça nativa é o pacote `react-native-applifecycle`, que o APP instala (a lib vai por OTA e não pode ter módulo
 * nativo próprio). O pacote JS NÃO é importado — app sem ele não pode quebrar no bundle: lemos direto o módulo nativo
 * `ReactNativeAppLifecycle` (só existe no Android) e assinamos o evento de mesmo nome, `{type: "ON_START" | "ON_STOP"}`.
 * O `isAvailable` do pacote não detecta a falta do nativo, por isso a checagem é no NativeModules. Sem o módulo, ou no
 * iOS (onde o próprio pacote cai no AppState), fica o AppState de sempre.
 *
 * Assinatura tardia: o ProcessLifecycleOwner reenvia o estado atual a quem assina, então chega um ON_START logo depois
 * de assinar. Quem consome compara com o estado anterior (que começa em `active`): esse ON_START não é uma volta.
 *
 * Módulo-folha (só importa o react-native).
 */

export const APP_LIFECYCLE_MODULE = "ReactNativeAppLifecycle";

export type AppLifecycleSource = "process-lifecycle" | "app-state";

/** Android com o módulo nativo do react-native-applifecycle usa o ProcessLifecycleOwner; o resto, o AppState. */
export const pickAppLifecycleSource = (os: string, nativeModule: unknown): AppLifecycleSource =>
    os === "android" && nativeModule ? "process-lifecycle" : "app-state";

/** ON_START/ON_STOP no vocabulário do AppState. Outro tipo volta null e é ignorado. */
export const processLifecycleState = (event: unknown): "active" | "background" | null => {
    const type = (event as {type?: unknown} | null | undefined)?.type;
    if (type === "ON_START") return "active";
    if (type === "ON_STOP") return "background";
    return null;
};

/**
 * Assina as mudanças de primeiro/segundo plano (`active` / `background`, como o AppState) e devolve a fonte usada.
 * Nunca lança: se a assinatura do módulo nativo falhar, cai no AppState.
 */
export const addAppLifecycleListener = (listener: (state: string) => void): AppLifecycleSource => {
    const nativeModule = Platform.OS === "android" ? NativeModules[APP_LIFECYCLE_MODULE] : undefined;
    if (pickAppLifecycleSource(Platform.OS, nativeModule) === "process-lifecycle") {
        try {
            new NativeEventEmitter(nativeModule).addListener(APP_LIFECYCLE_MODULE, (event: unknown) => {
                const state = processLifecycleState(event);
                if (state) listener(state);
            });
            return "process-lifecycle";
        } catch {}
    }
    AppState.addEventListener("change", listener);
    return "app-state";
};
