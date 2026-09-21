# Plano 1.4.0 — atribuição do RevenueCat que chega de verdade + analytics de funil

> Criado em 2026-09-20. **Status: IMPLEMENTADO na 1.4.0 (mesmo dia), a pedido do usuário ("faça tudo",
> geo ligada por padrão e gratuita, + push recebida/aberta). Ver "§0 O que foi entregue" abaixo.**
> Regra desta entrega: nada é "pronto" sem o dado visto **no destino** (customer no dashboard do
> RC / DebugView do GA4) vindo de um build real — ver §7. Leitura de código não conta como prova.
> **Os itens 1–6 do §7 continuam ABERTOS**: exigem um app com key real do RevenueCat e Firebase real.

## 0. O que foi entregue na 1.4.0 (e como foi verificado)

| Item do plano | Estado | Onde |
|---|---|---|
| A1 fase 1 no boot · A2 fase 2 destacada pós-ATT · A3 timeout por etapa · A5 envio forçado · A6 `rc_attribution` + watchdog + log do appUserID | feito | `utils/attribution.ts`, `utils/Utils.ts` |
| A4 push token correto (APNS no iOS) | feito — FCM do iOS foi para a chave **custom** `fcm_token` (não `$fcmTokens`): aceitação de chave reservada vinda de iOS não pôde ser verificada, e uma rejeição no lote não vale o risco | `utils/attribution.ts` |
| §4 atributos de contexto + `store_country` | feito | `getContextAttributes` |
| §4 geo por IP | feito, **ligada por padrão** (decisão do usuário), cadeia gratuita ipwho.is → BigDataCloud → GeoJS, cache 7d, `geo_lookup_enabled` / `geoAttributes` / `geo_lookup_url` | `utils/geo.ts` |
| B0 `logUtilsEvent` (zerou os 8 erros de TS com RNFB 26) · B1 paywall · B2 review · B3 cross-promo · B4 `consent_flow` · B5 `rc_status`/`att_status`/`setUserId` · B6 catálogo | feito | `utils/analytics.ts`, `PaywallUtils.ts`, `ask-for-review.tsx`, `cross-promo-card.tsx`, `docs/ANALYTICS-EVENTS.md` |
| Push recebida + **aberta** (pedido extra) | feito | `utils/push-analytics.ts` |
| C1 link-in-bio → `$mediaSource`/`$campaign` + `install_attribution` | feito | `Utils.initLinkInBioTracking` |
| C2 Apple Search Ads | código pronto (token do AdServices sai na fase 1); **falta ligar a integração no dashboard do RC** (manual) | — |
| C3 Play Install Referrer | **feito em 21/09** — eu tinha deixado de fora alegando que exigia módulo nativo novo; estava errado: `expo-application` já tem `getInstallReferrerAsync()`. Verificado no destino: Media Source = `Organic` no customer Android (sideload). Referrer de campanha só dá pra testar com o app na Play | `utils/install-referrer.ts` |

**Mudança de desenho descoberta medindo (não estava no plano):** o envio com debounce de 2s (A5) ficava
congelado no Android enquanto o diálogo de permissão de push estava na tela — o Android suspende os timers
do JS com a Activity pausada. Medido no emulador: fase 2 reportou aos **150 s** (só depois de responder o
diálogo). Trocado por envio **imediato** ao fim de cada fase: fase 1 em **1,6 s** e fase 2 em **6,6 s** com o
diálogo ainda na frente. O debounce ficou só para sets avulsos/tardios. O teto de envios virou janela
deslizante (4 por 60 s) em que o excedente **espera**, em vez de ser descartado.

**Verificado:** `tsc` contra 3 apps host reais (RNFB 24.1.1 / 25.1.0 / 26.4.0): 0 erros (antes: 0/0/8);
24 testes (`./tests/run.sh`); os 3 provedores de geo testados AO VIVO pelo próprio módulo; boot completo num
emulador Android (dev client do `/tmp/rtdemo/demo`, clonado — o original não foi tocado) sem crash, com
`rc_attribution` fases 1 e 2, `consent_flow`, geo ok e watchdog calado.
**NÃO verificado (precisa de você):** atributo aparecendo no customer do RevenueCat (o emulador usou key
falsa → `synced:0`, "credentials issue" — o que prova que a chamada chega ao backend, não que é aceita);
eventos no DebugView do GA4 (Firebase placeholder no demo); qualquer coisa em iOS; `push_opened` em aparelho.

## 1. Por que este plano existe

Em 20/09/2026 o usuário mostrou um assinante ativo do `eyeidentifier` (3 renovações semanais) com
**todos** os atributos vazios no RevenueCat, depois de a atribuição ter sido dada como "ok" em
02/07 (commit `8385945`). Aquela verificação foi só de código (try/catch isolado = "não quebra");
ninguém olhou um customer no RC. Este plano conserta o caminho por onde os atributos passam, dá
visibilidade em produção e aproveita o mesmo caminho para os atributos que o usuário pediu
(**região, língua, país, estado, cidade**) e para o analytics de funil que hoje não existe.

## 2. Fatos verificados (não re-derivar — foram lidos no fonte)

Fontes: iOS `expo-urna-v2/ios/Pods/RevenueCat/Sources/` (5.88.0) e `expo-resultado/...` (5.84.0);
Android bytecode de `~/.gradle/caches/modules-2/files-2.1/com.revenuecat.purchases/purchases/10.21.1`;
RN `expo-urna-v2/node_modules/react-native-purchases` 10.9.1; RNFB analytics 24.1.1.

| # | Fato | Consequência |
|---|---|---|
| F1 | Product id com `:` (`...weekly:weekly` = `assinatura:basePlan`) é formato **Google Play** | O customer do print é **Android**: APNS, ATT Consent, idfa, idfv, Amazon Ad ID vazios por plataforma, não por bug |
| F2 | `setFBAnonymousID` → `setAttributionID` → chama `collectDeviceIdentifiers` sozinho (iOS e Android; `automaticDeviceIdentifierCollectionEnabled` default `true`) | (a) o `if (attGranted)` do `setupAttribution` não protege nada; (b) **IP / GPS Ad ID vazios provam que a cadeia inteira não rodou-e-sincronizou** — não é "usuário negou ATT" |
| F3 | RC iOS ≥5.84 grava `$attConsentStatus` sozinho em todo sync e em todo post de recibo | Em iOS esse campo não depende do expo-utils |
| F4 | O SDK só **envia** atributos em: post de recibo (compra/restore), app indo pra background/foreground, login/logout | Atributo setado depois da compra só sai no próximo background — se a cadeia ainda não terminou, não sai nada |
| F5 | `Purchases.syncAttributesAndOfferingsIfNeeded()` existe no RN purchases 10.9.1; rate limit **5 chamadas / 60s** (`RateLimiter(maxCalls: 5, period: 60)`) | Dá pra forçar o envio; o expo-utils não chama em lugar nenhum |
| F6 | iOS: `setPushToken` grava em `$apnsTokens` (`ReservedSubscriberAttributes.swift`); o expo-utils passa `getToken()` = token **FCM** | Campo APNS do iOS fica com valor errado |
| F7 | O SDK só regrava atributo se o valor mudou (`storeAttributeLocallyIfNeeded`) | Setar os mesmos atributos a cada sessão não custa rede |
| F8 | `Purchases.getStorefront()` existe (10.9.1) → `{countryCode}` | País da conta da loja sem rede nossa e sem permissão |
| F9 | `setUserId` / `setUserProperty` / `setUserProperties` existem no RNFB analytics modular 24.1.1; **a lib não usa nenhum** | Hoje nada liga GA4 → RC (o inverso, `$firebaseAppInstanceId`, existe mas não chega) |
| F10 | `PaywallUtils.ts`, `PremiumUtils.ts`, `ask-for-review.tsx`, `cross-promo-card.tsx` têm **zero** eventos de analytics | Funil de paywall, de review (inclusive o `review_style` da 1.3.1) e o cross-promo obrigatório são invisíveis |
| F11 | `TrendingsTracker.trackInstall()` devolve `{matched, campaign_id}`; `initLinkInBioTracking` **descarta** a resposta | A origem do install (link-in-bio) já é conhecida e não vai pro RC |
| F12 | README (seção Mediation) diz `Utils.prepare()` → `requestTrackingWhenActive()`; no código quem dispara é `Utils.handleReady` (`<View onLayout>` do `ExpoUtilsLayout`/template) | App com layout legado nunca roda ATT/push/FB/TikTok/atribuição — e nada avisa |

**Causa estrutural (F4 + ordem da fila).** `setupAttribution` é o último passo de uma fila serial:
`handleReady` (3s + 2s) → UMP (form p/ UK/EEA, até 20s) → ATT → prompt de push → FB → TikTok (até 10s)
→ link-in-bio → update dialog → atribuição (5 awaits em série; APNS até 10s). Push, FB, TikTok e os
getters não têm timeout. Quem compra no 1º minuto e não volta (paywall de onboarding — exatamente o
customer do print: aberto 07:53, comprou 07:54, nunca mais abriu) posta o recibo antes de existir atributo.

**Não determinado** (o app não está nesta máquina): se no `eyeidentifier` a fila é lenta, pendura ou
nunca é chamada (F12). Decide em 2 min: abrir 5 customers Android recentes do app no RC — nenhum com
IP ⇒ a fila nunca roda naquele build; alguns com IP ⇒ timing. E no GA4: evento `expo_utils_warn`
com `message` contendo `setupAttribution`.

## 3. Fase A — pipeline de atribuição (P0)

Arquivo novo `utils/attribution.ts` (o `Utils.ts` já passa de 1300 linhas); `Utils.setupAttribution`
continua existindo como entrada pública da fase 2 (compatibilidade). Imports no topo (regra do AGENTS.md).

**A1. Fase 1 — sem consentimento, sem prompt, sem timer.** Dispara no bloco não-bloqueante do
`runPrepare`, logo após `setupRevenueCat` (não atrasa o splash). Conteúdo:
`enableAdServicesAttributionTokenCollection()` (Apple dispensa ATT; token vale 24h — cedo importa),
`setFirebaseAppInstanceID`, atributos de contexto sem rede (§4) e `getStorefront`. Objetivo: o
**primeiro recibo já sai com atributos**, mesmo de quem compra em 20s.

**A2. Fase 2 — logo após o ATT, fora da fila.** Nova ordem do `requestTrackingWhenActive`:
UMP → ATT → `settleAttFlow()` → `initFBSDK` (rápido) → **fase 2 em fire-and-forget** → push → TikTok →
link-in-bio → update dialog. Conteúdo da fase 2: `collectDeviceIdentifiers()` **sempre** (F2: já
acontecia de qualquer jeito; sem ATT o iOS zera o IDFA), `setFBAnonymousID`, push token (A4), geo (§4).
O atributo do TikTok muda para o fim do `initTikTokSDK`; o match do link-in-bio (C1) para o fim do
`initLinkInBioTracking` — cada um onde o SDK dono já está inicializado.

**A3. Timeout em todo getter de terceiro.** Helper `withTimeout(promise, ms, etapa)` (3s por getter;
o portão de APNS segue com os 10s memoizados). try/catch não pega promise nativa que nunca resolve —
o próprio código já admite isso no comentário do `checkForRequiredUpdateDialog`.

**A4. Push token correto.** iOS: `Purchases.setPushToken(await getAPNSToken(messaging))` (hex) e o
FCM em `setAttributes({"$fcmTokens": fcm})` — *conferir no dashboard se o backend aceita `$fcmTokens`
vindo de iOS; se não aceitar, usar a chave custom `fcm_token`*. Android: segue `setPushToken(fcm)`.

**A5. Envio forçado.** `scheduleRcSync()`: debounce de 2s que junta os sets e chama
`syncAttributesAndOfferingsIfNeeded()`; teto de 3 por sessão (limite do SDK: 5/min — F5). Chamado ao
fim da fase 1, da fase 2 e dos sets tardios (TikTok / link-in-bio).

**A6. Visibilidade.**
- Evento `rc_attribution`, 1× por sessão, quando a fase 2 termina **ou** aos 45s (o que vier antes):
  `steps_ok` e `steps_fail` (ids curtos: `adsvc,fid,ctx,store,ids,fb,push,geo,tt,lib`), `p1_ms`, `p2_ms`
  (ms desde o início do JS; `-1` = nunca rodou), `synced` (0/1), `att`, `rc_active` (0/1).
  `p2_ms = -1` é o número que denuncia layout legado (F12) em produção.
- Watchdog: 30s depois do `prepare()` com `bootDone === false` →
  `expoUtilsWarn("handleReady nunca foi chamado — ATT/push/atribuição não rodam (layout sem ExpoUtilsLayout?)")`
  (vira `expo_utils_warn` no GA4).
- Em `__DEV__`: `expoUtilsLog("RC appUserID:", id)` — é como se acha o customer de teste no dashboard.

## 4. Atributos de contexto no RC — região, língua, país, estado, cidade

**No GA4 isso já vem de graça**: o Firebase Analytics deriva país/região(estado)/cidade do IP e coleta
idioma, versão do app, modelo e SO em todo evento (relatórios, audiências e `geo.*` / `device.language`
no BigQuery). O que falta é o lado do **RevenueCat** (página do customer, exports, webhooks, Targeting).

| Atributo (chave custom) | Exemplo | Fonte | Rede? | Default |
|---|---|---|---|---|
| `language` | `pt` | `getLocales()[0].languageCode` | não | ligado |
| `locale` | `pt-BR` | `getLocales()[0].languageTag` | não | ligado |
| `device_region` | `BR` | `getLocales()[0].regionCode` (região **configurada** no aparelho) | não | ligado |
| `timezone` | `America/Sao_Paulo` | `getCalendars()[0].timeZone` | não | ligado |
| `currency` | `BRL` | `getLocales()[0].currencyCode` | não | ligado |
| `store_country` | `GB` / `GBR` | `Purchases.getStorefront()` — país da **conta da loja** (define preço/moeda). Apple devolve alpha-3, Play alpha-2: gravar cru e documentar | não | ligado |
| `geo_country` | `GB` | endpoint de geo por IP (onde a pessoa **está**) | sim | **opt-in** |
| `geo_state` / `geo_state_code` | `England` / `ENG` | idem | sim | **opt-in** |
| `geo_city` | `London` | idem | sim | **opt-in** |
| `app_version`, `build_number`, `expo_utils_version`, `os_version`, `device_model`, `install_date` | — | `expo-application` / `expo-device` (opcional) / flag no AsyncStorage | não | ligado |

Os três "país" respondem perguntas diferentes (conta da loja × configuração do aparelho × localização
real); por isso os três existem. Limites do RC para chave custom (conferir na doc antes de fechar os
nomes): chave ≤ 40 chars sem `$`, valor ≤ 500 chars, 50 atributos custom por customer.

**Estado e cidade só existem via IP** (GPS exigiria permissão de localização — fora de cogitação só
para analytics). Desenho:
- Remote Config `utils.geo_lookup_url` (string). **Sem a key, a lib não faz a chamada** — é o opt-in
  por app e o kill-switch, sem build novo. Entra em `RemoteConfigUtilsType`.
- Contrato da resposta: `{country, region, regionCode, city, timezone}`. Timeout 3s, cache de 7 dias
  em `@expo_utils_geo`, nunca bloqueia nem lança. Roda na fase 2 (depois do fluxo de consentimento).
- Endpoint recomendado: **Cloudflare Worker próprio** — `request.cf` já traz tudo, sem chave, sem
  terceiro, 100k req/dia no plano grátis. Código inteiro:

  ```js
  export default {
      fetch(request) {
          const {country, region, regionCode, city, timezone} = request.cf || {};
          return Response.json({country, region, regionCode, city, timezone}, {headers: {"cache-control": "no-store"}});
      },
  };
  ```

  Alternativas: devolver a geo na resposta do `install.php` do TrendingsTracker (já recebe o IP e faz
  match por IP — mas aí depende de GeoLite2 no PHP); API pública grátis **não** (mesma lição do
  `PLAY_READERS`/proxy CORS do AGENTS.md: instável, e a maioria proíbe uso comercial no plano grátis).
- Precisão realista de geo por IP: país ~99%, estado ~80–90%, cidade 50–80% (operadora móvel costuma
  cair na cidade do hub). Serve para agregados, não para afirmar onde UM usuário está.
- **Privacidade (motivo do opt-in):** cidade/estado derivados de IP e gravados contra o ID do
  customer entram como "Coarse Location" no rótulo de privacidade da App Store e "Approximate
  location" no Data Safety do Play. App que ligar `geo_lookup_url` precisa declarar — documentar isso
  no README e no playbook de upgrade. Os atributos sem rede não mudam o rótulo de nenhum app.

## 5. Fase B — analytics de funil (P1)

**B0. `utils/analytics.ts` — `logUtilsEvent(name, params)`.** Best-effort único (try/catch +
`Promise.resolve(logEvent(...)).catch`, padrão que o `ad-revenue.ts` já usa), saneia params (remove
`undefined`, corta string em 100 chars). Migrar os `logEvent(...).catch()` do `Utils.ts` para ele
**zera os 6 erros de TS pendentes** (tipagem `void` do RNFB novo).

**B1. Funil do paywall** (`PaywallUtils` / `usePaywall` / `PaywallController` — hoje 0 eventos):
`paywall_view`, `paywall_close` (`duration_ms`, `purchased`), `paywall_purchase_start`,
`paywall_purchase_success`, `paywall_purchase_cancel`, `paywall_purchase_error` (`code`),
`paywall_restore` (`result`). Params comuns: `placement` (novo campo opcional em `PaywallOptions`;
default = rota atual do `AdPlacementTracker`), `offering`, `product_id`. **Não** usar o nome `purchase`
nem os params `value`+`currency` — o GA4 trataria como receita e duplicaria o `in_app_purchase`
automático; preço vai em `price` + `price_currency`.

**B2. Funil do review** (`ask-for-review.tsx` — 1000 linhas, 0 eventos): exibição, ação
(positivo/negativo/depois/fechar), abertura da loja, tutorial exibido/concluído — todos com `style`
(o `review_style` do Remote Config). Sem isso **não há como saber qual dos 4 estilos da 1.3.1 converte
mais** (nem usar o A/B Testing do Firebase, que precisa de evento-meta). Mapear os handlers reais antes
de fechar os nomes.

**B3. Cross-promo card** (obrigatório em todo app, 0 eventos): reusar `promo_impression` /
`promo_click` do `logPromoEvent` com `promo_variant: "cross_promo_card"` — mesmo funil e mesmas
dimensões custom do promo modal.

**B4. `consent_flow`**, 1× por instalação (e quando mudar): `ump`
(`obtained|not_required|denied|timeout|skipped`), `att`, `push`, `ms`. Taxa de opt-in de ATT por país
e versão mexe direto no eCPM.

**B5. Identidade e segmentação no GA4.**
- `setUserId(analytics, rcAppUserId)` — é o que a própria integração RC→Firebase recomenda. **Não**
  usar user property para o ID: valor de user property tem teto de **36 chars** e
  `$RCAnonymousID:<32 hex>` tem 47 (`com.appid.eyeidentifier.weekly:weekly` tem 37 — também estoura).
- User properties `rc_status` (reusa `Utils.getRevenueCatStatus`: free / trial / intro / active /
  cancelled / billing_issue / expired / refunded) e `att_status`; atualizar no boot e no
  `customerInfoUpdateListener` que já existe. Com isso **todo** evento (`ad_revenue`, promo, review,
  retenção) passa a poder ser quebrado por assinante × free. Teto do GA4: 25 user properties por
  propriedade, nome ≤ 24 chars — ficar em poucas.
- Fora da lib (dashboard): ligar a integração **RevenueCat → Firebase** em cada app. Ela manda
  `rc_initial_purchase`, `rc_renewal`, `rc_cancellation`… server-side — inclusive renovação com o app
  fechado (as 3 do customer do print). Só funciona com `$firebaseAppInstanceId` chegando no RC, que é
  exatamente o que a Fase A conserta.

**B6. `docs/ANALYTICS-EVENTS.md`** — catálogo de todos os eventos/params da lib + a lista do que
registrar como dimensão custom no GA4 (param não registrado só aparece no DebugView/BigQuery; limites:
50 dimensões de evento + 25 de usuário por propriedade). É o que torna o "report" utilizável.

## 6. Fase C — origem do install sem MMP (P2, opcional)

Media Source / Campaign / Ad Group / Ad só enchem com MMP **ou** com `setMediaSource`/`setCampaign`/…
manuais. Fontes próprias que já existem ou são baratas:
- **C1. Link-in-bio** (F11): `matched === true` → `setMediaSource("link_in_bio")` + `setCampaign(campaign_id)`.
- **C2. Apple Search Ads**: o token do AdServices já é coletado; com a fase 1 ele vai cedo. Falta ligar
  a integração de Apple Search Ads no dashboard do RC (sem código).
- **C3. Android Play Install Referrer** → `utm_source`/`utm_campaign` → `$mediaSource`/`$campaign`.
  Exige peer dep nova (opcional) — avaliar custo/benefício antes.
Installs de Meta/TikTok não têm atribuição determinística sem MMP/SKAN — fora do escopo.

## 7. Critérios de aceite — medidos no destino

1. Android físico, install limpo, **sem comprar**: ≤ 60s depois de abrir, o customer no RC mostra
   `$firebaseAppInstanceId`, `language`, `locale`, `device_region`, `timezone`, `store_country`,
   `app_version`; depois do fluxo de consentimento: `$ip`, `$gpsAdId`, `$fbAnonId`, `$fcmTokens`.
2. Compra sandbox ≤ 20s depois de abrir: os atributos da fase 1 já estão no customer logo após a compra.
3. iOS com ATT **negado**: `$idfv`, `$ip`, `$attConsentStatus = denied`; `$apnsTokens` = hex de 64
   chars (token FCM tem `:` e ~160 chars — é assim que se vê o bug F6 corrigido).
4. App com layout legado (sem `handleReady`): `expo_utils_warn` do watchdog + `rc_attribution` com `p2_ms = -1`.
5. GA4 DebugView: `rc_attribution` com os `steps_ok` esperados, `user_id` setado, `rc_status` presente.
6. Com `geo_lookup_url` setado: `geo_country` / `geo_state` / `geo_city` no customer; sem a key:
   nenhuma chamada de rede de geo (conferir no proxy/DebugView).
7. `tsc` num app host de verdade: 0 erros novos e os 6 antigos do `Utils.ts` zerados.
8. Verificação scriptável: `GET https://api.revenuecat.com/v1/subscribers/<id>` com a secret key
   devolve `subscriber_attributes` — dá pra automatizar os itens 1–3 e 6.

## 8. Docs a atualizar na MESMA tarefa (regras do AGENTS.md)

- `docs/UPGRADE-EXPO57-EXPO-UTILS.md`: contrato de boot (fase 1 no `prepare`, nova ordem do
  `requestTrackingWhenActive`, watchdog do `handleReady`), key nova `geo_lookup_url`, exports novos.
- `utils/types.ts` (`RemoteConfigUtilsType.geo_lookup_url`) + `index.ts` **e** `index.d.ts` em sync.
- `README.md`: corrigir o `Utils.prepare()` → `requestTrackingWhenActive()` da seção Mediation (F12);
  seção nova de atribuição/atributos/analytics + nota do rótulo de privacidade da geo.
- `AGENTS.md`/`CLAUDE.md`: "Utils Module", "Runtime Debugging Gotchas" (F2, F4, F6) e a regra
  "integração externa só é ok medida no destino".
- `.claude/CHATHISTORY.MD`: registrar a entrega.

## 9. Decisões em aberto (do usuário)

1. **Endpoint de geo**: Worker próprio (recomendado) × estender o `install.php` × API de terceiro.
2. **Cidade/estado opt-in por Remote Config** (recomendado) × ligado por padrão (muda o rótulo de
   privacidade de todos os apps).
3. **`setUserId` com o ID do RC** (recomendado) × só user property `rc_id` sem o prefixo (32 chars).
4. Ligar a integração RC → Firebase e a de Apple Search Ads no dashboard, app por app (manual).

## 10. Ordem sugerida de entrega

- **1.4.0** — Fase A inteira + atributos de contexto (§4; a parte de geo embarca dormente até a key
  existir) + B0 + B5 + docs (§8). É o que destrava todo o resto.
- **1.4.1** — B2 (review) + B3 (cross-promo) + B6 (catálogo).
- **1.5.0** — B1 (paywall) + B4 (consent) + Fase C.

Atenção operacional: o token de publish do npm gravado em `~/.npmrc` vence em 20/09/2026 23:40
(Brasília) — publicar a 1.4.0 exige token novo.
