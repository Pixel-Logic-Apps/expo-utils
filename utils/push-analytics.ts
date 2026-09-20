import AsyncStorage from "@react-native-async-storage/async-storage";
import {logUtilsEvent, type AnalyticsParams} from "./analytics";

// Telemetria de push: RECEBIDA (foreground / background) e ABERTA (toque na notificação).
//
//   push_received     app em foreground (onMessage)
//   push_received_bg  app em background/fechado (setBackgroundMessageHandler)
//   push_opened       usuário tocou na notificação — open_state: background | quit
//
// Params comuns: message_id, topic, title, push_id, latency_s (envio → recebimento/abertura).
// A taxa de abertura por notificação sai de push_opened ÷ push_received(+_bg), agrupando por
// `push_id` (ou por `title` enquanto o sender não mandar um id).
//
// Limite de plataforma, não bug: no iOS uma notificação exibida pelo sistema com o app em
// background/fechado NÃO acorda o JS (só com `content-available: 1`), então ali "recebida"
// só é contada em foreground. "Aberta" é contada nas duas plataformas. No Android o RNFB
// intercepta toda mensagem (BroadcastReceiver) e o handler de background roda sempre.

const LAST_OPENED_KEY = "@expo_utils_last_push_opened";

// Identificador estável da notificação, escolhido pelo SENDER (ex.: data: {push_id: "123"}).
// O message_id do FCM não serve para isso em envio por tópico: o id que a API devolve ao
// sender não é o que chega no aparelho.
const PUSH_ID_KEYS = ["push_id", "notification_id", "campaign_id"];

export const getPushParams = (remoteMessage: any): AnalyticsParams => {
    const from = String(remoteMessage?.from ?? "");
    const data = remoteMessage?.data ?? {};
    const sentTime = Number(remoteMessage?.sentTime);
    const pushIdKey = PUSH_ID_KEYS.find((key) => data[key] !== undefined && data[key] !== null && data[key] !== "");
    return {
        message_id: remoteMessage?.messageId ?? "",
        topic: from.startsWith("/topics/") ? from.slice("/topics/".length) : "",
        title: remoteMessage?.notification?.title ?? data.title ?? "",
        push_id: pushIdKey ? String(data[pushIdKey]) : undefined,
        latency_s: Number.isFinite(sentTime) && sentTime > 0 ? Math.max(0, Math.round((Date.now() - sentTime) / 1000)) : undefined,
    };
};

export const logPushReceived = (remoteMessage: any, appState: "foreground" | "background"): void => {
    logUtilsEvent(appState === "foreground" ? "push_received" : "push_received_bg", {...getPushParams(remoteMessage), app_state: appState});
};

/**
 * `push_opened`, no máximo 1x por notificação: o getInitialNotification pode devolver a MESMA
 * mensagem de novo (reload do JS, iOS), então o último message_id aberto fica persistido.
 */
export const logPushOpened = async (remoteMessage: any, openState: "background" | "quit"): Promise<void> => {
    try {
        if (!remoteMessage) return;
        const messageId = String(remoteMessage?.messageId ?? "");
        if (messageId) {
            if ((await AsyncStorage.getItem(LAST_OPENED_KEY)) === messageId) return;
            await AsyncStorage.setItem(LAST_OPENED_KEY, messageId);
        }
        logUtilsEvent("push_opened", {...getPushParams(remoteMessage), open_state: openState});
    } catch {}
};
