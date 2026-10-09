import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {mergeRemoteConfigBlocks, parseSettingsValue, readRemoteConfigBlocks} from "../utils/settings";

// Valores como o Remote Config entrega: string JSON por parâmetro (getValue(...).asString()).
const reader = (values: Record<string, unknown>) => (key: string) => values[key];
const json = (value: unknown) => JSON.stringify(value);

describe("parseSettingsValue", () => {
    test("formato novo com os dois blocos", () => {
        const raw = json({utils: {is_ads_enabled: true}, screens: {cross_promo: {enabled: false}}});
        expect(parseSettingsValue(raw)).toEqual({utils: {is_ads_enabled: true}, screens: {cross_promo: {enabled: false}}});
    });

    test("um bloco só: o outro vira objeto vazio", () => {
        expect(parseSettingsValue(json({utils: {min_version: 2}}))).toEqual({utils: {min_version: 2}, screens: {}});
        expect(parseSettingsValue(json({screens: {apiUrl: "https://x"}}))).toEqual({utils: {}, screens: {apiUrl: "https://x"}});
    });

    test("o settings plano de antes de fevereiro de 2026 é ignorado", () => {
        // Formato que builds com a lib 1.0.x ainda leem (ex.: expo-urna no Android) pela condição sem versão.
        const antigo = json({is_ads_enabled: true, hotupdater_url: "https://x", review_mode: 1, ad_blocklist: []});
        expect(parseSettingsValue(antigo)).toBeNull();
    });

    test("bloco presente que não é objeto invalida o valor", () => {
        expect(parseSettingsValue(json({utils: [], screens: {}}))).toBeNull();
        expect(parseSettingsValue(json({utils: {}, screens: "x"}))).toBeNull();
        expect(parseSettingsValue(json({utils: null, screens: {}}))).toBeNull();
    });

    test("vazio, inválido ou fora de string volta null", () => {
        for (const raw of ["", "   ", "{}", "[]", "null", "true", "{utils:", undefined, null, 42, {utils: {}}]) {
            expect(parseSettingsValue(raw)).toBeNull();
        }
    });
});

describe("readRemoteConfigBlocks", () => {
    test("settings no formato novo vence e ignora os parâmetros antigos", () => {
        const blocks = readRemoteConfigBlocks(
            reader({
                settings: json({utils: {is_ads_enabled: false}, screens: {apiUrl: "novo"}}),
                utils: json({is_ads_enabled: true}),
                screens: json({apiUrl: "antigo"}),
            }),
        );
        expect(blocks).toEqual({utils: {is_ads_enabled: false}, screens: {apiUrl: "novo"}, source: "settings"});
    });

    test("settings com o default {} cai em utils + screens", () => {
        const blocks = readRemoteConfigBlocks(
            reader({settings: "{}", utils: json({is_ads_enabled: true}), screens: json({cross_promo: {enabled: true}})}),
        );
        expect(blocks).toEqual({utils: {is_ads_enabled: true}, screens: {cross_promo: {enabled: true}}, source: "legacy"});
    });

    test("settings plano antigo também cai em utils + screens", () => {
        const blocks = readRemoteConfigBlocks(
            reader({settings: json({is_ads_enabled: true, review_mode: 1}), utils: json({min_version: 3}), screens: "{}"}),
        );
        expect(blocks).toEqual({utils: {min_version: 3}, screens: {}, source: "legacy"});
    });

    test("parâmetro inválido vira objeto vazio sem derrubar o outro", () => {
        const blocks = readRemoteConfigBlocks(reader({utils: "{quebrado", screens: json({apiUrl: "x"})}));
        expect(blocks).toEqual({utils: {}, screens: {apiUrl: "x"}, source: "legacy"});
    });

    test("leitura que lança conta como parâmetro ausente", () => {
        const blocks = readRemoteConfigBlocks((key) => {
            if (key === "settings") throw new Error("getValue falhou");
            return key === "utils" ? json({is_ads_enabled: true}) : undefined;
        });
        expect(blocks).toEqual({utils: {is_ads_enabled: true}, screens: {}, source: "legacy"});
    });

    test("nada configurado: blocos vazios", () => {
        expect(readRemoteConfigBlocks(reader({}))).toEqual({utils: {}, screens: {}, source: "legacy"});
    });
});

describe("mergeRemoteConfigBlocks (global.remoteConfigs)", () => {
    test("junta os dois blocos e, na chave repetida, vale o utils", () => {
        const utils = {is_ads_enabled: true, is_api_local_enabled: false};
        const screens = {is_api_local_enabled: true, apiUrl: "https://x"};
        expect(mergeRemoteConfigBlocks(utils, screens)).toEqual({is_ads_enabled: true, is_api_local_enabled: false, apiUrl: "https://x"});
    });

    test("não altera os blocos e aceita bloco ausente", () => {
        const utils = {a: 1};
        const screens = {b: 2};
        const merged = mergeRemoteConfigBlocks(utils, screens);
        merged.c = 3;
        expect(utils).toEqual({a: 1});
        expect(screens).toEqual({b: 2});
        expect(mergeRemoteConfigBlocks(undefined, null)).toEqual({});
        expect(mergeRemoteConfigBlocks({a: 1}, undefined)).toEqual({a: 1});
    });
});

describe("RemoteConfigUtilsType (o pldev monta o formulário a partir dele)", () => {
    // O pldev lê o tipo com o parser do TypeScript; aqui só garante que campo novo não fique sem as tags.
    const source = readFileSync(join(import.meta.dir, "../utils/types.ts"), "utf8");
    const start = source.indexOf("export interface RemoteConfigUtilsType {");
    const end = source.indexOf("\n}", start);
    const body = source.slice(start, end);
    const fields = [...body.matchAll(/\/\*\*([\s\S]*?)\*\/\s*\n {4}(\w+)\??:/g)].map((m) => ({doc: m[1], name: m[2]}));
    const declared = [...body.matchAll(/^ {4}(\w+)\??:/gm)].map((m) => m[1]);

    test("todo campo tem comentário com @section e @label", () => {
        expect(fields.map((f) => f.name)).toEqual(declared);
        for (const field of fields) {
            expect({field: field.name, section: /@section \S/.test(field.doc)}).toEqual({field: field.name, section: true});
            expect({field: field.name, label: /@label \S/.test(field.doc)}).toEqual({field: field.name, label: true});
        }
    });

    test("@platform só aceita ios ou android", () => {
        for (const field of fields) {
            const platform = field.doc.match(/@platform (\S+)/)?.[1];
            if (platform) expect(["ios", "android"]).toContain(platform);
        }
    });
});
