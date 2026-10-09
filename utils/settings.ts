/**
 * Leitura do Remote Config em blocos: o parâmetro `settings` (`{"utils": {...}, "screens": {...}}`) com reserva nos
 * parâmetros `utils` + `screens` de antes. Plano: docs/PLANO-SETTINGS.md.
 *
 * - `settings` com os blocos = formato novo → `source: "settings"`. Ele chega só aos builds a partir da versão da
 *   condição `app.version >= V` que o pldev cria.
 * - Qualquer outra coisa é ignorada e a leitura cai em `utils` + `screens` (`source: "legacy"`): parâmetro ausente,
 *   JSON inválido e o `settings` plano de antes de fevereiro de 2026, que builds antigos ainda recebem pela condição
 *   sem versão — e que um build com a lib nova entregue por hot-updater a um binário abaixo de V também recebe.
 *
 * Módulo-folha (não importa nada): o Utils passa a função que lê o valor de uma chave e os testes chamam direto.
 */

export type RemoteConfigSource = "settings" | "legacy";

export type RemoteConfigBlocks = {
    utils: Record<string, any>;
    screens: Record<string, any>;
    source: RemoteConfigSource;
};

const isPlainObject = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === "object" && !Array.isArray(value);

const parseObject = (raw: unknown): Record<string, any> | null => {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
        const parsed = JSON.parse(raw);
        return isPlainObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

/**
 * Os blocos do parâmetro `settings`, ou null quando ele não está no formato novo. Basta um dos dois blocos (o
 * outro ausente vira `{}`); bloco presente que não é objeto invalida tudo. O `settings` plano antigo não tem
 * nenhum dos dois e volta null.
 */
export const parseSettingsValue = (raw: unknown): {utils: Record<string, any>; screens: Record<string, any>} | null => {
    const parsed = parseObject(raw);
    if (!parsed) return null;
    const {utils, screens} = parsed;
    if (utils === undefined && screens === undefined) return null;
    if (utils !== undefined && !isPlainObject(utils)) return null;
    if (screens !== undefined && !isPlainObject(screens)) return null;
    return {utils: utils ?? {}, screens: screens ?? {}};
};

/** Lê os blocos: `settings` no formato novo ou, sem ele, `utils` + `screens`. Nunca lança. */
export const readRemoteConfigBlocks = (read: (key: string) => unknown): RemoteConfigBlocks => {
    const value = (key: string): unknown => {
        try {
            return read(key);
        } catch {
            return undefined;
        }
    };
    const settings = parseSettingsValue(value("settings"));
    if (settings) return {...settings, source: "settings"};
    return {utils: parseObject(value("utils")) ?? {}, screens: parseObject(value("screens")) ?? {}, source: "legacy"};
};

/**
 * `global.remoteConfigs`: os dois blocos juntos, como era antes de fevereiro de 2026. Chave repetida nos dois
 * blocos fica com o valor do `utils`, que é o que a lib lê.
 */
export const mergeRemoteConfigBlocks = (
    utils: Record<string, any> | null | undefined,
    screens: Record<string, any> | null | undefined,
): Record<string, any> => ({...(screens ?? {}), ...(utils ?? {})});
