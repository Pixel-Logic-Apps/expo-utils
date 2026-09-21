// Origem do install no ANDROID: Play Install Referrer → atributos reservados de atribuição do
// RevenueCat (Media Source, Campaign, Ad Group, Ad, Keyword, Creative).
//
// O referrer é a query string que a Play Store guarda do link que levou ao install
// (`...details?id=<pacote>&referrer=utm_source%3D...`). Lido por
// `Application.getInstallReferrerAsync()` do expo-application — já é peer dep da lib, não exige
// módulo nativo novo. iOS não tem equivalente: lá a única origem determinística é o Apple
// Search Ads, que o próprio RevenueCat resolve a partir do token do AdServices (fase 1).
//
// O que dá e o que NÃO dá para saber por aqui:
//   - Link próprio com utm_* (link-in-bio, influenciador, e-mail, QR): vem tudo.
//   - Google Ads (campanha de app): o referrer traz só o identificador do clique
//     (`gclid` / `gbraid` / `wbraid`) — nome de campanha, grupo, palavra-chave e criativo NÃO
//     vêm no aparelho; isso só existe via Google Ads ↔ Firebase/GA4 ou via MMP (AppsFlyer,
//     Adjust…). Marcamos `Google Ads` como media source e guardamos o `gclid` para cruzar depois.
//   - Meta / TikTok: não passam referrer utilizável — sem MMP não há atribuição determinística.
//   - Instalação sem link (busca na loja, sideload): `utm_source=google-play&utm_medium=organic`.

export type InstallAttribution = {
    /** atributos RESERVADOS do RevenueCat ($mediaSource, $campaign, $adGroup, $ad, $keyword, $creative) */
    reserved: Record<string, string>;
    /** atributos custom: install_referrer (cru), install_medium, gclid */
    custom: Record<string, string>;
    organic: boolean;
};

const NOT_SET = /^\(?not(%20|\s|_)?set\)?$/i;

const clean = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return !trimmed || NOT_SET.test(trimmed) ? undefined : trimmed.slice(0, 200);
};

/** Query string → mapa. Tolerante a referrer com ou sem url-encoding e a chaves repetidas (vale a 1ª). */
export const parseReferrer = (referrer: string): Record<string, string> => {
    const params: Record<string, string> = {};
    for (const pair of String(referrer ?? "").split("&")) {
        const index = pair.indexOf("=");
        if (index <= 0) continue;
        let key = pair.slice(0, index);
        let value = pair.slice(index + 1);
        try {
            key = decodeURIComponent(key);
            value = decodeURIComponent(value.replace(/\+/g, " "));
        } catch {}
        key = key.trim().toLowerCase();
        if (key && !(key in params)) params[key] = value;
    }
    return params;
};

export const mapInstallReferrer = (referrer: string | null | undefined): InstallAttribution | null => {
    const raw = String(referrer ?? "").trim();
    if (!raw) return null;
    const p = parseReferrer(raw);
    const pick = (...keys: string[]) => keys.map((key) => clean(p[key])).find(Boolean);

    const medium = pick("utm_medium");
    const clickId = pick("gclid", "gbraid", "wbraid");
    let source = pick("utm_source");
    const organic = !clickId && (medium === "organic" || (!source && !pick("utm_campaign")));
    if (clickId && (!source || /^google(-play)?$/i.test(source))) source = "Google Ads";
    else if (organic) source = "Organic";

    const reserved: Record<string, string> = {};
    const set = (key: string, value?: string) => {
        if (value) reserved[key] = value;
    };
    set("$mediaSource", source);
    set("$campaign", pick("utm_campaign", "campaign", "campaignid"));
    set("$adGroup", pick("utm_adgroup", "adgroup", "adgroupid", "adset"));
    set("$ad", pick("utm_ad", "ad", "adid"));
    set("$keyword", pick("utm_term", "keyword"));
    set("$creative", pick("utm_content", "creative"));

    const custom: Record<string, string> = {install_referrer: raw.slice(0, 500)};
    if (medium) custom.install_medium = medium;
    if (clickId) custom.gclid = clickId;

    return {reserved, custom, organic};
};
