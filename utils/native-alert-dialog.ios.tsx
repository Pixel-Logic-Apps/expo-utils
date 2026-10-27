import React from "react";
import {StyleSheet} from "react-native";
import {Alert, Button, Host, Text} from "@expo/ui/swift-ui";
import {answerNativeAlert, closeNativeAlert, swiftAlertRoles, type NativeAlertRequest} from "./native-alert";

/**
 * Remendo por tempo: o onIsPresentedChange(false) chega no começo da saída, e o @expo/ui não avisa quando o alerta
 * terminou de sair. O próximo, montado antes disso, o UIKit recusa ("already presenting", thread 721190 dos fóruns da
 * Apple) e a fila trava; por isso o pedido só sai da fila meio segundo depois.
 */
const AFTER_DISMISS_MS = 500;

/**
 * iOS: o `.alert` do SwiftUI pelo @expo/ui. O alerta fica preso a uma view (o Alert.Trigger): aqui um texto vazio num
 * Host de 1 ponto, fora do layout, que fica montado enquanto a fila tiver pedido (um Alert por pedido, pelo `key`).
 * Montado = aberto. O botão roda o onPress antes de o SwiftUI fechar o alerta ("All actions in an alert dismiss the
 * alert after the action runs", doc da Apple); quem tira o pedido da fila é o onIsPresentedChange(false), que chega
 * depois (com o atraso acima). Sem botões, o próprio SwiftUI põe o "OK" do sistema, traduzido, como o RN; o último
 * botão sem texto vira "OK", como no RN. A Apple pode reordenar os botões pelo role.
 */
export default function NativeAlertDialog({request}: {request: NativeAlertRequest}) {
    const roles = swiftAlertRoles(request.buttons);
    return (
        <Host style={styles.host}>
            <Alert
                key={request.id}
                title={request.title}
                isPresented
                onIsPresentedChange={(presented) => {
                    if (!presented) setTimeout(() => closeNativeAlert(request), AFTER_DISMISS_MS);
                }}>
                <Alert.Trigger>
                    <Text>{" "}</Text>
                </Alert.Trigger>
                {request.buttons.length > 0 && (
                    <Alert.Actions>
                        {request.buttons.map((button, index) => (
                            <Button
                                key={index}
                                label={button.text || (index === request.buttons.length - 1 ? "OK" : "")}
                                role={roles[index]}
                                onPress={() => answerNativeAlert(request, button.onPress)}
                            />
                        ))}
                    </Alert.Actions>
                )}
                {!!request.message && (
                    <Alert.Message>
                        <Text>{request.message}</Text>
                    </Alert.Message>
                )}
            </Alert>
        </Host>
    );
}

const styles = StyleSheet.create({
    host: {
        position: "absolute",
        width: 1,
        height: 1,
    },
});
