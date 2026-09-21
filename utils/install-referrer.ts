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
//   - Anúncio da META (Facebook/Instagram): vem no referrer, CIFRADO. O `utm_content` é um JSON
//     `{"source": {"data": "<hex>", "nonce": "<hex>"}, "a": <app id>, "t": <timestamp>}`; `data` abre
//     com AES-256-GCM e a "Install Referrer Decryption Key" do app (Meta for Developers → App
//     settings → Basic → Android). Dentro: campaign_group_name / campaign_name / adgroup_name /
//     ad_id / is_instagram / publisher_platform / platform_position. Sem a chave só dá para marcar
//     "Meta Ads" — a Meta avisa que `utm_source` (apps.facebook.com | apps.instagram.com) NÃO é
//     garantido, então ele entra só como dica. Só cobre clique + install na mesma sessão
//     (view-through e install dias depois não passam pelo referrer da Play).
//   - TikTok: não passa referrer utilizável — sem MMP não há atribuição determinística.
//   - Instalação sem link (busca na loja, sideload): `utm_source=google-play&utm_medium=organic`.

import {aes256GcmDecrypt} from "./aes-gcm";

export type InstallAttribution = {
    /** atributos RESERVADOS do RevenueCat ($mediaSource, $campaign, $adGroup, $ad, $keyword, $creative) */
    reserved: Record<string, string>;
    /** atributos custom: install_referrer (cru), install_medium, gclid */
    custom: Record<string, string>;
    organic: boolean;
    /** só em install de anúncio da Meta: a metadata foi aberta, ficou cifrada (sem chave) ou a chave não serviu */
    meta?: "decrypted" | "encrypted" | "decrypt_failed";
};

export type InstallReferrerOptions = {
    /** "Install Referrer Decryption Key" do app na Meta (hex de 64 chars). Sem ela a campanha fica cifrada. */
    metaKey?: string;
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

const RC_VALUE_MAX = 500;

// Anúncio da Meta: devolve a atribuição pronta, ou null se o referrer não for da Meta.
function mapMetaReferrer(raw: string, p: Record<string, string>, options: InstallReferrerOptions): InstallAttribution | null {
    let source: any;
    try {
        source = JSON.parse(p.utm_content || "null")?.source;
    } catch {}
    const data = typeof source?.data === "string" ? source.data : "";
    const nonce = typeof source?.nonce === "string" ? source.nonce : "";
    if (!data || !nonce) return null;

    const reserved: Record<string, string> = {};
    const custom: Record<string, string> = {install_referrer: raw.slice(0, RC_VALUE_MAX)};
    const set = (target: Record<string, string>, key: string, value: unknown) => {
        const text = clean(value === undefined || value === null ? undefined : String(value));
        if (text) target[key] = text;
    };

    let payload: any = null;
    const key = String(options.metaKey ?? "").trim();
    if (key) {
        try {
            payload = JSON.parse(aes256GcmDecrypt(key, nonce, data) || "null");
        } catch {}
    }

    if (payload && typeof payload === "object") {
        const platform = String(payload.publisher_platform ?? "").toLowerCase();
        reserved.$mediaSource =
            payload.is_instagram === true || platform === "instagram" ? "Instagram Ads"
            : platform === "audience_network" ? "Meta Audience Network"
            : platform === "messenger" ? "Messenger Ads"
            : "Facebook Ads";
        // A Meta usa a nomenclatura LEGADA da Marketing API: campaign_group = campanha,
        // campaign = conjunto de anúncios, adgroup = anúncio. Payloads novos vêm sem o
        // campaign_group — aí campaign = campanha, adgroup = conjunto, ad_id = anúncio.
        // Os nomes crus também vão em meta_* para nada se perder se a Meta mudar de novo.
        if (payload.campaign_group_name || payload.campaign_group_id) {
            set(reserved, "$campaign", payload.campaign_group_name ?? payload.campaign_group_id);
            set(reserved, "$adGroup", payload.campaign_name ?? payload.campaign_id);
            set(reserved, "$ad", payload.adgroup_name ?? payload.adgroup_id ?? payload.ad_id);
        } else {
            set(reserved, "$campaign", payload.campaign_name ?? payload.campaign_id);
            set(reserved, "$adGroup", payload.adgroup_name ?? payload.adgroup_id);
            set(reserved, "$ad", payload.ad_id);
        }
        set(custom, "meta_campaign_group_name", payload.campaign_group_name);
        set(custom, "meta_campaign_name", payload.campaign_name);
        set(custom, "meta_adgroup_name", payload.adgroup_name);
        set(custom, "meta_ad_id", payload.ad_id);
        set(custom, "meta_account_id", payload.account_id);
        set(custom, "meta_objective", payload.ad_objective_name);
        set(custom, "meta_placement", [payload.publisher_platform, payload.platform_position].filter(Boolean).join(":"));
        return {reserved, custom, organic: false, meta: "decrypted"};
    }

    // Sem chave (ou chave que não abre): marca a rede e GUARDA o dado cifrado em pedaços de até
    // 500 chars (teto de valor do RevenueCat) para decriptar depois, fora do app.
    const hint = String(p.utm_source ?? "").toLowerCase();
    reserved.$mediaSource = hint.includes("instagram") ? "Instagram Ads" : hint.includes("facebook") ? "Facebook Ads" : "Meta Ads";
    custom.meta_ref_nonce = nonce.slice(0, RC_VALUE_MAX);
    for (let i = 0; i < 4 && i * RC_VALUE_MAX < data.length; i++) custom[`meta_ref_data_${i + 1}`] = data.slice(i * RC_VALUE_MAX, (i + 1) * RC_VALUE_MAX);
    return {reserved, custom, organic: false, meta: key ? "decrypt_failed" : "encrypted"};
}

export const mapInstallReferrer = (referrer: string | null | undefined, options: InstallReferrerOptions = {}): InstallAttribution | null => {
    const raw = String(referrer ?? "").trim();
    if (!raw) return null;
    const p = parseReferrer(raw);
    const meta = mapMetaReferrer(raw, p, options);
    if (meta) return meta;
    const pick = (...keys: string[]) => keys.map((key) => clean(p[key])).find(Boolean);

    const medium = pick("utm_medium");
    const clickId = pick("gclid", "gbraid", "wbraid");
    let source = pick("utm_source");
    const organic = !clickId && (medium === "organic" || (!source && !pick("utm_campaign")));
    if (clickId && (!source || /^google(-play)?$/i.test(source))) source = "Google Ads";
    // Install orgânico NÃO grava $mediaSource. Medido no dashboard do RevenueCat (21/09/2026), com
    // um atributo-controle na mesma chamada: os campos de atribuição ($mediaSource, $campaign) são
    // "primeira gravação vence" — regravar pelo SDK não substitui o valor. Um "Organic" escrito no
    // boot impedia qualquer fonte melhor que chegasse depois (match do link-in-bio, Apple Search
    // Ads, MMP). O orgânico fica marcado só no atributo custom `install_medium`.
    else if (organic) source = undefined;

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
