import AsyncStorage from "@react-native-async-storage/async-storage";
import {LinearGradient} from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, {useEffect, useRef, useState} from "react";
import {Animated, Dimensions, Image, Modal, PanResponder, Pressable, StyleSheet, Text, View, ViewStyle} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import type {PromotionalConfig} from "./types";

const STORAGE_KEY_NAO_MOSTRAR = "@nao_mostrar_app_promocionals";

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

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.65;

const CIRCLE_SIZES = {
    one: SCREEN_WIDTH * 0.4,
    two: SCREEN_WIDTH * 0.6,
    three: SCREEN_WIDTH * 0.8,
    four: SCREEN_WIDTH * 1.0,
};

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
                                {processText(config.buttonText, t)}
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
                                    Não mostrar novamente
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

    const slideAnim = useRef(new Animated.Value(200)).current;
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
                        toValue: 200,
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
            slideAnim.setValue(200);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: 200,
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

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <Pressable style={styles.cardOverlay} onPress={handleClose} />
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.cardContainer,
                    {
                        marginBottom: insets.bottom + 8,
                        transform: [{translateY: Animated.add(slideAnim, panY)}],
                    },
                ]}>
                {config.bannerImg ? (
                    <Image
                        source={{uri: config.bannerImg}}
                        style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]}
                        resizeMode="cover"
                    />
                ) : (
                    <LinearGradient
                        colors={gradientColors}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={[StyleSheet.absoluteFillObject, {borderRadius: 16}]}
                    />
                )}
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
                                        {processText(config.buttonText, t)}
                                    </Text>
                                </Pressable>
                                {config.showDontShowAgain && (
                                    <Pressable onPress={handleNaoMostrar} hitSlop={4}>
                                        <Text style={styles.cardDontShow}>Não mostrar</Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                        <Image source={{uri: config.icon}} style={styles.cardIcon} resizeMode="cover" />
                    </View>
                </View>
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

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={canClose ? onClose : undefined}>
            <View style={[styles.fullscreenContainer, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
                {/* Top area with gradient/banner */}
                {config.bannerImg ? (
                    <View style={styles.fullscreenTop}>
                        <Image source={{uri: config.bannerImg}} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        <LinearGradient
                            colors={["transparent", c.modalBackground]}
                            start={{x: 0, y: 0.6}}
                            end={{x: 0, y: 1}}
                            style={StyleSheet.absoluteFillObject}
                        />
                    </View>
                ) : (
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
                )}

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
                            {processText(config.buttonText, t)}
                        </Text>
                    </Pressable>

                    {config.showDontShowAgain && (
                        <Pressable
                            style={({pressed}) => [styles.botaoSecundario, pressed && styles.botaoSecundarioPressed]}
                            onPress={handleNaoMostrar}>
                            <Text style={[styles.botaoSecundarioText, {color: c.secondaryButtonText}]}>
                                Não mostrar novamente
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}

// ─── PromotionalBanner (inline View, not a Modal) ──────────────────────────

type BannerProps = {
    colors?: Partial<ModalColors>;
    t?: (key: string) => string;
    style?: ViewStyle;
};

export function PromotionalBanner({colors: colorsProp, t, style}: BannerProps) {
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
                    {processText(config.buttonText, t)}
                </Text>
            </Pressable>
            <Pressable style={styles.bannerCloseBtn} onPress={handleDismiss} hitSlop={8}>
                <Text style={styles.bannerCloseBtnText}>✕</Text>
            </Pressable>
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

export const usePromotional = () => {
    const [visible, setVisible] = React.useState(false);

    const show = async () => {
        const config = getConfig();
        if (!config?.enabled) return;
        // banner type is inline, not modal — skip
        if (config.type === "banner") return;

        const naoMostrar = await AsyncStorage.getItem(STORAGE_KEY_NAO_MOSTRAR);
        if (naoMostrar === "true") return;

        const delay = config.delayMs ?? 5000;
        setTimeout(() => setVisible(true), delay);
    };

    const hide = () => setVisible(false);

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
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.15,
        shadowRadius: 8,
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
});
