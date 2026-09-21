// AES-256-GCM (só DECRIPTAÇÃO) em TypeScript puro — sem dependência nativa.
//
// Existe para abrir o install referrer dos anúncios da Meta (ver install-referrer.ts), que vem
// cifrado com AES-256-GCM no formato da libsodium: `ciphertext || tag(16 bytes)`, nonce de 12
// bytes, sem dados associados. O runtime do React Native (Hermes) não tem WebCrypto e a lib não
// pode exigir um módulo nativo novo só para isso. Entrada pequena (~1 KB): desempenho irrelevante.
//
// AES: FIPS-197 (só o sentido de cifrar — é o que o modo CTR usa). GCM: NIST SP 800-38D.
// Validado nos testes contra o `crypto` do Node (tests/aes-gcm.test.ts).

const SBOX = new Uint8Array(256);
(() => {
    const rotl8 = (x: number, shift: number) => ((x << shift) | (x >> (8 - shift))) & 0xff;
    let p = 1;
    let q = 1;
    do {
        p = (p ^ (p << 1) ^ (p & 0x80 ? 0x11b : 0)) & 0xff; // p *= 3 em GF(2^8)
        q ^= q << 1; // q /= 3
        q ^= q << 2;
        q ^= q << 4;
        q &= 0xff;
        if (q & 0x80) q ^= 0x09;
        SBOX[p] = (q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 0x63) & 0xff;
    } while (p !== 1);
    SBOX[0] = 0x63;
})();

const xtime = (x: number) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;

// Expansão de chave do AES-256: 32 bytes → 15 chaves de rodada (240 bytes).
function expandKey(key: Uint8Array): Uint8Array {
    const w = new Uint8Array(240);
    w.set(key);
    let rcon = 1;
    for (let i = 32; i < 240; i += 4) {
        let t0 = w[i - 4], t1 = w[i - 3], t2 = w[i - 2], t3 = w[i - 1];
        if (i % 32 === 0) {
            const tmp = t0;
            t0 = SBOX[t1] ^ rcon;
            t1 = SBOX[t2];
            t2 = SBOX[t3];
            t3 = SBOX[tmp];
            rcon = xtime(rcon);
        } else if (i % 32 === 16) {
            t0 = SBOX[t0];
            t1 = SBOX[t1];
            t2 = SBOX[t2];
            t3 = SBOX[t3];
        }
        w[i] = w[i - 32] ^ t0;
        w[i + 1] = w[i - 31] ^ t1;
        w[i + 2] = w[i - 30] ^ t2;
        w[i + 3] = w[i - 29] ^ t3;
    }
    return w;
}

// Cifra UM bloco de 16 bytes (estado em ordem de coluna, como no FIPS-197).
function encryptBlock(roundKeys: Uint8Array, input: Uint8Array): Uint8Array {
    const s = new Uint8Array(16);
    for (let i = 0; i < 16; i++) s[i] = input[i] ^ roundKeys[i];
    const t = new Uint8Array(16);
    for (let round = 1; round <= 14; round++) {
        // SubBytes + ShiftRows
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) t[c * 4 + r] = SBOX[s[((c + r) % 4) * 4 + r]];
        }
        if (round < 14) {
            // MixColumns
            for (let c = 0; c < 4; c++) {
                const a0 = t[c * 4], a1 = t[c * 4 + 1], a2 = t[c * 4 + 2], a3 = t[c * 4 + 3];
                const all = a0 ^ a1 ^ a2 ^ a3;
                s[c * 4] = a0 ^ all ^ xtime(a0 ^ a1);
                s[c * 4 + 1] = a1 ^ all ^ xtime(a1 ^ a2);
                s[c * 4 + 2] = a2 ^ all ^ xtime(a2 ^ a3);
                s[c * 4 + 3] = a3 ^ all ^ xtime(a3 ^ a0);
            }
        } else {
            s.set(t);
        }
        for (let i = 0; i < 16; i++) s[i] ^= roundKeys[round * 16 + i];
    }
    return s;
}

// Multiplicação em GF(2^128) do GHASH (bit a bit, big-endian; R = 0xE1 || 0^120).
function ghashMultiply(x: Uint8Array, h: Uint8Array): Uint8Array {
    const z = new Uint8Array(16);
    const v = new Uint8Array(h);
    for (let i = 0; i < 128; i++) {
        if (x[i >> 3] & (0x80 >> (i & 7))) {
            for (let k = 0; k < 16; k++) z[k] ^= v[k];
        }
        const lsb = v[15] & 1;
        for (let k = 15; k > 0; k--) v[k] = ((v[k] >> 1) | ((v[k - 1] & 1) << 7)) & 0xff;
        v[0] >>= 1;
        if (lsb) v[0] ^= 0xe1;
    }
    return z;
}

function hexToBytes(hex: string): Uint8Array | null {
    const clean = String(hex ?? "").trim();
    if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) return null;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
}

// UTF-8 → string sem TextDecoder (não é garantido no Hermes). Nome de campanha tem acento.
function utf8Decode(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; ) {
        const b = bytes[i++];
        let code = b;
        if (b >= 0xf0) code = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else if (b >= 0xe0) code = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else if (b >= 0xc0) code = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        if (code > 0xffff) {
            code -= 0x10000;
            out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
        } else {
            out += String.fromCharCode(code);
        }
    }
    return out;
}

/**
 * Decripta `dataHex` (= ciphertext || tag de 16 bytes) com AES-256-GCM.
 * Devolve o texto em claro, ou `null` se a entrada for inválida ou se a TAG não conferir
 * (chave errada / dado adulterado) — nunca lança e nunca devolve lixo decriptado.
 */
export function aes256GcmDecrypt(keyHex: string, nonceHex: string, dataHex: string): string | null {
    try {
        const key = hexToBytes(keyHex);
        const nonce = hexToBytes(nonceHex);
        const data = hexToBytes(dataHex);
        if (!key || key.length !== 32 || !nonce || nonce.length !== 12 || !data || data.length < 16) return null;

        const cipher = data.subarray(0, data.length - 16);
        const tag = data.subarray(data.length - 16);
        const roundKeys = expandKey(key);
        const h = encryptBlock(roundKeys, new Uint8Array(16));

        // GHASH(H, A = "", C): blocos do ciphertext (com zero-padding) + bloco dos tamanhos em bits.
        let y: Uint8Array = new Uint8Array(16);
        for (let offset = 0; offset < cipher.length; offset += 16) {
            const block = new Uint8Array(16);
            block.set(cipher.subarray(offset, Math.min(offset + 16, cipher.length)));
            for (let k = 0; k < 16; k++) y[k] ^= block[k];
            y = ghashMultiply(y, h);
        }
        const lengths = new Uint8Array(16); // len(A)=0 nos 8 primeiros; len(C) em bits nos 8 últimos
        const bits = cipher.length * 8;
        lengths[12] = (bits >>> 24) & 0xff;
        lengths[13] = (bits >>> 16) & 0xff;
        lengths[14] = (bits >>> 8) & 0xff;
        lengths[15] = bits & 0xff;
        for (let k = 0; k < 16; k++) y[k] ^= lengths[k];
        y = ghashMultiply(y, h);

        // J0 = nonce || 00000001; tag esperada = E(K, J0) xor GHASH
        const counter = new Uint8Array(16);
        counter.set(nonce);
        counter[15] = 1;
        const tagMask = encryptBlock(roundKeys, counter);
        let diff = 0;
        for (let k = 0; k < 16; k++) diff |= (tagMask[k] ^ y[k]) ^ tag[k];
        if (diff !== 0) return null;

        // CTR a partir de inc32(J0)
        const plain = new Uint8Array(cipher.length);
        for (let offset = 0; offset < cipher.length; offset += 16) {
            for (let k = 15; k >= 12; k--) {
                counter[k] = (counter[k] + 1) & 0xff;
                if (counter[k] !== 0) break;
            }
            const stream = encryptBlock(roundKeys, counter);
            const end = Math.min(offset + 16, cipher.length);
            for (let k = offset; k < end; k++) plain[k] = cipher[k] ^ stream[k - offset];
        }
        return utf8Decode(plain);
    } catch {
        return null;
    }
}
