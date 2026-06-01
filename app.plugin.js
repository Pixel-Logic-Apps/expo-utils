const {
    withInfoPlist,
    withAppDelegate,
    withMainApplication,
    withDangerousMod,
    createRunOncePlugin,
} = require("@expo/config-plugins");
const {mergeContents} = require("@expo/config-plugins/build/utils/generateCode");
const fs = require("fs");
const path = require("path");

const pkg = require("./package.json");
const SKADNETWORK_IDS = require("./data/skadnetwork_ids.json");

const DEVMENU_TAG = "skip-devmenu-onboarding";
const FIREBASE_LOG_LEVELS = ["error", "warn", "info", "debug"];

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
 * Seta `react-native.app_log_level` no firebase.json da RAIZ do projeto no prebuild.
 *
 * O RNFirebase lê esse arquivo no build iOS (o ios_config.sh sobe a árvore a partir de
 * ios/ procurando firebase.json) e aplica via `[FIRConfiguration setLoggerLevel:]`,
 * reduzindo o ruído de log NATIVO do Firebase SDK em DEBUG (ex.: "[FirebaseAnalytics]
 * [I-ACS...]"). É iOS-only (a chave só vale no iOS), por isso roda no mod de iOS.
 *
 * Faz MERGE: preserva qualquer outra chave do firebase.json e NÃO sobrescreve um
 * app_log_level que o dev já tenha definido manualmente (idempotente em re-prebuilds).
 *
 * Obs.: NÃO silencia os logs `RNFB...[Line N]` (getAPNSToken, CrashlyticsInit) — esses
 * usam o macro DLog (#ifdef DEBUG NSLog) e somem sozinhos em release.
 */
function withFirebaseLogLevel(config, level) {
    return withDangerousMod(config, [
        "ios",
        (cfg) => {
            const fbPath = path.join(cfg.modRequest.projectRoot, "firebase.json");
            let json = {};
            if (fs.existsSync(fbPath)) {
                try {
                    json = JSON.parse(fs.readFileSync(fbPath, "utf8")) || {};
                } catch (e) {
                    // firebase.json com sintaxe inválida — não arrisca sobrescrever.
                    console.warn(`[expo-utils] firebase.json inválido, pulando app_log_level: ${e.message}`);
                    return cfg;
                }
            }
            const rn = (json["react-native"] = json["react-native"] || {});
            if (rn.app_log_level === undefined) {
                rn.app_log_level = level;
                fs.writeFileSync(fbPath, JSON.stringify(json, null, 2) + "\n");
            }
            return cfg;
        },
    ]);
}

/**
 * Config plugin do expo-utils.
 *
 * `options.disableWarnings`/`disableLogs` são lidos em RUNTIME do app.json
 * (Utils.ts lê `plugin[1]?.disableWarnings`), então não precisam de ação aqui.
 *
 * `options.skipDevMenuOnboarding` é lido aqui no PREBUILD: ligado por padrão,
 * desligue com `["expo-utils", { skipDevMenuOnboarding: false }]`.
 *
 * `options.firebaseLogLevel` ("error"|"warn"|"info"|"debug", ou `true` = "error")
 * é opt-in: gera/mergeia `app_log_level` no firebase.json no PREBUILD pra calar o
 * log nativo do Firebase SDK no iOS, sem você precisar criar o firebase.json na mão.
 */
function withExpoUtils(config, options = {}) {
    let result = withSkAdNetworkItems(config);
    if (options?.skipDevMenuOnboarding !== false) {
        result = withAndroidSkipDevMenu(withIosSkipDevMenu(result));
    }
    let level = options?.firebaseLogLevel;
    if (level === true) level = "error";
    if (typeof level === "string" && FIREBASE_LOG_LEVELS.includes(level)) {
        result = withFirebaseLogLevel(result, level);
    }
    return result;
}

module.exports = createRunOncePlugin(withExpoUtils, pkg.name, pkg.version);
