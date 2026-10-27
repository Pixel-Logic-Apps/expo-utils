import {afterAll, beforeEach, expect, spyOn, test} from "bun:test";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {mockChalk} from "./helpers/chalk-mock";

// --fix-ios-build escolhe o expo-build-properties pela major do RNFirebase INSTALADO no app (o spec vale só
// sem node_modules): 27+ → frameworks dinâmicos (Firebase iOS 13 só por SPM) + Kotlin 2.4.20; 24–26 → o
// stack estático. O instalador lê o app a partir do cwd, então o teste roda num projeto temporário.
mockChalk();
const root = mkdtempSync(join(tmpdir(), "expo-utils-ios-build-"));
const originalCwd = process.cwd();
process.chdir(root);
const installer = require("../bin/install.js");
const logSpy = spyOn(console, "log").mockImplementation(() => {});

afterAll(() => {
    logSpy.mockRestore();
    process.chdir(originalCwd);
    rmSync(root, {recursive: true, force: true});
});

const writeJson = (file: string, value: unknown) => writeFileSync(join(root, file), JSON.stringify(value, null, 2));
const appPlugins = () => JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo.plugins;
const buildProperties = () => appPlugins().find((p: any) => Array.isArray(p) && p[0] === "expo-build-properties")[1];
const installRnfb = (version: string | null) => {
    rmSync(join(root, "node_modules"), {recursive: true, force: true});
    if (version === null) return;
    mkdirSync(join(root, "node_modules", "@react-native-firebase", "app"), {recursive: true});
    writeJson("node_modules/@react-native-firebase/app/package.json", {name: "@react-native-firebase/app", version});
};
const app = (spec: string | null, plugins: unknown[] = []) => {
    writeJson("package.json", {name: "app", dependencies: spec ? {"@react-native-firebase/app": spec} : {}});
    writeJson("app.json", {expo: {name: "App", slug: "app", plugins}});
};
const RNFB_PODS = ["RNFBApp", "RNFBAuth", "RNFBFirestore", "RNFBMessaging", "RNFBCrashlytics", "RNFBAnalytics", "RNFBRemoteConfig"];
const STATIC = {ios: {useFrameworks: "static", forceStaticLinking: RNFB_PODS}};
const DYNAMIC = {
    ios: {useFrameworks: "dynamic", forceStaticLinking: ["RNGoogleMobileAds", "react-native-fbsdk-next"]},
    android: {kotlinVersion: "2.4.20"},
};

beforeEach(() => installRnfb(null));

test("buildPropertiesFor: 24–26 e desconhecido = estático; 27+ = dinâmico, RNGMA e fbsdk estáticos, Kotlin 2.4.20", () => {
    for (const major of [24, 25, 26, null]) expect(installer.buildPropertiesFor(major)).toEqual(STATIC);
    for (const major of [27, 28]) expect(installer.buildPropertiesFor(major)).toEqual(DYNAMIC);
});

test("RNFB 26.4.0 instalado (spec >=24.0.0): plugin novo com o stack estático, sem useModularHeaders nem android", () => {
    installRnfb("26.4.0");
    app(">=24.0.0");
    installer.handleIosBuildFixFlag();
    expect(buildProperties()).toEqual(STATIC);
    const config = JSON.parse(readFileSync(join(root, "app.json"), "utf8"));
    expect(config.expo.ios.entitlements["aps-environment"]).toBe("production");
});

test("RNFB 27.1.0 instalado: config estática antiga vira dinâmica, sem RNFB* no forceStaticLinking; o resto fica", () => {
    installRnfb("27.1.0");
    app(">=24.0.0", [
        "expo-router",
        [
            "expo-build-properties",
            {
                ios: {useFrameworks: "static", useModularHeaders: true, forceStaticLinking: [...RNFB_PODS, "MeuPod"], deploymentTarget: "16.4"},
                android: {minSdkVersion: 24},
            },
        ],
    ]);
    installer.handleIosBuildFixFlag();
    expect(buildProperties()).toEqual({
        ios: {useFrameworks: "dynamic", forceStaticLinking: ["MeuPod", "RNGoogleMobileAds", "react-native-fbsdk-next"], deploymentTarget: "16.4"},
        android: {minSdkVersion: 24, kotlinVersion: "2.4.20"},
    });
    expect(appPlugins()[0]).toBe("expo-router");
});

test("rodar 2x não duplica nada (idempotente)", () => {
    installRnfb("27.1.0");
    app("27.1.0", ["expo-build-properties"]);
    installer.handleIosBuildFixFlag();
    installer.handleIosBuildFixFlag();
    expect(buildProperties()).toEqual(DYNAMIC);
    expect(appPlugins().filter((p: any) => (Array.isArray(p) ? p[0] : p) === "expo-build-properties")).toHaveLength(1);
});

test("a versão instalada vence o spec; sem node_modules vale o spec; sem RNFB nenhum fica o estático", () => {
    installRnfb("27.1.0");
    app("^26.4.0");
    installer.handleIosBuildFixFlag();
    expect(buildProperties().ios.useFrameworks).toBe("dynamic");

    installRnfb("26.4.0");
    app("27.1.0");
    installer.handleIosBuildFixFlag();
    expect(buildProperties().ios.useFrameworks).toBe("static");

    installRnfb(null);
    app("27.1.0");
    installer.handleIosBuildFixFlag();
    expect(buildProperties()).toEqual(DYNAMIC);

    app("^25.1.0");
    installer.handleIosBuildFixFlag();
    expect(buildProperties()).toEqual(STATIC);

    app(null);
    installer.handleIosBuildFixFlag();
    expect(buildProperties()).toEqual(STATIC);
    expect(logSpy.mock.calls.flat().join(" ")).toContain("não encontrado");
});

test("app no RNFB 26 que já tinha o Kotlin de outro build: o estático não mexe no android", () => {
    installRnfb("26.4.0");
    app("26.4.0", [["expo-build-properties", {android: {kotlinVersion: "2.1.20"}}]]);
    installer.handleIosBuildFixFlag();
    expect(buildProperties()).toEqual({...STATIC, android: {kotlinVersion: "2.1.20"}});
});
