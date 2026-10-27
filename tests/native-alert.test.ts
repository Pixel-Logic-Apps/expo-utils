import {afterEach, describe, expect, mock, test} from "bun:test";

// Alert do RN de mentira: grava o que chega ao Alert original (o caminho sem host do Expo UI).
const rnCalls: any[][] = [];
const prompt = () => {};
const Alert: {alert: (...args: any[]) => void; prompt: () => void} = {alert: (...args) => void rnCalls.push(args), prompt};
mock.module("react-native", () => ({Alert}));

const {
    addNativeAlertHost,
    answerNativeAlert,
    closeNativeAlert,
    composeAlertButtons,
    failNativeAlert,
    nativeAlertFor,
    subscribeNativeAlert,
    swiftAlertRoles,
} = await import("../utils/native-alert");

const offs: Array<() => void> = [];
const host = (id: string) => {
    offs.push(addNativeAlertHost(id));
};

afterEach(() => {
    offs.splice(0).forEach((off) => off());
    // esvazia a fila que sobrou do teste
    const off = addNativeAlertHost("limpeza");
    for (let request = nativeAlertFor("limpeza"); request; request = nativeAlertFor("limpeza")) closeNativeAlert(request);
    off();
    rnCalls.length = 0;
});

describe("Alert.alert pelo Expo UI (fila e fallback)", () => {
    test("sem host montado vai para o Alert do RN com os mesmos argumentos; o método só é trocado quando um host monta", () => {
        const original = Alert.alert;
        const buttons = [{text: "OK", onPress: () => {}}];
        const options = {cancelable: true};
        Alert.alert("Título", "Mensagem", buttons, options);
        expect(Alert.alert).toBe(original);
        expect(rnCalls).toEqual([["Título", "Mensagem", buttons, options]]);

        const off = addNativeAlertHost("a");
        expect(Alert.alert).not.toBe(original);
        expect(Alert.prompt).toBe(prompt);
        off();

        // trocado, mas sem host: o RN recebe os mesmos objetos
        Alert.alert("Depois", undefined, buttons);
        expect(rnCalls[1]).toEqual(["Depois", undefined, buttons]);
        expect(rnCalls[1][2]).toBe(buttons);
    });

    test("com host, o pedido entra na fila e não chega ao RN", () => {
        host("a");
        const buttons = [{text: "Cancelar", style: "cancel" as const}, {text: "OK"}];
        const onDismiss = () => {};
        Alert.alert("Sair?", "Você vai precisar entrar de novo.", buttons, {cancelable: true, onDismiss});
        const request = nativeAlertFor("a")!;
        expect(request).toMatchObject({title: "Sair?", message: "Você vai precisar entrar de novo.", cancelable: true});
        expect(request.buttons).toBe(buttons);
        expect(request.onDismiss).toBe(onDismiss);
        expect(rnCalls).toEqual([]);

        closeNativeAlert(request);
        Alert.alert("Só título");
        expect(nativeAlertFor("a")).toMatchObject({title: "Só título", message: undefined, buttons: [], cancelable: false});
    });

    test("um de cada vez: o 2º só aparece quando o 1º sai da fila, e o botão roda uma vez só", () => {
        host("a");
        let presses = 0;
        Alert.alert("Primeiro", undefined, [{text: "OK", onPress: () => presses++}]);
        Alert.alert("Segundo");
        const first = nativeAlertFor("a")!;
        expect(first.title).toBe("Primeiro");

        answerNativeAlert(first, first.buttons[0].onPress);
        answerNativeAlert(first, first.buttons[0].onPress); // toque duplo
        expect(presses).toBe(1);
        expect(nativeAlertFor("a")).toBe(first); // responder não tira da fila

        closeNativeAlert(first);
        closeNativeAlert(first);
        expect(nativeAlertFor("a")?.title).toBe("Segundo");
    });

    test("Android: o botão tira o pedido da fila antes do callback; alerta chamado dentro dele entra depois dos que já estavam", () => {
        host("a");
        Alert.alert("A", undefined, [{text: "OK", onPress: () => Alert.alert("C")}]);
        Alert.alert("B");
        const a = nativeAlertFor("a")!;
        closeNativeAlert(a);
        answerNativeAlert(a, a.buttons[0].onPress);
        expect(nativeAlertFor("a")?.title).toBe("B");
        closeNativeAlert(nativeAlertFor("a")!);
        expect(nativeAlertFor("a")?.title).toBe("C");
    });

    test("iOS: o onPress roda com o alerta ainda na fila e o onIsPresentedChange(false) tira; sem botões, só ele chega", () => {
        host("a");
        Alert.alert("A", undefined, [{text: "OK", onPress: () => Alert.alert("C")}]);
        Alert.alert("B");
        const a = nativeAlertFor("a")!;
        answerNativeAlert(a, a.buttons[0].onPress); // a ação roda antes de o SwiftUI fechar
        expect(nativeAlertFor("a")).toBe(a); // o B só monta depois que o A fecha
        closeNativeAlert(a); // onIsPresentedChange(false)
        expect(nativeAlertFor("a")?.title).toBe("B");

        closeNativeAlert(nativeAlertFor("a")!); // o "OK" do sistema
        expect(nativeAlertFor("a")?.title).toBe("C");
    });

    test("Android: voltar ou toque fora (cancelable) chama o onDismiss uma vez, e o botão depois não roda", () => {
        host("a");
        let dismissed = 0;
        let presses = 0;
        Alert.alert("A", undefined, [{text: "OK", onPress: () => presses++}], {cancelable: true, onDismiss: () => dismissed++});
        const a = nativeAlertFor("a")!;
        for (const callback of [a.onDismiss, a.onDismiss, a.buttons[0].onPress]) {
            closeNativeAlert(a);
            answerNativeAlert(a, callback);
        }
        expect([dismissed, presses]).toEqual([1, 0]);
        expect(nativeAlertFor("a")).toBeNull();
    });

    test("dono único: só o 1º host desenha; se ele desmontar, o próximo assume o pedido aberto", () => {
        const offA = addNativeAlertHost("a");
        host("b");
        Alert.alert("Aberto");
        expect(nativeAlertFor("a")?.title).toBe("Aberto");
        expect(nativeAlertFor("b")).toBeNull();
        offA();
        expect(nativeAlertFor("b")?.title).toBe("Aberto");
    });

    test("avisa os listeners a cada mudança (o slot redesenha)", () => {
        let changes = 0;
        const unsubscribe = subscribeNativeAlert(() => changes++);
        host("a"); // 1
        Alert.alert("A"); // 2
        closeNativeAlert(nativeAlertFor("a")!); // 3
        unsubscribe();
        Alert.alert("B");
        expect(changes).toBe(3);
    });
});

describe("mapeamento dos botões", () => {
    const a = {text: "A"};
    const b = {text: "B", style: "cancel" as const};
    const c = {text: "C", style: "destructive" as const};
    const d = {text: "D"};

    test("Android: o último vai no Confirm e os anteriores no Dismiss, na ordem; sem botões, um OK; mais de 3, corta como o RN", () => {
        expect(composeAlertButtons([])).toEqual({dismiss: [], confirm: {text: "OK"}});
        expect(composeAlertButtons([a])).toEqual({dismiss: [], confirm: a});
        expect(composeAlertButtons([a, b])).toEqual({dismiss: [a], confirm: b});
        expect(composeAlertButtons([a, b, c])).toEqual({dismiss: [a, b], confirm: c});
        expect(composeAlertButtons([a, b, c, d])).toEqual({dismiss: [a, b], confirm: c});
    });

    test("iOS: style vira role; com dois cancel, só o último fica cancel (o UIAlertController aceita um)", () => {
        expect(swiftAlertRoles([b, a, c])).toEqual(["cancel", undefined, "destructive"]);
        expect(swiftAlertRoles([b, c, b])).toEqual([undefined, "destructive", "cancel"]);
        expect(swiftAlertRoles([a, {text: "E", style: "default"}])).toEqual([undefined, undefined]);
    });
});

// Por último: o erro desliga o caminho do Expo UI até o fim da sessão (estado do módulo).
describe("erro do diálogo", () => {
    test("o pedido aberto e os da fila vão para o Alert do RN com os mesmos argumentos; o já respondido não repete; os próximos também vão", () => {
        host("a");
        const buttons = [{text: "Apagar", style: "destructive" as const, onPress: () => {}}];
        const options = {cancelable: true};
        Alert.alert("Respondido", undefined, [{text: "OK"}]);
        answerNativeAlert(nativeAlertFor("a")!); // iOS: o onPress já rodou, falta o alerta fechar
        Alert.alert("Aberto", "Mensagem", buttons, options);
        Alert.alert("Na fila");
        failNativeAlert();
        expect(rnCalls).toEqual([["Aberto", "Mensagem", buttons, options], ["Na fila"]]);
        expect(rnCalls[0][2]).toBe(buttons);
        expect(nativeAlertFor("a")).toBeNull();

        Alert.alert("Depois"); // o host continua montado, mas o diálogo não volta
        expect(rnCalls[2]).toEqual(["Depois"]);
        expect(nativeAlertFor("a")).toBeNull();
    });
});
