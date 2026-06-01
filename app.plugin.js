const {
    withInfoPlist,
    withAppDelegate,
    withMainApplication,
    createRunOncePlugin,
} = require("@expo/config-plugins");
const {mergeContents} = require("@expo/config-plugins/build/utils/generateCode");

const pkg = require("./package.json");
const SKADNETWORK_IDS = require("./data/skadnetwork_ids.json");

const DEVMENU_TAG = "skip-devmenu-onboarding";

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
 * Em DEBUG, marca o onboarding do dev-menu (expo-dev-client) como "ja visto" e
 * desliga o botao flutuante (FAB), logo no boot — antes do 1o frame —, pra que
 * nem o overlay ("This is the developer menu… Continue") nem o FAB aparecam no
 * dev build. Inerte em release (envolto em #if DEBUG / BuildConfig.DEBUG).
 *
 * O FAB so aparece quando o onboarding esta concluido (gate em
 * DevMenuManager.updateFABVisibility, default true), entao marcar o onboarding
 * como visto "acende" o FAB — por isso setamos as duas flags de uma vez.
 */
function withIosSkipDevMenu(config) {
    return withAppDelegate(config, (cfg) => {
        if (cfg.modResults.language !== "swift") {
            throw new Error(
                `[${DEVMENU_TAG}] expected a Swift AppDelegate, got "${cfg.modResults.language}"`,
            );
        }
        cfg.modResults.contents = mergeContents({
            src: cfg.modResults.contents,
            newSrc: [
                "#if DEBUG",
                `    UserDefaults.standard.set(true, forKey: "EXDevMenuIsOnboardingFinished")`,
                `    UserDefaults.standard.set(false, forKey: "EXDevMenuShowFloatingActionButton")`,
                "#endif",
            ].join("\n"),
            // Primeira instrucao do didFinishLaunchingWithOptions no template Expo.
            anchor: /let delegate = ReactNativeDelegate\(\)/,
            offset: 0,
            comment: "//",
            tag: DEVMENU_TAG,
        }).contents;
        return cfg;
    });
}

function withAndroidSkipDevMenu(config) {
    return withMainApplication(config, (cfg) => {
        cfg.modResults.contents = mergeContents({
            src: cfg.modResults.contents,
            newSrc: [
                "    if (BuildConfig.DEBUG) {",
                `      getSharedPreferences("expo.modules.devmenu.sharedpreferences", android.content.Context.MODE_PRIVATE)`,
                `        .edit().putBoolean("isOnboardingFinished", true).putBoolean("showFab", false).apply()`,
                "    }",
            ].join("\n"),
            anchor: /super\.onCreate\(\)/,
            offset: 1,
            comment: "//",
            tag: DEVMENU_TAG,
        }).contents;
        return cfg;
    });
}

/**
 * Config plugin do expo-utils.
 *
 * `options.disableWarnings`/`disableLogs` são lidos em RUNTIME do app.json
 * (Utils.ts lê `plugin[1]?.disableWarnings`), então não precisam de ação aqui.
 *
 * `options.skipDevMenuOnboarding` é lido aqui no PREBUILD: ligado por padrão,
 * desligue com `["expo-utils", { skipDevMenuOnboarding: false }]`.
 */
function withExpoUtils(config, options = {}) {
    let result = withSkAdNetworkItems(config);
    if (options?.skipDevMenuOnboarding !== false) {
        result = withAndroidSkipDevMenu(withIosSkipDevMenu(result));
    }
    return result;
}

module.exports = createRunOncePlugin(withExpoUtils, pkg.name, pkg.version);
