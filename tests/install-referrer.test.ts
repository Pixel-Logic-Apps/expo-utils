import {expect, test} from "bun:test";
import {mapInstallReferrer, parseReferrer} from "../utils/install-referrer";

test("instalação sem link (busca na loja / sideload) = Organic", () => {
    const a = mapInstallReferrer("utm_source=google-play&utm_medium=organic")!;
    expect(a.organic).toBe(true);
    // NÃO grava $mediaSource: no RevenueCat a 1ª gravação vence, e "Organic" no boot bloquearia
    // o match do link-in-bio / Apple Search Ads que chega depois
    expect(a.reserved).toEqual({});
    expect(a.custom).toEqual({install_referrer: "utm_source=google-play&utm_medium=organic", install_medium: "organic"});
});

test("link próprio com utm_* preenche todos os campos de atribuição do RevenueCat", () => {
    const a = mapInstallReferrer("utm_source=instagram&utm_medium=bio&utm_campaign=eleicoes_2026&utm_term=resultado%20eleicao&utm_content=story_azul&utm_adgroup=publico_sp")!;
    expect(a.organic).toBe(false);
    expect(a.reserved).toEqual({
        $mediaSource: "instagram",
        $campaign: "eleicoes_2026",
        $adGroup: "publico_sp",
        $keyword: "resultado eleicao",
        $creative: "story_azul",
    });
    expect(a.custom.install_medium).toBe("bio");
});

test("Google Ads: só vem o id do clique — marca a fonte, guarda o gclid e NÃO inventa campanha", () => {
    const a = mapInstallReferrer("gclid=Cj0KCQjw-abc123&utm_source=(not%20set)&utm_medium=(not%20set)")!;
    expect(a.organic).toBe(false);
    expect(a.reserved).toEqual({$mediaSource: "Google Ads"});
    expect(a.custom.gclid).toBe("Cj0KCQjw-abc123");
    expect(mapInstallReferrer("gbraid=0AAAAA&utm_source=google&utm_medium=cpc&utm_campaign=app_br")!.reserved).toEqual({$mediaSource: "Google Ads", $campaign: "app_br"});
});

test("referrer duplamente codificado, vazio ou lixo não quebra", () => {
    expect(parseReferrer("utm_source%3Dtiktok%26utm_campaign%3Dx")).toEqual({});
    expect(mapInstallReferrer("")).toBeNull();
    expect(mapInstallReferrer(null)).toBeNull();
    expect(mapInstallReferrer("%%%=1&=x&semvalor")!.organic).toBe(true);
    expect(mapInstallReferrer("utm_source=" + "x".repeat(900))!.reserved.$mediaSource).toHaveLength(200);
});
