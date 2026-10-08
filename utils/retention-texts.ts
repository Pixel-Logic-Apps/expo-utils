// Textos do modal de retenção do trial cancelado: resolução pura (sem UI e sem módulo nativo),
// testada em `tests/retention-texts.test.ts`. Plano: docs/PLANO-RETENCAO-TRIAL-CANCELADO.md, seções 6 a 8.
// Os outros segmentos e as ofertas (PLANO-RETENCAO-OFERTAS.md) montam a tela em `utils/retention-view.ts`,
// com a mesma ordem de textos e os helpers daqui.
//
// Ordem de cada campo: Remote Config `retention.texts[língua]` → texto da lib na língua →
// Remote Config `texts.en` → texto da lib em inglês. Os bullets nunca misturam línguas: só vêm
// da própria língua (ou do inglês quando a língua inteira caiu no inglês).
import {translations, type RetentionTranslations} from "./i18n";
import type {RetentionTexts} from "./types";

/**
 * - `premium_lost`: o Premium já saiu no cancelamento (padrão da lib, os anúncios voltaram).
 * - `premium_kept`: o Premium vai até o fim do teste (Remote Config `is_opted_out_trial_enabled: true`).
 */
export type RetentionVariant = "premium_lost" | "premium_kept";

/** Limites da Retention Messaging da Apple: o mesmo texto serve para o modal e para a App Store. */
export const RETENTION_LIMITS = {header: 66, body: 144, bullet: 66} as const;

const RTL_LANGUAGES = new Set(["ar", "he", "iw", "fa", "ur", "yi", "ps", "sd", "ug", "dv"]);

/** "pt-BR" / "pt_BR" / "PT" → "pt". Vazio → "". */
export const baseLanguage = (language?: string | null): string =>
    String(language ?? "")
        .trim()
        .replace(/_/g, "-")
        .split("-")[0]
        .toLowerCase();

export const isRtlLanguage = (language?: string | null): boolean => RTL_LANGUAGES.has(baseLanguage(language));

/**
 * Página de assinaturas do Play quando o RevenueCat não trouxe o `managementURL`. O `sku` é o id da
 * assinatura: o RevenueCat entrega `assinatura:basePlan` no Android e o Play só quer a 1ª parte.
 */
export const playSubscriptionsUrl = (packageName?: string | null, productIdentifier?: string | null): string => {
    const params: string[] = [];
    if (packageName) params.push(`package=${encodeURIComponent(packageName)}`);
    const sku = productIdentifier ? productIdentifier.split(":")[0] : "";
    if (packageName && sku) params.push(`sku=${encodeURIComponent(sku)}`);
    return `https://play.google.com/store/account/subscriptions${params.length ? `?${params.join("&")}` : ""}`;
};

/** A variante sai do mesmo switch que decide se quem cancelou o trial perde o Premium na hora. */
export const retentionVariantFromConfig = (config?: {is_opted_out_trial_enabled?: boolean} | null): RetentionVariant =>
    config?.is_opted_out_trial_enabled === true ? "premium_kept" : "premium_lost";

const toDate = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === "") return null;
    const date = value instanceof Date ? value : new Date(value as string | number);
    return Number.isFinite(date.getTime()) ? date : null;
};

/**
 * Dia e mês por extenso no idioma ("12 de outubro", "October 12", "10月12日"). Sem plural de dias:
 * ele muda de língua para língua. Tag inválida cai no inglês; sem `Intl`, na data ISO.
 */
export function formatRetentionDate(value: Date | string | number | null | undefined, locale?: string | null): string | null {
    const date = toDate(value);
    if (!date) return null;
    const options = {day: "numeric", month: "long"} as const;
    try {
        return new Intl.DateTimeFormat(String(locale || "en").replace(/_/g, "-"), options).format(date);
    } catch {
        try {
            return new Intl.DateTimeFormat("en", options).format(date);
        } catch {
            return date.toISOString().slice(0, 10);
        }
    }
}

const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

const list = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return items.length > 0 ? items : undefined;
};

/** Textos do Remote Config para a língua: tag exata ("pt-br"), depois a língua ("pt"). Chaves sem caixa. */
const pickRemote = (remote: Record<string, RetentionTexts> | null | undefined, language: string): RetentionTexts | undefined => {
    if (!remote || typeof remote !== "object") return undefined;
    const tag = String(language).trim().replace(/_/g, "-").toLowerCase();
    const base = baseLanguage(language);
    let byBase: RetentionTexts | undefined;
    for (const [key, value] of Object.entries(remote)) {
        if (!value || typeof value !== "object") continue;
        const normalized = key.trim().replace(/_/g, "-").toLowerCase();
        if (normalized === tag) return value;
        if (!byBase && normalized === base) byBase = value;
    }
    return byBase;
};

export interface ResolvedRetentionTexts {
    /** Língua de onde vieram os textos ("en" quando a língua do aparelho não tem texto nenhum). */
    lang: string;
    /** Direita para a esquerda (árabe…): só o modal muda, o app não. */
    rtl: boolean;
    header: string;
    body: string;
    bullets: string[];
    cta: string;
    dismiss: string;
    confirm: string;
    checking: string;
    notYet: string;
    /** "Seu teste vai até 12 de outubro." — null sem data válida ou sem o texto na língua. */
    trialEnds: string | null;
}

export interface ResolveRetentionTextsOptions {
    /** Língua do texto: "pt", "pt-BR", "ar"… */
    language?: string | null;
    variant: RetentionVariant;
    /** Troca o `{app}`. */
    appName: string;
    /** `retention.texts` do Remote Config. */
    remoteTexts?: Record<string, RetentionTexts> | null;
    /** Sem bullets no Remote Config, usa os da lib (Sem anúncios, Todos os recursos Premium…). */
    defaultBullets?: boolean;
    /** Fim do teste (`expirationDate` do entitlement). */
    expirationDate?: Date | string | number | null;
    /** Tag do aparelho para a data ("pt-BR"); só vale quando é a mesma língua do texto. */
    dateLocale?: string | null;
}

/** @internal Reaproveitados pela tela por segmento/oferta (`utils/retention-view.ts`). */
export {pickRemote as pickRemoteRetentionTexts, text as nonEmptyText, list as nonEmptyList};

/** Textos da fase 1 (trial cancelado + "Reativar"). Para segmento e ofertas: `buildRetentionView`. */
export function resolveRetentionTexts(options: ResolveRetentionTextsOptions): ResolvedRetentionTexts {
    const requested = baseLanguage(options.language) || "en";
    const remoteLang = pickRemote(options.remoteTexts, options.language || requested);
    const libLang: RetentionTranslations | undefined = translations[requested]?.retention;
    const remoteEn = pickRemote(options.remoteTexts, "en");
    const libEn = translations.en.retention;
    const ownLanguage = Boolean(remoteLang || libLang);
    const lang = ownLanguage ? requested : "en";

    const kept = options.variant === "premium_kept";
    const pick = (remoteKey: keyof RetentionTexts | null, libKey: keyof RetentionTranslations): string =>
        (remoteKey ? text(remoteLang?.[remoteKey]) : undefined) ??
        text(libLang?.[libKey]) ??
        (remoteKey ? text(remoteEn?.[remoteKey]) : undefined) ??
        (libEn[libKey] as string);

    const bullets = ownLanguage
        ? list(remoteLang?.bullets) ?? (options.defaultBullets ? libLang?.bullets : undefined) ?? []
        : list(remoteEn?.bullets) ?? (options.defaultBullets ? libEn.bullets : undefined) ?? [];

    const appName = options.appName ?? "";
    const fill = (value: string) => value.replace(/\{app\}/g, appName);

    // A linha da data só sai na língua do texto: língua que só existe no Remote Config fica sem ela.
    const dateTemplate = libLang ? libLang.trialEnds : ownLanguage ? undefined : libEn.trialEnds;
    const dateLocale = options.dateLocale && baseLanguage(options.dateLocale) === lang ? options.dateLocale : lang;
    const date = dateTemplate ? formatRetentionDate(options.expirationDate, dateLocale) : null;

    return {
        lang,
        rtl: isRtlLanguage(lang),
        header: fill(pick("header", kept ? "keptHeader" : "lostHeader")),
        body: fill(pick("body", kept ? "keptBody" : "lostBody")),
        bullets: bullets.map(fill),
        cta: fill(pick("cta", "cta")),
        dismiss: fill(pick("dismiss", "dismiss")),
        confirm: pick(null, "confirm"),
        checking: pick(null, "checking"),
        notYet: pick(null, "notYet"),
        trialEnds: dateTemplate && date ? dateTemplate.replace("{date}", date) : null,
    };
}
