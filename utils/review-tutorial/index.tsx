/**
 * <ReviewTutorial /> — tutorial animado de "como avaliar o app na Play Store".
 *
 * Substitui o GIF gravado de tela por uma página HTML/CSS/JS renderizada numa WebView.
 * Animações CSS, digitação e cursor compartilham a mesma linha do tempo (21,85 s por padrão).
 *
 * Requer `react-native-webview` (peer opcional do expo-utils). Este arquivo é deep-import,
 * então apps que não usam o tutorial não carregam a dependência.
 *
 *   import {ReviewTutorial} from "expo-utils/utils/review-tutorial";
 *
 *   <ReviewTutorial />                       // nome, idioma e ícone descobertos sozinhos
 *   <ReviewTutorial appName="Meu App" appIconUrl="https://..." userName="Ana" locale="pt" />
 */

import React, {useEffect, useMemo, useState} from "react";
import {StyleProp, StyleSheet, View, ViewStyle} from "react-native";
import {WebView} from "react-native-webview";
import {Asset} from "expo-asset";
import * as Application from "expo-application";
import * as FileSystem from "expo-file-system/legacy";
import {getLocales} from "expo-localization";
import {buildTutorialHtml, ReviewTutorialParams} from "./html";
import {resolveAppIconUrl} from "./app-icon";

/**
 * Teto de espera pelo ícone. Passado isso o tutorial começa com o placeholder e NÃO troca
 * depois: mudar o HTML recarregaria a WebView e a animação voltaria do zero no meio.
 * Com o cache do AsyncStorage (ou o prefetch do askForReview) isso resolve em ~1ms.
 */
const ICON_WAIT_MS = 1500;

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
 * Resolve o ícone do app para algo que a WebView consiga exibir: URL https direto, o asset do
 * bundle convertido em data URI, ou — sem nenhuma prop — a descoberta automática de `app-icon`.
 *
 * `settled` indica que a decisão acabou. O componente só monta a WebView depois disso, para o
 * HTML não mudar com a animação já rodando.
 */
function useAppIconUri(appIcon?: number | object, appIconUrl?: string): {uri?: string; settled: boolean} {
    const [state, setState] = useState<{uri?: string; settled: boolean}>(() =>
        appIconUrl ? {uri: appIconUrl, settled: true} : {settled: false}
    );
    useEffect(() => {
        if (appIconUrl) {
            setState({uri: appIconUrl, settled: true});
            return;
        }
        let alive = true;
        const done = (uri?: string) => alive && setState({uri, settled: true});

        if (!appIcon) {
            /* nada foi passado: descobre sozinho, com teto de espera */
            const timer = setTimeout(() => done(undefined), ICON_WAIT_MS);
            resolveAppIconUrl()
                .then((uri) => {
                    clearTimeout(timer);
                    done(uri);
                })
                .catch(() => {
                    clearTimeout(timer);
                    done(undefined);
                });
            return () => {
                alive = false;
                clearTimeout(timer);
            };
        }

        (async () => {
            try {
                const asset = Asset.fromModule(appIcon as any);
                await asset.downloadAsync();
                const local = asset.localUri || asset.uri;
                if (!local) return done(undefined);
                if (/^https?:/.test(local)) return done(local);
                const b64 = await FileSystem.readAsStringAsync(local, {encoding: "base64" as any});
                const type = /\.jpe?g$/i.test(local) ? "jpeg" : /\.webp$/i.test(local) ? "webp" : "png";
                done("data:image/" + type + ";base64," + b64);
            } catch {
                /* sem ícone: o template cai no placeholder com a inicial */
                done(undefined);
            }
        })();
        return () => {
            alive = false;
        };
    }, [appIcon, appIconUrl]);
    return state;
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
            params.userEmail,
            params.userInitial,
            params.avatarColor,
            params.clock,
            params.accent,
            params.locale,
            params.reviewText,
            params.dir,
            params.labels,
            params.timings,
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
export type {ReviewTutorialTimings} from "./timings";
export {getPlayLabels, SUPPORTED_LABEL_LOCALES} from "./labels";
export type {PlayLabels} from "./labels";
