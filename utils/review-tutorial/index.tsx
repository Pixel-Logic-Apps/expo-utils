/**
 * <ReviewTutorial /> — tutorial animado de "como avaliar o app na Play Store".
 *
 * Substitui o GIF gravado de tela por uma página HTML/CSS/JS renderizada numa WebView.
 * Toda a animação é CSS (uma animação mestre de 19 s em loop); o JS interno só cuida do
 * texto digitado, do contador e da escala do canvas.
 *
 * Requer `react-native-webview` (peer opcional do expo-utils). Este arquivo é deep-import,
 * então apps que não usam o tutorial não carregam a dependência.
 *
 *   import {ReviewTutorial} from "expo-utils/utils/review-tutorial";
 *
 *   <ReviewTutorial appName="Meu App" appIconUrl="https://..." userName="Ana" locale="pt" />
 */

import React, {useEffect, useMemo, useState} from "react";
import {StyleProp, StyleSheet, View, ViewStyle} from "react-native";
import {WebView} from "react-native-webview";
import {Asset} from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {buildTutorialHtml, ReviewTutorialParams} from "./html";

export interface ReviewTutorialProps extends ReviewTutorialParams {
    /** Estilo do contêiner. O tutorial é desenhado para 1,775:1 (o mesmo aspecto do GIF). */
    style?: StyleProp<ViewStyle>;
    /** Raio das bordas. Default 24, igual ao slot de mídia do AskForReviewOverlay. */
    borderRadius?: number;
    /**
     * HTML pronto, substituindo o template embutido. É por aqui que o Remote Config
     * (`review_tutorial_html`) corrige um redesenho da Play Store sem release.
     */
    html?: string;
    /**
     * Ícone do app como módulo `require()` — o mesmo que você passaria para `<Image source>`.
     * A WebView não lê `file://` do bundle, então o arquivo é convertido em data URI antes
     * de entrar no HTML. Se `appIconUrl` for passado, ele tem precedência.
     *
     *   <ReviewTutorial appIcon={require("../assets/images/icon.png")} ... />
     */
    appIcon?: number | object;
}

/**
 * Resolve o ícone do app para algo que a WebView consiga exibir:
 * URL https direto, ou o asset do bundle convertido em data URI.
 */
function useAppIconUri(appIcon?: number | object, appIconUrl?: string): string | undefined {
    const [uri, setUri] = useState<string | undefined>(appIconUrl);
    useEffect(() => {
        if (appIconUrl) {
            setUri(appIconUrl);
            return;
        }
        if (!appIcon) {
            setUri(undefined);
            return;
        }
        let alive = true;
        (async () => {
            try {
                const asset = Asset.fromModule(appIcon as any);
                await asset.downloadAsync();
                const local = asset.localUri || asset.uri;
                if (!local) return;
                if (/^https?:/.test(local)) {
                    if (alive) setUri(local);
                    return;
                }
                const b64 = await FileSystem.readAsStringAsync(local, {encoding: "base64" as any});
                const type = /\.jpe?g$/i.test(local) ? "jpeg" : /\.webp$/i.test(local) ? "webp" : "png";
                if (alive) setUri("data:image/" + type + ";base64," + b64);
            } catch {
                /* sem ícone: o template cai no placeholder com a inicial */
            }
        })();
        return () => {
            alive = false;
        };
    }, [appIcon, appIconUrl]);
    return uri;
}

export function ReviewTutorial({
    style,
    borderRadius = 24,
    html: htmlOverride,
    appIcon,
    ...params
}: ReviewTutorialProps) {
    const appIconUrl = useAppIconUri(appIcon, params.appIconUrl);
    const html = useMemo(
        () => htmlOverride || buildTutorialHtml({...params, appIconUrl}),
        [
            params.appName,
            appIconUrl,
            params.userName,
            params.userInitial,
            params.avatarColor,
            params.clock,
            params.accent,
            params.locale,
            params.reviewText,
            params.dir,
            params.labels,
            htmlOverride,
        ]
    );

    return (
        <View style={[styles.wrap, {borderRadius}, style]} pointerEvents="none">
            <WebView
                source={{html}}
                originWhitelist={["*"]}
                style={styles.web}
                containerStyle={styles.web}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                overScrollMode="never"
                bounces={false}
                /* animação CSS fluida no Android */
                androidLayerType="hardware"
                /* decorativo: nada aqui é interativo */
                pointerEvents="none"
                setBuiltInZoomControls={false}
                setDisplayZoomControls={false}
                textZoom={100}
                /* sem rede: o HTML é local e o ícone do app é a única origem externa */
                cacheEnabled={false}
                javaScriptEnabled
                domStorageEnabled={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        overflow: "hidden",
        backgroundColor: "#FDFDFD",
    },
    web: {
        flex: 1,
        backgroundColor: "#FDFDFD",
    },
});

export default ReviewTutorial;
export {buildTutorialHtml} from "./html";
export type {ReviewTutorialParams} from "./html";
export {getPlayLabels, SUPPORTED_LABEL_LOCALES} from "./labels";
export type {PlayLabels} from "./labels";
