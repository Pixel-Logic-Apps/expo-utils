/**
 * Cantos do squircle como PNGs embutidos — superelipse sem dependência nenhuma.
 * GERADO por docs/squircle-gen.py — não edite à mão; as decisões estão documentadas lá.
 *
 * Forma: |x|^n + |y|^n = 1 com n = 3.4282, numa caixa de 1.6·r. Esse par dá a mesma
 * profundidade de corte de um `borderRadius: r` com a curvatura espalhada por 1.6·r de
 * aresta (a leitura de squircle da Apple/Figma).
 *
 * São 9 tamanhos (~1,4x entre si) para o componente nunca reamostrar mais que ~18%:
 * redução forte serrilha (bilinear sem mipmap), ampliação borra. Cobertura de área exata
 * (supersampling 8x + filtro box), então faixa sólida pode encostar no canto sem emenda.
 */

export interface SquircleAsset {
    /** lado do PNG em pixels */
    size: number;
    uri: string;
}

/** Quantas vezes o raio o canto ocupa de aresta. Casado com o expoente dos PNGs. */
export const SQUIRCLE_SMOOTH = 1.6;

/** Canto superior-esquerdo, opaco DENTRO da forma. Fundo de card e botões. */
export const SQUIRCLE_CORNERS: SquircleAsset[] = [
    {
        size: 24,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAQAAABKfvVzAAAAfUlEQVR42t3NoRWDMBhF4ZecyEoEMo4FMkIkG7AWO1R0GEZBMMBF" +
            "ICgcesoTNb2/zPtOArooqaioU1arRlJ+e+N8PU8WPnYcVya+tI8TIzfa5y9wwAgOqOCByQM9RlHSIKNA0qzHfRBVnPkG5IHOBdkF" +
            "rQsaF5gF+PEP/wBWAH1iRh6Yi4kAAAAASUVORK5CYII=",
    },
    {
        size: 34,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAACIAAAAiCAQAAACQTsNJAAAAzUlEQVR42u3VIRKCQBiG4XcZgoFAINAsGwgewBtQDAaDd/BIHsFj" +
            "GDyCwQMYjcbPoKI4jOD+64zBl0JYHvafHQYnevNM8IwpKSjIgJLR84L07cMzaqbkva9R15Vqqa0G10XMddBHvQK5Nvq4NlFpL9mQ" +
            "SkcF5ZojztlREVTS3K1DiccRz2XoOk7KHh+8j9s4CwtxR1aYcgLPwYYkwAzsSG1FnOA04GPv2Ym3EpAwATviYyDjGEgZAyl+Bsli" +
            "IBFyOrf/ZmGIfmScP/Il5AJ4knpblvNtPAAAAABJRU5ErkJggg==",
    },
    {
        size: 47,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAC8AAAAvCAQAAADZLlsnAAABE0lEQVR42u3XIW4CQRjF8f82IypGrEBsAmLFCOQ6EEgOQELv0StU" +
            "NOkReghEJcdAcoTKCkRFxYcgBLpQwtDvCZJ96zY7v7z9ZlZsYWQnkqgZUNGnpCTSA6Disf1ouBoNjJkwoqEmY9E1bWfMmRLzXxS7" +
            "fA3t3TZ2cy7RyRb2z/xFB3u1HzMNn2xlLjm3tVM+btrGM3k4ufPE0guHwtrNlxnfQiafWPk1bw8nsPDFf/MvNDjnMJzE2nPq7fZv" +
            "/vih/ZA1guzbPyPJrn3k0/vMHLefafA9PwfdcAJfyvZjFb7jJ6DkR1q+0fGFRTbK9gmUfK3lB1q+0vJ9LV/eNR+1fE/Lc8d8Yd+n" +
            "P1yevHWz7/iO980WZVdd6jLqtAUAAAAASUVORK5CYII=",
    },
    {
        size: 66,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAEIAAABCCAQAAABJXchjAAABdklEQVR42u3Wr27CUBzF8W9JxRVXVFSQUIFoAqICgSShggSLQOIR" +
            "Q+4h9gC4PcAEYhLJA0zuAfoAExMTk3diI4GkrH9o+7viHiQpfHIO9wbP0GAUERERIQEDfPoofKK/dzVh/mP+3V+smTBlREJMv95H" +
            "1EeELJgzI7m/wDqIIRuWzJpb0a+4+YotKQ2nPCJgx0Pd1QtiyryUeTSfprWUaSLlmZgW0ys8gHtO7RKKfhNjDk0cwXsQC17RdJDb" +
            "c6w5dkO4jVjz0sCVXjKeyR/i2B0hHzHmrashbs2hOXRLyEM8dXEo/58j5QSyCMV727dj8Rw7CcJ1EwEZgQSid9WDCOGyCUXW0l+W" +
            "Ck2spAiXiC1iOc8xJJNDnJvYgDxiKYn4nSPkQ76JBcgj5jYgZrIIz4DmS76JCcgjpjYgRjYgEhsQsTTCM4pv+SYicAh7EKENiMAG" +
            "xMAGhG8Dom8DQrk5bLoncAibEFoe4Rnj5nAIh3AIh3CISvkB9m2abijh8JcAAAAASUVORK5CYII=",
    },
    {
        size: 92,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAFwAAABcCAQAAABJ5hrTAAACDklEQVR42u3ar07DUBTH8W+XKyoqmmyioqLJJiaWzEwgmswuwcxh" +
            "liAQGOQS9hZIcAgkDzDJIyAQiIkJBA+AmCyGPxuw0dH29p5wjm6aT34792/nZVivkBYxISERPk0CDDEALYKPpyL8XS8xFqABXTp0" +
            "aJMQE+8G5a3q4DEDBvTpkVTx+vLhCSOGpG8/fmVlSnxTyphDOnYGSjnwAyYc0bI5wk3hGWLCKT37U1MReMSMY0JqKVMAfVrOxGYP" +
            "7jPlfG2pEAIfcVnNzLxfNfYcitfMXWDvl3jKjRvo/RI/484ddt7EDVec4FSZXLu7W0YgDR4wJ8W5ashk/wY33LrJ/g1+5V5v54Gf" +
            "uTaTrJeXbV9u7qycSEuGh9y7tNzkb5ULt9nbEh8xB3lwn0fX8/65Vabus39KPGJR9+nmb4nPJLC/Jx6xrPMI/PfEZzLYXxMPWdZ1" +
            "T1Is8YkU9tfEH+q4TCue+IEc9iZ8gqD6bBXDs92L4rISTyWx1+FjkNkqC1sfQcqFJyxlJd74ODogEz6UBn9vlaeqv0tWk3gsjf0O" +
            "H4DCrcL7UuE9eXAvg4AXmYl3QSa8o3DL8LZUeCIVHkuEexmspNxebSYeSmRDQ9YReR0eS4WHCrcMj6TCfanwplR4IBVu0Hnc3T9M" +
            "Kvxf71UCbRWFK9zNM+dK5jbLyzJtFYUrXOEKV7jCFa5whUuHvwJh2T5JgpPiggAAAABJRU5ErkJggg==",
    },
    {
        size: 129,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAIEAAACBCAQAAABNqRHbAAAC4ElEQVR42u3crW7bUBjG8X+iAwICCgIs1cBSBwwmNSCgUgPGajCp" +
            "BpMKRwoitdLgwG5h0ib1EgoKCwJyCb2AgICBwYGCgl1ARtqlaZI2H47jc97nwCiy45+f9/U5tpXaGG9GjCMBEiCigWP//+cAe+xN" +
            "fT9ZbrOuooebkBATs0+LiJjWi8MrcLgKHXRKygEpCe/K3PGuCdp0OKTN++2d5WoSNOnS5ZgOzd3Hr2yCIzJO6FSpB5X1UxpknPKR" +
            "VvU6rythDxln5FWI/C4IUs75XMUzXwaBI+eCDz7MuNxW6r7Hl2XnZuERNOjxlQiPhit0Wz2++XX4xRJk/CDFw+EKWsNdkePpqBew" +
            "jUtG/gJsnoKYaz8ufdtKQc7Qd4BNCBw/ud3dEnf3hRBx4//534QgpV/unZ2qFUKXu3AA1iHIGITQAdYn+ES/uiv/9UZtvFoC+pW9" +
            "7V4KQZdBaAlYjSDlLqwesGoviOiHCbAsgeMmpMvgOgTfQ5kJrtsLcm7BMkHMMNQusGwhXIcN8DbBZchdYJlCiBmFOBlaJQVX4QO8" +
            "noKMAVgmcAz9fC5QXCH0bAAsTkGD3/49Gis2BT0rAItSYCgDi1JgKAPzU+D45c8LEttJQW4JYD7BBabGbCGkjGwRzKbgHGynwPGn" +
            "6u8JbjsFmTWAWYIzsF0IDe4t3CF4LQWZPYCXBKdgvRDu7TXD6RQcWQSYJsjAOsGJTYJJL2jyEN4bJKuloGsTYJoA6wTHVgkmveCv" +
            "xZnh8xS0rQJMCDpgneBQBG27BE/t8CH012neSkFiF+CJIAURmCc4EIFSYOsx6vyL4th6CkxnQASPBLEIRPD4l3mmCVoiiESgXmC9" +
            "EGpj43NDqFsvA6hbfYz2nCARASJQCpSCuvW5IdRpiEAXRetLZbVDEWiNoHaoQhDBhGBPBCJQIYhABCIQgQgAqI3HSoEKQQQiEIEI" +
            "RCACEYhABCIQgQhEIAIRiEAEIpgZ/wB7uVMX86rgPQAAAABJRU5ErkJggg==",
    },
    {
        size: 181,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAALUAAAC1CAQAAACzWnYiAAADwElEQVR42u3doU/ccBjG8YelogLRhIomVFRUNIGEEydONAFBwkmS" +
            "IU6QjGQkiCFOLBkJErk/AIFAICYQCMQkfwICgUAgkBOTSCZ2amaDpc+1v35fJCEcn3t4+/bX37ULL+ptZYqVKJFUSIqUS5KWtChJ" +
            "s+/8rlzRHz+7qPS1vy7qAWimVLlSJVpWokSZYmWK3S8kNOpExexrWbkyFe15ad2njlWpVKUVlSpe/28N9d8q11ADrWhVVVdecreo" +
            "U9Uaak2jNqe329SFNrSuUXcS3D3qVJva0kabDm7hUQ+0rS2NQhqO2kdda0fvZ6cTgrqZGmkSJnKbqHPt6kO3D3rtp4401oHGPVgg" +
            "mOufmGhfn8KYLtpMXWiqj7M1NKgbq1LH2u1Dy5gvdU+Z3dSZTrTXT2YndawjffEvx/ePeqKv4Z6atIe61Kk2Reldw2/kZ90B3Xyq" +
            "K52HtTbX1lRPdQt086lOdaExuM1T1/rGvOFoIIe6Abr5VEc60x6ozVNnulQNafPUla5Cv47SDuqhrpXB2Tx1re/9Wuaf1wQCtIka" +
            "aBM10P9cCy//dzC8AdqR6krXQDuoM10x3jmoI11ywuKhPuMU3EN9yKKSZwKpddPf3RxO6lS3rEd7GsgF0B7qKdcMPQ2k0m2/N4O5" +
            "Uh3pHGgP9ZR9HZ4GUuqOTHtSfQq0h3rCJkdPA4n1wDTtSfUR0J5UZ3qkT3tSfQK0J9Wl7lnH86T6GGhPqsm0LdVk2pTqQg9Qe1I9" +
            "BdqT6kRPbKnxpHofaE+qIz305w408031GGgX9QE4ngaS65Hpw5PqXaBdqb5nn6kn1SOgXdQTYFwN5IkLXJ5U10C7qHdgcTUQ2ocp" +
            "1QOgXdTboLiot0Dx9OpUP0DxpJpNkDZq2oeNegMSD3XBlRcXNZm2Ua8D4qLmE1ymuZqZ2pZq7vBhox7C4aJeg8PVq3908eG+XUx1" +
            "DrSLmk5tox6A4aJeAcNFvQqGZwKJ9QyGJ9Xs0bNRl1CQ6uComT9oIOFRF1B4hr1EP6HwpJpMQw01BXX7qZeBcFHzOQEbNY/Ssc3V" +
            "L0B4Uk2moQ6Pmk0JNmrmD1IdHnUCg4uac0VSDTXFXN1+ap4kINcayDPYLmoWm0wNhE5to6Z52KgZ9aDmic/Um6kLEEh1cNTcEtxG" +
            "zTUYGgjU1Jupl0BwUfPwKBoI1BRrIFBTNBCooaagZrmJYhGVBgI1BTXUFNRQQ01xFUZd3l/N7moaCNQU1FBTUEMNNQU11BTUUENN" +
            "QQ01BTXUUFNQQ01BDTXUFNRQU6+oXwkabgcdR9TOAAAAAElFTkSuQmCC",
    },
    {
        size: 253,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAP0AAAD9CAQAAADdPLl3AAAFPElEQVR42u2dsYsUZxyGH8MUU2yx4IADDjhwW1yx4IIWCy64oOAW" +
            "B05x4IEHFhG0s7ki4B+QwB7E/v6ALSwsLK5IeUWKFBZXWFiksLCwsEiRwuLSrCKJEIk52dv3eaxEFH0f39/3zTc7s+dOkG9GTQk0" +
            "FEBFD4B2+Wvnlz+HHtUnv6ek/uyfVdB83V+m0Mf/RklNRY+Ggha4tBRbU/5N50qg+v9Cj5qGhpqKCzT0qZZdPkOo/ktolz8u0tLQ" +
            "fBzNZxrVfz6VTQYM2GBAy2Bd/5HyYaUeMmTIBptsZvz/zqZhxIjLDDN0q77PhKtcYbx6+27Vnw5DJlxjvK6rt+r/yYgp15nSV3iK" +
            "+pYZN7ip8hz1JRM6bjnYk9RXbHGbm+tx6KL6L5XecYepJxVJ6pUeqL5kxj1mlIpMUj/kPneTj2QS1Zfs8ICx8rLUD3jI916np6mf" +
            "8ogtN3NZ6gs6HjNSV5b6gl0eey6Xpl7tkerVHqq+48e8z82ofsyciWrS1NfM2VXLt+C7lfpv+AOvFJ/X+gkHru55re9zwJHi81q/" +
            "zc9f+9SonD31fQ7YVkPewJ9xrPg89SVPOHTQ5w38AU+9E5fY+h1eKD5PfcETFn5OPm/g1yyYGnue+hHP3dglDvyOI8Unqt/jmSt8" +
            "3sAv2OeRYeepL1h4Zpeovsdz9/SJ6nsc+mGrxG2e4kPVKz5UveJD1St+5Tl3cjqbx1/c1Se2vvAWTar6fQ9wMtXveWSbudZ3PDPU" +
            "RPUjjrw7l6i+5jfvxyeu9QULxWeq3/eCLnPg77AwzET1A164vUsc+CVPFZ+p/iefpMkc+DMOjTFRfZ9jL+kyB/6B4jPVb3uPLnPg" +
            "O+xjWz9XfGbrJxwZX6L6gmPfc5c58PcUn9n6mlce3Wa2fq74zNaP+dXgMls/N7ZM9Z0PVGUOfC/qYlu/q/jM1he89OvHMlu/q/jM" +
            "1tv52Nbb+dDW2/nY1neKT229X14Q2vqp4lPV+6aM0IE/4OUKf9O9nGLrHyo+s/Ulb+gbVWLrdxSfqv6BMWUO/CHHxpTZ+vuGlNn6" +
            "ktdUxpTY+pniU9XfM6LMgV/xmtKQElvfKT5V/R0Dyhz4FW88u89sfaf4VPWO+9CB77iPbf2W4lPV3zaczIFf8tY3Z2S2fqL4VPWd" +
            "0aSqv2U0mWt9y+9Gk9n6mcGkqr9hMKkD/50fv85s/UjxqeqnxpKq/rqxpK71rvShrR8qPlW9b8CNVX/NUFLVjw0lc5vX552hZLbe" +
            "lT5W/VUjSVV/xUhS1/q3PlSd2fpG8anqfRmq6iVN/WUDSVU/NJDMHX7JnwaS2Xo7r3pRvYSo3zCOVPV+W23oDr/gvXFktt7Ox6r3" +
            "CwxVL2nq3d/beklT3xpG6sXdiWFktt7Oq15UL6qX9VZ/0ShsvYSpb4wi9br+D9+Endn6nuJT1dcGkarelV714sCXEPU+VR+r/oJB" +
            "uNZLmHrfiutaL4Qd5L73+2szW18qPlW9V/Wx6l3pY9V71y5WvVf1serd5MWqb43BVyZKmPpLxmDrxbVebL14kCvreftGPMgVou7X" +
            "+yoVt3mSpd5NXqx6N3kOfElT7936WPXerXfgS5p6P5QZq96zPAe+qF5C1LeGYOtF9aJ6WWv15w3B63px4IvqRfXiWi/euRMHvqhe" +
            "VC+qF9WLj2CID16JA19UL6oX1YvqRfWielG9qF5UL75VQ/iXVyb6wkQHvqheVC+qF9WL6kX1onpRvaheVC+qF9WL6kX1onpRvahe" +
            "VC+qF9WL6kX1onpRvaheVC+qV72oXlQv689f4VWd08GK4ykAAAAASUVORK5CYII=",
    },
    {
        size: 354,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAWIAAAFiCAQAAABmVRrxAAAH5klEQVR42u3dP4icdR7H8U+OKbaYYiADDmTAAacYcMGFbLHFQhZc" +
            "cEAhC1osZCEWCxEUIlxxjXDCHdzBBSJYeJBiyxQWFluksEhhabFFiitSpLCwsLCwSGERmz3P4q6Q9Rg/O69X4x8E8Ttvv/ye55k/" +
            "V14EfmGSjSSDTM//enb+x2HGP/8z1zL4+c//80/+77/z3/4Nv6GBV21t0hxnmFFG55FdzfA80X9HN2v9jxPx5THLMONMMsw0w1zN" +
            "OMNMspHpZX+VRdyZ6yTjTDLNSxlnnFlGGa3vOET8+3+FpplllmmuZZpJppkYioh//3t2nllmefk8XkRcke0i88zzSuaZe01E3DL3" +
            "RRbZzKuZZ/Fb33ISMf/PjbuVRa5nkYXJi7jJZrayndeytc53EETcaJ6dbOd6tjI0DBE3GWYnu7meXVtXxKl7rLuXndzIllGIuDHe" +
            "G9nLwihE3Hds2M9+XheviBttZ5k3smNyIm7cvcu8maV3Loi40TQHuZldz9VEnMp7vYe5mW2DEHFrvm+7YSbi1sPDYW7JV8Stl26H" +
            "uZU9gxBxp/3czjsu3UTcenw4zu3eT/qy3hEPssydLP2PLOJO4xznjv0r4lZbeT9Hzr8ibnWQu+4/iLjVRo7yR+86E3GrUd7Nn7x1" +
            "R8S9AX+Yuz4sJGIBI2IBI+JfexH3Xv4sYBH3/hcd5S++hk/EvZb5Rza9rCJutcj9LL2k6+cPl+Yy7pM8kbBN3Os4f/vFb/sg4rR9" +
            "5+SD7HghHSdS+4GiezmTsE2c4jsRn3lHML2beJSTPJIwvZv4rXzmcQa9m3iUk5xKmN5NvJcThwh6N/Egf8+XEqZ3E8/z0Ff70byJ" +
            "D3MmYXoj3sg/89APadF7nJjlC99RSfMmXuZMwjRH/FFOfciI3uPEMA9y6AWiN+JpTh0jaD5ObOdrCdMc8UEe+8opmiP+IJ+7J0xz" +
            "xPfyqW9up/fCbpCTHHlJ6N3EwzyUMM2beJhH2fVy0LuJJUx5xJN8JWGajxOTPPZLGjRvYglzYVderPYs/JXHyzRv4mEeSZjmiN2R" +
            "oDziQU4kTHfEJ3nH8GmO+J4HzKT67sQH+dTgaY74IJ97syXNEW/nsbe80xzxNF/74BHNF3bDnEqY7ogfeD5Hd8Qf+SoUus/Ey5y6" +
            "J0FzxLOc+U41mo8TG/lCwnRH/IkLOrqPE4d5aMw0RzzPmSd0NB8nBn5rg/aI/+oXj+g+TuzlS/eGaY54lDO//kn3ceK+hOnexG/l" +
            "1HBpjniUJ5kaLs3HifsSpnsTL/PIYGmOeJgnLunoPk58LGG6N/FmzjzgoHsTP5Aw3REfZ8dIaT5OjPI0YyOleRN/LGG6N/EiT5yH" +
            "6d7E9yVMd8TLLA2T5uPEIGfZNEyaN/GRhOnexBt56l1rdG/i9yRM9yYe5ZkvqaJ7E38oYbo3sT1M/Sa2hynfxPYw9ZvYHqZ8E9vD" +
            "1G/idyVM9ybeyDO/Skf3Jj6SMO2b+F9ZGB/Nm/hAwrRHfNfo6D5ObOXM6OjexO8bHN2beJxvsmF0NG/iYwnTvYkHeep7L+nexEsJ" +
            "0x7xHUOj+zgxzTPf9EP3Jj6WMO2b+JkTMd2beF/CtEd828DoPk4M853HHHRv4kMJ0x7xLeOi+zgxzTfGRfcmPjQs2iN2mKD8ODHP" +
            "U8OiexM7TFAf8dtGRfdxwmGC+k3sMEF9xDcNiu7jhMcc1G/iA2OiPWKHCcqPE96ASf0mXkqY9ojfNCTajxPf+kZ4ujfxtoRpj3hp" +
            "RLRH/IYR0X0mHuZ73/hD9ybelzD9EUN5xK8bEN1n4km+NSC6N/Ge8dAe8Q3jwSaGlZ6JnYip38T2MPUR7xgO7RG7rKP8TDzMD4ZD" +
            "9yZ2mKA+4l2joT3i60ZD+5n4+4wMh+ZNPJcw7RG7rKM+4m2DoT1il3XUX9j9kKHR0LyJNyVMe8RbxkJ7xC7rqI/4NWOh/cLO0zrK" +
            "N/FMwrRH7LKO+ogXhkJ7xJ7WYRNDVnp3YpDnvs6V7k28kDD9EUN5xJtGQnvErxoJ7RHPjYSU35147pec6d7EMwnTHrF7E9RH7ESM" +
            "iGHVEb9iINjEkNXeYvvROyfo3sQzCdMescMEl2ATg4hhtRG/bBzYxCBiyAXuEw/yo3HQvYmnhkF7xA4TiBgcJ+CCEV8zDGxiWHHE" +
            "E8PAJoas9mHHC8OgexPPjIL2iJ2IqY94bBTYxLDiiN2boD7il4wCZ2IQMbhPzJpH7EfJSftjZw+dKd/EDhPURzw0CNojdm+C+og9" +
            "dMZxAlYdsXdOYBPDqiO+ahC4OwGOE+AWG2se8YZBkPI3APkRRuoj9h42yo8TTsTUR+xETH3E7hJTH7G7xNRH7PN1iBhWHbF7xNRH" +
            "7N3EXJrfdobaiL2bGLfYwHECLhjxzBiwicF9YnCfGMcJEDFklR9P8uEkbGIQMVwoYh8TpT5iHxPFcQJWHbHnddRH7HkdjhMgYhAx" +
            "6x7xzBCwiUHEIGLWPGIf2Kc+Yt9OjOMEiBhEjIihPOJrhoD3E4PjBIgYEYOIwYUd+KAojhMgYhAxiBgRg4hBxOBhBx52gOMEiBhE" +
            "jIhBxCBiEDEiBhGDiEHEiBhEDCKGX+fKi+fZMAa6I35hCDhOgIhBxIgYRAwiBhEjYhAxiBhEjIhBxCBiEDEiBhGDiEHEiBhEDCIG" +
            "ESNiEDGIGESMiEHEIGIQMSIGEYOIQcSIGEQMIgYRs0Z+AjML4XUwlHzYAAAAAElFTkSuQmCC",
    },
];

/** O negativo: opaco FORA. Sobreposto em conteúdo que não dá para recortar (a WebView). */
export const SQUIRCLE_CORNERS_INVERSE: SquircleAsset[] = [
    {
        size: 24,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAQAAABKfvVzAAAAhUlEQVR42t3NsQ3CMBRF0evUNGySYSgYImsxQcqs4AXSuUyRks5I" +
            "jwJFhKCI/wqavF/6HjlJfO9BJjNSmJiBsnrTdr2uOom9+wSD2v10C6q6X/EaVF0i+Rt0sXwBQzRfQOuBPp6LBrhhLKly5h4HDdnJ" +
            "XwAPjC4oLphcMLvAXBJ//uEI4Al7jPa+QsZgdQAAAABJRU5ErkJggg==",
    },
    {
        size: 34,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAACIAAAAiCAQAAACQTsNJAAAAy0lEQVR42u3VMQ6CMBiG4Rfi4OrmARw8hMfgji4mTCQcwQOQMAgJ" +
            "IwMJDgwmDJ+DMUJEgbYmDH7/2j7tn7apJzGWjIScgpKKigYouXUHrL5Ojog5cx1dRkNpddRBTK0hJNRuOjCE1ArmAe9Iqv18oo+k" +
            "2poQXaQ220UfCUyJFxKaE0+knXuo/fIBOJFhE0maczs/tXOxIx7tRFjGB2JbxJPYTHjsIzvJbAnwScAeyV0ghQukdIFUi0EaF4iD" +
            "eFr3fzMzhIW080d+hNwByEvTxizO8QMAAAAASUVORK5CYII=",
    },
    {
        size: 47,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAC8AAAAvCAQAAADZLlsnAAABDklEQVR42u3XsWrCUBjF8X8kQ4c6dPQR3Np3qe/gKxS6+Ag+RxHc" +
            "7SpkzKZghgwZKjgEvINg4OsgkkZJGpPvGwI5WcOPw+He4XoiPBpHREzCnoSUFMcBgB9Ot7/6tdGMgDUBIXH9Jn6ttksWfON4PFKd" +
            "jUzlWWj6VfE7eW8OV/Nn+RS/LV7G7+S1PV3Gr9qs/R//pTFKGb/SxAWvcGsj3hqd7tIMCvdyoosX+RkhysnHiRiTafN5+w99PG+/" +
            "ZYxBru3nmOTS3jHSPjN/2y9t8Cu/ALtxMl4s2wdW+IVfgyUf2PKhHe/JkaFl+wgs+diWT2z5fafbp53mnS1/sOXpMO/J0/2DS5On" +
            "377ne143vx5j2iqSJj2BAAAAAElFTkSuQmCC",
    },
    {
        size: 66,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAEIAAABCCAQAAABJXchjAAABc0lEQVR42u3WsUrDUBTG8X9KF0HBRXAtOOrorqMP4Fv4Au6Org4+" +
            "QHFwcSwY0ELXQoeAGTJ0yNChxYCBZggcB1toIbZpmtxzh3syhpv8+L7AiSdCfZMRExMzIyEmZ0JGTry4mzItPtbe+8UpI4aEBERM" +
            "qj2iOmKKT58Bwf4BVkGM6dJjUGONssvM5UWuhLqv8ohveZDT+gHlEXN5lONmAGURH3LWHKAM4kfumgVsR3zJefOEzYh3OTRB2IR4" +
            "lbYZwv8IgwTBK1xgPjfkGJsiRMglKQanVbAVb80SihD3dezF/er45Bp0ERkXROYR63U8aRDWk0jokGggWms5qBBWk8joVP1RrS+J" +
            "Ny3CKuIZtVnWMaajh1gm0QV9RE8T8VfHlBP9JHzQR/RtQAx0EZ4IKUf6SYxAHzG0ARHagAhsQETaCE/mHOgnEYND2IOY2YBIXB0L" +
            "RG4DYmIDInN12PRh4hA2IVJ9hCeuDodwCIdwCIfYbX4BoDFCqKwmuDEAAAAASUVORK5CYII=",
    },
    {
        size: 92,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAFwAAABcCAQAAABJ5hrTAAACDklEQVR42u3aLU/DUBTG8X+XCRB8AARiAoFA8BGQ+wBIBHKSb8EE" +
            "kgSBwCzBkiBmSSoQkCAmECOpqBjJREVFRZNieBnvHW1v75Oco5vml2fnnvbeLigKXFfCnJiEhCcy5qTkxADMSd+umpH9dpOuA2jK" +
            "A1MemRIRE/8OKlvNwWNuueOeCVETt68fHjHmmvDlx2+s6oPnhFxyxdTNQqkHfsOIC+YuV3i38oQYccrE+WSqBJ8x5JyEVqpbAX1a" +
            "z2BzB8845mjhUSECHzNoZjIvV50ll+IBfR/YyyUesu8HernET9j1h1028ZwBZ3hV3VJvd3uMQQ2e0ifEu+posv+C5+z5yf4LPvCv" +
            "t8vAT3ybJIsV/LhZDtkl14Mn7Pj0uCnfKod+s39KfEwf9OAZW77n/X2rHPvP/i7xGZtt727+l/hQgf018Rm9NrfA/098qMH+nHhC" +
            "r61zkmqJj1TYnxPfbuMwrXriNzrsj/ARQvXeKjnrbg+K60o8VGIvwi9Bs1U2XX0EqRce0dNKvPO2dUATfq0Gf22Vjaa/SzaTeKzG" +
            "foXfgib8ThV+rwqf6MGDoiBlTTPxB9CET1Xhj5a4Y3ikCo8V4UFRsKpyevUx8USRDR2tLfIiPFaFJwZ3DH9ShWeqcNmpkqrCc2yO" +
            "+/uHSYPbVLFWMbjB/dtzrmi+ZgWFtYrBDW5wgxvc4AY3uMHl4c+WT6IUvbbOEQAAAABJRU5ErkJggg==",
    },
    {
        size: 129,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAIEAAACBCAQAAABNqRHbAAAC4ElEQVR42u3ar24iURTH8S8Eu6KiYuWKFQgeoI+AQFRW9BEqKvYN" +
            "Vqxcg0A0WdtkxTSpmLoVNKlA0GTFNEGMmCY0QSAQiElYUxYo0PJngLn3/I4kBDKf+Z0zd+ZOYTTClUpIiYEYeGFISvL/c4A+/Znv" +
            "x6v9bCmnhxsTk/BMQo8uCb03h5dhlXJ00BFPdIiI6ezzjw9N0KbFI23+7u4s55NgQJN7mrQYHD5++yZ44I6Q1usAy0Xti2BIyA23" +
            "9PI3eXdPkBJyTZCHyB+CIOKKX3k88/sgSAmo88eFFVdpJ33f4OeqazP/CIY0+EEXh6qUafgbfHfr8LMlCLkkwsEqZXQPd0GAo1XM" +
            "4DfqlN0F2D4FCeduXPp2lYKAiusA2xCkXHJ6uFvcwzdClzP3z/82BBG1/T7ZyVsjNDnxB2ATgpCqDxNgc4Lf1PJ7579ZFdbaRwip" +
            "5emR1/4JmlR9S8B6BBEnfs2AdWdBl5qfAKsSpJz5dBnchOCbLyvBTWdBwClYJkio+DoFVm2Ec78BPiao+zwFVmmEhLKPi6F1UnDh" +
            "P8D7KQipgmWClIqb+wLZNULDBsDyFAz54t7WWLYpaFgBWJYCQxlYlgJDGVicgpSv7rwgsZsUBJYAFhPUMVXzjRBRtkUwn4IrsJ2C" +
            "lM95f09w1ykIrQHME1yD7UYYcmzhCcF7KQjtAbwluAHrjXBsbxjOpuDBIsAswR1YJwhtEkxmwYAj/94gWS8FTZsA0wT3YJ2gaZVg" +
            "Mgs+WVwZTqegbRVgQtAC6wSPImjbJRiPwyPfX6f5KAWxXYAxQQTWCZ5E0BGBGsHWNurii2LBegpMZ0AErwSJCJ5FoBTY3ECZJeiK" +
            "QI1gvREKo5HttSEUrbcBFK1uo00TxCJABEqBUlDkRQRDEeiiqKWRxqEI1Agah2oEEYwJ+iIQgRpBBCIQgQhEAEBhpBQoBSIQgQhE" +
            "IAIRiEAEIhCBCEQgAhGIQAQiEMF8/QOdDdjN8+1fLQAAAABJRU5ErkJggg==",
    },
    {
        size: 181,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAALUAAAC1CAQAAACzWnYiAAADy0lEQVR42u3doU/ccBjG8YdlBjmBRCAQCAR/AnICgUBMIBAI/oBJ" +
            "JMkQE5cMQTISxEggGQJ3JAhITpw4kiM5cSQVJSlJRUkqEBVNmBgzQ2yw9aH99ftaQrh88vDe21/fu048PKitlapQrlxSLKnUrSQp" +
            "070kPf7kZyUqf/vde2XP/XNvWwCaKlOiO+VKlCtXqkKpCvcLCY06V6xYN4qVKFGquD4vrfnUhcaKdK2RIsXP/7eG+k+VaKArjTTS" +
            "uCkvuVnUmXq61FD9Oqe32dSxznWhfnMS3DzqTGc61Xmd3tzCox7qRF31QxqO6kfd07G+KwlvwK8TdV9HYSLXiTrRgfab/aZXf+pS" +
            "Xe2q++SMAer/fBG9py9hTBd1po7V0dfHMzSoK6tIW/rWhpbxutQtZXZTp9rUfjuZndSFtvXJfxzfPupDfQz30qQ+1JE2dCZKbyq+" +
            "QPmseaCrT/VYa2GdzdU11R0tAF19qjOtqgtu9dQ9fWDecDSQHS0CXX2qS61rH9TqqVOtqAdp9dRjLYd+H6Ue1AMtKYWzeuqe3rfr" +
            "mP+1JhCgTdRAm6iB/uua+KcPaAy0CLQj1WMtAe2gTrXMeOegLrXCBYuHep1LcA/1DodKngmkp8X2bnM4qTMtcB7taSCrQHuoO9wz" +
            "9DSQsRbavQzmSnWpNaA91B32OjwNJNI8mfakegNoD/UhS46eBlJolmnak+ptoD2pTjVDn/akehNoT6ojzXGO50n1FtCeVJNpW6rJ" +
            "tCnVsWah9qS6A7Qn1bmmWanxpHoPaE+qS8225xtoXjfVXaBd1LvgeBpIohmmD0+qD4B2pXqOPVNPqvtAu6iPgHE1kGlucHlS3QPa" +
            "RX0Mi6uB0D5MqR4C7aI+AcVFzaq6qVdnmgLFk2qWIG3Up5C4qM8h8VDH3HlxUZNpG/UFIC5qPsFlmquZqW2p5hs+bNSXcLioh3C4" +
            "evVUEx/u28RUJ0C7qAdguKivwHBRj8CAOrAJpNAkGJ5Us6Nno46gcFFfQ+Gi5k2RBhIedQyFZ9jL9Q4KT6rJNNThUd8AQaqDo2Z5" +
            "HerwqHmUjm2ungDCk2oyDXV41Cwl2KiZP2zUdzC4qHMYaCCkmoKauZr6Rc2TBOQ6A5kE20XNYZOpgdCpbdQ0Dxs1ox7UPPGZejF1" +
            "DAKpDo6arwS3Ud+CQAOBmnopNffLbdQ8PIoGAjXFGQjUFA0EaqgpqBtEzcYeh6g0EApqqCmooYaagpq7MJSe7FdjQAOBmoIaagpq" +
            "qKGmoIaaghpqqCmooaaghhpqCmqoKaihhpqCGmrqGfUDUtcq2MrQ5VoAAAAASUVORK5CYII=",
    },
    {
        size: 253,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAP0AAAD9CAQAAADdPLl3AAAFPklEQVR42u2dPWtUaRiGryxrscUWFhYWFhYWFiksttgi5RYpLCws" +
            "5gfkBwR2Cn+AxRaBtQyshTBFhBQnkGIKhRFGmEJhhBFSHOEETnGEU0wxxSkOuE10l10Ld/0gmfu6wEJEMc/F/Tzved/zsfHuHfKt" +
            "aOiAmh5oWQFwevZn738PK9q//Z2O5qP/Vk/9ef+Z7/XxxehoaFlR03MKVGe/Grp/6DwXqP7/sKKhpuYtLQ01S9qzLF8gVP8pVFRU" +
            "nFJTUVN/aM0XGtV/fI6eUPKGkpKKcj1/SNX/NakXLHhNyQknCT9wuvqaOa+Ys8jQrfolU17ygtn5W3er/uuwYMpzZus6vVX/b+Y8" +
            "Y8KEpcJT1FeMecoTleeo75hyxNjGnqS+5ZgjnqzHpovqP1V6wWMmF207VfVKV/1/nOljHjGmU2SS+gUPGSVvySSq7zhgn5nystSX" +
            "7POH1+lp6ic84NjFXJb6noL7zNWVpb5nxH335dLUqz1SvdpD1Rfcy7tvRvUzhkxVk6a+YchILd+C787VdP+NG4rPS/2UHad7XuqX" +
            "7LCl+LzUH7L7uU+NysVTv2SHQzXkNfwxm4rPU9+xy7aNPq/hl9z1JC4x9QfcUnye+p5dBt4nn9fwGwZMLHue+jm3XdglNvyCLcUn" +
            "qt/jjhM+T33PLr9a7LxZ3zNwzy5R/YrbrukT1a/Y9marxFmv+FD1ig9Vr/hQ9Yo/92x8lU8h9Pziqj4x9b1HNKnqh27gZKrf43fL" +
            "mjjrC+5Y1ET1c7Y8nUtU3/CT5/GJs75noPhM9UMv6DIb/gEDi5movuSWy7vEht9xV/GZ6u/5JE1mwx+zbRkT1S/Z9JIus+HvKD5T" +
            "/aFndJkN32Yfm/qh4jNTP2XL8iWq79n0PXeZDX9P8Zmpb7jh1m1m6oeKz0z9jJ8tXGbqh5YtU33hA1WZDd+LutjUjxSfmfqem35+" +
            "LDP1I8Vnpt7Mx6bezIem3szHpr5QfGrq/XhBaOonik9V/8BSZTb8kpv0Fisx9fuKz0x9x1WWliox9QeKT1W/b5kyG/6CTcuUmfqH" +
            "Fikz9R3XaC1TYurHik9V/8gSZTb8lmt0Fikx9YXiU9U/tkCZDb/lqnv3makvFJ+q3nYf2vBt97GpP1Z8qvoji5PZ8Duu+OaMzNRP" +
            "FZ+q3nYfq35saTJnfcV1S5OZejMfq/6phUlt+Je9/Toz9XPFp6p/ZllS1U8sS+qsd9KHpn6h+FT1vgE3Vv1zi5KqfmZRMpd5Sy5b" +
            "lMzUO+lj1b+0JKnqX1iS1Fl/xYeqM1NfKz5VvS9DjVX/yoKYeglTv7AgmSv8jh8sSGbqzbzqJU39a8uRqt7PGsWq92u1oSv8nkuW" +
            "IzP1Zj5WvZM+Vv0bi2HqRfWSob6yGKkXdxsWIzP1Zl71onoJUX9qKVLV15bChi+mXjKu63/0TdiZqV8pPlV9YyFS1TvpVS9p6t9a" +
            "iFT1PlXvMk+c9RKi3rfiOuuFsI3cS36/NjP1neJT1bu+j1XvpI9V76ldrHqv6mPVu8iLVe/duL4yUdLUV5bB1IupF1MvbuTKeh7f" +
            "iBu5QtR5va9ScZknWepd5MWqd5Fnw5c09Z7Wx6r3tN6GL2nqvSkzVr17eTZ8Ub2EqPemTFMvqhfVi9f14nW92PBF9aJ6cdaLK3yx" +
            "4YvqRfWielG9+AiG+OCV2PBF9aJ6Ub2oXlQvqhfVi+pF9eJbNch+ZaI1sOGL6kX1onpRvaheVC+qF9WL6kX1onpRvaheVC+qF9WL" +
            "6kX1onpRvaheVC+qF9WL6kX1onrVi+pF9bL+/Akl+aPn5ql+UwAAAABJRU5ErkJggg==",
    },
    {
        size: 354,
        uri:
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAAWIAAAFiCAQAAABmVRrxAAAH5ElEQVR42u3dP4icdR7H8U+OE87CwuIKC4sUKa5IsYWlRQqLFFtY" +
            "WKTcIkXAZosUFoIWwjUHlyJwAQMXWGEDKVZQGCHCChFW2MAWK4wwwgizMMUIU0wxxcBek1MO7jiO9Zh8dl6vxj8ExO+8+fJ7nmf+" +
            "XDk/D/xqmmWSVSYv/nn84q+L/PzLn5lk9cvf//on//O/+Xf/hd/Q771qG5PmLIvMM88qZ0lmWbxI9J/RjVv/50R8eYyzyCzTLHKW" +
            "RWaZZZFplv+yNy8lEXfmOs0s05xlmllmGWee+eaOQ8Qvu1UmGWecs0wyyTSTTA1FxC//nh1lnJ8yzjjj/3KRhIhfmmyHGeXHjDLK" +
            "6LKfYEV8eQ4JwwzzfU4zyvC3vuUkYv6fG/ckP+Q4wwztWxE3Oc1JnuckJ5t8B0HEjUY5yvMc5yQLwxBxk0WO8m2O88zWFXHqHuse" +
            "5rsc5sQoRNwY7zc5zNAoRNx3bHiar/NUvCJudJyvMsiRW2Qibty9g3yZgXcuiLjRJJ/nIM88VxNxKu/1Ps5Bjg1CxK35PnHDTMSt" +
            "h4fH2ZOviFsv3fbzWQ4NQsSdnuZRnrh0E3Hr8eFh/t77SV82O+JVBnmQgccWIu40y8P8zf4VcauT3M+e86+IWx3knvsPIm61zF7+" +
            "4l1nIm41z6P82Vt3RNwb8L381YeFRCxgRCxgRPy/XsQ9yEcCFnFqn8Pt5UNfwyfiXoPczamXVcSthtnNwEu6eX53aS7jdnNdwjZx" +
            "r0/zQWZeTBGn9jsnb+fIC+k4kdoPFN3NloRt4hTfibjjHcH0buJ5dnJTwvRu4i9yx+MMejfxPDvZljC9m/gwOw4R9G7iVT7IOxKm" +
            "dxOPcstX+9G8ifezJWF6I17mTm75IS16jxPjvOs7KmnexINsSZjmiD/Jtg8Z0XucWOR29r1A9EY8ybZjBM3HieO8JWGaIz7IDV85" +
            "RXPE9/Oee8I0R3w37/vmdnov7FbZyZ6XhN5NvMgtCdO8iRe5mWdeDno3sYQpj3iatyVM83Fimht+SYPmTSxhLuzK+flaz8Jve7xM" +
            "8yZe5KaEaY7YHQnKI15lR8J0R7yTJ4ZPc8R3PWAm1Xcn7ud9g6c54oO8582WNEd8nBve8k5zxJO85YNHNF/YLbItYbojvu35HN0R" +
            "f+KrUOg+Ew+y7Z4EzRGPs+U71Wg+TizzroTpjnjXBR3dx4n93DJmmiMeZcsTOpqPEyu/tUF7xB/6xSO6jxOHece9YZojnmfLr3/S" +
            "fZzYlTDdm/iLbBsuzRHPcz0Tw6X5OLErYbo38SA3DZbmiBe57pKO7uPExxKmexOfZssDDro38W0J0x3xpzkyUpqPE/Ncy8xIad7E" +
            "H0uY7k08zHXnYbo38a6E6Y54kIFh0nycWGUrp4ZJ8ybekzDdm3iZa961RvcmfiBhujfxPFd9SRXdm/iehOnexPYw9ZvYHqZ8E9vD" +
            "1G9ie5jyTWwPU7+JH0mY7k28zFW/Skf3Jt6TMO2b+E8ZGh/Nm/hAwrRHfM/o6D5OnGTL6OjexPcNju5NPMubWRodzZv4oYTp3sSr" +
            "XPO9l3Rv4oGEaY/4gaHRfZyY5Kpv+qF7Ez+UMO2b+KoTMd2b+KmEaY/4kYHRfZxY5I8ec9C9ifclTHvEnxkX3ceJSd40Lro38WPD" +
            "oj3iPcOi+zgxyjXDonsTO0xQH/ETo6L7OOEwQf0mdpigPuIDg6L7OOExB/Wb+HNjoj1ihwnKjxPegEn9Jh5ImPaIvzQk2o8Tb/hG" +
            "eLo38bGEaY/4KyOiPeKBEdF9Jl7kdd/4Q/cmfiph2iP+2oDo38RQfSae5g0DonsTHxoP7RF/YzzYxLDWM7ETMfWb2B6mPuLvDAeb" +
            "GNZ6Jl7kNcOhexMfGQ3tEX9rNLRHfGw0tJ+JX8/ccGjexCMJ0x6xyzrqI35uMLRH7LKO+gu717IwGpo38amEaY/4xFhoj9hlHTYx" +
            "rPvCztM6yjfxWMK0R+wwQX3EPxgK7RF7Wkd9xENDIdV3J1Z51de50r2JhxKmP2Ioj/h7I6E94lMjoT3ikZGQ8rsTr/olZ7o38VjC" +
            "tEfs3gT1ETsRUx/xjwaCTQwihlzoFtsr3jlB9yYeS5j2iB0muASbGMoj/sk4sIlBxCBissn3iVd5xTjo3sQTw6A9YocJRAzrjvjM" +
            "MHAmBhHDxSKeGgY2MWS9DzuuGAbdm3hsFLRH7ERMfcQzo8AmhjVH7HkdNjE4E4OIcZ8YyiP2o+Sk/bGzh86Ub2KHCeojXhgE7RG7" +
            "N0F9xB514DgB647YOyewicGFHYgYxwlwiw3WG/HSIEj5G4D8CCP1EXsPG+XHCSdi6iN2IqY+YneJqY/YXWLqI/b5OkQM647YPWLq" +
            "I/ZuYi7NbzuDW2zgFhs4TrCpEY+NAZsY3CeGi0Xst0RxnAARQy728SQfTsImBhHDhSL2MVHqI/YxURwnYN0Re15HfcSe1+E4ASIG" +
            "EbPpEY8NAZsYRAwiZsMj9oF96iP+2RBwnAARg4gRMXgXG3g/MThOIGIQMYgYXNjhFhs4ToCIQcSIGEQMIgYR42EHeNgBjhMgYkQM" +
            "IgYRg4gRMYgYRAwiRsQgYhAxiJiNcuX8D1kaA90RmwGOEyBiEDEiBhGDiEHEiBhEDCIGESNiEDGIGESMiEHEIGIQMSIGEYOIQcSI" +
            "GEQMIgYRI2IQMYgYRIyIQcQgYhAxIgYRg4hBxGySfwC/1k/pr+6KtwAAAABJRU5ErkJggg==",
    },
];
