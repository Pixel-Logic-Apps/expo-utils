import AsyncStorage from "@react-native-async-storage/async-storage";
import {LinearGradient} from "expo-linear-gradient";
import {getLocales} from "expo-localization";
import * as Linking from "expo-linking";
import React, {useEffect, useRef, useState} from "react";
import {Animated, Dimensions, Image, Modal, PanResponder, Pressable, StyleSheet, Text, View, ViewStyle} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import type {PromotionalConfig, PromotionalShadow} from "./types";
export type {PromotionalShadow};

const STORAGE_KEY_NAO_MOSTRAR = "@nao_mostrar_app_promocionals";
const STORAGE_KEY_VISIT_COUNT = "@promo_visit_count";

// ─── Auto-translations ──────────────────────────────────────────────────────

type PromoTranslations = {
    download: string;
    dontShowAgain: string;
    dontShow: string;
    close: string;
    now: string;
};

const PROMO_TRANSLATIONS: Record<string, PromoTranslations> = {
    en: {download: "Download Now", dontShowAgain: "Don't show again", dontShow: "Don't show", close: "Close", now: "now"},
    pt: {download: "Baixar Agora", dontShowAgain: "Não mostrar novamente", dontShow: "Não mostrar", close: "Fechar", now: "agora"},
    es: {download: "Descargar Ahora", dontShowAgain: "No mostrar de nuevo", dontShow: "No mostrar", close: "Cerrar", now: "ahora"},
    fr: {download: "Télécharger", dontShowAgain: "Ne plus afficher", dontShow: "Masquer", close: "Fermer", now: "maintenant"},
    de: {download: "Jetzt Laden", dontShowAgain: "Nicht mehr anzeigen", dontShow: "Ausblenden", close: "Schließen", now: "jetzt"},
    it: {download: "Scarica Ora", dontShowAgain: "Non mostrare più", dontShow: "Nascondi", close: "Chiudi", now: "ora"},
    ja: {download: "今すぐダウンロード", dontShowAgain: "今後表示しない", dontShow: "非表示", close: "閉じる", now: "今"},
    ko: {download: "지금 다운로드", dontShowAgain: "다시 표시 안 함", dontShow: "숨기기", close: "닫기", now: "지금"},
    zh: {download: "立即下载", dontShowAgain: "不再显示", dontShow: "隐藏", close: "关闭", now: "刚刚"},
    ru: {download: "Скачать Сейчас", dontShowAgain: "Больше не показывать", dontShow: "Скрыть", close: "Закрыть", now: "сейчас"},
    ar: {download: "حمّل الآن", dontShowAgain: "عدم الإظهار مجدداً", dontShow: "إخفاء", close: "إغلاق", now: "الآن"},
    hi: {download: "अभी डाउनलोड करें", dontShowAgain: "फिर न दिखाएं", dontShow: "छुपाएं", close: "बंद करें", now: "अभी"},
    nl: {download: "Nu Downloaden", dontShowAgain: "Niet meer tonen", dontShow: "Verbergen", close: "Sluiten", now: "nu"},
    pl: {download: "Pobierz Teraz", dontShowAgain: "Nie pokazuj ponownie", dontShow: "Ukryj", close: "Zamknij", now: "teraz"},
    tr: {download: "Şimdi İndir", dontShowAgain: "Bir daha gösterme", dontShow: "Gizle", close: "Kapat", now: "şimdi"},
    sv: {download: "Ladda Ner Nu", dontShowAgain: "Visa inte igen", dontShow: "Dölj", close: "Stäng", now: "nu"},
    da: {download: "Download Nu", dontShowAgain: "Vis ikke igen", dontShow: "Skjul", close: "Luk", now: "nu"},
    fi: {download: "Lataa Nyt", dontShowAgain: "Älä näytä uudelleen", dontShow: "Piilota", close: "Sulje", now: "nyt"},
    no: {download: "Last Ned Nå", dontShowAgain: "Ikke vis igjen", dontShow: "Skjul", close: "Lukk", now: "nå"},
    cs: {download: "Stáhnout Nyní", dontShowAgain: "Znovu nezobrazovat", dontShow: "Skrýt", close: "Zavřít", now: "nyní"},
    el: {download: "Λήψη Τώρα", dontShowAgain: "Να μην εμφανιστεί ξανά", dontShow: "Απόκρυψη", close: "Κλείσιμο", now: "τώρα"},
    he: {download: "הורד עכשיו", dontShowAgain: "אל תציג שוב", dontShow: "הסתר", close: "סגור", now: "עכשיו"},
    th: {download: "ดาวน์โหลดเลย", dontShowAgain: "ไม่ต้องแสดงอีก", dontShow: "ซ่อน", close: "ปิด", now: "ตอนนี้"},
    vi: {download: "Tải Ngay", dontShowAgain: "Không hiển thị lại", dontShow: "Ẩn", close: "Đóng", now: "bây giờ"},
    id: {download: "Unduh Sekarang", dontShowAgain: "Jangan tampilkan lagi", dontShow: "Sembunyikan", close: "Tutup", now: "sekarang"},
    ms: {download: "Muat Turun Sekarang", dontShowAgain: "Jangan tunjuk lagi", dontShow: "Sembunyikan", close: "Tutup", now: "sekarang"},
    ro: {download: "Descarcă Acum", dontShowAgain: "Nu mai afișa", dontShow: "Ascunde", close: "Închide", now: "acum"},
    uk: {download: "Завантажити Зараз", dontShowAgain: "Більше не показувати", dontShow: "Сховати", close: "Закрити", now: "зараз"},
    hu: {download: "Letöltés Most", dontShowAgain: "Ne jelenjen meg újra", dontShow: "Elrejtés", close: "Bezárás", now: "most"},
    sk: {download: "Stiahnuť Teraz", dontShowAgain: "Znovu nezobrazovať", dontShow: "Skryť", close: "Zavrieť", now: "teraz"},
    bg: {download: "Изтегли Сега", dontShowAgain: "Не показвай отново", dontShow: "Скрий", close: "Затвори", now: "сега"},
};

function getPromoTranslations(): PromoTranslations {
    try {
        const locales = getLocales();
        const lang = locales[0]?.languageCode || "en";
        return PROMO_TRANSLATIONS[lang] || PROMO_TRANSLATIONS.en;
    } catch {
        return PROMO_TRANSLATIONS.en;
    }
}

// ─── nth-impression parser (CSS nth-child syntax) ────────────────────────────

function parseNthExpression(expr: string): {a: number; b: number} {
    const s = expr.replace(/\s/g, "").toLowerCase();
    if (/^\d+$/.test(s)) return {a: 0, b: parseInt(s, 10)};
    if (s === "n") return {a: 1, b: 0};
    if (/^\d+n$/.test(s)) return {a: parseInt(s, 10), b: 0};
    const anb = s.match(/^(\d*)n\+(\d+)$/);
    if (anb) return {a: anb[1] ? parseInt(anb[1], 10) : 1, b: parseInt(anb[2], 10)};
    const bna = s.match(/^(\d+)\+(\d*)n$/);
    if (bna) return {a: bna[2] ? parseInt(bna[2], 10) : 1, b: parseInt(bna[1], 10)};
    return {a: 1, b: 0};
}

function matchesNth(visit: number, a: number, b: number): boolean {
    if (a === 0) return visit === b;
    return visit >= b && (visit - b) % a === 0;
}

export type {PromotionalConfig};

/** @deprecated Use PromotionalConfig instead */
export type AppModalConfig = PromotionalConfig;

export type ModalColors = {
    overlayBackground: string;
    modalBackground: string;
    handleColor: string;
    iconContainerBackground: string;
    iconContainerShadow: string;
    titleText: string;
    descriptionText: string;
    primaryButtonText: string;
    secondaryButtonText: string;
};

const defaultColors: ModalColors = {
    overlayBackground: "rgba(0,0,0,0.5)",
    modalBackground: "#FFFFFF",
    handleColor: "rgba(255,255,255,0.3)",
    iconContainerBackground: "#FFFFFF",
    iconContainerShadow: "#000000",
    titleText: "#1F2937",
    descriptionText: "#6B7280",
    primaryButtonText: "#FFFFFF",
    secondaryButtonText: "#6B7280",
};

type Props = {
    visible: boolean;
    onClose: () => void;
    colors?: Partial<ModalColors>;
    t?: (key: string) => string;
};

const processText = (text: string, t?: (key: string) => string): string => {
    if (!t) return text;
    return text.replace(/%\{(\w+)\}/g, (_, key) => t(key) || key);
};

let _cachedTr: PromoTranslations | null = null;
const tr = (): PromoTranslations => {
    if (!_cachedTr) _cachedTr = getPromoTranslations();
    return _cachedTr;
};

/** Resolve text: remote config value → processText (i18n paths) → auto-translation fallback */
const resolveText = (configValue: string | undefined, fallbackKey: keyof PromoTranslations, t?: (key: string) => string): string => {
    if (configValue) return processText(configValue, t);
    return tr()[fallbackKey];
};

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.65;

const CIRCLE_SIZES = {
    one: SCREEN_WIDTH * 0.4,
    two: SCREEN_WIDTH * 0.6,
    three: SCREEN_WIDTH * 0.8,
    four: SCREEN_WIDTH * 1.0,
};

function buildShadowStyle(shadow?: PromotionalShadow): ViewStyle {
    if (!shadow) return {};
    return {
        shadowColor: shadow.color ?? "#000",
        shadowOffset: {width: shadow.offsetX ?? 0, height: shadow.offsetY ?? 4},
        shadowOpacity: shadow.opacity ?? 0.25,
        shadowRadius: shadow.radius ?? 12,
        elevation: shadow.elevation ?? 10,
    };
}

function getConfig(): PromotionalConfig | undefined {
    const promotional = (global as any).remoteConfigs?.promotional;
    if (promotional) return promotional as PromotionalConfig;
    const appmodal = (global as any).remoteConfigs?.appmodal;
    if (appmodal) return appmodal as PromotionalConfig;
    return undefined;
}

// ─── Bottom Sheet (existing modal) ──────────────────────────────────────────

function BottomSheetContent({visible, onClose, colors: colorsProp, t, config}: Props & {config: PromotionalConfig}) {
    const insets = useSafeAreaInsets();
    const c = {...defaultColors, ...colorsProp};

    const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;
    const panY = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100 || gestureState.vy > 0.5) {
                    Animated.timing(panY, {
                        toValue: MODAL_HEIGHT,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        panY.setValue(0);
                        onClose();
                    });
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        }),
    ).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 65,
                    friction: 11,
                }),
                Animated.timing(overlayAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            slideAnim.setValue(MODAL_HEIGHT);
            overlayAnim.setValue(0);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: MODAL_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(overlayAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    const handleBaixar = async () => {
        if (config.storeUrl) await Linking.openURL(config.storeUrl);
        handleClose();
    };

    const handleNaoMostrar = async () => {
        await AsyncStorage.setItem(STORAGE_KEY_NAO_MOSTRAR, "true");
        handleClose();
    };

    const gradientColors = config.gradientColors || ["#22C55E", "#16A34A"];

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <View style={styles.container}>
                <Animated.View style={[styles.overlay, {opacity: overlayAnim, backgroundColor: c.overlayBackground}]}>
                    <Pressable style={styles.overlayPressable} onPress={handleClose} />
                </Animated.View>

                <Animated.View
                    {...panResponder.panHandlers}
                    style={[
                        styles.modalContainer,
                        {
                            backgroundColor: c.modalBackground,
                            paddingBottom: insets.bottom,
                            transform: [{translateY: Animated.add(slideAnim, panY)}],
                        },
                    ]}>
                    {config.bannerImg ? (
                        <View style={[styles.bannerContainer, {height: config.bannerHeight ?? 200}]}>
                            <Image source={{uri: config.bannerImg}} style={styles.bannerImage} resizeMode="cover" />
                            <View style={styles.handleContainer}>
                                <View style={[styles.handle, {backgroundColor: c.handleColor}]} />
                            </View>
                        </View>
                    ) : (
                        <LinearGradient
                            colors={gradientColors}
                            start={{x: 0, y: 0}}
                            end={{x: 1, y: 1}}
                            style={styles.gradientBackground}>
                            <View style={styles.handleContainer}>
                                <View style={[styles.handle, {backgroundColor: c.handleColor}]} />
                            </View>

                            <View style={styles.circlesContainer}>
                                <LinearGradient
                                    colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]}
                                    start={{x: 0.5, y: 0}}
                                    end={{x: 0.5, y: 1}}
                                    style={[styles.circleGradient, styles.circle4]}
                                />
                                <LinearGradient
                                    colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]}
                                    start={{x: 0.5, y: 0}}
                                    end={{x: 0.5, y: 1}}
                                    style={[styles.circleGradient, styles.circle3]}
                                />
                                <LinearGradient
                                    colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"]}
                                    start={{x: 0.5, y: 0}}
                                    end={{x: 0.5, y: 1}}
                                    style={[styles.circleGradient, styles.circle2]}
                                />
                                <LinearGradient
                                    colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.06)"]}
                                    start={{x: 0.5, y: 0}}
                                    end={{x: 0.5, y: 1}}
                                    style={[styles.circleGradient, styles.circle1]}>
                                    <View style={styles.iconWrapper}>
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                {
                                                    backgroundColor: c.iconContainerBackground,
                                                    shadowColor: c.iconContainerShadow,
                                                },
                                            ]}>
                                            <Image
                                                source={{uri: config.icon}}
                                                style={styles.iconImage}
                                                resizeMode="cover"
                                            />
                                        </View>
                                    </View>
                                </LinearGradient>
                            </View>

                            <LinearGradient
                                start={{x: 0, y: 0}}
                                end={{x: 0, y: 1}}
                                colors={["transparent", c.modalBackground]}
                                style={styles.fadeGradient}
                            />
                        </LinearGradient>
                    )}

                    <View style={[styles.contentContainer, {backgroundColor: c.modalBackground}]}>
                        <Text style={[styles.titulo, {color: c.titleText}]}>{processText(config.name, t)}</Text>
                        <Text style={[styles.descricao, {color: c.descriptionText}]}>{processText(config.description, t)}</Text>

                        <Pressable
                            style={({pressed}) => [
                                styles.botaoPrincipal,
                                {backgroundColor: config.primaryColor},
                                pressed && styles.botaoPrincipalPressed,
                            ]}
                            onPress={handleBaixar}>
                            <Text style={[styles.botaoPrincipalText, {color: c.primaryButtonText}]}>
                                {resolveText(config.buttonText, "download", t)}
                            </Text>
                        </Pressable>

                        {config.showDontShowAgain && (
                            <Pressable
                                style={({pressed}) => [
                                    styles.botaoSecundario,
                                    pressed && styles.botaoSecundarioPressed,
                                ]}
                                onPress={handleNaoMostrar}>
                                <Text style={[styles.botaoSecundarioText, {color: c.secondaryButtonText}]}>
                                    {tr().dontShowAgain}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

// ─── Card Banner Bottom ─────────────────────────────────────────────────────

function CardBannerBottomContent({visible, onClose, colors: colorsProp, t, config}: Props & {config: PromotionalConfig}) {
    const insets = useSafeAreaInsets();
    const c = {...defaultColors, ...colorsProp};
    const hasBannerImg = !!config.bannerImg;

    const slideAnim = useRef(new Animated.Value(300)).current;
    const panY = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 60 || gestureState.vy > 0.5) {
                    Animated.timing(panY, {
                        toValue: 300,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        panY.setValue(0);
                        onClose();
                    });
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        }),
    ).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            slideAnim.setValue(300);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
        }).start(() => onClose());
    };

    const handleBaixar = async () => {
        if (config.storeUrl) await Linking.openURL(config.storeUrl);
        handleClose();
    };

    const handleNaoMostrar = async () => {
        await AsyncStorage.setItem(STORAGE_KEY_NAO_MOSTRAR, "true");
        handleClose();
    };

    const gradientColors = config.gradientColors || ["#22C55E", "#16A34A"];
    const shadowStyle = buildShadowStyle(config.shadow ?? {color: "#000", offsetY: 4, opacity: 0.25, radius: 12, elevation: 10});

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <Pressable style={styles.cardOverlay} onPress={handleClose} />
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.cardContainer,
                    shadowStyle,
                    {
                        marginBottom: insets.bottom + 8,
                        height: hasBannerImg ? (config.bannerHeight ?? 220) : undefined,
                        transform: [{translateY: Animated.add(slideAnim, panY)}],
                    },
                ]}>
                {hasBannerImg ? (
                    <>
                        <Image
                            source={{uri: config.bannerImg}}
                            style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={["transparent", "rgba(255,255,255,0.85)"]}
                            start={{x: 0, y: 0.3}}
                            end={{x: 0, y: 1}}
                            style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]}
                        />
                        <Pressable style={styles.cardCloseBtn} onPress={handleClose} hitSlop={8}>
                            <Text style={styles.cardCloseBtnText}>✕</Text>
                        </Pressable>
                        <Pressable style={styles.cardImgInner} onPress={handleBaixar}>
                            <View style={styles.cardImgBody}>
                                <View style={styles.cardImgTextArea}>
                                    <Text style={[styles.cardImgTitle, {color: c.titleText}]} numberOfLines={3}>
                                        {processText(config.name, t)}
                                    </Text>
                                    <View style={[styles.cardImgCta, {backgroundColor: config.primaryColor}]}>
                                        <Text style={styles.cardImgCtaText} numberOfLines={1}>
                                            {resolveText(config.buttonText, "download", t)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.cardImgIconArea}>
                                    <View style={styles.cardImgIconContainer}>
                                        <Image source={{uri: config.icon}} style={styles.cardImgIcon} resizeMode="cover" />
                                    </View>
                                    <Text style={[styles.cardImgIconLabel, {color: c.descriptionText}]} numberOfLines={1}>
                                        {processText(config.name, t)}
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                    </>
                ) : (
                    <>
                        <LinearGradient
                            colors={gradientColors}
                            start={{x: 0, y: 0}}
                            end={{x: 1, y: 1}}
                            style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]}
                        />
                        <View style={styles.cardInner}>
                            <Pressable style={styles.cardCloseBtn} onPress={handleClose} hitSlop={8}>
                                <Text style={styles.cardCloseBtnText}>✕</Text>
                            </Pressable>
                            <View style={styles.cardBody}>
                                <View style={styles.cardTextArea}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {processText(config.name, t)}
                                    </Text>
                                    <Text style={styles.cardDescription} numberOfLines={2}>
                                        {processText(config.description, t)}
                                    </Text>
                                    <View style={styles.cardActions}>
                                        <Pressable
                                            style={({pressed}) => [
                                                styles.cardCta,
                                                {backgroundColor: c.modalBackground},
                                                pressed && {opacity: 0.8},
                                            ]}
                                            onPress={handleBaixar}>
                                            <Text style={[styles.cardCtaText, {color: config.primaryColor}]}>
                                                {resolveText(config.buttonText, "download", t)}
                                            </Text>
                                        </Pressable>
                                        {config.showDontShowAgain && (
                                            <Pressable onPress={handleNaoMostrar} hitSlop={4}>
                                                <Text style={styles.cardDontShow}>{tr().dontShow}</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                                <Image source={{uri: config.icon}} style={styles.cardIcon} resizeMode="cover" />
                            </View>
                        </View>
                    </>
                )}
            </Animated.View>
        </Modal>
    );
}

// ─── Fullscreen Interstitial ────────────────────────────────────────────────

function FullscreenContent({visible, onClose, colors: colorsProp, t, config}: Props & {config: PromotionalConfig}) {
    const insets = useSafeAreaInsets();
    const c = {...defaultColors, ...colorsProp};
    const timerSeconds = config.timerSeconds ?? 5;

    const [countdown, setCountdown] = useState(timerSeconds);
    const [canClose, setCanClose] = useState(false);
    const closeOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) {
            setCountdown(timerSeconds);
            setCanClose(false);
            closeOpacity.setValue(0);
            return;
        }

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setCanClose(true);
                    Animated.timing(closeOpacity, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }).start();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [visible]);

    const handleBaixar = async () => {
        if (config.storeUrl) await Linking.openURL(config.storeUrl);
        onClose();
    };

    const handleNaoMostrar = async () => {
        await AsyncStorage.setItem(STORAGE_KEY_NAO_MOSTRAR, "true");
        onClose();
    };

    const gradientColors = config.gradientColors || ["#22C55E", "#16A34A"];

    // Full-media mode: video or image covers entire screen, tap to open store
    if (config.bannerVideo || config.bannerImg) {
        let VideoComponent: any = null;
        if (config.bannerVideo) {
            try {
                VideoComponent = require("expo-av").Video;
            } catch {}
        }

        return (
            <Modal visible={visible} animationType="fade" onRequestClose={canClose ? onClose : undefined}>
                <Pressable style={{flex: 1}} onPress={handleBaixar}>
                    {VideoComponent && config.bannerVideo ? (
                        <VideoComponent
                            source={{uri: config.bannerVideo}}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                            shouldPlay={visible}
                            isLooping
                            isMuted={false}
                        />
                    ) : config.bannerImg ? (
                        <Image source={{uri: config.bannerImg}} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : null}
                </Pressable>
                <View style={[styles.fullscreenTimerArea, {top: insets.top + 12}]}>
                    {!canClose ? (
                        <View style={styles.fullscreenTimerBadge}>
                            <Text style={styles.fullscreenTimerText}>{countdown}</Text>
                        </View>
                    ) : (
                        <Animated.View style={{opacity: closeOpacity}}>
                            <Pressable style={styles.fullscreenCloseBtn} onPress={onClose} hitSlop={8}>
                                <Text style={styles.fullscreenCloseBtnText}>✕</Text>
                            </Pressable>
                        </Animated.View>
                    )}
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={canClose ? onClose : undefined}>
            <View style={[styles.fullscreenContainer, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
                {/* Top area with gradient */}
                <LinearGradient
                    colors={gradientColors}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.fullscreenTop}>
                    <View style={styles.fullscreenIconContainer}>
                        <View style={[styles.iconContainer, {backgroundColor: c.iconContainerBackground, shadowColor: c.iconContainerShadow}]}>
                            <Image source={{uri: config.icon}} style={styles.iconImage} resizeMode="cover" />
                        </View>
                    </View>
                    <LinearGradient
                        colors={["transparent", c.modalBackground]}
                        start={{x: 0, y: 0.6}}
                        end={{x: 0, y: 1}}
                        style={StyleSheet.absoluteFillObject}
                    />
                </LinearGradient>

                {/* Timer / Close button */}
                <View style={[styles.fullscreenTimerArea, {top: insets.top + 12}]}>
                    {!canClose ? (
                        <View style={styles.fullscreenTimerBadge}>
                            <Text style={styles.fullscreenTimerText}>{countdown}</Text>
                        </View>
                    ) : (
                        <Animated.View style={{opacity: closeOpacity}}>
                            <Pressable style={styles.fullscreenCloseBtn} onPress={onClose} hitSlop={8}>
                                <Text style={styles.fullscreenCloseBtnText}>✕</Text>
                            </Pressable>
                        </Animated.View>
                    )}
                </View>

                {/* Content */}
                <View style={[styles.fullscreenContent, {backgroundColor: c.modalBackground}]}>
                    <Text style={[styles.fullscreenTitle, {color: c.titleText}]}>{processText(config.name, t)}</Text>
                    <Text style={[styles.fullscreenDescription, {color: c.descriptionText}]}>
                        {processText(config.description, t)}
                    </Text>

                    <Pressable
                        style={({pressed}) => [
                            styles.botaoPrincipal,
                            {backgroundColor: config.primaryColor},
                            pressed && styles.botaoPrincipalPressed,
                        ]}
                        onPress={handleBaixar}>
                        <Text style={[styles.botaoPrincipalText, {color: c.primaryButtonText}]}>
                            {resolveText(config.buttonText, "download", t)}
                        </Text>
                    </Pressable>

                    {config.showDontShowAgain && (
                        <Pressable
                            style={({pressed}) => [styles.botaoSecundario, pressed && styles.botaoSecundarioPressed]}
                            onPress={handleNaoMostrar}>
                            <Text style={[styles.botaoSecundarioText, {color: c.secondaryButtonText}]}>
                                {tr().dontShowAgain}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}

// ─── Notification Card (iOS-style notification) ─────────────────────────────

const DEFAULT_NOTIFICATION_BG = require("../assets/notification-bg-terrazzo.jpg");

function NotificationCardContent({visible, onClose, colors: colorsProp, t, config}: Props & {config: PromotionalConfig}) {
    const insets = useSafeAreaInsets();
    const c = {...defaultColors, ...colorsProp};
    const isTop = config.position === "top";
    const isCompact = config.notificationCompact !== false;
    const slideDistance = 400;
    const bodyHeight = config.bannerHeight ?? 200;

    const slideAnim = useRef(new Animated.Value(isTop ? -slideDistance : slideDistance)).current;
    const panY = useRef(new Animated.Value(0)).current;
    const expandAnim = useRef(new Animated.Value(isCompact ? 0 : 1)).current;
    const [expanded, setExpanded] = useState(!isCompact);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => (isTop ? g.dy < -10 : g.dy > 10),
            onPanResponderMove: (_, g) => {
                if (isTop ? g.dy < 0 : g.dy > 0) panY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                const threshold = isTop ? g.dy < -60 || g.vy < -0.5 : g.dy > 60 || g.vy > 0.5;
                if (threshold) {
                    Animated.timing(panY, {
                        toValue: isTop ? -slideDistance : slideDistance,
                        duration: 200,
                        useNativeDriver: false,
                    }).start(() => {
                        panY.setValue(0);
                        onClose();
                    });
                } else {
                    Animated.spring(panY, {toValue: 0, useNativeDriver: false}).start();
                }
            },
        }),
    ).current;

    useEffect(() => {
        if (visible) {
            expandAnim.setValue(isCompact ? 0 : 1);
            setExpanded(!isCompact);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: false,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            slideAnim.setValue(isTop ? -slideDistance : slideDistance);
        }
    }, [visible]);

    const handleExpand = () => {
        if (expanded) return;
        setExpanded(true);
        Animated.spring(expandAnim, {
            toValue: 1,
            useNativeDriver: false,
            tension: 50,
            friction: 10,
        }).start();
    };

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: isTop ? -slideDistance : slideDistance,
            duration: 200,
            useNativeDriver: false,
        }).start(() => onClose());
    };

    const handleBaixar = async () => {
        if (config.storeUrl) await Linking.openURL(config.storeUrl);
        handleClose();
    };

    const handleNaoMostrar = async () => {
        await AsyncStorage.setItem(STORAGE_KEY_NAO_MOSTRAR, "true");
        handleClose();
    };

    const shadowStyle = buildShadowStyle(config.shadow ?? {color: "#000", offsetY: 8, opacity: 0.2, radius: 16, elevation: 12});
    const bgSource = config.bannerImg ? {uri: config.bannerImg} : DEFAULT_NOTIFICATION_BG;

    const animatedBodyHeight = expandAnim.interpolate({inputRange: [0, 1], outputRange: [0, bodyHeight]});
    const animatedSeparatorOpacity = expandAnim;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <Pressable style={styles.cardOverlay} onPress={handleClose} />
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.notifContainer,
                    shadowStyle,
                    isTop
                        ? {top: 0, marginTop: insets.top + 8}
                        : {bottom: 0, marginBottom: insets.bottom + 8},
                    {transform: [{translateY: Animated.add(slideAnim, panY)}]},
                ]}>
                {/* ── Header (notification bar) ── */}
                <Pressable style={styles.notifHeader} onPress={!expanded ? handleExpand : undefined}>
                    <Image source={{uri: config.icon}} style={styles.notifHeaderIcon} resizeMode="cover" />
                    <View style={styles.notifHeaderTextArea}>
                        <Text style={[styles.notifHeaderTitle, {color: c.titleText}]} numberOfLines={1}>
                            {processText(config.notificationTitle || config.name, t)}
                        </Text>
                        <Text style={[styles.notifHeaderSubtitle, {color: c.descriptionText}]} numberOfLines={2}>
                            {processText(config.notificationBody || config.description, t)}
                        </Text>
                    </View>
                    <Text style={styles.notifHeaderTime}>{tr().now}</Text>
                </Pressable>

                {/* ── Separator ── */}
                <Animated.View style={[styles.notifSeparator, {opacity: animatedSeparatorOpacity}]} />

                {/* ── Body (image background + content) ── */}
                <Animated.View style={[styles.notifBody, {height: animatedBodyHeight}]}>
                    <Image source={bgSource} style={[StyleSheet.absoluteFillObject]} resizeMode="cover" />
                    <LinearGradient
                        colors={["transparent", "rgba(255,255,255,0.85)"]}
                        start={{x: 0, y: 0.15}}
                        end={{x: 0, y: 1}}
                        style={[StyleSheet.absoluteFillObject]}
                    />
                    <View style={styles.notifBodyInner}>
                        <View style={styles.notifBodyTextArea}>
                            <Text style={[styles.notifBodyTitle, {color: c.titleText}]} numberOfLines={3}>
                                {processText(config.name, t)}
                            </Text>
                            {config.description ? (
                                <Text style={[styles.notifBodyDescription, {color: c.descriptionText}]} numberOfLines={2}>
                                    {processText(config.description, t)}
                                </Text>
                            ) : null}
                            <Pressable
                                style={({pressed}) => [styles.notifBodyCta, {backgroundColor: config.primaryColor}, pressed && {opacity: 0.8}]}
                                onPress={handleBaixar}>
                                <Text style={styles.notifBodyCtaText} numberOfLines={1}>
                                    {resolveText(config.buttonText, "download", t)}
                                </Text>
                            </Pressable>
                        </View>
                        <Pressable style={styles.notifBodyIconArea} onPress={handleBaixar}>
                            <View style={styles.notifBodyIconContainer}>
                                <Image source={{uri: config.icon}} style={styles.notifBodyIcon} resizeMode="cover" />
                            </View>
                            <Text style={[styles.notifBodyIconLabel, {color: c.descriptionText}]} numberOfLines={1}>
                                {processText(config.name, t)}
                            </Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

// ─── PromotionalBanner (inline View, not a Modal) ──────────────────────────

type BannerProps = {
    colors?: Partial<ModalColors>;
    t?: (key: string) => string;
    style?: ViewStyle;
    size?: "small" | "large";
    showClose?: boolean;
    height?: number;
};

export function PromotionalBanner({colors: colorsProp, t, style, size = "small", showClose = true, height}: BannerProps) {
    const c = {...defaultColors, ...colorsProp};
    const [dismissed, setDismissed] = useState(false);
    const [hidden, setHidden] = useState(false);

    const config = getConfig();

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY_NAO_MOSTRAR).then((val) => {
            if (val === "true") setHidden(true);
        });
    }, []);

    if (!config?.enabled || config.type !== "banner" || dismissed || hidden) return null;

    const handlePress = async () => {
        if (config.storeUrl) await Linking.openURL(config.storeUrl);
    };

    const handleDismiss = async () => {
        if (config.showDontShowAgain) {
            await AsyncStorage.setItem(STORAGE_KEY_NAO_MOSTRAR, "true");
        }
        setDismissed(true);
    };

    if (size === "large") {
        const hasBannerImg = !!config.bannerImg;
        const shadowStyle = buildShadowStyle(config.shadow ?? {color: "#000", offsetY: 4, opacity: 0.15, radius: 8, elevation: 6});

        return (
            <View style={[styles.bannerLargeWrapper, shadowStyle, {height: height ?? config.bannerHeight ?? 200}, style]}>
                {hasBannerImg ? (
                    <Image source={{uri: config.bannerImg}} style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]} resizeMode="cover" />
                ) : (
                    <LinearGradient
                        colors={config.gradientColors || ["#22C55E", "#16A34A"]}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]}
                    />
                )}
                <LinearGradient
                    colors={["transparent", "rgba(255,255,255,0.9)"]}
                    start={{x: 0, y: 0.25}}
                    end={{x: 0, y: 1}}
                    style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]}
                />
                {showClose && (
                    <Pressable style={styles.bannerLargeCloseBtn} onPress={handleDismiss} hitSlop={8}>
                        <Text style={styles.cardCloseBtnText}>✕</Text>
                    </Pressable>
                )}
                <Pressable style={styles.bannerLargeInner} onPress={handlePress}>
                    <View style={styles.bannerLargeBody}>
                        <View style={styles.bannerLargeTextArea}>
                            <Text style={[styles.bannerLargeTitle, {color: c.titleText}]} numberOfLines={3}>
                                {processText(config.name, t)}
                            </Text>
                            {config.description ? (
                                <Text style={[styles.bannerLargeDescription, {color: c.descriptionText}]} numberOfLines={2}>
                                    {processText(config.description, t)}
                                </Text>
                            ) : null}
                            <View style={[styles.bannerLargeCta, {backgroundColor: config.primaryColor}]}>
                                <Text style={styles.bannerLargeCtaText} numberOfLines={1}>
                                    {resolveText(config.buttonText, "download", t)}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.bannerLargeIconArea}>
                            <View style={styles.bannerLargeIconContainer}>
                                <Image source={{uri: config.icon}} style={styles.bannerLargeIcon} resizeMode="cover" />
                            </View>
                            <Text style={[styles.bannerLargeIconLabel, {color: c.descriptionText}]} numberOfLines={1}>
                                {processText(config.name, t)}
                            </Text>
                        </View>
                    </View>
                </Pressable>
            </View>
        );
    }

    return (
        <Pressable style={[styles.bannerWrapper, {borderColor: config.primaryColor + "30"}, style]} onPress={handlePress}>
            <Image source={{uri: config.icon}} style={styles.bannerIcon} resizeMode="cover" />
            <View style={styles.bannerTextArea}>
                <Text style={[styles.bannerTitle, {color: c.titleText}]} numberOfLines={1}>
                    {processText(config.name, t)}
                </Text>
                <Text style={[styles.bannerDescription, {color: c.descriptionText}]} numberOfLines={1}>
                    {processText(config.description, t)}
                </Text>
            </View>
            <Pressable
                style={({pressed}) => [
                    styles.bannerCta,
                    {backgroundColor: config.primaryColor},
                    pressed && {opacity: 0.8},
                ]}
                onPress={handlePress}>
                <Text style={[styles.bannerCtaText, {color: c.primaryButtonText}]}>
                    {resolveText(config.buttonText, "download", t)}
                </Text>
            </Pressable>
            {showClose && (
                <Pressable style={styles.bannerCloseBtn} onPress={handleDismiss} hitSlop={8}>
                    <Text style={styles.bannerCloseBtnText}>✕</Text>
                </Pressable>
            )}
        </Pressable>
    );
}

// ─── Main Component (default export) ────────────────────────────────────────

export default function PromotionalContent({visible, onClose, colors, t}: Props) {
    const config = getConfig();
    if (!config) return null;

    const type = config.type || "bottom-sheet";

    switch (type) {
        case "card-banner-bottom":
            return <CardBannerBottomContent visible={visible} onClose={onClose} colors={colors} t={t} config={config} />;
        case "notification":
            return <NotificationCardContent visible={visible} onClose={onClose} colors={colors} t={t} config={config} />;
        case "fullscreen":
            return <FullscreenContent visible={visible} onClose={onClose} colors={colors} t={t} config={config} />;
        case "bottom-sheet":
        default:
            return <BottomSheetContent visible={visible} onClose={onClose} colors={colors} t={t} config={config} />;
    }
}

/** @deprecated Use PromotionalContent instead */
export const ModalPromotionalContent = PromotionalContent;

// ─── Hooks ──────────────────────────────────────────────────────────────────

export const usePromotional = (currentScreen?: string) => {
    const [visible, setVisible] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = async () => {
        const config = getConfig();
        if (!config?.enabled) return;
        if (config.type === "banner") return;

        // targetScreens check
        if (config.targetScreens?.length && currentScreen && !config.targetScreens.includes(currentScreen)) return;

        // "Não mostrar novamente" check
        const naoMostrar = await AsyncStorage.getItem(STORAGE_KEY_NAO_MOSTRAR);
        if (naoMostrar === "true") return;

        // Increment visit count (always, even if we don't show)
        const countStr = await AsyncStorage.getItem(STORAGE_KEY_VISIT_COUNT);
        const visit = (countStr ? parseInt(countStr, 10) : 0) + 1;
        await AsyncStorage.setItem(STORAGE_KEY_VISIT_COUNT, String(visit));

        // nthImpression check (CSS nth-child syntax: "2n", "1+2n", "3", etc.)
        if (config.nthImpression) {
            const {a, b} = parseNthExpression(config.nthImpression);
            if (!matchesNth(visit, a, b)) return;
        }

        if (timerRef.current) clearTimeout(timerRef.current);
        const delay = config.delayMs ?? 5000;
        timerRef.current = setTimeout(() => {
            setVisible(true);
        }, delay);
    };

    const hide = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    };

    // Auto-trigger when currentScreen changes and matches targetScreens
    React.useEffect(() => {
        if (!currentScreen) return;
        const config = getConfig();
        if (!config?.enabled || config.type === "banner") return;
        if (config.targetScreens?.length && !config.targetScreens.includes(currentScreen)) {
            if (visible) hide();
            return;
        }
        show();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentScreen]);

    return {visible, show, hide};
};

/** @deprecated Use usePromotional instead */
export const usePromotionalModal = usePromotional;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // Bottom sheet styles
    container: {
        flex: 1,
        justifyContent: "flex-end",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    overlayPressable: {
        flex: 1,
    },
    modalContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
    },
    bannerContainer: {
        width: "100%",
        overflow: "hidden",
    },
    bannerImage: {
        width: "100%",
        height: "100%",
    },
    gradientBackground: {
        height: 200,
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 24,
        overflow: "hidden",
    },
    fadeGradient: {
        height: 80,
        left: 0,
        right: 0,
        bottom: 0,
        position: "absolute",
    },
    circlesContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    circleGradient: {
        position: "absolute",
        borderRadius: 9999,
        alignItems: "center",
        justifyContent: "center",
    },
    circle1: {
        width: CIRCLE_SIZES.one,
        height: CIRCLE_SIZES.one,
    },
    circle2: {
        width: CIRCLE_SIZES.two,
        height: CIRCLE_SIZES.two,
    },
    circle3: {
        width: CIRCLE_SIZES.three,
        height: CIRCLE_SIZES.three,
    },
    circle4: {
        width: CIRCLE_SIZES.four,
        height: CIRCLE_SIZES.four,
    },
    handleContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingVertical: 12,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    iconWrapper: {
        alignItems: "center",
        justifyContent: "center",
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        overflow: "hidden",
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    iconImage: {
        width: "100%",
        height: "100%",
    },
    contentContainer: {
        paddingHorizontal: 32,
        paddingTop: 32,
        alignItems: "center",
    },
    titulo: {
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 8,
    },
    descricao: {
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 32,
    },
    botaoPrincipal: {
        width: "100%",
        paddingVertical: 16,
        borderRadius: 24,
        alignItems: "center",
    },
    botaoPrincipalPressed: {
        opacity: 0.9,
        transform: [{scale: 0.98}],
    },
    botaoPrincipalText: {
        fontSize: 16,
        fontWeight: "600",
    },
    botaoSecundario: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    botaoSecundarioPressed: {
        opacity: 0.7,
    },
    botaoSecundarioText: {
        fontSize: 15,
        fontWeight: "500",
    },

    // Card banner bottom styles
    cardOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.2)",
    },
    cardContainer: {
        position: "absolute",
        bottom: 0,
        left: 16,
        right: 16,
        borderRadius: 16,
        overflow: "hidden",
    },
    cardInner: {
        padding: 16,
    },
    cardCloseBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "rgba(0,0,0,0.3)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    cardCloseBtnText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
    },
    cardBody: {
        flexDirection: "row",
        alignItems: "center",
    },
    cardTextArea: {
        flex: 1,
        marginRight: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#FFFFFF",
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 13,
        color: "rgba(255,255,255,0.85)",
        lineHeight: 18,
        marginBottom: 10,
    },
    cardActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    cardCta: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 14,
    },
    cardCtaText: {
        fontSize: 13,
        fontWeight: "600",
    },
    cardDontShow: {
        fontSize: 11,
        color: "rgba(255,255,255,0.7)",
    },
    cardIcon: {
        width: 60,
        height: 60,
        borderRadius: 14,
    },

    // Card banner bottom — image-based layout
    cardImgInner: {
        flex: 1,
        padding: 20,
        justifyContent: "flex-end",
    },
    cardImgBody: {
        flexDirection: "row",
        alignItems: "flex-end",
    },
    cardImgTextArea: {
        flex: 1,
        marginRight: 16,
    },
    cardImgTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: "#1F2937",
        lineHeight: 28,
        marginBottom: 10,
    },
    cardImgCta: {
        alignSelf: "flex-start",
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    cardImgCtaText: {
        fontSize: 11,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    cardImgIconArea: {
        alignItems: "center",
    },
    cardImgIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    cardImgIcon: {
        width: 56,
        height: 56,
        borderRadius: 14,
    },
    cardImgIconLabel: {
        fontSize: 11,
        color: "#6B7280",
        fontWeight: "500",
        marginTop: 6,
        textAlign: "center",
        maxWidth: 100,
    },

    // Fullscreen styles
    fullscreenContainer: {
        flex: 1,
    },
    fullscreenTop: {
        height: SCREEN_HEIGHT * 0.4,
        alignItems: "center",
        justifyContent: "center",
    },
    fullscreenIconContainer: {
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    fullscreenTimerArea: {
        position: "absolute",
        right: 16,
        zIndex: 10,
    },
    fullscreenTimerBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.4)",
        alignItems: "center",
        justifyContent: "center",
    },
    fullscreenTimerText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    fullscreenCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.4)",
        alignItems: "center",
        justifyContent: "center",
    },
    fullscreenCloseBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    fullscreenContent: {
        flex: 1,
        paddingHorizontal: 32,
        paddingTop: 24,
        alignItems: "center",
    },
    fullscreenTitle: {
        fontSize: 26,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 12,
    },
    fullscreenDescription: {
        fontSize: 16,
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 32,
    },

    // Inline banner styles
    bannerWrapper: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: "#FFFFFF",
    },
    bannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        marginRight: 10,
    },
    bannerTextArea: {
        flex: 1,
        marginRight: 8,
    },
    bannerTitle: {
        fontSize: 14,
        fontWeight: "600",
    },
    bannerDescription: {
        fontSize: 12,
        marginTop: 2,
    },
    bannerCta: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 14,
    },
    bannerCtaText: {
        fontSize: 12,
        fontWeight: "600",
    },
    bannerCloseBtn: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "rgba(0,0,0,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    bannerCloseBtnText: {
        fontSize: 10,
        color: "#6B7280",
        fontWeight: "700",
    },

    // Inline banner large styles
    bannerLargeWrapper: {
        borderRadius: 16,
        overflow: "hidden",
    },
    bannerLargeCloseBtn: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "rgba(0,0,0,0.3)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    bannerLargeInner: {
        flex: 1,
        padding: 20,
        justifyContent: "flex-end",
    },
    bannerLargeBody: {
        flexDirection: "row",
        alignItems: "flex-end",
    },
    bannerLargeTextArea: {
        flex: 1,
        marginRight: 16,
    },
    bannerLargeTitle: {
        fontSize: 22,
        fontWeight: "800",
        lineHeight: 28,
        marginBottom: 4,
    },
    bannerLargeDescription: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 10,
    },
    bannerLargeCta: {
        alignSelf: "flex-start",
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    bannerLargeCtaText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    bannerLargeIconArea: {
        alignItems: "center",
    },
    bannerLargeIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    bannerLargeIcon: {
        width: 56,
        height: 56,
        borderRadius: 14,
    },
    bannerLargeIconLabel: {
        fontSize: 11,
        fontWeight: "500",
        marginTop: 6,
        textAlign: "center",
        maxWidth: 100,
    },

    // Notification card styles
    notifContainer: {
        position: "absolute",
        left: 12,
        right: 12,
        backgroundColor: "#FFFFFF",
        borderRadius: 28,
        overflow: "hidden",
    },
    notifHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 14,
        paddingBottom: 12,
    },
    notifHeaderIcon: {
        width: 26,
        height: 26,
        borderRadius: 7,
        marginRight: 10,
        marginTop: 1,
    },
    notifHeaderTextArea: {
        flex: 1,
        marginRight: 8,
    },
    notifHeaderTitle: {
        fontSize: 14,
        fontWeight: "600",
        lineHeight: 18,
    },
    notifHeaderSubtitle: {
        fontSize: 13,
        fontWeight: "400",
        lineHeight: 17,
        marginTop: 2,
    },
    notifHeaderTime: {
        fontSize: 12,
        fontWeight: "400",
        color: "#A0A0A0",
        marginTop: 2,
    },
    notifSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "rgba(0,0,0,0.08)",
    },
    notifBody: {
        overflow: "hidden",
    },
    notifBodyInner: {
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 20,
    },
    notifBodyTextArea: {
        flex: 1,
        marginRight: 16,
    },
    notifBodyTitle: {
        fontSize: 22,
        fontWeight: "800",
        lineHeight: 27,
        marginBottom: 4,
    },
    notifBodyDescription: {
        fontSize: 13,
        lineHeight: 17,
        marginBottom: 10,
    },
    notifBodyCta: {
        alignSelf: "flex-start",
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 6,
    },
    notifBodyCtaText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    notifBodyIconArea: {
        alignItems: "center",
    },
    notifBodyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    notifBodyIcon: {
        width: 64,
        height: 64,
        borderRadius: 16,
    },
    notifBodyIconLabel: {
        fontSize: 12,
        fontWeight: "500",
        marginTop: 6,
        textAlign: "center",
        maxWidth: 100,
    },
});
