import React, {useEffect, useRef} from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    Animated,
    Pressable,
    Alert,
    DeviceEventEmitter
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import {getLocales} from "expo-localization";

// Sistema de eventos para mostrar o popup de review
export class AskForReviewEvents {
    private static eventName = "showReviewPopup";
    private static globalTexts: AskForReviewTexts | null = null;
    private static globalImage: any = null;

    static showPopup() {
        DeviceEventEmitter.emit(this.eventName);
    }

    static onShowPopup(callback: () => void) {
        const subscription = DeviceEventEmitter.addListener(this.eventName, callback);
        return () => subscription.remove();
    }

    static setTexts(texts: AskForReviewTexts) {
        this.globalTexts = texts;
    }

    static getTexts(): AskForReviewTexts | null {
        return this.globalTexts;
    }

    static setImage(image: any) {
        this.globalImage = image;
    }

    static getImage(): any {
        return this.globalImage;
    }
}

interface AskForReviewTexts {
    title: string;
    message: string;
    notNow: string;
    rateNow: string;
}

export async function askForReview(texts?: AskForReviewTexts, image?: any) {
    try {
        const hasRated = await AsyncStorage.getItem("@user_rated");
        if (hasRated) return; // já avaliou, não mostra de novo

        // Store image globally if provided
        if (image) {
            AskForReviewEvents.setImage(image);
        }

        const reviewType = global.remoteConfigUtils?.review_type || "store-review";
        console.log("reviewType", reviewType);
        if (reviewType === "store-review") {
            await StoreReview.requestReview();
        } else if (reviewType === "popup") {
            AskForReviewEvents.showPopup();
        } else {
            // Use provided texts, or fallback to global texts, or return if neither exists
            const finalTexts = texts || AskForReviewEvents.getTexts();
            if (finalTexts) {
                Alert.alert(finalTexts.title, finalTexts.message, [
                    {text: finalTexts.notNow, style: "cancel"},
                    { text: finalTexts.rateNow,
                        onPress: async () => {
                            await AsyncStorage.setItem("@user_rated", "true");
                            await StoreReview.requestReview();
                        },
                    },
                ]);
            }
        }
    } catch (err) {
        // console.log("Error asking for review:", err);
    }
}

// Função auxiliar para marcar como avaliado e fazer review
export async function handleReviewSubmission() {
    try {
        await AsyncStorage.setItem("@user_rated", "true");
        await StoreReview.requestReview();
    } catch (err) {
        // console.log("Error submitting review:", err);
    }
}

// ==================== AskForReviewOverlay Component ====================

interface ColorProps {
    primary: string;
    text: string;
    textSecondary: string;
    border: string;
    systemBackground: string;
}

interface AskForReviewOverlayProps {
    visible: boolean;
    onClose: () => void;
    image?: any; // Optional image source - uses default if not provided
    delay?: number; // Delay in milliseconds to disable "not now" button
    colors?: ColorProps;
    texts?: AskForReviewTexts; // Now optional, will use translations if not provided
    title?: string;
    message?: string;
    rateNowText?: string;
    notNowText?: string;
}

// Default review banner image
const DEFAULT_REVIEW_IMAGE = require("../assets/banner-star.jpg");

// Default translations
const TRANSLATIONS: Record<string, {title: string; message: string; rateNow: string; notNow: string}> = {
    en: {
        title: "Enjoying the app?",
        message: "Rate us on the store!",
        rateNow: "Rate Now",
        notNow: "Not Now",
    },
    pt: {
        title: "Gostando do app?",
        message: "Avalie-nos na loja!",
        rateNow: "Avaliar Agora",
        notNow: "Agora Não",
    },
    es: {
        title: "¿Disfrutando la aplicación?",
        message: "¡Califícanos en la tienda!",
        rateNow: "Calificar Ahora",
        notNow: "Ahora No",
    },
    fr: {
        title: "Vous aimez l'application ?",
        message: "Notez-nous sur le store !",
        rateNow: "Noter Maintenant",
        notNow: "Pas Maintenant",
    },
    de: {
        title: "Gefällt dir die App?",
        message: "Bewerte uns im Store!",
        rateNow: "Jetzt Bewerten",
        notNow: "Nicht Jetzt",
    },
    it: {
        title: "Ti piace l'app?",
        message: "Valutaci sullo store!",
        rateNow: "Valuta Ora",
        notNow: "Non Ora",
    },
    ja: {
        title: "アプリを楽しんでいますか？",
        message: "ストアで評価してください！",
        rateNow: "今すぐ評価",
        notNow: "今はしない",
    },
    ko: {
        title: "앱이 마음에 드시나요?",
        message: "스토어에서 평가해 주세요!",
        rateNow: "지금 평가",
        notNow: "나중에",
    },
    zh: {
        title: "喜欢这个应用吗？",
        message: "在商店给我们评分！",
        rateNow: "立即评分",
        notNow: "暂不评分",
    },
    ru: {
        title: "Нравится приложение?",
        message: "Оцените нас в магазине!",
        rateNow: "Оценить Сейчас",
        notNow: "Не Сейчас",
    },
    ar: {
        title: "هل تستمتع بالتطبيق؟",
        message: "قيمنا في المتجر!",
        rateNow: "قيم الآن",
        notNow: "ليس الآن",
    },
    hi: {
        title: "ऐप पसंद आ रहा है?",
        message: "स्टोर पर हमें रेट करें!",
        rateNow: "अभी रेट करें",
        notNow: "अभी नहीं",
    },
    nl: {
        title: "Geniet je van de app?",
        message: "Beoordeel ons in de store!",
        rateNow: "Nu Beoordelen",
        notNow: "Niet Nu",
    },
    pl: {
        title: "Podoba ci się aplikacja?",
        message: "Oceń nas w sklepie!",
        rateNow: "Oceń Teraz",
        notNow: "Nie Teraz",
    },
    tr: {
        title: "Uygulamayı beğendiniz mi?",
        message: "Bizi mağazada değerlendirin!",
        rateNow: "Şimdi Değerlendir",
        notNow: "Şimdi Değil",
    },
    sv: {
        title: "Gillar du appen?",
        message: "Betygsätt oss i butiken!",
        rateNow: "Betygsätt Nu",
        notNow: "Inte Nu",
    },
    da: {
        title: "Kan du lide appen?",
        message: "Bedøm os i butikken!",
        rateNow: "Bedøm Nu",
        notNow: "Ikke Nu",
    },
    fi: {
        title: "Pidätkö sovelluksesta?",
        message: "Arvostele meidät kaupassa!",
        rateNow: "Arvostele Nyt",
        notNow: "Ei Nyt",
    },
    no: {
        title: "Liker du appen?",
        message: "Vurder oss i butikken!",
        rateNow: "Vurder Nå",
        notNow: "Ikke Nå",
    },
    cs: {
        title: "Líbí se vám aplikace?",
        message: "Ohodnoťte nás v obchodě!",
        rateNow: "Ohodnotit Nyní",
        notNow: "Teď Ne",
    },
    el: {
        title: "Σας αρέσει η εφαρμογή;",
        message: "Βαθμολογήστε μας στο κατάστημα!",
        rateNow: "Βαθμολογήστε Τώρα",
        notNow: "Όχι Τώρα",
    },
    he: {
        title: "נהנה מהאפליקציה?",
        message: "דרג אותנו בחנות!",
        rateNow: "דרג עכשיו",
        notNow: "לא עכשיו",
    },
    th: {
        title: "ชอบแอปนี้ไหม?",
        message: "ให้คะแนนเราในร้านค้า!",
        rateNow: "ให้คะแนนตอนนี้",
        notNow: "ไว้ทีหลัง",
    },
    vi: {
        title: "Bạn thích ứng dụng này?",
        message: "Đánh giá chúng tôi trên cửa hàng!",
        rateNow: "Đánh Giá Ngay",
        notNow: "Để Sau",
    },
    id: {
        title: "Menikmati aplikasinya?",
        message: "Beri kami nilai di toko!",
        rateNow: "Nilai Sekarang",
        notNow: "Nanti Saja",
    },
    ms: {
        title: "Seronok dengan aplikasi ini?",
        message: "Nilai kami di kedai!",
        rateNow: "Nilai Sekarang",
        notNow: "Bukan Sekarang",
    },
    ro: {
        title: "Îți place aplicația?",
        message: "Evaluează-ne în magazin!",
        rateNow: "Evaluează Acum",
        notNow: "Nu Acum",
    },
    uk: {
        title: "Подобається додаток?",
        message: "Оцініть нас у магазині!",
        rateNow: "Оцінити Зараз",
        notNow: "Не Зараз",
    },
    hu: {
        title: "Tetszik az alkalmazás?",
        message: "Értékelj minket az áruházban!",
        rateNow: "Értékelés Most",
        notNow: "Most Nem",
    },
    sk: {
        title: "Páči sa vám aplikácia?",
        message: "Ohodnoťte nás v obchode!",
        rateNow: "Ohodnotiť Teraz",
        notNow: "Teraz Nie",
    },
    bg: {
        title: "Харесва ли ви приложението?",
        message: "Оценете ни в магазина!",
        rateNow: "Оценете Сега",
        notNow: "Не Сега",
    },
};

const getDefaultTranslations = () => {
    const locales = getLocales();
    const locale = locales[0]?.languageCode || "en";
    return TRANSLATIONS[locale] || TRANSLATIONS.en;
}

// Default colors for when colors prop is not provided
const DEFAULT_COLORS: ColorProps = {
    primary: '#007AFF',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    systemBackground: '#FFFFFF'
};

const AskForReviewOverlay: React.FC<AskForReviewOverlayProps> = ({
    visible,
    onClose,
    image,
    delay = 0,
    colors,
    texts,
    title,
    message,
    rateNowText,
    notNowText,
}) => {
    const backdrop = useRef(new Animated.Value(0)).current;
    const cardScale = useRef(new Animated.Value(0.95)).current;
    const cardTranslateY = useRef(new Animated.Value(60)).current;
    const cardRadius = useRef(new Animated.Value(50)).current;
    const [isNotNowDisabled, setIsNotNowDisabled] = React.useState(false);
    const [remainingTime, setRemainingTime] = React.useState(0);

    // Use provided colors or fall back to defaults
    const displayColors = colors || DEFAULT_COLORS;

    // Use provided image or default
    const displayImage = image || DEFAULT_REVIEW_IMAGE;

    // Store texts and image globally when component mounts
    useEffect(() => {
        if (texts) {
            AskForReviewEvents.setTexts(texts);
        }
        if (displayImage) {
            AskForReviewEvents.setImage(displayImage);
        }
    }, [texts, displayImage]);

    useEffect(() => {
        if (visible) {
            backdrop.setValue(0);
            cardScale.setValue(0.95);
            cardTranslateY.setValue(60);
            cardRadius.setValue(220);
            Animated.parallel([
                Animated.timing(backdrop, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(cardScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    friction: 7,
                    tension: 90,
                }),
                Animated.spring(cardTranslateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    friction: 8,
                    tension: 90,
                }),
                Animated.timing(cardRadius, {
                    toValue: 24,
                    duration: 540,
                    useNativeDriver: false,
                }),
            ]).start();

            // Start the delay timer if review_type_delay is set (delay is in ms)
            if (delay > 0) {
                const delaySec = Math.ceil(delay / 1000);
                setIsNotNowDisabled(true);
                setRemainingTime(delaySec);
            }
        } else {
            // Reset states when not visible
            setIsNotNowDisabled(false);
            setRemainingTime(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // Timer countdown effect
    useEffect(() => {
        if (isNotNowDisabled && remainingTime > 0) {
            const timer = setTimeout(() => {
                setRemainingTime(remainingTime - 1);
                if (remainingTime - 1 <= 0) {
                    setIsNotNowDisabled(false);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isNotNowDisabled, remainingTime]);

    const animateOut = (cb: () => void) => {
        Animated.parallel([
            Animated.timing(backdrop, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(cardRadius, {
                toValue: 40,
                duration: 180,
                useNativeDriver: false,
            }),
            Animated.timing(cardScale, {
                toValue: 0.96,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(cardTranslateY, {
                toValue: 60,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(() => {
            cb();
        });
    };

    const handleRateNow = async () => {
        animateOut(async () => {
            onClose();
            await handleReviewSubmission();
        });
    };

    const handleLater = () => {
        if (!isNotNowDisabled) {
            animateOut(onClose);
        }
    };

    if (!visible) return null;

    const defaultTexts = getDefaultTranslations();
    // Use props texts if provided, otherwise use individual props, otherwise use defaults
    const displayTitle = title || texts?.title || defaultTexts.title;
    const displayMessage = message || texts?.message || defaultTexts.message;
    const displayRateNow = rateNowText || texts?.rateNow || defaultTexts.rateNow;
    const displayNotNow = notNowText || texts?.notNow || defaultTexts.notNow;

    return (
        <Animated.View style={[styles.overlayContainer, {opacity: backdrop}]} pointerEvents={visible ? "auto" : "none"}>
            <View style={styles.container}>
                <Pressable
                    style={styles.dismissArea}
                    onPress={handleLater}
                    disabled={isNotNowDisabled}
                />
                <View style={styles.cardShadow}>
                    <Animated.View
                        style={[styles.cardWrapper, {transform: [{translateY: cardTranslateY}, {scale: cardScale}]}]}>
                        <Animated.View
                            style={[
                                styles.card,
                                {borderRadius: cardRadius as any, backgroundColor: displayColors.systemBackground},
                            ]}>
                            <Image
                                source={displayImage}
                                style={styles.image}
                                resizeMode="cover"
                            />

                            <Text style={[styles.title, {color: displayColors.text}]}>{displayTitle}</Text>

                            <Text style={[styles.body, {color: displayColors.textSecondary}]}>{displayMessage}</Text>

                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    onPress={handleLater}
                                    disabled={isNotNowDisabled}
                                    style={[
                                        styles.secondaryBtn,
                                        {
                                            backgroundColor: isNotNowDisabled
                                                ? displayColors.border + '50' // Add transparency when disabled
                                                : displayColors.border
                                        }
                                    ]}>
                                    <Text style={[
                                        styles.secondaryText,
                                        {
                                            color: isNotNowDisabled
                                                ? displayColors.text + '60' // Lighter text when disabled
                                                : displayColors.text
                                        }
                                    ]}>
                                        {isNotNowDisabled && remainingTime > 0
                                            ? `${displayNotNow} (${remainingTime}s)`
                                            : displayNotNow}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleRateNow}
                                    style={[styles.primaryBtn, {backgroundColor: displayColors.primary}]}>
                                    <Text style={styles.primaryText}>{displayRateNow}</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </Animated.View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlayContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        elevation: 9999,
    },
    container: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    dismissArea: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    cardShadow: {
        width: "100%",
    },
    card: {
        alignSelf: "center",
        width: "100%",
        maxWidth: 440,
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 6,
        marginBottom: 30,
    },
    cardWrapper: {
        alignSelf: "center",
        width: "100%",
        maxWidth: 440,
        backgroundColor: "transparent",
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 8,
    },
    body: {
        fontSize: 14,
        textAlign: "center",
        marginBottom: 12,
    },
    image: {
        width: "100%",
        height: 200,
        borderRadius: 24,
        marginBottom: 12,
        alignSelf: "center",
    },
    actionsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginTop: 8,
    },
    secondaryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        flexGrow: 1,
    },
    secondaryText: {
        textAlign: "center",
        fontWeight: "600",
    },
    primaryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        flexGrow: 1,
    },
    primaryText: {
        textAlign: "center",
        color: "#fff",
        fontWeight: "700",
    },
});

export default AskForReviewOverlay;
export type { AskForReviewTexts, ColorProps };