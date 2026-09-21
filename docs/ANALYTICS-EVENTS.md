# Catálogo de analytics do expo-utils

Tudo que a lib manda para o Firebase Analytics (GA4), por onde passa e o que precisa ser
registrado no GA4 para aparecer nos relatórios. Fonte da verdade do código: `utils/analytics.ts`
(`logUtilsEvent`) — **mudou evento ou parâmetro? atualize este arquivo na mesma tarefa.**

## Regras do logger (`logUtilsEvent`)

- Nunca lança, nunca é aguardado, nunca vira unhandled rejection — analytics não pode quebrar
  nem atrasar ad, paywall, promo ou boot.
- `boolean` vira `1`/`0`; `null`/`undefined`/`NaN` saem do payload; string corta em 100 chars.
- Em dev cada evento aparece no Metro: `[expo-utils] event <nome> {...}` (respeita `disableLogs`).
- Limites do GA4: nome de evento ≤ 40 chars; valor de parâmetro ≤ 100; **valor de user property
  ≤ 36**; 25 params por evento; por propriedade: 50 dimensões de evento + 25 de usuário.

> **Parâmetro que não é registrado como dimensão personalizada só existe no DebugView e no
> BigQuery.** Admin → Definições personalizadas → Criar dimensão. A coluna "Registrar" abaixo
> marca o que vale o slot.

## Identidade e user properties

| Nome | Valor | Quando |
|------|-------|--------|
| `user_id` | App User ID do RevenueCat (`$RCAnonymousID:<32 hex>`, 47 chars) | fase 1 da atribuição e a cada `customerInfo` novo. Vai em `setUserId` (256 chars) porque **não cabe** numa user property (36) |
| `rc_status` | `free` · `trial` · `intro` · `active` · `cancelled` · `billing_issue` · `expired` · `refunded` | boot e a cada mudança de `customerInfo` — **registrar (escopo usuário)** |
| `att_status` | `granted` · `denied` · `undetermined` · `restricted` · `na` (Android) · `error` | depois do prompt do ATT — **registrar (escopo usuário)** |

Geo (país/estado/cidade), idioma, versão do app, modelo e SO **já são dimensões nativas do GA4** —
não há user property para eles.

## Atribuição / boot

| Evento | Parâmetros | Registrar |
|--------|-----------|-----------|
| `rc_attribution` | `phase` (1\|2), `steps_ok`, `steps_fail` (`id:fail`\|`id:timeout`), `ms` (desde o início do JS), `synced` (1 enviado · 2 atributos enviados mas a busca de ofertas falhou — projeto do RC sem offering · 0 falhou · -1 SDK sem o método), `att` (só fase 2) | `phase`, `steps_fail`, `synced` |
| `consent_flow` | `ump` (`obtained`·`not_required`·`required`·`denied`·`timeout`·`skipped`·`error`), `att`, `push` (`granted`·`denied`·`never_ask_again`·`provisional`·`ephemeral`·`undetermined`·`skipped`·`error`) | os três |
| `install_attribution` | `source` (`play_referrer` · `link_in_bio`), `matched` (1 = veio de campanha/link · 0 = orgânico ou sem match), `media_source` (ausente em install orgânico), `campaign`, `meta` (só install de anúncio da Meta: `decrypted` · `encrypted` = sem chave · `decrypt_failed` = chave errada) | `source`, `matched`, `media_source`, `meta` |
| `expo_utils_warn` | `message` (100 chars; dedup por sessão, teto de 50) | `message` |
| `cfg_integrity` | `cfg_hash`, `ad_count`, `is_ads_enabled`, `min_version`, `app_version` | — |
| `<slug_do_app>` | — (1x por instalação) | — |

Ids de etapa do `rc_attribution` — fase 1: `adsvc` (AdServices, iOS), `fid` (Firebase app
instance id), `ctx` (atributos de contexto), `store` (storefront), `ref` (Play Install Referrer, só Android), `uid` (user_id do GA4);
fase 2: `ids` (device identifiers), `fb` (FB anonymous id), `push`, `geo`. Etapa `skip` (não se
aplica: push em simulador, geo desligada) não entra em nenhuma das duas listas.

Leituras úteis: `count(phase=2) ÷ count(phase=1)` = taxa de entrega da fila pós-ATT (perto de 0
num app = layout sem `Utils.handleReady`); `steps_fail` mais frequente = SDK de terceiro que
pendura; `ms` da fase 1 = quanto tempo depois do launch o 1º recibo já sairia com atributos.

## Push

| Evento | Parâmetros | Registrar |
|--------|-----------|-----------|
| `push_received` | `message_id`, `topic`, `title`, `push_id`, `latency_s`, `app_state=foreground` | `topic`, `push_id`, `title` |
| `push_received_bg` | idem, `app_state=background` | idem |
| `push_opened` | `message_id`, `topic`, `title`, `push_id`, `latency_s`, `open_state` (`background`\|`quit`) | `open_state` |
| `fcm_topic_subscribe` / `fcm_topic_unsubscribe` | `topic`, `status` | — |

`push_id` = primeiro presente entre `data.push_id`, `data.notification_id`, `data.campaign_id`.
Taxa de abertura = `push_opened` ÷ (`push_received` + `push_received_bg`) por `push_id` (ou por
`title` enquanto o sender não mandar id). Limites de plataforma no README ("Push: recebidas e abertas").

## Paywall (`usePaywall` / `PaywallUtils`)

Params comuns: `placement` (opção `placement` do hook; omitida = rota atual), `campaign`
(`campaign_name` da config), `config_key`. Params de produto: `product_id`, `product_kind`,
`price`, `price_currency`, `trial_days`.

| Evento | Extra | Quando |
|--------|-------|--------|
| `paywall_view` | `products_count`, `selected_product`, `close_delay_ms` | 1x por montagem do hook, no 1º load |
| `paywall_product_select` | produto | troca de seleção |
| `paywall_purchase_start` | produto | antes de chamar a loja |
| `paywall_purchase_success` | produto, `premium_granted` | compra ok |
| `paywall_purchase_cancel` | produto | usuário cancelou |
| `paywall_purchase_error` | produto, `code`, `message` | erro da loja/RC |
| `paywall_restore` | `result` (`restored`·`nothing`·`error`), `code` | restore |
| `paywall_close` | `duration_ms`, `purchased` | unmount do hook |

Registrar: `placement`, `product_id`, `campaign`, `result`, `code`.
**De propósito não existe evento `purchase` nem params `value`/`currency`**: o GA4 trataria como
receita e duplicaria o `in_app_purchase` automático. Quem usa `PaywallController`/API estática
chama `PaywallUtils.trackView(result, options)` e `PaywallUtils.trackClose(options, {...})`.

## Review (`askForReview` / `AskForReviewOverlay`)

| Evento | Parâmetros |
|--------|-----------|
| `review_request` | `type` (`store-review`·`popup`·`dialog`), `show_delay_ms` |
| `review_prompt_show` | `type`, `style` (`bottomsheet`·`formsheet`·`centered`·`fullscreen`), `tutorial`, `not_now_delay_ms` |
| `review_prompt_action` | `type`, `style`, `action` (`rate`·`later`), `source` (`button`·`close`·`backdrop`), `time_ms` |
| `review_store_requested` | `origin` (`store-review`·`popup`·`dialog`·`manual`) |

Registrar: `style`, `action`, `type`. O prompt **nativo** da loja não devolve resultado (nem se
apareceu) — o funil mede até o pedido. Conversão por layout = `action=rate` ÷ `review_prompt_show`
por `style`; é o evento-meta para A/B do `review_style` no Remote Config.

## Promo e cross-promo

`promo_impression`, `promo_click`, `promo_close`, `promo_dont_show_again`, `promo_expand` — params
`promo_variant` (`bottom_sheet`·`card_banner`·`fullscreen`·`notification`·`banner_small`·
`banner_large`·**`cross_promo_card`**), `promo_type`, `promo_name`, `promo_store_url`,
`promo_media`, e específicos `click_source`, `close_method`, `notification_compact`,
`close_delay_ms`. O `CrossPromoCard` manda `promo_impression`/`promo_click` com
`promo_variant=cross_promo_card`, `promo_type=cross_promo` e `screen` (onde o card estava).
Registrar: `promo_variant`, `promo_name`, `click_source`, `close_method`, `screen`.

## Ads

| Evento | Parâmetros |
|--------|-----------|
| `ad_revenue` | `format`, `placementId`, `value`, `currency`, `precision` |
| `AdLOADED` · `OPENED` · `AdCLOSED` · `AdERROR` · `REWARDED` | payload do SDK + `placementId` |

A rede que serviu o ad **não** vem daqui: vem do `ad_impression` automático do AdMob (ILRD ligado
no console + link AdMob ↔ Firebase).

## Atributos gravados no customer do RevenueCat (não são GA4)

Reservados: `$firebaseAppInstanceId`, `$idfa`/`$idfv`/`$gpsAdId`/`$ip`, `$fbAnonId`,
`$apnsTokens` (iOS) / `$fcmTokens` (Android), `$attConsentStatus` (o SDK grava sozinho),
`$mediaSource`/`$campaign`/`$adGroup`/`$ad`/`$keyword`/`$creative` (Play Install Referrer no Android, inclusive anúncio da Meta decriptado; match do link-in-bio — **primeira gravação vence** no RevenueCat, por isso install orgânico não grava `$mediaSource`). Custom: `install_referrer`, `install_medium`, `gclid`, `meta_campaign_group_name`, `meta_campaign_name`, `meta_adgroup_name`, `meta_ad_id`, `meta_account_id`, `meta_objective`, `meta_placement` (anúncio da Meta com a chave) ou `meta_ref_nonce` + `meta_ref_data_1..4` (sem a chave), `language`, `locale`, `device_region`,
`currency`, `timezone`, `store_country`, `geo_country`, `geo_state`, `geo_state_code`, `geo_city`,
`geo_source`, `app_version`, `build_number`, `expo_utils_version`, `os_version`, `device_model`,
`install_date`, `fcm_token` (iOS), `TikTokGetAnonymousID`.
