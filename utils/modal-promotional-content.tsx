import AsyncStorage from "@react-native-async-storage/async-storage";
import {Image} from "expo-image";
import {LinearGradient} from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, {useEffect, useRef} from "react";
import {Animated, Dimensions, Modal, PanResponder, Pressable, StyleSheet, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

const STORAGE_KEY_NAO_MOSTRAR = "@nao_mostrar_app_promocionals";

export type AppModalConfig = {
    enabled: boolean;
    icon: string;
    name: string;
    description: string;
    buttonText: string;
    gradientColors: [string, string];
    primaryColor: string;
    storeUrl: string;
    delayMs?: number;
    bannerImg?: string;
    bannerHeight?: number;
    showDontShowAgain?: boolean;
};

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

export default function ModalPromotionalContent({visible, onClose, colors, t}: Props) {
    const insets = useSafeAreaInsets();
    const c = {...defaultColors, ...colors};

    const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;
    const panY = useRef(new Animated.Value(0)).current;

    const config = (global as any).remoteConfigs?.appmodal as AppModalConfig | undefined;

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
        if (config?.storeUrl) {
            await Linking.openURL(config.storeUrl);
        }
        handleClose();
    };

    const handleNaoMostrar = async () => {
        await AsyncStorage.setItem(STORAGE_KEY_NAO_MOSTRAR, "true");
        handleClose();
    };

    if (!config) return null;

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
                            <Image source={{uri: config.bannerImg}} style={styles.bannerImage} contentFit="cover" />
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
                                                contentFit="cover"
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

export const usePromotionalModal = () => {
    const [visible, setVisible] = React.useState(false);

    const show = async () => {
        const config = (global as any).remoteConfigs?.appmodal as AppModalConfig | undefined;
        if (!config?.enabled) return;

        const naoMostrar = await AsyncStorage.getItem(STORAGE_KEY_NAO_MOSTRAR);
        if (naoMostrar === "true") return;

        const delay = config.delayMs ?? 5000;
        setTimeout(() => setVisible(true), delay);
    };

    const hide = () => setVisible(false);

    return {visible, show, hide};
};

const styles = StyleSheet.create({
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
});
