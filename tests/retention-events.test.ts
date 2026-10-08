import {afterEach, describe, expect, mock, test} from "bun:test";

// DeviceEventEmitter de verdade o bastante: o contrato que a detecção (próxima fase) vai usar.
const listeners = new Map<string, Set<(...args: any[]) => void>>();
const emitted: Array<{name: string; args: any[]}> = [];
const device = {os: "ios" as "ios" | "android", languageTag: "pt-BR"};
mock.module("expo-localization", () => ({getLocales: () => [{languageTag: device.languageTag, languageCode: device.languageTag.split("-")[0]}]}));
mock.module("react-native", () => ({
    NativeModules: {},
    Platform: {
        get OS() {
            return device.os;
        },
    },
    DeviceEventEmitter: {
        emit: (name: string, ...args: any[]) => {
            emitted.push({name, args});
            listeners.get(name)?.forEach((listener) => listener(...args));
        },
        addListener: (name: string, listener: (...args: any[]) => void) => {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name)!.add(listener);
            return {remove: () => listeners.get(name)?.delete(listener)};
        },
    },
}));

const {RetentionEvents, showRetentionPreview} = await import("../utils/retention-events");

afterEach(() => {
    RetentionEvents.hide();
    emitted.length = 0;
    (globalThis as any).remoteConfigUtils = undefined;
    device.os = "ios";
    device.languageTag = "pt-BR";
});

describe("RetentionEvents (abre o modal sem linha no app)", () => {
    test("show emite o evento com id e guarda o pedido aberto", () => {
        const received: any[] = [];
        const off = RetentionEvents.onShow((request) => received.push(request));
        const request = RetentionEvents.show({variant: "premium_kept", productIdentifier: "premium:mensal", expirationDate: "2026-10-12T15:00:00Z", managementURL: "https://play.google.com/store/account/subscriptions"});
        off();
        expect(received).toEqual([request]);
        expect(request.id).toBeGreaterThan(0);
        expect(request.variant).toBe("premium_kept");
        expect(RetentionEvents.getCurrent()).toBe(request);
        expect(RetentionEvents.isVisible()).toBe(true);
    });

    test("sem variante, ela sai do is_opted_out_trial_enabled do Remote Config", () => {
        expect(RetentionEvents.show({}).variant).toBe("premium_lost");
        (globalThis as any).remoteConfigUtils = {is_opted_out_trial_enabled: true};
        expect(RetentionEvents.show({}).variant).toBe("premium_kept");
    });

    test("closed com o id atual fecha, emite hide e o motivo; id antigo é ignorado", () => {
        const closedEvents: any[] = [];
        const off = RetentionEvents.onClosed((event) => closedEvents.push(event));
        const first = RetentionEvents.show({variant: "premium_lost"});
        const second = RetentionEvents.show({variant: "premium_lost"});
        RetentionEvents.closed(first.id, "dismiss"); // a animação de saída do pedido anterior terminou depois
        expect(RetentionEvents.getCurrent()).toBe(second);
        RetentionEvents.closed(second.id, "swipe");
        off();
        expect(RetentionEvents.isVisible()).toBe(false);
        expect(closedEvents).toEqual([{request: second, method: "swipe"}]);
        expect(emitted.map((event) => event.name)).toEqual(["expoUtilsRetentionShow", "expoUtilsRetentionShow", "expoUtilsRetentionHide", "expoUtilsRetentionClosed"]);
    });

    test("hide fecha por fora com o motivo hidden", () => {
        const closedEvents: any[] = [];
        const off = RetentionEvents.onClosed((event) => closedEvents.push(event));
        const request = RetentionEvents.show({});
        RetentionEvents.hide();
        RetentionEvents.hide(); // sem pedido aberto: nada
        off();
        expect(closedEvents).toEqual([{request, method: "hidden"}]);
    });
});

describe("showRetentionPreview", () => {
    test("dados falsos, marcado como pré-visualização, data de fim daqui a 5 dias", () => {
        const before = Date.now();
        const request = showRetentionPreview();
        const end = Date.parse(String(request.expirationDate));
        expect(request.preview).toBe(true);
        expect(request.variant).toBe("premium_lost");
        expect(request.managementURL).toBeNull();
        expect(request.defaultBullets).toBe(false);
        expect(end - before).toBeGreaterThanOrEqual(5 * 86400000 - 1000);
        expect(end - before).toBeLessThanOrEqual(5 * 86400000 + 1000);
    });

    test("opções: variante, língua, imagem, data e bullets passam para o modal", () => {
        const request = showRetentionPreview({variant: "premium_kept", locale: "ar", imageUrl: "https://example.com/banner.png", expirationDate: new Date("2026-10-12T15:00:00Z"), bullets: true});
        expect(request).toMatchObject({variant: "premium_kept", locale: "ar", imageUrl: "https://example.com/banner.png", expirationDate: "2026-10-12T15:00:00.000Z", defaultBullets: true, preview: true});
    });
});

describe("compatibilidade com a fase 1 (pedido sem segmento nem ofertas)", () => {
    test("show sem segmento/ofertas = trial cancelado + resubscribe, estado de oferta", () => {
        const request = RetentionEvents.show({variant: "premium_lost", productIdentifier: "premium:mensal"});
        expect(request.segment).toBe("trial_cancelled");
        expect(request.offers).toEqual([{name: "resubscribe", type: "resubscribe"}]);
        expect(request.state).toBe("offer");
        expect(request.productIdentifier).toBe("premium:mensal");
    });

    test("segmento inválido cai no trial_cancelled; lista vazia vira resubscribe", () => {
        const request = RetentionEvents.show({segment: "qualquer" as any, offers: []});
        expect(request.segment).toBe("trial_cancelled");
        expect(request.offers.map((offer) => offer.type)).toEqual(["resubscribe"]);
    });

    test("showRetentionPreview() sem opções continua igual e ganha só os padrões novos", () => {
        const request = showRetentionPreview();
        expect(request).toMatchObject({variant: "premium_lost", preview: true, managementURL: null, defaultBullets: false, segment: "trial_cancelled", state: "offer"});
        expect(request.offers).toHaveLength(1);
        expect(request.offers[0]).toMatchObject({name: "resubscribe", type: "resubscribe", price: {amount: 19.9, currency: "BRL"}, billingPeriod: {unit: "month", count: 1}});
    });

    test("as opções antigas (variante, língua, imagem, data, bullets) continuam passando", () => {
        const request = showRetentionPreview({variant: "premium_kept", locale: "en", imageUrl: "https://example.com/b.png", expirationDate: new Date("2026-10-12T15:00:00Z"), bullets: true});
        expect(request).toMatchObject({variant: "premium_kept", locale: "en", imageUrl: "https://example.com/b.png", expirationDate: "2026-10-12T15:00:00.000Z", defaultBullets: true, segment: "trial_cancelled"});
        expect(request.offers[0].price).toEqual({amount: 4.99, currency: "USD"});
    });
});

describe("showRetentionPreview com segmento e ofertas", () => {
    test("nomes: embutidas, catálogo de exemplo e o próprio tipo; desconhecido é ignorado", () => {
        const request = showRetentionPreview({segment: "expired", offers: ["winback", "discount_50", "lifetime", "nao_existe"], locale: "pt"});
        expect(request.segment).toBe("expired");
        expect(request.offers.map((offer) => [offer.name, offer.type])).toEqual([
            ["winback", "winback"],
            ["discount_50", "discount"],
            ["lifetime", "lifetime"],
        ]);
    });

    test("preços falsos: BRL em português, USD nas outras línguas", () => {
        const pt = showRetentionPreview({segment: "expired", offers: ["discount_50", "lifetime_deal"], locale: "pt"});
        expect(pt.offers[0]).toMatchObject({price: {amount: 9.9, currency: "BRL"}, originalPrice: {amount: 19.9, currency: "BRL"}, discountPeriod: {unit: "month", count: 3}});
        expect(pt.offers[1]).toMatchObject({price: {amount: 59.9, currency: "BRL"}, originalPrice: {amount: 99.9, currency: "BRL"}});
        const ja = showRetentionPreview({segment: "expired", offers: ["discount_50"], locale: "ja"});
        expect(ja.offers[0]).toMatchObject({price: {amount: 2.49, currency: "USD"}, originalPrice: {amount: 4.99, currency: "USD"}});
        // sem locale: a língua do aparelho escolhe a moeda
        device.languageTag = "fr-FR";
        expect(showRetentionPreview({segment: "expired"}).offers[0].price?.currency).toBe("USD");
    });

    test("objeto no formato do Remote Config: sem compare_product_id o vitalício não tem preço riscado", () => {
        const request = showRetentionPreview({segment: "free", offers: [{type: "lifetime", product_id: "vitalicio"}, {name: "anual", type: "subscription", product_id: "anual"}], locale: "pt"});
        expect(request.offers[0]).toMatchObject({name: "lifetime", type: "lifetime", price: {amount: 59.9, currency: "BRL"}, config: {type: "lifetime", product_id: "vitalicio"}});
        expect(request.offers[0].originalPrice).toBeUndefined();
        expect(request.offers[1]).toMatchObject({name: "anual", type: "subscription"});
    });

    test("offer_code: o código da plataforma (o da outra é a reserva)", () => {
        const offer = {type: "offer_code" as const, ios_code: "VOLTA_IOS", android_code: "VOLTA_PLAY"};
        expect(showRetentionPreview({segment: "expired", offers: [offer]}).offers[0].code).toBe("VOLTA_IOS");
        device.os = "android";
        expect(showRetentionPreview({segment: "expired", offers: [offer]}).offers[0].code).toBe("VOLTA_PLAY");
        expect(showRetentionPreview({segment: "expired", offers: [{type: "offer_code", ios_code: "SO_IOS"}]}).offers[0].code).toBe("SO_IOS");
    });

    test("Remote Config: a oferta declarada vence o catálogo e a lista do segmento é o padrão", () => {
        (globalThis as any).remoteConfigUtils = {
            retention: {
                segments: {billing_issue: {offers: ["resubscribe", "vitalicio_promo"]}},
                offers: {vitalicio_promo: {type: "lifetime", product_id: "lifetime_promo", compare_product_id: "lifetime"}, discount_50: {type: "lifetime"}},
            },
        };
        const billing = showRetentionPreview({segment: "billing_issue", locale: "pt"});
        expect(billing.offers.map((offer) => [offer.name, offer.type])).toEqual([
            ["resubscribe", "resubscribe"],
            ["vitalicio_promo", "lifetime"],
        ]);
        expect(showRetentionPreview({segment: "expired", offers: ["discount_50"]}).offers[0].type).toBe("lifetime");
    });

    test("sem lista em lugar nenhum: resubscribe; no free, o vitalício de exemplo", () => {
        expect(showRetentionPreview({segment: "trial_expired"}).offers.map((offer) => offer.name)).toEqual(["resubscribe"]);
        expect(showRetentionPreview({segment: "free"}).offers.map((offer) => offer.name)).toEqual(["lifetime_deal"]);
    });

    test("data: 5 dias no trial cancelado, 12 na assinatura cancelada, nenhuma nos outros", () => {
        const now = Date.now();
        const cancelled = Date.parse(String(showRetentionPreview({segment: "cancelled"}).expirationDate));
        expect(Math.round((cancelled - now) / 86400000)).toBe(12);
        expect(showRetentionPreview({segment: "expired"}).expirationDate).toBeNull();
        expect(showRetentionPreview({segment: "billing_issue"}).expirationDate).toBeNull();
        expect(showRetentionPreview({segment: "free", expirationDate: new Date("2026-10-12T15:00:00Z")}).expirationDate).toBe("2026-10-12T15:00:00.000Z");
    });

    test("estado do aviso pós-compra passa para o pedido", () => {
        expect(showRetentionPreview({segment: "billing_issue", offers: ["resubscribe", "lifetime_deal"], state: "lifetime_notice"}).state).toBe("lifetime_notice");
        expect(showRetentionPreview({segment: "billing_issue", state: "outro" as any}).state).toBe("offer");
    });
});
