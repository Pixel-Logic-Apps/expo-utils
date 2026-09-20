#!/usr/bin/env python3
"""Gera utils/squircle-assets.ts. Rode da raiz do repo: python3 docs/squircle-gen.py

Requer Pillow. Só é preciso rodar se mudar SMOOTH/N ou a cadeia de tamanhos.

Decisões que NÃO são arbitrárias (cada uma corrige um defeito visto em aparelho):

  * N e SMOOTH andam juntos. Superelipse numa caixa r×r corta o vértice muito mais raso que
    um arco de raio r. Apple/Figma alongam o canto por SMOOTH·r de aresta; com essa caixa, o
    expoente que iguala a profundidade de corte do círculo de raio r é N (resolvido abaixo).

  * Cadeia de tamanhos (passo ~1,4x). Um PNG único de 128px era reduzido 2,3x nos botões
    (bilinear sem mipmap mata o antialias -> serrilhado) e ampliado 1,6x no card (borrado).
    Com a cadeia o componente pega o tamanho mais próximo e nunca reamostra mais que ~18%.

  * Filtro BOX, não Lanczos. Box sobre supersampling é cobertura de área exata; o Lanczos
    dava ringing na borda da imagem e deixava o pixel de tangência com ~80% de alpha, o que
    criava emenda visível com a faixa sólida vizinha. Com cobertura exata a faixa pode
    ENCOSTAR no canto sem sobrepor — e sobreposição é proibida, porque o Android aplica
    opacity por filho e qualquer área dupla vira uma cruz escura sob alpha.

  * Modo LA (cinza+alpha): ~30% menor que RGBA e o tintColor só usa o alpha.
"""
from PIL import Image
import base64, io, math, os, textwrap

SMOOTH = 1.6          # quanto de aresta o canto ocupa, em múltiplos do raio
SS = 8                # supersampling por eixo
SIZES = [24, 34, 47, 66, 92, 129, 181, 253, 354]   # ~1,4x; cobre 21dp@1x até ~135dp@2,6x

def solve_exponent(smooth: float) -> float:
    """n tal que smooth*(1-0.5^(1/n)) == 1-1/sqrt(2): mesmo corte diagonal do círculo de raio r."""
    target = 1 - 1 / math.sqrt(2)
    lo, hi = 2.0, 12.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if smooth * (1 - 0.5 ** (1 / mid)) > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

N = solve_exponent(SMOOTH)

def corner(size: int, inverse: bool) -> bytes:
    """Canto superior-esquerdo. Coordenadas contínuas em [0,1]^2 com subpixels no CENTRO
    (x+0.5)/S: os pontos de tangência caem exatamente nos vértices (0,1) e (1,0) da caixa."""
    S = size * SS
    rows = bytearray(S * S)
    pw = [(1 - (i + 0.5) / S) ** N for i in range(S)]
    for y in range(S):
        fy = pw[y]
        base = y * S
        for x in range(S):
            inside = (pw[x] + fy) <= 1.0
            rows[base + x] = 255 if (inside != inverse) else 0
    alpha = Image.frombytes("L", (S, S), bytes(rows)).resize((size, size), Image.BOX)
    img = Image.merge("LA", (Image.new("L", (size, size), 255), alpha))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()

def ts_array(name: str, doc: str, inverse: bool) -> tuple[str, int]:
    out = [f"/** {doc} */", f"export const {name}: SquircleAsset[] = ["]
    total = 0
    for size in SIZES:
        raw = corner(size, inverse)
        total += len(raw)
        b64 = base64.b64encode(raw).decode()
        chunks = textwrap.wrap(b64, 100)
        out.append("    {")
        out.append(f"        size: {size},")
        out.append('        uri:')
        out.append('            "data:image/png;base64," +')
        out.append("\n".join(f'            "{c}"' + (" +" if i < len(chunks) - 1 else ",") for i, c in enumerate(chunks)))
        out.append("    },")
    out.append("];")
    return "\n".join(out), total

HEADER = f'''/**
 * Cantos do squircle como PNGs embutidos — superelipse sem dependência nenhuma.
 * GERADO por docs/squircle-gen.py — não edite à mão; as decisões estão documentadas lá.
 *
 * Forma: |x|^n + |y|^n = 1 com n = {N:.4f}, numa caixa de {SMOOTH}·r. Esse par dá a mesma
 * profundidade de corte de um `borderRadius: r` com a curvatura espalhada por {SMOOTH}·r de
 * aresta (a leitura de squircle da Apple/Figma).
 *
 * São {len(SIZES)} tamanhos (~1,4x entre si) para o componente nunca reamostrar mais que ~18%:
 * redução forte serrilha (bilinear sem mipmap), ampliação borra. Cobertura de área exata
 * (supersampling {SS}x + filtro box), então faixa sólida pode encostar no canto sem emenda.
 */

export interface SquircleAsset {{
    /** lado do PNG em pixels */
    size: number;
    uri: string;
}}

/** Quantas vezes o raio o canto ocupa de aresta. Casado com o expoente dos PNGs. */
export const SQUIRCLE_SMOOTH = {SMOOTH};
'''

if __name__ == "__main__":
    pos, pos_bytes = ts_array(
        "SQUIRCLE_CORNERS",
        "Canto superior-esquerdo, opaco DENTRO da forma. Fundo de card e botões.",
        False,
    )
    neg, neg_bytes = ts_array(
        "SQUIRCLE_CORNERS_INVERSE",
        "O negativo: opaco FORA. Sobreposto em conteúdo que não dá para recortar (a WebView).",
        True,
    )
    dest = os.path.join(os.path.dirname(__file__), "..", "utils", "squircle-assets.ts")
    with open(dest, "w", encoding="utf8") as f:
        f.write(HEADER + "\n" + pos + "\n\n" + neg + "\n")
    print(f"n = {N:.4f}  smooth = {SMOOTH}")
    print(f"positivo: {pos_bytes} bytes | negativo: {neg_bytes} bytes | arquivo: {os.path.getsize(dest)} bytes")
