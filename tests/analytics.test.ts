import {expect, mock, test} from "bun:test";

const behavior = {mode: "promise" as "promise" | "void" | "reject" | "throw", events: [] as any[]};
mock.module("@react-native-firebase/app", () => ({getApp: () => ({})}));
mock.module("@react-native-firebase/analytics", () => ({
    getAnalytics: () => ({}),
    logEvent: (_a: any, name: string, params: any) => {
        behavior.events.push({name, params});
        if (behavior.mode === "throw") throw new Error("nativo explodiu");
        if (behavior.mode === "reject") return Promise.reject(new Error("rejeitou"));
        if (behavior.mode === "void") return undefined; // tipagem do RNFB 26
        return Promise.resolve();
    },
    setUserId: () => undefined,
    setUserProperty: () => Promise.reject(new Error("rejeitou")),
}));

const {logUtilsEvent, sanitizeAnalyticsParams, setUtilsUserId, setUtilsUserProperty} = await import("../utils/analytics");

test("sanitize: boolean vira 1/0, vazios saem, string corta em 100", () => {
    expect(sanitizeAnalyticsParams({a: true, b: false, c: undefined, d: null, e: NaN, f: "x".repeat(250), g: 4.39})).toEqual({
        a: 1,
        b: 0,
        f: "x".repeat(100),
        g: 4.39,
    });
});

test("logUtilsEvent nunca lança nem gera unhandled rejection, em nenhuma tipagem do RNFB", async () => {
    const unhandled: any[] = [];
    const onUnhandled = (reason: any) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    for (const mode of ["promise", "void", "reject", "throw"] as const) {
        behavior.mode = mode;
        expect(() => logUtilsEvent("evento_" + mode, {ok: true})).not.toThrow();
    }
    expect(() => setUtilsUserId("abc")).not.toThrow();
    expect(() => setUtilsUserProperty("rc_status", "active")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off("unhandledRejection", onUnhandled);
    expect(unhandled).toEqual([]);
    expect(behavior.events.map((e) => e.name)).toEqual(["evento_promise", "evento_void", "evento_reject", "evento_throw"]);
});

test("nome de evento corta em 40 chars (limite do GA4)", () => {
    behavior.mode = "promise";
    behavior.events.length = 0;
    logUtilsEvent("e".repeat(60));
    expect(behavior.events[0].name).toHaveLength(40);
});
