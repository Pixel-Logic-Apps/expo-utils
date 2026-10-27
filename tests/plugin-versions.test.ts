import {afterAll, expect, mock, spyOn, test} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

// O plugin lê a versão do que está INSTALADO no app e decide sozinho (sem opção no app.json):
//   - RNFirebase 24–26 → `$RNFirebaseDisableSPM = true` no Podfile; 27+ → não (o Firebase iOS 13 só vem por SPM e a
//     global quebra o pod install). `firebaseDisableSPM: true|false` ainda força.
//   - react-native-google-mobile-ads 16.x → versões do `compat` do catálogo (Pangle que aceita o GMA iOS 13.5.0).
// O @expo/config-plugins é de mentira: os mods de iOS ficam guardados e rodam contra um Podfile temporário, e o
// mergeContents só registra o bloco que entraria (a escrita real é a do Expo, conferida no prebuild).
const iosMods: Array<(cfg: any) => any> = [];
const merges: Array<{tag: string; newSrc: string}> = [];
const passthrough = (config: any) => config;
mock.module("@expo/config-plugins", () => ({
    withInfoPlist: passthrough,
    withAppDelegate: passthrough,
    withMainApplication: passthrough,
    withAppBuildGradle: passthrough,
    withProjectBuildGradle: passthrough,
    withGradleProperties: passthrough,
    withDangerousMod: (config: any, [platform, mod]: [string, (cfg: any) => any]) => {
        if (platform === "ios") iosMods.push(mod);
        return config;
    },
    createRunOncePlugin: (plugin: any) => plugin,
}));
mock.module("@expo/config-plugins/build/utils/generateCode", () => ({
    mergeContents: ({src, newSrc, tag}: {src: string; newSrc: string; tag: string}) => {
        merges.push({tag, newSrc});
        return {contents: src, didMerge: false};
    },
    removeContents: ({src}: {src: string}) => ({contents: src, didClear: false}),
    createGeneratedHeaderComment: () => "",
}));

const withExpoUtils = require("../app.plugin.js");
const {rnfbUsesCocoaPods} = withExpoUtils.firebaseInternals;
const {installedRngmaMajor} = withExpoUtils.mediationInternals;
const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
const roots: string[] = [];

afterAll(() => {
    warnSpy.mockRestore();
    for (const root of roots) rmSync(root, {recursive: true, force: true});
});

// Um projeto por cenário: o plugin lê o package.json com require(), que fica em cache por caminho.
function project(installed: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), "expo-utils-plugin-"));
    roots.push(root);
    for (const [name, version] of Object.entries(installed)) {
        mkdirSync(join(root, "node_modules", name), {recursive: true});
        writeFileSync(join(root, "node_modules", name, "package.json"), JSON.stringify({name, version}));
    }
    mkdirSync(join(root, "ios"), {recursive: true});
    writeFileSync(join(root, "ios", "Podfile"), "require 'json'\ntarget 'App' do\n  use_expo_modules!\nend\n");
    return root;
}

// Roda o plugin e os mods de iOS; devolve o bloco de cada tag que entraria no Podfile.
function prebuildIos(root: string, options: Record<string, unknown> = {}) {
    iosMods.length = 0;
    merges.length = 0;
    withExpoUtils({name: "App", slug: "app", _internal: {projectRoot: root}}, options);
    for (const mod of iosMods) mod({modRequest: {projectRoot: root, platformProjectRoot: join(root, "ios")}});
    return Object.fromEntries(merges.map((merge) => [merge.tag, merge.newSrc]));
}

const GLOBALS = "rnfirebase-analytics-podfile-globals";
const PODS = "expo-utils-admob-mediation";

test("leitura das versões instaladas: RNFB < 27 usa CocoaPods (sem o pacote, como antes); major do RNGMA", () => {
    expect(rnfbUsesCocoaPods({_internal: {projectRoot: project({"@react-native-firebase/app": "26.4.0"})}})).toBe(true);
    expect(rnfbUsesCocoaPods({_internal: {projectRoot: project({"@react-native-firebase/app": "27.1.0"})}})).toBe(false);
    expect(rnfbUsesCocoaPods({_internal: {projectRoot: project({})}})).toBe(true);
    expect(installedRngmaMajor({_internal: {projectRoot: project({"react-native-google-mobile-ads": "16.5.0"})}})).toBe(16);
    expect(installedRngmaMajor({_internal: {projectRoot: project({"react-native-google-mobile-ads": "17.4.0"})}})).toBe(17);
    expect(installedRngmaMajor({_internal: {projectRoot: project({})}})).toBeNull();
});

test("SDK 57 (RNFB 26, RNGMA 16): $RNFirebaseDisableSPM entra e o Pangle fica no pod do GMA 13.5", () => {
    const blocks = prebuildIos(project({"@react-native-firebase/app": "26.4.0", "react-native-google-mobile-ads": "16.5.0"}));
    expect(blocks[GLOBALS].split("\n")).toEqual([
        "$RNFirebaseDisableSPM = true",
        "$RNFirebaseAnalyticsEnableAdSupport = true",
        "$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion = true",
    ]);
    expect(blocks[PODS]).toContain("pod 'GoogleMobileAdsMediationPangle', '8.2.0.3.0'");
});

test("SDK 58 (RNFB 27, RNGMA 17.4): sem $RNFirebaseDisableSPM e com o Pangle do RNGMA 17.4", () => {
    const blocks = prebuildIos(project({"@react-native-firebase/app": "27.1.0", "react-native-google-mobile-ads": "17.4.0"}));
    expect(blocks[GLOBALS].split("\n")).toEqual([
        "$RNFirebaseAnalyticsEnableAdSupport = true",
        "$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion = true",
    ]);
    expect(blocks[PODS]).toContain("pod 'GoogleMobileAdsMediationPangle', '8.3.0.8.0'");
    expect(blocks[PODS]).toContain("pod 'GoogleMobileAdsMediationAppLovin', '13.6.4.0'");
});

test("firebaseDisableSPM no app.json ainda força os dois lados", () => {
    expect(prebuildIos(project({"@react-native-firebase/app": "27.1.0"}), {firebaseDisableSPM: true})[GLOBALS]).toContain("$RNFirebaseDisableSPM = true");
    expect(prebuildIos(project({"@react-native-firebase/app": "26.4.0"}), {firebaseDisableSPM: false})[GLOBALS]).not.toContain("$RNFirebaseDisableSPM");
});
