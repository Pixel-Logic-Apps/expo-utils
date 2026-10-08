import {afterEach, describe, expect, mock, spyOn, test} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";

// O plugin roda no Node do prebuild e este repo não tem node_modules: aqui o @expo/config-plugins é de
// mentira e só as funções PURAS da mediação são testadas (catálogo → linhas do Gradle). O caminho real
// (mergeContents no android/app/build.gradle) é conferido com `expo prebuild` numa cópia temporária.
const passthrough = (config: any) => config;
mock.module("@expo/config-plugins", () => ({
    withInfoPlist: passthrough,
    withAppDelegate: passthrough,
    withMainApplication: passthrough,
    withAppBuildGradle: passthrough,
    withDangerousMod: passthrough,
    withProjectBuildGradle: passthrough,
    withGradleProperties: passthrough,
    createRunOncePlugin: (plugin: any) => plugin,
}));
mock.module("@expo/config-plugins/build/utils/generateCode", () => ({
    mergeContents: () => ({contents: "", didMerge: false}),
    removeContents: () => ({contents: "", didClear: false}),
    createGeneratedHeaderComment: () => "",
}));

const {resolveMediationNetworks, androidMediationDependencies} = require("../app.plugin.js").mediationInternals;
const catalog = require("../data/mediation_adapters.json").networks as Record<string, any>;

// Resultado de `node scripts/check-mediation-poms.js` em 2026-10-07: o SDK que o POM do adapter
// (Google Maven) declara, na versão do adapter conferida. `sdk: null` = o POM NÃO traz o SDK ("This build
// does not contain the UnityAds SDK") e o catálogo precisa dele em `android.extraArtifacts` — sem isso o
// app vai com o adapter e sem o SDK (Unity com 0% de match, visto num APK de produção em 06/10/2026).
// Subiu a versão de um adapter ou entrou rede nova: rode o script e atualize esta tabela.
const ADAPTER_POMS: Record<string, {adapter: string; sdk: string | null; separateSdk?: string}> = {
    applovin: {adapter: "13.6.3.0", sdk: "com.applovin:applovin-sdk"},
    meta: {adapter: "6.22.0.0", sdk: "com.facebook.android:audience-network-sdk"},
    unity: {adapter: "4.19.0.0", sdk: null, separateSdk: "com.unity3d.ads:unity-ads"},
    liftoff: {adapter: "7.7.7.0", sdk: "com.vungle:vungle-ads"},
    mintegral: {adapter: "17.1.71.0", sdk: "com.mbridge.msdk.oversea:mbridge_android_sdk"},
    bidmachine: {adapter: "3.7.1.1", sdk: "io.bidmachine:ads"},
    moloco: {adapter: "4.11.0.0", sdk: "com.moloco.sdk:moloco-sdk"},
    bigo: {adapter: "5.10.1.0", sdk: "com.bigossp:bigo-ads"},
    pangle: {adapter: "8.2.0.4.0", sdk: "com.pangle.global:pag-sdk"},
};

const lines = (option: unknown, projectRoot?: string) =>
    androidMediationDependencies(resolveMediationNetworks(option), projectRoot).map((d: any) => `${d.artifact}:${d.version}`);

const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
afterEach(() => warnSpy.mockClear());

describe("catálogo × POM dos adapters", () => {
    test("toda rede do catálogo tem o POM conferido NA versão do catálogo", () => {
        expect(Object.keys(catalog).sort()).toEqual(Object.keys(ADAPTER_POMS).sort());
        for (const [key, network] of Object.entries(catalog)) {
            expect(`${key} ${network.android.version}`).toBe(`${key} ${ADAPTER_POMS[key].adapter}`);
        }
    });

    test("rede cujo POM não traz o SDK: SDK em extraArtifacts, na versão do adapter sem o patch", () => {
        for (const [key, pom] of Object.entries(ADAPTER_POMS)) {
            if (pom.sdk !== null) continue;
            const extras = catalog[key].android.extraArtifacts ?? [];
            const sdk = extras.find((extra: any) => extra.artifact === pom.separateSdk);
            expect(sdk, `${key}: o catálogo não acrescenta ${pom.separateSdk}`).toBeDefined();
            // CHANGELOG do adapter: 4.19.0.0 = "built and tested with Unity Ads SDK version 4.19.0"
            expect(sdk.version).toBe(catalog[key].android.version.split(".").slice(0, -1).join("."));
        }
        expect(catalog.unity.android.extraArtifacts).toEqual([expect.objectContaining({artifact: "com.unity3d.ads:unity-ads", version: "4.19.0"})]);
    });

    test("rede cujo POM já traz o SDK não repete o SDK no catálogo (uma fonte só da versão)", () => {
        for (const [key, pom] of Object.entries(ADAPTER_POMS)) {
            if (pom.sdk === null) continue;
            expect(catalog[key].android.extraArtifacts ?? []).toEqual([]);
        }
    });
});

describe("linhas do Gradle", () => {
    test("padrão (mediation omitido ou true): 4 adapters + o SDK da Unity logo depois do adapter dela", () => {
        const expected = [
            "com.google.ads.mediation:applovin:13.6.3.0",
            "com.google.ads.mediation:facebook:6.22.0.0",
            "com.google.ads.mediation:unity:4.19.0.0",
            "com.unity3d.ads:unity-ads:4.19.0",
            "com.google.ads.mediation:pangle:8.2.0.4.0",
        ];
        expect(lines(undefined)).toEqual(expected);
        expect(lines(true)).toEqual(expected);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    test("app que já declarava o SDK da Unity (expo-bobbie-goods): 1 linha só, sem aviso", () => {
        const bobbieGoods = {
            applovin: true,
            meta: true,
            unity: true,
            pangle: true,
            "unity-sdk": {android: {artifact: "com.unity3d.ads:unity-ads", version: "4.19.0"}},
        };
        const result = lines(bobbieGoods);
        expect(result.filter((line: string) => line.startsWith("com.unity3d.ads:unity-ads:"))).toEqual(["com.unity3d.ads:unity-ads:4.19.0"]);
        expect(result).toHaveLength(5);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    test("versão do SDK escolhida no app.json vence a do catálogo (e avisa)", () => {
        const result = lines({unity: true, "unity-sdk": {android: {artifact: "com.unity3d.ads:unity-ads", version: "4.20.1"}}});
        expect(result).toEqual(["com.google.ads.mediation:unity:4.19.0.0", "com.unity3d.ads:unity-ads:4.20.1"]);
        expect(String(warnSpy.mock.calls[0]?.[0])).toContain("usando 4.20.1 (do app.json)");
        // a ordem das chaves não muda quem vence
        expect(lines({"unity-sdk": {android: {artifact: "com.unity3d.ads:unity-ads", version: "4.20.1"}}, unity: true})).toEqual([
            "com.unity3d.ads:unity-ads:4.20.1",
            "com.google.ads.mediation:unity:4.19.0.0",
        ]);
    });

    test("app troca a versão do adapter da Unity: o SDK do catálogo acompanha", () => {
        expect(lines({unity: "4.20.1.0"})).toEqual(["com.google.ads.mediation:unity:4.20.1.0", "com.unity3d.ads:unity-ads:4.20.1"]);
        expect(lines({unity: {android: "4.20.0.1"}})).toEqual(["com.google.ads.mediation:unity:4.20.0.1", "com.unity3d.ads:unity-ads:4.20.0"]);
    });

    test("subset sem a Unity não leva o SDK dela; rede só com iOS não gera linha Android", () => {
        expect(lines(["applovin", "facebook"])).toEqual(["com.google.ads.mediation:applovin:13.6.3.0", "com.google.ads.mediation:facebook:6.22.0.0"]);
        expect(lines({minha_rede: {ios: {pod: "GoogleMobileAdsMediationX", version: "1.0.0"}}})).toEqual([]);
    });

    test("exclusão condicional do Pangle continua (expo-tiktok-ads-events no app)", () => {
        const root = mkdtempSync(join(tmpdir(), "expo-utils-mediation-"));
        try {
            mkdirSync(join(root, "node_modules", "expo-tiktok-ads-events"), {recursive: true});
            const pangle = androidMediationDependencies(resolveMediationNetworks(["pangle"]), root);
            expect(pangle).toEqual([
                expect.objectContaining({
                    artifact: "com.google.ads.mediation:pangle",
                    excludes: [expect.objectContaining({group: "com.pangle.global", module: "tiktok-business-android-sdk-comp"})],
                }),
            ]);
            expect(androidMediationDependencies(resolveMediationNetworks(["pangle"]), undefined)[0].excludes).toEqual([]);
        } finally {
            rmSync(root, {recursive: true, force: true});
        }
    });
});
