#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const readline = require('readline');

// --- Helper Functions ---

const projectRoot = process.cwd();
const appJsonPath = path.join(projectRoot, 'app.json');

/**
 * Safely reads and parses the app.json file.
 * @returns {object|null} The parsed config object or null if not found.
 */
function getAppConfig() {
    if (!fs.existsSync(appJsonPath)) {
        console.error(chalk.red('Error: Could not find app.json in the current directory.'));
        return null;
    }
    return JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
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
        fs.mkdirSync(dirPath, { recursive: true });
    }
}


// --- Scaffolding Functions ---

async function handleDependencyInstall() {
    console.log(chalk.cyan('🚀 Checking for missing peer dependencies...'));
    const modulePkg = require('expo-utils/package.json');
    const peerDependencies = modulePkg.peerDependencies || {};
    const projectPkg = require(path.join(projectRoot, 'package.json'));
    const existingDeps = { ...projectPkg.dependencies, ...projectPkg.devDependencies };
    const missingDeps = Object.keys(peerDependencies).filter(dep => !existingDeps[dep]);

    if (missingDeps.length === 0) {
        console.log(chalk.green('✅ All required peer dependencies are already installed.'));
        return;
    }

    const depsToInstall = missingDeps.map(dep => `"${dep}@${peerDependencies[dep]}"`).join(' ');
    console.log(chalk.yellow(`📦 Installing ${missingDeps.length} missing dependenc(ies): ${missingDeps.join(', ')}`));
    
    const useYarn = fs.existsSync(path.join(projectRoot, 'yarn.lock'));
    const command = useYarn ? `yarn add ${depsToInstall}` : `npm install ${depsToInstall} --quiet`;

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(chalk.red('\n❌ An error occurred during installation.'), chalk.red(stderr || error.message));
                reject(error);
            } else {
                console.log(chalk.green.bold('\n✅ Dependencies installed successfully!'));
                resolve();
            }
        });
    });
}

function handleConfigFlag() {
    console.log(chalk.cyan('🔧 Configuring standard plugins in app.json...'));
    const config = getAppConfig();
    if (!config) return;

    const pluginsConfigPath = path.join(path.dirname(require.resolve('expo-utils/package.json')), 'data', 'standard_plugins.json');
    if (!fs.existsSync(pluginsConfigPath)) {
        console.error(chalk.red('❌ Could not find standard_plugins.json in the expo-utils module.'));
        return;
    }
    const pluginsWithConfig = require(pluginsConfigPath);

    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];

    // Add Firebase App plugin (no config needed from the file, it's discovered automatically)
    const firebaseAppPlugin = '@react-native-firebase/app';
    if (!config.expo.plugins.some(p => (Array.isArray(p) ? p[0] : p) === firebaseAppPlugin)) {
        config.expo.plugins.push(firebaseAppPlugin);
        console.log(chalk.green(`  -> Added ${firebaseAppPlugin} plugin.`));
    } else {
        console.log(chalk.yellow(`  -> Plugin ${firebaseAppPlugin} already configured.`));
    }

    // Add other plugins from the config file
    Object.keys(pluginsWithConfig).forEach(pluginName => {
        if (!config.expo.plugins.some(p => (Array.isArray(p) ? p[0] : p) === pluginName)) {
            config.expo.plugins.push([pluginName, pluginsWithConfig[pluginName]]);
            console.log(chalk.green(`  -> Added ${pluginName} plugin.`));
        } else {
            console.log(chalk.yellow(`  -> Plugin ${pluginName} already configured.`));
        }
    });

    writeAppConfig(config);
    console.log(chalk.green('✅ Plugin configuration step complete.'));
}

function handleLayoutFlag() {
    console.log(chalk.cyan('📝 Replacing root layout file...'));
    
    const layoutTemplatePath = path.join(path.dirname(require.resolve('expo-utils/package.json')), 'templates', 'RootLayout.tsx');
    if (!fs.existsSync(layoutTemplatePath)) {
        console.error(chalk.red('❌ Could not find RootLayout.tsx template in the expo-utils module.'));
        return;
    }
    const layoutContent = fs.readFileSync(layoutTemplatePath, 'utf-8');

    const path1 = path.join(projectRoot, 'app', '_layout.tsx');
    const path2 = path.join(projectRoot, 'src', 'app', '_layout.tsx');

    if (fs.existsSync(path2)) {
        fs.writeFileSync(path2, layoutContent);
        console.log(chalk.green(`✅ Replaced ${path2}`));
    } else if (fs.existsSync(path1)) {
        fs.writeFileSync(path1, layoutContent);
        console.log(chalk.green(`✅ Replaced ${path1}`));
    } else {
        console.error(chalk.red('❌ Could not find an existing layout file at app/_layout.tsx or src/app/_layout.tsx. The template was not applied.'));
    }
}

function handleSrcAppFlag() {
    console.log(chalk.cyan('📁 Moving app directory to src/app...'));
    const oldPath = path.join(projectRoot, 'app');
    const newDirPath = path.join(projectRoot, 'src');
    const newPath = path.join(newDirPath, 'app');

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
    console.log(chalk.cyan('🌐 Setting up language files...'));
    const langDir = path.join(projectRoot, 'languages');
    ensureDirExists(langDir);

    const dummyFiles = ['pt.json', 'en.json', 'es.json'];
    dummyFiles.forEach(file => {
        const filePath = path.join(langDir, file);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '{}');
            console.log(chalk.green(`  -> Created ${filePath}`));
        }
    });

    const config = getAppConfig();
    if (!config) return;
    config.expo = config.expo || {};
    config.expo.assetBundlePatterns = config.expo.assetBundlePatterns || ["**/*"];
    const pattern = "languages/*";
    if (!config.expo.assetBundlePatterns.includes(pattern)) {
        config.expo.assetBundlePatterns.push(pattern);
        console.log(chalk.green(`  -> Added '${pattern}' to assetBundlePatterns in app.json.`));
    }
    writeAppConfig(config);
    console.log(chalk.green('✅ Language setup complete.'));
}

function handleSkadnetworkFlag() {
    console.log(chalk.cyan('📊 Adding SKAdNetworkItems...'));
    const config = getAppConfig();
    if (!config) return;

    // Carregue a lista de IDs a partir do arquivo JSON dentro do módulo
    const skadNetworkItemsPath = path.join(path.dirname(require.resolve('expo-utils/package.json')), 'data', 'skadnetwork_ids.json');
    if (!fs.existsSync(skadNetworkItemsPath)) {
        console.error(chalk.red('❌ Could not find skadnetwork_ids.json in the expo-utils module.'));
        return;
    }
    const itemsToAdd = require(skadNetworkItemsPath);

    config.expo = config.expo || {};
    config.expo.ios = config.expo.ios || {};
    config.expo.ios.infoPlist = config.expo.ios.infoPlist || {};
    config.expo.ios.infoPlist.SKAdNetworkItems = config.expo.ios.infoPlist.SKAdNetworkItems || [];

    let addedCount = 0;
    itemsToAdd.forEach(newItem => {
        if (!config.expo.ios.infoPlist.SKAdNetworkItems.some(item => item.SKAdNetworkIdentifier === newItem.SKAdNetworkIdentifier)) {
            config.expo.ios.infoPlist.SKAdNetworkItems.push(newItem);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        console.log(chalk.green(`  -> Added ${addedCount} new SKAdNetworkIdentifier(s).`));
    } else {
        console.log(chalk.yellow('  -> All required SKAdNetworkIdentifiers were already present.'));
    }

    writeAppConfig(config);
    console.log(chalk.green('✅ SKAdNetworkItems setup complete.'));
}

function handleFirebasePlaceholdersFlag() {
    console.log(chalk.cyan('🔥 Creating Firebase placeholder files...'));
    const config = getAppConfig();
    if (!config) return;

    const androidPackage = config.expo?.android?.package || 'com.placeholder.app';
    const iosBundleId = config.expo?.ios?.bundleIdentifier || 'com.placeholder.app';
    
    const moduleDir = path.dirname(require.resolve('expo-utils/package.json'));

    // --- Android Placeholder ---
    const googleServicesJsonPath = path.join(projectRoot, 'google-services.json');
    if (!fs.existsSync(googleServicesJsonPath)) {
        const templatePath = path.join(moduleDir, 'templates', 'google-services.template.json');
        if (fs.existsSync(templatePath)) {
            const template = fs.readFileSync(templatePath, 'utf-8');
            const content = template.replace('${androidPackage}', androidPackage);
            fs.writeFileSync(googleServicesJsonPath, content);
            console.log(chalk.green(`  -> Created placeholder google-services.json`));
        } else {
            console.error(chalk.red('❌ google-services.template.json not found in expo-utils module.'));
        }
    } else {
        console.log(chalk.yellow(`  -> File google-services.json already exists. Skipping.`));
    }

    // --- iOS Placeholder ---
    const googleServicesPlistPath = path.join(projectRoot, 'GoogleService-Info.plist');
    if (!fs.existsSync(googleServicesPlistPath)) {
        const templatePath = path.join(moduleDir, 'templates', 'GoogleService-Info.template.plist');
        if (fs.existsSync(templatePath)) {
            const template = fs.readFileSync(templatePath, 'utf-8');
            const content = template.replace('${iosBundleId}', iosBundleId);
            fs.writeFileSync(googleServicesPlistPath, content);
            console.log(chalk.green(`  -> Created placeholder GoogleService-Info.plist`));
        } else {
            console.error(chalk.red('❌ GoogleService-Info.template.plist not found in expo-utils module.'));
        }
    } else {
        console.log(chalk.yellow(`  -> File GoogleService-Info.plist already exists. Skipping.`));
    }

    // --- Update app.json ---
    config.expo = config.expo || {};
    config.expo.ios = config.expo.ios || {};
    config.expo.android = config.expo.android || {};

    if (config.expo.ios.googleServicesFile !== './GoogleService-Info.plist') {
        config.expo.ios.googleServicesFile = './GoogleService-Info.plist';
        console.log(chalk.green(`  -> Updated 'ios.googleServicesFile' in app.json.`));
    }
    if (config.expo.android.googleServicesFile !== './google-services.json') {
        config.expo.android.googleServicesFile = './google-services.json';
        console.log(chalk.green(`  -> Updated 'android.googleServicesFile' in app.json.`));
    }
    
    writeAppConfig(config);

    console.log(chalk.green('✅ Firebase placeholder step complete.'));
}

function handleIosBuildFixFlag() {
    console.log(chalk.cyan('🔧 Applying iOS build fixes for Firebase...'));
    const config = getAppConfig();
    if (!config) return;

    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];

    const buildPropertiesPlugin = config.expo.plugins.find(p => 
        Array.isArray(p) && p[0] === 'expo-build-properties'
    );

    const iosBuildConfig = {
        useFrameworks: 'static',
        useModularHeaders: true,
    };

    if (buildPropertiesPlugin) {
        // Plugin exists, let's modify it
        buildPropertiesPlugin[1] = buildPropertiesPlugin[1] || {};
        buildPropertiesPlugin[1].ios = { ...buildPropertiesPlugin[1].ios, ...iosBuildConfig };
    } else {
        // Plugin doesn't exist, let's add it
        config.expo.plugins.push(['expo-build-properties', { ios: iosBuildConfig }]);
    }
    
    writeAppConfig(config);
    console.log(chalk.green('  -> Configured expo-build-properties for iOS in app.json.'));
    console.log(chalk.green('✅ iOS build fix applied.'));
}

function handleEasLoginScriptFlag() {
    console.log(chalk.cyan('📜 Creating EAS login script...'));
    const moduleDir = path.dirname(require.resolve('expo-utils/package.json'));
    const templatePath = path.join(moduleDir, 'templates', 'eas_login.sh');
    const destPath = path.join(projectRoot, 'eas_login.sh');

    if (!fs.existsSync(templatePath)) {
        console.error(chalk.red('❌ eas_login.sh template not found in expo-utils module.'));
        return;
    }

    if (!fs.existsSync(destPath)) {
        fs.copyFileSync(templatePath, destPath);
        // Make the script executable
        fs.chmodSync(destPath, '755');
        console.log(chalk.green(`  -> Created eas_login.sh and made it executable.`));
    } else {
        console.log(chalk.yellow(`  -> File eas_login.sh already exists. Skipping.`));
    }
    console.log(chalk.green('✅ EAS login script setup complete.'));
}

function handleTrackingPermissionFlag() {
    console.log(chalk.cyan('🔒 Configuring Tracking Transparency permission...'));
    const config = getAppConfig();
    if (!config) return;

    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];

    const pluginName = 'expo-tracking-transparency';
    const trackingPlugin = config.expo.plugins.find(p => 
        Array.isArray(p) && p[0] === pluginName
    );

    const trackingConfig = {
        userTrackingPermission: "We need your permission to personalize your experience with relevant ads and content. Your data helps us improve recommendations and ensure you see what's most interesting to you."
    };

    if (!trackingPlugin) {
        config.expo.plugins.push([pluginName, trackingConfig]);
        console.log(chalk.green(`  -> Added and configured ${pluginName} plugin.`));
    } else {
        console.log(chalk.yellow(`  -> Plugin ${pluginName} already exists. Skipping.`));
    }
    
    writeAppConfig(config);
    console.log(chalk.green('✅ Tracking permission setup complete.'));
}

async function handleAppReset() {
    console.log(chalk.cyan('♻️ Resetting app structure...'));

    const oldAppDir = path.join(projectRoot, 'app');
    const newSrcDir = path.join(projectRoot, 'src');
    const newAppDir = path.join(newSrcDir, 'app');

    // Clean up old directories
    if (fs.existsSync(oldAppDir)) {
        fs.rmSync(oldAppDir, { recursive: true, force: true });
        console.log(chalk.yellow(`  -> Removed existing 'app' directory.`));
    }
    if (fs.existsSync(newAppDir)) {
        fs.rmSync(newAppDir, { recursive: true, force: true });
        console.log(chalk.yellow(`  -> Removed existing 'src/app' directory for a clean slate.`));
    }

    // Create new structure
    ensureDirExists(newAppDir);
    console.log(chalk.green(`  -> Created 'src/app' directory.`));

    // Create _layout.tsx and index.tsx from templates
    const moduleDir = path.dirname(require.resolve('expo-utils/package.json'));
    const layoutTemplatePath = path.join(moduleDir, 'templates', 'RootLayout.tsx');
    const indexTemplatePath = path.join(moduleDir, 'templates', 'index.tsx');

    if (fs.existsSync(layoutTemplatePath)) {
        fs.copyFileSync(layoutTemplatePath, path.join(newAppDir, '_layout.tsx'));
        console.log(chalk.green(`  -> Created src/app/_layout.tsx.`));
    }
    if (fs.existsSync(indexTemplatePath)) {
        fs.copyFileSync(indexTemplatePath, path.join(newAppDir, 'index.tsx'));
        console.log(chalk.green(`  -> Created src/app/index.tsx.`));
    }
    
    console.log(chalk.green('✅ App structure reset complete.'));
}


// --- Main Execution ---

async function main() {
    const args = process.argv.slice(2);
    
    // Always run dependency install first
    await handleDependencyInstall();
    
    console.log(chalk.blue('\n--- Running Scaffolding Steps ---'));

    if (args.includes('--new')) {
        console.log(chalk.magenta.bold('🚀 New project setup! Running non-destructive steps...'));
        
        // Run all non-destructive steps first
        handleIosBuildFixFlag();
        handleFirebasePlaceholdersFlag();
        handleConfigFlag();
        handleLanguagesFlag();
        handleSkadnetworkFlag();
        handleEasLoginScriptFlag();
        handleTrackingPermissionFlag();
        
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        
        rl.question(chalk.yellow.bold("\n❓ Tem certeza que deseja limpar a pasta 'app' e criar uma nova em 'src/app'? (y/N) "), async (answer) => {
            if (answer.toLowerCase() === 'y') {
                await handleAppReset();
            } else {
                console.log(chalk.gray('  -> Skipping app structure reset.'));
                // Explain what to do next if they skip
                console.log(chalk.cyan("\n💡 To manually move your 'app' folder, run 'npx expo-utils-install --srcapp'"));
                console.log(chalk.cyan("💡 To replace the layout, run 'npx expo-utils-install --layout'"));
            }
            rl.close();
            console.log(chalk.bold.magenta('\n✨ All done! ✨'));
        });

    } else if (args.length === 0) {
        console.log(chalk.yellow('No flags provided. Only dependency check was performed.\nUse --new to run all setup steps, or pass individual flags like --config, --layout, etc.'));
        console.log(chalk.bold.magenta('\n✨ All done! ✨'));
    } else {
        if (args.includes('--config')) handleConfigFlag();
        if (args.includes('--layout')) handleLayoutFlag();
        if (args.includes('--srcapp')) handleSrcAppFlag();
        if (args.includes('--languages')) handleLanguagesFlag();
        if (args.includes('--skadnetwork')) handleSkadnetworkFlag();
        if (args.includes('--firebase-placeholders')) handleFirebasePlaceholdersFlag();
        if (args.includes('--fix-ios-build')) handleIosBuildFixFlag();
        if (args.includes('--eas-login-script')) handleEasLoginScriptFlag();
        if (args.includes('--tracking-permission')) handleTrackingPermissionFlag();
        console.log(chalk.bold.magenta('\n✨ All done! ✨'));
    }
}

main().catch(err => {
    console.error(chalk.red.bold('\nA critical error occurred:'), err);
    process.exit(1);
});
