#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

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
    const pluginsToAdd = require(pluginsConfigPath);

    config.expo = config.expo || {};
    config.expo.plugins = config.expo.plugins || [];

    Object.keys(pluginsToAdd).forEach(pluginName => {
        if (!config.expo.plugins.some(p => (Array.isArray(p) ? p[0] : p) === pluginName)) {
            config.expo.plugins.push([pluginName, pluginsToAdd[pluginName]]);
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

// --- Main Execution ---

async function main() {
    const args = process.argv.slice(2);
    
    // Always run dependency install first
    await handleDependencyInstall();
    
    console.log(chalk.blue('\n--- Running Scaffolding Steps ---'));

    if (args.includes('--new')) {
        console.log(chalk.magenta.bold('🚀 New project setup! Running all scaffolding steps...'));
        // The order here can be important
        handleConfigFlag();
        handleSrcAppFlag(); // Better to move 'app' before trying to modify its contents
        handleLayoutFlag();
        handleLanguagesFlag();
        handleSkadnetworkFlag();
    } else if (args.length === 0) {
        console.log(chalk.yellow('No flags provided. Only dependency check was performed.\nUse --new to run all setup steps, or pass individual flags like --config, --layout, etc.'));
    } else {
        if (args.includes('--config')) handleConfigFlag();
        if (args.includes('--layout')) handleLayoutFlag();
        if (args.includes('--srcapp')) handleSrcAppFlag();
        if (args.includes('--languages')) handleLanguagesFlag();
        if (args.includes('--skadnetwork')) handleSkadnetworkFlag();
    }
    
    console.log(chalk.bold.magenta('\n✨ All done! ✨'));
}

main().catch(err => {
    console.error(chalk.red.bold('\nA critical error occurred:'), err);
    process.exit(1);
}); 