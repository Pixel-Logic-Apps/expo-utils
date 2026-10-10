// Canal do modal de retenção: evento no DeviceEventEmitter, no mesmo padrão do AskForReviewEvents.
// Quem desenha é o RetentionModalSlot (utils/retention-modal.tsx), montado pelo ExpoUtilsLayout e pelos
// overlays da lib — o app não ganha linha nova.
//
// Com compra de verdade, quem abre é o `showRetention` (utils/retention-show.ts): lê o customerInfo,
// confere as ofertas na loja (utils/retention-store.ts) e chama `RetentionEvents.show({segment, offers,
// variant, productIdentifier, expirationDate, managementURL, style})` com elas já conferidas e com preço. Sem
// `segment`/`offers` é o pedido da fase 1 (trial cancelado + "Reativar").
// Módulo-folha de propósito (só react-native, expo-localization e módulos puros): o Utils.ts importa
// daqui o item do menu de dev — por isso o `showRetention`, que importa o SDK, mora em outro arquivo.
import {DeviceEventEmitter, Platform} from "react-native";
import {getLocales} from "expo-localization";
import {
    buildRetentionPreviewOffer,
    isRetentionSegment,
    resolveRetentionOfferInput,
    retentionPreviewCurrency,
    RESUBSCRIBE_OFFER,
    type RetentionModalState,
    type RetentionOffer,
    type RetentionOfferInput,
} from "./retention-offers";
import {retentionVariantFromConfig, type RetentionVariant} from "./retention-texts";
import type {RemoteConfigUtilsType, RetentionSegment, RetentionStyle} from "./types";

export type {RetentionVariant};

const RETENTION_STYLES: readonly RetentionStyle[] = ["bottomsheet", "fullscreen"];
const isRetentionStyle = (value: unknown): value is RetentionStyle => RETENTION_STYLES.includes(value as RetentionStyle);

/**
 * Formato do modal: o do pedido → `retention.style` do Remote Config → o padrão da plataforma (`fullscreen`, o
 * pageSheet, no iOS; `bottomsheet` no Android). Valor desconhecido (e o `sheet` da fase 1) cai no próximo.
 */
export const resolveRetentionStyle = (requested?: unknown, remote?: unknown, os: string = Platform.OS): RetentionStyle =>
    isRetentionStyle(requested) ? requested : isRetentionStyle(remote) ? remote : os === "ios" ? "fullscreen" : "bottomsheet";

export interface RetentionShowPayload {
    /** Situação da pessoa na assinatura. Padrão: `trial_cancelled` (fase 1). */
    segment?: RetentionSegment;
    /**
     * Ofertas na ordem do Remote Config, já com o preço da loja: a 1ª é o botão principal e a 2ª vira
     * o cartão abaixo dele (as outras são ignoradas). Sem nenhuma: `resubscribe`.
     */
    offers?: RetentionOffer[];
    /** `lifetime_notice` abre direto no aviso de cancelar a assinatura antiga (vitalício comprado com falha de pagamento). */
    state?: RetentionModalState;
    /** Sem ela, sai do Remote Config: `is_opted_out_trial_enabled: true` → premium_kept. */
    variant?: RetentionVariant;
    /** Produto do entitlement (no Android, `assinatura:basePlan`). */
    productIdentifier?: string | null;
    /** Fim do teste/período: ISO do `expirationDate` do entitlement. Sem ela, o modal não mostra a linha da data. */
    expirationDate?: string | number | Date | null;
    /** `customerInfo.managementURL`. No Android é o que o "Reativar" abre (sem ela, a página de assinaturas do Play). */
    managementURL?: string | null;
    /** Pré-visualização: nenhuma chamada ao RevenueCat nem à loja; os botões só registram no log e seguem o fluxo. */
    preview?: boolean;
    /** Força a língua do texto ("ar", "ja", "pt-BR"…), independente do aparelho. */
    locale?: string;
    /** Imagem no lugar do `retention.image_url` do Remote Config. */
    imageUrl?: string;
    /** Sem bullets no Remote Config, mostra os da lib. */
    defaultBullets?: boolean;
    /**
     * Formato do modal (`bottomsheet` ou `fullscreen`). Sem ele, sai do `retention.style` do Remote Config e, sem
     * esse, do padrão da plataforma: `fullscreen` no iOS, `bottomsheet` no Android.
     */
    style?: RetentionStyle;
}

export interface RetentionRequest extends RetentionShowPayload {
    id: number;
    variant: RetentionVariant;
    segment: RetentionSegment;
    offers: RetentionOffer[];
    state: RetentionModalState;
    style: RetentionStyle;
}

/**
 * Como o modal fechou: `dismiss` (Agora não), `swipe` (arrastou para baixo), `back` (voltar do
 * Android), `overlay` (toque fora, Android), `confirmed` (botão concluído na pré-visualização: "Já
 * reativei", compra simulada, aviso), `recovered` (Já reativei e o RevenueCat confirmou), `purchased`
 * (compra feita na loja), `redeem` (abriu o resgate do código), `hidden` (RetentionEvents.hide()).
 */
export type RetentionCloseMethod = "dismiss" | "swipe" | "back" | "overlay" | "confirmed" | "recovered" | "purchased" | "redeem" | "hidden";

export interface RetentionClosedEvent {
    request: RetentionRequest;
    method: RetentionCloseMethod;
}

const SHOW_EVENT = "expoUtilsRetentionShow";
const HIDE_EVENT = "expoUtilsRetentionHide";
const CLOSED_EVENT = "expoUtilsRetentionClosed";

// Pedido atual fora da árvore: um show emitido antes de algum slot montar (ou durante a troca de
// dono do slot) não se perde — o slot lê o pedido ao montar.
let current: RetentionRequest | null = null;
let sequence = 0;

const remoteConfig = (): RemoteConfigUtilsType | undefined => (global as any).remoteConfigUtils;

export class RetentionEvents {
    static readonly showEventName = SHOW_EVENT;
    static readonly hideEventName = HIDE_EVENT;
    static readonly closedEventName = CLOSED_EVENT;

    /** Abre o modal (troca o pedido aberto, se houver). Devolve o pedido com o id. */
    static show(payload: RetentionShowPayload = {}): RetentionRequest {
        current = {
            ...payload,
            segment: isRetentionSegment(payload.segment) ? payload.segment : "trial_cancelled",
            offers: Array.isArray(payload.offers) && payload.offers.length > 0 ? payload.offers : [RESUBSCRIBE_OFFER],
            state: payload.state === "lifetime_notice" ? "lifetime_notice" : "offer",
            variant: payload.variant ?? retentionVariantFromConfig(remoteConfig()),
            style: resolveRetentionStyle(payload.style, remoteConfig()?.retention?.style),
            id: ++sequence,
        };
        DeviceEventEmitter.emit(SHOW_EVENT, current);
        return current;
    }

    /** Fecha o modal por fora (ex.: a detecção viu a reativação com o modal aberto). */
    static hide(): void {
        if (current) RetentionEvents.closed(current.id, "hidden");
    }

    static getCurrent(): RetentionRequest | null {
        return current;
    }

    static isVisible(): boolean {
        return current !== null;
    }

    static onShow(callback: (request: RetentionRequest) => void): () => void {
        const subscription = DeviceEventEmitter.addListener(SHOW_EVENT, callback);
        return () => subscription.remove();
    }

    static onHide(callback: () => void): () => void {
        const subscription = DeviceEventEmitter.addListener(HIDE_EVENT, callback);
        return () => subscription.remove();
    }

    /** Depois de fechar, com o motivo (o modal registra o `retention_close` daqui, fora da pré-visualização). */
    static onClosed(callback: (event: RetentionClosedEvent) => void): () => void {
        const subscription = DeviceEventEmitter.addListener(CLOSED_EVENT, callback);
        return () => subscription.remove();
    }

    /** @internal Chamado pelo modal ao fechar. Pedido antigo (id diferente do atual) é ignorado. */
    static closed(id: number, method: RetentionCloseMethod): void {
        if (!current || current.id !== id) return;
        const event: RetentionClosedEvent = {request: current, method};
        current = null;
        DeviceEventEmitter.emit(HIDE_EVENT);
        DeviceEventEmitter.emit(CLOSED_EVENT, event);
    }
}

export interface RetentionPreviewOptions {
    /** Padrão: o que o Remote Config daria (`is_opted_out_trial_enabled`). Vale para `trial_cancelled` e `cancelled`. */
    variant?: RetentionVariant;
    /** Língua do texto, independente do aparelho ("ar" sai da direita para a esquerda). Também escolhe a moeda falsa. */
    locale?: string;
    imageUrl?: string;
    /** Fim do teste/período. Padrão: daqui a 5 dias (`trial_cancelled`) ou 12 (`cancelled`); os outros segmentos não têm data. */
    expirationDate?: Date;
    /** Mostra os bullets padrão da lib (os do Remote Config, se houver, vêm sempre). */
    bullets?: boolean;
    /** Segmento. Padrão: `trial_cancelled`. */
    segment?: RetentionSegment;
    /**
     * Ofertas na ordem: nomes (`resubscribe`/`winback` embutidas, as de `retention.offers` do Remote
     * Config, as de exemplo `discount_50`/`lifetime_deal`/`promo_code` ou o próprio tipo) e/ou objetos no
     * formato do Remote Config (`{type: "lifetime", compare_product_id: "lifetime"}`). Padrão: a lista do
     * segmento no Remote Config; sem ela, `resubscribe` (`lifetime_deal` no `free`).
     */
    offers?: RetentionOfferInput[];
    /** `lifetime_notice` abre direto no aviso pós-compra do vitalício. */
    state?: RetentionModalState;
    /** Formato do modal. Padrão: o do Remote Config (`retention.style`) e, sem ele, o da plataforma. */
    style?: RetentionStyle;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Dias até o fim do teste/período na pré-visualização (só os segmentos que mostram a data). */
const PREVIEW_DAYS: Partial<Record<RetentionSegment, number>> = {trial_cancelled: 5, cancelled: 12};

const deviceLanguage = (): string => {
    try {
        const locale = getLocales()[0];
        return locale?.languageTag || locale?.languageCode || "en";
    } catch {
        return "en";
    }
};

/**
 * Abre o modal de verdade com dados falsos e sem RevenueCat/loja: preços de exemplo (BRL em português,
 * USD nas outras línguas), e os botões só registram no log e seguem o fluxo ("Reativar" → conferindo,
 * vitalício com falha de pagamento → aviso, compra → fecha). Não depende do `retention.enabled` do
 * Remote Config. Também no menu de dev ("Simular trial cancelado").
 */
export function showRetentionPreview(options: RetentionPreviewOptions = {}): RetentionRequest {
    const segment: RetentionSegment = isRetentionSegment(options.segment) ? options.segment : "trial_cancelled";
    const days = PREVIEW_DAYS[segment];
    const expirationDate = options.expirationDate ?? (days ? new Date(Date.now() + days * DAY_MS) : null);
    const retention = remoteConfig()?.retention;
    const inputs: RetentionOfferInput[] = options.offers ?? retention?.segments?.[segment]?.offers ?? [segment === "free" ? "lifetime_deal" : "resubscribe"];
    const currency = retentionPreviewCurrency(options.locale || deviceLanguage());
    const platform = Platform.OS === "android" ? "android" : "ios";
    const offers: RetentionOffer[] = [];
    for (const input of Array.isArray(inputs) ? inputs : []) {
        const resolved = resolveRetentionOfferInput(input, retention?.offers);
        if (resolved) offers.push(buildRetentionPreviewOffer(resolved.name, resolved.config, {currency, platform}));
        else if (typeof __DEV__ !== "undefined" && __DEV__) {
            // eslint-disable-next-line no-console
            console.warn("[expo-utils] retention preview: oferta desconhecida ignorada:", input);
        }
    }
    return RetentionEvents.show({
        segment,
        offers,
        state: options.state,
        variant: options.variant,
        productIdentifier: "expo_utils_preview",
        expirationDate: expirationDate ? expirationDate.toISOString() : null,
        managementURL: null,
        preview: true,
        locale: options.locale,
        imageUrl: options.imageUrl,
        defaultBullets: options.bullets === true,
        style: options.style,
    });
}
