export interface FacebookConfig {
    appID: string;
    clientToken?: string;
    displayName?: string;
    scheme?: string;
    advertiserIDCollectionEnabled?: boolean;
    autoLogAppEventsEnabled?: boolean;
    isAutoInitEnabled?: boolean;
}

export interface RevenueCatKeys {
    androidApiKey: string;
    iosApiKey: string;
}

export interface AppConfig {
    expo: {
        slug: string;
        ios: {bundleIdentifier: string};
        android: {package: string};
        plugins?: Array<string | [string, any]>;
    };
}

export interface AdUnits {
    appOpen?: string;
    banner?: string;
    interstitial?: string;
    rewarded?: string;
}

export interface AppStrings {
    rckey?: string;
    adUnits?: AdUnits;
    hotUpdaterUrl?: string;
    /**
     * "Install Referrer Decryption Key" do app na Meta (Meta for Developers → App settings → Basic →
     * Android). Abre a campanha/conjunto/anúncio dos installs vindos de anúncio da Meta no Android.
     * Também aceita pelo Remote Config (`meta_install_referrer_key`), que tem prioridade.
     */
    metaInstallReferrerKey?: string;
    [key: string]: any;
}

export type PromotionalType = "bottom-sheet" | "card-banner-bottom" | "banner" | "fullscreen" | "notification";

export type PromotionalShadow = {
    color?: string;
    offsetX?: number;
    offsetY?: number;
    opacity?: number;
    radius?: number;
    elevation?: number;
};

export type PromotionalConfig = {
    enabled: boolean;
    type: PromotionalType;
    icon: string;
    name: string;
    description: string;
    buttonText: string;
    gradientColors: [string, string];
    primaryColor: string;
    storeUrl: string;
    delayMs?: number;
    imageUrl?: string;
    videoUrl?: string;
    bannerHeight?: number;
    showDontShowAgain?: boolean;
    closeBtnDelayMs?: number;
    shadow?: PromotionalShadow;
    notificationTitle?: string;
    notificationBody?: string;
    position?: "top" | "bottom";
    notificationCompact?: boolean;
    targetScreens?: string[];
    nthImpression?: string;
};

/**
 * Layout do AskForReviewOverlay.
 *  - `bottomsheet` card ancorado embaixo, com respiro lateral, botoes lado a lado.
 *                  PADRAO e comportamento historico — app que nao setar nada nao muda.
 *  - `formsheet`   sheet colado nas bordas (100% de largura, sem padding lateral) ocupando
 *                  1/3 da altura da tela; a midia encolhe pra caber, botoes lado a lado.
 *  - `centered`    card no meio da tela, botoes empilhados e de largura total.
 *  - `fullscreen`  tela inteira com X no canto, botoes empilhados, de largura total e
 *                  ancorados no rodape.
 */
export type ReviewStyle = "bottomsheet" | "formsheet" | "centered" | "fullscreen";

/**
 * Textos do modal de retenção numa língua (`retention.texts.<lingua>`). Campo ausente cai no texto
 * da lib naquela língua e, sem ele, no inglês. Mesmos limites da Retention Messaging da Apple:
 * título e cada bullet até 66 caracteres, texto até 144.
 *
 * Chaves (todas opcionais):
 *  - `<segmento>.title`, `<segmento>.body`, `<segmento>.bullets`, `<segmento>.date` (linha com `{date}`);
 *  - `offers.<nome>.cta`, `.title`, `.period`, `.terms`, `.badge`, `.hint` (cartão e botão daquela oferta);
 *  - `notice.title`, `notice.body`, `notice.cta` (aviso depois do vitalício comprado com falha de pagamento);
 *  - `dismiss` ("Agora não", em todos os segmentos);
 *  - legado da fase 1, valem para `trial_cancelled`: `header`, `body`, `bullets` e `cta` (botão do `resubscribe`).
 *
 * Variáveis: `{app}`, `{price}`, `{original_price}`, `{discount}`, `{period}`, `{date}`, `{code}` e
 * `{per}` ("/mês"). Nos textos do segmento valem as da 1ª oferta; no cartão, as da própria oferta.
 */
export type RetentionTexts = {
    header?: string;
    body?: string;
    bullets?: string[];
    cta?: string;
    dismiss?: string;
    [key: string]: string | string[] | undefined;
};

/**
 * Situação da pessoa na assinatura (mesmo nome do `rc_status` de `utils/rc-status.ts`). `trial`,
 * `intro` e `active` nunca recebem oferta, por isso não estão aqui.
 */
export type RetentionSegment = "trial_cancelled" | "cancelled" | "billing_issue" | "expired" | "trial_expired" | "free";

/**
 * O que a oferta faz (o `type` de `retention.offers.<nome>`):
 *  - `resubscribe` (embutida): voltar com a MESMA assinatura de antes, pelo preço normal — reativar a
 *    renovação (`trial_cancelled`/`cancelled`), atualizar o pagamento (`billing_issue`) ou assinar de
 *    novo (`expired`/`trial_expired`);
 *  - `winback` (embutida): win-back da Apple (iOS 18+; a Apple decide quem é elegível);
 *  - `discount`: desconto na assinatura (promotional offer no iOS, oferta com tag no Android);
 *  - `subscription`: uma assinatura específica (`product_id`) pelo preço normal;
 *  - `lifetime`: compra única;
 *  - `offer_code`: código promocional da loja.
 */
export type RetentionOfferType = "resubscribe" | "winback" | "discount" | "subscription" | "lifetime" | "offer_code";

/** Unidade de período da loja (cobrança "/mês" e duração do desconto "nos 3 primeiros meses"). */
export type RetentionPeriodUnit = "day" | "week" | "month" | "year";

/** Regras de um segmento (`retention.segments.<segmento>`). Sem lista de ofertas, o segmento não vê nada. */
export type RetentionSegmentConfig = {
    /** Nomes das ofertas, na ordem: a 1ª é o botão principal; a 2ª vira o cartão abaixo dele. */
    offers: string[];
    max_shows?: number;
    min_interval_hours?: number;
    /** Lembrete antes do fim do teste/período (`trial_cancelled`, `cancelled`). */
    reminder_hours_before_end?: number;
    /** Depois disso (dias desde o vencimento) não mostra mais (`expired`, `trial_expired`). */
    max_days_after_expiration?: number;
    /** `free`: só depois de N recusas do paywall. */
    after_paywall_dismissals?: number;
};

/**
 * Uma oferta declarada em `retention.offers.<nome>`. O preço vem sempre da loja.
 *  - Sem `product_id`: vale para o MESMO produto de assinatura que a pessoa tinha.
 *  - Com `product_id`: vale para aquele produto específico.
 */
export type RetentionOfferConfig = {
    type: RetentionOfferType;
    product_id?: string;
    /** Produto de comparação: dele saem o preço riscado e o selo "−40%". */
    compare_product_id?: string;
    /** `discount` no iOS: id da promotional offer no App Store Connect. */
    ios_offer_id?: string;
    /** `discount` no Android: tag da oferta no base plan do Play Console. */
    android_offer_tag?: string;
    /** `offer_code`: código mostrado no iOS (offer code da App Store). */
    ios_code?: string;
    /** `offer_code`: código mostrado no Android (código promocional do Play). */
    android_code?: string;
};

/**
 * Retenção (chave `retention` do parâmetro `utils`). Sem a chave fica DESLIGADO, e a lib não tem
 * regra própria de "quem vê o quê": cada segmento mostra só a lista de `segments.<segmento>.offers`,
 * na ordem dela. `resubscribe` e `winback` são embutidas (não precisam estar em `offers`).
 * Planos: `docs/PLANO-RETENCAO-OFERTAS.md` e `docs/PLANO-RETENCAO-TRIAL-CANCELADO.md`.
 * O motor que decide sozinho quando abrir ainda não existe: hoje só a interface e a pré-visualização.
 */
export type RetentionConfig = {
    enabled?: boolean;
    segments?: Partial<Record<RetentionSegment, RetentionSegmentConfig>>;
    /** Ofertas por nome (o nome você inventa; o que vale é o `type`). */
    offers?: Record<string, RetentionOfferConfig>;
    /** https; pode ser a mesma imagem enviada à Apple (PNG de 3840 px de largura). Sem ela, o ícone do app. */
    image_url?: string;
    /** Por língua (`pt`, `en`…): ver RetentionTexts. */
    texts?: Record<string, RetentionTexts>;
    /** Legado (fase 1). Só "sheet": pageSheet nativo no iOS, bottom sheet no Android. */
    style?: "sheet";
    /** Legado (fase 1): o equivalente novo é `segments.<segmento>.max_shows`. */
    max_shows?: number;
    /** Legado (fase 1): o equivalente novo é `segments.trial_cancelled.reminder_hours_before_end`. */
    reminder_hours?: number;
};

export interface RemoteConfigUtilsType {
    is_ads_enabled: boolean;
    min_version: number;
    ios_app_id: string;
    review_type?: string; // "store-review" | "popup" | "dialog"
    /** ms até habilitar "Agora não" no AskForReviewOverlay (prop `delay`). */
    review_type_delay?: number;
    /** ms antes do review aparecer (askForReview). Override local: 3º arg `showDelay`. */
    review_show_delay?: number;
    /**
     * Layout do AskForReviewOverlay, trocável sem release. Override local: prop `variant`.
     * Ausente ou inválido cai em `bottomsheet` (o layout histórico).
     */
    review_style?: ReviewStyle;
    /**
     * Mostra o tutorial animado da Play Store no AskForReviewOverlay (prop `tutorial`)
     * em vez da imagem estática. Android apenas; requer `react-native-webview`.
     */
    review_tutorial_enabled?: boolean;
    /**
     * HTML completo substituindo o tutorial embutido. Serve para corrigir um redesenho
     * da Play Store sem release — o app usa este valor se presente.
     */
    review_tutorial_html?: string;
    repeat_ads_count?: number;
    ad_blocklist?: string[];
    /** Eventos Taichi habilitados: ausente = todos os 60; [] = nenhum. Nomes em docs/ANALYTICS-EVENTS.md. */
    taichi_events?: string[];
    promotional?: PromotionalConfig;
    tiktokads?: {token: string; appid: string; tkappid: string; isdebug: boolean};
    clarity_id?: string;
    trends_tracking_url?: string;
    is_opted_out_trial_enabled?: boolean;
    /** Retenção (trial cancelado, falha de pagamento, vencido…). Ausente = desligado. Ver RetentionConfig. */
    retention?: RetentionConfig;
    // Fallback de versão da loja para Utils.disableAdsIfBuildIsNewerThanStore
    // (usado quando o lookup na loja falha ou o app ainda não é encontrado).
    ios_store_version?: string;
    android_store_version?: string;
    /**
     * Geo por IP (país/estado/cidade como atributos do customer no RevenueCat). LIGADA por
     * padrão; `false` desliga sem build novo. Ver `utils/geo.ts`.
     */
    geo_lookup_enabled?: boolean;
    /**
     * Endpoint PRÓPRIO de geo (https), tentado antes dos provedores gratuitos embutidos.
     * Contrato da resposta: `{country, region, regionCode, city}` (ex.: Cloudflare Worker
     * devolvendo `request.cf`).
     */
    geo_lookup_url?: string;
    /** Chave de decriptação do install referrer da Meta (hex de 64 chars). Ver `AppStrings.metaInstallReferrerKey`. */
    meta_install_referrer_key?: string;
}

/**
 * Config do cross-promo de portfólio (card que anuncia outro app da casa).
 * Lida de `remoteConfigScreens.cross_promo` — ver `CrossPromoCard`.
 */
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

/**
 * Mapa da key `screens` do Remote Config (features/telas configuráveis do app).
 *
 * `cross_promo` é OBRIGATÓRIO: todo app do portfólio deve ter cross-promo
 * implementado em algum lugar (home, resultado, histórico, settings…). O type
 * força a presença da config; apps que montarem o objeto na mão sem a key
 * quebram no typecheck — é a enforcement da regra de portfólio.
 */
export interface RemoteConfigScreensType {
    cross_promo: CrossPromoConfig;
    [key: string]: any;
}

/**
 * Augmentação global injetada pela própria lib. Como este arquivo é importado em toda a cadeia
 * que usa o expo-utils (Utils -> ./types, o template, o index), o TypeScript carrega esta
 * declaração automaticamente no projeto que instala o pacote — o dev NÃO precisa criar nenhum
 * global.d.ts. Pode acessar via `global.X` ou `globalThis.X` (em runtime são o mesmo objeto).
 */
declare global {
    // Tipa o NOME `global` (Expo/RN não declara por padrão). É idêntico ao @types/node moderno
    // (typeof globalThis), então faz merge sem conflito em apps que já tenham @types/node.
    // eslint-disable-next-line no-var
    var global: typeof globalThis;
    var remoteConfigUtils: RemoteConfigUtilsType;
    // Alias de remoteConfigUtils (mesmo objeto), setado pelo setupGlobalConfigs — nome
    // documentado no CLAUDE.md; o store gate e apps legados leem/escrevem por ele.
    var remoteConfigs: RemoteConfigUtilsType;
    var remoteConfigScreens: RemoteConfigScreensType;
    var isAdsEnabled: boolean;
    // Setada (true) pelo gate fail-closed de versão da loja (Utils.disableAdsIfBuildIsNewerThanStore)
    // quando ele bloqueia os ads. Flag própria do gate — o prepare() não encosta nela; apps podem
    // ler p/ ex. esconder o espaço reservado do banner.
    var adsDisabledByStoreGate: boolean | undefined;
    var adUnits: any;
}
