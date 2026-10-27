import {afterAll, beforeEach, describe, expect, spyOn, test} from "bun:test";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {mockChalk} from "./helpers/chalk-mock";

// Instalador × Hot Updater v0/v1 e o passo de dependências. O instalador lê o app a partir do cwd, então o
// teste roda num projeto temporário (recriado a cada teste).
mockChalk();
const root = mkdtempSync(join(tmpdir(), "expo-utils-hot-updater-"));
const originalCwd = process.cwd();
process.chdir(root);
const installer = require("../bin/install.js");
const libPkg = require("../package.json");
const stringsTemplate = readFileSync(join(originalCwd, "templates", "Strings.ts"), "utf8");
const logSpy = spyOn(console, "log").mockImplementation(() => {});
const errorSpy = spyOn(console, "error").mockImplementation(() => {});

afterAll(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.chdir(originalCwd);
    rmSync(root, {recursive: true, force: true});
});

const V0 = ">=0.35.3 <1";
const V1 = ">=1.1.3 <2";
const file = (name: string) => join(root, name);
const writeJson = (name: string, value: unknown) => writeFileSync(file(name), JSON.stringify(value, null, 2));
const readJson = (name: string) => JSON.parse(readFileSync(file(name), "utf8"));
const install = (name: string, version: string) => {
    mkdirSync(file(`node_modules/${name}`), {recursive: true});
    writeJson(`node_modules/${name}/package.json`, {name, version});
};

beforeEach(() => {
    for (const name of ["node_modules", "src", "constants", "package.json", "app.json", ".env", ".env.hotupdater", ".gitignore", "babel.config.js"]) {
        rmSync(file(name), {recursive: true, force: true});
    }
    logSpy.mockClear();
});

describe("passo de dependências", () => {
    test("peers do pacote: sem edge-to-edge; expo-navigation-bar opcional; Hot Updater aceita v0 e v1", () => {
        const peers = libPkg.peerDependencies;
        expect(peers["react-native-edge-to-edge"]).toBeUndefined();
        expect(libPkg.peerDependenciesMeta["react-native-edge-to-edge"]).toBeUndefined();
        expect(peers["expo-navigation-bar"]).toBe(">=57.0.0");
        expect(libPkg.peerDependenciesMeta["expo-navigation-bar"]).toEqual({optional: true});
        for (const name of ["@hot-updater/react-native", "@hot-updater/expo", "hot-updater"]) {
            expect(peers[name]).toBe(">=0.35.3 <1 || >=1.1.3 <2");
            expect(libPkg.peerDependenciesMeta[name]).toEqual({optional: true});
        }
    });

    test("@expo/ui e expo-device entram quando faltam e passam pelo expo install; Hot Updater com o range da geração", () => {
        const app = {dependencies: {expo: "~58.0.19", "expo-router": "~58.0.26"}};
        const v0 = installer.planMissingDependencies(libPkg.peerDependencies, app, 0);
        expect(v0.missing).toEqual(expect.arrayContaining(["@expo/ui", "expo-device", "expo-navigation-bar"]));
        expect(v0.expoManaged).toEqual(expect.arrayContaining(["@expo/ui", "expo-device", "expo-navigation-bar"]));
        expect(v0.missing).not.toContain("expo-router");
        expect(v0.specs["@expo/ui"]).toBe(">=57.0.0");
        for (const name of ["@hot-updater/react-native", "@hot-updater/expo", "hot-updater"]) {
            expect(v0.specs[name]).toBe(V0);
            expect(v0.expoManaged).not.toContain(name);
        }
        const v1 = installer.planMissingDependencies(libPkg.peerDependencies, app, 1);
        expect(v1.specs["hot-updater"]).toBe(V1);
        expect(v1.specs["@hot-updater/expo"]).toBe(V1);
    });

    test("app que já declara @expo/ui e expo-device (template do SDK 58) não reinstala", () => {
        const plan = installer.planMissingDependencies(libPkg.peerDependencies, {dependencies: {"@expo/ui": "~58.0.23"}, devDependencies: {"expo-device": "~58.0.5"}}, 0);
        expect(plan.missing).not.toContain("@expo/ui");
        expect(plan.missing).not.toContain("expo-device");
    });
});

describe("geração do Hot Updater", () => {
    test("v0 por padrão; v1 com a flag, com spec 1.x de qualquer pacote do Hot Updater ou com a 1.x instalada sem spec", () => {
        expect(installer.detectHotUpdaterGeneration([], {})).toBe(0);
        expect(installer.detectHotUpdaterGeneration(["--hot-updater"], {dependencies: {"@hot-updater/react-native": "0.36.19"}})).toBe(0);
        expect(installer.detectHotUpdaterGeneration(["--hot-updater"], {dependencies: {"hot-updater": V0}})).toBe(0);
        expect(installer.detectHotUpdaterGeneration(["--hot-updater-v1"], {dependencies: {"@hot-updater/react-native": "0.36.19"}})).toBe(1);
        expect(installer.detectHotUpdaterGeneration([], {dependencies: {"@hot-updater/react-native": "1.1.3"}})).toBe(1);
        expect(installer.detectHotUpdaterGeneration([], {devDependencies: {"@hot-updater/cloudflare": "^1.1.3"}})).toBe(1);
        install("@hot-updater/react-native", "1.1.3");
        // instalado sem spec (içado de outro pacote): vale a versão instalada
        expect(installer.detectHotUpdaterGeneration([], {dependencies: {}})).toBe(1);
        // v0 sem teto que resolveu a 1.x por acidente (latest = 1.x desde 20/10/2026): o spec vale, continua v0
        expect(installer.detectHotUpdaterGeneration([], {dependencies: {"@hot-updater/react-native": ">=0.35.3"}})).toBe(0);
    });

    test("alinhar pacotes: v0 trava o v0 sem teto; v1 leva todos (inclusive o cloudflare) para a 1.x", () => {
        const v0App: any = {dependencies: {"@hot-updater/react-native": ">=0.35.3", "hot-updater": "0.36.19"}};
        expect(installer.alignHotUpdaterDependencies(v0App, 0)).toEqual([`@hot-updater/react-native: >=0.35.3 → ${V0}`, `@hot-updater/expo@${V0}`]);
        expect(v0App.dependencies).toEqual({"@hot-updater/react-native": V0, "hot-updater": "0.36.19", "@hot-updater/expo": V0});

        const v1App: any = {dependencies: {"@hot-updater/react-native": "0.36.18"}, devDependencies: {"@hot-updater/cloudflare": "0.36.18", "hot-updater": "^0.36.18"}};
        installer.alignHotUpdaterDependencies(v1App, 1);
        expect(v1App.dependencies).toEqual({"@hot-updater/react-native": V1, "@hot-updater/expo": V1});
        expect(v1App.devDependencies).toEqual({"@hot-updater/cloudflare": V1, "hot-updater": V1});
        expect(installer.alignHotUpdaterDependencies(v1App, 1)).toEqual([]);
    });

    test("plugin: só o da geração, no lugar do outro e com as opções dele; sem channel = production", () => {
        const config: any = {expo: {plugins: ["expo-router", ["@hot-updater/react-native", {channel: "staging", publicKeyPath: "./keys/public-key.pem"}], ["expo-utils", {}]]}};
        expect(installer.applyHotUpdaterPlugin(config, 1)).toEqual({added: true, replaced: "@hot-updater/react-native"});
        expect(config.expo.plugins).toEqual(["expo-router", ["@hot-updater/expo", {channel: "staging", publicKeyPath: "./keys/public-key.pem"}], ["expo-utils", {}]]);

        const both: any = {expo: {plugins: ["@hot-updater/expo", ["@hot-updater/react-native", {channel: "beta"}]]}};
        installer.applyHotUpdaterPlugin(both, 0);
        expect(both.expo.plugins).toEqual([["@hot-updater/react-native", {channel: "beta"}]]);

        const fresh: any = {expo: {}};
        installer.applyHotUpdaterPlugin(fresh, 0);
        expect(fresh.expo.plugins).toEqual([["@hot-updater/react-native", {channel: "production"}]]);
    });

    test(".env: acrescenta só as chaves que faltam e preserva os valores", () => {
        const current = "HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID=abc\nHOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID=velho\n";
        const template = "# comentário\nHOT_UPDATER_CLOUDFLARE_ACCOUNT_ID=\nHOT_UPDATER_CLOUDFLARE_D1_DATABASE_NAME=\nHOT_UPDATER_API_KEY=\n";
        const merged = installer.mergeEnvKeys(current, template, "# v1");
        expect(merged.added).toEqual(["HOT_UPDATER_CLOUDFLARE_D1_DATABASE_NAME", "HOT_UPDATER_API_KEY"]);
        expect(merged.source).toBe(`${current.trimEnd()}\n\n# v1\nHOT_UPDATER_CLOUDFLARE_D1_DATABASE_NAME=\nHOT_UPDATER_API_KEY=\n`);
        expect(installer.mergeEnvKeys(merged.source, template, "# v1").added).toEqual([]);
    });
});

describe("Strings.ts no v1", () => {
    test("template: URL de exemplo do v1 e a chave (do .env.hotupdater, quando existe)", () => {
        const {source, warnings} = installer.hotUpdaterV1Strings(stringsTemplate, "hu_key_123");
        expect(source).toContain('hotUpdaterUrl: "https://YOUR-V1-WORKER.workers.dev",');
        expect(source).toContain('hotUpdaterApiKey: "hu_key_123",');
        expect(source).not.toContain("YOUR-WORKER.workers.dev/api/check-update");
        expect(warnings).toEqual([]);
        expect(installer.hotUpdaterV1Strings(source, "outra").changed).toBe(false);
    });

    test("Strings antigo sem a chave: entra logo depois de cada hotUpdaterUrl; URL real de v0 fica e vira aviso", () => {
        const old = 'const common = {\n    hotUpdaterUrl: "https://meu-app.workers.dev/api/check-update",\n};\n';
        const {source, warnings} = installer.hotUpdaterV1Strings(old, "");
        expect(source).toContain('    hotUpdaterUrl: "https://meu-app.workers.dev/api/check-update",\n    // Hot Updater v1');
        expect(source).toContain('    hotUpdaterApiKey: "",\n};');
        expect(warnings[0]).toContain("servidor v0");

        const shorthand = 'const hotUpdaterUrl = "https://v1.workers.dev";\nconst ios = {\n  hotUpdaterUrl,\n};\nconst android = {\n  hotUpdaterUrl,\n};\n';
        const both = installer.hotUpdaterV1Strings(shorthand, "k");
        expect(both.source.match(/hotUpdaterApiKey: "k",/g)).toHaveLength(2);
        expect(both.warnings).toEqual([]);

        expect(installer.hotUpdaterV1Strings("export default {};\n", "k").warnings[0]).toContain("não achei o hotUpdaterUrl");
    });
});

describe("--hot-updater de ponta a ponta", () => {
    const appJson = (plugins: unknown[]) => writeJson("app.json", {expo: {name: "App", slug: "app", plugins}});

    test("v0 num app novo: ranges v0, plugin @hot-updater/react-native, .env do v0 e Strings intacto", () => {
        writeJson("package.json", {name: "app", dependencies: {react: "19.3.0"}});
        appJson(["expo-router"]);
        mkdirSync(file("src/constants"), {recursive: true});
        writeFileSync(file("src/constants/Strings.ts"), stringsTemplate);

        installer.handleHotUpdaterFlag(0);

        const pkg = readJson("package.json");
        for (const name of ["@hot-updater/react-native", "@hot-updater/expo", "hot-updater"]) expect(pkg.dependencies[name]).toBe(V0);
        expect(readJson("app.json").expo.plugins).toEqual(["expo-router", ["@hot-updater/react-native", {channel: "production"}]]);
        expect(readFileSync(file(".env.hotupdater"), "utf8")).toContain("HOT_UPDATER_CLOUDFLARE_API_TOKEN=YOUR_API_TOKEN_HERE");
        expect(readFileSync(file("src/constants/Strings.ts"), "utf8")).toBe(stringsTemplate);
        expect(readFileSync(file("babel.config.js"), "utf8")).toContain("@hot-updater/expo/babel-plugin");

        // babel do app que já tem o plugin (com outros plugins) não é sobrescrito numa nova rodada
        const custom = "module.exports = () => ({presets: ['babel-preset-expo'], plugins: ['@hot-updater/expo/babel-plugin', 'react-native-worklets/plugin']});\n";
        writeFileSync(file("babel.config.js"), custom);
        installer.handleHotUpdaterFlag(0);
        expect(readFileSync(file("babel.config.js"), "utf8")).toBe(custom);
    });

    test("v1 num app que vinha do v0: pacotes 1.x, plugin trocado, chaves do v1 no .env e a chave no Strings", () => {
        writeJson("package.json", {
            name: "app",
            dependencies: {react: "19.3.0", "@hot-updater/react-native": "0.36.18", "hot-updater": "0.36.18"},
            devDependencies: {"@hot-updater/expo": "0.36.18", "@hot-updater/cloudflare": "0.36.18"},
        });
        appJson([["@hot-updater/react-native", {channel: "production"}]]);
        writeFileSync(file(".env.hotupdater"), "HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID=conta\nHOT_UPDATER_API_KEY=hu_live_abc\n");
        mkdirSync(file("src/constants"), {recursive: true});
        writeFileSync(file("src/constants/Strings.ts"), stringsTemplate);

        installer.handleHotUpdaterFlag(1);

        const pkg = readJson("package.json");
        expect(pkg.dependencies["@hot-updater/react-native"]).toBe(V1);
        expect(pkg.dependencies["hot-updater"]).toBe(V1);
        expect(pkg.devDependencies).toEqual({"@hot-updater/expo": V1, "@hot-updater/cloudflare": V1});
        expect(readJson("app.json").expo.plugins).toEqual([["@hot-updater/expo", {channel: "production"}]]);
        const env = readFileSync(file(".env.hotupdater"), "utf8");
        expect(env).toStartWith("HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID=conta\nHOT_UPDATER_API_KEY=hu_live_abc\n");
        for (const key of ["HOT_UPDATER_CLOUDFLARE_R2_ACCESS_KEY_ID", "HOT_UPDATER_CLOUDFLARE_R2_PRIVATE", "HOT_UPDATER_CLOUDFLARE_D1_DATABASE_NAME", "HOT_UPDATER_CLOUDFLARE_WORKER_NAME"]) {
            expect(env).toContain(`${key}=`);
        }
        expect(env.match(/HOT_UPDATER_API_KEY=/g)).toHaveLength(1);
        const strings = readFileSync(file("src/constants/Strings.ts"), "utf8");
        expect(strings).toContain('hotUpdaterApiKey: "hu_live_abc",');
        expect(strings).toContain('hotUpdaterUrl: "https://YOUR-V1-WORKER.workers.dev",');
        expect(existsSync(file(".env"))).toBe(true);
    });

    test("--constants no v1 cria o Strings.ts do template já com a URL e a chave do v1", () => {
        mkdirSync(file("src/app"), {recursive: true});
        installer.handleConstantsFlag(1);
        const strings = readFileSync(file("src/constants/Strings.ts"), "utf8");
        expect(strings).toContain('hotUpdaterUrl: "https://YOUR-V1-WORKER.workers.dev",');
        expect(strings).toContain('hotUpdaterApiKey: "",');

        rmSync(file("src/constants"), {recursive: true, force: true});
        installer.handleConstantsFlag(0);
        expect(readFileSync(file("src/constants/Strings.ts"), "utf8")).toBe(stringsTemplate);
    });
});
