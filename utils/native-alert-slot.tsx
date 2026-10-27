import React, {useEffect, useId, useSyncExternalStore} from "react";
import {expoUtilsWarn} from "./Utils";
import {addNativeAlertHost, failNativeAlert, nativeAlertFor, subscribeNativeAlert} from "./native-alert";
// .ios.tsx / .android.tsx pelo Metro; import no topo como o glass-button: o @expo/ui tem que estar no binário
import NativeAlertDialog from "./native-alert-dialog";

/** Erro ao desenhar o diálogo: em vez de derrubar o layout raiz, o pedido aberto e os seguintes vão para o Alert do RN. */
class DialogBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
    state = {failed: false};

    static getDerivedStateFromError() {
        return {failed: true};
    }

    componentDidCatch(error: unknown) {
        expoUtilsWarn("native alert:", error);
        failNativeAlert();
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

/**
 * Ponto de montagem do Alert.alert nativo (utils/native-alert.ts). Quem monta é o AskForReviewOverlay, que o
 * ExpoUtilsLayout sempre renderiza (o template padrão e o lab o renderizam sem o layout); com mais de um slot montado,
 * só o 1º desenha.
 */
export function NativeAlertSlot() {
    const id = useId();
    const request = useSyncExternalStore(subscribeNativeAlert, () => nativeAlertFor(id));
    useEffect(() => addNativeAlertHost(id), [id]);
    return request ? (
        <DialogBoundary>
            <NativeAlertDialog request={request} />
        </DialogBoundary>
    ) : null;
}

export default NativeAlertSlot;
