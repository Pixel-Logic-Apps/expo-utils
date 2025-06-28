#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

console.log(chalk.blue('Starting expo-utils peer dependency installation...'));

// Encontre o package.json do módulo expo-utils
const modulePath = path.dirname(require.resolve('expo-utils/package.json'));
const modulePkg = require(path.join(modulePath, 'package.json'));

const peerDependencies = modulePkg.peerDependencies;
if (!peerDependencies) {
    console.log(chalk.green('No peer dependencies found. Nothing to install.'));
    process.exit(0);
}

const depsToInstall = Object.keys(peerDependencies).map(dep => `"${dep}@${peerDependencies[dep]}"`).join(' ');

console.log(chalk.yellow('Found the following dependencies to install:'));
console.log(depsToInstall);

// Verifique qual gerenciador de pacotes está sendo usado (yarn.lock, package-lock.json, etc.)
const projectRoot = process.cwd();
const useYarn = fs.existsSync(path.join(projectRoot, 'yarn.lock'));

const command = useYarn
    ? `yarn add ${depsToInstall}`
    : `npm install ${depsToInstall}`;

console.log(chalk.blue(`Running command: ${command}`));

const installProcess = exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(chalk.red(`Error installing peer dependencies: ${error.message}`));
        return;
    }
    if (stderr) {
        console.warn(chalk.yellow(`Installation warnings: ${stderr}`));
    }
    console.log(stdout);
    console.log(chalk.green.bold('✅ Peer dependencies installed successfully!'));
    console.log(chalk.cyan('Please add the required plugins to your app.json file.'));
});

installProcess.stdout.on('data', (data) => {
    console.log(data.toString());
});

installProcess.stderr.on('data', (data) => {
    console.error(data.toString());
}); 