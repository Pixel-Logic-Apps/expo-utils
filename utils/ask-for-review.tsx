/// <reference path="./images.d.ts" />
import React, {useEffect, useRef} from "react";
import DEFAULT_REVIEW_IMAGE from "../assets/banner-star.jpg";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    Animated,
    Pressable,
    Alert,
    DeviceEventEmitter,
    Easing,
    Platform,
    StatusBar,
    useWindowDimensions
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import * as Application from "expo-application";
import Constants from "expo-constants";
import {getLocales} from "expo-localization";
import {expoUtilsLog} from "./Utils";
import {logUtilsEvent} from "./analytics";
import {ReviewTutorial, ReviewTutorialParams} from "./review-tutorial";
import type {ReviewStyle} from "./types";
import {SquircleCorners, SquircleFill} from "./squircle";

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

/**
 * Dispara o pedido de review (store-review / popup / dialog via RC `review_type`).
 * @param showDelay ms antes de aparecer. Se omitido, usa RC `review_show_delay` (default 0).
 * Não confundir com o `delay` do overlay / `review_type_delay` (botão "Agora não").
 */
export async function askForReview(texts?: AskForReviewTexts, image?: any, showDelay?: number) {
    try {
        const hasRated = await AsyncStorage.getItem("@user_rated");
        if (hasRated) return; // já avaliou, não mostra de novo

        // Store image globally if provided
        if (image) {
            AskForReviewEvents.setImage(image);
        }

        const delayMs = showDelay ?? global.remoteConfigUtils?.review_show_delay ?? 0;
        if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }

        const reviewType = global.remoteConfigUtils?.review_type || "store-review";
        expoUtilsLog("reviewType", reviewType);
        // Funil do review: review_request → review_prompt_show → review_prompt_action →
        // review_store_requested. O prompt NATIVO da loja não devolve resultado (nem se
        // apareceu), então o funil mede até o pedido — o que vem depois é da loja.
        logUtilsEvent("review_request", {type: reviewType, show_delay_ms: delayMs});
        if (reviewType === "store-review") {
            logUtilsEvent("review_store_requested", {origin: "store-review"});
            await StoreReview.requestReview();
        } else if (reviewType === "popup") {
            AskForReviewEvents.showPopup();
        } else {
            // Use provided texts, or fallback to global texts, or return if neither exists
            const finalTexts = texts || AskForReviewEvents.getTexts();
            if (finalTexts) {
                const shownAt = Date.now();
                logUtilsEvent("review_prompt_show", {type: "dialog"});
                Alert.alert(finalTexts.title, finalTexts.message, [
                    {
                        text: finalTexts.notNow,
                        style: "cancel",
                        onPress: () => logUtilsEvent("review_prompt_action", {type: "dialog", action: "later", source: "button", time_ms: Date.now() - shownAt}),
                    },
                    { text: finalTexts.rateNow,
                        onPress: async () => {
                            logUtilsEvent("review_prompt_action", {type: "dialog", action: "rate", source: "button", time_ms: Date.now() - shownAt});
                            await handleReviewSubmission("dialog");
                        },
                    },
                ]);
            }
        }
    } catch (err) {
        // console.log("Error asking for review:", err);
    }
}

// Função auxiliar para marcar como avaliado e fazer review.
// `origin` só alimenta a telemetria: de onde veio o pedido à loja (popup | dialog | manual).
export async function handleReviewSubmission(origin: string = "manual") {
    try {
        await AsyncStorage.setItem("@user_rated", "true");
        logUtilsEvent("review_store_requested", {origin});
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
    /**
     * Mostra o tutorial animado da Play Store no lugar da imagem estática.
     * `true` usa os defaults; um objeto permite customizar (nome do app, ícone, usuário,
     * locale, cor de destaque...). Só faz sentido no Android — no iOS o fluxo é o
     * SKStoreReviewController nativo. Requer `react-native-webview`.
     */
    tutorial?: boolean | Partial<ReviewTutorialParams>;
    /**
     * Layout do card. Override local do Remote Config `review_style`; omitido, vale o RC,
     * e sem RC vale `formsheet` (o layout historico). Ver ReviewStyle em types.ts.
     */
    variant?: ReviewStyle;
    delay?: number; // Delay in milliseconds to disable "not now" button
    colors?: ColorProps;
    texts?: AskForReviewTexts; // Now optional, will use translations if not provided
    title?: string;
    message?: string;
    rateNowText?: string;
    notNowText?: string;
}

// Default review banner image (importada estaticamente no topo)

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
    // Chamado no RENDER do overlay — getLocales() lançando (módulo nativo indisponível)
    // não pode derrubar o app; cai pro inglês (mesmo padrão do safeGetLocales/promo).
    try {
        const locales = getLocales();
        const locale = locales[0]?.languageCode || "en";
        return TRANSLATIONS[locale] || TRANSLATIONS.en;
    } catch {
        return TRANSLATIONS.en;
    }
}

// Default colors for when colors prop is not provided
const DEFAULT_COLORS: ColorProps = {
    primary: '#007AFF',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    systemBackground: '#FFFFFF'
};

/** Raio do card por layout (o nome `cardRadius` ja e do Animated.Value da entrada). */
/** Raio da midia (imagem ou tutorial) dentro do card. */
const MEDIA_RADIUS = 24;
/** Raio dos botoes. Era 12. */
const BUTTON_RADIUS = 20;

/** Altura da status bar (Android). No iOS o notch entra pelo padding proprio do card. */
const SYS_TOP = Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;
/** Barra de navegacao do Android: 48dp de 3 botoes, o pior caso. */
const SYS_BOTTOM = Platform.OS === "android" ? 48 : 0;

/**
 * Fracao da tela ocupada pelo formsheet. Com 1/3 sobravam 93dp pra midia depois do cabecalho
 * do X, do texto, do botao e da barra de navegacao — o tutorial ficava 165x93 num aparelho de
 * 922dp. Em 1/2 sobram 246dp e ele enfim encosta nas duas bordas (412x232).
 */
const FORMSHEET_FRACTION = 0.5;

/** Botoes empilhados: sem flexGrow (senao esticam na vertical) e ocupando a largura toda. */
const STACKED_BUTTON = {flexGrow: 0, alignSelf: "stretch" as const};

interface VariantSpec {
    justify: "flex-end" | "center";
    cardStyle: object;
    /** aplicado na imagem/tutorial */
    mediaStyle: object;
    /** raio passado ao ReviewTutorial (a WebView arredonda por prop, nao por style) */
    mediaRadius: number;
    /** raio do squircle do card. 0 nos layouts de canto reto. */
    cornerRadius: number;
    /** "top" cola o video na borda de cima do slot (a sobra do `contain` vai toda pra baixo) */
    mediaAlign: "center" | "top";
    /** aplicado no titulo e na mensagem (o card do formsheet nao tem padding proprio) */
    textStyle: object;
    actionsStyle: object;
    buttonStyle: object;
    /** true = o X substitui o "Agora Nao": so o botao primario e renderizado */
    singleButton: boolean;
    /** true = card colado nas laterais (sem padding no container) */
    noSidePadding: boolean;
    /** true = o card ocupa a tela toda, entao os wrappers precisam esticar */
    fillsScreen: boolean;
    /** distancia do X ate o topo do card */
    closeTop: number;
    /** true = o X fica sobre a midia, entao ganha um circulo translucido pra ter contraste */
    closeOverMedia: boolean;
    /** true = o X vai num cabecalho proprio, acima da midia, separado por uma linha */
    closeInHeader: boolean;
    /** false = entra SO deslizando: sem escala e sem morph de raio */
    morphs: boolean;
    /** false = slide sem bounce (timing com ease-out em vez de spring, que passa do ponto) */
    bounces: boolean;
    /** quanto o card desliza na entrada/saida (0 = nao desliza) */
    slideDistance: number;
    /** false = cantos retos e sem animacao de raio */
    rounded: boolean;
    /** true = arredonda so em cima (sheet colado nas bordas) */
    topRoundedOnly: boolean;
    closeButton: boolean;
}

/**
 * Overrides por layout. O que nao aparece aqui vem do StyleSheet base, entao `bottomsheet`
 * e exatamente o comportamento historico e nenhum app existente muda de aparencia.
 * `winHeight` so e usado pelo formsheet, que e definido como 1/3 da tela.
 */
const buildVariants = (winHeight: number): Record<ReviewStyle, VariantSpec> => ({
    bottomsheet: {
        mediaAlign: "center",
        cornerRadius: 40,
        mediaRadius: 24,
        justify: "flex-end",
        cardStyle: {},
        mediaStyle: {height: 200},
        textStyle: {},
        actionsStyle: {},
        buttonStyle: {},
        singleButton: false,
        noSidePadding: false,
        fillsScreen: false,
        closeTop: 0,
        closeOverMedia: false,
        closeInHeader: false,
        morphs: true,
        bounces: true,
        slideDistance: 60,
        rounded: true,
        topRoundedOnly: false,
        closeButton: false,
    },
    formsheet: {
        mediaAlign: "top",
        cornerRadius: 0,
        mediaRadius: 0,
        justify: "flex-end",
        cardStyle: {
            width: "100%",
            maxWidth: undefined,
            // 1/3 da tela, medido em runtime: a proporcao vale em qualquer aparelho
            height: Math.round(winHeight * FORMSHEET_FRACTION),
            padding: 0,
            marginBottom: 0,
            paddingBottom: SYS_BOTTOM,
        },
        // altura livre: a midia fica com o que sobrar do 1/3 depois de texto e botoes
        mediaStyle: {flex: 1, height: undefined, borderRadius: 0, marginBottom: 12},
        // o card nao tem padding, entao o respiro lateral vem daqui
        textStyle: {paddingHorizontal: 20},
        actionsStyle: {paddingHorizontal: 20},
        buttonStyle: {},
        singleButton: true,
        noSidePadding: true,
        fillsScreen: false,
        closeTop: 8,
        closeOverMedia: false,
        closeInHeader: true,
        morphs: false,
        bounces: false,
        slideDistance: Math.round(winHeight * FORMSHEET_FRACTION),
        rounded: false,
        topRoundedOnly: false,
        closeButton: true,
    },
    centered: {
        mediaAlign: "center",
        cornerRadius: 28,
        mediaRadius: 24,
        // centralizado nao tem a que ancorar, entao a margem de baixo do bottomsheet sai
        justify: "center",
        cardStyle: {marginBottom: 0},
        mediaStyle: {height: 200},
        textStyle: {},
        // column-reverse: o primario (declarado por ultimo) fica em cima
        actionsStyle: {flexDirection: "column-reverse"},
        buttonStyle: STACKED_BUTTON,
        singleButton: false,
        noSidePadding: false,
        fillsScreen: false,
        closeTop: 0,
        closeOverMedia: false,
        closeInHeader: false,
        morphs: true,
        bounces: true,
        slideDistance: 0,
        rounded: true,
        topRoundedOnly: false,
        closeButton: false,
    },
    fullscreen: {
        mediaAlign: "center",
        cornerRadius: 0,
        mediaRadius: 24,
        justify: "center",
        cardStyle: {
            flex: 1,
            width: "100%",
            maxWidth: undefined,
            marginBottom: 0,
            padding: 24,
            // edge-to-edge: o card cobre status bar e barra de navegacao, o respiro delas
            // entra aqui. StatusBar.currentHeight so existe no Android.
            paddingTop: SYS_TOP + 56,
            paddingBottom: SYS_BOTTOM + 24,
        },
        mediaStyle: {height: 240},
        textStyle: {},
        // marginTop auto consome o espaco livre e joga os botoes pro rodape
        actionsStyle: {flexDirection: "column-reverse", marginTop: "auto"},
        buttonStyle: STACKED_BUTTON,
        singleButton: true,
        noSidePadding: true,
        fillsScreen: true,
        closeTop: SYS_TOP + 8,
        closeOverMedia: false,
        closeInHeader: false,
        morphs: true,
        bounces: true,
        slideDistance: 0,
        rounded: false,
        topRoundedOnly: false,
        closeButton: true,
    },
});

/** Estilo efetivo: prop > Remote Config > bottomsheet. Valor desconhecido no RC nao quebra. */
const resolveVariant = (prop?: ReviewStyle): ReviewStyle => {
    const wanted = prop || global.remoteConfigUtils?.review_style;
    return wanted === "formsheet" || wanted === "centered" || wanted === "fullscreen" ? wanted : "bottomsheet";
};

const AskForReviewOverlay: React.FC<AskForReviewOverlayProps> = ({
    visible,
    onClose,
    image,
    tutorial,
    variant,
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
    const shownAt = useRef(0);

    // Use provided colors or fall back to defaults
    const displayColors = colors || DEFAULT_COLORS;

    // Resolvido no render (nao em estado): o RC ja esta carregado quando o overlay abre.
    // useWindowDimensions para o formsheet acompanhar rotacao/split-screen.
    const {height: winHeight} = useWindowDimensions();
    const layout = React.useMemo(
        () => buildVariants(winHeight)[resolveVariant(variant)],
        [winHeight, variant, visible],
    );

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
            // `style` é o que permite comparar os layouts do review_style (Remote Config / A/B).
            shownAt.current = Date.now();
            logUtilsEvent("review_prompt_show", {type: "popup", style: resolveVariant(variant), tutorial: Boolean(tutorial), not_now_delay_ms: delay});
            backdrop.setValue(0);
            cardScale.setValue(layout.morphs ? 0.95 : 1);
            cardTranslateY.setValue(layout.slideDistance);
            // sem morph o raio ja comeca no valor final
            cardRadius.setValue(layout.rounded ? (layout.morphs ? 220 : 24) : 0);
            Animated.parallel([
                Animated.timing(backdrop, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(cardScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    // sem morph a escala fica em 1 o tempo todo; rigido evita qualquer oscilacao
                    friction: layout.morphs ? 7 : 100,
                    tension: 90,
                }),
                layout.bounces
                    ? Animated.spring(cardTranslateY, {
                          toValue: 0,
                          useNativeDriver: true,
                          friction: 8,
                          tension: 90,
                      })
                    : // ease-out puro: chega e para, sem passar do ponto
                      Animated.timing(cardTranslateY, {
                          toValue: 0,
                          duration: 320,
                          easing: Easing.out(Easing.cubic),
                          useNativeDriver: true,
                      }),
                Animated.timing(cardRadius, {
                    toValue: layout.rounded ? 24 : 0,
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
                toValue: layout.rounded ? (layout.morphs ? 40 : 24) : 0,
                duration: 180,
                useNativeDriver: false,
            }),
            Animated.timing(cardScale, {
                toValue: layout.morphs ? 0.96 : 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(cardTranslateY, {
                toValue: layout.slideDistance,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(() => {
            cb();
        });
    };

    const logAction = (action: "rate" | "later", source: string) =>
        logUtilsEvent("review_prompt_action", {type: "popup", style: resolveVariant(variant), action, source, time_ms: Date.now() - shownAt.current});

    const handleRateNow = async () => {
        logAction("rate", "button");
        animateOut(async () => {
            onClose();
            await handleReviewSubmission("popup");
        });
    };

    // `source` é SEMPRE string explícita (backdrop | close | button): handler passado direto
    // no onPress receberia o GestureResponderEvent como 1º argumento.
    const handleLater = (source: string) => {
        if (!isNotNowDisabled) {
            logAction("later", source);
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
            <View style={[styles.container, {justifyContent: layout.justify}, layout.noSidePadding && styles.containerFull]}>
                <Pressable
                    style={styles.dismissArea}
                    onPress={() => handleLater("backdrop")}
                    disabled={isNotNowDisabled}
                />
                <View style={[styles.cardShadow, layout.fillsScreen && styles.fullFlex]}>
                    <Animated.View
                        style={[
                            styles.cardWrapper,
                            layout.fillsScreen && styles.fullFlex,
                            {transform: [{translateY: cardTranslateY}, {scale: cardScale}]},
                        ]}>
                        <Animated.View
                            style={[
                                styles.card,
                                layout.cardStyle,
                                layout.topRoundedOnly
                                    ? {borderRadius: 0, borderTopLeftRadius: cardRadius as any, borderTopRightRadius: cardRadius as any}
                                    : {borderRadius: cardRadius as any},
                                {backgroundColor: layout.rounded ? "transparent" : displayColors.systemBackground},
                            ]}>
                            {/* squircle no lugar do canto circular; layouts de canto reto nao usam */}
                            {layout.rounded && (
                                <SquircleFill color={displayColors.systemBackground} radius={layout.cornerRadius} />
                            )}
                            {/* Cabecalho proprio pro X, separado da midia por uma linha. O
                                espaco e reservado mesmo sem o X, senao a barra apareceria de
                                repente no fim do countdown e empurraria o conteudo. */}
                            {layout.closeInHeader && (
                                <View style={[styles.closeHeader, {borderBottomColor: displayColors.border}]}>
                                    {!isNotNowDisabled && (
                                        <TouchableOpacity
                                            onPress={() => handleLater("close")}
                                            hitSlop={12}
                                            accessibilityRole="button"
                                            accessibilityLabel={displayNotNow}
                                            style={styles.closeInline}>
                                            <Text style={[styles.closeTxt, {color: displayColors.textSecondary}]}>
                                                {"\u00D7"}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* O X e o "Agora Nao" destes layouts: some enquanto o countdown
                                do review_type_delay roda e aparece quando ele zera. */}
                            {layout.closeButton && !layout.closeInHeader && !isNotNowDisabled && (
                                <TouchableOpacity
                                    onPress={() => handleLater("close")}
                                    hitSlop={12}
                                    accessibilityRole="button"
                                    accessibilityLabel={displayNotNow}
                                    style={[styles.closeBtn, {top: layout.closeTop},
                                        layout.closeOverMedia && styles.closeOnMedia]}>
                                    <Text style={[styles.closeTxt, {color: displayColors.textSecondary}]}>
                                        {"\u00D7"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <View style={[styles.image, layout.mediaStyle, styles.mediaHost]}>
                            {tutorial ? (
                                <ReviewTutorial
                                    style={styles.fullFlex}
                                    borderRadius={0}
                                    appName={Application.applicationName || ""}
                                    locale={getLocales()?.[0]?.languageCode || "en"}
                                    html={global.remoteConfigUtils?.review_tutorial_html}
                                    appIconUrl={Constants.expoConfig?.extra?.expoUtilsAppIcon}
                                    align={layout.mediaAlign}
                                    {...(typeof tutorial === "object" ? tutorial : {})}
                                />
                            ) : (
                                <Image
                                    source={displayImage}
                                    style={styles.fullFlex}
                                    resizeMode="cover"
                                />
                            )}
                            {layout.rounded && (
                                <SquircleCorners color={displayColors.systemBackground} radius={MEDIA_RADIUS} />
                            )}
                            </View>

                            <Text style={[styles.title, layout.textStyle, {color: displayColors.text}]}>{displayTitle}</Text>

                            <Text style={[styles.body, layout.textStyle, {color: displayColors.textSecondary}]}>{displayMessage}</Text>

                            <View style={[styles.actionsRow, layout.actionsStyle]}>
                                {!layout.singleButton && (
                                    <TouchableOpacity
                                        onPress={() => handleLater("button")}
                                        disabled={isNotNowDisabled}
                                        style={[styles.secondaryBtn, layout.buttonStyle]}>
                                        <SquircleFill
                                            radius={BUTTON_RADIUS}
                                            color={displayColors.border}
                                            opacity={isNotNowDisabled ? 0.31 : 1}
                                        />
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
                                )}
                                <TouchableOpacity
                                    onPress={handleRateNow}
                                    style={[styles.primaryBtn, layout.buttonStyle]}>
                                    <SquircleFill radius={BUTTON_RADIUS} color={displayColors.primary} />
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
    /* fullscreen: o card e a tela, entao o respiro lateral sai do container */
    containerFull: {
        paddingHorizontal: 0,
    },
    fullFlex: {
        flex: 1,
    },
    /* dono da midia: o recorte dos cantos vem da sobreposicao, nao do borderRadius */
    mediaHost: {
        overflow: "hidden",
        borderRadius: 0,
    },
    closeBtn: {
        position: "absolute",
        // `top` vem do layout: no fullscreen precisa descer a status bar (edge-to-edge),
        // no formsheet o card esta no rodape e 8 basta.
        right: 8,
        zIndex: 1,
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    closeHeader: {
        width: "100%",
        height: 48,
        borderBottomWidth: StyleSheet.hairlineWidth,
        alignItems: "flex-end",
        justifyContent: "center",
        paddingHorizontal: 12,
    },
    closeInline: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    /* sobre a midia o X precisa de fundo proprio, senao some em frame claro */
    closeOnMedia: {
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.82)",
    },
    closeTxt: {
        fontSize: 30,
        lineHeight: 34,
        fontWeight: "300",
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
        // O app desenha edge-to-edge (react-native-edge-to-edge), entao o overlay vai por baixo
        // da barra de navegacao. Medido no emulador: com 30 o card invadia 15,3dp da barra de
        // 3 botoes (48dp). 60 limpa a barra com 12dp de folga, e sobre gesture nav (24dp) vira
        // uma margem confortavel. No iOS os 30 originais seguem valendo.
        marginBottom: Platform.OS === "android" ? 60 : 30,
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
        // sem borderRadius/overflow: qualquer um dos dois recortaria o squircle num canto circular
        flexGrow: 1,
    },
    secondaryText: {
        textAlign: "center",
        fontWeight: "600",
    },
    primaryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        // sem borderRadius/overflow: qualquer um dos dois recortaria o squircle num canto circular
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