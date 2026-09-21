import {expect, test} from "bun:test";
import {createCipheriv, randomBytes} from "node:crypto";
import {mapInstallReferrer} from "../utils/install-referrer";

// Monta o referrer como a Play devolve num install vindo de anúncio da Meta (formato da doc da Meta:
// utm_content = JSON {"source": {"data": hex(ciphertext||tag), "nonce": hex}, "a": app id, "t": ts}).
const KEY = randomBytes(32);
const metaReferrer = (payload: object, utmSource = "apps.facebook.com") => {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", KEY, nonce);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final(), cipher.getAuthTag()]);
    const content = JSON.stringify({source: {data: body.toString("hex"), nonce: nonce.toString("hex")}, a: "713855851155194", t: 1790000000});
    return `utm_source=${utmSource}&utm_campaign=fb4a&utm_content=${encodeURIComponent(content)}`;
};

const LEGACY = {
    ad_id: "6110809314024", adgroup_id: "6110809314024", adgroup_name: "Vídeo_Urna_15s",
    campaign_id: "6110808725024", campaign_name: "Lookalike_BR_18-44",
    campaign_group_id: "6110808710224", campaign_group_name: "Eleições 2026 — Instalações",
    account_id: "1234567890", ad_objective_name: "APP_INSTALLS",
    is_instagram: true, publisher_platform: "instagram", platform_position: "instagram_stories",
};

test("com a chave: Instagram x Facebook e campanha / conjunto / anúncio com os nomes reais", () => {
    const a = mapInstallReferrer(metaReferrer(LEGACY), {metaKey: KEY.toString("hex")})!;
    expect(a.meta).toBe("decrypted");
    expect(a.organic).toBe(false);
    expect(a.reserved).toEqual({
        $mediaSource: "Instagram Ads",
        $campaign: "Eleições 2026 — Instalações", // campaign_group = campanha (nomenclatura legada da Meta)
        $adGroup: "Lookalike_BR_18-44", //           campaign       = conjunto de anúncios
        $ad: "Vídeo_Urna_15s", //                     adgroup        = anúncio
    });
    expect(a.custom).toMatchObject({meta_ad_id: "6110809314024", meta_account_id: "1234567890", meta_objective: "APP_INSTALLS", meta_placement: "instagram:instagram_stories"});
    // o "fb4a" e o JSON cifrado NÃO podem vazar para campaign/creative
    expect(Object.values(a.reserved).join("|")).not.toContain("fb4a");
    expect(a.reserved.$creative).toBeUndefined();

    const fb = mapInstallReferrer(metaReferrer({...LEGACY, is_instagram: false, publisher_platform: "facebook"}), {metaKey: KEY.toString("hex")})!;
    expect(fb.reserved.$mediaSource).toBe("Facebook Ads");
});

test("payload novo (sem campaign_group): campaign = campanha, adgroup = conjunto, ad_id = anúncio", () => {
    const a = mapInstallReferrer(
        metaReferrer({ad_id: "6110809314024", campaign_id: "6110808710224", campaign_name: "Mobex_Conversiones", adgroup_id: "6110808725024", adgroup_name: "RTG_Storie_", is_instagram: true, publisher_platform: "instagram"}),
        {metaKey: KEY.toString("hex")},
    )!;
    expect(a.reserved).toEqual({$mediaSource: "Instagram Ads", $campaign: "Mobex_Conversiones", $adGroup: "RTG_Storie_", $ad: "6110809314024"});
});

test("sem chave: marca a rede (dica do utm_source) e guarda o dado cifrado para abrir depois", () => {
    const referrer = metaReferrer(LEGACY, "apps.instagram.com");
    const a = mapInstallReferrer(referrer)!;
    expect(a.meta).toBe("encrypted");
    expect(a.reserved).toEqual({$mediaSource: "Instagram Ads"});
    const data = JSON.parse(decodeURIComponent(referrer.split("utm_content=")[1])).source.data;
    const stored = Object.keys(a.custom).filter((k) => k.startsWith("meta_ref_data_")).sort().map((k) => a.custom[k]).join("");
    expect(stored).toBe(data); // remontável
    expect(Object.values(a.custom).every((v) => v.length <= 500)).toBe(true); // teto do RevenueCat
    expect(mapInstallReferrer(metaReferrer(LEGACY, "outra.coisa"))!.reserved.$mediaSource).toBe("Meta Ads");
});

test("chave errada: não inventa campanha, sinaliza decrypt_failed", () => {
    const a = mapInstallReferrer(metaReferrer(LEGACY), {metaKey: randomBytes(32).toString("hex")})!;
    expect(a.meta).toBe("decrypt_failed");
    expect(a.reserved).toEqual({$mediaSource: "Facebook Ads"});
});

test("referrer que não é da Meta segue o caminho normal (utm_content comum não é confundido)", () => {
    const a = mapInstallReferrer("utm_source=instagram&utm_medium=bio&utm_campaign=x&utm_content=story_azul")!;
    expect(a.meta).toBeUndefined();
    expect(a.reserved).toEqual({$mediaSource: "instagram", $campaign: "x", $creative: "story_azul"});
});
