const {withInfoPlist, createRunOncePlugin} = require("@expo/config-plugins");

const pkg = require("./package.json");
const SKADNETWORK_IDS = require("./data/skadnetwork_ids.json");

/**
 * Injeta TODOS os SKAdNetworkItems no Info.plist durante o prebuild.
 *
 * Antes esses ~159 IDs ficavam listados no app.json (ios.infoPlist.SKAdNetworkItems),
 * o que deixava o arquivo gigante e ruim de ler. Agora o plugin faz o merge no prebuild,
 * então o app.json fica limpo e os IDs continuam presentes no build final.
 *
 * Faz merge/dedup (case-insensitive) com qualquer SKAdNetworkItem que já exista no
 * Info.plist, preservando o que o desenvolvedor tiver adicionado manualmente.
 */
function withSkAdNetworkItems(config) {
    return withInfoPlist(config, (config) => {
        const existing = Array.isArray(config.modResults.SKAdNetworkItems)
            ? config.modResults.SKAdNetworkItems
            : [];

        const byId = new Map();
        const add = (item) => {
            const id = item && item.SKAdNetworkIdentifier;
            if (typeof id === "string" && id.trim()) {
                const key = id.toLowerCase();
                // primeiro a entrar vence — preserva o que o dev já tinha no Info.plist
                if (!byId.has(key)) byId.set(key, {SKAdNetworkIdentifier: id});
            }
        };

        existing.forEach(add);
        SKADNETWORK_IDS.forEach(add);

        config.modResults.SKAdNetworkItems = Array.from(byId.values()).sort((a, b) =>
            a.SKAdNetworkIdentifier.localeCompare(b.SKAdNetworkIdentifier),
        );
        return config;
    });
}

/**
 * Config plugin do expo-utils.
 *
 * `options` (disableWarnings/disableLogs) são lidos em RUNTIME diretamente do app.json
 * (Utils.ts lê `plugin[1]?.disableWarnings`), então não precisam de ação aqui — basta
 * manter `["expo-utils", { ... }]` no array de plugins do app.json.
 */
function withExpoUtils(config, _options = {}) {
    return withSkAdNetworkItems(config);
}

module.exports = createRunOncePlugin(withExpoUtils, pkg.name, pkg.version);
