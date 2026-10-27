import React from "react";
import {StyleSheet} from "react-native";
import {AlertDialog, Host, Text, TextButton, useMaterialColors} from "@expo/ui/jetpack-compose";
import {verticalScroll} from "@expo/ui/jetpack-compose/modifiers";
import {answerNativeAlert, closeNativeAlert, composeAlertButtons, type NativeAlertButton, type NativeAlertRequest} from "./native-alert";
import {getBootAppStrings} from "./Utils";

/**
 * Android: o AlertDialog do Material 3 pelo @expo/ui. Ele abre numa janela própria; o Host é o pai imediato, fica fora
 * do layout e montado enquanto a fila tiver pedido (um AlertDialog por pedido, pelo `key`). Montado = aberto: o botão
 * tira o pedido da fila no próprio onClick e o diálogo desmonta. O Text do @expo/ui parte do TextStyle.Default e não
 * herda a tipografia do slot, por isso cada texto leva o token do diálogo do M3 (título headlineSmall, texto
 * bodyMedium, botão labelLarge). A mensagem rola, como no AlertDialog do RN. A paleta sai da cor primária do app
 * (`primaryColor` do AppStrings, pelo `seedColor` do Host); sem ela, a cor dinâmica do aparelho.
 */
export default function NativeAlertDialog({request}: {request: NativeAlertRequest}) {
    const {error} = useMaterialColors();
    const {dismiss, confirm} = composeAlertButtons(request.buttons);
    // fecha antes do callback: um Alert.alert chamado dentro dele vai para o fim da fila, e o diálogo não fica preso se ele lançar
    const answer = (callback?: NativeAlertButton["onPress"]) => () => {
        closeNativeAlert(request);
        answerNativeAlert(request, callback);
    };
    const renderButton = (button: NativeAlertButton, index: number) => (
        <TextButton
            key={index}
            onClick={answer(button.onPress)}
            colors={button.style === "destructive" ? {contentColor: error} : undefined}>
            <Text style={{typography: "labelLarge"}}>{button.text ?? ""}</Text>
        </TextButton>
    );
    return (
        <Host style={styles.host} seedColor={getBootAppStrings()?.primaryColor}>
            <AlertDialog
                key={request.id}
                // só chega com cancelable: o Compose só chama no voltar/toque fora liberados pelas properties
                onDismissRequest={answer(request.onDismiss)}
                properties={{dismissOnBackPress: request.cancelable, dismissOnClickOutside: request.cancelable}}>
                {!!request.title && (
                    <AlertDialog.Title>
                        <Text style={{typography: "headlineSmall"}}>{request.title}</Text>
                    </AlertDialog.Title>
                )}
                {!!request.message && (
                    <AlertDialog.Text>
                        <Text style={{typography: "bodyMedium"}} modifiers={[verticalScroll()]}>
                            {request.message}
                        </Text>
                    </AlertDialog.Text>
                )}
                <AlertDialog.ConfirmButton>{renderButton(confirm, 0)}</AlertDialog.ConfirmButton>
                {/* o M3 põe os botões num FlowRow de direção invertida, com o confirm como 1º item, e cada botão do slot é
                    um item: invertidos, ficam na ordem do RN (o 1º mais à esquerda; empilhados, o confirm em cima) */}
                {dismiss.length > 0 && <AlertDialog.DismissButton>{dismiss.map(renderButton).reverse()}</AlertDialog.DismissButton>}
            </AlertDialog>
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
