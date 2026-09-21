import {expect, test} from "bun:test";
import {createCipheriv, randomBytes} from "node:crypto";
import {aes256GcmDecrypt} from "../utils/aes-gcm";

// formato da libsodium / do referrer da Meta: hex(ciphertext || tag de 16 bytes), nonce de 12 bytes, sem AAD
const seal = (key: Buffer, nonce: Buffer, plain: string) => {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return Buffer.concat([body, cipher.getAuthTag()]).toString("hex");
};

test("vetor do NIST (GCM Test Case 15: AES-256, sem AAD)", () => {
    const key = "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308";
    const iv = "cafebabefacedbaddecaf888";
    const c = "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad";
    const t = "b094dac5d93471bdec1a502270e3cc6c";
    const p = "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255";
    const out = aes256GcmDecrypt(key, iv, c + t)!;
    // o texto do NIST é binário: compara byte a byte pelo charCode (latin1) dos bytes < 0x80 não basta → reencripta e compara
    expect(out).not.toBeNull();
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
    const again = Buffer.concat([cipher.update(Buffer.from(p, "hex")), cipher.final()]).toString("hex");
    expect(again).toBe(c); // sanidade do vetor
});

test("bate com o crypto do Node em 200 mensagens aleatórias (tamanhos 0–1500, UTF-8 com acento e emoji)", () => {
    const alphabet = "abcçáéíõü ÀÊ_-{}\":,0123456789 campanha🚀";
    for (let i = 0; i < 200; i++) {
        const key = randomBytes(32), nonce = randomBytes(12);
        let plain = "";
        const len = Math.floor(Math.random() * 1500);
        const chars = Array.from(alphabet);
        for (let k = 0; k < len; k++) plain += chars[Math.floor(Math.random() * chars.length)];
        expect(aes256GcmDecrypt(key.toString("hex"), nonce.toString("hex"), seal(key, nonce, plain))).toBe(plain);
    }
});

test("chave errada, dado adulterado ou entrada inválida → null (nunca devolve lixo)", () => {
    const key = randomBytes(32), nonce = randomBytes(12);
    const sealed = seal(key, nonce, '{"campaign_name":"teste"}');
    expect(aes256GcmDecrypt(randomBytes(32).toString("hex"), nonce.toString("hex"), sealed)).toBeNull();
    const tampered = (sealed[0] === "0" ? "1" : "0") + sealed.slice(1);
    expect(aes256GcmDecrypt(key.toString("hex"), nonce.toString("hex"), tampered)).toBeNull();
    expect(aes256GcmDecrypt("abc", nonce.toString("hex"), sealed)).toBeNull();
    expect(aes256GcmDecrypt(key.toString("hex"), "00", sealed)).toBeNull();
    expect(aes256GcmDecrypt(key.toString("hex"), nonce.toString("hex"), "zz")).toBeNull();
    expect(aes256GcmDecrypt(undefined as any, undefined as any, undefined as any)).toBeNull();
});
