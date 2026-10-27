import {afterAll, beforeEach, expect, mock, spyOn, test} from "bun:test";
import {spawnSync} from "child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

// mediationSdkCheck: o build confere se cada rede da mediação leva o SDK dela (o adapter sozinho não serve anúncio —
// a Unity foi para a loja assim em 06/10/2026). Android: task do Gradle antes do Release; iOS: post_install do
// Podfile. Só o @expo/config-plugins é de mentira (os mods ficam guardados e rodam aqui); o generateCode é o de verdade.
const appGradleMods: Array<(cfg: any) => any> = [];
const iosMods: Array<(cfg: any) => any> = [];
const passthrough = (config: any) => config;
mock.module("@expo/config-plugins", () => ({
    withInfoPlist: passthrough,
    withAppDelegate: passthrough,
    withMainApplication: passthrough,
    withProjectBuildGradle: passthrough,
    withGradleProperties: passthrough,
    withAppBuildGradle: (config: any, mod: (cfg: any) => any) => {
        appGradleMods.push(mod);
        return config;
    },
    withDangerousMod: (config: any, [platform, mod]: [string, (cfg: any) => any]) => {
        if (platform === "ios") iosMods.push(mod);
        return config;
    },
    createRunOncePlugin: (plugin: any) => plugin,
}));

const withExpoUtils = require("../app.plugin.js");
const {mediationSdkExpectations, androidMediationSdkCheck, iosMediationSdkCheck} = withExpoUtils.mediationInternals;
const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
const root = mkdtempSync(join(tmpdir(), "expo-utils-sdk-check-"));
const podfile = join(root, "ios", "Podfile");
const PODFILE = [
    "require 'json'",
    "target 'App' do",
    "  use_expo_modules!",
    "  post_install do |installer|",
    "    react_native_post_install(installer)",
    "  end",
    "end",
    "",
].join("\n");
const GRADLE = 'apply plugin: "com.android.application"\n\ndependencies {\n    implementation("com.facebook.react:react-android")\n}\n';

afterAll(() => {
    warnSpy.mockRestore();
    rmSync(root, {recursive: true, force: true});
});

beforeEach(() => {
    appGradleMods.length = 0;
    iosMods.length = 0;
    warnSpy.mockClear();
    rmSync(join(root, "ios"), {recursive: true, force: true});
    mkdirSync(join(root, "ios"), {recursive: true});
    writeFileSync(podfile, PODFILE);
});

// Roda o plugin e devolve o app/build.gradle e o Podfile como ficariam depois do prebuild.
function prebuild(options: Record<string, unknown>, gradle = GRADLE) {
    withExpoUtils({name: "App", slug: "app", _internal: {projectRoot: root}}, options);
    let contents = gradle;
    for (const mod of appGradleMods) contents = mod({modResults: {language: "groovy", contents}, modRequest: {projectRoot: root}}).modResults.contents;
    for (const mod of iosMods) mod({modRequest: {platformProjectRoot: join(root, "ios"), projectRoot: root}});
    return {gradle: contents, podfile: readFileSync(podfile, "utf8")};
}

test("catálogo: as 6 redes do Eleições pedem o SDK certo nas duas plataformas (Pangle aceita os dois pods)", () => {
    const networks = withExpoUtils.mediationInternals.resolveMediationNetworks(["applovin", "pangle", "liftoff", "mintegral", "unity", "meta"]);
    const {android, ios} = mediationSdkExpectations(networks);
    expect(android).toEqual([
        {label: "AppLovin", coords: ["com.applovin:applovin-sdk"]},
        {label: "Pangle", coords: ["com.pangle.global:pag-sdk"]},
        {label: "Liftoff Monetize (Vungle)", coords: ["com.vungle:vungle-ads"]},
        {label: "Mintegral", coords: ["com.mbridge.msdk.oversea:mbridge_android_sdk"]},
        {label: "Unity Ads", coords: ["com.unity3d.ads:unity-ads"]},
        {label: "Meta Audience Network", coords: ["com.facebook.android:audience-network-sdk"]},
    ]);
    expect(ios.map((e: any) => e.pods)).toEqual([
        ["AppLovinSDK"],
        ["Ads-Global", "Ads-Global-Beta"],
        ["VungleAds"],
        ["MintegralAdSDK"],
        ["UnityAds"],
        ["FBAudienceNetwork"],
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
});

test("prebuild com mediação: task do Gradle no fim do build.gradle e trecho no começo do post_install", () => {
    const {gradle, podfile: pod} = prebuild({mediation: ["unity", "meta"]});
    // o resto do arquivo fica (o bloco dos adapters entra dentro do dependencies, como sempre)
    expect(gradle).toContain('apply plugin: "com.android.application"');
    expect(gradle).toContain('implementation("com.facebook.react:react-android")');
    expect(gradle).toContain('    ["Unity Ads", ["com.unity3d.ads:unity-ads"]],');
    expect(gradle).toContain('    ["Meta Audience Network", ["com.facebook.android:audience-network-sdk"]],');
    expect(gradle).toContain('onVariants(selector().withBuildType("release"))');
    expect(gradle).toContain('"pre" + sufixo + "Build"');
    expect(gradle.trimEnd().endsWith("// @generated end expo-utils-admob-mediation-sdk-check")).toBe(true);
    const linhas = pod.split("\n");
    const inicio = linhas.findIndex((l) => l.includes("post_install do |installer|"));
    expect(linhas[inicio + 1]).toContain("@generated begin expo-utils-admob-mediation-sdk-check");
    expect(pod).toContain("      ['Unity Ads', ['UnityAds']],");
    expect(pod).toContain("      ['Meta Audience Network', ['FBAudienceNetwork']],");
    expect(pod).toContain("    react_native_post_install(installer)");
});

test("rodar o prebuild 2x não duplica; desligar a conferência ou a mediação tira os blocos", () => {
    const primeira = prebuild({mediation: ["unity"]});
    const segunda = prebuild({mediation: ["unity"]}, primeira.gradle);
    expect(segunda.gradle).toBe(primeira.gradle);
    writeFileSync(podfile, primeira.podfile);
    expect(prebuild({mediation: ["unity"]}, primeira.gradle).podfile).toBe(primeira.podfile);

    const TAG = "expo-utils-admob-mediation-sdk-check";
    expect(primeira.podfile).toContain(TAG);
    writeFileSync(podfile, primeira.podfile);
    const semConferencia = prebuild({mediation: ["unity"], mediationSdkCheck: false}, primeira.gradle);
    expect(semConferencia.gradle).not.toContain(TAG);
    expect(semConferencia.podfile).not.toContain(TAG);
    expect(semConferencia.podfile).toContain("pod 'GoogleMobileAdsMediationUnity'"); // a mediação continua

    writeFileSync(podfile, primeira.podfile);
    const semMediacao = prebuild({mediation: false}, primeira.gradle);
    expect(semMediacao.gradle).not.toContain(TAG);
    expect(semMediacao.podfile).not.toContain(TAG);
});

test("rede definida no app.json sem sdk/sdkPod entra na mediação, mas não é conferida (e avisa)", () => {
    const networks = withExpoUtils.mediationInternals.resolveMediationNetworks({
        unity: true,
        nova: {android: {artifact: "com.exemplo:adapter", version: "1.0.0"}, ios: {pod: "ExemploAdapter", version: "1.0.0"}},
    });
    const {android, ios} = mediationSdkExpectations(networks);
    expect(android.map((e: any) => e.label)).toEqual(["Unity Ads"]);
    expect(ios.map((e: any) => e.label)).toEqual(["Unity Ads"]);
    expect(warnSpy.mock.calls.flat().join(" ")).toContain('"nova" sem android.sdk');
});

test("textos com aspas e $ ficam escapados no Groovy e no Ruby", () => {
    const groovy = androidMediationSdkCheck([{label: 'Rede "X" $1', coords: ["g:m"]}]);
    expect(groovy).toContain('    ["Rede \\"X\\" \\$1", ["g:m"]],');
    const ruby = iosMediationSdkCheck([{label: "Rede d'X", pods: ["P"]}]);
    expect(ruby).toContain("      ['Rede d\\'X', ['P']],");
});

// O trecho do Podfile roda de verdade num Ruby com um installer de mentira: para com a lista do que falta e passa
// quando todos os SDKs estão lá (uma alternativa basta, como o Ads-Global-Beta da Pangle no RNGMA 16.x).
const ruby = spawnSync("ruby", ["-v"]).status === 0;
test.if(ruby)("trecho do post_install: para sem o SDK e passa com ele (Ruby de verdade)", () => {
    const trecho = iosMediationSdkCheck([
        {label: "Unity Ads", pods: ["UnityAds"]},
        {label: "Pangle", pods: ["Ads-Global", "Ads-Global-Beta"]},
    ]);
    const rodar = (pods: string[]) => {
        const script = [
            "PodTarget = Struct.new(:pod_name)",
            `installer = Struct.new(:pod_targets).new(${JSON.stringify(pods)}.map { |p| PodTarget.new(p) })`,
            trecho,
            'puts "ok"',
        ].join("\n");
        return spawnSync("ruby", ["-e", script], {encoding: "utf8"});
    };
    const completo = rodar(["GoogleMobileAdsMediationUnity", "UnityAds", "GoogleMobileAdsMediationPangle", "Ads-Global-Beta"]);
    expect(completo.status).toBe(0);
    expect(completo.stdout.trim()).toBe("ok");
    const semUnity = rodar(["GoogleMobileAdsMediationUnity", "Ads-Global"]);
    expect(semUnity.status).not.toBe(0);
    expect(semUnity.stderr).toContain("Mediação sem o SDK da rede: Unity Ads (UnityAds)");
});
