import {afterAll, beforeEach, expect, mock, test} from "bun:test";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

// androidR8KeepRules: no prebuild Android o plugin acrescenta ao app/proguard-rules.pro as regras do Room, do
// WorkManager e do Glance com `{ void <init>(); }` (o R8 do AGP 9 não mantém mais o construtor vazio por
// `-keep class A`).
// Só o @expo/config-plugins é de mentira (os mods de Android ficam guardados e rodam contra uma pasta
// temporária); o generateCode é o de verdade, o mesmo que o prebuild usa.
const androidMods: Array<(cfg: any) => any> = [];
const passthrough = (config: any) => config;
mock.module("@expo/config-plugins", () => ({
    withInfoPlist: passthrough,
    withAppDelegate: passthrough,
    withMainApplication: passthrough,
    withAppBuildGradle: passthrough,
    withProjectBuildGradle: passthrough,
    withGradleProperties: passthrough,
    withDangerousMod: (config: any, [platform, mod]: [string, (cfg: any) => any]) => {
        if (platform === "android") androidMods.push(mod);
        return config;
    },
    createRunOncePlugin: (plugin: any) => plugin,
}));

const withExpoUtils = require("../app.plugin.js");
const root = mkdtempSync(join(tmpdir(), "expo-utils-r8-"));
const proguard = join(root, "android", "app", "proguard-rules.pro");
const RULES = [
    "-keep class * extends androidx.room.RoomDatabase { void <init>(); }",
    "-keep class * extends androidx.work.InputMerger { void <init>(); }",
    "-keep public class * extends androidx.glance.appwidget.action.ActionCallback { void <init>(); }",
];
// Trecho do proguard-rules.pro do template do SDK 58
const TEMPLATE = [
    "# react-native-reanimated",
    "-keep class com.swmansion.reanimated.** { *; }",
    "-keep class com.facebook.react.turbomodule.** { *; }",
    "",
    "# Add any project specific keep options here:",
    "",
].join("\n");

afterAll(() => rmSync(root, {recursive: true, force: true}));

beforeEach(() => {
    androidMods.length = 0;
    rmSync(join(root, "android"), {recursive: true, force: true});
    mkdirSync(join(root, "android", "app"), {recursive: true});
});

function prebuild(options: Record<string, unknown> = {}) {
    withExpoUtils({name: "App", slug: "app", _internal: {projectRoot: root}}, {mediation: false, ...options});
    for (const mod of androidMods) mod({modRequest: {platformProjectRoot: join(root, "android")}});
}
const count = (text: string, piece: string) => text.split(piece).length - 1;

test("template do SDK 58: o bloco entra no fim, com as 3 regras, e o resto do arquivo fica", () => {
    writeFileSync(proguard, TEMPLATE);
    prebuild();
    const out = readFileSync(proguard, "utf8");
    expect(out.startsWith(TEMPLATE.trimEnd())).toBe(true);
    for (const rule of RULES) expect(count(out, rule)).toBe(1);
    expect(out).toMatch(/# @generated begin expo-utils-r8-keep-rules - expo prebuild \(DO NOT MODIFY\) sync-[0-9a-f]+\n/);
    expect(out.endsWith(`${RULES.join("\n")}\n# @generated end expo-utils-r8-keep-rules\n`)).toBe(true);
});

test("rodar o prebuild 2x deixa o arquivo igual (idempotente)", () => {
    writeFileSync(proguard, TEMPLATE);
    prebuild();
    const first = readFileSync(proguard, "utf8");
    prebuild();
    expect(readFileSync(proguard, "utf8")).toBe(first);
});

test("bloco do expo-build-properties (extraProguardRules) continua; bloco antigo da lib é trocado, sem duplicar", () => {
    const buildProperties = [
        "# @generated begin expo-build-properties - expo prebuild (DO NOT MODIFY)",
        "-keep class com.meuapp.** { *; }",
        "# @generated end expo-build-properties",
    ].join("\n");
    const oldBlock = [
        "# @generated begin expo-utils-r8-keep-rules - expo prebuild (DO NOT MODIFY) sync-0000",
        RULES[0],
        "# @generated end expo-utils-r8-keep-rules",
    ].join("\n");
    writeFileSync(proguard, `${TEMPLATE}\n${oldBlock}\n\n${buildProperties}\n`);
    prebuild();
    const out = readFileSync(proguard, "utf8");
    expect(out).toContain(buildProperties);
    expect(out).not.toContain("sync-0000");
    for (const rule of RULES) expect(count(out, rule)).toBe(1);
    expect(count(out, "# @generated begin expo-utils-r8-keep-rules")).toBe(1);
});

test("sem proguard-rules.pro: o arquivo nasce só com o bloco", () => {
    prebuild();
    const out = readFileSync(proguard, "utf8");
    expect(out.startsWith("# @generated begin expo-utils-r8-keep-rules")).toBe(true);
    for (const rule of RULES) expect(count(out, rule)).toBe(1);
});

test("androidR8KeepRules: false não mexe no proguard-rules.pro", () => {
    writeFileSync(proguard, TEMPLATE);
    prebuild({androidR8KeepRules: false});
    expect(readFileSync(proguard, "utf8")).toBe(TEMPLATE);
    rmSync(proguard);
    prebuild({androidR8KeepRules: false});
    expect(existsSync(proguard)).toBe(false);
});
