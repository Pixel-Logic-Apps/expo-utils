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

export type CrossPromoConfig = {
    enabled?: boolean;
    title?: string;
    app_name?: string;
    subtitle?: string;
    icon_url?: string;
    cta?: string;
    url?: string;
    ios_url?: string;
    android_url?: string;
    screens?: string[];
};

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

    if (!cfg.enabled || !url || !screens.includes(screen)) return null;

    return (
        <Pressable
            onPress={() => Linking.openURL(url).catch(() => {})}
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
