import React, {useEffect, useId, useSyncExternalStore, type ComponentType} from "react";
import {requireOptionalNativeModule} from "expo";
import {expoUtilsWarn} from "./Utils";
import {addNativeAlertHost, failNativeAlert, nativeAlertFor, subscribeNativeAlert, type NativeAlertRequest} from "./native-alert";

/**
 * O diálogo do Expo UI (native-alert-dialog.ios.tsx / .android.tsx) só carrega depois de confirmar o módulo nativo
 * ExpoUI. Exceção à regra de imports do AGENTS.md: o @expo/ui chama requireNativeModule("ExpoUI") no carregamento e
 * lança num binário sem ele (JS novo por OTA num binário antigo); com import no topo o app cairia no boot em vez de
 * ficar no Alert do RN. É o padrão do expo-router 58 para o @expo/ui opcional (build/optional-libraries/expo-ui.js).
 */
let NativeAlertDialog: ComponentType<{request: NativeAlertRequest}> | null = null;
if (requireOptionalNativeModule("ExpoUI") != null) {
    try {
        NativeAlertDialog = require("./native-alert-dialog").default;
    } catch (e) {
        expoUtilsWarn("native alert:", e);
    }
}

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
 * Ponto de montagem do Alert.alert nativo (utils/native-alert.ts). O ExpoUtilsLayout e o AskForReviewOverlay montam um
 * cada, porque o template padrão e o lab não usam o ExpoUtilsLayout; só um desenha. Sem o diálogo carregado o slot não
 * registra host e o Alert do RN continua desenhando.
 */
export function NativeAlertSlot() {
    const id = useId();
    const request = useSyncExternalStore(subscribeNativeAlert, () => nativeAlertFor(id));
    useEffect(() => (NativeAlertDialog ? addNativeAlertHost(id) : undefined), [id]);
    return request && NativeAlertDialog ? (
        <DialogBoundary>
            <NativeAlertDialog request={request} />
        </DialogBoundary>
    ) : null;
}

export default NativeAlertSlot;
