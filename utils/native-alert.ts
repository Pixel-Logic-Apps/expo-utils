import {Alert} from "react-native";

/**
 * Alert.alert pelo Expo UI: o alerta do SwiftUI no iOS e o AlertDialog do Material 3 no Android
 * (native-alert-dialog.ios.tsx / .android.tsx). Os apps continuam chamando o Alert.alert do react-native: quando um
 * host monta (NativeAlertSlot, que o AskForReviewOverlay já monta), a lib troca o método e os pedidos entram numa fila
 * que o host desenha um de cada vez. Sem host montado (boot antes do layout, app sem slot) ou depois de um erro do
 * diálogo, vão para o Alert do RN com os mesmos argumentos. O Alert.prompt não passa por aqui.
 *
 * Arquivo-folha, sem UI: a fila, o dono único e o mapeamento dos botões são testados no bun (tests/native-alert.test.ts).
 */

type AlertArgs = Parameters<typeof Alert.alert>;
export type NativeAlertButton = NonNullable<AlertArgs[2]>[number];

export type NativeAlertRequest = {
    id: number;
    title: string;
    message?: string;
    buttons: NativeAlertButton[];
    /** só o Android usa, como no RN: voltar e toque fora fecham e chamam o `onDismiss` */
    cancelable: boolean;
    onDismiss?: () => void;
    /** os argumentos como chegaram, para o Alert do RN se o diálogo falhar */
    args: AlertArgs;
};

const queue: NativeAlertRequest[] = [];
const hosts: string[] = [];
const listeners = new Set<() => void>();
const answered = new WeakSet<NativeAlertRequest>();
let sequence = 0;
/** o Alert.alert do RN, guardado quando o 1º host monta */
let rnAlert: typeof Alert.alert | null = null;
let failed = false;

const notify = () => listeners.forEach((listener) => listener());

function install() {
    if (rnAlert) return;
    const original = (rnAlert = Alert.alert);
    Alert.alert = (...args: AlertArgs) => {
        if (failed || !hosts.length) return original.apply(Alert, args);
        const [title, message, buttons, options] = args;
        queue.push({
            id: ++sequence,
            title: title || "",
            message: message || undefined,
            buttons: buttons ?? [],
            cancelable: options?.cancelable === true,
            onDismiss: options?.onDismiss,
            args,
        });
        notify();
    };
}

export function subscribeNativeAlert(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Registra um host montado (na 1ª vez, troca o Alert.alert). Só o 1º registrado desenha; se ele sair, o próximo assume. */
export function addNativeAlertHost(id: string) {
    install();
    hosts.push(id);
    notify();
    return () => {
        const index = hosts.indexOf(id);
        if (index >= 0) hosts.splice(index, 1);
        notify();
    };
}

/** O pedido que o host `id` desenha agora: o 1º da fila, e só no host ativo. */
export function nativeAlertFor(id: string) {
    return hosts[0] === id ? (queue[0] ?? null) : null;
}

/**
 * Resposta do pedido (o botão tocado ou, no Android, o voltar/toque fora com `cancelable`): o callback roda uma vez só,
 * mesmo com toque duplo ou evento repetido.
 */
export function answerNativeAlert(request: NativeAlertRequest, callback?: NativeAlertButton["onPress"]) {
    if (answered.has(request)) return;
    answered.add(request);
    callback?.();
}

/** Tira o pedido da fila e o próximo aparece. */
export function closeNativeAlert(request: NativeAlertRequest) {
    const index = queue.indexOf(request);
    if (index < 0) return;
    queue.splice(index, 1);
    notify();
}

/** O diálogo lançou ao desenhar: daqui em diante tudo vai para o Alert do RN, a começar pelo que estava na fila. */
export function failNativeAlert() {
    failed = true;
    const pending = queue.splice(0).filter((request) => !answered.has(request));
    notify();
    pending.forEach((request) => rnAlert?.apply(Alert, request.args));
}

/**
 * Android: os 2 slots do AlertDialog. O RN corta em 3 botões (neutral, negative, positive); aqui o último vai no
 * Confirm e os anteriores no Dismiss, na ordem. Sem botões, um "OK", e o último sem texto vira "OK", como o RN.
 */
export function composeAlertButtons(buttons: NativeAlertButton[]) {
    const list: NativeAlertButton[] = buttons.length ? buttons.slice(0, 3) : [{text: "OK"}];
    const confirm = list[list.length - 1];
    return {dismiss: list.slice(0, -1), confirm: confirm.text ? confirm : {...confirm, text: "OK"}};
}

/** iOS: o role do Button do SwiftUI pelo style do RN. O UIAlertController aceita uma ação cancel só; como no RN, vale a última. */
export function swiftAlertRoles(buttons: NativeAlertButton[]) {
    const lastCancel = buttons.map((button) => button.style).lastIndexOf("cancel");
    return buttons.map((button, index) =>
        button.style === "destructive" ? ("destructive" as const) : index === lastCancel ? ("cancel" as const) : undefined,
    );
}
