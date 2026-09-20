/**
 * Squircle sem dependência nenhuma, montado como 9-slice.
 *
 * Por que não o caminho óbvio:
 *  - `borderRadius` do RN é arco de círculo, não superelipse.
 *  - `borderCurve: "continuous"` (RN 0.71+) é **só iOS** — `cornerCurve` aparece apenas em
 *    `RCTViewComponentView.mm`/`RCTViewManager.m`, nada em `ReactAndroid`.
 *  - `clipToOutline` + `Outline.setPath()` só recorta em Android novo; os apps são minSdk 24.
 *  - `Image` + `capInsets` também é só iOS, e 9-patch exige `res/drawable`.
 *
 * Então: retângulos sólidos cobrem o miolo e quatro `<Image>` completam os cantos, recoloridas
 * por `tintColor` a partir de um PNG (os outros três cantos saem por espelho).
 *
 * TRÊS REGRAS que vieram de defeito visto em aparelho — não relaxe nenhuma:
 *
 *  1. NADA SE SOBREPÕE. O RN no Android aplica `opacity` por filho, sem composição offscreen:
 *     qualquer área coberta por duas peças escurece sob alpha e desenha uma cruz — inclusive
 *     com o alpha vindo de um ancestral (o `TouchableOpacity` pressionado). Por isso cada
 *     pixel pertence a exatamente uma peça, e `opacity` num wrapper NÃO é solução.
 *
 *  2. TUDO EM PIXEL FÍSICO INTEIRO, POSICIONADO POR `left`/`top` — NUNCA `right`/`bottom`.
 *     O Yoga arredonda o TAMANHO por coordenada absoluta, mas a POSIÇÃO relativa ao pai, e
 *     calcula o filho contra a dimensão NÃO arredondada do pai. Um pai de 44dp (115,5px) é
 *     desenhado com 115px, mas um filho `bottom: 0` de 57px cai em 58,5 → 59: sobra uma linha
 *     vazia no meio e o canto vaza 1px por baixo (medido em aparelho). O `onLayout` devolve o
 *     tamanho já arredondado, então `round(w × ratio)` é o pixel real, e cada peça recebe
 *     left/top/width/height múltiplos exatos de 1/ratio.
 *
 *  3. O PNG VEM DA CADEIA, NO TAMANHO MAIS PRÓXIMO. Reduzir 2,3× serrilha (bilinear sem
 *     mipmap), ampliar 1,6× borra. Com passo de ~1,4× a reamostragem fica em ±18%.
 *
 * LIMITE CONHECIDO: isto é fundo, não recorte. Filhos não são cortados — para conteúdo que não
 * dá para recortar (a WebView do tutorial) use `SquircleCorners`, que pinta a sobra por cima.
 * A sombra (`elevation`/`shadowPath`) também segue o retângulo arredondado da View, não o PNG.
 */

import React, {useState} from "react";
import {Image, ImageStyle, LayoutChangeEvent, PixelRatio, StyleSheet, View} from "react-native";
import {SQUIRCLE_CORNERS, SQUIRCLE_CORNERS_INVERSE, SQUIRCLE_SMOOTH, SquircleAsset} from "./squircle-assets";

/** PNG da cadeia mais próximo (em razão) do lado pedido, em pixels físicos. */
function pickAsset(chain: SquircleAsset[], px: number): SquircleAsset {
    let best = chain[0];
    for (const a of chain) {
        if (Math.abs(Math.log(a.size / px)) < Math.abs(Math.log(best.size / px))) best = a;
    }
    return best;
}

/** Tudo em pixels físicos inteiros; `rect()` converte para dp na hora de montar o estilo. */
interface Grid {
    ratio: number;
    /** tamanho REAL do container em px (o onLayout já devolve arredondado) */
    w: number;
    h: number;
    /** lado da caixa do canto em px */
    s: number;
}

/**
 * O canto ocupa SMOOTH·r de aresta e nunca passa de metade do menor lado (senão cruzariam).
 * `floor` na metade: com altura ímpar sobra 1px no meio, que as tiras laterais cobrem.
 */
function grid(radius: number, width: number, height: number): Grid {
    const ratio = PixelRatio.get();
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);
    const wanted = Math.round(Math.max(0, radius) * SQUIRCLE_SMOOTH * ratio);
    const s = Math.max(0, Math.min(wanted, Math.floor(Math.min(w, h) / 2)));
    return {ratio, w, h, s};
}

/** Retângulo em px → estilo absoluto em dp. Só left/top: ver regra 2 no topo do arquivo. */
function rect(g: Grid, x: number, y: number, w: number, h: number) {
    return {position: "absolute" as const, left: x / g.ratio, top: y / g.ratio, width: w / g.ratio, height: h / g.ratio};
}

function useSize() {
    const [size, setSize] = useState({w: 0, h: 0});
    const onLayout = (e: LayoutChangeEvent) => {
        const {width, height} = e.nativeEvent.layout;
        setSize((s) => (s.w === width && s.h === height ? s : {w: width, h: height}));
    };
    return {size, onLayout};
}

function Corner({uri, g, x, y, color, flipX, flipY}: {uri: string; g: Grid; x: number; y: number; color: string; flipX: boolean; flipY: boolean}) {
    const style: ImageStyle = {
        ...rect(g, x, y, g.s, g.s),
        tintColor: color,
        transform: [{scaleX: flipX ? -1 : 1}, {scaleY: flipY ? -1 : 1}],
    };
    return (
        <Image
            source={{uri}}
            style={style}
            resizeMode="stretch"
            /* escala na hora do desenho (bilinear); "resize" reamostra no decode com qualidade pior */
            resizeMethod="scale"
            /* Android faz fade-in de 300ms por padrão: os cantos apareciam depois do miolo */
            fadeDuration={0}
        />
    );
}

/** Os quatro cantos de um container w×h, cada um no seu vértice. */
function Corners({uri, g, color}: {uri: string; g: Grid; color: string}) {
    return (
        <>
            <Corner uri={uri} g={g} color={color} x={0} y={0} flipX={false} flipY={false} />
            <Corner uri={uri} g={g} color={color} x={g.w - g.s} y={0} flipX={true} flipY={false} />
            <Corner uri={uri} g={g} color={color} x={0} y={g.h - g.s} flipX={false} flipY={true} />
            <Corner uri={uri} g={g} color={color} x={g.w - g.s} y={g.h - g.s} flipX={true} flipY={true} />
        </>
    );
}

/** Só o preenchimento, em `position: absolute`. Use como primeiro filho de qualquer container. */
export function SquircleFill({color, radius, opacity = 1}: {color: string; radius: number; opacity?: number}) {
    const {size, onLayout} = useSize();
    const g = size.w > 0 && size.h > 0 ? grid(radius, size.w, size.h) : undefined;

    // Antes da primeira medida (ou raio zero) é um retângulo liso; um frame, e o overlay que
    // usa isto ainda está com o backdrop em fade-in.
    if (!g || g.s === 0) {
        return (
            <View
                style={[StyleSheet.absoluteFill, {backgroundColor: color, opacity}]}
                onLayout={onLayout}
                pointerEvents="none"
            />
        );
    }

    const uri = pickAsset(SQUIRCLE_CORNERS, g.s).uri;
    const middle = g.h - 2 * g.s;
    return (
        <View style={[StyleSheet.absoluteFill, {opacity}]} onLayout={onLayout} pointerEvents="none">
            {/* coluna central, altura toda — ENCOSTA nos cantos, nunca invade (regra 1) */}
            <View style={[rect(g, g.s, 0, g.w - 2 * g.s, g.h), {backgroundColor: color}]} />
            {/* tiras laterais só ENTRE os cantos; com canto = metade da altura sobra 0 ou 1px */}
            {middle > 0 && <View style={[rect(g, 0, g.s, g.s, middle), {backgroundColor: color}]} />}
            {middle > 0 && <View style={[rect(g, g.w - g.s, g.s, g.s, middle), {backgroundColor: color}]} />}
            <Corners uri={uri} g={g} color={color} />
        </View>
    );
}

/**
 * Pinta a SOBRA dos cantos com `color`, por cima do conteúdo. É assim que a WebView do tutorial
 * lê como squircle — nenhuma máscara recorta uma surface nativa de fora, mas uma sobreposição
 * opaca funciona sobre qualquer coisa. O conteúdo precisa estar com `borderRadius: 0`: com canto
 * circular a sobra já estaria vazada e não haveria o que pintar.
 */
export function SquircleCorners({color, radius}: {color: string; radius: number}) {
    const {size, onLayout} = useSize();
    const g = size.w > 0 && size.h > 0 ? grid(radius, size.w, size.h) : undefined;
    return (
        <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
            {g && g.s > 0 && <Corners uri={pickAsset(SQUIRCLE_CORNERS_INVERSE, g.s).uri} g={g} color={color} />}
        </View>
    );
}
