import {describe, expect, mock, test} from "bun:test";

// O i18n importa NativeModules do react-native (não instalado neste repo).
mock.module("react-native", () => ({NativeModules: {}}));

const {translations} = await import("../utils/i18n");
const {RETENTION_LIMITS, resolveRetentionTexts} = await import("../utils/retention-texts");
const {
    RETENTION_OFFER_TYPES,
    RETENTION_PERIOD_UNITS,
    RETENTION_PREVIEW_OFFERS,
    RETENTION_SEGMENTS,
    buildRetentionPreviewOffer,
    formatRetentionPercent,
    formatRetentionPrice,
    pickRetentionPlural,
    resolveRetentionOfferInput,
    retentionCardKind,
    retentionCtaKey,
    retentionDiscountPercent,
    retentionOfferAction,
    retentionPluralCategory,
    retentionPreviewCurrency,
    retentionPreviewNext,
    splitRetentionOffers,
} = await import("../utils/retention-offers");
const {buildRetentionView, fillRetentionText} = await import("../utils/retention-view");

type Offer = import("../utils/retention-offers").RetentionOffer;
type OfferConfig = import("../utils/types").RetentionOfferConfig;
type Segment = import("../utils/types").RetentionSegment;
type OfferType = import("../utils/types").RetentionOfferType;

const LANGUAGES = ["pt", "en", "es", "fr", "de", "it", "ja", "ko", "zh", "ru", "ar", "nl"];
const VARIANTS = ["premium_lost", "premium_kept"] as const;
/** Nome realista com 20 caracteres no lugar do `{app}`. */
const APP = "Consulta Placa Fácil";
/** Caracteres como a pessoa vê (pontos de código, não unidades UTF-16). */
const length = (value: string | null | undefined) => [...(value ?? "")].length;
/** O Intl separa moeda e número com espaço inseparável (U+00A0 / U+202F). */
const plain = (value: string | null | undefined) => (value ?? "").replace(/[\u00A0\u202F]/g, " ");
/** Meio-dia local: a data cai no dia 12 em qualquer fuso de quem roda o teste. */
const END = new Date(2026, 9, 12, 12, 0, 0);
/** Botões e linhas curtas do cartão: não é limite da Apple, é o que cabe no botão sem virar 3 linhas. */
const CTA_LIMIT = 30;

/** Uma oferta de cada tipo, no formato do Remote Config (os nomes do plano). */
const CONFIGS: Record<string, OfferConfig> = {
    resubscribe: {type: "resubscribe"},
    winback: {type: "winback"},
    discount_50: RETENTION_PREVIEW_OFFERS.discount_50,
    premium_anual: {type: "subscription", product_id: "premium_anual"},
    lifetime_deal: RETENTION_PREVIEW_OFFERS.lifetime_deal,
    promo_code: RETENTION_PREVIEW_OFFERS.promo_code,
};
const NAME_OF: Record<OfferType, string> = {resubscribe: "resubscribe", winback: "winback", discount: "discount_50", subscription: "premium_anual", lifetime: "lifetime_deal", offer_code: "promo_code"};

/** Oferta com os preços realistas da pré-visualização (BRL em português, USD nas outras). */
const offer = (name: string, lang = "pt", config: OfferConfig = CONFIGS[name]): Offer =>
    buildRetentionPreviewOffer(name, config, {currency: retentionPreviewCurrency(lang)});
const offersOf = (lang: string, ...types: OfferType[]) => types.map((type) => offer(NAME_OF[type], lang));

const view = (segment: Segment, types: OfferType[], extra: Partial<Parameters<typeof buildRetentionView>[0]> = {}) =>
    buildRetentionView({segment, variant: "premium_lost", offers: offersOf(String(extra.language ?? "pt"), ...types), language: "pt", appName: "Meu App", expirationDate: END, ...extra});

describe("textos novos nas 12 línguas", () => {
    test("toda língua tem todos os campos novos preenchidos e as variáveis certas", () => {
        for (const lang of LANGUAGES) {
            const t = translations[lang].retention;
            const groups: Record<string, Record<string, unknown>> = {
                ...Object.fromEntries(Object.entries(t.segments).map(([segment, fields]) => [`segments.${segment}`, fields])),
                ctas: t.ctas,
                cards: t.cards,
                notice: t.notice,
            };
            for (const [group, fields] of Object.entries(groups)) {
                for (const [key, value] of Object.entries(fields)) {
                    expect(typeof value === "string" && value.trim().length > 0, `${lang}.${group}.${key}`).toBe(true);
                }
            }
            expect(Object.keys(t.segments).sort(), lang).toEqual(["billing_issue", "cancelled", "expired", "free", "trial_expired"]);
            expect(t.cards.badge, `${lang}.cards.badge`).toContain("{discount}");
            expect(t.cards.terms, `${lang}.cards.terms`).toContain("{original_price}");
            expect(t.cards.terms, `${lang}.cards.terms`).toContain("{per}");
            expect(t.segments.cancelled.date, `${lang}.segments.cancelled.date`).toContain("{date}");
            for (const table of ["per", "first"] as const) {
                expect(Object.keys(t.units[table]).sort(), `${lang}.units.${table}`).toEqual([...RETENTION_PERIOD_UNITS].sort());
                for (const unit of RETENTION_PERIOD_UNITS) {
                    const forms = t.units[table][unit];
                    expect(forms.one.trim().length > 0 && forms.other.trim().length > 0, `${lang}.units.${table}.${unit}`).toBe(true);
                    // `one` e o `two` do árabe (o dual: "شهرين") dizem a quantidade sem o número.
                    for (const [category, form] of Object.entries(forms)) {
                        if (category !== "one" && category !== "two") expect(form, `${lang}.units.${table}.${unit}.${category}`).toContain("{n}");
                    }
                }
            }
        }
    });

    for (const lang of LANGUAGES) {
        test(`${lang}: título ≤ 66, texto ≤ 144, bullets ≤ 66 em todo segmento × variante × oferta (preços reais, {app} de 20)`, () => {
            let views = 0;
            for (const segment of RETENTION_SEGMENTS) {
                for (const variant of VARIANTS) {
                    for (const primary of RETENTION_OFFER_TYPES) {
                        for (const secondary of RETENTION_OFFER_TYPES) {
                            const v = buildRetentionView({segment, variant, offers: offersOf(lang, primary, secondary), language: lang, appName: APP, defaultBullets: true, expirationDate: END});
                            views++;
                            expect(v.lang).toBe(lang);
                            expect(length(v.header), v.header).toBeLessThanOrEqual(RETENTION_LIMITS.header);
                            expect(length(v.body), v.body).toBeLessThanOrEqual(RETENTION_LIMITS.body);
                            for (const bullet of v.bullets) expect(length(bullet), bullet).toBeLessThanOrEqual(RETENTION_LIMITS.bullet);
                            expect(length(v.date), String(v.date)).toBeLessThanOrEqual(RETENTION_LIMITS.header);
                            expect(length(v.notice.header), v.notice.header).toBeLessThanOrEqual(RETENTION_LIMITS.header);
                            expect(length(v.notice.body), v.notice.body).toBeLessThanOrEqual(RETENTION_LIMITS.body);
                            expect(length(v.checking.hint), v.checking.hint).toBeLessThanOrEqual(RETENTION_LIMITS.body);
                            expect(length(v.checking.notYet), v.checking.notYet).toBeLessThanOrEqual(RETENTION_LIMITS.body);
                            for (const short of [v.dismiss, v.notice.cta, v.checking.confirm]) expect(length(short), short).toBeLessThanOrEqual(CTA_LIMIT);
                            const strings = [v.header, v.body, v.date ?? "", v.dismiss, ...v.bullets, v.notice.header, v.notice.body, v.notice.cta];
                            for (const item of [v.primary, v.secondary]) {
                                if (!item) continue;
                                expect(length(item.cta), item.cta).toBeLessThanOrEqual(CTA_LIMIT);
                                strings.push(item.cta);
                                const card = item.card;
                                if (!card) continue;
                                for (const line of [card.title, card.period, card.terms, card.hint]) expect(length(line), String(line)).toBeLessThanOrEqual(RETENTION_LIMITS.bullet);
                                expect(length(card.badge), String(card.badge)).toBeLessThanOrEqual(12);
                                strings.push(card.title ?? "", card.period ?? "", card.terms ?? "", card.hint ?? "", card.badge ?? "", card.price ?? "", card.per);
                            }
                            for (const value of strings) expect(value, `${lang}/${segment}/${primary}+${secondary}`).not.toMatch(/\{\w+\}/);
                        }
                    }
                }
            }
            expect(views).toBe(6 * 2 * 6 * 6);
        });
    }

    test("formas de período de 1 a 24 cabem e trocam o {n}", () => {
        for (const lang of LANGUAGES) {
            const t = translations[lang].retention;
            for (const unit of RETENTION_PERIOD_UNITS) {
                for (let n = 1; n <= 24; n++) {
                    for (const table of ["per", "first"] as const) {
                        const value = pickRetentionPlural(t.units[table][unit], lang, n, lang);
                        expect(value, `${lang}.${table}.${unit}.${n}`).not.toContain("{n}");
                        expect(length(value), value).toBeLessThanOrEqual(40);
                    }
                }
            }
        }
    });
});

describe("botão principal: tipo × segmento", () => {
    const EXPECTED: Record<OfferType, Record<Segment, string>> = {
        resubscribe: {trial_cancelled: "reactivate", cancelled: "reactivate", billing_issue: "updatePayment", expired: "subscribeAgain", trial_expired: "subscribeAgain", free: "subscribe"},
        discount: {trial_cancelled: "discount", cancelled: "discount", billing_issue: "discount", expired: "discount", trial_expired: "discount", free: "discount"},
        winback: {trial_cancelled: "winback", cancelled: "winback", billing_issue: "winback", expired: "winback", trial_expired: "winback", free: "winback"},
        subscription: {trial_cancelled: "subscribe", cancelled: "subscribe", billing_issue: "subscribe", expired: "subscribe", trial_expired: "subscribe", free: "subscribe"},
        lifetime: {trial_cancelled: "lifetime", cancelled: "lifetime", billing_issue: "lifetime", expired: "lifetime", trial_expired: "lifetime", free: "lifetime"},
        offer_code: {trial_cancelled: "code", cancelled: "code", billing_issue: "code", expired: "code", trial_expired: "code", free: "code"},
    };
    const LABEL_PT: Record<string, string> = {
        reactivate: "Reativar",
        updatePayment: "Atualizar pagamento",
        subscribeAgain: "Assinar de novo",
        subscribe: "Assinar",
        discount: "Quero o desconto",
        winback: "Voltar com desconto",
        lifetime: "Comprar vitalício",
        code: "Usar código",
    };

    test("tabela completa (6 tipos × 6 segmentos)", () => {
        for (const type of RETENTION_OFFER_TYPES) {
            for (const segment of RETENTION_SEGMENTS) expect(retentionCtaKey(type, segment), `${type}/${segment}`).toBe(EXPECTED[type][segment]);
        }
    });

    test("texto em português do botão principal e do cartão secundário; 'Agora não' em todo segmento", () => {
        for (const type of RETENTION_OFFER_TYPES) {
            for (const segment of RETENTION_SEGMENTS) {
                const primary = view(segment, [type]);
                expect(primary.primary.cta, `${type}/${segment}`).toBe(LABEL_PT[EXPECTED[type][segment]]);
                expect(primary.dismiss).toBe("Agora não");
                const second = view(segment, ["lifetime", type]);
                expect(second.secondary?.cta, `2ª ${type}/${segment}`).toBe(LABEL_PT[EXPECTED[type][segment]]);
            }
        }
    });

    test("o que o toque faz fora da pré-visualização", () => {
        expect(retentionOfferAction("resubscribe", "trial_cancelled")).toBe("reactivate");
        expect(retentionOfferAction("resubscribe", "cancelled")).toBe("reactivate");
        expect(retentionOfferAction("resubscribe", "billing_issue")).toBe("update_payment");
        expect(retentionOfferAction("resubscribe", "expired")).toBe("purchase");
        expect(retentionOfferAction("offer_code", "expired")).toBe("redeem");
        for (const type of ["discount", "winback", "subscription", "lifetime"] as const) expect(retentionOfferAction(type, "billing_issue")).toBe("purchase");
    });

    test("pré-visualização: reativar/atualizar → conferindo; vitalício com falha de pagamento → aviso; o resto fecha", () => {
        for (const type of RETENTION_OFFER_TYPES) {
            for (const segment of RETENTION_SEGMENTS) {
                const expected =
                    type === "resubscribe" && ["trial_cancelled", "cancelled", "billing_issue"].includes(segment)
                        ? "checking"
                        : type === "lifetime" && segment === "billing_issue"
                          ? "lifetime_notice"
                          : "close";
                expect(retentionPreviewNext(type, segment), `${type}/${segment}`).toBe(expected);
            }
        }
    });
});

describe("cartões de oferta", () => {
    test("qual cartão cada tipo desenha (principal × secundário)", () => {
        for (const segment of RETENTION_SEGMENTS) {
            for (const role of ["primary", "secondary"] as const) {
                expect(retentionCardKind("discount", segment, role)).toBe("discount");
                expect(retentionCardKind("winback", segment, role)).toBe("discount");
                expect(retentionCardKind("lifetime", segment, role)).toBe("lifetime");
                expect(retentionCardKind("subscription", segment, role)).toBe("price");
                expect(retentionCardKind("offer_code", segment, role)).toBe("code");
            }
            const buttonOnly = ["trial_cancelled", "cancelled", "billing_issue"].includes(segment);
            expect(retentionCardKind("resubscribe", segment, "primary"), segment).toBe(buttonOnly ? null : "price");
            expect(retentionCardKind("resubscribe", segment, "secondary"), segment).toBe("price");
        }
    });

    test("desconto: preço novo, riscado, selo verde, período e a regra depois do desconto", () => {
        const card = view("trial_cancelled", ["discount", "resubscribe"]).primary.card!;
        expect(card.kind).toBe("discount");
        expect(card.title).toBeNull();
        expect(plain(card.price)).toBe("R$ 9,90");
        expect(card.per).toBe("/mês");
        expect(plain(card.originalPrice)).toBe("R$ 19,90");
        expect(card.badge).toBe("−50%");
        expect(card.period).toBe("nos 3 primeiros meses");
        expect(plain(card.terms)).toBe("depois R$ 19,90/mês");
        const en = view("expired", ["winback"], {language: "en"}).primary.card!;
        expect([en.price, en.per, en.originalPrice, en.badge, en.period, en.terms]).toEqual(["$2.49", "/month", "$4.99", "−50%", "for the first 3 months", "then $4.99/month"]);
    });

    test("desconto sem preço de comparação: sem riscado, sem selo e sem a regra", () => {
        const noOriginal: Offer = {...offer("discount_50"), originalPrice: undefined};
        const card = buildRetentionView({segment: "expired", variant: "premium_lost", offers: [noOriginal], language: "pt", appName: "X"}).primary.card!;
        expect([card.originalPrice, card.badge, card.terms]).toEqual([null, null, null]);
        expect(card.period).toBe("nos 3 primeiros meses");
    });

    test("vitalício: 'Pague uma vez, use para sempre', riscado e selo só com produto de comparação", () => {
        const card = view("free", ["lifetime"]).primary.card!;
        expect(card.title).toBe("Pague uma vez, use para sempre");
        expect([plain(card.price), card.per, plain(card.originalPrice), card.badge]).toEqual(["R$ 59,90", "", "R$ 99,90", "−40%"]);
        expect([card.period, card.terms]).toEqual([null, null]);
        const alone = buildRetentionView({segment: "free", variant: "premium_lost", offers: [offer("lifetime", "pt", {type: "lifetime", product_id: "vitalicio"})], language: "pt", appName: "X"}).primary.card!;
        expect([plain(alone.price), alone.originalPrice, alone.badge]).toEqual(["R$ 59,90", null, null]);
    });

    test("assinatura (e assinar de novo no vencido): preço por período", () => {
        const expired = view("expired", ["resubscribe"]).primary.card!;
        expect([expired.kind, expired.title, plain(expired.price), expired.per, expired.originalPrice, expired.badge]).toEqual(["price", "Seu plano", "R$ 19,90", "/mês", null, null]);
        expect(view("trial_expired", ["subscription"]).primary.card!.title).toBe("Assinatura Premium");
        // quem nunca assinou não tem "seu plano"
        expect(view("free", ["resubscribe"]).primary.card!.title).toBe("Assinatura Premium");
    });

    test("código: pílula com o código e 'válido na loja'; sem código, só o título e a dica", () => {
        const card = view("expired", ["offer_code"]).primary.card!;
        expect([card.kind, card.title, card.code, card.hint, card.price, card.badge]).toEqual(["code", "Código promocional", "COMEBACK50", "válido na loja", null, null]);
        const noCode = buildRetentionView({segment: "expired", variant: "premium_lost", offers: [{name: "codigo", type: "offer_code"}], language: "pt", appName: "X"}).primary.card!;
        expect([noCode.code, noCode.hint]).toEqual([null, "válido na loja"]);
    });

    test("reativar/atualizar pagamento como principal: só o botão; como 2ª oferta: cartão 'Seu plano'", () => {
        expect(view("trial_cancelled", ["resubscribe"]).primary.card).toBeNull();
        expect(view("cancelled", ["resubscribe"]).primary.card).toBeNull();
        expect(view("billing_issue", ["resubscribe", "lifetime"]).primary.card).toBeNull();
        const second = view("trial_cancelled", ["discount", "resubscribe"]).secondary!;
        expect([second.cta, second.card?.kind, second.card?.title, plain(second.card?.price), second.card?.per]).toEqual(["Reativar", "price", "Seu plano", "R$ 19,90", "/mês"]);
    });

    test("no máximo UMA oferta além da principal; tipo inválido sai; lista vazia = resubscribe", () => {
        const v = view("expired", ["discount", "lifetime", "offer_code"]);
        expect(v.primary.offer.type).toBe("discount");
        expect(v.secondary?.offer.type).toBe("lifetime");
        const split = splitRetentionOffers([{name: "x", type: "bogus" as any}, {name: "", type: "lifetime"}, offer("lifetime_deal")]);
        expect(split.primary.name).toBe("lifetime_deal");
        expect(split.secondary).toBeNull();
        expect(splitRetentionOffers([]).primary).toEqual({name: "resubscribe", type: "resubscribe"});
        expect(splitRetentionOffers(undefined).secondary).toBeNull();
    });
});

describe("segmentos", () => {
    test("título e texto em português (as duas variantes onde existem)", () => {
        const pt = (segment: Segment, type: OfferType = "resubscribe", variant: "premium_lost" | "premium_kept" = "premium_lost") => {
            const v = view(segment, [type], {variant});
            return [v.header, v.body];
        };
        expect(pt("trial_cancelled")).toEqual(["Seu teste grátis foi cancelado", "Os anúncios voltaram. Reative a assinatura para continuar usando o Meu App sem anúncios."]);
        expect(pt("cancelled")).toEqual(["Sua assinatura foi cancelada", "Os anúncios voltaram. Reative a assinatura para continuar usando o Meu App sem anúncios."]);
        expect(pt("cancelled", "resubscribe", "premium_kept")).toEqual(["Sua assinatura foi cancelada", "Você ainda tem o Premium até o fim do período pago. Reative para não perder o acesso sem anúncios."]);
        expect(pt("billing_issue")).toEqual(["Seu pagamento não passou", "Atualize a forma de pagamento para não perder o Premium."]);
        expect(pt("expired")[0]).toBe("Sentimos sua falta");
        expect(pt("trial_expired")[0]).toBe("Seu teste grátis acabou");
        expect(pt("free", "lifetime")[0]).toBe("Que tal o Premium para sempre?");
        expect(pt("free", "subscription")[0]).toBe("Que tal o Premium?");
    });

    test("ilustração do cartão com alerta só na falha de pagamento", () => {
        for (const segment of RETENTION_SEGMENTS) expect(view(segment, ["resubscribe"]).illustration, segment).toBe(segment === "billing_issue" ? "billing" : "media");
    });

    test("linha da data: fim do teste, fim do período pago; nenhuma nos outros (mesmo com data)", () => {
        expect(view("trial_cancelled", ["resubscribe"]).date).toBe("Seu teste vai até 12 de outubro.");
        expect(view("cancelled", ["resubscribe"]).date).toBe("Sua assinatura termina em 12 de outubro.");
        expect(view("cancelled", ["resubscribe"], {language: "en"}).date).toBe("Your subscription ends on October 12.");
        for (const segment of ["billing_issue", "expired", "trial_expired", "free"] as const) expect(view(segment, ["lifetime"]).date, segment).toBeNull();
        expect(view("cancelled", ["resubscribe"], {expirationDate: null}).date).toBeNull();
    });

    test("estado 'conferindo': textos de pagamento na falha de pagamento, de reativação nos outros", () => {
        const billing = view("billing_issue", ["resubscribe"]).checking;
        expect(billing).toEqual({hint: "Depois de atualizar o pagamento na loja, toque em “Já atualizei”.", confirm: "Já atualizei", notYet: "Ainda não vimos o pagamento. Pode levar alguns minutos."});
        expect(view("cancelled", ["resubscribe"]).checking.confirm).toBe("Já reativei");
    });

    test("aviso depois do vitalício comprado com falha de pagamento", () => {
        expect(view("billing_issue", ["resubscribe", "lifetime"]).notice).toEqual({
            header: "Seu Premium vitalício está ativo",
            body: "Cancele a assinatura antiga para não ser cobrado de novo.",
            cta: "Gerenciar assinaturas",
        });
    });

    test("bullets da lib: sem 'Cancele quando quiser' quando a principal é o vitalício", () => {
        expect(view("expired", ["discount"], {defaultBullets: true}).bullets).toEqual(translations.pt.retention.bullets);
        expect(view("free", ["lifetime"], {defaultBullets: true}).bullets).toEqual(translations.pt.retention.bullets.slice(0, 2));
        expect(view("free", ["lifetime"]).bullets).toEqual([]);
    });

    test("árabe sai da direita para a esquerda; segmento inválido cai no trial cancelado", () => {
        expect(view("billing_issue", ["resubscribe"], {language: "ar"}).rtl).toBe(true);
        expect(view("billing_issue", ["resubscribe"], {language: "pt"}).rtl).toBe(false);
        expect(buildRetentionView({segment: "bogus" as any, variant: "premium_lost", language: "pt", appName: "X"}).segment).toBe("trial_cancelled");
    });
});

describe("Remote Config: chaves por segmento e por oferta", () => {
    test("título/texto do segmento com variáveis da 1ª oferta", () => {
        const v = view("expired", ["discount", "lifetime"], {
            remoteTexts: {pt: {"expired.title": "Volte para o {app}", "expired.body": "Só {price}{per} {period} ({discount} off; antes {original_price})."}},
        });
        expect(v.header).toBe("Volte para o Meu App");
        expect(plain(v.body)).toBe("Só R$ 9,90/mês nos 3 primeiros meses (50% off; antes R$ 19,90).");
    });

    test("offers.<nome>.*: botão, título, período, regra, selo e dica", () => {
        const v = view("expired", ["discount", "offer_code"], {
            remoteTexts: {
                pt: {
                    "offers.discount_50.cta": "Pagar {price}",
                    "offers.discount_50.title": "Oferta de volta",
                    "offers.discount_50.period": "só {period}",
                    "offers.discount_50.terms": "Depois {original_price}{per}. Cancele quando quiser.",
                    "offers.discount_50.badge": "{discount} OFF",
                    "offers.promo_code.cta": "Resgatar {code}",
                    "offers.promo_code.hint": "use até domingo",
                },
            },
        });
        expect(plain(v.primary.cta)).toBe("Pagar R$ 9,90");
        expect(v.primary.card).toMatchObject({title: "Oferta de volta", period: "só nos 3 primeiros meses", badge: "50% OFF"});
        expect(plain(v.primary.card!.terms)).toBe("Depois R$ 19,90/mês. Cancele quando quiser.");
        expect(v.secondary?.cta).toBe("Resgatar COMEBACK50");
        expect(v.secondary?.card?.hint).toBe("use até domingo");
    });

    test("chaves da fase 1 (header/body/bullets/cta) só valem no trial cancelado; o cta só no resubscribe", () => {
        const remoteTexts = {pt: {header: "Volta!", body: "Corpo antigo", bullets: ["Antigo"], cta: "Quero voltar"}};
        const trial = view("trial_cancelled", ["discount", "resubscribe"], {remoteTexts});
        expect([trial.header, trial.body, trial.bullets]).toEqual(["Volta!", "Corpo antigo", ["Antigo"]]);
        expect(trial.primary.cta).toBe("Quero o desconto");
        expect(trial.secondary?.cta).toBe("Quero voltar");
        const cancelled = view("cancelled", ["resubscribe"], {remoteTexts});
        expect([cancelled.header, cancelled.primary.cta, cancelled.bullets]).toEqual(["Sua assinatura foi cancelada", "Reativar", []]);
        // a chave nova vence a antiga
        expect(view("trial_cancelled", ["resubscribe"], {remoteTexts: {pt: {header: "antigo", "trial_cancelled.title": "novo"}}}).header).toBe("novo");
    });

    test("dismiss, aviso e linha da data do segmento", () => {
        const v = view("expired", ["lifetime"], {
            remoteTexts: {pt: {dismiss: "Depois", "notice.title": "Vitalício de {price} ativo", "notice.cta": "Abrir assinaturas", "expired.date": "Oferta até {date}."}},
        });
        expect(v.dismiss).toBe("Depois");
        expect(plain(v.notice.header)).toBe("Vitalício de R$ 59,90 ativo");
        expect(v.notice.cta).toBe("Abrir assinaturas");
        expect(v.notice.body).toBe("Cancele a assinatura antiga para não ser cobrado de novo.");
        expect(v.date).toBe("Oferta até 12 de outubro.");
    });

    test("texto só do Remote Config (título do desconto) não mistura línguas", () => {
        const remoteTexts = {en: {"offers.discount_50.title": "Special offer"}};
        expect(view("expired", ["discount"], {remoteTexts}).primary.card!.title).toBeNull();
        const turkish = view("expired", ["discount"], {remoteTexts, language: "tr"});
        expect(turkish.lang).toBe("en");
        expect(turkish.primary.card!.title).toBe("Special offer");
        expect(turkish.header).toBe("We miss you");
    });

    test("variável sem valor vira vazio (sem espaço duplo); variável desconhecida fica", () => {
        const values = {app: "X", price: "", original_price: "", discount: "", per: "", period: "", date: "", code: ""};
        expect(fillRetentionText("Use o {app} por {price} {period} agora", values)).toBe("Use o X por agora");
        expect(fillRetentionText("{foo} e {app}", values)).toBe("{foo} e X");
    });
});

describe("compatibilidade: trial cancelado + resubscribe = textos da fase 1", () => {
    const REMOTES: Array<Record<string, any> | undefined> = [
        undefined,
        {pt: {header: "Volte para o {app}!", cta: "Quero voltar"}, en: {header: "Come back", body: "English body"}},
        {en: {header: "Come back to {app}", bullets: ["No ads"]}},
        {tr: {header: "Ücretsiz denemen iptal edildi"}},
        {"PT-br": {header: "pt do Brasil", bullets: ["Sem anúncios no {app}"]}, pt: {header: "pt genérico"}},
    ];

    test("mesmo título, texto, bullets, botões, estado e data em toda língua, variante e Remote Config", () => {
        let compared = 0;
        for (const language of [...LANGUAGES, "pt-BR", "en-GB", "tr", "he"]) {
            for (const variant of VARIANTS) {
                for (const defaultBullets of [false, true]) {
                    for (const remoteTexts of REMOTES) {
                        const options = {language, variant, appName: APP, remoteTexts, defaultBullets, expirationDate: END, dateLocale: language};
                        const old = resolveRetentionTexts(options);
                        const v = buildRetentionView({...options, segment: "trial_cancelled", offers: [{name: "resubscribe", type: "resubscribe"}], deviceLocale: language});
                        expect({lang: v.lang, rtl: v.rtl, header: v.header, body: v.body, bullets: v.bullets, cta: v.primary.cta, dismiss: v.dismiss, confirm: v.checking.confirm, checking: v.checking.hint, notYet: v.checking.notYet, trialEnds: v.date}).toEqual({
                            lang: old.lang,
                            rtl: old.rtl,
                            header: old.header,
                            body: old.body,
                            bullets: old.bullets,
                            cta: old.cta,
                            dismiss: old.dismiss,
                            confirm: old.confirm,
                            checking: old.checking,
                            notYet: old.notYet,
                            trialEnds: old.trialEnds,
                        });
                        expect(v.primary.card).toBeNull();
                        expect(v.secondary).toBeNull();
                        compared++;
                    }
                }
            }
        }
        expect(compared).toBe(16 * 2 * 2 * REMOTES.length);
    });

    test("pedido sem ofertas = resubscribe", () => {
        const v = buildRetentionView({variant: "premium_kept", language: "pt", appName: "X"});
        expect([v.segment, v.primary.offer.type, v.primary.cta, v.secondary]).toEqual(["trial_cancelled", "resubscribe", "Reativar", null]);
    });
});

describe("preço, desconto e período", () => {
    test("Intl.NumberFormat na língua; o texto da loja vence; moeda inválida não lança", () => {
        expect(plain(formatRetentionPrice({amount: 19.9, currency: "BRL"}, "pt"))).toBe("R$ 19,90");
        expect(formatRetentionPrice({amount: 4.99, currency: "USD"}, "en")).toBe("$4.99");
        expect(plain(formatRetentionPrice({amount: 4.99, currency: "usd"}, "de"))).toBe("4,99 $");
        expect(formatRetentionPrice({amount: 4.99, currency: "USD", formatted: "US$ 4,99 (loja)"}, "pt")).toBe("US$ 4,99 (loja)");
        expect(formatRetentionPrice({amount: 4.99, currency: "USD"}, "!!")).toBe("$4.99");
        expect(formatRetentionPrice({amount: 19.9, currency: "INVALIDA"}, "pt")).toBe("INVALIDA 19.90");
        expect(formatRetentionPrice(undefined, "pt")).toBeNull();
        expect(formatRetentionPrice({amount: Number.NaN, currency: "BRL"}, "pt")).toBeNull();
    });

    test("percentual do selo", () => {
        expect(formatRetentionPercent(50, "pt")).toBe("50%");
        expect(plain(formatRetentionPercent(50, "fr"))).toBe("50 %");
        const brl = (amount: number) => ({amount, currency: "BRL"});
        const usd = (amount: number) => ({amount, currency: "USD"});
        expect(retentionDiscountPercent(brl(9.9), brl(19.9))).toBe(50);
        expect(retentionDiscountPercent(brl(59.9), brl(99.9))).toBe(40);
        expect(retentionDiscountPercent(usd(2.49), usd(4.99))).toBe(50);
        expect(retentionDiscountPercent(usd(14.99), usd(24.99))).toBe(40);
        expect(retentionDiscountPercent(brl(19.9), brl(19.9))).toBeNull();
        expect(retentionDiscountPercent(brl(29.9), brl(19.9))).toBeNull();
        expect(retentionDiscountPercent(brl(9.9), usd(19.9))).toBeNull();
        expect(retentionDiscountPercent(brl(99.6), brl(100))).toBeNull();
        expect(retentionDiscountPercent(undefined, brl(19.9))).toBeNull();
    });

    test("categorias de plural (CLDR) das línguas da lib", () => {
        const cases: Array<[string, number, string]> = [
            ["en", 1, "one"], ["en", 3, "other"], ["pt", 0, "one"], ["pt", 1, "one"], ["pt", 2, "other"], ["fr", 1, "one"], ["fr", 2, "other"],
            ["ja", 1, "other"], ["ko", 3, "other"], ["zh", 12, "other"],
            ["ru", 1, "one"], ["ru", 2, "few"], ["ru", 4, "few"], ["ru", 5, "many"], ["ru", 11, "many"], ["ru", 12, "many"], ["ru", 21, "one"], ["ru", 22, "few"],
            ["ar", 0, "zero"], ["ar", 1, "one"], ["ar", 2, "two"], ["ar", 3, "few"], ["ar", 10, "few"], ["ar", 11, "many"], ["ar", 99, "many"], ["ar", 100, "other"],
        ];
        for (const [lang, n, category] of cases) expect(retentionPluralCategory(lang, n), `${lang} ${n}`).toBe(category);
    });

    test("duração do desconto e sufixo do preço", () => {
        const first = (lang: string, n: number, unit: "day" | "week" | "month" | "year" = "month") => pickRetentionPlural(translations[lang].retention.units.first[unit], lang, n, lang);
        const per = (lang: string, n: number, unit: "day" | "week" | "month" | "year" = "month") => pickRetentionPlural(translations[lang].retention.units.per[unit], lang, n, lang);
        expect(first("pt", 1)).toBe("no primeiro mês");
        expect(first("pt", 3)).toBe("nos 3 primeiros meses");
        expect(first("pt", 2, "week")).toBe("nas 2 primeiras semanas");
        expect(first("en", 3)).toBe("for the first 3 months");
        expect(first("ru", 1)).toBe("в первый месяц");
        expect(first("ru", 3)).toBe("в первые 3 месяца");
        expect(first("ru", 6)).toBe("в первые 6 месяцев");
        expect(first("ar", 2)).toBe("خلال الشهرين الأولين");
        expect(first("ar", 3)).toMatch(/^خلال أول (3|٣) أشهر$/);
        expect(first("ar", 12)).toMatch(/^خلال أول (12|١٢) شهرًا$/);
        expect(first("ja", 3)).toBe("最初の3か月間");
        expect(per("pt", 1)).toBe("/mês");
        expect(per("pt", 3)).toBe("/3 meses");
        expect(per("en", 1, "year")).toBe("/year");
        expect(per("ja", 1)).toBe("/月");
    });
});

describe("oferta: nome ou objeto do Remote Config", () => {
    test("ordem: Remote Config → embutida → catálogo de exemplo → o próprio tipo", () => {
        const remote = {resubscribe: {type: "lifetime" as const}, meu_desconto: {type: "discount" as const, ios_offer_id: "x"}};
        expect(resolveRetentionOfferInput("meu_desconto", remote)).toEqual({name: "meu_desconto", config: {type: "discount", ios_offer_id: "x"}});
        expect(resolveRetentionOfferInput("resubscribe", remote)?.config.type).toBe("lifetime");
        expect(resolveRetentionOfferInput("winback", remote)).toEqual({name: "winback", config: {type: "winback"}});
        expect(resolveRetentionOfferInput("lifetime_deal")).toEqual({name: "lifetime_deal", config: RETENTION_PREVIEW_OFFERS.lifetime_deal});
        expect(resolveRetentionOfferInput(" subscription ")).toEqual({name: "subscription", config: {type: "subscription"}});
        expect(resolveRetentionOfferInput("nao_existe")).toBeNull();
        expect(resolveRetentionOfferInput("")).toBeNull();
        expect(resolveRetentionOfferInput("ruim", {ruim: {type: "bogus" as any}})).toBeNull();
    });

    test("objeto: tipo obrigatório; nome padrão é o tipo", () => {
        expect(resolveRetentionOfferInput({type: "lifetime", product_id: "v"})).toEqual({name: "lifetime", config: {type: "lifetime", product_id: "v"}});
        expect(resolveRetentionOfferInput({name: "vitalicio", type: "lifetime"})).toEqual({name: "vitalicio", config: {type: "lifetime"}});
        expect(resolveRetentionOfferInput({type: "nada"} as any)).toBeNull();
        expect(resolveRetentionOfferInput(null as any)).toBeNull();
    });

    test("moeda falsa da pré-visualização: BRL só em português", () => {
        expect(retentionPreviewCurrency("pt-BR")).toBe("BRL");
        expect(retentionPreviewCurrency("pt_PT")).toBe("BRL");
        for (const lang of LANGUAGES.filter((lang) => lang !== "pt")) expect(retentionPreviewCurrency(lang)).toBe("USD");
        expect(retentionPreviewCurrency(undefined)).toBe("USD");
    });
});
