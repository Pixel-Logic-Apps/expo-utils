import AsyncStorage from "@react-native-async-storage/async-storage";

// País / estado / cidade por IP — sem GPS, sem permissão, sem chave e sem custo.
//
// Só o IP responde "estado" e "cidade": o aparelho sabe a região CONFIGURADA
// (expo-localization) e a loja sabe o país da CONTA (Purchases.getStorefront), mas nenhum dos
// dois diz onde a pessoa está. No GA4 isso já é automático (o Firebase deriva geo do IP em todo
// evento); este módulo existe para o dado chegar no customer do RevenueCat.
//
// LIGADO por padrão. Desliga sem build novo pelo Remote Config (`geo_lookup_enabled: false`)
// ou no app.json (["expo-utils", {"geoAttributes": false}]). Atenção de loja: cidade/estado
// gravados contra o ID do customer contam como "Coarse Location" no rótulo de privacidade da
// App Store e "Approximate location" no Data Safety do Google Play.
//
// PROVEDORES — mesma lição do PLAY_READERS do gerador de promo: serviço grátis morre ou passa a
// limitar, então é uma CADEIA com fallback, nunca um só. Os três abaixo foram testados ao vivo
// e tiveram os termos lidos em 2026-09-20:
//   ipwho.is       grátis, sem chave, HTTPS, "Commercial use allowed", 1.000 req/dia por IP de
//                  cliente, sem SLA. Único que traz o CÓDIGO do estado (region_code).
//   BigDataCloud   endpoint client-side: "free to use, and requires no API key"; o fair use exige
//                  que a chamada saia do cliente (browser ou APP) — é o nosso caso; chamada
//                  server-side leva ban temporário (HTTP 402). Sem lat/long cai em geo por IP.
//   GeoJS          "No rate limits (yet)", só HTTPS, termos sem restrição a uso comercial.
// Descartados no mesmo teste: ipapi.co (403, desafio do Cloudflare para cliente não-browser),
// ip-api.com (plano grátis só HTTP — o ATS do iOS bloqueia — e só não-comercial), db-ip free
// (limite diário por IP já estourado), ipinfo.io sem token (eles pedem autenticação).
// Se um morrer: troque a entrada e teste com `curl` — aqui `curl` PROVA (o fetch do RN não
// aplica CORS, ao contrário do gerador de promo, que roda em browser).
//
// Cada aparelho chama no máximo 1x por semana (cache), então o limite por IP só pesa em CGNAT
// de operadora grande — e aí a cadeia cai no provedor seguinte.
// Precisão realista de geo por IP: país ~99%, estado ~80–90%, cidade 50–80% (operadora móvel
// costuma cair na cidade do hub). Serve para agregados, não para afirmar onde UM usuário está.

export type GeoResult = {
    country?: string; // ISO 3166-1 alpha-2
    state?: string;
    stateCode?: string;
    city?: string;
    source: string;
};

type GeoFields = Omit<GeoResult, "source">;
type GeoProvider = {name: string; url: string; parse: (json: any) => GeoFields | null};

const CACHE_KEY = "@expo_utils_geo";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 3000;

const text = (value: unknown): string | undefined => {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const trimmed = String(value).trim();
    return trimmed ? trimmed.slice(0, 100) : undefined;
};

// "BR-PA" (ISO 3166-2) → "PA"
const stateCodeOf = (value: unknown): string | undefined => text(value)?.split("-").pop();

export const GEO_PROVIDERS: GeoProvider[] = [
    {
        name: "ipwho.is",
        url: "https://ipwho.is/?fields=success,message,country_code,region,region_code,city",
        parse: (json) => (json?.success === false ? null : {country: text(json?.country_code), state: text(json?.region), stateCode: text(json?.region_code), city: text(json?.city)}),
    },
    {
        name: "bigdatacloud",
        url: "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en",
        parse: (json) => ({
            country: text(json?.countryCode),
            state: text(json?.principalSubdivision),
            stateCode: stateCodeOf(json?.principalSubdivisionCode),
            city: text(json?.city) ?? text(json?.locality),
        }),
    },
    {
        name: "geojs",
        url: "https://get.geojs.io/v1/ip/geo.json",
        parse: (json) => ({country: text(json?.country_code), state: text(json?.region), city: text(json?.city)}),
    },
];

// Endpoint próprio (Remote Config `geo_lookup_url`), ex.: Cloudflare Worker devolvendo request.cf.
// Contrato: {country, region, regionCode, city}; o parser tolera as grafias mais comuns.
const parseCustom = (json: any): GeoFields => ({
    country: text(json?.country ?? json?.countryCode ?? json?.country_code),
    state: text(json?.region ?? json?.state ?? json?.regionName ?? json?.region_name),
    stateCode: stateCodeOf(json?.regionCode ?? json?.region_code ?? json?.stateCode),
    city: text(json?.city),
});

const fetchJson = async (url: string): Promise<any> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
        const response = await fetch(url, {signal: controller.signal, headers: {Accept: "application/json"}});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

// País é o mínimo para o resultado valer; vem normalizado em alpha-2 maiúsculo.
const normalize = (fields: GeoFields | null, source: string): GeoResult | null => {
    const country = fields?.country?.toUpperCase();
    if (!country || !/^[A-Z]{2}$/.test(country)) return null;
    return {country, state: fields?.state, stateCode: fields?.stateCode?.toUpperCase(), city: fields?.city, source};
};

export const isGeoLookupEnabled = (): boolean => {
    const globals = global as any;
    return globals.expoUtilsGeoDisabled !== true && globals.remoteConfigUtils?.geo_lookup_enabled !== false;
};

let geoPromise: Promise<GeoResult | null> | null = null;

/**
 * Geo por IP com cache de 7 dias. Nunca lança; resolve null quando desligado ou quando toda a
 * cadeia falhou (nesse caso NÃO memoiza, para tentar de novo na próxima chamada).
 */
export const lookupGeo = (): Promise<GeoResult | null> => {
    if (geoPromise) return geoPromise;
    const attempt = (async (): Promise<GeoResult | null> => {
        try {
            if (!isGeoLookupEnabled()) return null;

            try {
                const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || "null");
                if (cached?.geo?.country && Date.now() - Number(cached.at) < CACHE_TTL_MS) return cached.geo as GeoResult;
            } catch {}

            const customUrl = text((global as any).remoteConfigUtils?.geo_lookup_url);
            const providers: GeoProvider[] = [
                ...(customUrl && /^https:\/\//i.test(customUrl) ? [{name: "custom", url: customUrl, parse: parseCustom}] : []),
                ...GEO_PROVIDERS,
            ];
            for (const provider of providers) {
                try {
                    const geo = normalize(provider.parse(await fetchJson(provider.url)), provider.name);
                    if (!geo) continue;
                    try {
                        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({at: Date.now(), geo}));
                    } catch {}
                    return geo;
                } catch {}
            }
            return null;
        } catch {
            return null;
        }
    })();
    geoPromise = attempt;
    attempt.then((geo) => {
        if (!geo) geoPromise = null;
    });
    return attempt;
};

/** Atributos custom do RevenueCat a partir do resultado (só o que veio preenchido). */
export const toGeoAttributes = (geo: GeoResult): Record<string, string> => {
    const attributes: Record<string, string> = {};
    if (geo.country) attributes.geo_country = geo.country;
    if (geo.state) attributes.geo_state = geo.state;
    if (geo.stateCode) attributes.geo_state_code = geo.stateCode;
    if (geo.city) attributes.geo_city = geo.city;
    attributes.geo_source = geo.source;
    return attributes;
};
