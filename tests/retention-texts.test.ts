import {describe, expect, mock, test} from "bun:test";

// O i18n importa NativeModules do react-native (não instalado neste repo).
mock.module("react-native", () => ({NativeModules: {}}));

const {translations} = await import("../utils/i18n");
const {RETENTION_LIMITS, formatRetentionDate, isRtlLanguage, playSubscriptionsUrl, resolveRetentionTexts, retentionVariantFromConfig} = await import("../utils/retention-texts");

const LANGUAGES = ["pt", "en", "es", "fr", "de", "it", "ja", "ko", "zh", "ru", "ar", "nl"];
const VARIANTS = ["premium_lost", "premium_kept"] as const;
/** Nome realista com 20 caracteres no lugar do `{app}`. */
const APP = "Consulta Placa Fácil";
/** Caracteres como a pessoa vê (pontos de código, não unidades UTF-16). */
const length = (value: string) => [...value].length;
/** Meio-dia local: a data cai no dia 12 em qualquer fuso de quem roda o teste. */
const TRIAL_END = new Date(2026, 9, 12, 12, 0, 0);

describe("textos nas 12 línguas", () => {
    test("o nome de teste tem 20 caracteres", () => {
        expect(length(APP)).toBe(20);
    });

    test("toda língua da lib tem todos os campos, 3 bullets e o {date}", () => {
        expect(Object.keys(translations).sort()).toEqual([...LANGUAGES].sort());
        // Os grupos dos outros segmentos e das ofertas são conferidos em tests/retention-offers.test.ts.
        const NESTED = new Set(["segments", "ctas", "cards", "notice", "units"]);
        for (const lang of LANGUAGES) {
            const retention = translations[lang].retention;
            for (const [key, value] of Object.entries(retention)) {
                if (key === "bullets" || NESTED.has(key)) continue;
                expect(typeof value === "string" && value.trim().length > 0, `${lang}.${key}`).toBe(true);
            }
            expect(retention.bullets.length, `${lang}.bullets`).toBe(3);
            expect(retention.trialEnds, `${lang}.trialEnds`).toContain("{date}");
            expect(retention.lostBody === retention.keptBody, `${lang}: as duas variantes têm o mesmo texto`).toBe(false);
        }
    });

    for (const lang of LANGUAGES) {
        for (const variant of VARIANTS) {
            test(`${lang} · ${variant}: título ≤ 66, texto ≤ 144, bullets ≤ 66 (limites da Apple)`, () => {
                const texts = resolveRetentionTexts({language: lang, variant, appName: APP, defaultBullets: true});
                expect(texts.lang).toBe(lang);
                expect(length(texts.header), texts.header).toBeLessThanOrEqual(RETENTION_LIMITS.header);
                expect(length(texts.body), texts.body).toBeLessThanOrEqual(RETENTION_LIMITS.body);
                expect(texts.bullets.length).toBe(3);
                for (const bullet of texts.bullets) expect(length(bullet), bullet).toBeLessThanOrEqual(RETENTION_LIMITS.bullet);
                for (const value of [texts.header, texts.body, texts.cta, texts.dismiss, ...texts.bullets]) expect(value).not.toContain("{app}");
            });
        }
    }

    test("o {app} vira o nome do app (texto da lib)", () => {
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: "Meu App"}).body).toBe(
            "Os anúncios voltaram. Reative a assinatura para continuar usando o Meu App sem anúncios.",
        );
    });
});

describe("variante", () => {
    test("Remote Config: is_opted_out_trial_enabled true → premium_kept; falso/ausente → premium_lost", () => {
        expect(retentionVariantFromConfig({is_opted_out_trial_enabled: true})).toBe("premium_kept");
        expect(retentionVariantFromConfig({is_opted_out_trial_enabled: false})).toBe("premium_lost");
        expect(retentionVariantFromConfig({})).toBe("premium_lost");
        expect(retentionVariantFromConfig(undefined)).toBe("premium_lost");
    });

    test("cada variante usa o próprio texto", () => {
        const lost = resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP});
        const kept = resolveRetentionTexts({language: "pt", variant: "premium_kept", appName: APP});
        expect(lost.body).toStartWith("Os anúncios voltaram.");
        expect(kept.body).toStartWith("Você ainda tem o Premium até o fim do teste.");
    });
});

describe("ordem do texto: Remote Config na língua → lib na língua → Remote Config en → lib en", () => {
    test("campo do Remote Config vence; o que falta vem da lib na mesma língua", () => {
        const texts = resolveRetentionTexts({
            language: "pt",
            variant: "premium_lost",
            appName: "Meu App",
            remoteTexts: {pt: {header: "Volte para o {app}!", cta: "Quero voltar"}, en: {header: "Come back", body: "English body"}},
        });
        expect(texts.header).toBe("Volte para o Meu App!");
        expect(texts.cta).toBe("Quero voltar");
        expect(texts.body).toBe(translations.pt.retention.lostBody.replace("{app}", "Meu App"));
        expect(texts.dismiss).toBe("Agora não");
        expect(texts.confirm).toBe("Já reativei");
    });

    test("língua ausente do Remote Config usa a lib nessa língua, não o en do Remote Config", () => {
        const texts = resolveRetentionTexts({language: "es", variant: "premium_lost", appName: APP, remoteTexts: {en: {header: "Come back"}}});
        expect(texts.lang).toBe("es");
        expect(texts.header).toBe("Tu prueba gratuita se canceló");
    });

    test("língua que nem a lib nem o Remote Config têm cai no en do Remote Config, depois no en da lib", () => {
        const withRemote = resolveRetentionTexts({language: "tr-TR", variant: "premium_lost", appName: APP, remoteTexts: {en: {header: "Come back to {app}"}}});
        expect(withRemote.lang).toBe("en");
        expect(withRemote.header).toBe(`Come back to ${APP}`);
        expect(withRemote.body).toBe(translations.en.retention.lostBody.replace("{app}", APP));
        const withoutRemote = resolveRetentionTexts({language: "tr", variant: "premium_kept", appName: APP});
        expect(withoutRemote.header).toBe("Your free trial was canceled");
        expect(withoutRemote.cta).toBe("Reactivate");
    });

    test("língua só do Remote Config: campos dela, o resto em en e sem a linha da data", () => {
        const texts = resolveRetentionTexts({
            language: "tr",
            variant: "premium_lost",
            appName: APP,
            remoteTexts: {tr: {header: "Ücretsiz denemen iptal edildi"}},
            expirationDate: TRIAL_END,
        });
        expect(texts.lang).toBe("tr");
        expect(texts.header).toBe("Ücretsiz denemen iptal edildi");
        expect(texts.body).toBe(translations.en.retention.lostBody.replace("{app}", APP));
        expect(texts.trialEnds).toBeNull();
    });

    test("chave do Remote Config: tag exata vence a língua; caixa e _ não importam", () => {
        const remoteTexts = {pt: {header: "pt genérico"}, "PT-br": {header: "pt do Brasil"}};
        expect(resolveRetentionTexts({language: "pt-BR", variant: "premium_lost", appName: APP, remoteTexts}).header).toBe("pt do Brasil");
        expect(resolveRetentionTexts({language: "pt_BR", variant: "premium_lost", appName: APP, remoteTexts}).header).toBe("pt do Brasil");
        expect(resolveRetentionTexts({language: "pt-PT", variant: "premium_lost", appName: APP, remoteTexts}).header).toBe("pt genérico");
        expect(resolveRetentionTexts({language: "pt-BR", variant: "premium_lost", appName: APP, remoteTexts: {PT: {header: "maiúscula"}}}).header).toBe("maiúscula");
    });

    test("valor vazio ou de outro tipo no Remote Config é ignorado", () => {
        const texts = resolveRetentionTexts({
            language: "pt",
            variant: "premium_lost",
            appName: APP,
            remoteTexts: {pt: {header: "   ", body: 42 as any, bullets: ["", 7 as any]}} as any,
        });
        expect(texts.header).toBe("Seu teste grátis foi cancelado");
        expect(texts.body).toStartWith("Os anúncios voltaram.");
        expect(texts.bullets).toEqual([]);
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP, remoteTexts: "lixo" as any}).header).toBe("Seu teste grátis foi cancelado");
    });

    test("bullets: os do Remote Config sempre; os da lib só com defaultBullets; nunca de outra língua", () => {
        const remoteTexts = {pt: {bullets: ["Sem anúncios no {app}"]}, en: {bullets: ["No ads"]}};
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: "X", remoteTexts}).bullets).toEqual(["Sem anúncios no X"]);
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP}).bullets).toEqual([]);
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP, defaultBullets: true}).bullets).toEqual(translations.pt.retention.bullets);
        // es sem bullets no Remote Config: não pega os do en
        expect(resolveRetentionTexts({language: "es", variant: "premium_lost", appName: APP, remoteTexts}).bullets).toEqual([]);
        expect(resolveRetentionTexts({language: "es", variant: "premium_lost", appName: APP, remoteTexts, defaultBullets: true}).bullets).toEqual(translations.es.retention.bullets);
        // a língua inteira caiu no en: aí os bullets do en valem
        expect(resolveRetentionTexts({language: "tr", variant: "premium_lost", appName: APP, remoteTexts}).bullets).toEqual(["No ads"]);
    });
});

describe("direita para a esquerda", () => {
    test("árabe é RTL; as outras 11 não", () => {
        for (const lang of LANGUAGES) {
            expect(resolveRetentionTexts({language: lang, variant: "premium_lost", appName: APP}).rtl, lang).toBe(lang === "ar");
        }
        expect(resolveRetentionTexts({language: "ar-SA", variant: "premium_lost", appName: APP}).rtl).toBe(true);
        expect(isRtlLanguage("he-IL")).toBe(true);
        expect(isRtlLanguage("fa")).toBe(true);
        expect(isRtlLanguage("pt-BR")).toBe(false);
        expect(isRtlLanguage(undefined)).toBe(false);
    });

    test("hebraico sem texto cai no inglês e o modal fica da esquerda para a direita", () => {
        const texts = resolveRetentionTexts({language: "he", variant: "premium_lost", appName: APP});
        expect(texts.lang).toBe("en");
        expect(texts.rtl).toBe(false);
    });
});

describe("linha da data (Intl.DateTimeFormat, sem plural de dias)", () => {
    const EXPECTED: Record<string, string | RegExp> = {
        pt: "Seu teste vai até 12 de outubro.",
        en: "Your trial lasts until October 12.",
        es: "Tu prueba dura hasta el 12 de octubre.",
        fr: "Votre essai dure jusqu'au 12 octobre.",
        de: "Deine Testphase läuft bis zum 12. Oktober.",
        it: "La tua prova dura fino al 12 ottobre.",
        ja: "トライアルは10月12日までです。",
        ko: "체험 기간은 10월 12일까지입니다.",
        zh: "你的试用将于10月12日结束。",
        ru: "Пробный период действует до 12 октября.",
        // ICU do bun usa algarismos latinos; o Hermes pode usar os arábicos (١٢).
        ar: /^تستمر الفترة التجريبية حتى (12|١٢) أكتوبر\.$/,
        nl: "Je proefperiode loopt tot 12 oktober.",
    };

    for (const lang of LANGUAGES) {
        test(lang, () => {
            const line = resolveRetentionTexts({language: lang, variant: "premium_kept", appName: APP, expirationDate: TRIAL_END}).trialEnds;
            const expected = EXPECTED[lang];
            if (expected instanceof RegExp) expect(line ?? "").toMatch(expected);
            else expect(line).toBe(expected);
        });
    }

    test("a tag do aparelho só vale na mesma língua do texto", () => {
        const british = resolveRetentionTexts({language: "en-GB", variant: "premium_lost", appName: APP, expirationDate: TRIAL_END, dateLocale: "en-GB"});
        expect(british.trialEnds).toBe("Your trial lasts until 12 October.");
        // aparelho em turco: o texto caiu no inglês, então a data também sai em inglês
        const turkish = resolveRetentionTexts({language: "tr-TR", variant: "premium_lost", appName: APP, expirationDate: TRIAL_END, dateLocale: "tr-TR"});
        expect(turkish.trialEnds).toBe("Your trial lasts until October 12.");
    });

    test("aceita ISO e milissegundos; sem data ou data inválida não tem linha", () => {
        const iso = TRIAL_END.toISOString();
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP, expirationDate: iso}).trialEnds).toBe("Seu teste vai até 12 de outubro.");
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP, expirationDate: TRIAL_END.getTime()}).trialEnds).toBe("Seu teste vai até 12 de outubro.");
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP}).trialEnds).toBeNull();
        expect(resolveRetentionTexts({language: "pt", variant: "premium_lost", appName: APP, expirationDate: "não é data"}).trialEnds).toBeNull();
    });

    test("tag com _ ou inválida não lança", () => {
        expect(formatRetentionDate(TRIAL_END, "pt_BR")).toBe("12 de outubro");
        expect(formatRetentionDate(TRIAL_END, "!!")).toBe("October 12");
        expect(formatRetentionDate(null, "pt")).toBeNull();
    });
});

describe("página de assinaturas do Play (reserva sem managementURL)", () => {
    test("sku é o id da assinatura, sem o base plan", () => {
        expect(playSubscriptionsUrl("com.pixellogic.app", "premium:mensal")).toBe(
            "https://play.google.com/store/account/subscriptions?package=com.pixellogic.app&sku=premium",
        );
        expect(playSubscriptionsUrl("com.pixellogic.app", "premium_anual")).toBe(
            "https://play.google.com/store/account/subscriptions?package=com.pixellogic.app&sku=premium_anual",
        );
    });

    test("sem produto vai só o pacote; sem pacote, a lista geral", () => {
        expect(playSubscriptionsUrl("com.pixellogic.app", null)).toBe("https://play.google.com/store/account/subscriptions?package=com.pixellogic.app");
        expect(playSubscriptionsUrl(null, "premium:mensal")).toBe("https://play.google.com/store/account/subscriptions");
    });
});
