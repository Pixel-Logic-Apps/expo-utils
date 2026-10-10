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
| `rc_status` | `free` · `trial` · `trial_cancelled` · `intro` · `active` · `cancelled` · `billing_issue` · `trial_expired` · `expired` · `refunded` (regras em `utils/rc-status.ts` e no README, "Tópicos FCM") | boot e a cada mudança de `customerInfo` — **registrar (escopo usuário)** |
| `att_status` | `granted` · `denied` · `undetermined` · `restricted` · `na` (Android) · `error` | depois do prompt do ATT — **registrar (escopo usuário)** |

Geo (país/estado/cidade), idioma, versão do app, modelo e SO **já são dimensões nativas do GA4** —
não há user property para eles.

## Atribuição / boot

| Evento | Parâmetros | Registrar |
|--------|-----------|-----------|
| `rc_attribution` | `phase` (1\|2), `steps_ok`, `steps_fail` (`id:fail`\|`id:timeout`), `ms` (desde o início do JS), `synced` (1 enviado · 2 atributos enviados mas a busca de ofertas falhou — projeto do RC sem offering · 0 falhou · -1 SDK sem o método), `att` (só fase 2) | `phase`, `steps_fail`, `synced` |
| `consent_flow` | `ump` (`obtained`·`not_required`·`required`·`denied`·`timeout`·`skipped`·`error`), `att`, `push` (`granted`·`denied`·`never_ask_again`·`provisional`·`ephemeral`·`undetermined`·`skipped`·`error`) | os três |
| `install_attribution` | `source` (`play_referrer` · `link_in_bio`), `matched` (1 = veio de campanha/link · 0 = orgânico ou sem match), `media_source` (ausente em install orgânico), `campaign`, `meta` (só install de anúncio da Meta: `decrypted` · `encrypted` = sem chave · `decrypt_failed` = chave errada). **1 por install e por `source`** (desde 07/10/2026): `play_referrer` só na 1ª leitura do Play Install Referrer (o resultado fica no AsyncStorage `@expo_utils_install_referrer`; antes saía a cada abertura); `link_in_bio` só quando o servidor respondeu (antes, falha de rede saía como `matched` 0) | `source`, `matched`, `media_source`, `meta` |
| `install_attribution_error` | `source` (`link_in_bio`), `error` (`Network request failed`, `Request timeout`, erro do servidor ou de JSON — 100 chars). O match do link-in-bio não teve resposta; a lib tenta de novo na próxima abertura do app (sai no máximo 1x por abertura até dar certo). **Não entra na taxa de match** | `error` (opcional) |
| `expo_utils_warn` | `message` (100 chars; dedup por sessão, teto de 50) | `message` |
| `cfg_integrity` | `cfg_hash` (MD5 do bloco `utils` que o boot usou), `cfg_source` (de onde ele saiu: `settings` = parâmetro `settings` com os blocos · `legacy` = parâmetros `utils` + `screens` · `default` = sem Firebase, erro ou teto de 10s; desde a 1.5.0), `remote_hash` (o `hash` do bloco `utils`), `is_ads_enabled`, `trends_tracking_url`, `tiktokads` (hash), `clarity_id`, `min_version`, `review_type`, `repeat_ads_count`, `ios_app_id`, `id`, `slug`, `bundleid`, `version`, `runtimeversion`, `projectId`, `admob_android_app_id`, `admob_ios_app_id`, `facebook_app_id`. Build antigo (`legacy`) e novo (`settings`) da mesma plataforma com o mesmo `cfg_hash` = as cópias de `utils` que o pldev publica batem com o `settings` | `cfg_source` |
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
| `push_received` | `fcm_message_id`, `fcm_topic`, `title`, `push_id`, `latency_s`, `app_state=foreground` | `fcm_topic`, `push_id`, `title` |
| `push_received_bg` | idem, `app_state=background` | idem |
| `push_opened` | `fcm_message_id`, `fcm_topic`, `title`, `push_id`, `latency_s`, `open_state` (`background`\|`quit`) | `open_state` |
| `fcm_topic_subscribe` / `fcm_topic_unsubscribe` | `fcm_topic`; no subscribe do tópico de estado, `status` (mesmo valor do `rc_status`); no de marco, `milestone` (`trial_started` \| `converted`, só na 1ª vez do aparelho) | — |

`push_id` = primeiro presente entre `data.push_id`, `data.notification_id`, `data.campaign_id`.

**Nunca use `topic` nem `message_id` como nome de parâmetro.** O SDK envia, mas o GA4 some com eles (medido em
24/09/2026: o log `FA-SVC` do aparelho tinha os dois no lote enviado e o DebugView mostrava todos os outros params do
evento, menos esses) — provável colisão com os params que o próprio FCM grava no `notification_receive`
(`topic(_nt)`, `message_id`). Até a 1.4.0 a lib usava esses nomes: a dimensão `topic` nunca recebeu dado. O mesmo
`fcm_topic` vale em `push_*` e `fcm_topic_*` — 1 dimensão personalizada cobre os dois.
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

## Retenção (`showRetention` / modal de retenção)

Desde 08/10/2026 (`utils/retention-analytics.ts`; plano: `docs/PLANO-RETENCAO-OFERTAS.md`, seções 9 e 14). **Só fora
da pré-visualização** (`showRetentionPreview` não manda nada). Params de oferta: `offer_type` (`resubscribe` ·
`winback` · `discount` · `subscription` · `lifetime` · `offer_code`), `offer_id` (o nome no Remote Config:
`resubscribe`, `discount_50`…), `product_id` (produto da loja; vazio no código e no reativar sem produto), `price`,
`price_currency`, `discount_pct`. `segment` = `trial_cancelled` · `cancelled` · `billing_issue` · `expired` ·
`trial_expired` · `free`. `style` = formato do modal (`bottomsheet` · `fullscreen`, desde 10/10/2026), em todo evento
que sai do modal (todos menos o `retention_offer_unavailable`, que é antes de abrir).

| Evento | Parâmetros | Quando |
|--------|-----------|--------|
| `retention_impression` | `segment`, `variant` (`premium_lost`·`premium_kept`), `style`, oferta principal, `secondary_offer_id` | 1x por pedido desenhado (o host remontar não conta de novo) |
| `retention_click` | `segment`, `style`, `action` (`purchase`·`reactivate`·`update_payment`·`redeem`·`confirm` = "Já reativei"·`manage` = botão do aviso pós-compra), `role` (`primary`·`secondary`), oferta | cada toque |
| `retention_close` | `segment`, `style`, `close_method` (`dismiss`·`swipe`·`back`·`overlay`·`recovered`·`purchased`·`redeem`·`hidden`), `offer_type`, `offer_id` (da principal) | todo fechamento, inclusive o `RetentionEvents.hide()` |
| `retention_purchase` | `segment`, `style`, oferta, `product_id` (o que a loja devolveu), `premium` (1/0: algum entitlement ativo dá Premium depois da compra) | compra concluída |
| `retention_purchase_error` | `segment`, `style`, oferta, `status` (`failed`·`pending`), `code` (código do RevenueCat: `20` pendente, `42` falha simulada da loja de teste, `6` já é da pessoa…; `not_purchasable`/`promotional_offer_unsigned` da lib), `message` | compra que falhou ou ficou pendente. **Cancelar não gera evento** (cancelados = cliques `purchase` − compras − erros) |
| `retention_offer_unavailable` | `segment`, `offer_id`, `offer_type`, `reason` (`unknown_offer`·`not_for_segment`·`no_previous_product`·`missing_product_id`·`missing_offer_id`·`missing_code`·`unsupported_platform`·`product_not_found`·`offer_not_found`·`not_eligible`·`store_error`), `detail` (mensagem da loja) | 1 por oferta pulada na conferência da loja (`showRetention`) |

Registrar: `segment`, `offer_id`, `action`, `close_method`, `reason`, `code` e `style` (a mesma dimensão do review).
Conversão por formato = `retention_purchase` ÷ `retention_impression` por `style`. **De propósito sem `value`/`currency`**
(mesma regra do paywall): a receita vem do `in_app_purchase` automático e da integração do RevenueCat.
`show_n` e `retention_recovered` (plano, seção 9) dependem da detecção automática, que ainda não existe.

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

O `ad_revenue` agora passa por `logUtilsEvent`. Valor ausente/não finito e moeda ausente são
omitidos; não são mais substituídos por receita zero em USD. A moeda pode vir de `currency`
ou `currencyCode`. A receita pode ser estimada conforme `precision`. O evento da lib não
inclui a rede; use o `ad_impression` do AdMob (ILRD + vínculo AdMob ↔ Firebase) para essa análise.
Não somar os dois como receitas adicionais nem presumir um vínculo individual entre eles.

<a id="taichi"></a>

### Taichi: 20 limites × 3 janelas

Eventos automáticos de qualificação, **sem parâmetros customizados e sem `value` monetário**.
O nome já identifica o corte em USD e o prazo. Usar para contagem/tCPA; o caminho nativo de
tROAS de publicidade permanece `ad_impression`. Marcos sobrepostos não são receitas distintas.

| USD acumulado | Primeiras 24h | Primeiras 72h | Primeiros 7 dias (168h) |
|---|---|---|---|
| 0,0001 | `taichi_rev_0_0001usd_24h` | `taichi_rev_0_0001usd_72h` | `taichi_rev_0_0001usd_7d` |
| 0,0002 | `taichi_rev_0_0002usd_24h` | `taichi_rev_0_0002usd_72h` | `taichi_rev_0_0002usd_7d` |
| 0,0003 | `taichi_rev_0_0003usd_24h` | `taichi_rev_0_0003usd_72h` | `taichi_rev_0_0003usd_7d` |
| 0,0005 | `taichi_rev_0_0005usd_24h` | `taichi_rev_0_0005usd_72h` | `taichi_rev_0_0005usd_7d` |
| 0,00075 | `taichi_rev_0_00075usd_24h` | `taichi_rev_0_00075usd_72h` | `taichi_rev_0_00075usd_7d` |
| 0,001 | `taichi_rev_0_001usd_24h` | `taichi_rev_0_001usd_72h` | `taichi_rev_0_001usd_7d` |
| 0,0015 | `taichi_rev_0_0015usd_24h` | `taichi_rev_0_0015usd_72h` | `taichi_rev_0_0015usd_7d` |
| 0,002 | `taichi_rev_0_002usd_24h` | `taichi_rev_0_002usd_72h` | `taichi_rev_0_002usd_7d` |
| 0,003 | `taichi_rev_0_003usd_24h` | `taichi_rev_0_003usd_72h` | `taichi_rev_0_003usd_7d` |
| 0,004 | `taichi_rev_0_004usd_24h` | `taichi_rev_0_004usd_72h` | `taichi_rev_0_004usd_7d` |
| 0,005 | `taichi_rev_0_005usd_24h` | `taichi_rev_0_005usd_72h` | `taichi_rev_0_005usd_7d` |
| 0,0075 | `taichi_rev_0_0075usd_24h` | `taichi_rev_0_0075usd_72h` | `taichi_rev_0_0075usd_7d` |
| 0,01 | `taichi_rev_0_01usd_24h` | `taichi_rev_0_01usd_72h` | `taichi_rev_0_01usd_7d` |
| 0,015 | `taichi_rev_0_015usd_24h` | `taichi_rev_0_015usd_72h` | `taichi_rev_0_015usd_7d` |
| 0,02 | `taichi_rev_0_02usd_24h` | `taichi_rev_0_02usd_72h` | `taichi_rev_0_02usd_7d` |
| 0,03 | `taichi_rev_0_03usd_24h` | `taichi_rev_0_03usd_72h` | `taichi_rev_0_03usd_7d` |
| 0,05 | `taichi_rev_0_05usd_24h` | `taichi_rev_0_05usd_72h` | `taichi_rev_0_05usd_7d` |
| 0,075 | `taichi_rev_0_075usd_24h` | `taichi_rev_0_075usd_72h` | `taichi_rev_0_075usd_7d` |
| 0,10 | `taichi_rev_0_10usd_24h` | `taichi_rev_0_10usd_72h` | `taichi_rev_0_10usd_7d` |
| 0,25 | `taichi_rev_0_25usd_24h` | `taichi_rev_0_25usd_72h` | `taichi_rev_0_25usd_7d` |

**Disparo:** soma de callbacks `PAID`/`onPaid` válidos e positivos em USD, de banner,
interstitial, rewarded e app-open. O `value` do wrapper já está em unidades da moeda, não
micros. Outras moedas continuam em `ad_revenue`, mas não entram nestes marcos; não há conversão
cambial. Cada nome é emitido uma vez por instalação rastreada, ao atingir o corte dentro da
janela `[primeiro uso, primeiro uso + prazo)`. Uma impressão pode atravessar vários cortes.
Callbacks depois de 24h/72h/168h não qualificam a janela encerrada, mesmo se a fila de storage
estiver atrasada: vale a hora do callback.

**Estado:** `@expo_utils_taichi_v1` no AsyncStorage guarda início, soma e nomes emitidos.
`Utils.prepare` inicia a leitura antes dos ads e da flag `@first_open_logged`, sem aguardar
a fila na UI. Quando essa flag já existe e não há estado Taichi, a instalação fica excluída
(`firstOpen: 0`): a atualização da lib não cria um primeiro uso novo. A ausência dos dois
marcadores é tratada como primeiro uso; apps muito antigos que nunca gravaram essa flag
precisam marcar os usuários existentes antes do `prepare` na migração. Limpeza/restauração de
dados depende do storage; não há identidade entre aparelhos nem reconstrução de receita passada.

**Configuração:** `utils.taichi_events` no Remote Config, array opcional com nomes exatos:
ausente habilita os 60; `[]` desabilita as emissões, mantendo a soma; uma lista habilita só
os nomes existentes nela. Valor de outro tipo não habilita eventos. Não há reset ao alterar
a lista. Ao habilitar um marco ainda não emitido, o próximo callback USD positivo pode
qualificá-lo usando a soma já coletada, desde que sua janela ainda esteja aberta.
O Remote Config mantém a atualização por sessão da lib.

**Duplicações e falhas:** fullscreen usa a identidade da instância de apresentação;
também são reconhecidos os últimos 128 `responseId` da sessão, quando disponíveis.
Banners sem ID só permitem reconhecer o mesmo objeto de callback repetido; sem identidade
confiável não há como distinguir um reenvio de uma nova impressão. Nunca deduplicar por
preço/placement: refreshes reais podem ter valores iguais. A soma é serializada; estado
ilegível não é apagado/reiniciado. Falha de gravação adia os marcos até outro callback
conseguir persistir; a receita pendente só sobrevive ao processo se tiver sido gravada.
Persistir antes de emitir evita repetição no próximo boot, mas um encerramento entre essas
etapas pode perder o evento. O logger não confirma entrega ao Firebase.

**Validação em 23/09/2026:** build Android do `expo-utils-lab` no emulador Pixel_10a →
DebugView da propriedade `local-desenv`: **60 nomes distintos, cada um com contagem 1**,
inclusive após callback repetido, encerramento do processo e nova impressão na reabertura.
Os valores positivos foram sintéticos, enviados ao acumulador real da lib. O interstitial
com ID de teste do Google também disparou o callback nativo `PAID`, com USD/zero.
[Evidências e roteiro](VALIDACAO-TAICHI.md). Receita positiva de produção, iOS e importação
no Google Ads não foram medidos neste teste.

Somente no laboratório: `taichi_qa_step` registra `run_id`, `value`, `replay` (1/0), `usd`
e `sent_count` para correlacionar as etapas do teste. Não faz parte dos eventos da lib
nem deve ser marcado como conversão.

## Atributos gravados no customer do RevenueCat (não são GA4)

Reservados: `$firebaseAppInstanceId`, `$idfa`/`$idfv`/`$gpsAdId`/`$ip`, `$fbAnonId`,
`$apnsTokens` (iOS) / `$fcmTokens` (Android), `$attConsentStatus` (o SDK grava sozinho),
`$mediaSource`/`$campaign`/`$adGroup`/`$ad`/`$keyword`/`$creative` (Play Install Referrer no Android, inclusive anúncio da Meta decriptado; match do link-in-bio — **primeira gravação vence** no RevenueCat, por isso install orgânico não grava `$mediaSource`). Custom: `install_referrer`, `install_medium`, `gclid` (id do clique do Google Ads — gclid, gbraid ou wbraid; o nome ficou por compatibilidade) + `click_id_type` (`gclid` · `gbraid` · `wbraid`, desde 07/10/2026), `meta_campaign_group_name`, `meta_campaign_name`, `meta_adgroup_name`, `meta_ad_id`, `meta_account_id`, `meta_objective`, `meta_placement` (anúncio da Meta com a chave) ou `meta_ref_nonce` + `meta_ref_data_1..4` (sem a chave), `language`, `locale`, `device_region`,
`currency`, `timezone`, `store_country`, `geo_country`, `geo_state`, `geo_state_code`, `geo_city`,
`geo_source`, `app_version`, `build_number`, `expo_utils_version`, `os_version`, `device_model`,
`install_date`, `fcm_token` (iOS), `TikTokGetAnonymousID`.
