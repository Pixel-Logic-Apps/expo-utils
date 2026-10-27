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
    /**
     * Servidor do Hot Updater. v0: a URL que termina em `/api/check-update`. v1: a raiz do Worker v1 (outro
     * servidor, sem `/api/check-update`), junto com `hotUpdaterApiKey`.
     */
    hotUpdaterUrl?: string;
    /**
     * Só Hot Updater v1: chave de cliente do servidor (vai no `x-api-key`), a `HOT_UPDATER_API_KEY` do
     * `hot-updater init`. Sem ela o `initHotUpdater` avisa e não roda o OTA. O v0 ignora.
     */
    hotUpdaterApiKey?: string;
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
 *  - `purchase.error`, `purchase.pending` (linha acima do botão quando a compra falha ou fica pendente);
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
 * Formato do modal de retenção, igual nas duas plataformas:
 *  - `bottomsheet`: folha embaixo, da altura do conteúdo, com o app escurecido em cima (toque fora, arrastar para
 *    baixo ou o voltar do Android fecham). Padrão no Android.
 *  - `fullscreen`: folha da altura da tela, com o conteúdo no meio e os botões no rodapé. No iOS é a folha nativa
 *    (`pageSheet`); no Android, uma folha igual, que vai até logo abaixo da status bar. Padrão no iOS.
 */
export type RetentionStyle = "bottomsheet" | "fullscreen";

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
 * `showRetention()` abre com as ofertas conferidas na loja e compra de verdade (`enabled: false` desliga). A
 * detecção que decide sozinha quando abrir (e as regras `max_shows`, `min_interval_hours`…) ainda não existe.
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
    /**
     * Formato do modal nas duas plataformas (os valores de RetentionStyle, escritos aqui para o pldev montar a lista).
     * Ausente, inválido ou `sheet` (o valor da fase 1): o padrão de cada uma, `fullscreen` no iOS e `bottomsheet` no
     * Android. Override local: `style` do `showRetention`.
     */
    style?: "bottomsheet" | "fullscreen" | "sheet";
    /** Legado (fase 1): o equivalente novo é `segments.<segmento>.max_shows`. */
    max_shows?: number;
    /** Legado (fase 1): o equivalente novo é `segments.trial_cancelled.reminder_hours_before_end`. */
    reminder_hours?: number;
};

/** Como o app pede a avaliação (`review_type`). */
export type ReviewType = "store-review" | "popup" | "dialog";

/**
 * Bloco `utils` do Remote Config: o que a lib lê. Fica no parâmetro `settings` (`{utils, screens}`) ou, nos apps que
 * ainda não migraram, no parâmetro `utils`. Ver docs/PLANO-SETTINGS.md.
 *
 * O pldev monta o formulário do Remote Config a partir DESTE tipo, lido com o parser do TypeScript: o tipo e as
 * opções saem do próprio tipo, a dica sai do comentário e as tags dizem o resto — `@section` (grupo do formulário),
 * `@label` (nome na tela), `@default` (o que vale sem a chave, em texto) e `@platform ios|android` (campo que só vale
 * numa plataforma). Campo novo: tipo + comentário com as tags.
 */
export interface RemoteConfigUtilsType {
    /**
     * Liga ou desliga todos os anúncios sem build novo.
     * @section Anúncios
     * @label Anúncios ligados
     * @default ligado em produção
     */
    is_ads_enabled: boolean;
    /**
     * Quantas ações até mostrar um anúncio (quem conta é o app).
     * @section Anúncios
     * @label Ações antes do anúncio
     */
    repeat_ads_count?: number;
    /**
     * Placements que não carregam anúncio.
     * @section Anúncios
     * @label Placements bloqueados
     * @default nenhum
     */
    ad_blocklist?: string[];
    /**
     * Eventos Taichi habilitados: ausente = todos os 60; [] = nenhum. Nomes em docs/ANALYTICS-EVENTS.md.
     * @section Anúncios
     * @label Eventos Taichi
     * @default todos
     */
    taichi_events?: string[];
    /**
     * Abaixo desta versão o app pede para atualizar.
     * @section Loja e versão
     * @label Versão mínima
     * @default 1.0
     */
    min_version: number;
    /**
     * ID numérico da App Store. Usado quando a busca pelo bundle ID falha.
     * @section Loja e versão
     * @label ID da App Store
     * @platform ios
     */
    ios_app_id: string;
    /**
     * Versão na App Store para a trava de anúncios por versão (Utils.disableAdsIfBuildIsNewerThanStore), usada
     * quando a busca na loja falha ou o app ainda não aparece nela.
     * @section Loja e versão
     * @label Versão na App Store
     * @default lida da loja
     * @platform ios
     */
    ios_store_version?: string;
    /**
     * Versão no Google Play para a trava de anúncios por versão (Utils.disableAdsIfBuildIsNewerThanStore), usada
     * quando a busca na loja falha ou o app ainda não aparece nela.
     * @section Loja e versão
     * @label Versão no Google Play
     * @default lida da loja
     * @platform android
     */
    android_store_version?: string;
    /**
     * Como o app pede a avaliação.
     * @section Avaliação
     * @label Tipo
     * @default store-review
     */
    review_type?: ReviewType;
    /**
     * ms até habilitar "Agora não" no AskForReviewOverlay (prop `delay`).
     * @section Avaliação
     * @label Espera do "Agora não" (ms)
     * @default 0
     */
    review_type_delay?: number;
    /**
     * ms antes do review aparecer (askForReview). Override local: 3º arg `showDelay`.
     * @section Avaliação
     * @label Espera para abrir (ms)
     * @default 0
     */
    review_show_delay?: number;
    /**
     * Layout do AskForReviewOverlay, trocável sem release. Override local: prop `variant`.
     * Ausente ou inválido cai em `bottomsheet` (o layout histórico).
     * @section Avaliação
     * @label Layout
     * @default bottomsheet
     */
    review_style?: ReviewStyle;
    /**
     * Mostra o tutorial animado da Play Store no AskForReviewOverlay (prop `tutorial`)
     * em vez da imagem estática. Requer `react-native-webview`.
     * @section Avaliação
     * @label Tutorial animado
     * @default desligado
     * @platform android
     */
    review_tutorial_enabled?: boolean;
    /**
     * HTML completo substituindo o tutorial embutido. Serve para corrigir um redesenho
     * da Play Store sem release — o app usa este valor se presente.
     * @section Avaliação
     * @label HTML do tutorial
     * @default o embutido na lib
     * @platform android
     */
    review_tutorial_html?: string;
    /**
     * Anúncio de outro app: bottom-sheet, card, banner, tela cheia ou notificação.
     * @section Promo
     * @label Promocional
     * @default nenhum
     */
    promotional?: PromotionalConfig;
    /**
     * Mesmo formato do `promotional`, nome antigo: só vale quando não há `promotional`.
     * @section Promo
     * @label Modal do app
     * @default nenhum
     */
    appmodal?: PromotionalConfig;
    /**
     * Ligado: assinatura ativa conta como Premium mesmo cancelada, e qualquer entitlement ativo também.
     * @section Assinatura
     * @label Premium com trial cancelado
     * @default desligado
     */
    is_opted_out_trial_enabled?: boolean;
    /**
     * Retenção (trial cancelado, falha de pagamento, vencido…). Ausente = desligado. Ver RetentionConfig.
     * @section Assinatura
     * @label Retenção
     * @default desligado
     */
    retention?: RetentionConfig;
    /**
     * Geo por IP (país/estado/cidade como atributos do customer no RevenueCat). `false` desliga sem build novo.
     * Ver `utils/geo.ts`.
     * @section Rastreamento
     * @label Geo por IP
     * @default ligado
     */
    geo_lookup_enabled?: boolean;
    /**
     * Endpoint PRÓPRIO de geo (https), tentado antes dos provedores gratuitos embutidos.
     * Contrato da resposta: `{country, region, regionCode, city}` (ex.: Cloudflare Worker
     * devolvendo `request.cf`).
     * @section Rastreamento
     * @label Endpoint de geo
     * @default provedores gratuitos
     */
    geo_lookup_url?: string;
    /**
     * Chave de decriptação do install referrer da Meta (hex de 64 chars). Ver `AppStrings.metaInstallReferrerKey`.
     * @section Rastreamento
     * @label Chave do referrer da Meta
     * @default a do AppStrings
     * @platform android
     */
    meta_install_referrer_key?: string;
    /**
     * Endpoint do link-in-bio (casa o install com a visita na web). Vazio = desligado.
     * @section Rastreamento
     * @label Link-in-bio
     * @default desligado
     */
    trends_tracking_url?: string;
    /**
     * Projeto do Microsoft Clarity.
     * @section Rastreamento
     * @label Microsoft Clarity
     * @default desligado
     */
    clarity_id?: string;
    /**
     * SDK de eventos do TikTok.
     * @section Rastreamento
     * @label TikTok Ads
     * @default desligado
     */
    tiktokads?: {token: string; appid: string; tkappid: string; isdebug: boolean};
    /**
     * Valor livre que volta no evento `cfg_integrity` como `remote_hash`, para conferir qual config chegou.
     * @section Diagnóstico
     * @label Marca da config
     */
    hash?: string;
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
 * Bloco `screens` do Remote Config (features/telas configuráveis do app), no parâmetro `settings` ou, nos apps que
 * ainda não migraram, no parâmetro `screens`. Sem tipo fixo: o pldev monta o formulário a partir dos valores.
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
 * Valor do parâmetro `settings` do Remote Config (um por plataforma): os dois blocos num valor só. A lib lê e expõe
 * `remoteConfigUtils` (bloco utils), `remoteConfigScreens` (bloco screens) e `remoteConfigs` (os dois juntos).
 * Sem os blocos, a lib ignora o `settings` e lê os parâmetros `utils` + `screens`. Ver `utils/settings.ts`.
 */
export interface RemoteConfigSettingsType {
    utils: Partial<RemoteConfigUtilsType> & {[key: string]: any};
    screens: {[key: string]: any};
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
    // Os dois blocos juntos (utils + screens; em conflito vale o utils), setado pelo setupGlobalConfigs, como era
    // antes de fevereiro de 2026. Até a 1.4 era apelido do remoteConfigUtils: o store gate e apps legados leem e
    // escrevem por ele.
    var remoteConfigs: RemoteConfigUtilsType & RemoteConfigScreensType;
    var remoteConfigScreens: RemoteConfigScreensType;
    var isAdsEnabled: boolean;
    // Setada (true) pelo gate fail-closed de versão da loja (Utils.disableAdsIfBuildIsNewerThanStore)
    // quando ele bloqueia os ads. Flag própria do gate — o prepare() não encosta nela; apps podem
    // ler p/ ex. esconder o espaço reservado do banner.
    var adsDisabledByStoreGate: boolean | undefined;
    var adUnits: any;
}
