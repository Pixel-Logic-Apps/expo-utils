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

// Purpose strings (NS*UsageDescription) que SDKs comuns referenciam mesmo quando o app NÃO
// usa a feature: ExpoImage / ExpoVideo / ExpoFileSystem e o FBSDKShareKit acessam a Photo
// Library; a câmera é comum no compartilhamento. A Apple rejeita o build (ITMS-90683) se a
// chave faltar no Info.plist. Injetamos um default no Info.plist BASE só quando o dev não
// definiu; a tradução por idioma vem do expo.locales (languages/*.json do CLI --languages).
const IOS_USAGE_DESCRIPTIONS = {
    NSPhotoLibraryUsageDescription: "This app may access your photos so you can select and share images.",
    NSPhotoLibraryAddUsageDescription: "This app may save images to your photo library.",
    NSCameraUsageDescription: "This app may use the camera to capture and share photos.",
};

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
 * Garante que as purpose strings exigidas por SDKs comuns existam no Info.plist.
 * Adiciona cada NS*UsageDescription só se ainda não estiver definida (preserva o que o dev
 * colocou no app.json ios.infoPlist). Resolve o ITMS-90683 ("Missing purpose string") que o
 * Facebook SDK / expo-image / expo-video / expo-file-system disparam mesmo quando o app não
 * abre a galeria/câmera. A localização por idioma é feita pelo expo.locales (languages/*.json).
 *
 * Opt-out global: ["expo-utils", { usageDescriptions: false }].
 * Override/desligar por chave: { usageDescriptions: { NSCameraUsageDescription: "texto" | false } }.
 */
function withIosUsageDescriptions(config, overrides = {}) {
    return withInfoPlist(config, (cfg) => {
        for (const [key, def] of Object.entries(IOS_USAGE_DESCRIPTIONS)) {
            const override = overrides[key];
            if (override === false) continue; // desliga essa chave
            if (cfg.modResults[key]) continue; // dev já definiu no app.json → preserva
            cfg.modResults[key] = typeof override === "string" ? override : def;
        }
        return cfg;
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

const RNFB_ANALYTICS_PODFILE_TAG = "rnfirebase-analytics-podfile-globals";

/**
 * Injeta variáveis GLOBAIS do RNFirebase Analytics no Podfile iOS no prebuild. O
 * RNFBAnalytics.podspec lê essas globais no pod install (confirmado na v24):
 *   - `$RNFirebaseAnalyticsEnableAdSupport` → linka `AdSupport.framework` (IDFA → audiência/
 *     demografia no iOS, como no Android).
 *   - `$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion` → add pod
 *     `GoogleAdsOnDeviceConversion` (resolve o log "[FirebaseAnalytics] Failed to initiate
 *     on-device conversion measurement... dependency does not support this feature").
 *
 * Setamos via Podfile (withDangerousMod) e NÃO via config plugin do @react-native-firebase/
 * analytics: esse plugin só existe em versões NOVAS do RNFirebase — na v24 (suportada aqui) ele
 * NEM EXISTE, e referenciá-lo no app.json QUEBRA o prebuild. A var no Podfile funciona em qualquer
 * versão. Idempotente (tag) + try/catch p/ não quebrar o prebuild se o anchor mudar num Expo futuro.
 *
 * ⚠️ AdSupport coleta IDFA em PRODUÇÃO (requer ATT — expo-utils já pede — + IDFA no privacy
 * manifest/App Store). Inócuo em apps com AdMob; num app SEM ads, desligue com
 * `["expo-utils", { analyticsAdSupport: false }]`.
 */
function withAnalyticsPodfileGlobals(config, vars) {
    return withDangerousMod(config, [
        "ios",
        (cfg) => {
            const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
            try {
                const src = fs.readFileSync(podfile, "utf8");
                const merged = mergeContents({
                    src,
                    newSrc: vars.join("\n"),
                    anchor: /require 'json'/, // linha estável no topo do Podfile do Expo
                    offset: 1,
                    comment: "#",
                    tag: RNFB_ANALYTICS_PODFILE_TAG,
                });
                if (merged.didMerge) fs.writeFileSync(podfile, merged.contents);
            } catch (e) {
                console.warn(`[expo-utils] não consegui setar globais do RNFirebase Analytics no Podfile: ${e.message}`);
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
 *
 * `options.analyticsAdSupport` e `options.analyticsOnDeviceConversion` LIGADOS por padrão
 * (apps ads-first): no PREBUILD injetam as globais do RNFirebase Analytics no Podfile iOS
 * (`$RNFirebaseAnalyticsEnableAdSupport` / `...GoogleAppMeasurementOnDeviceConversion`).
 * Desligue cada uma com `{ analyticsAdSupport: false }` / `{ analyticsOnDeviceConversion: false }`.
 *
 * `options.usageDescriptions` LIGADO por padrão: injeta NS*UsageDescription (Photo Library
 * read/add + Camera) no Info.plist se faltarem, resolvendo o ITMS-90683 disparado por SDKs
 * (FBSDK, expo-image/video/file-system). Desligue com `{ usageDescriptions: false }` ou ajuste
 * por chave: `{ usageDescriptions: { NSCameraUsageDescription: false } }`.
 */
function withExpoUtils(config, options = {}) {
    let result = withSkAdNetworkItems(config);
    if (options?.usageDescriptions !== false) {
        result = withIosUsageDescriptions(result, options?.usageDescriptions || {});
    }
    if (options?.skipDevMenuOnboarding !== false) {
        result = withAndroidSkipDevMenu(withIosSkipDevMenu(result));
    }
    let level = options?.firebaseLogLevel;
    if (level === true) level = "error";
    if (typeof level === "string" && FIREBASE_LOG_LEVELS.includes(level)) {
        result = withFirebaseLogLevel(result, level);
    }
    const analyticsGlobals = [];
    if (options?.analyticsAdSupport !== false) {
        analyticsGlobals.push("$RNFirebaseAnalyticsEnableAdSupport = true");
    }
    if (options?.analyticsOnDeviceConversion !== false) {
        analyticsGlobals.push("$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion = true");
    }
    if (analyticsGlobals.length) {
        result = withAnalyticsPodfileGlobals(result, analyticsGlobals);
    }
    return result;
}

module.exports = createRunOncePlugin(withExpoUtils, pkg.name, pkg.version);
