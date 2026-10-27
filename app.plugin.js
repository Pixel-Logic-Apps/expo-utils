const {
    withInfoPlist,
    withAppDelegate,
    withMainApplication,
    withAppBuildGradle,
    withDangerousMod,
    withProjectBuildGradle,
    withGradleProperties,
    createRunOncePlugin,
} = require("@expo/config-plugins");
const {
    mergeContents,
    removeContents,
    createGeneratedHeaderComment,
} = require("@expo/config-plugins/build/utils/generateCode");
const fs = require("fs");
const path = require("path");

const pkg = require("./package.json");
const SKADNETWORK_IDS = require("./data/skadnetwork_ids.json");
const MEDIATION_ADAPTERS = require("./data/mediation_adapters.json");

const DEVMENU_TAG = "skip-devmenu-onboarding";
const KOTLIN_ADS_FIX_TAG = "expo-utils-android-kotlin-ads-fix";
const MEDIATION_TAG = "expo-utils-admob-mediation";
const MEDIATION_REPOS_TAG = "expo-utils-admob-mediation-repos";
const FIREBASE_LOG_LEVELS = ["error", "warn", "info", "debug"];
const ANDROID_GRADLE_JVMARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";
const KOTLIN_SKIP_METADATA_FLAG = "-Xskip-metadata-version-check";

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
 * true = o RNFB instalado no app ainda aceita o Firebase iOS por CocoaPods (v24–26), e a global
 * `$RNFirebaseDisableSPM` é necessária com o stack estático. Do RNFB 27 em diante o Firebase iOS 13 só
 * vem por SPM e a global quebra o `pod install`. Sem o pacote ou sem versão legível, fica como antes.
 */
function rnfbUsesCocoaPods(config) {
    try {
        const root = config._internal?.projectRoot || process.cwd();
        const pkg = require(require.resolve("@react-native-firebase/app/package.json", {paths: [root]}));
        return parseInt(String(pkg.version), 10) < 27;
    } catch {
        return true;
    }
}

/**
 * Injeta variáveis GLOBAIS do RNFirebase no Podfile iOS no prebuild. Os podspecs do RNFB leem
 * essas globais no pod install:
 *   - `$RNFirebaseDisableSPM` → força resolução do firebase-ios-sdk por CocoaPods. Só no RNFB 24–26:
 *     o CLI configura `useFrameworks: "static"` e, do RNFB v25 em diante, o Firebase vem por Swift
 *     Package (produtos de linkagem automática). Com pods estáticos cada pod do RNFB embute a sua
 *     cópia e o `pod install` ABORTA: "[react-native-firebase] SPM + static linkage is not
 *     supported". No RNFB 27+ o Firebase iOS 13 só existe por SPM (com `useFrameworks: "dynamic"`)
 *     e é a global que quebra o `pod install`: por isso ela só entra com o RNFB instalado < 27
 *     (`rnfbUsesCocoaPods`). `{ firebaseDisableSPM: true | false }` força um dos dois.
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
 * play-services-ads (via react-native-google-mobile-ads) shipa Kotlin metadata 2.3.0,
 * enquanto o Expo SDK 57 ainda compila com Kotlin ~2.1.x. Sem este flag o task
 * `:react-native-google-mobile-ads:compile*Kotlin` falha com
 * "metadata is 2.3.0, expected version is 2.1.0".
 *
 * Idempotente: se o flag já está no project build.gradle, não duplica.
 * NÃO pinamos versão de Gradle (isso quebra o template do SDK 57).
 */
function withAndroidKotlinMetadataSkip(config) {
    return withProjectBuildGradle(config, (cfg) => {
        let contents = cfg.modResults.contents;
        if (!contents.includes(KOTLIN_SKIP_METADATA_FLAG)) {
            contents += `
// [${KOTLIN_ADS_FIX_TAG}] play-services-ads Kotlin 2.3 metadata vs Expo Kotlin 2.1
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        compilerOptions {
            freeCompilerArgs.add("${KOTLIN_SKIP_METADATA_FLAG}")
        }
    }
}
`;
        }
        cfg.modResults.contents = contents;
        return cfg;
    });
}

/**
 * Apps do stack (Firebase + AdMob + FBSDK + …) estouram o heap padrão do daemon
 * Gradle (~2G) no merge de dex em debug. Sobe pra 4G de forma idempotente.
 */
function withAndroidGradleHeap(config) {
    return withGradleProperties(config, (cfg) => {
        const key = "org.gradle.jvmargs";
        const existing = cfg.modResults.find((i) => i.type === "property" && i.key === key);
        if (existing) {
            existing.value = ANDROID_GRADLE_JVMARGS;
        } else {
            cfg.modResults.push({type: "property", key, value: ANDROID_GRADLE_JVMARGS});
        }
        return cfg;
    });
}

/**
 * Resolve a opção `mediation` do app.json numa lista de redes do catálogo
 * (data/mediation_adapters.json). Nunca lança: nome desconhecido vira warn e é ignorado.
 *
 * Aceita:
 *   true                                   → as redes PADRÃO do catálogo (as sem `"default": false`)
 *   ["applovin", "meta"]                   → só as listadas (aliases valem: "facebook" = meta,
 *                                            "vungle" = liftoff)
 *   {applovin: "13.6.3.0", pangle: false}  → override de versão / desliga rede a rede.
 *                                            String troca as DUAS plataformas; use
 *                                            {ios: "…", android: "…"} pra separar.
 *   {bigo: {android: {artifact, version, mavenRepo?}, ios: {pod, version}}}
 *                                          → rede QUE NÃO ESTÁ NO CATÁLOGO, definida inteira no
 *                                            app.json (escotilha: dá pra ligar qualquer ad source
 *                                            do AdMob sem mexer na lib). A mesma forma também
 *                                            sobrescreve campos de uma rede do catálogo.
 *
 * Definição parcial é válida: rede só com `android` (ou só com `ios`) é injetada só naquela
 * plataforma — útil para adapter que não existe nas duas.
 *
 * Android: `android.fromApp` marca a coordenada escolhida no app.json (rede fora do catálogo ou
 * artifact/versão trocados) e `android.extraArtifacts` traz os artefatos que o POM do adapter não
 * traz (hoje o SDK da Unity), cada um com o seu `fromApp` — ver androidMediationDependencies.
 *
 * `rngmaMajor` (major do react-native-google-mobile-ads instalado no app): com ele, a rede que tem `compat`
 * no catálogo usa as versões da entrada que serve àquele RNGMA (hoje o Pangle no RNGMA 16.x, cujo GMA iOS
 * 13.5.0 não atende o pod novo). Sem ele, valem as versões principais.
 */
// Adapter do Google = `<versão do SDK da rede>.<patch do adapter>` (unity 4.19.0.0 = "built and
// tested with Unity Ads SDK 4.19.0"). App que troca a versão do adapter leva o SDK do catálogo junto
// — senão o adapter novo rodaria contra o SDK antigo. Só vale quando o par do catálogo segue a regra.
const withoutAdapterPatch = (version) => String(version).split(".").slice(0, -1).join(".");
const followAdapterVersion = (sdkVersion, catalogAdapterVersion, adapterVersion) =>
    adapterVersion !== catalogAdapterVersion && sdkVersion === withoutAdapterPatch(catalogAdapterVersion)
        ? withoutAdapterPatch(adapterVersion)
        : sdkVersion;

function resolveMediationNetworks(option, {rngmaMajor = null} = {}) {
    const catalog = MEDIATION_ADAPTERS.networks;
    const keys = Object.keys(catalog);

    const normalize = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
    const findKey = (name) => {
        const wanted = normalize(name);
        return keys.find((key) => [key, ...(catalog[key].aliases || [])].some((n) => normalize(n) === wanted));
    };
    // Definição completa (rede nova) vs override de versão: o que distingue é o TIPO — string é
    // versão, objeto com artifact/pod é definição.
    const isDefinition = (value) =>
        !!value && typeof value === "object" && (value.android?.artifact || value.ios?.pod);

    // `default: false` no catálogo = rede disponível mas FORA do conjunto padrão (só entra se o
    // app pedir pelo nome). Evita engordar todo app sempre que o catálogo cresce.
    let requested = keys.filter((key) => catalog[key].default !== false).map((key) => [key, undefined]);
    if (Array.isArray(option)) {
        requested = option.map((name) => [name, undefined]);
    } else if (option && typeof option === "object") {
        requested = Object.entries(option).filter(([, value]) => value !== false);
    }

    const networks = [];
    for (const [name, override] of requested) {
        const key = findKey(name);
        const definition = isDefinition(override);
        if (!key && !definition) {
            console.warn(
                `[expo-utils] mediation: rede desconhecida "${name}" — ignorada. Use uma do catálogo ` +
                    `(${keys.join(", ")}) ou defina inteira: {"${name}": {"android": {"artifact": "…", "version": "…"}, "ios": {"pod": "…", "version": "…"}}}.`,
            );
            continue;
        }
        const id = key || normalize(name);
        if (networks.some((n) => n.key === id)) continue;

        const compat =
            key && rngmaMajor !== null ? (catalog[key].compat || []).find((entry) => rngmaMajor <= entry.maxRngmaMajor) : undefined;
        const compatOf = (platform) =>
            compat && compat[platform] && catalog[key][platform] ? {...catalog[key][platform], version: compat[platform]} : catalog[key][platform];
        const base = !key ? {label: String(name)} : compat ? {...catalog[key], android: compatOf("android"), ios: compatOf("ios")} : catalog[key];
        const versionOf = (platform) => {
            if (typeof override === "string") return override;
            const value = override && override[platform];
            if (typeof value === "string") return value;
            if (value && typeof value === "object" && value.version) return value.version;
            return base[platform]?.version;
        };
        const customOf = (platform) =>
            definition && override[platform] && typeof override[platform] === "object" ? override[platform] : null;
        const merged = (platform) => {
            const custom = customOf(platform);
            const merge = {...(base[platform] || {}), ...(custom || {}), version: versionOf(platform)};
            const valid = platform === "android" ? merge.artifact : merge.pod;
            if (!valid) return null;
            if (platform === "android" && !merge.version) {
                console.warn(`[expo-utils] mediation: "${name}" sem versão no Android — ignorado (Gradle exige versão).`);
                return null;
            }
            return merge;
        };

        const android = merged("android");
        if (android) {
            const catalogAndroid = key ? catalog[key].android : undefined;
            // fromApp compara com a versão que o catálogo escolheu para este app (a do compat, se houver)
            const chosenAndroid = key ? base.android : undefined;
            android.fromApp =
                !chosenAndroid || android.artifact !== chosenAndroid.artifact || android.version !== chosenAndroid.version;
            const extrasFromApp = !catalogAndroid || Array.isArray(customOf("android")?.extraArtifacts);
            android.extraArtifacts = (Array.isArray(android.extraArtifacts) ? android.extraArtifacts : [])
                .filter((extra) => extra && extra.artifact && extra.version)
                .map((extra) => ({
                    ...extra,
                    version: extrasFromApp
                        ? extra.version
                        : followAdapterVersion(extra.version, catalogAndroid.version, android.version),
                    fromApp: extrasFromApp,
                }));
        }
        const ios = merged("ios");
        if (!android && !ios) {
            console.warn(`[expo-utils] mediation: "${name}" sem definição válida de Android nem iOS — ignorada.`);
            continue;
        }
        networks.push({key: id, label: base.label || String(name), android, ios});
    }
    return networks;
}

/** Major do react-native-google-mobile-ads instalado no app (escolhe o `compat` do catálogo), ou null. */
function installedRngmaMajor(config) {
    try {
        const root = config._internal?.projectRoot || process.cwd();
        const rngma = require(require.resolve("react-native-google-mobile-ads/package.json", {paths: [root]}));
        const major = parseInt(String(rngma.version), 10);
        return Number.isNaN(major) ? null : major;
    } catch {
        return null;
    }
}

/**
 * Exclusões Gradle CONDICIONAIS de um adapter: só entram quando o app tem o pacote npm que
 * causa o conflito. Hoje resolve o caso do Pangle, que embute uma cópia do TikTok Business SDK
 * e quebra o `checkReleaseDuplicateClasses` em qualquer app do stack (que traz
 * `expo-tiktok-ads-events`). Ver `excludeWhenPackage` em data/mediation_adapters.json.
 */
function resolveAndroidExcludes(network, projectRoot) {
    const rules = network.android?.excludeWhenPackage;
    if (!rules || !projectRoot) return [];
    const out = [];
    for (const [pkg, excludes] of Object.entries(rules)) {
        if (!fs.existsSync(path.join(projectRoot, "node_modules", pkg))) continue;
        for (const e of excludes) out.push({group: e.group, module: e.module, why: `conflita com ${pkg}`});
    }
    return out;
}

/**
 * Dependências Gradle da mediação: o adapter de cada rede + os artefatos que o POM dele NÃO traz
 * (`extraArtifacts` — hoje o SDK da Unity, sem o qual o adapter vai sozinho e a Unity fica com 0%
 * de match). O mesmo artefato vindo de duas entradas (ex.: o SDK da Unity do catálogo e a chave
 * própria `"unity-sdk"` que o app já declarava no app.json) vira UMA linha, e a versão escolhida no
 * app.json vence a do catálogo — com duas linhas o Gradle ficaria com a maior, em silêncio.
 */
function androidMediationDependencies(networks, projectRoot) {
    const deps = [];
    const add = (dep) => {
        const same = deps.find((d) => d.artifact === dep.artifact);
        if (!same) {
            deps.push(dep);
            return;
        }
        if (same.version !== dep.version) {
            const winner = dep.fromApp && !same.fromApp ? dep : same;
            console.warn(
                `[expo-utils] mediation: ${dep.artifact} declarado com ${same.version} e ${dep.version} — ` +
                    `usando ${winner.version}${winner.fromApp ? " (do app.json)" : ""}.`,
            );
            same.version = winner.version;
        }
        same.fromApp = same.fromApp || dep.fromApp;
        for (const e of dep.excludes) {
            if (!same.excludes.some((x) => x.group === e.group && x.module === e.module)) same.excludes.push(e);
        }
    };
    for (const n of networks) {
        if (!n.android) continue;
        add({
            artifact: n.android.artifact,
            version: n.android.version,
            label: n.label,
            fromApp: !!n.android.fromApp,
            excludes: resolveAndroidExcludes(n, projectRoot),
        });
        for (const extra of n.android.extraArtifacts || []) {
            add({
                artifact: extra.artifact,
                version: extra.version,
                label: extra.label || `${n.label} SDK`,
                fromApp: !!extra.fromApp,
                excludes: [],
            });
        }
    }
    return deps;
}

/**
 * Android: injeta os adapters de mediation em `android/app/build.gradle`.
 *
 * Não dá pra usar `expo-build-properties` aqui — ele só expõe `extraMavenRepos`/`extraPods`,
 * não tem chave para dependências Gradle (a doc do react-native-google-mobile-ads sugere
 * `android.dependencies`, que não existe no plugin). Por isso o merge é feito aqui.
 */
function withAndroidMediationAdapters(config, networks) {
    return withAppBuildGradle(config, (cfg) => {
        if (cfg.modResults.language !== "groovy") {
            console.warn(`[expo-utils] mediation: app/build.gradle em ${cfg.modResults.language}, pulando adapters Android.`);
            return cfg;
        }
        const deps = androidMediationDependencies(networks, cfg.modRequest.projectRoot);
        if (!deps.length) return cfg;
        const newSrc = deps
            .map((d) => {
                const dep = `implementation("${d.artifact}:${d.version}")`;
                if (!d.excludes.length) return `    ${dep} // ${d.label}`;
                return [
                    `    ${dep} { // ${d.label}`,
                    ...d.excludes.map(
                        (e) => `        exclude group: "${e.group}", module: "${e.module}" // ${e.why}`,
                    ),
                    "    }",
                ].join("\n");
            })
            .join("\n");
        try {
            cfg.modResults.contents = mergeContents({
                src: cfg.modResults.contents,
                newSrc,
                anchor: /^dependencies\s?\{/m,
                offset: 1,
                comment: "//",
                tag: MEDIATION_TAG,
            }).contents;
        } catch (e) {
            console.warn(`[expo-utils] mediation: não consegui injetar os adapters no app/build.gradle: ${e.message}`);
        }
        return cfg;
    });
}

/**
 * Android: repositórios Maven das redes que NÃO publicam o SDK no Maven Central nem no
 * Google Maven (hoje Mintegral e Pangle). Sem isso o Gradle não resolve `mbridge_android_sdk`
 * / `pag-sdk` e o build quebra.
 *
 * Escreve no fim do build.gradle do PROJETO (blocos `allprojects` extras somam; o template do
 * Expo 57 não usa `dependencyResolutionManagement`), com header/footer @generated para que
 * mudar a lista de redes atualize o bloco em vez de duplicar.
 */
function withAndroidMediationRepos(config, networks) {
    return withProjectBuildGradle(config, (cfg) => {
        const repos = networks.filter((n) => n.android?.mavenRepo);
        let contents = removeContents({src: cfg.modResults.contents, tag: MEDIATION_REPOS_TAG}).contents;

        if (repos.length) {
            const body = [
                "allprojects {",
                "    repositories {",
                ...repos.map((n) => `        maven { url '${n.android.mavenRepo}' } // ${n.label}`),
                "    }",
                "}",
            ].join("\n");
            const header = createGeneratedHeaderComment(body, MEDIATION_REPOS_TAG, "//");
            contents = `${contents.replace(/\s+$/, "")}\n\n${header}\n${body}\n// @generated end ${MEDIATION_REPOS_TAG}\n`;
        }

        cfg.modResults.contents = contents;
        return cfg;
    });
}

/**
 * iOS: injeta os pods dos adapters DENTRO do target do app (âncora `use_expo_modules!`).
 *
 * As versões são PINADAS (data/mediation_adapters.json) de propósito: cada adapter declara
 * `Google-Mobile-Ads-SDK ~> X` e o RNGMA pina o GMA (16.x: 13.5.0; 17.4.0: 13.10.0) — pod sem
 * versão pode resolver um adapter que exige mais do que o app tem e derrubar o `pod install`. O
 * `compat` do catálogo cobre o RNGMA 16.x onde a versão nova não serve (Pangle).
 */
function withIosMediationPods(config, networks) {
    return withDangerousMod(config, [
        "ios",
        (cfg) => {
            const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
            const iosNetworks = networks.filter((n) => n.ios);
            if (!iosNetworks.length) return cfg;
            try {
                const src = fs.readFileSync(podfile, "utf8");
                const newSrc = iosNetworks
                    .map((n) =>
                        // pod sem versão é permitido (o CocoaPods resolve a mais nova), mas o
                        // catálogo pina de propósito — ver comentário do arquivo de catálogo.
                        n.ios.version
                            ? `  pod '${n.ios.pod}', '${n.ios.version}' # ${n.label}`
                            : `  pod '${n.ios.pod}' # ${n.label}`,
                    )
                    .join("\n");
                const merged = mergeContents({
                    src,
                    newSrc,
                    anchor: /use_expo_modules!/, // primeira linha dentro do `target ... do`
                    offset: 1,
                    comment: "#",
                    tag: MEDIATION_TAG,
                });
                if (merged.didMerge) fs.writeFileSync(podfile, merged.contents);
            } catch (e) {
                console.warn(`[expo-utils] mediation: não consegui injetar os pods no Podfile: ${e.message}`);
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
 * `options.firebaseDisableSPM` automático pela versão do RNFB do app: injeta `$RNFirebaseDisableSPM =
 * true` no Podfile só no RNFB 24–26, onde Firebase via Swift Package + `useFrameworks: "static"` —
 * que o CLI configura — faz o `pod install` abortar com "SPM + static linkage is not supported". No
 * RNFB 27+ (Firebase só por SPM) a global é que quebra o `pod install`, então não entra.
 *
 * `options.usageDescriptions` LIGADO por padrão: injeta NS*UsageDescription (Photo Library
 * read/add + Camera) no Info.plist se faltarem, resolvendo o ITMS-90683 disparado por SDKs
 * (FBSDK, expo-image/video/file-system). Desligue com `{ usageDescriptions: false }` ou ajuste
 * por chave: `{ usageDescriptions: { NSCameraUsageDescription: false } }`.
 *
 * `options.androidKotlinAdsFix` LIGADO por padrão: no PREBUILD Android injeta
 * `-Xskip-metadata-version-check` no KotlinCompile (play-services-ads 2.3 vs Kotlin 2.1
 * do Expo) e sobe o heap do Gradle daemon pra 4G. Evita plugin local nos apps.
 * Desligue com `{ androidKotlinAdsFix: false }`.
 *
 * `options.mediation` LIGADO por padrão com as redes padrão do catálogo (AppLovin, Meta, Unity,
 * Pangle): no PREBUILD injeta os adapters (+ o SDK da Unity, que o POM do adapter não traz) no
 * `app/build.gradle`, os repositórios Maven das redes fora do Maven Central/Google Maven no
 * build.gradle do projeto e os pods no Podfile.
 * Desligue com `{ mediation: false }`, ou escolha as redes: `{ mediation: ["applovin", "meta"] }`.
 * ⚠️ Adapter só serve ad depois de configurar a fonte na UI do AdMob (grupo de mediação +
 * ad unit mapeado); sem isso só pesa o build.
 */
/**
 * Embute o ícone do app (96px, data URI) em `extra.expoUtilsAppIcon`, lido em runtime pelo
 * tutorial de avaliação via `Constants.expoConfig`. Não toca no app.json: o config muda só em
 * memória e sai no `app.config` gerado dentro do APK/IPA.
 *
 * Redimensiona com `jimp-compact` (JS puro), que vem junto do `@expo/image-utils` — dependência
 * de `expo-asset`/`expo-splash-screen`, logo presente em todo projeto Expo. (`sharp` NÃO serve:
 * não é dep do Expo, só aparece por acaso em projetos com outro tooling.) Ele é async e config
 * plugin é síncrono, daí o execFileSync; o resultado fica em cache por mtime+tamanho do ícone,
 * senão pagaria o encode a cada `getConfig` (que roda em todo metro start). Sem ícone, sem
 * jimp ou com erro: deixa o config intacto e o tutorial cai no círculo com a inicial.
 */
function withAppIconDataUri(config) {
    const source = config.android?.icon || config.icon;
    if (typeof source !== "string" || !source || /^(https?|data):/.test(source)) return config;

    let b64;
    let cachePath;
    try {
        const root = config._internal?.projectRoot || process.cwd();
        const icon = path.resolve(root, source);
        const stat = fs.statSync(icon);
        // icon vazio resolveria para o proprio root, e statSync de diretorio nao lanca
        if (!stat.isFile()) return config;
        cachePath = path.join(root, "node_modules", ".cache", "expo-utils", `icon-${stat.size}-${Math.round(stat.mtimeMs)}.txt`);
        if (fs.existsSync(cachePath)) {
            b64 = fs.readFileSync(cachePath, "utf8");
            cachePath = undefined;
        } else {
            // resolvido pelo caminho do @expo/image-utils para funcionar tambem no pnpm
            const utils = require.resolve("@expo/image-utils/package.json", {paths: [root]});
            const jimp = require.resolve("jimp-compact", {paths: [path.dirname(utils)]});
            // AUTO na altura preserva proporcao; o <img> do template ja usa object-fit:cover
            const script =
                'const J=require(process.argv[1]);J.read(process.argv[2])' +
                '.then(i=>i.resize(96,J.AUTO).getBufferAsync("image/png"))' +
                '.then(b=>process.stdout.write(b.toString("base64")))';
            // stdio explicito: sem isso o stderr do filho vaza no terminal a cada metro start
            b64 = require("child_process")
                .execFileSync(process.execPath, ["-e", script, jimp, icon], {
                    cwd: root,
                    maxBuffer: 1 << 24,
                    stdio: ["ignore", "pipe", "ignore"],
                })
                .toString();
        }
    } catch {
        /* icone ausente, jimp ausente ou falha de encode: segue sem icone */
        return config;
    }
    if (!b64) return config;

    // spread: `extra` carrega eas.projectId, router.origin e o que mais o app puser
    config.extra = {...config.extra, expoUtilsAppIcon: "data:image/png;base64," + b64};

    // cache DEPOIS de aplicar: node_modules read-only nao pode custar o icone da build
    if (cachePath) {
        try {
            fs.mkdirSync(path.dirname(cachePath), {recursive: true});
            fs.writeFileSync(cachePath, b64);
        } catch {
            /* sem cache: paga o encode de novo na proxima resolucao */
        }
    }
    return config;
}

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
    const podfileGlobals = [];
    if (options?.firebaseDisableSPM ?? rnfbUsesCocoaPods(config)) {
        // Precisa vir ANTES dos targets — o anchor `require 'json'` garante isso.
        podfileGlobals.push("$RNFirebaseDisableSPM = true");
    }
    if (options?.analyticsAdSupport !== false) {
        podfileGlobals.push("$RNFirebaseAnalyticsEnableAdSupport = true");
    }
    if (options?.analyticsOnDeviceConversion !== false) {
        podfileGlobals.push("$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion = true");
    }
    if (podfileGlobals.length) {
        result = withAnalyticsPodfileGlobals(result, podfileGlobals);
    }
    if (options?.androidKotlinAdsFix !== false) {
        result = withAndroidGradleHeap(withAndroidKotlinMetadataSkip(result));
    }
    if (options?.appIcon !== false) {
        result = withAppIconDataUri(result);
    }
    if (options?.mediation !== false) {
        const networks = resolveMediationNetworks(options?.mediation, {rngmaMajor: installedRngmaMajor(config)});
        if (networks.length) {
            result = withIosMediationPods(
                withAndroidMediationRepos(withAndroidMediationAdapters(result, networks), networks),
                networks,
            );
        }
    }
    return result;
}

const plugin = createRunOncePlugin(withExpoUtils, pkg.name, pkg.version);
// Funções puras da mediação e as leituras de versão do app, expostas só para os testes
// (tests/mediation-catalog.test.ts, tests/plugin-versions.test.ts) — não é API pública.
plugin.mediationInternals = {resolveMediationNetworks, androidMediationDependencies, installedRngmaMajor};
plugin.firebaseInternals = {rnfbUsesCocoaPods};
module.exports = plugin;
