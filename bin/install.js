#!/usr/bin/env node

const {exec} = require("child_process");
const path = require("path");
const fs = require("fs");
const chalk = require("chalk");
const readline = require("readline");

// --- Helper Functions ---

const projectRoot = process.cwd();
const appJsonPath = path.join(projectRoot, "app.json");
const moduleDir = path.join(__dirname, "..");

/**
 * Safely reads and parses the app.json file.
 * @returns {object|null} The parsed config object or null if not found.
 */
function getAppConfig() {
    if (!fs.existsSync(appJsonPath)) {
        console.error(chalk.red("Error: Could not find app.json in the current directory."));
        return null;
    }
    return JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
}

/**
 * Safely writes an object to the app.json file.
 * @param {object} config The config object to write.
 */
function writeAppConfig(config) {
    fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2));
}

/**
 * Ensures a directory exists, creating it if necessary.
 * @param {string} dirPath The path to the directory.
 */
function ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
}

/**
 * Checks if a package exists in the target project.
 * @param {string} pkgSubPath package name or subpath like 'expo/package.json'
 */
function hasPackage(pkgSubPath) {
    try {
        require.resolve(pkgSubPath, {paths: [projectRoot]});
        return true;
    } catch {
        return false;
    }
}

/**
 * Detects the package manager used in the project.
 * Priority: lockfile > user agent > default (bun).
 * @returns {"bun"|"npm"|"yarn"|"pnpm"}
 */
function detectPackageManager() {
    // 1. Check lockfiles in project root (most reliable)
    if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(projectRoot, "package-lock.json"))) return "npm";
    if (fs.existsSync(path.join(projectRoot, "bun.lockb")) ||
        fs.existsSync(path.join(projectRoot, "bun.lock"))) return "bun";

    // 2. Fallback to user agent
    const ua = process.env.npm_config_user_agent || "";
    if (ua.includes("yarn")) return "yarn";
    if (ua.includes("pnpm")) return "pnpm";
    if (ua.includes("bun")) return "bun";
    if (ua.includes("npm")) return "npm";

    // 3. Default: bun
    return "bun";
}

/** Spec declarado no package.json do app (dependencies → devDependencies → optionalDependencies). */
function declaredSpec(projectPkg, name) {
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
        const spec = projectPkg && projectPkg[field] && projectPkg[field][name];
        if (typeof spec === "string") return spec;
    }
    return null;
}

/** Versão instalada em node_modules do app, ou null. */
function installedPackageVersion(name) {
    try {
        const pkgJson = path.join(projectRoot, "node_modules", name, "package.json");
        if (!fs.existsSync(pkgJson)) return null;
        const version = JSON.parse(fs.readFileSync(pkgJson, "utf-8")).version;
        return typeof version === "string" ? version : null;
    } catch {
        return null;
    }
}

/** Major de uma versão ou range de registry ("27.1.0", "^26.4.0", ">=0.35.3 <1" → 27, 26, 0); git/file/url → null. */
function majorOf(spec) {
    if (typeof spec !== "string" || spec.includes(":") || spec.includes("/")) return null;
    const match = spec.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

/** Major do pacote no app: a versão instalada vale mais que o spec (um range como >=24.0.0 resolve a mais nova). */
function packageMajor(projectPkg, name) {
    const installed = majorOf(installedPackageVersion(name));
    return installed !== null ? installed : majorOf(declaredSpec(projectPkg, name));
}

// --- Hot Updater: v0 (0.35/0.36) é o padrão; v1 (1.1.3+) com --hot-updater-v1 ou quando o app já tem a 1.x ---
// As duas gerações não se falam (servidor v1 novo, API nova): nunca misturar pacotes nem plugins delas.
const HOT_UPDATER_PACKAGES = ["@hot-updater/react-native", "@hot-updater/expo", "hot-updater"];
const HOT_UPDATER_RANGES = {0: ">=0.35.3 <1", 1: ">=1.1.3 <2"};
// O @hot-updater/react-native 1.x não tem app.plugin.js: no v1 o plugin do Expo é o @hot-updater/expo.
const HOT_UPDATER_PLUGINS = {0: "@hot-updater/react-native", 1: "@hot-updater/expo"};
const HOT_UPDATER_V0_STRINGS_PLACEHOLDER = "https://YOUR-WORKER.workers.dev/api/check-update";
const HOT_UPDATER_V1_STRINGS_PLACEHOLDER = "https://YOUR-V1-WORKER.workers.dev";

/**
 * 1 com --hot-updater-v1 ou com algum pacote do Hot Updater na 1.x no app; senão 0. Aqui o spec declarado vale
 * mais que o instalado: um v0 sem teto (`>=0.35.3`, dos instaladores antigos) que resolveu a 1.x por acidente
 * (o `latest` virou 1.x em 20/10/2026) continua v0 — o servidor desses apps é v0 — e o `--hot-updater` põe o teto.
 * O instalado só conta para pacote que o app não declara.
 */
function detectHotUpdaterGeneration(args, projectPkg) {
    if ((args || []).includes("--hot-updater-v1")) return 1;
    const generationOf = (name) => {
        const specMajor = majorOf(declaredSpec(projectPkg, name));
        const major = specMajor !== null ? specMajor : majorOf(installedPackageVersion(name));
        return major === null ? null : major >= 1 ? 1 : 0;
    };
    return [...HOT_UPDATER_PACKAGES, "@hot-updater/cloudflare"].some((name) => generationOf(name) === 1) ? 1 : 0;
}

// --- expo-build-properties pelo RNFirebase instalado no app ---
// RNFB 27+: o Firebase iOS 13 só vem por Swift Package e exige frameworks DINÂMICOS (com estático o pod
// install aborta: "SPM + static linkage is not supported"); os pods do RNFB não podem estar no
// forceStaticLinking, que fica com o RNGoogleMobileAds (doc do RNGMA) e o react-native-fbsdk-next
// (fbsdk-next#678). O Firebase Android BoM 35 exige Kotlin >= 2.4.0: 2.4.20, porque os compiler plugins do
// Expo (pika-compiler, expo-modules-v2-compiler-plugin) só estão no Maven Central até a 2.4.20.
// Combinação testada em 27/10/2026 no Eleições (SDK 58, RNFB 27.1.0, RNGMA 17.4.0): Release no iOS e no Android (com o
// R8 do SDK 58, o Android só abre com as regras do plugin: androidR8KeepRules, 1.5.2).
// RNFB 24–26 (apps no SDK 57): o stack estático de sempre.
const RNFB_STATIC_PODS = ["RNFBApp", "RNFBAuth", "RNFBFirestore", "RNFBMessaging", "RNFBCrashlytics", "RNFBAnalytics", "RNFBRemoteConfig"];
const RNFB_SPM_FORCE_STATIC = ["RNGoogleMobileAds", "react-native-fbsdk-next"];
const RNFB_SPM_KOTLIN_VERSION = "2.4.20";

function buildPropertiesFor(rnfbMajor) {
    if (rnfbMajor !== null && rnfbMajor >= 27) {
        return {
            ios: {useFrameworks: "dynamic", forceStaticLinking: [...RNFB_SPM_FORCE_STATIC]},
            android: {kotlinVersion: RNFB_SPM_KOTLIN_VERSION},
        };
    }
    return {ios: {useFrameworks: "static", forceStaticLinking: [...RNFB_STATIC_PODS]}};
}

/**
 * Aplica no app.json o expo-build-properties da major do RNFB. Mantém as outras chaves do plugin; o
 * forceStaticLinking soma ao que o app já tem (no RNFB 27+ sem os pods RNFB*). `useModularHeaders` sai:
 * o expo-build-properties não tem essa chave e a ignora em silêncio.
 */
function applyBuildProperties(config, rnfbMajor) {
    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];
    const wanted = buildPropertiesFor(rnfbMajor);
    const spm = !!wanted.android;
    const index = config.expo.plugins.findIndex(
        (p) => (Array.isArray(p) && p[0] === "expo-build-properties") || p === "expo-build-properties",
    );
    const existing = index !== -1 && Array.isArray(config.expo.plugins[index]) ? config.expo.plugins[index][1] || {} : {};
    const previousStatic = (existing.ios && existing.ios.forceStaticLinking) || [];
    const ios = {
        ...(existing.ios || {}),
        useFrameworks: wanted.ios.useFrameworks,
        forceStaticLinking: [...previousStatic.filter((pod) => !(spm && /^RNFB/.test(pod))), ...wanted.ios.forceStaticLinking].filter(
            (pod, i, all) => all.indexOf(pod) === i,
        ),
    };
    delete ios.useModularHeaders;
    const pluginConfig = {...existing, ios};
    if (wanted.android) pluginConfig.android = {...(existing.android || {}), ...wanted.android};
    const plugin = ["expo-build-properties", pluginConfig];
    if (index === -1) config.expo.plugins.push(plugin);
    else config.expo.plugins[index] = plugin;
    return {added: index === -1, spm};
}

// --- Scaffolding Functions ---

/**
 * O que o passo de dependências instala: todo peer (inclusive os opcionais) que o app ainda não declara.
 * Os peers do Hot Updater aceitam as duas gerações (">=0.35.3 <1 || >=1.1.3 <2"), e esse range resolveria a
 * 1.x; por isso eles entram com o range da geração do app (v0 por padrão). `@expo/ui` e `expo-device` são
 * importados de forma fixa pela lib e, do SDK 58 em diante, não vêm mais junto com o expo-router: entram
 * aqui como qualquer peer que falta e passam pelo `expo install` (versão do SDK do app).
 */
function planMissingDependencies(peerDependencies, projectPkg, hotUpdaterGeneration) {
    const existingDeps = {...projectPkg.dependencies, ...projectPkg.devDependencies};
    const missing = Object.keys(peerDependencies).filter((dep) => !existingDeps[dep]);
    const specs = {};
    for (const dep of missing) {
        specs[dep] = HOT_UPDATER_PACKAGES.includes(dep) ? HOT_UPDATER_RANGES[hotUpdaterGeneration] : peerDependencies[dep];
    }
    const expoManaged = missing.filter(
        (dep) => dep === "expo" || dep === "react" || dep === "react-native" || dep.startsWith("expo-") || dep.startsWith("@expo/"),
    );
    return {missing, specs, expoManaged};
}

async function handleDependencyInstall(args = []) {
    console.log(chalk.cyan("🚀 Checking for missing peer dependencies..."));
    const modulePkg = require(path.join(moduleDir, "package.json"));
    const peerDependencies = modulePkg.peerDependencies || {};
    const projectPkgPath = path.join(projectRoot, "package.json");
    const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, "utf-8"));
    const hotUpdaterGeneration = detectHotUpdaterGeneration(args, projectPkg);
    const {missing: missingDeps, specs, expoManaged: expoManagedDeps} = planMissingDependencies(
        peerDependencies,
        projectPkg,
        hotUpdaterGeneration,
    );

    if (missingDeps.length === 0) {
        console.log(chalk.green("✅ All required peer dependencies are already installed."));
        return;
    }

    const pm = detectPackageManager();
    const hasExpo = hasPackage("expo/package.json");

    console.log(chalk.blue(`📦 Package manager: ${pm}`));
    console.log(chalk.yellow(`📦 Installing ${missingDeps.length} missing dependenc(ies): ${missingDeps.join(", ")}`));

    // Step 1: Write all missing deps to package.json first.
    // This prevents expo install / bun from skipping packages that are
    // already in node_modules (e.g. hoisted from a local symlinked package).
    // Without explicit entries in package.json, Expo autolinking won't
    // detect native modules and pod install will miss them.
    projectPkg.dependencies = projectPkg.dependencies || {};
    for (const dep of missingDeps) {
        projectPkg.dependencies[dep] = specs[dep];
    }
    fs.writeFileSync(projectPkgPath, JSON.stringify(projectPkg, null, 2));
    console.log(chalk.green(`  -> Added ${missingDeps.length} dependencies to package.json`));
    if (missingDeps.some((dep) => HOT_UPDATER_PACKAGES.includes(dep))) {
        console.log(chalk.gray(`  -> Hot Updater v${hotUpdaterGeneration}: ${HOT_UPDATER_RANGES[hotUpdaterGeneration]}`));
    }

    // Step 2: For expo-managed deps, run expo install (names only) to
    // resolve SDK-compatible versions and update package.json entries.
    if (hasExpo) {
        if (expoManagedDeps.length > 0) {
            const execCmd = { bun: "bunx", npm: "npx -y", yarn: "npx -y", pnpm: "npx -y" };
            const expoCmd = `${execCmd[pm]} expo install ${expoManagedDeps.join(" ")}`;
            console.log(chalk.blue(`  -> Resolving Expo-compatible versions for ${expoManagedDeps.length} package(s)...`));
            await new Promise((resolve, reject) => {
                exec(expoCmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        console.warn(chalk.yellow(`  -> Warning: expo install failed, using peer dep versions. ${stderr || error.message}`));
                    }
                    resolve();
                });
            });
        }
    }

    // Step 3: Run the package manager install to fetch everything.
    const installCmd = { bun: "bun install", npm: "npm install", yarn: "yarn", pnpm: "pnpm install" };
    const finalCmd = installCmd[pm];
    console.log(chalk.blue(`  -> Running ${finalCmd}...`));

    return new Promise((resolve, reject) => {
        exec(finalCmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error(
                    chalk.red("\n❌ An error occurred during installation."),
                    chalk.red(stderr || error.message),
                );
                reject(error);
            } else {
                console.log(chalk.green.bold("\n✅ Dependencies installed successfully!"));
                resolve();
            }
        });
    });
}

// Reordena config.expo.plugins: plugins simples (string) primeiro, depois os com
// configuração (array [nome, {...}]). Mantém a ordem relativa dentro de cada grupo (estável).
function sortPlugins(config) {
    if (!config || !config.expo || !Array.isArray(config.expo.plugins)) return false;
    const plugins = config.expo.plugins;
    const strings = plugins.filter((p) => typeof p === "string");
    const arrays = plugins.filter((p) => Array.isArray(p));
    const others = plugins.filter((p) => typeof p !== "string" && !Array.isArray(p));
    config.expo.plugins = [...strings, ...arrays, ...others];
    return true;
}

function handleSortPluginsFlag() {
    console.log(chalk.cyan("🔤 Ordenando plugins do app.json (strings primeiro, depois os com config)..."));
    const config = getAppConfig();
    if (!config) return;
    if (!sortPlugins(config)) {
        console.log(chalk.yellow("  -> Nenhum array 'plugins' encontrado em app.json."));
        return;
    }
    writeAppConfig(config);
    console.log(chalk.green("✅ Plugins ordenados."));
}

function handleConfigFlag() {
    console.log(chalk.cyan("🔧 Configuring standard plugins in app.json..."));
    const config = getAppConfig();
    if (!config) return;

    const pluginsConfigPath = path.join(
        moduleDir,
        "data",
        "standard_plugins.json",
    );
    if (!fs.existsSync(pluginsConfigPath)) {
        console.error(chalk.red("❌ Could not find standard_plugins.json in the expo-utils module."));
        return;
    }
    const pluginsWithConfig = require(pluginsConfigPath);

    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];

    // Add Firebase App plugin (no config needed from the file, it's discovered automatically)
    const firebaseAppPlugin = "@react-native-firebase/app";
    if (!config.expo.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === firebaseAppPlugin)) {
        config.expo.plugins.push(firebaseAppPlugin);
        console.log(chalk.green(`  -> Added ${firebaseAppPlugin} plugin.`));
    } else {
        console.log(chalk.yellow(`  -> Plugin ${firebaseAppPlugin} already configured.`));
    }

    // Add Firebase Crashlytics plugin (no config needed from the file)
    const firebaseCrashlyticsPlugin = "@react-native-firebase/crashlytics";
    if (!config.expo.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === firebaseCrashlyticsPlugin)) {
        config.expo.plugins.push(firebaseCrashlyticsPlugin);
        console.log(chalk.green(`  -> Added ${firebaseCrashlyticsPlugin} plugin.`));
    } else {
        console.log(chalk.yellow(`  -> Plugin ${firebaseCrashlyticsPlugin} already configured.`));
    }

    // Add other plugins from the config file
    const forceStandardConfigPlugins = new Set(["expo-splash-screen"]);
    Object.keys(pluginsWithConfig).forEach((pluginName) => {
        const existingPluginIndex = config.expo.plugins.findIndex((p) => (Array.isArray(p) ? p[0] : p) === pluginName);

        if (existingPluginIndex === -1) {
            // Plugin não existe, adicionar novo
            config.expo.plugins.push([pluginName, pluginsWithConfig[pluginName]]);
            console.log(chalk.green(`  -> Added ${pluginName} plugin.`));
        } else {
            // Plugin existe, verificar se tem configuração
            const existingPlugin = config.expo.plugins[existingPluginIndex];
            const hasConfig = Array.isArray(existingPlugin) && existingPlugin.length > 1;

            if (!hasConfig) {
                // Plugin existe mas sem configuração, substituir por versão com configuração
                config.expo.plugins[existingPluginIndex] = [pluginName, pluginsWithConfig[pluginName]];
                console.log(chalk.green(`  -> Updated ${pluginName} plugin with configuration.`));
            } else if (forceStandardConfigPlugins.has(pluginName)) {
                // Para projetos novos, o template do Expo pode vir com expo-splash-screen
                // já configurado com outros defaults. Mantemos o splash padronizado.
                if (JSON.stringify(existingPlugin[1]) === JSON.stringify(pluginsWithConfig[pluginName])) {
                    console.log(chalk.yellow(`  -> Plugin ${pluginName} already configured.`));
                } else {
                    config.expo.plugins[existingPluginIndex] = [pluginName, pluginsWithConfig[pluginName]];
                    console.log(chalk.green(`  -> Updated ${pluginName} plugin with standard configuration.`));
                }
            } else {
                console.log(chalk.yellow(`  -> Plugin ${pluginName} already configured.`));
            }
        }
    });

    // Configure Android permissions
    config.expo.android = config.expo.android || {};
    config.expo.android.permissions = config.expo.android.permissions || [];

    const adIdPermission = "com.google.android.gms.permission.AD_ID";
    if (!config.expo.android.permissions.includes(adIdPermission)) {
        config.expo.android.permissions.push(adIdPermission);
        console.log(chalk.green(`  -> Added Android permission: ${adIdPermission}`));
    } else {
        console.log(chalk.yellow(`  -> Android permission ${adIdPermission} already configured.`));
    }

    // Configure iOS tablet support (iPad)
    config.expo.ios = config.expo.ios || {};
    if (config.expo.ios.supportsTablet !== true) {
        config.expo.ios.supportsTablet = true;
        console.log(chalk.green(`  -> Set 'supportsTablet' to true in ios.`));
    } else {
        console.log(chalk.yellow(`  -> 'supportsTablet' already enabled in ios.`));
    }

    // Deixa o array de plugins ordenado: strings primeiro, depois os com config.
    sortPlugins(config);

    writeAppConfig(config);
    console.log(chalk.green("✅ Plugin configuration step complete."));
}

function handleLayoutFlag() {
    console.log(chalk.cyan("📝 Replacing root layout file..."));

    const layoutTemplatePath = path.join(
        moduleDir,
        "templates",
        "RootLayout.tsx",
    );
    if (!fs.existsSync(layoutTemplatePath)) {
        console.error(chalk.red("❌ Could not find RootLayout.tsx template in the expo-utils module."));
        return;
    }
    const layoutContent = fs.readFileSync(layoutTemplatePath, "utf-8");

    const path1 = path.join(projectRoot, "app", "_layout.tsx");
    const path2 = path.join(projectRoot, "src", "app", "_layout.tsx");

    if (fs.existsSync(path2)) {
        fs.writeFileSync(path2, layoutContent);
        console.log(chalk.green(`✅ Replaced ${path2}`));
    } else if (fs.existsSync(path1)) {
        fs.writeFileSync(path1, layoutContent);
        console.log(chalk.green(`✅ Replaced ${path1}`));
    } else {
        console.error(
            chalk.red(
                "❌ Could not find an existing layout file at app/_layout.tsx or src/app/_layout.tsx. The template was not applied.",
            ),
        );
    }
}

function handleSrcAppFlag() {
    console.log(chalk.cyan("📁 Moving app directory to src/app..."));
    const oldPath = path.join(projectRoot, "app");
    const newDirPath = path.join(projectRoot, "src");
    const newPath = path.join(newDirPath, "app");

    if (!fs.existsSync(oldPath)) {
        console.error(chalk.red(`❌ Directory not found at ${oldPath}.`));
        return;
    }
    if (fs.existsSync(newPath)) {
        console.error(chalk.red(`❌ Directory already exists at ${newPath}. Aborting.`));
        return;
    }
    ensureDirExists(newDirPath);
    fs.renameSync(oldPath, newPath);
    console.log(chalk.green(`✅ Moved ${oldPath} to ${newPath}.`));
}

function handleLanguagesFlag() {
    console.log(chalk.cyan("🌐 Setting up language files..."));

    const config = getAppConfig();
    if (!config) return;

    const langDir = path.join(projectRoot, "languages");
    ensureDirExists(langDir);

    const baseAppName = config.expo?.name || "MyApp";
    const languages = {
        pt: {
            name: `${baseAppName}`,
            file: "pt.json",
            tracking:
                "Precisamos da sua permissão para personalizar sua experiência com anúncios e conteúdos relevantes. Seus dados nos ajudam a melhorar as recomendações e garantir que você veja o que é mais interessante para você.",
            photo: "Este app pode acessar suas fotos para você selecionar e compartilhar imagens.",
            photoAdd: "Este app pode salvar imagens na sua galeria de fotos.",
            camera: "Este app pode usar a câmera para capturar e compartilhar fotos.",
        },
        en: {
            name: `${baseAppName}`,
            file: "en.json",
            tracking:
                "We need your permission to personalize your experience with relevant ads and content. Your data helps us improve recommendations and ensure you see what's most interesting to you.",
            photo: "This app may access your photos so you can select and share images.",
            photoAdd: "This app may save images to your photo library.",
            camera: "This app may use the camera to capture and share photos.",
        },
        es: {
            name: `${baseAppName}`,
            file: "es.json",
            tracking:
                "Necesitamos tu permiso para personalizar tu experiencia con anuncios y contenido relevantes. Tus datos nos ayudan a mejorar las recomendaciones y garantizar que veas lo que más te interesa.",
            photo: "Esta app puede acceder a tus fotos para que selecciones y compartas imágenes.",
            photoAdd: "Esta app puede guardar imágenes en tu galería de fotos.",
            camera: "Esta app puede usar la cámara para capturar y compartir fotos.",
        },
    };

    Object.keys(languages).forEach((langCode) => {
        const langInfo = languages[langCode];
        const filePath = path.join(langDir, langInfo.file);
        // Chaves do Info.plist localizadas (viram InfoPlist.strings por idioma via expo.locales).
        // As NS*UsageDescription espelham os defaults injetados no Info.plist base por app.plugin.js.
        const iosStrings = {
            CFBundleDisplayName: langInfo.name,
            NSUserTrackingUsageDescription: langInfo.tracking,
            NSPhotoLibraryUsageDescription: langInfo.photo,
            NSPhotoLibraryAddUsageDescription: langInfo.photoAdd,
            NSCameraUsageDescription: langInfo.camera,
        };

        if (!fs.existsSync(filePath)) {
            const localizedConfig = {
                ios: iosStrings,
                android: {app_name: langInfo.name},
            };
            fs.writeFileSync(filePath, JSON.stringify(localizedConfig, null, 2));
            console.log(chalk.green(`  -> Created ${filePath} with localized names + purpose strings.`));
        } else {
            // Arquivo já existe: mescla só as chaves que faltam (ex.: novas purpose strings),
            // sem sobrescrever o que o dev já traduziu (nome, tracking, etc.).
            try {
                const existing = JSON.parse(fs.readFileSync(filePath, "utf-8")) || {};
                existing.ios = existing.ios || {};
                existing.android = existing.android || {};
                let added = 0;
                for (const [k, v] of Object.entries(iosStrings)) {
                    if (existing.ios[k] === undefined) {
                        existing.ios[k] = v;
                        added++;
                    }
                }
                if (existing.android.app_name === undefined) existing.android.app_name = langInfo.name;
                if (added > 0) {
                    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
                    console.log(chalk.green(`  -> Updated ${filePath} (+${added} chave(s) que faltavam).`));
                } else {
                    console.log(chalk.gray(`  -> ${filePath} já completo. Skipping.`));
                }
            } catch (e) {
                console.warn(chalk.yellow(`  -> Não consegui mesclar ${filePath}: ${e.message}`));
            }
        }
    });

    // Configure app.json
    config.expo = config.expo || {};

    // 1. Add assetBundlePatterns
    config.expo.assetBundlePatterns = config.expo.assetBundlePatterns || ["**/*"];
    const pattern = "languages/*";
    if (!config.expo.assetBundlePatterns.includes(pattern)) {
        config.expo.assetBundlePatterns.push(pattern);
        console.log(chalk.green(`  -> Added '${pattern}' to assetBundlePatterns.`));
    }

    // 2. Configure iOS Info.plist for mixed localizations
    config.expo.ios = config.expo.ios || {};
    config.expo.ios.infoPlist = config.expo.ios.infoPlist || {};
    if (!config.expo.ios.infoPlist.CFBundleAllowMixedLocalizations) {
        config.expo.ios.infoPlist.CFBundleAllowMixedLocalizations = true;
        console.log(chalk.green(`  -> Set 'CFBundleAllowMixedLocalizations' in ios.infoPlist.`));
    }
    if (!config.expo.ios.infoPlist.UIBackgroundModes || !config.expo.ios.infoPlist.UIBackgroundModes.includes("remote-notification")) {
        config.expo.ios.infoPlist.UIBackgroundModes = config.expo.ios.infoPlist.UIBackgroundModes || [];
        if (!config.expo.ios.infoPlist.UIBackgroundModes.includes("remote-notification")) {
            config.expo.ios.infoPlist.UIBackgroundModes.push("remote-notification");
        }
        console.log(chalk.green(`  -> Added 'remote-notification' to UIBackgroundModes in ios.infoPlist.`));
    }

    // 3. Configure locales mapping
    config.expo.locales = config.expo.locales || {};
    Object.keys(languages).forEach((langCode) => {
        const langFile = languages[langCode].file;
        const localePath = `./languages/${langFile}`;
        if (config.expo.locales[langCode] !== localePath) {
            config.expo.locales[langCode] = localePath;
            console.log(chalk.green(`  -> Mapped locale '${langCode}' to '${localePath}'.`));
        }
    });

    writeAppConfig(config);
    console.log(chalk.green("✅ Advanced language setup complete."));
}

function handleSkadnetworkFlag() {
    console.log(chalk.cyan("📊 Limpando SKAdNetworkItems do app.json..."));
    const config = getAppConfig();
    if (!config) return;

    // Os IDs agora são injetados no Info.plist pelo config plugin do expo-utils durante o
    // prebuild (ver app.plugin.js). Então não precisam mais ficar no app.json.
    const infoPlist = config.expo && config.expo.ios && config.expo.ios.infoPlist;
    const existing =
        infoPlist && Array.isArray(infoPlist.SKAdNetworkItems) ? infoPlist.SKAdNetworkItems : null;

    if (!existing || existing.length === 0) {
        console.log(
            chalk.yellow(
                "  -> Nenhum SKAdNetworkItems no app.json — o plugin expo-utils injeta os IDs no prebuild automaticamente.",
            ),
        );
        console.log(chalk.green("✅ SKAdNetwork gerenciado pelo config plugin (app.json limpo)."));
        return;
    }

    // Carrega a lista que o plugin injeta — só removemos do app.json os IDs cobertos por ela.
    // IDs customizados (fora da lista) ficam no app.json pra não sumirem do build.
    let pluginIds = new Set();
    const skadNetworkItemsPath = path.join(moduleDir, "data", "skadnetwork_ids.json");
    if (fs.existsSync(skadNetworkItemsPath)) {
        pluginIds = new Set(
            require(skadNetworkItemsPath).map((i) => (i.SKAdNetworkIdentifier || "").toLowerCase()),
        );
    }

    const kept = existing.filter((item) => {
        const id = item && item.SKAdNetworkIdentifier;
        return !(typeof id === "string" && pluginIds.has(id.toLowerCase()));
    });
    const removed = existing.length - kept.length;

    if (kept.length > 0) {
        infoPlist.SKAdNetworkItems = kept;
        console.log(
            chalk.green(
                `  -> Removidos ${removed} SKAdNetworkItems cobertos pelo plugin; mantidos ${kept.length} customizados no app.json.`,
            ),
        );
    } else {
        delete infoPlist.SKAdNetworkItems;
        console.log(
            chalk.green(
                `  -> Removidos ${removed} SKAdNetworkItems do app.json (agora injetados pelo plugin no prebuild).`,
            ),
        );
    }
    writeAppConfig(config);
    console.log(chalk.green("✅ SKAdNetwork gerenciado pelo config plugin (app.json limpo)."));
}

function handleFirebasePlaceholdersFlag() {
    console.log(chalk.cyan("🔥 Creating Firebase placeholder files..."));
    const config = getAppConfig();
    if (!config) return;

    // Get identifiers from app.json
    const androidPackage = config.expo?.android?.package;
    const iosBundleId = config.expo?.ios?.bundleIdentifier;

    // Log what we found and warn if missing
    if (androidPackage) {
        console.log(chalk.gray(`  -> Using Android package: ${androidPackage}`));
    } else {
        console.log(chalk.yellow(`  -> ⚠️  Android package not found. Using a placeholder.`));
        console.log(chalk.yellow(`     You MUST set 'expo.android.package' in your app.json for Firebase to work.`));
    }

    if (iosBundleId) {
        console.log(chalk.gray(`  -> Using iOS bundleIdentifier: ${iosBundleId}`));
    } else {
        console.log(chalk.yellow(`  -> ⚠️  iOS bundleIdentifier not found. Using a placeholder.`));
        console.log(
            chalk.yellow(`     You MUST set 'expo.ios.bundleIdentifier' in your app.json for Firebase to work.`),
        );
    }

    const finalAndroidPackage = androidPackage || "com.placeholder.app";
    const finalIosBundleId = iosBundleId || "com.placeholder.app";


    // --- Android Placeholder ---
    const googleServicesJsonPath = path.join(projectRoot, "google-services.json");
    if (!fs.existsSync(googleServicesJsonPath)) {
        const templatePath = path.join(moduleDir, "templates", "google-services.template.json");
        if (fs.existsSync(templatePath)) {
            const template = fs.readFileSync(templatePath, "utf-8");
            const content = template.replace(/\$\{androidPackage\}/g, finalAndroidPackage);
            fs.writeFileSync(googleServicesJsonPath, content);
            console.log(chalk.green(`  -> Created placeholder google-services.json`));
        } else {
            console.error(chalk.red("❌ google-services.template.json not found in expo-utils module."));
        }
    } else {
        console.log(chalk.yellow(`  -> File google-services.json already exists. Skipping.`));
    }

    // --- iOS Placeholder ---
    const googleServicesPlistPath = path.join(projectRoot, "GoogleService-Info.plist");
    if (!fs.existsSync(googleServicesPlistPath)) {
        const templatePath = path.join(moduleDir, "templates", "GoogleService-Info.template.plist");
        if (fs.existsSync(templatePath)) {
            const template = fs.readFileSync(templatePath, "utf-8");
            const content = template.replace(/\$\{iosBundleId\}/g, finalIosBundleId);
            fs.writeFileSync(googleServicesPlistPath, content);
            console.log(chalk.green(`  -> Created placeholder GoogleService-Info.plist`));
        } else {
            console.error(chalk.red("❌ GoogleService-Info.template.plist not found in expo-utils module."));
        }
    } else {
        console.log(chalk.yellow(`  -> File GoogleService-Info.plist already exists. Skipping.`));
    }

    // --- Update app.json to point to these files ---
    config.expo = config.expo || {};
    config.expo.ios = config.expo.ios || {};
    config.expo.android = config.expo.android || {};

    // Set placeholder values in app.json if not present
    if (!androidPackage) {
        config.expo.android.package = "com.placeholder.app";
        console.log(chalk.green(`  -> Set 'expo.android.package' to 'com.placeholder.app' in app.json.`));
    }
    if (!iosBundleId) {
        config.expo.ios.bundleIdentifier = "com.placeholder.app";
        console.log(chalk.green(`  -> Set 'expo.ios.bundleIdentifier' to 'com.placeholder.app' in app.json.`));
    }

    if (config.expo.ios.googleServicesFile !== "./GoogleService-Info.plist") {
        config.expo.ios.googleServicesFile = "./GoogleService-Info.plist";
        console.log(chalk.green(`  -> Updated 'ios.googleServicesFile' in app.json.`));
    }
    if (config.expo.android.googleServicesFile !== "./google-services.json") {
        config.expo.android.googleServicesFile = "./google-services.json";
        console.log(chalk.green(`  -> Updated 'android.googleServicesFile' in app.json.`));
    }

    writeAppConfig(config);

    console.log(chalk.green("✅ Firebase placeholder step complete."));
}

/**
 * Remove um `ios.icon` que aponta para um arquivo/diretório inexistente (referência quebrada).
 * Esse caso faz o `actool` falhar no prebuild com "attempt to insert nil object from objects[0]",
 * porque o AppIcon.appiconset é gerado com um slot sem `filename`.
 * Só remove se existir um `icon` raiz válido para servir de fallback; caso contrário, apenas avisa
 * (não deixa o app sem ícone nenhum).
 * @returns {boolean} true se alterou o config.
 */
function fixBrokenIosIcon(config) {
    const ios = config.expo && config.expo.ios;
    const iosIcon = ios && ios.icon;
    if (typeof iosIcon !== "string" || iosIcon.trim() === "") return false;

    const resolved = path.resolve(projectRoot, iosIcon);
    if (fs.existsSync(resolved)) return false; // ícone custom existe → intenção legítima, não mexe.

    // Referência quebrada: o iOS cai no `icon` raiz se ele existir e for válido.
    const rootIcon = config.expo && config.expo.icon;
    const rootResolved =
        typeof rootIcon === "string" && rootIcon.trim() !== "" ? path.resolve(projectRoot, rootIcon) : null;

    if (!rootResolved || !fs.existsSync(rootResolved)) {
        console.log(
            chalk.yellow(
                `  -> ⚠️  'ios.icon' aponta para '${iosIcon}', que não existe, e não há 'icon' raiz válido como fallback.`,
            ),
        );
        console.log(
            chalk.yellow(
                `     Defina um ícone válido (ex.: "icon": "./assets/images/icon.png") para evitar a falha do actool no build.`,
            ),
        );
        return false;
    }

    delete ios.icon;
    console.log(
        chalk.green(
            `  -> Removido 'ios.icon' ('${iosIcon}' não existe — quebraria o actool no prebuild). iOS usará o 'icon' raiz: ${rootIcon}.`,
        ),
    );
    return true;
}

/**
 * Remove entradas duplicadas de arrays de strings no infoPlist (ex.: UIBackgroundModes),
 * preservando a ordem. Não toca em arrays de objetos como SKAdNetworkItems (ver --skadnetwork).
 * @returns {boolean} true se alterou o config.
 */
function dedupeInfoPlistArrays(config) {
    const infoPlist = config.expo && config.expo.ios && config.expo.ios.infoPlist;
    if (!infoPlist || typeof infoPlist !== "object") return false;

    let changed = false;
    for (const key of Object.keys(infoPlist)) {
        const value = infoPlist[key];
        if (!Array.isArray(value) || value.length === 0) continue;
        if (!value.every((v) => typeof v === "string")) continue; // só arrays de strings simples.

        const deduped = [...new Set(value)];
        if (deduped.length !== value.length) {
            infoPlist[key] = deduped;
            changed = true;
            console.log(
                chalk.green(
                    `  -> Removida(s) ${value.length - deduped.length} entrada(s) duplicada(s) em infoPlist.${key}.`,
                ),
            );
        }
    }
    return changed;
}

function handleExpoIconFlag() {
    console.log(chalk.cyan("🎨 Verificando o ícone do iOS (ios.icon)..."));
    const config = getAppConfig();
    if (!config) return;

    if (fixBrokenIosIcon(config)) {
        writeAppConfig(config);
    }
    console.log(chalk.green("✅ Verificação do ícone iOS concluída."));
}

function handleIosBuildFixFlag() {
    console.log(chalk.cyan("🔧 Applying iOS build fixes and configurations..."));
    const config = getAppConfig();
    if (!config) return;

    config.expo = config.expo || {};
    config.expo.ios = config.expo.ios || {};

    // --- Configure build properties for Firebase (pela major do RNFirebase instalado no app) ---
    const projectPkgPath = path.join(projectRoot, "package.json");
    const projectPkg = fs.existsSync(projectPkgPath) ? JSON.parse(fs.readFileSync(projectPkgPath, "utf-8")) : {};
    const rnfbMajor = packageMajor(projectPkg, "@react-native-firebase/app");
    const {added, spm} = applyBuildProperties(config, rnfbMajor);
    const variant = spm
        ? `RNFirebase ${rnfbMajor}: useFrameworks "dynamic", forceStaticLinking ${RNFB_SPM_FORCE_STATIC.join(" + ")}, Kotlin ${RNFB_SPM_KOTLIN_VERSION}`
        : `RNFirebase ${rnfbMajor === null ? "não encontrado (usando o padrão 24–26)" : rnfbMajor}: useFrameworks "static", RNFB* no forceStaticLinking`;
    console.log(chalk.green(`  -> ${added ? "Added" : "Updated"} expo-build-properties — ${variant}.`));

    // --- Configure entitlements for Push Notifications ---
    config.expo.ios.entitlements = config.expo.ios.entitlements || {};
    if (config.expo.ios.entitlements["aps-environment"] !== "production") {
        config.expo.ios.entitlements["aps-environment"] = "production";
        console.log(chalk.green('  -> Set "aps-environment" to "production" for Push Notifications.'));
    }

    // --- Dedupe de arrays do infoPlist (ex.: UIBackgroundModes); o fix do ícone fica no --expo-icon ---
    dedupeInfoPlistArrays(config);

    writeAppConfig(config);
    console.log(chalk.green("✅ iOS build configurations applied."));
}

function handleTrackingPermissionFlag() {
    console.log(chalk.cyan("🔒 Configuring Tracking Transparency permission..."));
    const config = getAppConfig();
    if (!config) return;

    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];

    const pluginName = "expo-tracking-transparency";

    // Find the index of the expo-tracking-transparency plugin
    const trackingIndex = config.expo.plugins.findIndex((p) =>
        (Array.isArray(p) && p[0] === pluginName) || p === pluginName
    );

    const trackingConfig = {
        userTrackingPermission:
            "We need your permission to personalize your experience with relevant ads and content. Your data helps us improve recommendations and ensure you see what's most interesting to you.",
    };

    if (trackingIndex !== -1) {
        const existingPlugin = config.expo.plugins[trackingIndex];

        // Handle both array and string formats
        if (Array.isArray(existingPlugin)) {
            // Merge with existing configuration
            existingPlugin[1] = {
                ...existingPlugin[1],  // Keep existing config
                ...trackingConfig      // Add our required config
            };
            config.expo.plugins[trackingIndex] = existingPlugin;
        } else {
            // Convert string format to array format with configuration
            config.expo.plugins[trackingIndex] = [pluginName, trackingConfig];
        }
        console.log(chalk.green(`  -> Updated ${pluginName} plugin configuration.`));
    } else {
        // Plugin doesn't exist, add it
        config.expo.plugins.push([pluginName, trackingConfig]);
        console.log(chalk.green(`  -> Added and configured ${pluginName} plugin.`));
    }

    writeAppConfig(config);
    console.log(chalk.green("✅ Tracking permission setup complete."));
}

function handleEasConfigFlag() {
    console.log(chalk.cyan("🚀 Configuring EAS Build and Updates..."));
    const config = getAppConfig();
    if (!config) return;

    config.expo = config.expo || {};

    // --- Rebuild expo object to control property order ---
    const oldExpo = config.expo;
    const newExpo = {};
    let runtimeVersionInjected = false;

    // Rebuild the object, injecting runtimeVersion after version
    for (const key in oldExpo) {
        newExpo[key] = oldExpo[key];
        if (key === "version" && !oldExpo.runtimeVersion) {
            newExpo.runtimeVersion = "1.0.0";
            console.log(chalk.green(`  -> Set "runtimeVersion" to "1.0.0" after "version".`));
            runtimeVersionInjected = true;
        }
    }

    // If version didn't exist, but runtimeVersion also doesn't, add it.
    if (!runtimeVersionInjected && !oldExpo.runtimeVersion) {
        newExpo.runtimeVersion = "1.0.0";
        console.log(chalk.green(`  -> Set "runtimeVersion" to "1.0.0".`));
    }

    // --- Configure other expo properties ---
    newExpo.extra = newExpo.extra || {};
    newExpo.extra.router = newExpo.extra.router || {};
    if (newExpo.extra.router.origin !== false) {
        newExpo.extra.router.origin = false;
        console.log(chalk.green(`  -> Set "extra.router.origin" to false.`));
    }

    // NÃO preenchemos extra.eas.projectId com um placeholder: o projectId é POR PROJETO no
    // EAS (1:1 com um projeto real na conta do dev) — usar um valor fixo/compartilhado faz
    // apps novos apontarem para o projeto EAS de OUTRO app (builds/updates cruzados entre
    // apps diferentes). Deixe o `eas init`/primeiro `eas build` popular isso (junto com
    // `extra.owner`) quando o dev de fato linkar o app a um projeto EAS real.
    // Limpa apenas o placeholder ANTIGO (versões anteriores do expo-utils injetavam esse
    // valor fixo) — um projectId real já presente (de um `eas init` anterior) não é tocado.
    const STALE_PLACEHOLDER_PROJECT_ID = "df0dc510-fafe-4076-9ea7-6926d54cb2ab";
    if (newExpo.extra.eas?.projectId === STALE_PLACEHOLDER_PROJECT_ID) {
        delete newExpo.extra.eas.projectId;
        if (Object.keys(newExpo.extra.eas).length === 0) delete newExpo.extra.eas;
        console.log(chalk.yellow(`  -> Removed stale placeholder "extra.eas.projectId" (each app needs its own — run 'eas init' or 'eas build').`));
    }

    if (newExpo.updates) {
        delete newExpo.updates;
        console.log(chalk.green(`  -> Removed "updates" block (not needed with Hot Updater).`));
    }

    if (!newExpo.experiments?.buildCacheProvider) {
        newExpo.experiments = newExpo.experiments || {};
        newExpo.experiments.buildCacheProvider = "eas";
        console.log(chalk.green(`  -> Set "experiments.buildCacheProvider" to "eas".`));
    }

    config.expo = newExpo;

    // Garante eas-build-cache-provider (obrigatório). Já é peerDependency do expo-utils, então
    // o check de deps o instala em "dependencies". Aqui só adicionamos em devDependencies se ele
    // não estiver em NENHUM lugar (evita duplicar em dependencies E devDependencies).
    const projectPkgPath = path.join(projectRoot, "package.json");
    const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, "utf-8"));
    projectPkg.devDependencies = projectPkg.devDependencies || {};
    const alreadyHasCacheProvider =
        (projectPkg.dependencies && projectPkg.dependencies["eas-build-cache-provider"]) ||
        projectPkg.devDependencies["eas-build-cache-provider"];
    if (!alreadyHasCacheProvider) {
        projectPkg.devDependencies["eas-build-cache-provider"] = ">=20.0.0";
        fs.writeFileSync(projectPkgPath, JSON.stringify(projectPkg, null, 2));
        console.log(chalk.green(`  -> Added "eas-build-cache-provider" to devDependencies.`));
    }
    writeAppConfig(config);

    // --- Create eas.json ---
    const easJsonPath = path.join(projectRoot, "eas.json");
    const easConfig = {
        cli: {
            version: ">= 13.2.0",
            appVersionSource: "remote",
        },
        build: {
            development: {
                developmentClient: true,
                distribution: "internal",
            },
            preview: {
                distribution: "internal",
            },
            production: {
                autoIncrement: true,
            },
        },
        submit: {
            production: {},
        },
    };

    if (!fs.existsSync(easJsonPath)) {
        fs.writeFileSync(easJsonPath, JSON.stringify(easConfig, null, 2));
        console.log(chalk.green(`  -> Created eas.json file.`));
    } else {
        console.log(chalk.yellow(`  -> File eas.json already exists. Skipping creation.`));
    }

    // --- Create .easignore ---
    const easIgnorePath = path.join(projectRoot, ".easignore");
    const easIgnoreContent = `/android
/ios
/docs
/coverage
/resources
/.vscode
/.git
/.expo
/fastlane
.psd
.easignore
.gitignore
.DS_Store
fingerprint.config.js
package-lock.json
rc-config-screens.json
rc-config-utils.json
policy.lock.json
bun.lock`;

    if (!fs.existsSync(easIgnorePath)) {
        fs.writeFileSync(easIgnorePath, easIgnoreContent);
        console.log(chalk.green(`  -> Created .easignore file.`));
    } else {
        console.log(chalk.yellow(`  -> File .easignore already exists. Skipping creation.`));
    }

    console.log(chalk.green("✅ EAS configuration complete."));
}

function handleConstantsFlag(hotUpdaterGeneration = 0) {
    console.log(chalk.cyan("📁 Creating constants folder..."));
    // Verifica se o projeto usa estrutura src
    const srcAppExists = fs.existsSync(path.join(projectRoot, "src", "app"));
    const appExists = fs.existsSync(path.join(projectRoot, "app"));
    let constantsPath;
    if (srcAppExists) {
        constantsPath = path.join(projectRoot, "src", "constants");
    } else if (appExists) {
        constantsPath = path.join(projectRoot, "constants");
    } else {
        constantsPath = path.join(projectRoot, "constants");
    }
    ensureDirExists(constantsPath);
    console.log(chalk.green(`  -> Created constants directory at: ${path.relative(projectRoot, constantsPath)}`));

    // Copy Strings.ts template
    const stringsTemplatePath = path.join(moduleDir, "templates", "Strings.ts");
    const stringsDestPath = path.join(constantsPath, "Strings.ts");
    if (fs.existsSync(stringsTemplatePath) && !fs.existsSync(stringsDestPath)) {
        fs.copyFileSync(stringsTemplatePath, stringsDestPath);
        console.log(chalk.green(`  -> Created ${path.relative(projectRoot, stringsDestPath)} from template.`));
        // O template vem no formato do v0; no v1 (--hot-updater-v1 ou 1.x no app) ganha a URL de exemplo e a chave.
        if (hotUpdaterGeneration === 1) applyHotUpdaterV1ToStringsFile(stringsDestPath);
    } else if (fs.existsSync(stringsDestPath)) {
        console.log(chalk.yellow(`  -> Strings.ts already exists, skipping.`));
    }

    console.log(chalk.green("✅ Constants setup complete."));
}

function handleClaudeMdFlag() {
    // AGENTS.md tem o conteúdo; CLAUDE.md é só o ponteiro `@AGENTS.md`.
    ["AGENTS.md", "CLAUDE.md"].forEach((fileName) => {
        const srcPath = path.join(moduleDir, "templates", fileName);
        const destPath = path.join(projectRoot, fileName);

        if (!fs.existsSync(srcPath)) return;

        if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(chalk.green(`📄 Created ${fileName} in project root.`));
        } else {
            console.log(chalk.yellow(`📄 ${fileName} already exists. Skipping.`));
        }
    });
}

// Bloco aditivo para apps que já tinham AGENTS.md próprio (handleClaudeMdFlag não sobrescreve):
// sem o ponteiro, o agente nunca fica sabendo do arquivo de policies.
const POLICY_CHECKS_POINTER = `<!-- expo-utils:policy-checks -->
## POLICY CHECKS — ler \`.claude/POLICY-CHECKS.md\`

Lista de regras de review que **já derrubaram build de verdade** (Apple/Google), mantida pelo
\`expo-utils\` e atualizada com o tempo. **Ler o arquivo inteiro antes de todo build de submissão**
(\`eas build --profile production\`, \`fastlane\`, bump de versão) e antes de escrever/alterar
qualquer fluxo que ele cubra (permissões, paywall, ads). Nunca dê uma submissão como pronta sem
essa leitura nesta sessão.

Não edite a cópia local — ela é sobrescrita pelo \`expo-utils-install\`. Regra nova vai em
\`templates/POLICY-CHECKS.md\`, no repo do \`expo-utils\`.
<!-- /expo-utils:policy-checks -->`;

function handlePolicyChecksFlag() {
    const srcPath = path.join(moduleDir, "templates", "POLICY-CHECKS.md");
    if (!fs.existsSync(srcPath)) return;

    // Arquivo GERADO (não editável no app): sempre sincroniza, senão a lista congela na
    // versão em que o app foi criado — que é justamente o que a lista existe para evitar.
    const claudeDir = path.join(projectRoot, ".claude");
    ensureDirExists(claudeDir);
    const destPath = path.join(claudeDir, "POLICY-CHECKS.md");
    const source = fs.readFileSync(srcPath, "utf8");
    const current = fs.existsSync(destPath) ? fs.readFileSync(destPath, "utf8") : null;

    if (current === source) {
        console.log(chalk.gray("📄 .claude/POLICY-CHECKS.md já está atualizado."));
    } else {
        fs.writeFileSync(destPath, source);
        console.log(
            chalk.green(`📄 ${current === null ? "Created" : "Updated"} .claude/POLICY-CHECKS.md.`),
        );
    }

    const agentsPath = path.join(projectRoot, "AGENTS.md");
    if (!fs.existsSync(agentsPath)) return;
    const agents = fs.readFileSync(agentsPath, "utf8");
    if (agents.includes("POLICY-CHECKS.md")) return; // template novo já cita (REGRA 6)

    fs.writeFileSync(agentsPath, `${agents.replace(/\s*$/, "")}\n\n${POLICY_CHECKS_POINTER}\n`);
    console.log(chalk.green("  -> AGENTS.md: adicionado ponteiro para .claude/POLICY-CHECKS.md."));
}

function handleGitignoreFlag() {
    console.log(chalk.cyan("📁 Atualizando .gitignore..."));
    const gitignorePath = path.join(projectRoot, ".gitignore");
    let content = "";
    if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, "utf8");
    }
    const linesToAdd = [
        "package-lock.json",
        "policy.lock.json",
        "fingerprint.config.js",
        "bun.lock",
        ".idea/",
        ".vscode/",
        "app-example",
        "fastlane/shared/screenshots/__pycache__/",
        "fastlane/android/fastlane/screenshots/generated",
        "fastlane/ios/fastlane/screenshots/generated",
        "fastlane/Gemfile.lock",
        "fastlane/ios/fastlane/report.xml",
    ];
    linesToAdd.forEach((line) => {
        if (!content.includes(line)) {
            content += `\n${line}`;
        }
    });
    fs.writeFileSync(gitignorePath, content.trim() + "\n");
    console.log(chalk.green("✅ Atualizado .gitignore com ios/ e android/."));
}

const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

/** Spec de v0 que deixaria entrar a 1.x num install novo (">=0.35.3", "*", "latest"…). */
function hotUpdaterSpecAdmitsV1(spec) {
    const value = String(spec).trim();
    return ["", "*", "x", "latest"].includes(value) || (/^>=?\s*0\./.test(value) && !value.includes("<"));
}

/**
 * Deixa os pacotes do Hot Updater do app na MESMA geração: os de HOT_UPDATER_PACKAGES que faltam entram com o
 * range da geração, e os já declarados (inclusive outros @hot-updater/*, como o cloudflare) de outra geração —
 * ou um v0 sem teto, que resolveria a 1.x — passam a usar esse range.
 * @returns {string[]} o que mudou, para o log
 */
function alignHotUpdaterDependencies(projectPkg, generation) {
    const range = HOT_UPDATER_RANGES[generation];
    const changes = [];
    projectPkg.dependencies = projectPkg.dependencies || {};
    const declared = DEP_FIELDS.flatMap((field) => Object.keys(projectPkg[field] || {}));
    const names = [...new Set([...HOT_UPDATER_PACKAGES, ...declared.filter((name) => name.startsWith("@hot-updater/"))])];
    for (const name of names) {
        const field = DEP_FIELDS.find((f) => projectPkg[f] && typeof projectPkg[f][name] === "string");
        if (!field) {
            if (HOT_UPDATER_PACKAGES.includes(name)) {
                projectPkg.dependencies[name] = range;
                changes.push(`${name}@${range}`);
            }
            continue;
        }
        const spec = projectPkg[field][name];
        const major = majorOf(spec);
        const wrongGeneration = major !== null && (major >= 1 ? 1 : 0) !== generation;
        if (wrongGeneration || (generation === 0 && hotUpdaterSpecAdmitsV1(spec))) {
            projectPkg[field][name] = range;
            changes.push(`${name}: ${spec} → ${range}`);
        }
    }
    return changes;
}

/**
 * Deixa no app.json só o plugin do Hot Updater da geração (v0: @hot-updater/react-native; v1: @hot-updater/expo),
 * levando as opções (channel, publicKeyPath…) do plugin da outra geração. Sem channel: "production".
 */
function applyHotUpdaterPlugin(config, generation) {
    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];
    const wanted = HOT_UPDATER_PLUGINS[generation];
    const other = HOT_UPDATER_PLUGINS[generation === 1 ? 0 : 1];
    const nameOf = (p) => (Array.isArray(p) ? p[0] : p);
    const optionsOf = (p) => (Array.isArray(p) && p[1] && typeof p[1] === "object" ? p[1] : {});
    const plugins = config.expo.plugins;
    const otherIndex = plugins.findIndex((p) => nameOf(p) === other);
    const index = plugins.findIndex((p) => nameOf(p) === wanted);
    const entry = [
        wanted,
        {
            channel: "production",
            ...(otherIndex !== -1 ? optionsOf(plugins[otherIndex]) : {}),
            ...(index !== -1 ? optionsOf(plugins[index]) : {}),
        },
    ];
    if (index !== -1) plugins[index] = entry;
    else if (otherIndex !== -1) plugins[otherIndex] = entry; // no lugar do plugin da outra geração
    else plugins.push(entry);
    config.expo.plugins = plugins.filter((p) => nameOf(p) !== other);
    return {added: index === -1, replaced: otherIndex !== -1 ? other : null};
}

/** Acrescenta ao .env as chaves do template que faltam, sem mexer nas que já existem. */
function mergeEnvKeys(current, template, header) {
    const keyOf = (line) => (line.match(/^\s*([A-Za-z0-9_]+)\s*=/) || [])[1];
    const existing = new Set(current.split(/\r?\n/).map(keyOf).filter(Boolean));
    const missing = template.split(/\r?\n/).filter((line) => keyOf(line) && !existing.has(keyOf(line)));
    if (!missing.length) return {source: current, added: []};
    return {
        source: `${current.replace(/\s*$/, "")}\n\n${header}\n${missing.join("\n")}\n`,
        added: missing.map(keyOf),
    };
}

/** HOT_UPDATER_API_KEY do .env.hotupdater do app (a chave de cliente do servidor v1), ou "". */
function hotUpdaterApiKeyFromEnv() {
    try {
        const env = fs.readFileSync(path.join(projectRoot, ".env.hotupdater"), "utf-8");
        const match = env.match(/^\s*HOT_UPDATER_API_KEY\s*=\s*["']?([^"'\r\n#]*)["']?/m);
        const key = match ? match[1].trim() : "";
        return key && !/^YOUR[_-]/i.test(key) ? key : "";
    } catch {
        return "";
    }
}

function findStringsFile() {
    for (const candidate of [path.join(projectRoot, "src", "constants", "Strings.ts"), path.join(projectRoot, "constants", "Strings.ts")]) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

/**
 * Strings.ts para o Hot Updater v1: garante o `hotUpdaterApiKey` (logo depois do `hotUpdaterUrl`, preenchido
 * com a HOT_UPDATER_API_KEY quando ela existe) e troca a URL de EXEMPLO do v0 pela de exemplo do v1. URL real de
 * v0 fica como está e vira aviso: o v1 é OUTRO Worker, e tirar o `/api/check-update` apontaria para o servidor v0.
 */
function hotUpdaterV1Strings(source, apiKey) {
    let out = source;
    const warnings = [];
    if (out.includes(HOT_UPDATER_V0_STRINGS_PLACEHOLDER)) {
        out = out.split(HOT_UPDATER_V0_STRINGS_PLACEHOLDER).join(HOT_UPDATER_V1_STRINGS_PLACEHOLDER);
    } else if (/hotUpdaterUrl\s*[:=]\s*["'`][^"'`]*\/api\/check-update/.test(out)) {
        warnings.push(
            "hotUpdaterUrl ainda é de servidor v0 (/api/check-update): troque pela URL do Worker v1 NOVO — o v0 continua servindo os binários antigos.",
        );
    }
    const keyValue = JSON.stringify(apiKey || "");
    const keyPattern = /(hotUpdaterApiKey\s*:\s*)(["'`])([^"'`]*)\2/;
    const keyMatch = out.match(keyPattern);
    if (keyMatch) {
        if (!keyMatch[3] && apiKey) out = out.replace(keyPattern, (_all, prefix) => `${prefix}${keyValue}`);
    } else {
        const urlLines = /^([ \t]*)hotUpdaterUrl\s*[:,][^\n]*\n/gm;
        if (urlLines.test(out)) {
            out = out.replace(
                urlLines,
                (line, indent) =>
                    `${line}${indent}// Hot Updater v1: chave de cliente do servidor (vai no x-api-key), a HOT_UPDATER_API_KEY do hot-updater init.\n` +
                    `${indent}hotUpdaterApiKey: ${keyValue},\n`,
            );
        } else {
            warnings.push("não achei o hotUpdaterUrl no Strings.ts: ponha hotUpdaterUrl (raiz do Worker v1) e hotUpdaterApiKey à mão.");
        }
    }
    return {source: out, changed: out !== source, warnings};
}

function applyHotUpdaterV1ToStringsFile(stringsPath) {
    const apiKey = hotUpdaterApiKeyFromEnv();
    const result = hotUpdaterV1Strings(fs.readFileSync(stringsPath, "utf-8"), apiKey);
    if (result.changed) {
        fs.writeFileSync(stringsPath, result.source);
        console.log(chalk.green(`  -> ${path.relative(projectRoot, stringsPath)}: hotUpdaterApiKey${apiKey ? " (do .env.hotupdater)" : ""} para o Hot Updater v1.`));
    }
    result.warnings.forEach((warning) => console.log(chalk.yellow(`  -> ⚠️  ${warning}`)));
    if (!apiKey) {
        console.log(chalk.yellow("  -> Preencha hotUpdaterApiKey no Strings.ts com a HOT_UPDATER_API_KEY do servidor v1 (sem ela o OTA fica desligado)."));
    }
}

function handleHotUpdaterFlag(generation = 0) {
    console.log(chalk.cyan(`🔥 Configuring Hot Updater v${generation} (${HOT_UPDATER_RANGES[generation]})...`));

    // --- 1. Update package.json: react-dom e os pacotes do Hot Updater, todos da mesma geração ---
    const projectPkgPath = path.join(projectRoot, "package.json");
    const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, "utf-8"));
    let pkgUpdated = false;

    projectPkg.dependencies = projectPkg.dependencies || {};

    // Add react-dom matching react version if not present
    if (!projectPkg.dependencies["react-dom"]) {
        const reactVersion = projectPkg.dependencies["react"] || "19.1.0";
        projectPkg.dependencies["react-dom"] = reactVersion;
        console.log(chalk.green(`  -> Added react-dom@${reactVersion} to dependencies.`));
        pkgUpdated = true;
    } else {
        console.log(chalk.yellow(`  -> react-dom already in dependencies.`));
    }

    const hotUpdaterChanges = alignHotUpdaterDependencies(projectPkg, generation);
    if (hotUpdaterChanges.length) {
        hotUpdaterChanges.forEach((change) => console.log(chalk.green(`  -> ${change}`)));
        pkgUpdated = true;
    } else {
        console.log(chalk.yellow(`  -> Hot Updater packages already on v${generation}.`));
    }

    // Add overrides to force react-dom version
    if (!projectPkg.overrides) {
        projectPkg.overrides = {};
    }
    if (!projectPkg.overrides["react-dom"]) {
        const reactVersion = projectPkg.dependencies["react"] || "19.1.0";
        projectPkg.overrides["react-dom"] = reactVersion;
        console.log(chalk.green(`  -> Added overrides for react-dom@${reactVersion}.`));
        pkgUpdated = true;
    }

    if (pkgUpdated) {
        fs.writeFileSync(projectPkgPath, JSON.stringify(projectPkg, null, 2));
        console.log(chalk.green(`  -> Updated package.json.`));
    }

    // --- 2. Create/Update babel.config.js ---
    const babelConfigPath = path.join(projectRoot, "babel.config.js");
    const babelTemplatePath = path.join(moduleDir, "templates", "babel.config.js");

    if (fs.existsSync(babelTemplatePath)) {
        if (!fs.existsSync(babelConfigPath)) {
            fs.copyFileSync(babelTemplatePath, babelConfigPath);
            console.log(chalk.green(`  -> Created babel.config.js with hot-updater plugin.`));
        } else {
            // Check if hot-updater plugin is already in babel.config.js (o do template é o
            // @hot-updater/expo/babel-plugin; sem aceitar esse nome, todo run sobrescrevia o babel do app)
            const existingBabel = fs.readFileSync(babelConfigPath, "utf-8");
            if (!/hot-updater\/(expo\/)?babel-plugin/.test(existingBabel)) {
                // Replace with template
                fs.copyFileSync(babelTemplatePath, babelConfigPath);
                console.log(chalk.green(`  -> Updated babel.config.js with hot-updater plugin.`));
            } else {
                console.log(chalk.yellow(`  -> babel.config.js already has hot-updater plugin.`));
            }
        }
    } else {
        console.error(chalk.red("❌ babel.config.js template not found in expo-utils module."));
    }

    // --- 3. Create .env and .env.hotupdater placeholder files (chaves da geração) ---
    const envTemplateName = generation === 1 ? ".env.hotupdater.v1.template" : ".env.hotupdater.template";
    const envTemplatePath = path.join(moduleDir, "templates", envTemplateName);
    const envPath = path.join(projectRoot, ".env");
    const envHotUpdaterPath = path.join(projectRoot, ".env.hotupdater");

    if (fs.existsSync(envTemplatePath)) {
        const envContent = fs.readFileSync(envTemplatePath, "utf-8");

        if (!fs.existsSync(envPath)) {
            fs.writeFileSync(envPath, envContent);
            console.log(chalk.green(`  -> Created .env with hot-updater placeholders.`));
        } else {
            console.log(chalk.yellow(`  -> .env already exists. Skipping.`));
        }

        if (!fs.existsSync(envHotUpdaterPath)) {
            fs.writeFileSync(envHotUpdaterPath, envContent);
            console.log(chalk.green(`  -> Created .env.hotupdater with placeholders.`));
        } else if (generation === 1) {
            // App vindo do v0: só acrescenta as chaves do v1 que faltam (valores existentes ficam).
            const merged = mergeEnvKeys(
                fs.readFileSync(envHotUpdaterPath, "utf-8"),
                envContent,
                "# Hot Updater v1 (expo-utils-install --hot-updater-v1): preencha com o npx hot-updater init",
            );
            if (merged.added.length) {
                fs.writeFileSync(envHotUpdaterPath, merged.source);
                console.log(chalk.green(`  -> .env.hotupdater: + ${merged.added.join(", ")}.`));
            } else {
                console.log(chalk.yellow(`  -> .env.hotupdater already has the v1 keys.`));
            }
            console.log(
                chalk.yellow(
                    "  -> ⚠️  O v1 precisa de D1 e Worker NOVOS: troque HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID/_NAME e HOT_UPDATER_CLOUDFLARE_WORKER_NAME (ou deixe vazios para o init criar). Os do v0 continuam servindo os binários antigos.",
                ),
            );
        } else {
            console.log(chalk.yellow(`  -> .env.hotupdater already exists. Skipping.`));
        }
    } else {
        console.error(chalk.red(`❌ ${envTemplateName} not found in expo-utils module.`));
    }

    // --- 4. Update .gitignore to include .env files ---
    const gitignorePath = path.join(projectRoot, ".gitignore");
    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
    }

    const envLinesToAdd = [".env", ".env.hotupdater", ".env.local", ".env.*.local"];
    let gitignoreUpdated = false;

    envLinesToAdd.forEach((line) => {
        if (!gitignoreContent.includes(line)) {
            gitignoreContent += `\n${line}`;
            gitignoreUpdated = true;
        }
    });

    if (gitignoreUpdated) {
        fs.writeFileSync(gitignorePath, gitignoreContent.trim() + "\n");
        console.log(chalk.green(`  -> Updated .gitignore with .env files.`));
    }

    // --- 5. Plugin do Hot Updater no app.json: um só, o da geração ---
    const config = getAppConfig();
    if (config) {
        const {added, replaced} = applyHotUpdaterPlugin(config, generation);
        const pluginName = HOT_UPDATER_PLUGINS[generation];
        if (replaced) console.log(chalk.green(`  -> Replaced ${replaced} plugin with ${pluginName} (options kept).`));
        else console.log(chalk.green(`  -> ${added ? "Added and configured" : "Updated"} ${pluginName} plugin.`));
        writeAppConfig(config);
    }

    // --- 6. v1: chave de cliente no Strings.ts ---
    if (generation === 1) {
        const stringsPath = findStringsFile();
        if (stringsPath) applyHotUpdaterV1ToStringsFile(stringsPath);
        else console.log(chalk.gray("  -> Strings.ts ainda não existe: o --constants aplica o hotUpdaterApiKey quando criar."));
    }

    console.log(chalk.green(`✅ Hot Updater v${generation} setup complete.`));
    if (generation === 1) {
        console.log(chalk.cyan("   📝 Servidor v1 NOVO (D1 + Worker novos): npx hot-updater init. Mantenha o v0 no ar para os binários antigos."));
        console.log(chalk.cyan("   📝 Strings.ts: hotUpdaterUrl = raiz do Worker v1 (sem /api/check-update) + hotUpdaterApiKey."));
    } else {
        console.log(chalk.cyan("   📝 Remember to fill in your Cloudflare credentials in .env and .env.hotupdater"));
    }
    const hotUpdaterPm = detectPackageManager();
    const installCmd = { bun: "bun install", npm: "npm install", yarn: "yarn", pnpm: "pnpm install" };
    console.log(chalk.cyan(`   📝 Then run: ${installCmd[hotUpdaterPm]}`));
}

// Fixa (pin) TODA dependência do projeto numa versão EXATA, para o install ficar
// idêntico em todas as máquinas. Remove os operadores de range (^, ~, >=, >, <=, <, =)
// e, sempre que o pacote está instalado, grava a versão realmente presente em
// node_modules (a versão resolvida — o que "depois de atualizado" de fato significa).
// Specs que NÃO são versão de registry — git/github (inclusive shorthand owner/repo),
// file:/link:/workspace:/npm: e URLs/paths (.tgz) — são preservados intactos, pois não
// podem ser expressos como um semver fixo (ex.: o próprio `expo-utils` via GitHub).
function handlePinDepsFlag() {
    console.log(chalk.cyan("📌 Fixando versões das dependências (remove ^, ~, >= para ficar igual em todas as máquinas)..."));

    const projectPkgPath = path.join(projectRoot, "package.json");
    if (!fs.existsSync(projectPkgPath)) {
        console.error(chalk.red("❌ package.json não encontrado no projeto."));
        return;
    }
    const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, "utf-8"));

    // Uma versão exata de semver: 1.2.3, 56.0.18, 1.0.0-beta.1, 1.0.0+build...
    const EXACT_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;

    // Specs que devem ficar intactos — não mapeiam para uma versão fixa de registry.
    // `:` cobre workspace:/file:/link:/npm:/git:/github:/catalog:; `/` cobre o shorthand
    // de GitHub (owner/repo), paths e tarballs/URLs (ex.: o .tgz local ou link do GitHub).
    const shouldSkipSpec = (spec) =>
        typeof spec !== "string" ||
        spec.trim() === "" ||
        spec.includes(":") ||
        spec.includes("/") ||
        spec === "*" ||
        spec === "x" ||
        spec.toLowerCase() === "latest";

    // Versão realmente instalada em node_modules (a resolvida). Suporta pacote com escopo
    // (@scope/name) porque path.join monta node_modules/@scope/name/package.json certinho.
    const installedVersion = (name) => {
        try {
            const pkgJson = path.join(projectRoot, "node_modules", name, "package.json");
            if (fs.existsSync(pkgJson)) {
                const v = JSON.parse(fs.readFileSync(pkgJson, "utf-8")).version;
                if (typeof v === "string" && EXACT_VERSION.test(v)) return v;
            }
        } catch {}
        return null;
    };

    // Fallback quando o pacote não está instalado: remove o operador inicial do range e só
    // aceita o resultado se sobrar uma única versão concreta (ranges compostos viram null).
    const stripToExact = (spec) => {
        const stripped = spec.trim().replace(/^[\^~>=<\sv]+/, "");
        return EXACT_VERSION.test(stripped) ? stripped : null;
    };

    const fields = ["dependencies", "devDependencies", "optionalDependencies"];
    let pinned = 0;
    const skipped = [];

    for (const field of fields) {
        const deps = projectPkg[field];
        if (!deps || typeof deps !== "object") continue;

        for (const name of Object.keys(deps)) {
            const spec = deps[name];
            if (shouldSkipSpec(spec)) continue;
            if (EXACT_VERSION.test(spec)) continue; // já está fixado, nada a fazer

            const target = installedVersion(name) || stripToExact(spec);
            if (!target) {
                skipped.push(`${name}@${spec}`); // range composto / não instalado
                continue;
            }
            if (target !== spec) {
                deps[name] = target;
                console.log(chalk.green(`  -> ${name}: ${spec} → ${target}`));
                pinned++;
            }
        }
    }

    if (pinned === 0) {
        console.log(chalk.yellow("  -> Nenhuma dependência para fixar (já estão todas em versão exata)."));
    } else {
        fs.writeFileSync(projectPkgPath, JSON.stringify(projectPkg, null, 2) + "\n");
        console.log(chalk.green.bold(`✅ ${pinned} dependência(s) fixada(s) em package.json.`));
    }

    if (skipped.length > 0) {
        console.log(chalk.gray(`  -> Preservadas (range composto / não instalado): ${skipped.join(", ")}`));
    }
}

async function handleAppReset() {
    console.log(chalk.cyan("♻️ Resetting app structure..."));

    const oldAppDir = path.join(projectRoot, "app");
    const newSrcDir = path.join(projectRoot, "src");
    const newAppDir = path.join(newSrcDir, "app");

    // Clean up old directories
    if (fs.existsSync(oldAppDir)) {
        fs.rmSync(oldAppDir, {recursive: true, force: true});
        console.log(chalk.yellow(`  -> Removed existing 'app' directory.`));
    }
    if (fs.existsSync(newAppDir)) {
        fs.rmSync(newAppDir, {recursive: true, force: true});
        console.log(chalk.yellow(`  -> Removed existing 'src/app' directory for a clean slate.`));
    }

    // Remove additional directories
    const dirsToRemove = ["constants", "hooks", "components", "scripts", path.join("assets", "fonts")];
    dirsToRemove.forEach((dir) => {
        const dirPath = path.join(projectRoot, dir);
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, {recursive: true, force: true});
            console.log(chalk.yellow(`  -> Removed '${dir}' directory.`));
        }
    });

    // Clean assets/images down to an allowlist: keep ONLY the allowlisted icon
    // files; remove EVERYTHING else — loose template leftovers (react-logo*,
    // partial-react-logo, favicon, expo-badge*, expo-logo, …) AND subfolders
    // (e.g. the template's tabIcons/ with the example explore/home icons).
    // --new is for new projects, so any subfolder here is template junk, not your
    // asset — directories are removed recursively.
    const imagesToKeep = new Set([
        "icon.png",
        "splash-icon.png",
        "android-icon-background.png",
        "android-icon-foreground.png",
        "android-icon-monochrome.png",
    ]);
    const imagesDir = path.join(projectRoot, "assets", "images");
    if (fs.existsSync(imagesDir)) {
        fs.readdirSync(imagesDir, {withFileTypes: true}).forEach((entry) => {
            if (imagesToKeep.has(entry.name)) return; // keep the allowlisted icons
            const isDir = entry.isDirectory();
            fs.rmSync(path.join(imagesDir, entry.name), {recursive: true, force: true});
            console.log(chalk.yellow(`  -> Removed 'assets/images/${entry.name}${isDir ? "/" : ""}'.`));
        });
    }

    // Remove the broken Apple Icon Composer folder (assets/expo.icon) bundled by the
    // template: it makes actool fail at prebuild. Pairs with --expo-icon, which strips
    // the matching ios.icon reference out of app.json.
    const expoIconDir = path.join(projectRoot, "assets", "expo.icon");
    if (fs.existsSync(expoIconDir)) {
        fs.rmSync(expoIconDir, {recursive: true, force: true});
        console.log(chalk.yellow(`  -> Removed 'assets/expo.icon' directory.`));
    }

    // Create new structure
    ensureDirExists(newAppDir);
    console.log(chalk.green(`  -> Created 'src/app' directory.`));

    // Create _layout.tsx and index.tsx from templates
    const layoutTemplatePath = path.join(moduleDir, "templates", "RootLayout.tsx");
    const indexTemplatePath = path.join(moduleDir, "templates", "index.tsx");

    if (fs.existsSync(layoutTemplatePath)) {
        fs.copyFileSync(layoutTemplatePath, path.join(newAppDir, "_layout.tsx"));
        console.log(chalk.green(`  -> Created src/app/_layout.tsx.`));
    }
    if (fs.existsSync(indexTemplatePath)) {
        fs.copyFileSync(indexTemplatePath, path.join(newAppDir, "index.tsx"));
        console.log(chalk.green(`  -> Created src/app/index.tsx.`));
    }

    console.log(chalk.green("✅ App structure reset complete."));
}

// --- Main Execution ---

/** Geração do Hot Updater do app agora (package.json/node_modules mudam no passo de dependências). */
function currentHotUpdaterGeneration(args) {
    const projectPkgPath = path.join(projectRoot, "package.json");
    const projectPkg = fs.existsSync(projectPkgPath) ? JSON.parse(fs.readFileSync(projectPkgPath, "utf-8")) : {};
    return detectHotUpdaterGeneration(args, projectPkg);
}

async function main() {
    const args = process.argv.slice(2);

    // Always run dependency install first
    await handleDependencyInstall(args);

    console.log(chalk.blue("\n--- Running Scaffolding Steps ---"));

    if (args.includes("--new")) {
        console.log(chalk.magenta.bold("🚀 New project setup! Running non-destructive steps..."));

        // Run all non-destructive steps first
        handleEasConfigFlag();
        handleIosBuildFixFlag();
        handleExpoIconFlag();
        handleFirebasePlaceholdersFlag();
        handleConfigFlag();
        handleLanguagesFlag();
        handleSkadnetworkFlag();
        handleTrackingPermissionFlag();
        handleGitignoreFlag(); // Nova chamada para atualizar .gitignore
        handleHotUpdaterFlag(currentHotUpdaterGeneration(args)); // Setup hot-updater (v0; v1 com --hot-updater-v1 ou 1.x no app)
        handlePinDepsFlag(); // Fixa as versões das deps (após todos os handlers que mexem em package.json)
        handleClaudeMdFlag();
        handlePolicyChecksFlag(); // Após o AGENTS.md: o template novo já cita o arquivo (REGRA 6)
        handleSortPluginsFlag(); // Ordena os plugins por último (após todos os handlers que adicionam plugins)

        const rl = readline.createInterface({input: process.stdin, output: process.stdout});

        rl.question(
            chalk.yellow.bold("\n❓ Tem certeza que deseja limpar a pasta 'app' e criar uma nova em 'src/app'? (Y/n) "),
            async (answer) => {
                if (answer.toLowerCase() === "n") {
                    console.log(chalk.gray("  -> Skipping app structure reset."));
                    // Explain what to do next if they skip
                    console.log(
                        chalk.cyan("\n💡 To manually move your 'app' folder, run 'npx expo-utils-install --srcapp'"),
                    );
                    console.log(chalk.cyan("💡 To replace the layout, run 'npx expo-utils-install --layout'"));
                } else {
                    await handleAppReset();
                    handleConstantsFlag(currentHotUpdaterGeneration(args)); // Execute after app reset
                    // handleAppReset deletou assets/expo.icon — re-verifica o ios.icon, que
                    // agora está quebrado. O handleExpoIconFlag() dos passos não-destrutivos
                    // rodou ANTES do reset (quando a pasta ainda existia), então não pegou isso.
                    // Aqui ele remove o ios.icon órfão e cai no icon raiz válido (evita o warning
                    // "Liquid glass icon file not found" e a falha do actool no build iOS).
                    handleExpoIconFlag();
                }
                rl.close();
                console.log(chalk.bold.magenta("\n✨ All done! ✨"));
            },
        );
    } else if (args.length === 0) {
        console.log(
            chalk.yellow(
                "No flags provided. Only dependency check was performed.\nUse --new to run all setup steps, or pass individual flags like --config, --layout, etc.",
            ),
        );
        console.log(chalk.bold.magenta("\n✨ All done! ✨"));
    } else {
        if (args.includes("--config")) handleConfigFlag();
        if (args.includes("--layout")) handleLayoutFlag();
        if (args.includes("--srcapp")) handleSrcAppFlag();
        if (args.includes("--languages")) handleLanguagesFlag();
        if (args.includes("--skadnetwork")) handleSkadnetworkFlag();
        if (args.includes("--sort-plugins")) handleSortPluginsFlag();
        if (args.includes("--firebase-placeholders")) handleFirebasePlaceholdersFlag();
        if (args.includes("--fix-ios-build")) handleIosBuildFixFlag();
        if (args.includes("--expo-icon")) handleExpoIconFlag();
        if (args.includes("--tracking-permission")) handleTrackingPermissionFlag();
        if (args.includes("--eas-config")) handleEasConfigFlag();
        if (args.includes("--constants")) handleConstantsFlag(currentHotUpdaterGeneration(args));
        if (args.includes("--gitignore")) handleGitignoreFlag(); // Nova flag para atualizar .gitignore
        if (args.includes("--hot-updater") || args.includes("--hot-updater-v1")) {
            handleHotUpdaterFlag(currentHotUpdaterGeneration(args)); // Setup hot-updater (v0; v1 com --hot-updater-v1 ou 1.x no app)
        }
        if (args.includes("--pin-deps")) handlePinDepsFlag(); // Fixa versões das deps (remove ^, ~, >=)
        if (args.includes("--policy-checks")) handlePolicyChecksFlag(); // Sincroniza .claude/POLICY-CHECKS.md
        console.log(chalk.bold.magenta("\n✨ All done! ✨"));
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error(chalk.red.bold("\nA critical error occurred:"), err);
        process.exit(1);
    });
} else {
    // Exporta helpers para testes/uso programático sem disparar o CLI.
    module.exports = {
        fixBrokenIosIcon,
        dedupeInfoPlistArrays,
        handleLanguagesFlag,
        handlePinDepsFlag,
        handlePolicyChecksFlag,
        handleIosBuildFixFlag,
        handleHotUpdaterFlag,
        handleConstantsFlag,
        planMissingDependencies,
        detectHotUpdaterGeneration,
        buildPropertiesFor,
        applyBuildProperties,
        alignHotUpdaterDependencies,
        applyHotUpdaterPlugin,
        mergeEnvKeys,
        hotUpdaterV1Strings,
        HOT_UPDATER_RANGES,
    };
}
