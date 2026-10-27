import type {ComponentType} from "react";
import type {NativeAlertRequest} from "./native-alert";

// Tipo do diálogo do Alert.alert nativo: em runtime o Metro carrega native-alert-dialog.ios.tsx ou .android.tsx.
declare const NativeAlertDialog: ComponentType<{request: NativeAlertRequest}>;
export default NativeAlertDialog;
