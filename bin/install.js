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

// --- Scaffolding Functions ---

async function handleDependencyInstall() {
    console.log(chalk.cyan("🚀 Checking for missing peer dependencies..."));
    const modulePkg = require(path.join(moduleDir, "package.json"));
    const peerDependencies = modulePkg.peerDependencies || {};
    const projectPkgPath = path.join(projectRoot, "package.json");
    const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, "utf-8"));
    const existingDeps = {...projectPkg.dependencies, ...projectPkg.devDependencies};
    const missingDeps = Object.keys(peerDependencies).filter((dep) => !existingDeps[dep]);

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
        projectPkg.dependencies[dep] = peerDependencies[dep];
    }
    fs.writeFileSync(projectPkgPath, JSON.stringify(projectPkg, null, 2));
    console.log(chalk.green(`  -> Added ${missingDeps.length} dependencies to package.json`));

    // Step 2: For expo-managed deps, run expo install (names only) to
    // resolve SDK-compatible versions and update package.json entries.
    if (hasExpo) {
        const expoManagedDeps = missingDeps.filter((dep) =>
            dep === "expo" ||
            dep === "react" ||
            dep === "react-native" ||
            dep.startsWith("expo-") ||
            dep.startsWith("@expo/")
        );

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

    // --- Configure build properties for Firebase ---
    config.expo.plugins = config.expo.plugins || [];

    // Find the index of the expo-build-properties plugin
    const buildPropertiesIndex = config.expo.plugins.findIndex((p) =>
        (Array.isArray(p) && p[0] === "expo-build-properties") || p === "expo-build-properties"
    );

    const iosBuildConfig = {
        useFrameworks: "static",
        useModularHeaders: true,
        forceStaticLinking: [
            "RNFBApp",
            "RNFBAuth",
            "RNFBFirestore",
            "RNFBMessaging",
            "RNFBCrashlytics",
            "RNFBAnalytics",
            "RNFBRemoteConfig"
        ]
    };

    if (buildPropertiesIndex !== -1) {
        const existingPlugin = config.expo.plugins[buildPropertiesIndex];

        // Handle both array and string formats
        if (Array.isArray(existingPlugin)) {
            // Merge with existing configuration
            existingPlugin[1] = existingPlugin[1] || {};
            existingPlugin[1].ios = {
                ...existingPlugin[1].ios,  // Keep existing iOS config
                ...iosBuildConfig,         // Add our required config
                // If forceStaticLinking already exists, merge the arrays
                forceStaticLinking: [
                    ...(existingPlugin[1].ios?.forceStaticLinking || []),
                    ...iosBuildConfig.forceStaticLinking
                ].filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
            };
            config.expo.plugins[buildPropertiesIndex] = existingPlugin;
        } else {
            // Convert string format to array format with configuration
            config.expo.plugins[buildPropertiesIndex] = ["expo-build-properties", {ios: iosBuildConfig}];
        }
        console.log(chalk.green("  -> Updated expo-build-properties for iOS in app.json."));
    } else {
        // Plugin doesn't exist, add it
        config.expo.plugins.push(["expo-build-properties", {ios: iosBuildConfig}]);
        console.log(chalk.green("  -> Added and configured expo-build-properties for iOS."));
    }

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
    const projectId = "df0dc510-fafe-4076-9ea7-6926d54cb2ab";
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

    newExpo.extra.eas = newExpo.extra.eas || {};
    if (newExpo.extra.eas.projectId !== projectId) {
        newExpo.extra.eas.projectId = projectId;
        console.log(chalk.green(`  -> Set placeholder "extra.eas.projectId".`));
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

function handleConstantsFlag() {
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
    } else if (fs.existsSync(stringsDestPath)) {
        console.log(chalk.yellow(`  -> Strings.ts already exists, skipping.`));
    }

    console.log(chalk.green("✅ Constants setup complete."));
}

function handleClaudeMdFlag() {
    const srcPath = path.join(moduleDir, "CLAUDE.md");
    const destPath = path.join(projectRoot, "CLAUDE.md");

    if (!fs.existsSync(srcPath)) return;

    if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(chalk.green("📄 Created CLAUDE.md in project root."));
    } else {
        console.log(chalk.yellow("📄 CLAUDE.md already exists. Skipping."));
    }
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

function handleHotUpdaterFlag() {
    console.log(chalk.cyan("🔥 Configuring Hot Updater..."));

    // --- 1. Update package.json to add hot-updater and react-dom ---
    const projectPkgPath = path.join(projectRoot, "package.json");
    const projectPkg = require(projectPkgPath);
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

    // Add hot-updater if not present
    if (!projectPkg.dependencies["hot-updater"]) {
        projectPkg.dependencies["hot-updater"] = ">=0.31.3";
        console.log(chalk.green(`  -> Added hot-updater@>=0.31.3 to dependencies.`));
        pkgUpdated = true;
    } else {
        console.log(chalk.yellow(`  -> hot-updater already in dependencies.`));
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
            // Check if hot-updater plugin is already in babel.config.js
            const existingBabel = fs.readFileSync(babelConfigPath, "utf-8");
            if (!existingBabel.includes("hot-updater/babel-plugin")) {
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

    // --- 3. Create .env and .env.hotupdater placeholder files ---
    const envTemplatePath = path.join(moduleDir, "templates", ".env.hotupdater.template");
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
        } else {
            console.log(chalk.yellow(`  -> .env.hotupdater already exists. Skipping.`));
        }
    } else {
        console.error(chalk.red("❌ .env.hotupdater.template not found in expo-utils module."));
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

    // --- 5. Add @hot-updater/react-native plugin to app.json ---
    const config = getAppConfig();
    if (config) {
        config.expo = config.expo || {};
        config.expo.plugins = config.expo.plugins || [];

        const pluginName = "@hot-updater/react-native";
        const hotUpdaterConfig = {
            channel: "production",
        };

        // Find the index of the @hot-updater/react-native plugin
        const hotUpdaterIndex = config.expo.plugins.findIndex((p) =>
            (Array.isArray(p) && p[0] === pluginName) || p === pluginName
        );

        if (hotUpdaterIndex !== -1) {
            const existingPlugin = config.expo.plugins[hotUpdaterIndex];

            // Handle both array and string formats
            if (Array.isArray(existingPlugin)) {
                // Merge with existing configuration
                existingPlugin[1] = {
                    ...existingPlugin[1],  // Keep existing config
                    ...hotUpdaterConfig    // Add our required config
                };
                config.expo.plugins[hotUpdaterIndex] = existingPlugin;
            } else {
                // Convert string format to array format with configuration
                config.expo.plugins[hotUpdaterIndex] = [pluginName, hotUpdaterConfig];
            }
            console.log(chalk.green(`  -> Updated ${pluginName} plugin configuration.`));
        } else {
            // Plugin doesn't exist, add it
            config.expo.plugins.push([pluginName, hotUpdaterConfig]);
            console.log(chalk.green(`  -> Added and configured ${pluginName} plugin.`));
        }

        writeAppConfig(config);
    }

    console.log(chalk.green("✅ Hot Updater setup complete."));
    console.log(chalk.cyan("   📝 Remember to fill in your Cloudflare credentials in .env and .env.hotupdater"));
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

    // Clean assets/images: keep ONLY the allowlisted icon files; remove every
    // other loose file (template leftovers like react-logo*, partial-react-logo,
    // favicon, expo-badge*, expo-logo, etc.). Subdirectories (e.g. tabIcons/) are
    // preserved, since the app may rely on them.
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
            if (!entry.isFile()) return; // preserve subfolders (tabIcons/) and anything non-file
            if (imagesToKeep.has(entry.name)) return; // keep the allowlisted icons
            fs.rmSync(path.join(imagesDir, entry.name), {force: true});
            console.log(chalk.yellow(`  -> Removed 'assets/images/${entry.name}'.`));
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

async function main() {
    const args = process.argv.slice(2);

    // Always run dependency install first
    await handleDependencyInstall();

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
        handleHotUpdaterFlag(); // Setup hot-updater
        handlePinDepsFlag(); // Fixa as versões das deps (após todos os handlers que mexem em package.json)
        handleClaudeMdFlag();
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
                    handleConstantsFlag(); // Execute after app reset
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
        if (args.includes("--constants")) handleConstantsFlag();
        if (args.includes("--gitignore")) handleGitignoreFlag(); // Nova flag para atualizar .gitignore
        if (args.includes("--hot-updater")) handleHotUpdaterFlag(); // Setup hot-updater
        if (args.includes("--pin-deps")) handlePinDepsFlag(); // Fixa versões das deps (remove ^, ~, >=)
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
    module.exports = {fixBrokenIosIcon, dedupeInfoPlistArrays, handleLanguagesFlag, handlePinDepsFlag};
}
