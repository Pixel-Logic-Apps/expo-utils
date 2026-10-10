# AGENTS.md - Instrucoes para agentes que trabalham no expo-utils

## Docs de upgrade (OBRIGATORIO manter atualizado)

Playbook para migrar apps legados (Expo 53 + API antiga) → stack atual:

- **`docs/UPGRADE-EXPO57-EXPO-UTILS.md`**

**Regra:** sempre que este repositorio mudar algo que afete a migracao de um app host, **atualize esse arquivo na mesma tarefa** (nao deixe para depois, nao abra so PR de codigo).

Atualize o doc se voce alterar qualquer um destes:

- `package.json` peers / versoes alvo (Expo, RN, React, Firebase, hot-updater, purchases, admob, reanimated/worklets, etc.)
- Contrato de boot: `Utils.prepare`, `ExpoUtilsLayout`, `initHotUpdater`, `AppStrings` / `templates/Strings.ts` / `templates/RootLayout.tsx`
- Remote Config: parâmetro `settings` (blocos `utils` / `screens`) e os parâmetros `utils` / `screens` de antes, shape de `RemoteConfigUtilsType` (e as tags `@section`/`@label`/`@default`/`@platform` que o pldev lê), nomes de campos legados vs novos
- Premium: `PremiumUtils`, regras DEV/prod, exports em `index.ts` / `index.d.ts`
- Config plugin (`app.plugin.js`): SKAdNetwork, ATT, usage descriptions, forceStaticLinking, flags documentadas
- CLI (`bin/install.js`): flags novas/renomeadas/comportamento de `--new`, `--skadnetwork`, `--hot-updater`, etc.
- Breaking changes de runtime (ads, paywall, ATT, babel plugin path, file-system legacy, etc.)
- Armadilhas novas descobertas ao migrar um app real
- Atribuicao do RevenueCat / analytics: fases, atributos gravados no customer, keys `geo_lookup_*`,
  evento ou parametro novo (esse ultimo tambem em `docs/ANALYTICS-EVENTS.md` — ver secao propria abaixo)

O doc e o roteiro que **qualquer IA** segue para upgrade. Se o codigo mudar e o doc nao, o upgrade quebra na mao de quem copiar o checklist.

Tambem: se `index.ts` exportar API publica nova, mantenha `index.d.ts` em sync (o playbook cita deep import quando o `.d.ts` fica atrasado).


## Integracao externa so e "ok" medida NO DESTINO (REGRA)

Nunca declarar "ok/garantido" para integracao com servico externo (atributos do RevenueCat, evento do
GA4, topico FCM…) com base em leitura de codigo ou em try/catch bem isolado. So vale com o dado visto
**no destino** — customer no dashboard do RC, DebugView do GA4 — vindo de um build real. Sem poder medir,
escreva literalmente: "verifiquei que nao quebra; NAO verifiquei que chega".

Origem: em 02/07/2026 a atribuicao foi dada como resolvida (cada set em try/catch) e em 20/09/2026 um
assinante real apareceu com TODOS os atributos vazios — ninguem tinha olhado um customer no RC. Ao mexer
em SDK de terceiro, leia o fonte de verdade (os `Pods/` e AARs dos apps locais), nao a memoria.


## Analytics e atribuicao do RevenueCat (v1.4.0)

- **Todo evento passa por `logUtilsEvent` (`utils/analytics.ts`)** — nunca `logEvent(...).catch()` direto:
  o RNFB 26 tipa `logEvent` como `void` (nao compila) e sem catch a rejeicao vira unhandled rejection.
  O helper e modulo-folha (nao importa nada da lib), nunca lanca, converte boolean em 1/0 e corta string
  em 100 chars. Em dev imprime `[expo-utils] event <nome> {...}` no Metro.
- **Mudou evento, parametro ou user property → atualize `docs/ANALYTICS-EVENTS.md` na mesma tarefa.** E o
  catalogo que diz o que registrar como dimensao personalizada no GA4 (parametro nao registrado so existe
  no DebugView/BigQuery). Limites: nome de evento ≤ 40, valor de param ≤ 100, **user property ≤ 36** (por
  isso o App User ID do RC, com 47 chars, vai em `setUserId`).
- **Atribuicao em duas fases (`utils/attribution.ts`)**: fase 1 no boot logo apos o `Purchases.configure`
  (AdServices, Firebase app instance id, atributos de contexto, storefront, `user_id` do GA4); fase 2 em
  cadeia DESTACADA logo apos o ATT (device ids SEMPRE, FB anon id, push token, geo). Cada etapa tem
  timeout (`runStep`), cada fase termina com sync forcado **imediato** e o evento `rc_attribution`.
  Atributo novo do boot entra numa das fases; atributo de SDK que sobe tarde usa `setRcAttributesLate`.
  Nao volte a pendurar atribuicao no fim de fila serial nem atras de prompt.
- **Nada no caminho critico pode depender de `setTimeout`**: o Android SUSPENDE os timers do JS enquanto a
  Activity esta pausada por um dialogo do sistema (permissao de push, UMP, folha de compra). Medido no
  emulador: o envio com debounce de 2s so saiu 150s depois, quando o dialogo foi respondido; com o envio
  imediato a fase 2 sai em ~6,6s com o dialogo na frente. Debounce so para sets avulsos/tardios.
- **Geo por IP (`utils/geo.ts`) vem LIGADA** e usa uma CADEIA de provedores gratuitos sem chave
  (`GEO_PROVIDERS`: ipwho.is → BigDataCloud client-side → GeoJS), com cache de 7 dias. Mesma regra do
  `PLAY_READERS`: servico gratis morre — se um cair, troque a entrada e teste. Aqui `curl` PROVA (o fetch do
  RN nao aplica CORS). So `https` (ATS do iOS). Descartados e por que estao no topo do arquivo. Desliga por
  `geo_lookup_enabled: false` (Remote Config) ou `{"geoAttributes": false}` (plugin); `geo_lookup_url`
  aponta para endpoint proprio. Cidade/estado no customer = "Coarse Location" no rotulo das lojas.
- **O envio forcado rejeita em app SEM offering e isso NAO e falha**: `syncAttributesAndOfferingsIfNeeded` envia os
  atributos e so depois busca as ofertas; projeto do RC sem offering/produto rejeita com o codigo 23
  (CONFIGURATION_ERROR) **com os atributos ja no customer** (medido em 21/09/2026 no dashboard). Por isso
  `scheduleRcSync` resolve `2` para os codigos 23/2 (lado das ofertas) e so trata como falha (`0`) o resto.
- **Origem do install no Android (`utils/install-referrer.ts`)**: `Application.getInstallReferrerAsync()` (expo-application, ja peer dep — NAO
  precisa de modulo nativo novo; em 20/09 deixei isso de fora alegando o contrario sem conferir) → `$mediaSource`/`$campaign`/`$adGroup`/
  `$ad`/`$keyword`/`$creative` na fase 1. Google Ads so entrega o id do clique (campanha/keyword/criativo nao chegam ao aparelho):
  vai em `gclid` (nome legado, vale para gbraid/wbraid) + `click_id_type`; TikTok nada. O SDK do RC nao coleta mais Android ID e a
  lib tambem nao (politica do Play: Ad ID × id persistente). **A API do referrer e lida 1x por install** (pedido do Google): resultado
  no AsyncStorage `@expo_utils_install_referrer` com o `firstInstallTime` (reinstalacao/backup restaurado le de novo), evento
  `install_attribution` so nessa leitura, atributos regravados a cada sessao a partir do valor guardado.
- **Link-in-bio (`utils/link-in-bio.ts`)**: a flag `tr_is_first_launch_tracking` (legada, sem `@`) so e gravada com RESPOSTA do
  servidor — o `trackInstall()` nunca lanca (offline/timeout devolve `{success: false}`). Sem resposta: `install_attribution_error` e
  nova tentativa na proxima abertura; `install_attribution` sai 1x por install. Ate 06/10/2026 a flag ia antes da chamada e a falha
  saia como `matched: 0`, igual a sem-match.
- **Anuncio da META no Android**: o referrer vem CIFRADO (`utm_content` = JSON `{source:{data,nonce}}`, AES-256-GCM formato libsodium:
  `ciphertext||tag16`, nonce 12, sem AAD). `utils/aes-gcm.ts` abre em TS puro (Hermes nao tem WebCrypto; ~6 ms; confere a TAG — chave
  errada vira `null`, nunca lixo). Chave = "Install Referrer Decryption Key" do app na Meta, vinda de `meta_install_referrer_key`
  (Remote Config, tem prioridade) ou `AppStrings.metaInstallReferrerKey`. Nomenclatura LEGADA da Meta: `campaign_group` = campanha,
  `campaign` = conjunto, `adgroup` = anuncio (a lib traduz). Sem chave: marca a rede e guarda `meta_ref_nonce` + `meta_ref_data_1..4`.
  Verificado no destino so com referrer SINTETICO (anuncio real exige app na Play com campanha). Mudou campo → atualizar README,
  `docs/ANALYTICS-EVENTS.md` e o playbook na mesma tarefa.
- **Campos de atribuicao do RevenueCat sao "primeira gravacao vence"** (medido em 21/09/2026 no dashboard, com atributo-controle na
  MESMA chamada: o controle chegou, `$mediaSource`/`$campaign` regravados nao mudaram). Por isso install organico NAO grava
  `$mediaSource` (so `install_medium = organic`) — um `Organic` no boot bloqueava link-in-bio/Apple Search Ads/MMP para sempre.
  Nunca gravar valor provisorio nesses campos.
- **Push**: `push_received` (foreground), `push_received_bg` (background) e `push_opened`
  (`onNotificationOpenedApp` + `getInitialNotification`, dedup pelo ultimo message id persistido) em
  `utils/push-analytics.ts`. O `fcm_message_id` NAO casa sender × aparelho em envio por topico — o id de
  correlacao e o `push_id` que o sender manda em `data`. Limites de plataforma documentados no README.
  **Nunca nomear parametro `topic` ou `message_id`**: o SDK envia e o GA4 some com eles (medido em 24/09/2026 —
  o log `FA-SVC` tinha os dois, o DebugView nao; colidem com os params do `notification_receive` do FCM). Por isso
  `fcm_topic` / `fcm_message_id`, o mesmo nome em `push_*` e `fcm_topic_*`.
- **Topicos de assinatura (`utils/rc-status.ts`)**: UM topico de estado por aparelho (`{slug}-purchase-{status}`,
  mesmo valor do `rc_status`) + marcos que ACUMULAM e nunca saem (`-trial_started`, `-converted`). Ordem das
  regras: falha de cobranca > renovacao desligada (`unsubscribeDetectedAt`) > tipo do periodo; `billing_issue`
  segue ate 60 dias sem acesso (billing retry da loja). O FATO do marco vai pro AsyncStorage ANTES do portao do
  APNS e sem depender do subscribe — a prova do trial some do `customerInfo` depois da conversao. Tudo passa por
  uma fila serial (boot + listener rodam juntos na abertura) e e reafirmado 1x por sessao (backup restaurado =
  token FCM novo, fora de todo topico). A chave `FCM_CURRENT_TOPIC` e LEGADA e fica sem `@`: renomear faz a lib
  esquecer o topico atual e o aparelho fica nele para sempre. So muda com o app aberto (sem webhook). Mudou
  estado, marco ou regra → README ("Topicos FCM"), `docs/ANALYTICS-EVENTS.md` e o playbook na mesma tarefa.
- **Fatos do SDK do RevenueCat lidos no fonte** (iOS 5.84/5.88 em `expo-urna-v2/ios/Pods/RevenueCat`,
  Android 10.21.1 no cache do Gradle): `setFBAnonymousID` ja chama `collectDeviceIdentifiers` sozinho
  (condicionar ao ATT nao protege nada); o SDK so ENVIA atributos em compra, background/foreground e
  login; `syncAttributesAndOfferingsIfNeeded` tem limite de 5/min (a lib fica em 4 por janela de 60s e
  o excedente ESPERA a janela); iOS `setPushToken` grava `$apnsTokens` (tem que ser o token APNS, nao o
  FCM); product id com `:` (`assinatura:basePlan`) = Google Play.


## Cross-promo (OBRIGATORIO em todo app)

- Todo app do portfólio deve ter cross-promo implementado em algum lugar (home, resultado, histórico, settings…). Sem exceção.
- O card pronto é `utils/cross-promo-card.tsx` (`CrossPromoCard`), que lê `remoteConfigScreens.cross_promo` (`CrossPromoConfig`).
- `cross_promo` é campo OBRIGATÓRIO do `RemoteConfigScreensType` (`utils/types.ts`) — app que montar `remoteConfigScreens` sem a key quebra no typecheck. É a enforcement da regra.


## Gerador de JSON promo (`docs/index.html` — site do GitHub Pages)

- `docs/` é a fonte do GitHub Pages (Settings → Pages → `main` + `/docs`): `docs/index.html` abre em `https://pixel-logic-apps.github.io/expo-utils/`. É um HTML único, sem build e sem dependência — cola o link da App Store/Google Play e ele gera o JSON de `promotional` / `appmodal` (parâmetro `utils`) ou `cross_promo` (parâmetro `screens`).
- **Ele espelha `PromotionalConfig` e `CrossPromoConfig` (`utils/types.ts`).** Mudou campo, default ou em quais `type` um campo vale (`utils/modal-promotional-content.tsx`, `utils/cross-promo-card.tsx`) → atualize a lista `FIELDS` do `docs/index.html` **na mesma tarefa**, senão o gerador passa a emitir JSON desatualizado sem ninguém perceber.
- `docs/.nojekyll` é proposital: sem ele o Pages roda Jekyll nos `.md` da pasta, e a sintaxe `{{ }}`/`{% %}` dos playbooks quebra o build do site. Não remova.
- Só a App Store tem API pública com CORS (iTunes lookup). O Google Play não tem, então link só-Play é resolvido em duas etapas: (1) mesmo `bundleId` na App Store; (2) se não existe app iOS com esse bundleId, a página do Play é lida por um **serviço de metadados** que responde com CORS e aceita uso sem chave — lista `PLAY_READERS` do `docs/index.html`: Jina Reader (`r.jina.ai`, 20 req/min, traz nome/descrição curta/ícone/screenshots) e, se ele falhar, Microlink (`api.microlink.io`, 25 req/dia, sem screenshots). 404 do Play = "app não encontrado"; os dois leitores fora do ar = degrada para "só preenchi a URL" (nunca trava). Link só-Play **tem que** preencher tudo — não remova essa etapa.
- Proxy CORS público genérico foi testado e descartado (todos instáveis); não reintroduza. Se um leitor morrer, troque a entrada dele em `PLAY_READERS` por outro serviço de metadados (ou um Worker próprio) e teste **num navegador de verdade** — `curl` não aplica CORS, então não prova nada.


## Modal de retenção (UI de todos os segmentos e ofertas + compra de verdade; detecção automática ainda não)

Planos: `docs/PLANO-RETENCAO-TRIAL-CANCELADO.md` (07/10/2026: UI do trial cancelado) e `docs/PLANO-RETENCAO-OFERTAS.md`
(08/10/2026: UI por segmento + cartões de oferta + pré-visualização, seções 3, 4, 7 e 8; compra de verdade, seção 14).
`showRetention()` confere as ofertas na loja, abre o modal e compra de verdade, com os eventos `retention_*`. A
detecção (abrir sozinho na volta ao primeiro plano, `max_shows`, intervalo, episódio) e o push NÃO existem: em
produção o modal só abre quando o app chama `showRetention`.

- **Arquivos**: `utils/retention-texts.ts` (textos da fase 1, data, RTL, URL do Play), `utils/retention-offers.ts`
  (tipo de oferta → botão/cartão/ação, preço e percentual com `Intl.NumberFormat`, plurais, catálogo e preços falsos da
  pré-visualização, tipo `RetentionStoreRef`), `utils/retention-view.ts` (`buildRetentionView`: a tela inteira, pura —
  o modal só desenha), `utils/retention-events.ts` (`RetentionEvents` no `DeviceEventEmitter` + `showRetentionPreview`;
  módulo-folha, o `Utils.ts` importa dele o item "Simular trial cancelado" do menu de dev — por isso NÃO importa o
  SDK), `utils/retention-store.ts` (conferência na loja, compra e resgate; importa o `react-native-purchases`, sem UI),
  `utils/retention-show.ts` (`showRetention`), `utils/retention-analytics.ts` (eventos `retention_*`) e
  `utils/retention-modal.tsx` (UI). Os botões são de `utils/glass-button.tsx`, o mesmo do review: glass nativo do iOS 26
  (SwiftUI via `@expo/ui`, que vem com o expo-router 57) e cápsula RN no Android/iOS < 26; "Agora não" só texto.
  Tudo menos o `.tsx` é testado no bun (`tests/retention-*.test.ts`; a loja mockada em
  `tests/helpers/rc-store-mock.ts`, produtos no formato do SDK em `tests/helpers/rc-store-fixtures.ts`).
- **Abrir com compra**: `showRetention({segment?, offers?, productIdentifier?, variant?, locale?, imageUrl?,
  defaultBullets?})` → `{request, segment, skipped, reason}`, nunca lança. Ordem: `retention.enabled === false` desliga
  → `getCustomerInfo` → segmento (forçado ou `rc_status`; fora dos 6 de retenção não abre) → Premium ativo
  (`isPremiumEntitlement`) não recebe oferta, a não ser com segmento forçado → ofertas (`offers` do app ou
  `retention.segments.<segmento>.offers`; sem lista não abre) → `resolveRetentionOffers` (para em 2 válidas; nenhuma =
  não abre) → `RetentionEvents.show`. O catálogo de exemplo (`discount_50`, `lifetime_deal`, `promo_code`) é SÓ da
  pré-visualização.
- **Conferência na loja** (`resolveRetentionOffers`, regras na seção 14 do plano): preço sempre da loja; produto
  anterior por segmento (`findRetentionPreviousProduct`, usa `getLifecycleEntitlement` do `rc-status.ts`); produto pelo
  `getProducts` com os pacotes dos offerings de reserva; no Android o RevenueCat devolve um produto por base plan
  (`assinatura:basePlan`) — a lib pede o id do entitlement como está e escolhe o base plan da pessoa (pedir
  `id:basePlan` na loja de teste não devolve nada); preço normal no Android com várias opções = `purchaseSubscriptionOption`
  do base plan (o `defaultOption` escolheria trial/desconto). `RetentionOffer` ganhou `action` (o que o toque faz:
  `resubscribe` com renovação desligada é `purchase` no Android e `reactivate` no iOS) e `store` (referência de compra,
  opaca para a view). Oferta pulada vai em `skipped` com o motivo e no `retention_offer_unavailable`.
- **Abrir sem compra**: `RetentionEvents.show({segment, offers, state, variant, productIdentifier, expirationDate,
  managementURL})` — `offers` já com preço; sem `segment`/`offers` = fase 1 (trial cancelado + "Reativar"). A
  pré-visualização resolve nomes (`resolveRetentionOfferInput`) com preços falsos (BRL em pt, USD nas outras). A 1ª
  oferta é o botão principal, a 2ª um cartão tocável abaixo dele, o resto o modal ignora. O modal em si não confere
  `retention.enabled` nem a lista (quem confere é o `showRetention`). Sem `variant`, sai do `is_opted_out_trial_enabled`
  (true → `premium_kept`). `RetentionEvents.hide()` fecha por fora; `onClosed` traz o motivo (`dismiss`/`swipe`/`back`/
  `overlay`/`recovered`/`confirmed`/`purchased`/`redeem`/`hidden`).
- **Toque fora da pré-visualização**: `reactivate`/`update_payment` abrem a gestão da assinatura e vão para
  "conferindo"; `purchase` → `purchaseRetentionOffer` com spinner no botão tocado e todos os botões desligados —
  comprou: fecha com `purchased` (vitalício em `billing_issue` → aviso de cancelar a antiga), cancelou: nada, pendente
  (código 20) / falhou: linha `purchase.pending` / `purchase.error` acima do botão e o modal continua aberto;
  `resubscribe` no Android com o código 6 (a loja diz que já é da pessoa) cai no `reactivate`. `redeem` →
  `redeemRetentionCode` (link da loja; no iOS sem link, a folha da Apple depois de o modal sair) e fecha com `redeem`.
  Comprou com Premium: `@isPremium` gravado (como o PaywallUtils). Analytics só fora da pré-visualização
  (`docs/ANALYTICS-EVENTS.md`, seção "Retenção"; preço em `price`/`price_currency`, nunca `value`/`currency`).
- **Pré-visualização** (`showRetentionPreview`): nada vai à loja; `retentionPreviewNext` decide (conferindo / aviso
  pós-compra do vitalício em `billing_issue` / fecha com `confirmed`) e cada toque sai no Metro por `expoUtilsLog`
  (`[expo-utils] retention preview: …`).
- **Dono único (`RetentionModalSlot`)**: o `ExpoUtilsLayout` (prioridade 0), o `AskForReviewOverlay` (1) e o
  `PromotionalContent` (2) montam um slot cada; só o de menor prioridade desenha. Isso existe porque o template padrão
  (e o lab) NÃO usam o `ExpoUtilsLayout` — montar só nele deixava o modal invisível nesses apps. Os dois overlays devolvem
  `[overlay | null, slot]` sempre na mesma posição para o slot não remontar quando o review abre/fecha.
- **Plataforma e formato** (`request.style`, resolvido no `RetentionEvents.show`: `style` da chamada → `retention.style`
  do Remote Config → plataforma; `"sheet"` da fase 1 e valor desconhecido caem no padrão). `fullscreen` (padrão no iOS):
  iOS = `Modal` `pageSheet` + `allowSwipeDismissal` (no RN 0.86 a folha só fecha arrastando com essa prop; o arraste
  chega como `onRequestClose`); Android = folha em JS da altura da tela, 10dp abaixo da status bar (a faixa à mostra
  fica igual à do pageSheet do iOS 26, medido). `bottomsheet` (padrão no Android) = folha em JS do padrão do promo, da
  altura do conteúdo, nas duas plataformas. O arrastar da folha em JS: o `Modal` do RN responde `true` no
  `onStartShouldSetResponder`, então o `PanResponder` da folha tem que pegar o toque no início (senão o RN nunca mais
  pergunta a ela no movimento — o arrastar não fechava até 10/10/2026); mas só quando o conteúdo cabe, porque no Android
  o responder JS num ancestral segura o toque do ScrollView e a rolagem morre. "Reativar": iOS
  `Purchases.showManageSubscriptions()` (resolve quando a folha ABRE) e Android `managementURL` via `Linking`
  (`showManageSubscriptions` lança no Android), com `playSubscriptionsUrl(pacote, produto)` de reserva (`sku` sem o
  `:basePlan`). Depois do toque, nas duas plataformas, estado "conferindo" com "Já reativei" (invalida o cache do RC e
  relê; `trial`/`intro`/`active` = reativou).
- **Textos**: `Translations.retention` no `utils/i18n.ts` (12 línguas; os grupos `segments`, `ctas`, `cards`, `notice` e
  `units` são das ofertas). Ordem por campo: `retention.texts[língua]` do Remote Config → lib na língua → `texts.en` do
  Remote Config → lib en. Chaves do Remote Config: `<segmento>.title|body|bullets|date`, `offers.<nome>.cta|title|
  period|terms|badge|hint`, `notice.*`, `dismiss` e as da fase 1 (`header`/`body`/`bullets`/`cta`, só no
  `trial_cancelled`) e `purchase.error`/`purchase.pending` (linha da compra que falhou/ficou pendente; lib:
  `purchaseError`/`purchasePending`). Bullets nunca misturam línguas. Linha da data por `Intl.DateTimeFormat` (sem
  plural de dias).
  Texto novo tem que caber nos limites da Apple (título/bullet ≤ 66, corpo ≤ 144 com `{app}` de 20 caracteres e preços
  reais; botão ≤ 30): `tests/retention-texts.test.ts` e `tests/retention-offers.test.ts` quebram se passar.
- **Plural e preço**: `units.per` ("/mês") e `units.first` ("nos 3 primeiros meses") por categoria do CLDR, escolhida à
  mão em `retentionPluralCategory` — o Hermes não tem `Intl.PluralRules` (`strings` no hermesvm do lab: NumberFormat,
  DateTimeFormat e Collator sim; PluralRules não). Preço: o `formatted` da loja vence; sem ele, `Intl.NumberFormat`.
- **Árabe**: só o modal vira RTL. `textAlign` left/right e `row` seguem a direção do LAYOUT do app (o RN troca os lados
  quando o app está em RTL — `RCTAttributedTextUtils.mm` e `TextLayoutManager.kt`), então o lado é calculado de
  (texto RTL × `I18nManager.isRTL`). O Android escolhe a direção do parágrafo pelo 1º caractere forte: o texto RTL
  ganha um RLM (`‏`) na frente.


# Checksum MD5 do Remote Config

Este documento descreve como implementar (em um app Expo que consome o `expo-utils`)
um checksum MD5 de alguns campos do Remote Config e enviar para o Firebase Analytics,
sem usar bibliotecas externas para hash.

## Objetivo

Gerar um hash **MD5** a partir de um subconjunto do Remote Config
(`adunits`, `is_ads_enabled`, `min_version`) e enviar um evento para o
Firebase Analytics no **startup** do app. O hash serve apenas para
verificar que os dados recebidos pelo app estao corretos, sem expor
os valores em texto.

## Regras obrigatorias

- Nao usar biblioteca externa de hash.
- Implementar MD5 em TypeScript puro (arquivo utilitario local).
- Nao enviar os `adunits` em texto; apenas:
  - hash (`cfg_hash`)
  - contagem de adunits (`ad_count`)
  - `is_ads_enabled`
  - `min_version`
  - `app_version`
- Disparo **somente no startup** (sem listener de mudanca do Remote Config),
  a menos que o usuario peça o contrario.
- Evitar envios em `__DEV__`.

## Onde aplicar

Esse fluxo deve ser implementado no **app host** (o projeto Expo que usa
`expo-utils`), nao dentro do pacote `expo-utils`, a menos que o usuario
peça explicitamente para alterar o pacote.

## Passo a passo (no app host)

1. Criar utilitario MD5 em TS puro
   - Exemplo de arquivo: `src/utils/md5.ts`
   - Exportar `md5(input: string): string` (hex lowercase).
   - Implementacao com funcoes bitwise (add32, rol, ff, gg, hh, ii, etc.).

2. Criar util de integridade do Remote Config
   - Exemplo: `src/utils/config-integrity.ts`
   - Funcoes sugeridas:
     - `stableStringify(value)` para JSON deterministico (ordena chaves).
     - `pickIntegrityFields(remoteConfigs)` -> `{ adunits, is_ads_enabled, min_version }`.
     - `reportConfigIntegrity(remoteConfigs, appConfig)`:
       - Se `__DEV__`, retorna.
       - `const payload = pickIntegrityFields(...)`
       - `const checksum = md5(stableStringify(payload))`
       - Enviar evento Analytics:
         - `eventName`: `cfg_integrity`
         - params: `cfg_hash`, `ad_count`, `is_ads_enabled`, `min_version`, `app_version`

3. Chamar no startup (ex.: `src/app/_layout.tsx`)
   - Apos `Utils.prepare(...)`, chamar:
     - `reportConfigIntegrity(global.remoteConfigs, appConfig);`
   - Nao adicionar listener de mudanca do Remote Config,
     salvo pedido explicito do usuario.

## Observacoes

- O MD5 nao e seguro para criptografia; aqui e apenas checksum.
- O objetivo e **verificar consistencia**, nao proteger segredos.
- Se o usuario solicitar SHA-256 ou outro hash, ajustar a implementacao
  (ainda sem libs externas).


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`expo-utils` is a CLI tool and utility library that automates 90% of the initial setup for Expo/React Native projects. It provides:

- Automated dependency installation via a custom CLI (`expo-utils-install`)
- Pre-built utilities for ads (AdMob), Firebase integration, internationalization, and analytics
- Template scaffolding for common Expo patterns
- Configuration management for complex integrations (Firebase, RevenueCat, Facebook SDK, etc.)

This is a **library package** that gets installed into user projects, not a standalone application.

## Package Manager Support

The CLI auto-detects the package manager via `detectPackageManager()` in `bin/install.js`. Detection priority:

1. **Lockfile** (most reliable): yarn.lock → pnpm-lock.yaml → package-lock.json → bun.lockb/bun.lock
2. **User agent** (`npm_config_user_agent`): yarn → pnpm → bun → npm
3. **Default**: **bun**

The detected PM controls both the install command (`bun add`, `yarn add`, etc.) and the exec runner (`bunx`, `npx -y`, etc.) used for `expo install`.

## Development Commands

### Building/Testing

- This project has **no build step** - it's distributed as plain TypeScript/JavaScript
- TypeScript is only used for type checking in development
- To test locally: `npm pack` then `bun add ./expo-utils-X.X.X.tgz` in a test project (avoids symlink issues)

### Running the CLI

- Test CLI installation: `node bin/install.js` (from within a test project that has expo-utils installed)
- CLI flags:
    - `--new`: Full setup for new projects (runs all scaffolding with confirmation prompts). During the app-reset step (behind the `Y/n` prompt) it cleans `assets/images/` down to an **allowlist** — keeps only `icon.png`, `splash-icon.png`, `android-icon-background.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`; removes **everything else** — every other loose file (`react-logo*`, `favicon`, `partial-react-logo`, `expo-badge*`, `expo-logo`, …) **and subfolders** (e.g. the template's `tabIcons/` with the example `explore`/`home` icons), recursively. Since `--new` targets new projects, any subfolder there is template junk, not your asset. It also deletes the broken `assets/expo.icon/` Icon Composer folder (pairs with `--expo-icon`, which strips the matching `ios.icon` from app.json).
    - `--config`: Add standard plugins to app.json, including the default `expo-splash-screen` config. Also sets `ios.supportsTablet: true` (iPad support) and the Android `AD_ID` permission.
    - `--layout`: Replace root \_layout.tsx with template
    - `--srcapp`: Move app/ to src/app/
    - `--languages`: Setup i18n with pt/en/es translations. Also writes localized iOS purpose strings (`NSUserTracking`/`NSPhotoLibrary`/`NSPhotoLibraryAdd`/`NSCamera` usage descriptions) into each `languages/<locale>.json` for `expo.locales` → `InfoPlist.strings`, **merging** into existing files (adds only missing keys, preserves your translations). The Info.plist base keys themselves are injected by the config plugin (see Configuration System).
    - `--firebase-placeholders`: Create placeholder Firebase config files
    - `--skadnetwork`: Remove SKAdNetworkItems from app.json (the IDs are now injected into Info.plist by the expo-utils config plugin at prebuild — see `app.plugin.js`). Keeps any custom IDs not in the plugin list.
    - `--constants`: Create constants folder with Strings.ts template
    - `--eas-config`: Setup EAS Build, build cache, remove updates block. Does **not** inject an `extra.eas.projectId` — that ID is per-project on EAS, so a shared/fixed value would point a brand-new app at another app's EAS project (cross-app build/update contamination). If it finds the OLD shared placeholder (`df0dc510-fafe-4076-9ea7-6926d54cb2ab`, injected by earlier expo-utils versions) it removes it; any other `projectId` already present (a real one from a prior `eas init`) is left untouched. Run `eas init` (or the first `eas build`) to link the app to a real EAS project — that populates `extra.eas.projectId` and `extra.owner` correctly.
    - `--tracking-permission`: Add iOS tracking transparency permission
    - `--fix-ios-build`: Apply iOS build fixes (expo-build-properties, static frameworks). Also dedupes string arrays in `infoPlist` (e.g. `UIBackgroundModes`), preserving order — object arrays like `SKAdNetworkItems` are left to `--skadnetwork`.
    - `--expo-icon`: Removes a broken `ios.icon` — one pointing at a path that doesn't exist on disk (e.g. a deleted `./assets/expo.icon`), which makes `actool` fail at prebuild with `attempt to insert nil object from objects[0]`. The iOS then falls back to the valid root `icon`. Removed **only** when a valid root `icon` exists; otherwise it just warns (never leaves the app icon-less). Runs automatically in `--new` — and **again right after the app-reset step**, because `handleAppReset()` is what deletes `assets/expo.icon`, so the first (pre-reset) pass can't yet see the now-orphaned `ios.icon` (the directory still existed). The post-reset pass strips it.
    - `--gitignore`: Update .gitignore with ios/, android/, etc.
    - `--hot-updater`: Setup Hot Updater (babel.config.js, .env files, dependencies)
    - `--sort-plugins`: Reorder app.json `plugins` so string plugins come first, then array (`[name, config]`) plugins (stable within each group). Also runs automatically at the end of `--config` and `--new`.
    - `--pin-deps`: Pin every project dependency in `package.json` to an **exact** version so installs are identical across machines. Strips range operators (`^`, `~`, `>=`, `>`, `<=`, `<`, `=`) from `dependencies`/`devDependencies`/`optionalDependencies` and, whenever the package is installed, rewrites the spec to the version actually resolved in `node_modules` (otherwise falls back to the range's floor). Non-registry specs are **preserved untouched** — git/GitHub (incl. shorthand `owner/repo`), `file:`/`link:`/`workspace:`/`npm:` and tarball/URL/path specs (anything containing `:` or `/`), so e.g. `expo-utils` installed via a GitHub link is never overwritten. Composite ranges (`>=1 <2`) on not-installed packages are left as-is. Runs automatically near the end of `--new` (after all handlers that modify `package.json`).
    - `--policy-checks`: Sync `templates/POLICY-CHECKS.md` → the app's `.claude/POLICY-CHECKS.md` — the list of store-review rules that already got a real build rejected (Apple/Google), each with app, version and rejection date. It's a **generated** file: unlike `AGENTS.md`/`CLAUDE.md` (copied only when missing), it is **overwritten** whenever the content differs, so the list never freezes at the version the app was scaffolded with — that's the whole point of it. It also appends a tagged pointer block (`<!-- expo-utils:policy-checks -->`) to the app's `AGENTS.md` when that file exists and doesn't already mention `POLICY-CHECKS.md` (additive and idempotent — apps scaffolded before this flag keep their own AGENTS.md, so without the pointer the agent would never read the list). Runs automatically in `--new`, right after `handleClaudeMdFlag()`. **New rule goes in `templates/POLICY-CHECKS.md` — never in an app's copy** (it gets overwritten), and the index in `templates/AGENTS.md` (REGRA 6) must be updated in the same task.

## Architecture

### Core Components

#### 1. CLI System (`bin/install.js`)

The CLI is a Node.js script that scaffolds Expo projects. It:

- Detects and installs missing peer dependencies (using expo install when possible)
- Modifies `app.json` to add plugins and configurations
- Creates template files from `templates/` directory
- Handles project structure transformations (moving app/ to src/app/, etc.)

**Key Pattern**: Each CLI flag has a dedicated `handle*Flag()` function. The `--new` flag orchestrates multiple operations with user confirmation for destructive changes.

#### 2. Utils Module (`utils/Utils.ts`)

Central initialization module with a `prepare()` function that:

- Loads Firebase Remote Config settings
- Configures RevenueCat (in-app purchases)
- Initializes Firebase (Analytics, Crashlytics, Push Notifications)
- Sets up Facebook SDK with App Events
- Configures Microsoft Clarity analytics
- Requests iOS tracking permissions
- Checks for required app updates
- Subscribes to Firebase topic based on app slug
- Dispara a **fase 1 da atribuicao do RevenueCat** logo apos o `Purchases.configure` (destacada, nao atrasa o
  splash) e arma o **watchdog do `handleReady`** (30s sem `handleReady` → `expoUtilsWarn`). UMP/ATT/push/FB/
  TikTok/fase 2 NAO rodam no `prepare()`: rodam no `Utils.handleReady` → `requestTrackingWhenActive`
- Mantem a user property `rc_status`, o `user_id` do GA4 (= App User ID do RC) e os topicos FCM de assinatura
  (estado + marcos, `utils/rc-status.ts`) a cada `customerInfo`
- Loga um evento cujo **nome é o slug do app**, 1x por instalação, via `Utils.logFirstOpenOnce()` — flag `@first_open_logged` no AsyncStorage; roda no bloco não-bloqueante do boot (não atrasa o splash). O slug passa por `.replace(/\W/g, "_").slice(0, 40)` porque nome de evento GA4 só aceita `[A-Za-z0-9_]` e no máximo 40 chars — `titulo-eleitor` vira `titulo_eleitor`.

**Important**: dependencias (inclusive as opcionais) entram como `import` no topo do arquivo — ver "Imports (REGRA OBRIGATORIA)" em Common Patterns. A protecao contra pacote ausente/erro de SDK e o try/catch em volta da chamada, nunca import tardio.

**Global Variables Set by prepare()**:

```typescript
global.remoteConfigUtils;   // bloco `utils` do Remote Config (do `settings` ou, sem ele, do parâmetro `utils`)
global.remoteConfigScreens; // bloco `screens`
global.remoteConfigs;       // os dois juntos (em conflito vale o utils); até a 1.4 era apelido do remoteConfigUtils
global.isAdsEnabled;      // Master ad toggle
global.adUnits;           // AdMob unit IDs per platform
```

`prepare()` roda **uma vez por sessão** (memoizado em `preparePromise`): chamadas repetidas (StrictMode/remount) só aguardam o mesmo boot e re-liberam a UI — não reconfiguram RevenueCat nem re-registram o `customerInfoUpdateListener`.

#### 3. Ad System (`utils/LoadAdsManager.ts`, `utils/banner-ad.tsx`)

Handles Google Mobile Ads with automatic premium user detection:

- Premium check unificado via `PremiumUtils.getIsPremiumStatus()` (DEV: `@isPremium`; produção: RevenueCat — ver "Premium User Detection")
- Respects `global.isAdsEnabled` and `global.remoteConfigUtils.is_ads_enabled`
- Provides `showInterstitial()` and `showRewarded()` methods — **contrato: nunca penduram nem lançam** (resolve `true` = fluxo segue [fechou ad/premium/ads off/bloqueado/sem unitId], `false` = erro de ad). O executor antigo (`new Promise(async ...)`) engolia exceções (ex.: `createForAdRequest(undefined)`) e o `await` do app travava pra sempre.
- `BannerAdComponent` supports customizable styling via `useFooterStyle` prop; banners retornam `null` sem `unitId` (o `<BannerAd>` lança no render se receber undefined)

#### 4. Internationalization (`utils/i18n.ts`)

Provides translations in 12 languages (pt, en, es, fr, de, it, ja, ko, zh, ru, ar, nl). Auto-detects system language via `expo-localization` with fallback to 'en'.

#### 5. Type System (`utils/types.ts`)

Defines core interfaces:

- `AppConfig`: Expo app.json structure
- `AppStrings`: Local app strings with `rckey` (RevenueCat key) and `adUnits` (AdMob unit IDs)
- `AdUnits`: AdMob unit IDs (appOpen, banner, interstitial, rewarded)
- `RemoteConfigUtilsType`: Firebase remote config schema (all fields flat: ads, version, review, promotional, tiktokads, clarity, etc.)
- `FacebookConfig`: Facebook SDK configuration
- `RevenueCatKeys`: Platform-specific RevenueCat API keys
- `PromotionalConfig`: Promotional content configuration

### Peer Dependencies Strategy

This package uses **peer dependencies** extensively to avoid duplication. All major dependencies (Firebase, Expo modules, React Native packages) are peer deps. The package:

- Uses dynamic `require()` with try-catch for optional features
- Provides helpful warnings when features are unavailable
- Never crashes due to missing dependencies

### Configuration System

The package can be configured via the Expo config plugin in app.json:

```json
["expo-utils", {"disableWarnings": true, "disableLogs": true}]
```

These flags suppress console output from expo-utils in production (read at **runtime** from app.json via `plugin[1]?.disableWarnings`/`disableLogs` in `Utils.ts`).

Another **runtime** flag (opt-in, default **off**): `disableAdsIfBuildIsNewerThanStore: true` makes `prepare()` run the store-version ads gate. **Fail-closed**: ads stay on only with a CONFIRMED store version and local build <= store — a build newer than the store (App Review/TestFlight), an app not yet published (first-version review: iTunes lookup returns `resultCount: 0`), network errors and the 5s timeout all turn ads OFF (`global.isAdsEnabled = false`, `is_ads_enabled: false` in the global remote configs, plus the gate-owned `global.adsDisabledByStoreGate = true`, which `prepare()` never touches). Store version: iTunes lookup (user's storefront via `regionCode` first, then global/US — without `country` the lookup hits the US storefront and an app published only elsewhere would look unpublished) / Play Store page (Android), with `ios_store_version`/`android_store_version` from Remote Config as the post-launch override valve (`getStoreVersion` never rejects, so the valve works even when the lookup is down). The gate is **awaited** inside `prepare()` — after `setupGlobalConfigs` (which resets/overwrites the ad globals, so an app-side gate racing the boot gets clobbered) and before `setAppIsReady(true)` — because `banner-ad.tsx` reads `global.isAdsEnabled` **once on mount** and `ExpoUtilsLayout` children mount as soon as `appIsReady` flips; awaiting guarantees banners mount after the verdict. Memoized (once per session, StrictMode-safe); returns `Promise<boolean>` (true = ads blocked). Also callable manually, always **after** `prepare()`.

The same config plugin (`app.plugin.js`) also injects all SKAdNetwork IDs (`data/skadnetwork_ids.json`) into the iOS `Info.plist` at **prebuild** via `withInfoPlist`, so the ~160 IDs no longer need to live in `app.json`. The merge is case-insensitive and preserves any custom `SKAdNetworkItems` already present. The plugin is wrapped in `createRunOncePlugin` to avoid double-application. Just keep `["expo-utils", { ... }]` in the `plugins` array.

By default the same plugin also hides the `expo-dev-menu` onboarding overlay **and** the floating action button (FAB) in **DEBUG** dev builds, by injecting flags into native boot at **prebuild** (tag `skip-devmenu-onboarding`, via `mergeContents`): iOS `AppDelegate.swift` (`#if DEBUG` → `UserDefaults.standard.set(true, "EXDevMenuIsOnboardingFinished")` + `set(false, "EXDevMenuShowFloatingActionButton")`) with `withAppDelegate`; Android `MainApplication.kt` (`if (BuildConfig.DEBUG)` → SharedPreferences `expo.modules.devmenu.sharedpreferences`, `isOnboardingFinished=true` / `showFab=false`) with `withMainApplication`. It runs before the first frame, so neither overlay nor FAB ever appears; inert in release (compiled out). The FAB only shows once onboarding is finished, so both flags are set together. Opt out with `["expo-utils", { "skipDevMenuOnboarding": false }]` — this option is read at **prebuild** (unlike `disableWarnings`/`disableLogs`, read at runtime).

The plugin also accepts an **opt-in** `firebaseLogLevel` option (`"error" | "warn" | "info" | "debug"`, or `true` = `"error"`) that quiets the **native** Firebase iOS SDK logs (e.g. `[FirebaseAnalytics][I-ACS...]`). At **prebuild** (`withDangerousMod` → `withFirebaseLogLevel`) it writes/merges `react-native.app_log_level` into a `firebase.json` at the **project root**, so you never have to create that file by hand — RNFirebase's `ios_config.sh` walks up from `ios/` and reads it, applying `[FIRConfiguration setLoggerLevel:]`. The merge **preserves** other `firebase.json` keys and does **not** overwrite a manually-set `app_log_level` (idempotent across re-prebuilds). It's iOS-only (the key only applies to iOS) so it runs in the iOS mod. Note: this does **not** silence RNFirebase's own `DLog` lines (`RNFBMessaging getAPNSToken`, `RNFBCrashlyticsInit`) — those are `#ifdef DEBUG NSLog` and vanish in release builds. Example: `["expo-utils", { "disableWarnings": true, "firebaseLogLevel": "error" }]`.

The plugin also injects two **RNFirebase Analytics Podfile globals** at **prebuild** (`withDangerousMod` → `withAnalyticsPodfileGlobals`, anchored after `require 'json'`, one tagged block, idempotent + try/catch), both **on by default** (opt-out):

- `analyticsAdSupport` → `$RNFirebaseAnalyticsEnableAdSupport = true` → `RNFBAnalytics.podspec` links `AdSupport.framework` → Firebase Analytics gets IDFA access → audience demographics/interests on iOS (parity with Android). **Privacy:** collects IDFA in production — requires ATT (expo-utils already prompts) + IDFA declared in the privacy manifest / App Store. Default-on because expo-utils is ads-first (AdMob apps already collect IDFA); turn **off** for a no-ads app with `{ "analyticsAdSupport": false }`.
- `analyticsOnDeviceConversion` → `$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion = true` → podspec adds the `GoogleAdsOnDeviceConversion` pod, resolving the `[FirebaseAnalytics] Failed to initiate on-device conversion measurement... dependency does not support this feature` log. Opt-out with `{ "analyticsOnDeviceConversion": false }`.

**Why the Podfile (not the analytics config plugin):** `@react-native-firebase/analytics` only ships a config plugin in newer RNFirebase — in **v24** (the supported peer range here) it has **no** `app.plugin.js`, so referencing `["@react-native-firebase/analytics", { ... }]` in `app.json` **crashes `expo prebuild`**. The Podfile globals (read by `RNFBAnalytics.podspec`) work on any version. Needs `prebuild --clean` + rebuild to take effect.

The plugin also injects **iOS privacy purpose strings** into the Info.plist at **prebuild** (`withInfoPlist` → `withIosUsageDescriptions`), **on by default**. Common SDKs reference sensitive APIs even when your app never uses them — `expo-image`/`expo-video`/`expo-file-system` and `FBSDKShareKit` reference the Photo Library — so Apple rejects the build with **ITMS-90683** ("Missing purpose string") unless the key is present in the Info.plist (localized `InfoPlist.strings` alone aren't enough for Apple's static check). It adds `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` and `NSCameraUsageDescription` **only if the dev hasn't already set them** (preserves anything in `app.json` `ios.infoPlist`). Per-language translation comes from `expo.locales` (the `languages/*.json` written by `--languages`, mirroring the same three keys, with pt/en/es). Base default text is **English** (neutral fallback for locales without an `.lproj`). Opt out entirely with `{ "usageDescriptions": false }`, or per key: `{ "usageDescriptions": { "NSCameraUsageDescription": false } }` (pass a string to override the default text). **Android has no equivalent** — ITMS-90683 is iOS-only; the Play Store doesn't require purpose strings.

**Ícone do app no tutorial de avaliação (default on):** `appIcon` — `withAppIconDataUri` lê `expo.android.icon` / `expo.icon`, reduz para 96px e grava o data URI em `config.extra.expoUtilsAppIcon`; `utils/ask-for-review.tsx` lê de `Constants.expoConfig?.extra`. **Não escreve no `app.json`** — o config é mutado em memória e sai no `app.config` gerado (`$buildDir/generated/assets/expo-constants/` no Android, resource bundle no iOS), ambos dentro de `android/`/`ios/`, já gitignorados. O `extra` é montado com spread porque carrega `eas.projectId` e `router.origin`.

Redimensiona com **`jimp-compact`**, não com `sharp`. `sharp` **não é dependência do Expo** — quando aparece num projeto é por acaso (no `expo-urna` vem do `miniflare`/`lightningcss`), e num projeto Expo limpo ele não existe: o plugin cairia no catch e não faria nada, em silêncio. `jimp-compact` é JS puro e vem dentro do `@expo/image-utils`, que o `expo-asset/app.plugin.js` carrega durante a resolução do config — sem ele o `expo config` já nem roda. É resolvido via `require.resolve("jimp-compact", {paths: [dirname(@expo/image-utils)]})` para funcionar também no pnpm. Sendo async num plugin síncrono, roda por `execFileSync` (`process.execPath`, testado sob node e bun) com `stdio: ["ignore","pipe","ignore"]` — sem isso o stderr do filho vaza no terminal a cada `metro start`. Cache em `node_modules/.cache/expo-utils/` chaveado por mtime+tamanho; a escrita do cache acontece **depois** de aplicar o `extra`, senão um `node_modules` read-only custaria o ícone da build. Medido em projeto limpo: 234ms a frio, 69ms com cache (146ms/70ms no bun). Ramos verificados, todos deixando o config intacto: sem `icon`, `icon` apontando para diretório, arquivo inexistente, `icon` como URL. Opt out: `{ "appIcon": false }`.

**Por que no plugin e não em runtime:** em release no Android o asset do bundle vira nome de drawable (`expo-asset` seta `localUri = uri` quando a URI não tem `:`) e o `FileSystem.readAsStringAsync` falha — `appIcon={require(...)}` funciona no dev e some no release, silenciosamente. O data URI não passa pelo pipeline de asset.

**Android AdMob / Kotlin (default on):** `androidKotlinAdsFix` injects at **prebuild** (1) `-Xskip-metadata-version-check` on all `KotlinCompile` tasks in the project `build.gradle` (tag `expo-utils-android-kotlin-ads-fix`) and (2) `org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m` in `gradle.properties`. Reason: `play-services-ads` (via `react-native-google-mobile-ads`) ships Kotlin metadata **2.3.0** while Expo SDK 57 still compiles with Kotlin **~2.1.x**, which fails `:react-native-google-mobile-ads:compile*Kotlin` with "metadata is 2.3.0, expected version is 2.1.0". Heap bump avoids OOM on large Firebase+ads+fbsdk graphs. Does **not** pin Gradle version. Opt out: `["expo-utils", { "androidKotlinAdsFix": false }]`. Apps should **not** keep a local `plugins/with-*-gradle*` for this — it belongs here so every app stays clean.

**AdMob Mediation (default on):** `mediation` liga as **4 redes padrao** do catalogo `data/mediation_adapters.json` — AppLovin, Meta, Unity e Pangle. O catalogo tem mais 5 marcadas com `"default": false` (liftoff/vungle, mintegral, bidmachine/appodeal, moloco, bigo) que **so entram quando o app pede pelo nome**, para o build nao crescer sozinho a cada rede nova no catalogo. No **prebuild** o plugin faz tres coisas, todas idempotentes via tag `@generated`:

1. `withAndroidMediationAdapters` — `implementation("com.google.ads.mediation:<art>:<ver>")` dentro do `dependencies {` do `android/app/build.gradle` (tag `expo-utils-admob-mediation`). `expo-build-properties` **nao** serve aqui: ele so tem `extraMavenRepos`/`extraPods`, nao tem chave de dependencia Gradle (o exemplo `android.dependencies` da doc do RNGMA nao existe no plugin). **Adapter nao e rede**: o adapter Android da Unity NAO declara o SDK no POM ("This build does not contain the UnityAds SDK") e o app ia sem `com.unity3d.ads` (0% de match, visto num APK de producao em 06/10/2026). Por isso `android.extraArtifacts` no catalogo (hoje so `com.unity3d.ads:unity-ads`, versao = adapter sem o ultimo numero, que acompanha se o app trocar a versao do adapter). `androidMediationDependencies` deduplica por artefato — a versao vinda do app.json vence a do catalogo (app com chave propria `"unity-sdk"` continua com 1 linha). Ao subir versao de adapter ou adicionar rede: `node scripts/check-mediation-poms.js` (POM no Google Maven + podspec no CocoaPods; fora do `tests/run.sh`) e atualizar a tabela de `tests/mediation-catalog.test.ts`, que quebra se a versao do catalogo nao foi conferida ou se rede sem SDK no POM ficar sem `extraArtifacts`.
2. `withAndroidMediationRepos` — bloco `allprojects { repositories { … } }` no fim do `android/build.gradle` (tag `expo-utils-admob-mediation-repos`) para Mintegral (`dl-maven-android.mintegral.com/...`) e Pangle (`artifact.bytedance.com/repository/pangle`): esses dois SDKs (`mbridge_android_sdk`, `pag-sdk`) **nao estao** no Maven Central nem no Google Maven. Blocos `allprojects` extras somam — o template do Expo 57 nao usa `dependencyResolutionManagement`.
3. `withIosMediationPods` — `pod '<Adapter>', '<ver>'` logo apos `use_expo_modules!` no Podfile (mesma tag do item 1).

Versoes **pinadas de proposito**: cada podspec declara `Google-Mobile-Ads-SDK ~> X` e o RNGMA 16.4.0 traz o **13.5.0** — pod sem versao pode resolver um adapter que exige 13.6+ e derrubar o `pod install` (caso real: `GoogleMobileAdsMediationPangle` 8.2.0.7+ exige `~> 13.6`, por isso pinamos 8.2.0.3.0). Os adapters Android sao compilados contra `play-services-ads:25.4.0`, que e o pin do RNGMA 16.4.0 — por isso o **minimo e 16.4.0**. Ao subir o RNGMA, revalidar o catalogo inteiro. Os SKAdNetworkIDs dessas redes ja estao em `data/skadnetwork_ids.json`. Opt out: `{ "mediation": false }`; subset: `{ "mediation": ["applovin", "meta"] }`. Apps **nao** devem manter plugin local pra isso.

**Escotilha para rede fora do catalogo:** o valor de uma chave pode ser a definicao inteira — `{"moloco": {"android": {"artifact": "…", "version": "…", "mavenRepo": "…"}, "ios": {"pod": "…", "version": "…"}}}`. `resolveMediationNetworks` distingue pelo TIPO (string = versao, objeto com `artifact`/`pod` = definicao) e faz merge quando a chave existe no catalogo. Definicao de uma plataforma so injeta naquela plataforma. Regra ao usar: validar a restricao `Google-Mobile-Ads-SDK ~> X` do podspec contra o pin do RNGMA antes de fixar a versao do pod. Coordenadas ja conferidas (14/08/2026, compativeis com GMA 13.5): BidMachine `bidmachine:3.7.1.1` / pod `3.7.1.0.1`; Moloco `moloco:4.11.0.0` / pod `4.9.0.0`; BIGO `bigo:5.10.1.0` / pod `5.3.0.0`; ironSource `ironsource:9.5.0.0` / pod `9.5.0.0.0`.

**Exclusao condicional (`excludeWhenPackage`)**: o SDK do Pangle embute uma copia do TikTok Business SDK (`com.pangle.global:tiktok-business-android-sdk-comp:1.6.1`) que colide com o `expo-tiktok-ads-events` (`com.github.tiktok:tiktok-business-android-sdk:1.6.0`) — `checkReleaseDuplicateClasses` falha com "Duplicate class com.tiktok.TikTokBusinessSdk". O catalogo declara a exclusao e `resolveAndroidExcludes()` so a aplica quando o pacote npm conflitante existe no app (`node_modules/<pkg>`), gerando `implementation(...) { exclude group: ..., module: ... }`. Medido em app real (APK release universal): **127,5 MB sem mediation → 140,5 MB com 6 redes → 148,8 MB com 9**.

**Runtime de ads (`Utils.setupMobileAds`)**: chamado no inicio de `requestTrackingWhenActive`, ou seja **UMP antes do ATT** (ordem do Google; iOS so mostra um modal de sistema por vez). Roda `AdsConsent.gatherConsent()` com timeout de 20s (contrato do arquivo: nunca pendura) e, se `canRequestAds !== false`, chama `mobileAds().initialize()` logando o `AdapterStatus[]` — e assim que se confirma que os adapters subiram. Sai cedo em premium / `is_ads_enabled: false`. QA fora da Europa: `{ "umpDebugGeography": "EEA", "umpTestDeviceIds": [...] }` (lidos em RUNTIME via `getExpoUtilsOption`). `Utils.isPrivacyOptionsRequired()`, `Utils.showPrivacyOptionsForm()` e `Utils.resetAdsConsent()` sao a superficie publica do UMP. **`showPrivacyOptionsForm` retorna `{shown, reason}`, nao boolean**: o `showPrivacyOptionsForm` do SDK nao exibe nada quando `privacyOptionsRequirementStatus !== REQUIRED` (fora da EEA, ou antes do consentimento), e em build release o `console` e removido — sem o `reason` isso vira "o botao nao faz nada". A regra do app e esconder o botao com `isPrivacyOptionsRequired()`.

**ILRD (`utils/ad-revenue.ts`)**: banner/interstitial/rewarded/app-open disparam `ad_revenue` (formato, placement, value, currency, precision). O payload do SDK **nao tem a rede** que serviu — atribuicao por rede vem do `ad_impression` automatico do AdMob (requer ILRD ligado no console + link AdMob↔Firebase). Nao duplicar essa telemetria em app.

## Common Patterns

### Envio de relatorios por email (REGRA)

Sempre para **bruno.vmartins2@gmail.com**, sempre pela **API da Resend** (`POST https://api.resend.com/emails`,
`Authorization: Bearer <chave>`), nunca por Outlook/Mail. Chave e remetente ficam em
`~/Documents/projetos/pixel-analytics/api/.env` (`PIXEL_REPORT_RESEND_API_KEY`, `DAILY_AI_REPORT_EMAIL_FROM`);
o worker do `expo-caloria` tem o exemplo de uso. Anexo vai em base64 no campo `attachments`. Use `curl` com
User-Agent normal — o Cloudflare da Resend bloqueia o UA padrao do `urllib` com HTTP 403 (erro 1010).

### Imports (REGRA OBRIGATORIA)

**Sempre `import` no topo do arquivo. Nunca `require()` no meio do codigo.** Vale para tudo:
peer dependencies opcionais, modulos internos da lib, tudo. Import tardio/condicional so
esconde dependencia, quebra tree-shaking e tipagem, e deixa o arquivo com duas convencoes.

- Ciclo de import (ex.: `Utils.ts` <-> `PremiumUtils.ts`) nao e motivo para `require`: o uso
  acontece dentro de funcao, entao o ciclo resolve em runtime sem problema.
- Peer dependency opcional tambem entra no header — se o app nao instalou o pacote, o erro
  aparece no build/bundle (onde deve aparecer), nao escondido num caminho de execucao raro.

### Adding a New CLI Flag

1. Create a `handle*Flag()` function in `bin/install.js`
2. Add flag handling in `main()` function (both in `--new` block and individual flags section)
3. Document the flag in this file and README.md
4. If creating files, add templates to `/templates` directory

### Adding a New Utility Function

1. Add to existing utility files in `/utils` or create a new one
2. Export from `index.ts` if it should be public API
3. Import every dependency (inclusive peer deps) no topo do arquivo — ver "Imports" acima
4. Add proper TypeScript types in `types.ts` or inline

### Modifying app.json via CLI

Use the helper functions in `bin/install.js`:

- `getAppConfig()`: Read current app.json
- `writeAppConfig(config)`: Write back to app.json
- Always check if values exist before adding to avoid duplicates

### Working with Templates

Templates in `/templates` can use placeholders:

- `${androidPackage}` - replaced in google-services.template.json
- `${iosBundleId}` - replaced in GoogleService-Info.template.plist

## Important Notes

### Firebase Integration

- Firebase is **optional** - all Firebase code has null checks
- The package uses Firebase v24+/v25 modular API (getRemoteConfig, getAnalytics, etc.). Remote Config dual-path supports RNFB v24 modular helpers and v25 instance `settings`/`defaultConfig`.
- `Utils.getRemoteConfigUtils()` é **memoizado** (1 fetch por sessão — prepare e todos os banners compartilham a mesma promise; antes cada banner refazia `fetchAndActivate` e arriscava throttle) e tem teto de **10s** (era 60s) pra nunca segurar o splash em RC nativo pendurado.
- **Remote Config em blocos (v1.5.0, `utils/settings.ts`, plano `docs/PLANO-SETTINGS.md`):** a lib lê o parâmetro `settings` = `{"utils": {...}, "screens": {...}}`; sem os blocos (ausente, inválido ou o `settings` plano de antes de fevereiro de 2026) lê os parâmetros `utils` + `screens`. O `getRemoteConfigScreens()` sai da mesma leitura. `cfg_integrity.cfg_source` diz qual caminho valeu (`settings`/`legacy`/`default`). Quem publica é o pldev (`rc push`): pela versão instalada da lib decide entre o modelo antigo e o `settings` com a condição `app.id` + `app.version >= V`, e mantém cópias de `utils`/`screens` para os builds antigos até `rc legacy off`. **Nunca publicar `settings` com blocos sem a condição de versão** onde ainda há build da lib 1.0.x (ele lê o `settings` plano: expo-urna e expo-urna-v2 são o mesmo app Android). O pldev monta o formulário a partir do `RemoteConfigUtilsType` (parser do TypeScript, não regex): campo novo leva comentário com `@section` e `@label` — `tests/settings.test.ts` quebra sem eles.
- Placeholder files work for development but must be replaced with real configs for production

#### APNS / FCM gate (`Utils.ensureApnsReady`)

iOS push only works once the **APNS token** arrives (a native async callback). All FCM call sites (`requestFCMToken`, `setupMessagingTopics`, `updateRCStatusMessagingTopic`, `setupAttribution`) gate on `Utils.ensureApnsReady()` before calling `getToken`/`subscribeToTopic`, so they never throw "No APNS token specified" / `[messaging/unregistered]`. The gate:
1. **Simulator/emulator skip** — if `expo-device` is installed and `Device.isDevice === false`, it returns `false` immediately **without calling `getAPNSToken`**, so the native DLog spam (`getAPNSToken - Simulator without APNS support`, ~8 lines) drops to ~0 and boot isn't blocked 10s. `expo-device` is an **optional** peer dep (guarded `require` in try/catch → Metro treats it as optional; without it, behaves as a physical device).
2. **Physical device** — polls `getAPNSToken` with backoff (300→2000ms) until the token appears or a 10s timeout. Memoized once per session via `apnsReadyPromise`.

### Premium User Detection

**Unificado (2026-07-11)** — fonte única: `PremiumUtils.getIsPremiumStatus()` (exportado no index). Regra:

- **`__DEV__`**: lê o toggle local `@isPremium` (AsyncStorage, flipável no dev menu).
- **Produção**: consulta **SEMPRE o RevenueCat** (o storage NÃO é lido em produção; cache offline é o do próprio SDK do RC). Premium = entitlement ativo **sem** `unsubscribeDetectedAt` e **sem** `billingIssueDetectedAt` — assinatura/trial com `willRenew`, ou `willRenew: false` por ser vitalício (sem `expirationDate`), PREPAID ou `store: PROMOTIONAL` (`isPremiumEntitlement`; mesmo veredito do `rc_status = active`). Os SDKs do RC zeram `willRenew` nesses 5 casos (iOS `EntitlementInfo.willRenewWithExpirationDate`, Android `EntitlementInfoHelper.getWillRenew`, lidos no fonte em 07/10/2026) — exigir `willRenew` tirava o Premium de quem comprou o vitalício. Override `is_opted_out_trial_enabled` do Remote Config → basta assinatura ativa (mesmo cancelada) **ou** qualquer entitlement ativo: `activeSubscriptions` só lista assinaturas, então sem o entitlement o vitalício/promocional ficava sem Premium com a flag ligada (corrigido em 07/10/2026). RC indisponível → não-premium.

Todos os pontos de ad delegam pra essa função: app-open (`appopen-ads.tsx`), interstitial/rewarded (`LoadAdsManager`), banners (`banner-ad`/`safe-banner-ad`) e `PaywallUtils.getIsPremium` (sem `entitlementIds`; com `entitlementIds` mantém o check específico, também sem fallback de storage em produção). `@isPremium` continua sendo **escrito** nas compras (`setPremiumStatus`) — só a leitura em produção mudou. O gate de "RC funciona de verdade" é `isRevenueCatActive()` (Utils): exige `isConfigured()` **e** um `getCustomerInfo()` real bem-sucedido — `isConfigured()` sozinho retorna true até com key inválida (401 silencioso). Memoiza sucesso; falha permite retry na próxima chamada.

O Remote Config `is_ads_enabled` continua sendo um kill-switch separado respeitado por todos os formatos.

### Promotional content analytics

`modal-promotional-content.tsx` reporta tudo no Firebase Analytics via `logPromoEvent` (best-effort: try/catch + `.catch`, fire-and-forget — nunca quebra/atrasa o promo):

- **Eventos**: `promo_impression` (a cada exibição; no `PromotionalBanner` só depois do check de "não mostrar", pra não contar flash de 1 frame), `promo_click` (qualquer tap que abre a loja), `promo_close` (fechamento explícito), `promo_dont_show_again`, `promo_expand` (notification compacta → expandida).
- **Params comuns**: `promo_variant` (`bottom_sheet` | `card_banner` | `fullscreen` | `notification` | `banner_small` | `banner_large`), `promo_type` (type cru da config), `promo_name`, `promo_store_url`, `promo_media` (`video`|`image`|`gradient`). Específicos: `click_source` (`cta`|`media`|`card`|`icon`), `close_method` (`close`|`overlay`|`button`|`swipe`|`back`), `notification_compact`, `close_delay_ms` (fullscreen).
- `promo_close` NÃO é emitido quando o fechamento veio de download/dont-show (esses já têm evento próprio — sem duplo-conto no funil). Handlers usados direto em `onPress` recebem o `GestureResponderEvent` como 1º arg — por isso `handleBaixar`/`handlePress` só aceitam `source` string explícita (senão caem no default).

### iOS App Store Review Detection

`Utils.openReviewURL()` automatically:

- Detects iOS App ID via iTunes API lookup using bundle ID
- Falls back to `remoteConfigs.ios_app_id` if lookup fails
- Uses `Application.applicationId` for Android package name
- Supports both native store and browser URLs

### Language/Localization System

The CLI creates `languages/` folder with JSON files per locale that override app.json values (app name, etc.) for each language. This integrates with Expo's built-in localization system.

### Runtime Debugging Gotchas

Hard-won lessons from debugging consumer apps — they affect anyone integrating with the lib's boot:

- **`prepare()` resets/overwrites the ad globals** (`global.isAdsEnabled = !__DEV__` at the start; `setupGlobalConfigs` replaces the whole `global.remoteConfigUtils` object). App-side code that flips ad flags concurrently with boot gets clobbered — such logic is only reliable AFTER `prepare()` (inside the lib's boot, or in a child of `ExpoUtilsLayout`, which mounts children only when `appIsReady` is true).
- **`banner-ad.tsx` snapshots `global.isAdsEnabled` once, on mount**, and never reacts to later changes. Interstitial/app-open ads re-check per load/show (`LoadAdsManager.ts`), banners don't — anything that disables ads at runtime must land before banners mount.
- **`initHotUpdater` is a no-op in `__DEV__`**: dev bundles come from Metro, but a previously downloaded OTA bundle (`Documents/bundle-store/...`) loads on cold launch instead of the embedded bundle — and its `isolation_key` (`hotupdater_<version>_<channel>_`) doesn't change when you rebuild the SAME version, so a stale OTA silently "eats" freshly rebuilt code ("my fix didn't work"). Deleting the bundle only helps until the next download; re-deploy the OTA or bump the version.
- **`JSON.stringify(error)` of an `Error` is always `"{}"`** (non-enumerable props) — use `String(error)` in debug catches.
- **React StrictMode (dev) runs mount effects twice** — boot callbacks fire twice in dev unless guarded (module-level `bootDone` pattern in `Utils.handleReady`; ref guard for `onReady` in `ExpoUtilsLayout`; `preparePromise` no `prepare()`; `listenerRegistered` no `setupAppOpenListener`).
- **iOS drops overlapping `alert()`s silently** (RN doesn't queue `UIAlertController`) — two back-to-back alerts show only the first, which reads as "code stopped in the middle". Use o `queueAlert(title, message)` do Utils (serializa; o push em foreground já usa) ou encadeie via callback do botão.
- **Expo dev lazy bundling**: grepping Metro's `entry.bundle` for app code is a false negative — app modules aren't in the initial bundle.
- **`PanResponder` dentro de `Modal` só recebe o arrastar se pegar o toque no INÍCIO**: o `Modal` do RN responde `true`
  no `onStartShouldSetResponder`; o toque que ninguém dentro dele pega vira dele, e daí o RN só pergunta aos ancestrais
  do Modal no movimento (`onMoveShouldSetPanResponder` da folha nunca roda). Só que no Android o responder JS segura o
  toque dos filhos: pegando no início num ancestral de ScrollView, a rolagem morre. Receita em `utils/retention-modal.tsx`
  (pega no início só com o conteúdo cabendo). Duas folhas do promo (`modal-promotional-content.tsx`, as com
  `onStartShouldSetPanResponder: () => false`) têm o mesmo padrão — não testado lá.
- **Android pausa os timers do JS com dialogo do sistema na frente** (permissao, UMP, compra): `setTimeout` so dispara quando a Activity volta. Chamada nativa e `fetch` seguem funcionando. Nada que precise sair DURANTE um prompt pode depender de timer/debounce.
- **`<Image>` com `require()` herda o tamanho INTRINSECO do arquivo como estilo padrao.** So `flex: 1` nao sobrescreve a largura: a imagem padrao do review (1024x572) renderizava com 1024dp num card de ~360dp e o `cover` virava um recorte gigante do "4.7" (bug da 1.3.1, publicado). Imagem que deve preencher um host leva `width: "100%", height: "100%"` explicitos.
- **Nunca mate o Metro por porta** (`lsof -ti tcp:8082 | xargs kill`): o `netsimd` do emulador Android tambem segura conexao nessa porta (e por ele que o app fala com o Metro) e, morto, derruba o emulador ~20s depois. Mate pelo processo: `pkill -f "expo start --dev-client --port 8082"`.
- **Emulador restaurado de snapshot fica com a conexao do FCM morta**: push de teste nao chega ate reconectar. Forcar: `adb shell cmd connectivity airplane-mode enable` / `disable`.
- **`__DEV__` nao existe fora do runtime do RN** (headless, `bun test`): em modulo novo use `typeof __DEV__ !== "undefined" && __DEV__`.
- **`expoUtilsWarn` emite telemetria**: além do `console.warn` (suprimível com `disableWarnings`), cada mensagem única vira 1 evento `expo_utils_warn` no Firebase Analytics (param `message`, 100 chars; dedup por sessão, cap 50; roda MESMO com `disableWarnings` — é a visibilidade de produção). Best-effort: nunca lança nem recursa.
- **Promo × ATT**: `usePromotional.show()` espera `waitAttFlowDone()` (resolvido pelo `requestTrackingWhenActive` após o prompt do ATT, com fallback de 15s) antes de agendar o modal — a `Modal` do RN não disputa a janela do prompt do sistema. O gate só arma quando `prepare()` roda; `usePromotional` standalone não espera nada.
- **Todo o hardening de runtime de 2026-07-11** (21 itens: guards de RevenueCat não-configurado, ads que nunca penduram, banners sem crash de unitId, etc.) está documentado com tabela completa em `docs/auditoria-runtime-2026-07-11.md`.

## Testing Strategy

### Logica pura e tipos (sem aparelho)

- `./tests/run.sh` — testes (`bun test`) da logica que nao depende de UI: analytics, atribuicao (ordem das
  fases, timeout de etapa pendurada, janela de envios), geo (parsers com o formato REAL de cada provedor,
  cadeia de fallback, cache, chaves de desligar) e push. Cada arquivo roda em **processo proprio**: o
  `mock.module` do bun e global e vaza entre arquivos, e os modulos guardam estado de sessao. Os mocks dos
  modulos nativos ficam em `tests/helpers/rn-mocks.ts`. `tests/` nao entra no pacote npm. Tambem: premium
  (`premium.test.ts`, fixtures do RC em `tests/helpers/rc-fixtures.ts`, compartilhadas com `rc-status.test.ts`),
  link-in-bio, referrer 1x por install, a retencao (`retention-*.test.ts`; a loja do RevenueCat mockada em
  `tests/helpers/rc-store-mock.ts`, com o filtro de base plan do SDK Android) e o catalogo de mediacao (`mediation-catalog.test.ts`, com o
  `@expo/config-plugins` mockado — o repo nao tem node_modules). `scripts/check-mediation-poms.js` precisa de rede
  e NAO roda no `run.sh`.
- Typecheck: o Metro NAO checa tipos e o pacote distribui `.ts`/`.tsx` — rode `tsc` contra os `node_modules`
  de apps host reais, de preferencia com versoes diferentes do RNFB (24, 25 e 26 tipam `logEvent` diferente).
  Receita sem tocar no app host: pasta temporaria com `node_modules` → symlink pro `node_modules` do host,
  `expo-utils` → symlink pro repo, e um `tsconfig.json` com `extends: "expo/tsconfig.base"`,
  `preserveSymlinks: true` e `include` apontando pra `expo-utils/index.ts` + `expo-utils/utils/**`.

### App de teste dedicado (caso real): `~/Documents/projetos/expo-utils-lab`

Projeto Expo 57 criado SO para testar a lib num caso real — **nunca adapte um app de producao para isso**. Tem
Firebase real (projeto `local-desenv`, pacote `com.pixellogic.expoutilslab`: DebugView e envio de push de teste pelo
console) e RevenueCat real (projeto "ExpoUtils Lab", loja de teste `test_…`, offering `default` com 3 produtos — a
Test Store simula compra valida/falha/cancelamento sem cobranca). `src/app/index.tsx` tem um bloco por feature (review
nos 4 estilos com imagem padrao/custom, retencao do trial cancelado nas 2 variantes e 12 linguas, "Retenção — casos"
(um botao por caso do plano de ofertas; deep link `expoutilslab://retencao?case=<id>&locale=pt`), "Retenção — compra de
verdade (loja de teste)" (`showRetention` com os produtos `monthly`/`yearly`/`lifetime` da Test Store; botoes `live-<id>`,
deep link `expoutilslab://retencao?live=<id>`, `live=novo_cliente` faz `Purchases.logIn("lab-…")` para zerar depois de
comprar; cenarios em `src/constants/retention-live.ts`; log `[lab] retention-live …`; `expoutilslab://rc-produtos` loga
ofertas e cliente), cross-promo, geo, token FCM, atributo custom) e `src/app/paywall.tsx` exercita
o funil. Roteiro: `npm pack` → extrair o `.tgz` por cima de `node_modules/expo-utils` (conferir com grep) → `find
node_modules/expo-utils -type f -exec touch {} +` (o `npm pack` grava mtime de 1985 em tudo e o Metro reaproveita a
transformação velha do arquivo: em 10/10/2026 o `retention-events.ts` novo rodou velho até o touch + `--clear`) →
`expo start --dev-client --port 8082 --clear` → abrir com `exp+expo-utils-lab://expo-development-client/?url=…` → conferir o
customer no RevenueCat e os eventos no DebugView. Mudou modulo nativo: `expo prebuild` + `./gradlew :app:assembleDebug`.

### App de teste do zero

Since this is a library:

1. Create a test Expo project: `bunx create-expo-app test-project --template default@sdk-57`
2. Build .tgz: `cd /path/to/expo-utils && npm pack`
3. Install in test project: `cd test-project && bun add ../expo-utils/expo-utils-X.X.X.tgz`
4. Run CLI: `bunx expo-utils-install --new`
5. Build iOS: `npx expo run:ios`
6. Verify: Strings.ts, CLAUDE.md, app.json (no updates block, has buildCacheProvider), .gitignore/.easignore (has bun.lock)


nunca use Co-Authored-By: