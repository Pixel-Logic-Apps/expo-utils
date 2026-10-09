// Modal de retenção — parte de UI (planos: docs/PLANO-RETENCAO-TRIAL-CANCELADO.md, seções 6 a 8, e
// docs/PLANO-RETENCAO-OFERTAS.md, seções 3, 4, 7 e 8). Mesmo formato da Retention Messaging da Apple:
// imagem opcional, título, texto, bullets opcionais, mais a linha da data e os cartões de oferta, que só
// o app consegue mostrar.
//
//  - iOS: `Modal` com `presentationStyle="pageSheet"` (a folha nativa, como a de assinaturas).
//  - Android: bottom sheet no padrão do promo (overlay + slide + arrastar para fechar).
//  - Por segmento (`trial_cancelled`, `cancelled`, `billing_issue`, `expired`, `trial_expired`, `free`):
//    título/texto, ilustração (cartão com alerta na falha de pagamento) e linha da data. A 1ª oferta é o
//    botão principal (com o cartão dela acima, quando tem); a 2ª vira um cartão tocável abaixo do botão.
//    Tudo isso sai pronto de `buildRetentionView` (utils/retention-view.ts, puro e testado).
//  - "Reativar"/"Atualizar pagamento": iOS `Purchases.showManageSubscriptions()` (resolve quando a folha
//    ABRE, por isso o estado "conferindo" com "Já reativei"); Android abre o `managementURL` (o
//    showManageSubscriptions do SDK lança no Android), com a página de assinaturas do Play como reserva.
//  - Compra (fora da pré-visualização): `purchaseRetentionOffer` (utils/retention-store.ts) com a oferta já
//    conferida na loja pelo `showRetention`. Spinner no botão tocado e todos os botões desligados enquanto
//    compra; comprou → fecha (`purchased`), ou vai para o aviso de cancelar a assinatura antiga quando é o
//    vitalício em `billing_issue`; cancelou → volta ao normal; pendente/falhou → linha acima do botão e o
//    modal continua aberto. `resubscribe` no Android que a loja diz já ser da pessoa → reativar pela gestão.
//  - Código promocional: `redeemRetentionCode` (link da loja ou a folha da Apple) e fecha (`redeem`).
//  - Pré-visualização (`showRetentionPreview`): nenhuma chamada à loja; os botões só registram no log e
//    seguem o fluxo.
//
// Abre por `RetentionEvents.show()` (utils/retention-events.ts) — com compra, pelo `showRetention`
// (utils/retention-show.ts). Quem desenha é UM RetentionModalSlot: o ExpoUtilsLayout, o AskForReviewOverlay
// e o PromotionalContent montam um cada, e só o de menor prioridade vira dono — assim o modal aparece também
// nos apps com o layout manual do template, sem linha nova. Analytics (`retention_*`, fora da
// pré-visualização): utils/retention-analytics.ts.
import React, {useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {
    ActivityIndicator,
    Animated,
    I18nManager,
    Image,
    Linking,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    useWindowDimensions,
    View,
    type TextStyle,
} from "react-native";
import {SafeAreaInsetsContext} from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as Application from "expo-application";
import {getLocales} from "expo-localization";
import Purchases from "react-native-purchases";
import {expoUtilsLog, expoUtilsWarn} from "./Utils";
import {getRevenueCatStatus, type RcStatus} from "./rc-status";
import {logRetentionClick, logRetentionClose, logRetentionImpression, logRetentionPurchase, logRetentionPurchaseError} from "./retention-analytics";
import {RetentionEvents, type RetentionCloseMethod, type RetentionRequest} from "./retention-events";
import {retentionPreviewNext, type RetentionModalState, type RetentionOfferRole} from "./retention-offers";
import {purchaseRetentionOffer, RC_ERROR_CODES, redeemRetentionCode} from "./retention-store";
import {playSubscriptionsUrl} from "./retention-texts";
import {buildRetentionView, type RetentionCardView, type RetentionOfferView, type RetentionView} from "./retention-view";
import {SquircleCorners, SquircleFill} from "./squircle";

// ─── Cores (as do review no claro; equivalentes do sistema no escuro) ───────────

const PALETTE = {
    light: {
        background: "#FFFFFF",
        text: "#000000",
        textSecondary: "#666666",
        primary: "#007AFF",
        onPrimary: "#FFFFFF",
        handle: "#D1D1D6",
        chip: "#F2F2F7",
        bulletFill: "rgba(0,122,255,0.12)",
        warning: "#9A5B00",
        overlay: "rgba(0,0,0,0.5)",
        /** Selo de desconto e o "✓" do aviso pós-compra. */
        discount: "#34C759",
        onDiscount: "#FFFFFF",
        /** Fundo do alerta da falha de pagamento (o `warning` é a cor de TEXTO). */
        warningFill: "#FFB340",
        onWarning: "#1C1C1E",
        payCard: "#3A3A3C",
        payStripe: "#1C1C1E",
    },
    dark: {
        background: "#1C1C1E",
        text: "#FFFFFF",
        textSecondary: "#A1A1A6",
        primary: "#0A84FF",
        onPrimary: "#FFFFFF",
        handle: "#48484A",
        chip: "#2C2C2E",
        bulletFill: "rgba(10,132,255,0.22)",
        warning: "#FFB340",
        overlay: "rgba(0,0,0,0.6)",
        discount: "#30D158",
        onDiscount: "#FFFFFF",
        warningFill: "#9A5B00",
        onWarning: "#FFFFFF",
        payCard: "#636366",
        payStripe: "#3A3A3C",
    },
};
type RetentionColors = (typeof PALETTE)["light"];

const BUTTON_RADIUS = 20; // mesmo raio dos botões do review
const ICON_SIZE = 76;
const ICON_RADIUS = 17; // ~22% do lado, a proporção do ícone do iOS
const SHEET_RADIUS = 24; // mesmo do bottom sheet do promo
const ZERO_INSETS = {top: 0, bottom: 0, left: 0, right: 0};
const RECOVERED: readonly RcStatus[] = ["trial", "intro", "active"];
/** Marca de direita-para-esquerda: o Android decide a direção do parágrafo pelo 1º caractere forte. */
const RLM = "\u200F";
const MONOSPACE = Platform.select({ios: "Menlo", default: "monospace"});
const CHIP_GOLD = "#E3B95A";
/** Botão desligado enquanto a OUTRA oferta compra. */
const DIMMED = 0.5;
/** A folha de resgate da Apple espera o modal sair: apresentada por cima dele, sumiria junto. */
const REDEEM_SHEET_DELAY_MS = 600;

const useColors = (): RetentionColors => PALETTE[useColorScheme() === "dark" ? "dark" : "light"];

/** Sem SafeAreaProvider na árvore, `useSafeAreaInsets` lança; o contexto cru só volta null. */
const useInsets = () => useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;

const deviceLanguageTag = (): string => {
    try {
        const locale = getLocales()[0];
        return locale?.languageTag || locale?.languageCode || "en";
    } catch {
        return "en";
    }
};

const appDisplayName = (): string => Constants.expoConfig?.name || Application.applicationName || "";

const buildView = (request: RetentionRequest): RetentionView =>
    buildRetentionView({
        segment: request.segment,
        variant: request.variant,
        offers: request.offers,
        language: request.locale || deviceLanguageTag(),
        appName: appDisplayName(),
        remoteTexts: global.remoteConfigUtils?.retention?.texts,
        defaultBullets: request.defaultBullets === true,
        expirationDate: request.expirationDate,
        deviceLocale: request.locale ? null : deviceLanguageTag(),
    });

/**
 * Direção do TEXTO, sem mexer na do app: `left`/`right` e `row` seguem a direção do layout do app
 * (RN troca os lados quando o app está em RTL), então o lado certo depende das duas.
 */
const directionOf = (rtl: boolean) => {
    const sameAsApp = rtl === I18nManager.isRTL;
    return {
        row: (sameAsApp ? "row" : "row-reverse") as "row" | "row-reverse",
        start: {textAlign: sameAsApp ? "left" : "right", writingDirection: rtl ? "rtl" : "ltr"} as TextStyle,
        writing: {writingDirection: rtl ? "rtl" : "ltr"} as TextStyle,
        mark: rtl ? RLM : "",
    };
};
type Direction = ReturnType<typeof directionOf>;

/** Abre a gestão da assinatura na loja. Nunca lança. */
async function openSubscriptionManagement(request: RetentionRequest): Promise<void> {
    if (Platform.OS === "ios") {
        try {
            await Purchases.showManageSubscriptions();
            return;
        } catch (e) {
            expoUtilsWarn("retention/showManageSubscriptions:", e);
        }
    }
    const url =
        request.managementURL ||
        (Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : playSubscriptionsUrl(Application.applicationId, request.productIdentifier));
    try {
        await Linking.openURL(url);
    } catch (e) {
        expoUtilsWarn("retention/openURL:", e);
    }
}

/** "Já reativei": cache do RevenueCat invalidado e CustomerInfo lido de novo. Nunca lança. */
async function checkReactivated(): Promise<boolean> {
    try {
        await Purchases.invalidateCustomerInfoCache();
    } catch (e) {
        expoUtilsWarn("retention/invalidateCustomerInfoCache:", e);
    }
    try {
        return RECOVERED.includes(getRevenueCatStatus(await Purchases.getCustomerInfo()));
    } catch (e) {
        expoUtilsWarn("retention/getCustomerInfo:", e);
        return false;
    }
}

// ─── Peças: ilustrações, selo, preço, cartões ──────────────────────────────────

/** Falha de pagamento: cartão de pagamento com alerta, só com Views (nenhum asset na lib). */
function BillingIllustration({colors}: {colors: RetentionColors}) {
    return (
        <View style={styles.illustration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.payCard, {backgroundColor: colors.payCard}]}>
                <View style={[styles.payStripe, {backgroundColor: colors.payStripe}]} />
                <View style={styles.payChip} />
                <View style={styles.payDigits}>
                    {[0, 1, 2, 3].map((group) => (
                        <View key={group} style={styles.payDigitGroup} />
                    ))}
                </View>
            </View>
            <View style={[styles.alertBadge, {backgroundColor: colors.warningFill, borderColor: colors.background}]}>
                <Text style={[styles.alertMark, {color: colors.onWarning}]}>!</Text>
            </View>
        </View>
    );
}

/** Aviso pós-compra do vitalício: círculo verde com "✓". */
function NoticeIllustration({colors}: {colors: RetentionColors}) {
    return (
        <View style={styles.noticeWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.noticeCircle, {backgroundColor: colors.discount}]}>
                <Text style={[styles.noticeCheck, {color: colors.onDiscount}]}>{"\u2713"}</Text>
            </View>
        </View>
    );
}

function Badge({text, colors, small}: {text: string; colors: RetentionColors; small?: boolean}) {
    return (
        <View style={[styles.badge, small && styles.badgeSmall, {backgroundColor: colors.discount}]}>
            <Text style={[styles.badgeText, small && styles.badgeTextSmall, {color: colors.onDiscount}]}>{text}</Text>
        </View>
    );
}

/** Código promocional numa pílula em fonte monoespaçada (sempre da esquerda para a direita). */
function CodePill({code, colors, small}: {code: string; colors: RetentionColors; small?: boolean}) {
    return (
        <View style={[styles.codePill, small && styles.codePillSmall, {borderColor: colors.primary, backgroundColor: colors.bulletFill}]}>
            <Text style={[styles.codeText, small && styles.codeTextSmall, {color: colors.text, fontFamily: MONOSPACE}]} selectable>
                {code}
            </Text>
        </View>
    );
}

/** Preço grande + "/mês" e, ao lado, o preço riscado. */
function PriceLine({card, colors, dir, small}: {card: RetentionCardView; colors: RetentionColors; dir: Direction; small?: boolean}) {
    if (!card.price && !card.originalPrice) return null;
    return (
        <View style={[styles.priceLine, small && styles.priceLineSmall, {flexDirection: dir.row}]}>
            {card.badge && small ? <Badge text={card.badge} colors={colors} small /> : null}
            {card.price ? (
                <Text style={[small ? styles.priceSmall : styles.price, {color: colors.text}, dir.writing]}>
                    {dir.mark + card.price}
                    {card.per ? <Text style={[small ? styles.perSmall : styles.per, {color: colors.textSecondary}]}>{card.per}</Text> : null}
                </Text>
            ) : null}
            {card.originalPrice ? (
                <Text style={[small ? styles.struckSmall : styles.struck, {color: colors.textSecondary}, dir.writing]}>{dir.mark + card.originalPrice}</Text>
            ) : null}
        </View>
    );
}

/** Cartão da oferta principal, centrado, acima do botão. */
function OfferCard({card, colors, dir}: {card: RetentionCardView; colors: RetentionColors; dir: Direction}) {
    return (
        <View style={[styles.offerCard, {backgroundColor: colors.chip}]}>
            {card.title ? <Text style={[styles.cardTitle, {color: colors.text}, dir.writing]}>{dir.mark + card.title}</Text> : null}
            {card.kind === "code" ? (
                <>
                    {card.code ? <CodePill code={card.code} colors={colors} /> : null}
                    {card.hint ? <Text style={[styles.cardNote, {color: colors.textSecondary}, dir.writing]}>{dir.mark + card.hint}</Text> : null}
                </>
            ) : (
                <>
                    {card.badge ? <Badge text={card.badge} colors={colors} /> : null}
                    <PriceLine card={card} colors={colors} dir={dir} />
                    {card.period ? <Text style={[styles.cardPeriod, {color: colors.text}, dir.writing]}>{dir.mark + card.period}</Text> : null}
                    {card.terms ? <Text style={[styles.cardNote, {color: colors.textSecondary}, dir.writing]}>{dir.mark + card.terms}</Text> : null}
                </>
            )}
        </View>
    );
}

/** 2ª oferta: cartão tocável abaixo do botão principal, com o próprio botão pequeno (spinner nele enquanto compra). */
function SecondaryOfferCard({
    item,
    colors,
    dir,
    onPress,
    busy,
    disabled,
}: {
    item: RetentionOfferView;
    colors: RetentionColors;
    dir: Direction;
    onPress: () => void;
    busy: boolean;
    disabled: boolean;
}) {
    const card = item.card;
    if (!card) return null;
    const note = [card.period, card.terms].filter(Boolean).join(" · ");
    const label = [card.title, card.price && card.price + card.per, card.originalPrice, card.badge, card.code, note, item.cta].filter(Boolean).join(", ");
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{busy, disabled}}
            style={({pressed}) => [styles.secondaryCard, {borderColor: colors.handle, flexDirection: dir.row, opacity: disabled && !busy ? DIMMED : pressed ? 0.7 : 1}]}>
            <View style={styles.secondaryInfo}>
                {card.title ? (
                    <Text style={[styles.secondaryTitle, {color: colors.text}, dir.start]} numberOfLines={2}>
                        {dir.mark + card.title}
                    </Text>
                ) : null}
                {card.kind === "code" ? (
                    <View style={[styles.secondaryCodeRow, {flexDirection: dir.row}]}>
                        {card.code ? <CodePill code={card.code} colors={colors} small /> : null}
                        {card.hint ? <Text style={[styles.secondaryNote, {color: colors.textSecondary}, dir.start]}>{dir.mark + card.hint}</Text> : null}
                    </View>
                ) : (
                    <PriceLine card={card} colors={colors} dir={dir} small />
                )}
                {note ? <Text style={[styles.secondaryNote, {color: colors.textSecondary}, dir.start]}>{dir.mark + note}</Text> : null}
            </View>
            <View style={[styles.secondaryCta, {backgroundColor: colors.bulletFill}]}>
                {busy ? (
                    <ActivityIndicator color={colors.primary} />
                ) : (
                    <Text style={[styles.secondaryCtaText, {color: colors.primary}]} numberOfLines={2}>
                        {item.cta}
                    </Text>
                )}
            </View>
        </Pressable>
    );
}

// ─── Conteúdo (igual nas duas plataformas) ─────────────────────────────────────

type BodyProps = {
    request: RetentionRequest;
    colors: RetentionColors;
    onClose: (method: RetentionCloseMethod) => void;
    /** espaço abaixo dos botões (home indicator / barra de navegação) */
    bottomInset: number;
    /** pageSheet do iOS: ocupa a folha inteira; bottom sheet: cresce com o conteúdo */
    fill: boolean;
};

/** offer → (reativar/atualizar pagamento) checking; offer → (vitalício com falha de pagamento) notice. */
type Phase = "offer" | "checking" | "notice";
const initialPhase = (state: RetentionModalState): Phase => (state === "lifetime_notice" ? "notice" : "offer");

function RetentionBody({request, colors, onClose, bottomInset, fill}: BodyProps) {
    const {height: windowHeight} = useWindowDimensions();
    const view = useMemo(() => buildView(request), [request]);
    const dir = directionOf(view.rtl);
    const [phase, setPhase] = useState<Phase>(() => initialPhase(request.state));
    const [verifying, setVerifying] = useState(false);
    const [notYet, setNotYet] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);
    const [aspect, setAspect] = useState(16 / 9);
    /** Oferta sendo comprada: spinner no botão dela e todos os botões desligados. */
    const [buying, setBuying] = useState<RetentionOfferRole | null>(null);
    /** Linha acima do botão depois da compra: falhou (tente de novo) ou ficou pendente. */
    const [purchaseNote, setPurchaseNote] = useState<"error" | "pending" | null>(null);
    const mountedRef = useRef(true);
    const openingRef = useRef(false);
    const verifyingRef = useRef(false);
    const buyingRef = useRef(false);
    const requestIdRef = useRef(request.id);
    requestIdRef.current = request.id;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Pedido novo com o modal aberto: recomeça do zero sem fechar a folha.
    useEffect(() => {
        setPhase(initialPhase(request.state));
        setVerifying(false);
        setNotYet(false);
        setImageFailed(false);
        setBuying(null);
        setPurchaseNote(null);
        verifyingRef.current = false;
        buyingRef.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request.id]);

    const notice = phase === "notice";
    const imageUrl = request.imageUrl || global.remoteConfigUtils?.retention?.image_url;
    const appIcon: string | undefined = Constants.expoConfig?.extra?.expoUtilsAppIcon;
    const showBanner = !notice && view.illustration === "media" && Boolean(imageUrl) && !imageFailed;

    // "Reativar" / "Atualizar pagamento": abre a gestão da assinatura e fica em "conferindo".
    const reactivate = async () => {
        if (openingRef.current) return;
        openingRef.current = true;
        setNotYet(false);
        setPhase("checking");
        try {
            if (!request.preview) await openSubscriptionManagement(request);
        } finally {
            openingRef.current = false;
        }
    };

    const confirm = async () => {
        if (request.preview) {
            onClose("confirmed");
            return;
        }
        if (verifyingRef.current) return;
        logRetentionClick(request, "confirm", view.primary.offer, "primary");
        verifyingRef.current = true;
        setVerifying(true);
        setNotYet(false);
        const recovered = await checkReactivated();
        verifyingRef.current = false;
        if (!mountedRef.current) return;
        if (recovered) {
            onClose("recovered");
            return;
        }
        setVerifying(false);
        setNotYet(true);
    };

    const purchase = async (item: RetentionOfferView) => {
        if (buyingRef.current) return;
        buyingRef.current = true;
        const current = request;
        setBuying(item.role);
        setPurchaseNote(null);
        const result = await purchaseRetentionOffer(item.offer);
        // Analytics antes de olhar a tela: a compra conta mesmo se o modal fechou no meio.
        if (result.status === "purchased") logRetentionPurchase(current, item.offer, result);
        else if (result.status === "pending") logRetentionPurchaseError(current, item.offer, {status: "pending", code: RC_ERROR_CODES.paymentPending});
        else if (result.status === "failed") logRetentionPurchaseError(current, item.offer, {status: "failed", code: result.code, message: result.message});
        if (!mountedRef.current || requestIdRef.current !== current.id) return;
        buyingRef.current = false;
        setBuying(null);
        switch (result.status) {
            case "purchased":
                // Vitalício com falha de pagamento: a assinatura antiga continua tentando cobrar → aviso para cancelar.
                if (item.offer.type === "lifetime" && view.segment === "billing_issue") setPhase("notice");
                else onClose("purchased");
                return;
            case "cancelled":
                return;
            case "pending":
                setPurchaseNote("pending");
                return;
            case "failed":
                // Android: a loja diz que a assinatura (cancelada, ainda ativa) já é da pessoa → religa pela gestão.
                if (item.offer.type === "resubscribe" && result.code === RC_ERROR_CODES.productAlreadyPurchased) {
                    void reactivate();
                    return;
                }
                setPurchaseNote("error");
        }
    };

    const pressOffer = (item: RetentionOfferView) => {
        if (request.preview) {
            const next = retentionPreviewNext(item.offer.type, view.segment);
            expoUtilsLog(`[expo-utils] retention preview: ${item.role} "${item.offer.name}" (${item.offer.type}) em ${view.segment} → ${next}`);
            if (next === "checking") void reactivate();
            else if (next === "lifetime_notice") setPhase("notice");
            else onClose("confirmed");
            return;
        }
        if (buyingRef.current) return;
        logRetentionClick(request, item.action, item.offer, item.role);
        switch (item.action) {
            case "reactivate":
            case "update_payment":
                void reactivate();
                return;
            case "redeem":
                // Link da loja abre na hora; a folha de resgate da Apple (iOS sem link) espera o modal sair.
                void redeemRetentionCode(item.offer, {sheetDelayMs: REDEEM_SHEET_DELAY_MS});
                onClose("redeem");
                return;
            case "purchase":
                void purchase(item);
        }
    };

    // Aviso pós-compra: abre a tela de assinaturas e o modal continua aberto, como depois do "Reativar".
    const pressNotice = async () => {
        if (request.preview) {
            expoUtilsLog("[expo-utils] retention preview: aviso pós-compra → abriria a tela de assinaturas da loja");
            onClose("confirmed");
            return;
        }
        if (openingRef.current) return;
        logRetentionClick(request, "manage");
        openingRef.current = true;
        try {
            await openSubscriptionManagement(request);
        } finally {
            openingRef.current = false;
        }
    };

    const media = notice ? (
        <NoticeIllustration colors={colors} />
    ) : view.illustration === "billing" ? (
        <BillingIllustration colors={colors} />
    ) : showBanner ? (
        <View style={[styles.banner, {aspectRatio: aspect, maxHeight: Math.round(windowHeight * 0.3), backgroundColor: colors.chip}]}>
            <Image
                source={{uri: imageUrl}}
                style={styles.fill}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
                onLoad={(event) => {
                    const source = event?.nativeEvent?.source;
                    if (source?.width && source?.height) setAspect(Math.min(24, Math.max(1, source.width / source.height)));
                }}
                onError={() => setImageFailed(true)}
            />
        </View>
    ) : appIcon ? (
        <View style={styles.iconWrap}>
            <Image source={{uri: appIcon}} style={styles.fill} accessibilityIgnoresInvertColors />
            <SquircleCorners color={colors.background} radius={ICON_RADIUS} />
        </View>
    ) : (
        <View style={styles.noMedia} />
    );

    const title = notice ? view.notice.header : view.header;
    const body = notice ? view.notice.body : view.body;
    const purchaseHint = phase === "offer" && purchaseNote ? (purchaseNote === "error" ? view.purchase.error : view.purchase.pending) : null;
    const hint = phase === "checking" ? (notYet ? view.checking.notYet : view.checking.hint) : purchaseHint;
    const hintWarning = phase === "checking" ? notYet : purchaseNote === "error";
    const primaryLabel = phase === "offer" ? view.primary.cta : phase === "checking" ? view.checking.confirm : view.notice.cta;
    const onPrimary = phase === "offer" ? () => pressOffer(view.primary) : phase === "checking" ? confirm : pressNotice;
    const primaryCard = !notice ? view.primary.card : null;
    const primaryBusy = verifying || buying === "primary";
    /** Enquanto compra, nenhum botão responde (o tocado mostra o spinner; os outros ficam apagados). */
    const locked = verifying || buying !== null;

    return (
        <>
            <ScrollView
                style={fill ? styles.scrollFill : styles.scrollFit}
                contentContainerStyle={[styles.scrollContent, fill && !showBanner && styles.scrollCentered]}
                bounces={false}
                showsVerticalScrollIndicator={false}>
                {media}
                <View style={styles.textBlock}>
                    <Text style={[styles.title, {color: colors.text}, dir.writing]} accessibilityRole="header">
                        {dir.mark + title}
                    </Text>
                    <Text style={[styles.body, {color: colors.textSecondary}, dir.writing]}>{dir.mark + body}</Text>
                    {!notice && view.bullets.length > 0 && (
                        <View style={styles.bullets}>
                            {view.bullets.map((bullet, index) => (
                                <View key={index} style={[styles.bulletRow, {flexDirection: dir.row}]}>
                                    <View style={[styles.bulletIcon, {backgroundColor: colors.bulletFill}]}>
                                        <Text style={[styles.bulletCheck, {color: colors.primary}]}>{"\u2713"}</Text>
                                    </View>
                                    <Text style={[styles.bulletText, {color: colors.text}, dir.start]}>{dir.mark + bullet}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                    {primaryCard && <OfferCard card={primaryCard} colors={colors} dir={dir} />}
                    {!notice && view.date ? (
                        <View style={[styles.datePill, {backgroundColor: colors.chip}]}>
                            <Text style={[styles.dateText, {color: colors.textSecondary}, dir.writing]}>{dir.mark + view.date}</Text>
                        </View>
                    ) : null}
                </View>
            </ScrollView>

            <View style={[styles.footer, {paddingBottom: bottomInset}]}>
                {hint ? (
                    <Text style={[styles.hint, {color: hintWarning ? colors.warning : colors.textSecondary}, dir.writing]} accessibilityLiveRegion="polite">
                        {dir.mark + hint}
                    </Text>
                ) : null}
                <TouchableOpacity
                    onPress={onPrimary}
                    disabled={locked}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{busy: primaryBusy, disabled: locked}}
                    style={[styles.primaryButton, locked && !primaryBusy && styles.dimmed]}>
                    <SquircleFill radius={BUTTON_RADIUS} color={colors.primary} />
                    {primaryBusy ? (
                        <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                        <Text style={[styles.primaryText, {color: colors.onPrimary}]} numberOfLines={2}>
                            {primaryLabel}
                        </Text>
                    )}
                </TouchableOpacity>
                {phase === "offer" && view.secondary && (
                    <SecondaryOfferCard
                        item={view.secondary}
                        colors={colors}
                        dir={dir}
                        onPress={() => view.secondary && pressOffer(view.secondary)}
                        busy={buying === "secondary"}
                        disabled={locked}
                    />
                )}
                <TouchableOpacity
                    onPress={() => onClose("dismiss")}
                    disabled={buying !== null}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{disabled: buying !== null}}
                    style={[styles.secondaryButton, buying !== null && styles.dimmed]}>
                    <Text style={[styles.secondaryText, {color: colors.textSecondary}]} numberOfLines={2}>
                        {view.dismiss}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* puxador: absoluto sobre o topo da folha (claro sobre a imagem, como no promo) */}
            <View style={styles.handleArea} pointerEvents="none">
                <View style={[styles.handle, {backgroundColor: showBanner ? "rgba(255,255,255,0.75)" : colors.handle}]} />
            </View>
        </>
    );
}

// ─── iOS: pageSheet nativo ─────────────────────────────────────────────────────

type ModalProps = {request: RetentionRequest; onClosed: (method: RetentionCloseMethod) => void};

function RetentionPageSheet({request, onClosed}: ModalProps) {
    const colors = useColors();
    const insets = useInsets();
    const closedRef = useRef(false);
    useEffect(() => {
        closedRef.current = false;
    }, [request.id]);

    // Desmontar o Modal já dispensa a folha com animação; o pai desmonta assim que o pedido sai.
    const close = (method: RetentionCloseMethod) => {
        if (closedRef.current) return;
        closedRef.current = true;
        onClosed(method);
    };

    return (
        <Modal
            visible
            animationType="slide"
            presentationStyle="pageSheet"
            allowSwipeDismissal
            onRequestClose={() => close("swipe")}>
            <View style={[styles.pageRoot, {backgroundColor: colors.background}]}>
                <RetentionBody request={request} colors={colors} onClose={close} bottomInset={Math.max(insets.bottom, 16)} fill />
            </View>
        </Modal>
    );
}

// ─── Android: bottom sheet (padrão do promo) ───────────────────────────────────

function RetentionBottomSheet({request, onClosed}: ModalProps) {
    const colors = useColors();
    const insets = useInsets();
    const {height: windowHeight} = useWindowDimensions();
    const slide = useRef(new Animated.Value(windowHeight)).current;
    const backdrop = useRef(new Animated.Value(0)).current;
    const drag = useRef(new Animated.Value(0)).current;
    const closingRef = useRef(false);

    const close = (method: RetentionCloseMethod) => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.parallel([
            Animated.timing(slide, {toValue: windowHeight, duration: 240, useNativeDriver: true}),
            Animated.timing(backdrop, {toValue: 0, duration: 200, useNativeDriver: true}),
        ]).start(() => onClosed(method));
    };
    const closeRef = useRef(close);
    closeRef.current = close;

    // Entrada (de novo a cada pedido: um show durante a saída traz a folha de volta).
    useEffect(() => {
        closingRef.current = false;
        drag.setValue(0);
        Animated.parallel([
            Animated.spring(slide, {toValue: 0, tension: 65, friction: 11, useNativeDriver: true}),
            Animated.timing(backdrop, {toValue: 1, duration: 250, useNativeDriver: true}),
        ]).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request.id]);

    // Arrastar para baixo fecha. Com o conteúdo cabendo, o ScrollView não intercepta o gesto.
    const pan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
            onPanResponderMove: (_, gesture) => {
                if (gesture.dy > 0) drag.setValue(gesture.dy);
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dy > 100 || gesture.vy > 0.5) {
                    closeRef.current("swipe");
                } else {
                    Animated.spring(drag, {toValue: 0, useNativeDriver: true}).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.spring(drag, {toValue: 0, useNativeDriver: true}).start();
            },
        }),
    ).current;

    return (
        <Modal visible transparent animationType="none" onRequestClose={() => close("back")}>
            <View style={styles.sheetContainer}>
                <Animated.View style={[StyleSheet.absoluteFill, {backgroundColor: colors.overlay, opacity: backdrop}]}>
                    {/* fora da árvore de acessibilidade: quem usa leitor de tela fecha pelo "Agora não" */}
                    <Pressable style={styles.fill} onPress={() => close("overlay")} accessible={false} importantForAccessibility="no" />
                </Animated.View>
                <Animated.View
                    {...pan.panHandlers}
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.background,
                            maxHeight: windowHeight - insets.top - 24,
                            transform: [{translateY: Animated.add(slide, drag)}],
                        },
                    ]}>
                    <RetentionBody request={request} colors={colors} onClose={close} bottomInset={Math.max(insets.bottom, 12)} fill={false} />
                </Animated.View>
            </View>
        </Modal>
    );
}

function RetentionModal(props: ModalProps) {
    return Platform.OS === "ios" ? <RetentionPageSheet {...props} /> : <RetentionBottomSheet {...props} />;
}

/** Lê o pedido aberto (RetentionEvents) e desenha o modal. */
function RetentionModalHost() {
    const [request, setRequest] = useState<RetentionRequest | null>(() => RetentionEvents.getCurrent());

    useEffect(() => {
        const sync = () => setRequest(RetentionEvents.getCurrent());
        sync(); // pedido feito antes deste host montar (ou durante a troca de dono)
        const offShow = RetentionEvents.onShow(sync);
        const offHide = RetentionEvents.onHide(sync);
        // `retention_close` de todo fechamento (inclusive o `hidden` do RetentionEvents.hide()); a pré-visualização não conta.
        const offClosed = RetentionEvents.onClosed((event) => logRetentionClose(event.request, event.method));
        return () => {
            offShow();
            offHide();
            offClosed();
        };
    }, []);

    // `retention_impression` 1x por pedido desenhado (o helper ignora o mesmo id quando o host remonta).
    useEffect(() => {
        if (request) logRetentionImpression(request);
    }, [request]);

    if (!request) return null;
    return <RetentionModal request={request} onClosed={(method) => RetentionEvents.closed(request.id, method)} />;
}

// ─── Dono único: vários componentes da lib montam o slot, só um desenha ─────────

type Slot = {id: number; priority: number};
const slots: Slot[] = [];
const ownerListeners = new Set<() => void>();
let ownerId: number | null = null;
let slotSequence = 0;

const recomputeOwner = () => {
    let best: Slot | null = null;
    for (const slot of slots) if (!best || slot.priority < best.priority) best = slot; // empate: o 1º que montou
    const next = best ? best.id : null;
    if (next === ownerId) return;
    ownerId = next;
    ownerListeners.forEach((listener) => listener());
};
const subscribeOwner = (listener: () => void) => {
    ownerListeners.add(listener);
    return () => {
        ownerListeners.delete(listener);
    };
};
const getOwner = () => ownerId;

/**
 * Ponto de montagem do modal de retenção. Vários podem estar montados (ExpoUtilsLayout = 0,
 * AskForReviewOverlay = 1, PromotionalContent = 2); só o de menor `priority` desenha, e se ele
 * desmontar o próximo assume. App sem nenhum desses componentes pode montar um à mão.
 */
export function RetentionModalSlot({priority = 1}: {priority?: number}) {
    const [id] = useState(() => ++slotSequence);
    const owner = useSyncExternalStore(subscribeOwner, getOwner, getOwner);

    useEffect(() => {
        slots.push({id, priority});
        recomputeOwner();
        return () => {
            const index = slots.findIndex((slot) => slot.id === id);
            if (index >= 0) slots.splice(index, 1);
            recomputeOwner();
        };
    }, [id, priority]);

    return owner === id ? <RetentionModalHost /> : null;
}

export default RetentionModalSlot;

const styles = StyleSheet.create({
    fill: {
        flex: 1,
        width: "100%",
        height: "100%",
    },
    pageRoot: {
        flex: 1,
    },
    sheetContainer: {
        flex: 1,
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
        overflow: "hidden",
    },
    handleArea: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingVertical: 10,
    },
    handle: {
        width: 36,
        height: 5,
        borderRadius: 3,
    },
    scrollFill: {
        flex: 1,
    },
    scrollFit: {
        flexGrow: 0,
        flexShrink: 1,
    },
    scrollContent: {
        paddingBottom: 8,
    },
    scrollCentered: {
        flexGrow: 1,
        justifyContent: "center",
    },
    /* Largura e altura explícitas: <Image> sem elas herda o tamanho intrínseco (ver AGENTS.md). */
    banner: {
        width: "100%",
        overflow: "hidden",
        marginBottom: 20,
    },
    iconWrap: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        alignSelf: "center",
        marginTop: 36,
        marginBottom: 20,
        overflow: "hidden",
    },
    noMedia: {
        height: 36,
    },
    // Cartão de pagamento com alerta (falha de pagamento): 118×76 com o alerta no canto de baixo.
    illustration: {
        width: 136,
        height: 96,
        alignSelf: "center",
        marginTop: 36,
        marginBottom: 20,
    },
    payCard: {
        position: "absolute",
        left: 0,
        top: 2,
        width: 118,
        height: 76,
        borderRadius: 12,
        overflow: "hidden",
    },
    payStripe: {
        marginTop: 12,
        height: 14,
    },
    payChip: {
        width: 20,
        height: 15,
        borderRadius: 4,
        backgroundColor: CHIP_GOLD,
        marginTop: 8,
        marginLeft: 12,
    },
    payDigits: {
        flexDirection: "row",
        gap: 6,
        marginTop: 9,
        marginLeft: 12,
    },
    payDigitGroup: {
        width: 17,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.55)",
    },
    alertBadge: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 3,
        alignItems: "center",
        justifyContent: "center",
    },
    alertMark: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: "800",
    },
    noticeWrap: {
        alignSelf: "center",
        marginTop: 36,
        marginBottom: 20,
    },
    noticeCircle: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
    },
    noticeCheck: {
        fontSize: 40,
        lineHeight: 46,
        fontWeight: "700",
    },
    textBlock: {
        paddingHorizontal: 24,
        alignItems: "center",
    },
    title: {
        fontSize: 22,
        lineHeight: 28,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 8,
    },
    body: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
    },
    bullets: {
        alignSelf: "center",
        maxWidth: "100%",
        marginTop: 18,
        gap: 10,
    },
    bulletRow: {
        alignSelf: "stretch",
        alignItems: "center",
        gap: 12,
    },
    bulletIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    bulletCheck: {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "700",
    },
    bulletText: {
        flexShrink: 1,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "500",
    },
    // Cartão da oferta principal
    offerCard: {
        alignSelf: "stretch",
        alignItems: "center",
        marginTop: 18,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 6,
    },
    cardTitle: {
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "600",
        textAlign: "center",
    },
    cardPeriod: {
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "600",
        textAlign: "center",
    },
    cardNote: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: "center",
    },
    badge: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    badgeSmall: {
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    badgeText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "800",
    },
    badgeTextSmall: {
        fontSize: 12,
        lineHeight: 16,
    },
    priceLine: {
        alignItems: "baseline",
        justifyContent: "center",
        flexWrap: "wrap",
        columnGap: 8,
    },
    priceLineSmall: {
        alignItems: "center",
        justifyContent: "flex-start",
        columnGap: 6,
        marginTop: 2,
    },
    price: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: "800",
    },
    per: {
        fontSize: 16,
        fontWeight: "600",
    },
    struck: {
        fontSize: 16,
        lineHeight: 22,
        textDecorationLine: "line-through",
    },
    priceSmall: {
        fontSize: 16,
        lineHeight: 21,
        fontWeight: "700",
    },
    perSmall: {
        fontSize: 13,
        fontWeight: "600",
    },
    struckSmall: {
        fontSize: 13,
        lineHeight: 18,
        textDecorationLine: "line-through",
    },
    codePill: {
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    codePillSmall: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    codeText: {
        fontSize: 20,
        lineHeight: 26,
        fontWeight: "700",
        letterSpacing: 1.5,
    },
    codeTextSmall: {
        fontSize: 14,
        lineHeight: 18,
        letterSpacing: 1,
    },
    datePill: {
        marginTop: 18,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    dateText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "600",
        textAlign: "center",
    },
    footer: {
        paddingHorizontal: 24,
        paddingTop: 12,
        gap: 4,
    },
    hint: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: "center",
        marginBottom: 8,
    },
    // sem borderRadius/overflow: qualquer um dos dois recortaria o squircle num canto circular
    primaryButton: {
        minHeight: 52,
        paddingHorizontal: 16,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryText: {
        fontSize: 16,
        lineHeight: 20,
        fontWeight: "700",
        textAlign: "center",
    },
    // 2ª oferta: cartão tocável com o botão pequeno no fim da linha
    secondaryCard: {
        alignItems: "center",
        gap: 12,
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    secondaryInfo: {
        flex: 1,
        gap: 2,
    },
    secondaryTitle: {
        fontSize: 14,
        lineHeight: 19,
        fontWeight: "600",
    },
    secondaryCodeRow: {
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 2,
    },
    secondaryNote: {
        fontSize: 12,
        lineHeight: 16,
    },
    secondaryCta: {
        maxWidth: "45%",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    secondaryCtaText: {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "700",
        textAlign: "center",
    },
    secondaryButton: {
        paddingVertical: 12,
        alignItems: "center",
    },
    dimmed: {
        opacity: DIMMED,
    },
    secondaryText: {
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center",
    },
});
