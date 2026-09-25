import {expect, test} from "bun:test";
import {eventsOf, installMocks, state} from "./helpers/rn-mocks";

installMocks();
const push = await import("../utils/push-analytics");

const topicMessage = (overrides: Record<string, any> = {}) => ({
    messageId: "0:1758400000000%abc",
    from: "/topics/expo-urna-lang-pt",
    sentTime: Date.now() - 42_000,
    notification: {title: "Confira o resultado da apuração", body: "..."},
    data: {},
    ...overrides,
});

test("params: tópico sai do `from`, latência do sentTime, push_id do data do sender", () => {
    expect(push.getPushParams(topicMessage({data: {push_id: "n-981"}}))).toMatchObject({
        fcm_message_id: "0:1758400000000%abc",
        fcm_topic: "expo-urna-lang-pt",
        title: "Confira o resultado da apuração",
        push_id: "n-981",
        latency_s: 42,
    });
    // mensagem direta por token (sem tópico) e sem id do sender
    const direct = push.getPushParams(topicMessage({from: "1234567890", sentTime: undefined}));
    expect(direct.fcm_topic).toBe("");
    expect(direct.push_id).toBeUndefined();
    expect(direct.latency_s).toBeUndefined();
    expect(() => push.getPushParams(undefined)).not.toThrow();
});

test("recebida: foreground e background viram eventos distintos com app_state", () => {
    push.logPushReceived(topicMessage(), "foreground");
    push.logPushReceived(topicMessage(), "background");
    expect(eventsOf("push_received")[0].params).toMatchObject({app_state: "foreground", fcm_topic: "expo-urna-lang-pt"});
    expect(eventsOf("push_received_bg")[0].params).toMatchObject({app_state: "background"});
});

test("aberta: 1x por notificação (getInitialNotification repete a mesma no reload) e null é ignorado", async () => {
    await push.logPushOpened(null, "quit"); // app aberto pelo ícone
    await push.logPushOpened(topicMessage(), "quit");
    await push.logPushOpened(topicMessage(), "quit"); // mesma mensagem de novo
    await push.logPushOpened(topicMessage({messageId: "0:999%def"}), "background");
    const opened = eventsOf("push_opened");
    expect(opened.map((e) => [e.params.fcm_message_id, e.params.open_state])).toEqual([
        ["0:1758400000000%abc", "quit"],
        ["0:999%def", "background"],
    ]);
    expect(state.storage.get("@expo_utils_last_push_opened")).toBe("0:999%def");
});

test("nenhum evento usa `topic` / `message_id`: o GA4 some com esses nomes (medido 24/09/2026)", () => {
    for (const event of state.events) {
        expect(event.params).not.toHaveProperty("topic");
        expect(event.params).not.toHaveProperty("message_id");
    }
    expect(state.events.length).toBeGreaterThan(0);
});
