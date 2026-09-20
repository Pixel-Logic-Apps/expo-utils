import {
    Image,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import {useEffect} from "react";

import type {CrossPromoConfig} from "./types";
import {logUtilsEvent} from "./analytics";

// Re-export: a fonte do type é o types.ts (onde o cross_promo é obrigatório no
// RemoteConfigScreensType). Mantido aqui para não quebrar imports existentes.
export type {CrossPromoConfig};

export type CrossPromoColors = {
    backgroundElement: string;
    backgroundSelected: string;
    accent: string;
    onAccent: string;
    text: string;
    textSecondary: string;
};

type ColorSchemeMap = {light: CrossPromoColors; dark: CrossPromoColors};

export function CrossPromoCard({
    screen,
    colors,
    style,
}: {
    screen: string;
    colors: CrossPromoColors | ColorSchemeMap;
    style?: StyleProp<ViewStyle>;
}) {
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const c: CrossPromoColors =
        colors && "light" in colors && "dark" in colors ? colors[scheme] : (colors as CrossPromoColors);
    const styles = makeStyles(c);

    const cfg: CrossPromoConfig = (global as any).remoteConfigScreens?.cross_promo ?? {};
    const url = (Platform.OS === "ios" ? cfg.ios_url : cfg.android_url) || cfg.url;
    const screens = cfg.screens ?? ["home"];

    const visible = Boolean(cfg.enabled && url && screens.includes(screen));

    // Mesmo funil do promo modal (promo_impression / promo_click) com promo_variant próprio,
    // pra reaproveitar as dimensões custom do GA4. `screen` diz ONDE o card converteu.
    const promoParams = {
        promo_variant: "cross_promo_card",
        promo_type: "cross_promo",
        promo_name: cfg.app_name ?? "",
        promo_store_url: url ?? "",
        promo_media: cfg.icon_url ? "image" : "gradient",
        screen,
    };

    // 1 impressão por exibição (montagem, troca de tela ou de app anunciado), não por render.
    useEffect(() => {
        if (visible) logUtilsEvent("promo_impression", promoParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, screen, url]);

    if (!visible || !url) return null;

    return (
        <Pressable
            onPress={() => {
                logUtilsEvent("promo_click", {...promoParams, click_source: "card"});
                Linking.openURL(url).catch(() => {});
            }}
            style={({pressed}) => [styles.card, pressed && {opacity: 0.9}, style]}>
            <View style={styles.iconWrap}>
                {cfg.icon_url ? <Image source={{uri: cfg.icon_url}} style={styles.icon} /> : null}
            </View>
            <View style={styles.copy}>
                <Text style={styles.eyebrow}>{cfg.title || "Conheça também"}</Text>
                <Text style={styles.appName} numberOfLines={1}>
                    {cfg.app_name || "Nosso outro app"}
                </Text>
                {!!cfg.subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {cfg.subtitle}
                    </Text>
                )}
            </View>
            <View style={styles.cta}>
                <Text style={styles.ctaText}>{(cfg.cta || "Ver").toUpperCase()}</Text>
            </View>
        </Pressable>
    );
}

const makeStyles = (c: CrossPromoColors) =>
    StyleSheet.create({
        card: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: c.backgroundElement,
            borderRadius: 14,
            padding: 14,
        },
        iconWrap: {
            width: 52,
            height: 52,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: c.backgroundSelected,
            alignItems: "center",
            justifyContent: "center",
        },
        icon: {width: 52, height: 52},
        copy: {flex: 1, minWidth: 0},
        eyebrow: {
            fontSize: 11,
            fontWeight: "800",
            color: c.accent,
            textTransform: "uppercase",
            letterSpacing: 0.6,
        },
        appName: {fontSize: 15, fontWeight: "700", color: c.text, marginTop: 1},
        subtitle: {fontSize: 12, color: c.textSecondary, marginTop: 1},
        cta: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.accent,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        ctaText: {fontSize: 12, fontWeight: "700", color: c.onAccent},
    });
