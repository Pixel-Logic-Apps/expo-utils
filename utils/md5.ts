// Minimal MD5 implementation in TypeScript (no external deps).

const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const add32 = (a: number, b: number): number => (a + b) >>> 0;
const rol = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;

const toUtf8Bytes = (input: string): number[] => {
    const encoded = unescape(encodeURIComponent(input));
    const bytes = new Array(encoded.length);
    for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
    return bytes;
};

const toHexLe = (num: number): string => {
    let out = "";
    for (let i = 0; i < 4; i++) {
        const byte = (num >>> (i * 8)) & 0xff;
        out += (byte + 0x100).toString(16).slice(1);
    }
    return out;
};

export const md5 = (input: string): string => {
    const msg = toUtf8Bytes(input);
    const bitLen = msg.length * 8;
    const bitLenLow = bitLen >>> 0;
    const bitLenHigh = Math.floor(bitLen / 0x100000000) >>> 0;

    msg.push(0x80);
    while ((msg.length % 64) !== 56) msg.push(0);

    for (let i = 0; i < 4; i++) msg.push((bitLenLow >>> (8 * i)) & 0xff);
    for (let i = 0; i < 4; i++) msg.push((bitLenHigh >>> (8 * i)) & 0xff);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    for (let offset = 0; offset < msg.length; offset += 64) {
        const M = new Array<number>(16);
        for (let i = 0; i < 16; i++) {
            const j = offset + i * 4;
            M[i] = (msg[j]) | (msg[j + 1] << 8) | (msg[j + 2] << 16) | (msg[j + 3] << 24);
        }

        let A = a0;
        let B = b0;
        let C = c0;
        let D = d0;

        for (let i = 0; i < 64; i++) {
            let F = 0;
            let g = 0;

            if (i < 16) {
                F = (B & C) | (~B & D);
                g = i;
            } else if (i < 32) {
                F = (D & B) | (~D & C);
                g = (5 * i + 1) % 16;
            } else if (i < 48) {
                F = B ^ C ^ D;
                g = (3 * i + 5) % 16;
            } else {
                F = C ^ (B | ~D);
                g = (7 * i) % 16;
            }

            const temp = D;
            D = C;
            C = B;
            const sum = add32(add32(A, F), add32(K[i], M[g]));
            B = add32(B, rol(sum, S[i]));
            A = temp;
        }

        a0 = add32(a0, A);
        b0 = add32(b0, B);
        c0 = add32(c0, C);
        d0 = add32(d0, D);
    }

    return toHexLe(a0) + toHexLe(b0) + toHexLe(c0) + toHexLe(d0);
};
