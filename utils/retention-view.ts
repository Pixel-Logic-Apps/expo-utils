// Tela do modal de retenção por segmento e ofertas, montada sem UI: títulos, botões, cartões e o aviso
// pós-compra saem daqui, e o modal (`utils/retention-modal.tsx`) só desenha. Testado em
// `tests/retention-offers.test.ts`. Plano: docs/PLANO-RETENCAO-OFERTAS.md (seções 3, 4, 7 e 8).
//
// Ordem de cada texto (a mesma da fase 1): Remote Config `retention.texts[língua]` → lib na língua →
// Remote Config `texts.en` → lib em inglês. Chaves do Remote Config: ver `RetentionTexts` (utils/types.ts).
import {translations, type RetentionTranslations} from "./i18n";
import {
    formatRetentionPercent,
    formatRetentionPrice,
    isRetentionSegment,
    pickRetentionPlural,
    retentionCardKind,
    retentionCtaKey,
    retentionDiscountPercent,
    retentionOfferAction,
    splitRetentionOffers,
    validRetentionPeriod,
    type RetentionCardKind,
    type RetentionCtaKey,
    type RetentionOffer,
    type RetentionOfferAction,
    type RetentionOfferRole,
} from "./retention-offers";
import {baseLanguage, formatRetentionDate, isRtlLanguage, nonEmptyList, nonEmptyText, pickRemoteRetentionTexts, type RetentionVariant} from "./retention-texts";
import type {RetentionSegment, RetentionTexts} from "./types";

/** Cartão de oferta já com os textos. Campo `null`/"" = linha que não aparece. */
export interface RetentionCardView {
    kind: RetentionCardKind;
    /** "Pague uma vez, use para sempre", "Seu plano"… (o desconto não tem título padrão). */
    title: string | null;
    /** Preço que paga agora ("R$ 9,90"). */
    price: string | null;
    /** "/mês" depois do preço ("" no vitalício e no código). */
    per: string;
    /** Preço riscado ("R$ 19,90"). */
    originalPrice: string | null;
    /** Selo verde ("−50%"), só com preço de comparação. */
    badge: string | null;
    /** "nos 3 primeiros meses". */
    period: string | null;
    /** Regra depois do desconto, obrigatória nas lojas ("depois R$ 19,90/mês"). */
    terms: string | null;
    /** `offer_code`: o código, para a pílula em fonte monoespaçada. */
    code: string | null;
    /** `offer_code`: "válido na loja". */
    hint: string | null;
}

export interface RetentionOfferView {
    offer: RetentionOffer;
    role: RetentionOfferRole;
    ctaKey: RetentionCtaKey;
    /** Texto do botão (principal) ou do botão pequeno do cartão (2ª oferta). */
    cta: string;
    action: RetentionOfferAction;
    /** null só na principal de reativar/atualizar pagamento (a 2ª oferta sempre tem cartão). */
    card: RetentionCardView | null;
}

export interface RetentionView {
    segment: RetentionSegment;
    variant: RetentionVariant;
    /** Língua de onde vieram os textos ("en" quando a do aparelho não tem texto nenhum). */
    lang: string;
    /** Tag usada para data e preço ("pt-BR"). */
    locale: string;
    rtl: boolean;
    /** `billing`: cartão de pagamento com alerta (desenhado com Views); `media`: imagem ou ícone do app. */
    illustration: "media" | "billing";
    header: string;
    body: string;
    bullets: string[];
    /** Linha da data ("Seu teste vai até 12 de outubro.") ou null. */
    date: string | null;
    dismiss: string;
    primary: RetentionOfferView;
    /** No máximo UMA oferta além da principal. */
    secondary: RetentionOfferView | null;
    /** Estado depois de reativar/atualizar o pagamento na loja. */
    checking: {hint: string; confirm: string; notYet: string};
    /** Vitalício comprado com falha de pagamento: cancelar a assinatura antiga. */
    notice: {header: string; body: string; cta: string};
}

export interface BuildRetentionViewOptions {
    segment?: RetentionSegment | null;
    variant: RetentionVariant;
    offers?: readonly RetentionOffer[] | null;
    /** Língua do texto: "pt", "pt-BR", "ar"… */
    language?: string | null;
    /** Troca o `{app}`. */
    appName: string;
    /** `retention.texts` do Remote Config. */
    remoteTexts?: Record<string, RetentionTexts> | null;
    /** Sem bullets no Remote Config, usa os da lib. */
    defaultBullets?: boolean;
    /** Fim do teste/período (`trial_cancelled`, `cancelled`). */
    expirationDate?: Date | string | number | null;
    /** Tag do aparelho ("pt-BR") para data e preço; só vale quando é a mesma língua do texto. */
    deviceLocale?: string | null;
}

/** Valores das variáveis `{…}` dos textos. */
export type RetentionTextValues = Record<"app" | "price" | "original_price" | "discount" | "per" | "period" | "date" | "code", string>;

const PLACEHOLDER = /\{(app|price|original_price|discount|per|period|date|code)\}/g;

/** Troca as variáveis conhecidas (sem valor = vazio) e limpa espaço duplicado. `{outra}` fica como está. */
export const fillRetentionText = (template: string, values: RetentionTextValues): string =>
    template
        .replace(PLACEHOLDER, (_, key: keyof RetentionTextValues) => values[key] ?? "")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

type FromLib = (t: RetentionTranslations) => string | undefined;

export function buildRetentionView(options: BuildRetentionViewOptions): RetentionView {
    const segment: RetentionSegment = isRetentionSegment(options.segment) ? options.segment : "trial_cancelled";
    const variant: RetentionVariant = options.variant === "premium_kept" ? "premium_kept" : "premium_lost";
    const kept = variant === "premium_kept";
    const {primary, secondary} = splitRetentionOffers(options.offers);

    const requested = baseLanguage(options.language) || "en";
    const remoteLang = pickRemoteRetentionTexts(options.remoteTexts, options.language || requested);
    const libLang: RetentionTranslations | undefined = translations[requested]?.retention;
    const remoteEn = pickRemoteRetentionTexts(options.remoteTexts, "en");
    const libEn = translations.en.retention;
    const ownLanguage = Boolean(remoteLang || libLang);
    const lang = ownLanguage ? requested : "en";
    /** Tabelas (unidades, plurais) quando a língua só existe no Remote Config: as do inglês. */
    const tables = libLang ?? libEn;
    const locale = options.deviceLocale && baseLanguage(options.deviceLocale) === lang ? options.deviceLocale : lang;

    const remote = (texts: RetentionTexts | undefined, keys: readonly string[]): string | undefined => {
        for (const key of keys) {
            const value = nonEmptyText(texts?.[key]);
            if (value) return value;
        }
        return undefined;
    };
    const remoteList = (texts: RetentionTexts | undefined, keys: readonly string[]): string[] | undefined => {
        for (const key of keys) {
            const value = nonEmptyList(texts?.[key]);
            if (value) return value;
        }
        return undefined;
    };
    const pick = (keys: readonly string[], fromLib: FromLib): string =>
        remote(remoteLang, keys) ?? (libLang ? nonEmptyText(fromLib(libLang)) : undefined) ?? remote(remoteEn, keys) ?? fromLib(libEn) ?? "";
    /** Só o Remote Config tem o texto (ex.: título do cartão de desconto): nunca mistura línguas. */
    const remoteOnly = (keys: readonly string[]): string | undefined => remote(remoteLang, keys) ?? (ownLanguage ? undefined : remote(remoteEn, keys));

    // Linha da data: só na língua do texto (língua que só existe no Remote Config precisa do `<segmento>.date`).
    const dateKeys = [`${segment}.date`];
    const libDate: FromLib | null = segment === "trial_cancelled" ? (t) => t.trialEnds : segment === "cancelled" ? (t) => t.segments.cancelled.date : null;
    const dateTemplate =
        remote(remoteLang, dateKeys) ??
        (libDate && libLang ? libDate(libLang) : undefined) ??
        (ownLanguage ? undefined : remote(remoteEn, dateKeys) ?? (libDate ? libDate(libEn) : undefined));
    const formattedDate = dateTemplate ? formatRetentionDate(options.expirationDate, locale) : null;

    const appName = options.appName ?? "";
    const valuesFor = (offer: RetentionOffer | null): RetentionTextValues => {
        const percent = retentionDiscountPercent(offer?.price, offer?.originalPrice);
        const billing = validRetentionPeriod(offer?.billingPeriod);
        const discountPeriod = validRetentionPeriod(offer?.discountPeriod);
        return {
            app: appName,
            price: formatRetentionPrice(offer?.price, locale) ?? "",
            original_price: formatRetentionPrice(offer?.originalPrice, locale) ?? "",
            discount: percent === null ? "" : formatRetentionPercent(percent, locale),
            per: billing ? pickRetentionPlural(tables.units.per[billing.unit], lang, billing.count, locale) : "",
            period: discountPeriod ? pickRetentionPlural(tables.units.first[discountPeriod.unit], lang, discountPeriod.count, locale) : "",
            code: offer?.code?.trim() ?? "",
            date: formattedDate ?? "",
        };
    };
    const segmentValues = valuesFor(primary);
    const fill = (template: string, values: RetentionTextValues = segmentValues) => fillRetentionText(template, values);

    // Título e texto do segmento. `trial_cancelled` aceita as chaves da fase 1 (`header`, `body`).
    let headerFromLib: FromLib;
    let bodyFromLib: FromLib;
    switch (segment) {
        case "trial_cancelled":
            headerFromLib = (t) => (kept ? t.keptHeader : t.lostHeader);
            bodyFromLib = (t) => (kept ? t.keptBody : t.lostBody);
            break;
        case "cancelled":
            headerFromLib = (t) => (kept ? t.segments.cancelled.keptHeader : t.segments.cancelled.lostHeader);
            bodyFromLib = (t) => (kept ? t.segments.cancelled.keptBody : t.segments.cancelled.lostBody);
            break;
        case "free":
            headerFromLib = (t) => (primary.type === "lifetime" ? t.segments.free.lifetimeHeader : t.segments.free.header);
            bodyFromLib = (t) => t.segments.free.body;
            break;
        default:
            headerFromLib = (t) => t.segments[segment].header;
            bodyFromLib = (t) => t.segments[segment].body;
    }
    const legacy = (key: string) => (segment === "trial_cancelled" ? [key] : []);
    const header = fill(pick([`${segment}.title`, ...legacy("header")], headerFromLib));
    const body = fill(pick([`${segment}.body`, ...legacy("body")], bodyFromLib));

    // Bullets: os do Remote Config sempre; os da lib só com `defaultBullets`; nunca de outra língua.
    // "Cancele quando quiser" não combina com compra única: sai quando a principal é o vitalício.
    const bulletKeys = [`${segment}.bullets`, ...legacy("bullets")];
    const libBullets = (t: RetentionTranslations) => (options.defaultBullets ? (primary.type === "lifetime" ? t.bullets.slice(0, 2) : t.bullets) : undefined);
    const bullets =
        (ownLanguage ? remoteList(remoteLang, bulletKeys) ?? (libLang ? libBullets(libLang) : undefined) : remoteList(remoteEn, bulletKeys) ?? libBullets(libEn)) ?? [];

    const cardView = (offer: RetentionOffer, kind: RetentionCardKind, values: RetentionTextValues): RetentionCardView => {
        const key = (field: string) => [`offers.${offer.name}.${field}`];
        const libTitle: FromLib | null =
            kind === "lifetime"
                ? (t) => t.cards.lifetime
                : kind === "code"
                  ? (t) => t.cards.code
                  : kind === "price"
                    ? (t) => (offer.type === "resubscribe" && segment !== "free" ? t.cards.resubscribe : t.cards.subscription)
                    : null;
        const customTitle = remoteOnly(key("title"));
        const title = libTitle ? fill(pick(key("title"), libTitle), values) : customTitle ? fill(customTitle, values) : null;
        if (kind === "code") {
            return {kind, title, price: null, per: "", originalPrice: null, badge: null, period: null, terms: null, code: values.code || null, hint: fill(pick(key("hint"), (t) => t.cards.codeHint), values)};
        }
        const customPeriod = remoteOnly(key("period"));
        const period = kind === "discount" ? (customPeriod ? fill(customPeriod, values) : values.period) || null : null;
        return {
            kind,
            title,
            price: values.price || null,
            per: kind === "lifetime" ? "" : values.per,
            originalPrice: values.original_price || null,
            badge: values.discount ? fill(pick(key("badge"), (t) => t.cards.badge), values) : null,
            period,
            terms: kind === "discount" && values.original_price ? fill(pick(key("terms"), (t) => t.cards.terms), values) : null,
            code: null,
            hint: null,
        };
    };

    const offerView = (offer: RetentionOffer, role: RetentionOfferRole): RetentionOfferView => {
        const values = valuesFor(offer);
        const ctaKey = retentionCtaKey(offer.type, segment);
        // O `cta` da fase 1 era o "Reativar" do trial cancelado: continua valendo para ele.
        const legacyCta = segment === "trial_cancelled" && offer.type === "resubscribe" ? ["cta"] : [];
        const cta = fill(pick([`offers.${offer.name}.cta`, ...legacyCta], (t) => (ctaKey === "reactivate" ? t.cta : t.ctas[ctaKey])), values);
        const kind = retentionCardKind(offer.type, segment, role);
        return {offer, role, ctaKey, cta, action: retentionOfferAction(offer.type, segment), card: kind ? cardView(offer, kind, values) : null};
    };

    const billing = segment === "billing_issue";
    const lifetimeOffer = [primary, secondary].find((offer) => offer?.type === "lifetime") ?? primary;
    const noticeValues = valuesFor(lifetimeOffer);

    return {
        segment,
        variant,
        lang,
        locale,
        rtl: isRtlLanguage(lang),
        illustration: billing ? "billing" : "media",
        header,
        body,
        bullets: bullets.map((bullet) => fill(bullet)),
        date: dateTemplate && formattedDate ? fill(dateTemplate) : null,
        dismiss: fill(pick(["dismiss"], (t) => t.dismiss)),
        primary: offerView(primary, "primary"),
        secondary: secondary ? offerView(secondary, "secondary") : null,
        checking: billing
            ? {hint: pick([], (t) => t.segments.billing_issue.checking), confirm: pick([], (t) => t.segments.billing_issue.confirm), notYet: pick([], (t) => t.segments.billing_issue.notYet)}
            : {hint: pick([], (t) => t.checking), confirm: pick([], (t) => t.confirm), notYet: pick([], (t) => t.notYet)},
        notice: {
            header: fill(pick(["notice.title"], (t) => t.notice.header), noticeValues),
            body: fill(pick(["notice.body"], (t) => t.notice.body), noticeValues),
            cta: fill(pick(["notice.cta"], (t) => t.notice.cta), noticeValues),
        },
    };
}
