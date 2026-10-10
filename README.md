# expo-utils

`expo-utils` é uma ferramenta CLI completa e biblioteca de utilitários para acelerar o desenvolvimento de projetos Expo/React Native. Com um único comando, você configura todo o ambiente de desenvolvimento, incluindo Firebase, AdMob, Facebook SDK, RevenueCat e muito mais.

## 🚀 O Que Este Projeto Faz

**Automatiza 90% da configuração inicial** de um projeto React Native, incluindo:

✅ **Configuração Completa**: Firebase, AdMob, Facebook SDK, RevenueCat  
✅ **Sistema de Anúncios**: Intersticiais, recompensados e banners com verificação premium automática  
✅ **Internacionalização**: 12 idiomas suportados com detecção automática  
✅ **Utilitários Prontos**: Push notifications, updates OTA, analytics, crashlytics  
✅ **Tela de Avaliação**: Abertura automática da loja para reviews (iOS/Android)  
✅ **Estrutura do Projeto**: Templates pré-configurados com melhores práticas  
✅ **TypeScript Completo**: Tipagem completa e interfaces bem definidas  
✅ **Compatibilidade Moderna**: Expo SDK 57, Firebase v24+/v25, React Native 0.86+

## 🆕 Novidades da v1.4.0

Versão focada em **atribuição que chega de verdade no RevenueCat** e em **enxergar o funil**.

- **Atribuição em duas fases com envio forçado** — o customer deixava de ter atributos quando o usuário comprava no 1º minuto (a atribuição era o último passo de uma fila atrás de 3 prompts). Agora a fase 1 sai no boot e a fase 2 logo após o ATT, cada etapa com timeout.
- **País, estado e cidade no customer** (geo por IP, gratuita, sem chave, ligada por padrão) + idioma, região do aparelho, país da conta da loja, fuso, versão do app.
- **Push recebida *e aberta*** (`push_opened`), com `push_id` para calcular taxa de abertura por notificação.
- **Funil do paywall, do review e do cross-promo** no Analytics; evento `consent_flow` (UMP/ATT/push); user property `rc_status` para quebrar qualquer evento por free × assinante; `user_id` do GA4 = App User ID do RevenueCat.
- **`rc_attribution`**: a prova, em produção, de que os atributos saíram do aparelho — e um watchdog que denuncia `_layout` legado sem `Utils.handleReady`.
- `logUtilsEvent` — logger único, compatível com a tipagem `void` do RNFB 26 (zera os erros de TS que a lib tinha).

Detalhes em [Atribuição do RevenueCat e analytics](#-atribuição-do-revenuecat-e-analytics-v140) e [Push: recebidas e abertas](#-push-recebidas-e-abertas). Catálogo de eventos: `docs/ANALYTICS-EVENTS.md`.

## 🆕 Novidades da v1.1.0

Versão focada em **confiabilidade**, **`app.json` limpo** e **menos configuração manual**.

### 🎯 SKAdNetwork agora é automático

Os ~160 identificadores de SKAdNetwork **não ficam mais no `app.json`**. O config plugin do expo-utils injeta todos no `Info.plist` **durante o prebuild** — seu `app.json` fica limpo e legível.

- `npx expo-utils-install --skadnetwork` **migra** apps existentes (remove os IDs do `app.json` e mantém qualquer ID customizado seu).
- Lista de IDs **corrigida e deduplicada** → **162 networks** únicas (incl. `com.apple.ads`).

### 🧹 Dev-menu limpo no dev build (v1.1.2)

Em **dev build** (DEBUG), o expo-utils agora esconde automaticamente o overlay de onboarding do dev-menu ("This is the developer menu… Continue") **e** o botão flutuante (FAB), injetando flags no boot nativo durante o **prebuild**. Nada atrapalhando testes/screenshots; **inerte em release**. Ligado por padrão; desligue com `["expo-utils", { "skipDevMenuOnboarding": false }]`.

### 📲 Push (FCM) mais confiável no iOS

Corrigido o erro `No APNS token specified before fetching FCM Token`. O expo-utils agora **espera o APNS token chegar** antes de buscar o token FCM e inscrever em tópicos. Em ambientes sem APNS (ex.: simulador) ele pula com segurança, sem floodar erro.

### 🔐 Prompt de ATT no momento certo

O prompt de **App Tracking Transparency** é exibido **só após o primeiro frame** (app já ativo), evitando que o iOS descarte o prompt silenciosamente. Nenhum dado de tracking é coletado antes do consentimento.

### 🧩 `_layout` mais enxuto (opcional)

Novo `<ExpoUtilsLayout>` encapsula todo o boot (prepare → ATT → overlays) e expõe um callback `onReady` pro seu código pós-boot. O template explícito continua sendo o default, pra quem quer controle total.

### 🔤 Plugins organizados

Novo flag `--sort-plugins` ordena o array `plugins` do `app.json` (plugins simples primeiro, depois os com configuração). Roda **automaticamente** no `--config` e `--new`.

### 📦 Outras melhorias

- **`eas-build-cache-provider`** agora é dependência obrigatória — cache de build EAS pronto de fábrica.
- Vídeo promocional migrado de `expo-av` → **`expo-video`**.
- **Android**: solicita `POST_NOTIFICATIONS` junto com o request de push.
- **Zero `require()` em runtime** (imports estáticos) + tipos globais (`global.remoteConfigUtils`, etc.) vindos do próprio pacote.

> **Target**: Expo SDK 57 / React Native 0.86. `Info.plist` injeta SKAdNetwork, ATT, push e frameworks estáticos via config plugin.

## 📦 Instalação Rápida

### Novo Projeto (Recomendado)

```bash
# 1. Criar projeto Expo (SDK 57)
bunx create-expo-app@latest MeuApp --template default@sdk-57
cd MeuApp

# 2. Instalar expo-utils
bun add github:Pixel-Logic-Apps/expo-utils

# 3. Configurar tudo automaticamente
bunx expo-utils-install --new
```

> **Outros package managers**: O CLI detecta automaticamente o package manager do projeto via lockfile (bun.lock, yarn.lock, pnpm-lock.yaml, package-lock.json). Se nenhum lockfile for encontrado, o default é **bun**. Exemplo com npm:
>
> ```bash
> npx create-expo-app@latest MeuApp --template default@sdk-57 && cd MeuApp
> npm install github:Pixel-Logic-Apps/expo-utils
> npx expo-utils-install --new
> ```

### Configurar Firebase Remote Config

Desde a 1.5.0 a config fica num parâmetro só do Remote Config, **`settings`**, com um valor por plataforma e dois blocos:

```json
{
  "utils":   { "is_ads_enabled": true },
  "screens": { "cross_promo": { "enabled": false } }
}
```

| Bloco | Global no app | O que é |
|---|---|---|
| `utils` | `global.remoteConfigUtils` | o que a lib lê (`RemoteConfigUtilsType`) |
| `screens` | `global.remoteConfigScreens` | o que só o app lê (estrutura livre; `cross_promo` obrigatório) |
| os dois | `global.remoteConfigs` | os dois juntos; em conflito vale o `utils` |

O jeito normal de editar e publicar é o pldev: `.pldev/.firebaserc/rc-config-{ios,android}.json` (`{utils, screens}`) e
`pldev firebase rc push`. O pldev cria o `settings` com a condição `app.version >= V` e, enquanto houver build antigo
nas lojas, publica também os parâmetros `utils` e `screens`. Sem o `settings` no formato de blocos, a lib lê os
parâmetros `utils` e `screens` (o modelo até a 1.4). Plano: [`docs/PLANO-SETTINGS.md`](docs/PLANO-SETTINGS.md).

**Bloco `utils`** — configurações do expo-utils (tipado como `RemoteConfigUtilsType`):

```json
{
  "is_ads_enabled": true,
  "min_version": 0,
  "ios_app_id": "",
  "review_type": "popup",
  "review_type_delay": 0,
  "review_show_delay": 0,
  "review_style": "bottomsheet",
  "repeat_ads_count": 3,
  "ad_blocklist": [],
  "promotional": {
    "enabled": false,
    "type": "bottom-sheet",
    "icon": "",
    "name": "",
    "description": "",
    "buttonText": "",
    "gradientColors": ["#22C55E", "#16A34A"],
    "primaryColor": "#22C55E",
    "storeUrl": ""
  },
  "tiktokads": {
    "token": "",
    "appid": "",
    "tkappid": "",
    "isdebug": false
  },
  "clarity_id": "",
  "trends_tracking_url": "",
}
```

> **Nota:** `rckey` (chave RevenueCat) e `adUnits` (unit IDs do AdMob) **NÃO** ficam no Remote Config. Eles são definidos localmente via `AppStrings` (veja seção [AppStrings e AdUnits](#-appstrings-e-adunits)).

**Bloco `screens`** — configurações de telas do app (tipo `any`, estrutura livre):

```json
{
  "home": {
    "banner_url": "https://...",
    "show_carousel": true
  },
  "onboarding": {
    "enabled": true,
    "steps": 3
  },
  "paywall": {
    "selected_product": "com.appid.eyeidentifier.weekly",
    "close_button_delay": 15000,
    "disclaimer_text": "",
    "primary_button_text": "➡️ %{start_free_trial}",
    "list_of_products": [
      {
        "id": "com.appid.eyeidentifier.weekly",
        "price_string": "${priceString}",
        "period_string": "%{string_week}",
        "price_info": "${priceString}/Week",
        "discount_info": "",
        "discount_percentage": "",
        "most_popular": false
      },
      {
        "id": "com.appid.eyeidentifier.annual",
        "price_string": "${priceString}",
        "period_string": "%{string_year}",
        "price_info": "",
        "discount_info": "79% OFF",
        "discount_percentage": "",
        "most_popular": true
      }
    ],
    "extras": {
      "show_arrow": false
    }
  }
}
```

> O bloco `screens` é opcional. Sua estrutura é livre e acessada via `global.remoteConfigScreens`.

### Paywall headless

O `expo-utils` também expõe um controlador de paywall que automatiza a parte repetitiva: ler `global.remoteConfigScreens.paywall`, carregar produtos do RevenueCat, respeitar ordem/seleção do Remote Config, comprar, restaurar e marcar `@isPremium`. Ele não renderiza UI; cada app continua usando seus próprios cards, imagens, textos e botões.

```tsx
import {router} from "expo-router";
import {usePaywall} from "expo-utils";

export default function PaywallScreen() {
    const paywall = usePaywall({
        t,
        productSource: "auto",
        onPurchaseSuccess: () => router.back(),
        onRestoreSuccess: () => router.back(),
    });

    return (
        <>
            {paywall.items.map((item) => (
                <PlanCard
                    key={item.id}
                    title={item.title}
                    price={item.billedPrice}
                    badge={item.badge}
                    selected={paywall.selectedProductId === item.id}
                    onPress={() => paywall.select(item.id)}
                />
            ))}

            <PrimaryButton
                disabled={!paywall.selectedItem || paywall.loading || paywall.purchasing}
                loading={paywall.purchasing}
                onPress={paywall.purchaseSelected}>
                {paywall.getButtonText()}
            </PrimaryButton>

            <TextButton onPress={paywall.restore}>Restore purchases</TextButton>
        </>
    );
}
```

Para uso sem hook, use `new PaywallController({t})` ou os métodos estáticos de `PaywallUtils`.

**Descrição dos campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `is_ads_enabled` | boolean | Habilita/desabilita anúncios globalmente |
| `min_version` | number | Versão mínima obrigatória (ex: 100 = 1.0.0) |
| `ios_app_id` | string | App ID do iOS (fallback se busca automática falhar) |
| `review_type` | string | Modo de review: `"store-review"`, `"popup"` ou `"dialog"` |
| `review_type_delay` | number | ms até habilitar botão "Agora não" no popup de review (ex: 3000 = 3s) |
| `review_show_delay` | number | ms antes do review **aparecer** (usado por `askForReview` se `showDelay` não for passado) |
| `review_style` | string | layout do popup: `"bottomsheet"` (padrão, card embaixo) \| `"formsheet"` (sheet 100% largura sem raio, metade da tela, X + 1 botão) \| `"centered"` (card no meio, botões empilhados) \| `"fullscreen"` (tela cheia, X + 1 botão no rodapé). Override local: prop `variant` |
| `repeat_ads_count` | number | Quantidade de ações antes de mostrar anúncio |
| `ad_blocklist` | string[] | Lista de placement IDs bloqueados |
| `taichi_events` | string[] | Nomes Taichi habilitados: ausente = todos os 60; `[]` = sem emissões; lista = apenas os nomes indicados. A soma é mantida. |
| `promotional` | object | Configuração de conteúdo promocional (veja seção dedicada) |
| `tiktokads` | object | Configurações do TikTok Ads SDK (`token`, `appid`, `tkappid`, `isdebug`) |
| `clarity_id` | string | Project ID do Microsoft Clarity |
| `trends_tracking_url` | string | URL do Trendings Tracker (fallback: `https://trendings.app/api`) |

### Projeto Existente

```bash
npm install github:Pixel-Logic-Apps/expo-utils
npx expo-utils-install
```

## 🛠️ Comandos CLI Disponíveis

### Comando Principal

```bash
npx expo-utils-install --new
```

**Executa configuração completa para novos projetos** (com confirmação para mudanças destrutivas). No reset do app (atrás do prompt `Y/n`), limpa `assets/images/` por **allowlist** — mantém só `icon.png`, `splash-icon.png` e os `android-icon-{background,foreground,monochrome}.png`, remove o resto (`react-logo*`, `favicon`, `expo-badge*`, `expo-logo`…) e **preserva subpastas** como `tabIcons/`; também apaga a pasta quebrada `assets/expo.icon/`.

### Comandos Individuais

| Comando                   | Descrição                                       |
| ------------------------- | ----------------------------------------------- |
| `npx expo-utils-install`  | Instala apenas dependências faltantes           |
| `--config`                | Adiciona plugins padrão ao app.json (AdMob, Facebook, splash screen, expo-utils) |
| `--firebase-placeholders` | Cria arquivos Firebase placeholder              |
| `--layout`                | Substitui \_layout.tsx por template configurado |
| `--srcapp`                | Move pasta app para src/app                     |
| `--languages`             | Cria pasta languages com traduções + purpose strings de privacidade localizadas (Photo/Camera) por idioma; mescla em arquivos já existentes |
| `--skadnetwork`           | Remove SKAdNetworkItems do app.json (agora injetados no Info.plist pelo config plugin no prebuild; mantém IDs customizados) |
| `--constants`             | Cria pasta constants com Strings.ts template    |
| `--eas-config`            | Configura eas.json, EAS build cache, remove updates block |
| `--tracking-permission`   | Adiciona permissão de rastreamento iOS          |
| `--fix-ios-build`         | Aplica fixes de build iOS (static frameworks); deduplica arrays do `infoPlist` (ex.: `UIBackgroundModes`) |
| `--expo-icon`             | Remove `ios.icon` quebrado (ex.: `./assets/expo.icon` deletado) que derruba o `actool` no prebuild; só com `icon` raiz válido de fallback. Roda também no `--new` |
| `--gitignore`             | Atualiza .gitignore com ios/, android/, bun.lock |
| `--hot-updater`           | Configura Hot Updater (babel, .env, deps)       |
| `--sort-plugins`          | Ordena os plugins do app.json (strings primeiro, depois os com config) |
| `--pin-deps`              | Fixa todas as deps do `package.json` em versão exata (remove `^`/`~`/`>=`, usa a versão instalada). Preserva git/GitHub/`file:`/tarball. Roda também no `--new` |
| `--policy-checks`         | Sincroniza `.claude/POLICY-CHECKS.md` (regras de review que já derrubaram build). Arquivo **gerado**: sobrescreve a cópia local. Se o `AGENTS.md` do app não citar o arquivo, adiciona um ponteiro no fim. Roda também no `--new` |

## 📱 Configuração do Projeto

### 1. Template \_layout.tsx

O `expo-utils` fornece um template completo para `_layout.tsx`:

```typescript
import {SplashScreen, Stack, usePathname} from "expo-router";
import {useEffect, useState} from "react";
import Utils from "expo-utils/utils/Utils";
import {setupAppOpenListener} from "expo-utils/utils/appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "expo-utils/utils/ask-for-review";
import PromotionalContent, {usePromotional} from "expo-utils/utils/modal-promotional-content";
import appConfig from "../../app.json";
import appStrings from "../constants/Strings";
import {HotUpdater} from "@hot-updater/react-native";
import type {RemoteConfigUtilsType} from "expo-utils/utils/types";

declare global {
    var remoteConfigUtils: RemoteConfigUtilsType;
    var remoteConfigScreens: any;
    var isAdsEnabled: boolean;
    var adUnits: any;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    const pathname = usePathname();
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional(pathname);

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, appStrings).then(() => {
            setupAppOpenListener();
            showPromoModal();
        });

        const unsubscribe = AskForReviewEvents.onShowPopup(() => {
            setShowReviewOverlay(true);
        });
        return unsubscribe;
    }, []);

    if (!appIsReady) {
        return null;
    } else {
        setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
        }, 1000);
    }

    return (
        <>
            <Stack>
                <Stack.Screen name="index" options={{headerShown: false}} />
            </Stack>
            <PromotionalContent visible={showPromo} onClose={hidePromoModal} />
            <AskForReviewOverlay
                visible={showReviewOverlay}
                onClose={() => setShowReviewOverlay(false)}
                delay={global.remoteConfigUtils?.review_type_delay || 0}
            />
        </>
    );
}

export default HotUpdater.wrap({
    baseURL: "https://YOUR-WORKER.workers.dev/api/check-update",
    updateMode: "manual",
})(RootLayout);
```

### 2. Função Utils.prepare()

A função principal que inicializa tudo automaticamente:

```typescript
Utils.prepare(
    setAppIsReady,        // Callback quando app estiver pronto
    appConfig,            // Configuração do app (app.json)
    appStrings,           // AppStrings com rckey e adUnits (opcional)
    requestPermissions    // Solicitar permissões ATT/Push no início (default: true)
);
```

**Parâmetros:**

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `setAppIsReady` | `(ready: boolean) => void` | - | Callback chamado quando inicialização termina |
| `appConfig` | `any` | `undefined` | Configuração do app.json |
| `appStrings` | `AppStrings` | `undefined` | Objeto com `rckey` (chave RevenueCat) e `adUnits` (unit IDs do AdMob) |
| `requestPermissions` | `boolean` | `true` | Se deve solicitar permissões ATT e Push no início |

**Exemplo sem solicitar permissões no início:**
```typescript
// Útil quando você quer controlar quando mostrar os diálogos
Utils.prepare(setAppIsReady, appConfig, AppStrings, false);
```

**O que a função prepare() faz automaticamente:**

✅ Solicita permissões de rastreamento iOS (ATT)
✅ Solicita permissão de Push Notifications
✅ Carrega configurações remotas do Firebase
✅ Verifica e aplica atualizações OTA (HotUpdater)
✅ Valida versão mínima obrigatória
✅ Configura RevenueCat com chave do AppStrings local
✅ Inicializa Facebook SDK
✅ Inicializa TikTok Ads SDK
✅ Configura Microsoft Clarity analytics
✅ Atribuição do RevenueCat em duas fases, com envio forçado (ver [Atribuição e analytics](#-atribuição-do-revenuecat-e-analytics-v140))
✅ Gerencia tópicos FCM pelo estado da assinatura (trial, trial cancelado, falha na renovação…) e pelos marcos iniciou trial / converteu
✅ Configura push notifications e inscreve em tópicos
✅ Rastreia push **recebida e aberta** via custom analytics events (`push_received`, `push_received_bg`, `push_opened`)
✅ Habilita export de métricas de entrega para BigQuery (Android)

> ⚠️ **ATT, UMP, permissão de push, Facebook, TikTok e a fase 2 da atribuição NÃO rodam dentro do `prepare()`** —
> rodam depois do primeiro frame, disparados pelo `Utils.handleReady` (o `<View onLayout={Utils.handleReady} />`
> que o `ExpoUtilsLayout` e o template `RootLayout.tsx` já renderizam). Um `_layout.tsx` legado que só chama
> `Utils.prepare()` perde tudo isso em silêncio. Desde a v1.4.0 um watchdog avisa: 30s depois do `prepare()` sem
> `handleReady`, sai um `expoUtilsWarn` (que vira o evento `expo_utils_warn` no Analytics).

## 📊 Push: recebidas e abertas

O expo-utils registra no Firebase Analytics cada push **recebida** e cada push **aberta** (toque na notificação). Isso resolve a limitação do Firebase Console, que mostra "Recebidas: 0" em apps cross-platform, e dá a **taxa de abertura por notificação**.

### Eventos

| Evento | Quando dispara | Plataforma |
|--------|---------------|------------|
| `push_received` | App em foreground recebe a notificação | iOS + Android |
| `push_received_bg` | App em background recebe a notificação | Android (iOS apenas com `content-available: 1`) |
| `push_opened` | Usuário **tocou** na notificação — `open_state`: `background` (app estava em 2º plano) ou `quit` (a notificação abriu o app) | iOS + Android |

### Parâmetros (os três eventos)

- `fcm_message_id` — ID da mensagem FCM no aparelho
- `fcm_topic` — tópico de origem (extraído de `from: /topics/<nome>`; vazio em envio direto por token)
- `title` — título da notificação (max 100 chars)
- `push_id` — identificador **escolhido pelo sender**: o primeiro presente entre `data.push_id`, `data.notification_id`, `data.campaign_id`
- `latency_s` — segundos entre o envio (`sentTime`) e o recebimento/abertura
- `app_state` (recebidas) / `open_state` (abertas)

`push_opened` sai no máximo 1x por notificação (o `getInitialNotification` pode devolver a mesma mensagem de novo num reload).

**Taxa de abertura** = `push_opened` ÷ (`push_received` + `push_received_bg`), agrupando por `push_id`. Enquanto o sender não mandar um id, agrupe por `title`. Para ter o id exato, inclua no payload do FCM:

```json
{"message": {"topic": "meu-app", "notification": {"title": "...", "body": "..."}, "data": {"push_id": "2026-09-20-0930"}}}
```

> O `fcm_message_id` **não** serve para casar sender × aparelho em envio por tópico: o id que a API HTTP v1 devolve ao sender não é o que chega no device.
>
> Até a 1.4.0 esses params se chamavam `message_id` e `topic` e **nunca chegavam ao GA4**: o SDK envia, o GA4 não mostra — provável colisão com os nomes que o próprio FCM usa nos eventos dele. Dimensão personalizada criada como `topic` deve ser recriada como `fcm_topic`.

### Onde visualizar

**Firebase Console > Analytics > Events** (não na tela "Mensagens" do FCM). Para quebrar por `push_id`/`fcm_topic` nos relatórios, registre-os como dimensões personalizadas — ver `docs/ANALYTICS-EVENTS.md`.

### BigQuery Export

O expo-utils habilita automaticamente `experimentalSetDeliveryMetricsExportedToBigQueryEnabled` para exportar métricas detalhadas de entrega para o BigQuery (requer configuração no Firebase Console).

### Limitações conhecidas (de plataforma)

- **iOS em background/fechado**: uma notificação exibida pelo sistema **não acorda o JS** (só com `content-available: 1`), então "recebida" no iOS é contada apenas em foreground. "Aberta" é contada nas duas plataformas.
- **Android com o app fechado (quit)**: o handler de background só existe depois que o JS do app registrou o `setBackgroundMessageHandler`, o que acontece no boot da lib. Com o processo morto o headless task não encontra o handler — a entrega nesse estado aparece no export do BigQuery, não em `push_received_bg`.
- **iOS**: "Recebidas" e "Impressões" no Firebase Console são métricas exclusivas do Android.
- **Firebase Console > Mensagens**: as métricas nativas dependem de Google Analytics vinculado ao projeto + `google-services.json` correto.

---

## 🧭 Atribuição do RevenueCat e analytics (v1.4.0)

### Por que mudou

Até a 1.3.x a atribuição era o **último** passo de uma fila serial (splash → UMP → ATT → prompt de push → Facebook → TikTok → link-in-bio → update dialog → atribuição), sem timeout nos getters, e o SDK do RevenueCat só **envia** atributos em compra, background/foreground e login. Quem comprava no 1º minuto e não voltava — o assinante típico de paywall de onboarding — ficava com o customer **vazio** no dashboard.

### Como funciona agora

| Fase | Quando | O que grava |
|------|--------|-------------|
| **1** | No boot, logo após o `Purchases.configure` (sem prompt, sem timer, sem consentimento) | token do AdServices (iOS), `$firebaseAppInstanceId`, atributos de contexto, `store_country`, e o `user_id` do GA4 = App User ID do RevenueCat |
| **2** | Assim que o ATT resolve, em cadeia destacada (não espera push/TikTok) | device identifiers (`$idfa`/`$idfv`/`$gpsAdId`/`$ip`), `$fbAnonId`, push token, geo por IP |

- Cada etapa tem **timeout próprio** (3s; push 12s; geo 10s) — uma promise nativa pendurada não trava mais a fila.
- Cada fase termina com **envio forçado** (`Purchases.syncAttributesAndOfferingsIfNeeded()`, debounce de 2s, no máximo 4 por janela de 60s — o SDK limita a 5/min; o que exceder espera a janela, não é descartado).
- `collectDeviceIdentifiers()` roda **sempre**: o próprio SDK já o chama dentro do `setFBAnonymousID`, então condicionar ao ATT não protegia nada. Sem ATT o iOS zera o IDFA; IDFV e IP não são escopo do ATT.
- **iOS**: `setPushToken` recebe o token **APNS** (é o que o campo `$apnsTokens` espera); o token FCM vai na chave custom `fcm_token`. Android: `setPushToken(fcm)` → `$fcmTokens`.
- TikTok e link-in-bio gravam o próprio atributo quando o SDK deles sobe. Se o `trackInstall()` do link-in-bio casar o install, grava `$mediaSource = "link_in_bio"` + `$campaign` (e emite `install_attribution`). A flag de "feito" (`tr_is_first_launch_tracking`) só é gravada quando o **servidor respondeu**: offline/timeout/erro do servidor emite `install_attribution_error` e tenta de novo na próxima abertura do app — até a 1.4.0 a flag era gravada antes da chamada e o install que falhava se perdia, com `matched: 0` igual a um sem-match de verdade.

### Origem do install: Media Source, Campaign, Ad Group, Ad, Keyword, Creative

| Plataforma | De onde vem | O que preenche |
|------------|-------------|----------------|
| **Android** | Play Install Referrer (`Application.getInstallReferrerAsync()` — já é peer dep, sem módulo nativo novo), lido na fase 1 **uma vez por install** (como o Google pede): o resultado fica no AsyncStorage (`@expo_utils_install_referrer`, com o horário do install — reinstalação/backup restaurado lê de novo) e o `install_attribution` sai só nessa 1ª leitura; os atributos seguem regravados a cada sessão a partir do valor guardado | `utm_source` → Media Source · `utm_campaign` → Campaign · `utm_adgroup` → Ad Group · `utm_ad` → Ad · `utm_term` → Keyword · `utm_content` → Creative. Custom: `install_referrer` (cru), `install_medium`, `gclid` + `click_id_type` |
| **Android**, anúncio da **Meta** | o mesmo referrer, que a Meta manda **cifrado** — a lib abre no aparelho com a chave do app (seção abaixo) | Media Source = `Instagram Ads` / `Facebook Ads` / `Meta Audience Network` / `Messenger Ads` · Campaign · Ad Group (conjunto) · Ad, com os **nomes reais**. Custom: `meta_*` |
| **iOS** | Apple Search Ads: o token do AdServices sai na fase 1 e o **próprio RevenueCat** resolve Media Source / Campaign / Ad Group / Keyword | exige ligar a integração de Apple Search Ads no dashboard do RC |
| as duas | match do link-in-bio (`trends_tracking_url`) | Media Source = `link_in_bio` + Campaign |

Limites que **não são da lib**:

- **Google Ads (campanha de app)**: o referrer traz só o id do clique (`gclid`/`gbraid`/`wbraid`). Nome de campanha, grupo, palavra-chave e criativo **não chegam ao aparelho** — só via vínculo Google Ads ↔ Firebase/GA4 ou via MMP (AppsFlyer, Adjust…). A lib marca Media Source = `Google Ads` e guarda o id do clique em `gclid` (nome mantido por compatibilidade, vale também para gbraid/wbraid) e qual dos três veio em `click_id_type` (`gclid` · `gbraid` · `wbraid`) — eles não são intercambiáveis ao cruzar com o Google Ads.
- **Meta (Facebook/Instagram)**: no **Android** vem no referrer, cifrado — ver a seção abaixo. No **iOS** não existe equivalente: sem MMP/SKAdNetwork não há atribuição determinística por install.
- **Compra contada 2x na Meta (configuração, não código)**: com a integração **Meta** ligada no dashboard do RevenueCat, a compra chega à Meta pelo servidor do RC; com `autoLogAppEventsEnabled: true` no plugin do `react-native-fbsdk-next` (padrão do `--config`), o próprio FB SDK também pode registrar a compra do aparelho. Confira no Events Manager se as compras aparecem em dobro e, se sim, mantenha **uma** fonte — desligar a integração no RC ou o log automático do SDK (que também leva os eventos automáticos de install/abertura). A lib não mexe nessa flag.
- **TikTok**: não passa referrer utilizável em nenhuma plataforma; sem MMP não há atribuição determinística.
- **Instalação sem link** (busca na loja, sideload): a lib **não grava** Media Source — marca só `install_medium = organic`. Motivo medido no dashboard (21/09/2026, com atributo-controle na mesma gravação): no RevenueCat os campos de atribuição são **“primeira gravação vence”** — regravar `$mediaSource`/`$campaign` pelo SDK não substitui o valor. Um `Organic` escrito no boot bloqueava qualquer fonte melhor que chegasse depois (match do link-in-bio, Apple Search Ads, MMP).
- **Android ID**: o SDK do RevenueCat **não coleta mais** (não existe `$androidId` no SDK Android 10.x) e a lib não grava de propósito — a política do Google Play proíbe associar o Advertising ID a identificador persistente do aparelho sem consentimento explícito, e o GPS Ad ID já vai.
- **APNS**: só existe em **iPhone físico** (simulador não tem APNS) e só no iOS; em customer Android o campo fica vazio por plataforma.

### Anúncio da Meta (Facebook / Instagram) no Android — sem MMP

Quando o install vem de um anúncio da Meta, o `utm_content` do referrer é um JSON `{"source": {"data": "<hex>", "nonce": "<hex>"}, "a": <app id>, "t": <timestamp>}` cifrado com **AES-256-GCM**. A lib detecta esse formato sozinha e:

| Situação | O que vai para o customer |
|----------|---------------------------|
| **Com a chave** | Media Source pela plataforma que serviu o anúncio (`Instagram Ads`, `Facebook Ads`, `Meta Audience Network`, `Messenger Ads`), **Campaign**, **Ad Group** (conjunto de anúncios) e **Ad** com os nomes reais; custom `meta_campaign_group_name`, `meta_campaign_name`, `meta_adgroup_name`, `meta_ad_id`, `meta_account_id`, `meta_objective`, `meta_placement` (ex.: `instagram:instagram_stories`) |
| **Sem a chave** (ou chave errada) | Media Source = `Instagram Ads` / `Facebook Ads` (pela dica do `utm_source`, que a Meta avisa **não ser garantida**) ou `Meta Ads`; e o dado cifrado é **guardado** em `meta_ref_nonce` + `meta_ref_data_1..4` para abrir depois, fora do app |

**Configurar a chave** (uma das duas; o Remote Config vence):

1. Meta for Developers → seu app → **Configurações do app → Básico → Android → “Install Referrer Decryption Key”** (hex de 64 caracteres).
2. Remote Config, dentro do bloco `utils`: `"meta_install_referrer_key": "<chave>"` — troca sem publicar versão; **ou** no `Strings.ts`: `metaInstallReferrerKey: "<chave>"`.

A decriptação é TypeScript puro (`utils/aes-gcm.ts`, sem módulo nativo, validada contra o `crypto` do Node e o vetor do NIST; ~6 ms no Hermes) e confere a **tag** do GCM: chave errada ou dado adulterado nunca vira atributo lixo — cai no caminho “sem chave”. O evento `install_attribution` ganha o parâmetro `meta` (`decrypted` · `encrypted` · `decrypt_failed`) para medir em produção se a chave está certa.

Limites: só **Android**; só clique + install na mesma sessão da Play (view-through e install dias depois não passam pelo referrer); a Meta usa a nomenclatura legada (`campaign_group` = campanha, `campaign` = conjunto, `adgroup` = anúncio) — a lib já traduz. A chave só abre a metadata de campanha do **seu próprio** app; ainda assim prefira o Remote Config, que permite rotacionar. **Testado com um referrer sintético no formato da Meta, aberto no aparelho e conferido no dashboard do RevenueCat — ainda não com um anúncio real** (exige o app publicado na Play com campanha rodando). Quem precisa do mapeamento fora do boot: `mapInstallReferrer(referrer, {metaKey})` é exportado.

Para testar um referrer de campanha de verdade o app precisa estar na Play (faixa de teste interno) e ser instalado por um link `…/details?id=<pacote>&referrer=utm_source%3D…`; por `adb install` o referrer é sempre o orgânico.

### Atributos de contexto no customer (chaves custom)

| Atributo | Exemplo | Fonte |
|----------|---------|-------|
| `language` / `locale` | `pt` / `pt-BR` | `expo-localization` |
| `device_region` | `BR` | região **configurada** no aparelho |
| `currency` / `timezone` | `BRL` / `America/Sao_Paulo` | `expo-localization` |
| `store_country` | `GB` (Play) / `GBR` (Apple) | `Purchases.getStorefront()` — país da **conta da loja** |
| `geo_country` / `geo_state` / `geo_state_code` / `geo_city` / `geo_source` | `BR` / `Para` / `PA` / `…` / `ipwho.is` | geo por IP (abaixo) |
| `app_version`, `build_number`, `expo_utils_version`, `os_version`, `device_model`, `install_date` | — | `expo-application` / `expo-device` |

Os três "países" respondem perguntas diferentes: conta da loja (preço/moeda) × configuração do aparelho × onde a pessoa está. **No GA4 nada disso precisa de código**: o Firebase já deriva país/estado/cidade do IP e coleta idioma, versão e modelo em todo evento.

Para gravar atributos próprios já com envio forçado:

```typescript
import {setRevenueCatAttributes} from "expo-utils";
await setRevenueCatAttributes({onboarding_goal: "perder_peso"}); // true = aceito pelo SDK
```

### Geo por IP (país, estado, cidade) — ligada por padrão

Sem GPS, sem permissão, sem chave e sem custo. Cadeia de provedores gratuitos com fallback (testados ao vivo e com os termos lidos em 20/09/2026): **ipwho.is** ("Commercial use allowed", 1.000 req/dia por IP de cliente) → **BigDataCloud** (endpoint client-side, "free to use, and requires no API key") → **GeoJS** ("No rate limits (yet)"). Timeout de 3s por provedor, cache de **7 dias** por aparelho, nunca bloqueia nem lança.

| Controle | Onde | Efeito |
|----------|------|--------|
| `geo_lookup_enabled: false` | Remote Config (`utils`) | desliga sem build novo |
| `{"geoAttributes": false}` | `app.json` → `["expo-utils", {...}]` | desliga no build |
| `geo_lookup_url: "https://..."` | Remote Config (`utils`) | endpoint **próprio**, tentado antes dos gratuitos. Contrato: `{country, region, regionCode, city}` |

Endpoint próprio em 6 linhas (Cloudflare Worker — `request.cf` já traz tudo, 100k req/dia no plano grátis):

```js
export default {
    fetch(request) {
        const {country, region, regionCode, city} = request.cf || {};
        return Response.json({country, region, regionCode, city}, {headers: {"cache-control": "no-store"}});
    },
};
```

> **Privacidade / lojas:** cidade e estado gravados contra o ID do customer contam como **"Coarse Location"** no rótulo de privacidade da App Store e **"Approximate location"** no Data Safety do Google Play. Como a geo vem ligada, declare nos dois — ou desligue com uma das chaves acima.
> **Precisão** de geo por IP: país ~99%, estado ~80–90%, cidade 50–80% (operadora móvel costuma cair na cidade do hub). Serve para agregados.

### Eventos e user properties novos

| O quê | Para quê |
|-------|----------|
| `rc_attribution` (`phase`, `steps_ok`, `steps_fail`, `ms`, `synced`, `att`) | prova em produção de que a atribuição saiu do aparelho. `count(phase=2) ÷ count(phase=1)` = taxa de entrega da fila pós-ATT |
| `consent_flow` (`ump`, `att`, `push`) | taxa de opt-in — 1x por instalação e quando algum muda |
| `paywall_view` / `paywall_product_select` / `paywall_purchase_start` / `_success` / `_cancel` / `_error` / `paywall_restore` / `paywall_close` | funil do paywall por `placement` (novo campo opcional do `usePaywall`) |
| `review_request` / `review_prompt_show` / `review_prompt_action` / `review_store_requested` | funil do review, com `style` — é o que permite comparar os layouts do `review_style` |
| `promo_impression` / `promo_click` com `promo_variant: "cross_promo_card"` | o cross-promo (obrigatório) passa a ser medido |
| `push_opened` | notificações abertas |
| user property `rc_status` | todo evento pode ser quebrado por free / trial / trial_cancelled / active / billing_issue / expired… (lista em [Tópicos FCM](#-gerenciamento-de-tópicos-fcm)) |
| user property `att_status`, `user_id` = App User ID do RC | segmentação e join GA4 ↔ RevenueCat |

Catálogo completo (params, limites do GA4 e o que registrar como dimensão personalizada): **`docs/ANALYTICS-EVENTS.md`**. Em dev, cada evento aparece no console do Metro como `[expo-utils] event <nome> {...}` (respeita `disableLogs`).

Para usar o mesmo logger best-effort da lib (nunca lança, nunca vira unhandled rejection, compatível com a tipagem `void` do RNFB 26):

```typescript
import {logUtilsEvent, setUtilsUserProperty} from "expo-utils";
logUtilsEvent("quiz_finished", {score: 8, premium: true}); // boolean vira 1/0
```

---

## 🎯 Sistema de Anúncios Inteligente

### Componentes Prontos

```typescript
import LoadAdsManager from 'expo-utils/utils/LoadAdsManager';
import BannerAdComponent from 'expo-utils/utils/banner-ad';

// Anúncios intersticiais
await LoadAdsManager.showInterstitial(); // Usa unit ID padrão
await LoadAdsManager.showInterstitial('ca-app-pub-xxx/xxx'); // Unit ID customizado

// Anúncios recompensados
const userEarnedReward = await LoadAdsManager.showRewarded();
if (userEarnedReward) {
    // Dar recompensa ao usuário
}

// Banner fixo na tela
<BannerAdComponent />
<BannerAdComponent unitId="ca-app-pub-xxx/xxx" />

// Banner com tag para placement tracking
<BannerAdComponent tag="home-bottom" />
```

### Verificações Automáticas

**Usuários Premium** (`PremiumUtils.getIsPremiumStatus()`, fonte única de todos os formatos de ad). Em **produção** o veredito vem sempre do RevenueCat: Premium = algum entitlement ativo que **não** foi cancelado nem está com falha de cobrança — assinatura/trial renovando, **compra vitalícia** (ex.: "remover anúncios", sem data de expiração), plano **pré-pago** do Play e concessão **promocional** (os três têm `willRenew: false` sem terem cancelado; até 07/10/2026 a lib os tratava como não-Premium e quem comprou o vitalício continuava vendo anúncio). Assinatura ou trial cancelado perde o Premium na hora, salvo `is_opted_out_trial_enabled: true` no Remote Config (aí basta assinatura ativa). Em `__DEV__` vale só o toggle local:

```typescript
// Marcar como premium (anúncios não aparecem) — toggle de DEV
await AsyncStorage.setItem("@isPremium", "true");

// Remover premium
await AsyncStorage.removeItem("@isPremium");
```

**Configurações Remotas** (Firebase):

- `is_ads_enabled: false` → Desabilita anúncios globalmente
- Respeita configuração `global.isAdsEnabled`

**Unit IDs Inteligentes**:

- Usa unit IDs do `AppStrings` local (`global.adUnits`)
- Permite override via parâmetro
- Configuração por plataforma (iOS/Android)

### Mediation, consentimento (UMP) e receita por impressão

**Mediation vem ligada** — o plugin injeta os adapters das 4 redes padrão (AppLovin, Meta, Unity e Pangle) e o SDK da Unity no Android (o adapter dela não traz) no build (veja a opção
`mediation` em [Configuração do Plugin](#-configuração-do-plugin-opcional)). O que o app faz em
runtime, sozinho, dentro do `Utils.handleReady` → `requestTrackingWhenActive()` (depois do primeiro frame — **não** é o `prepare()` que dispara):

1. **UMP antes do ATT** — `AdsConsent.gatherConsent()` roda primeiro (ordem recomendada pelo
   Google; o iOS só mostra um modal de sistema por vez). Fora de EEA/UK/estados regulados dos
   EUA não exibe nada.
2. **`mobileAds().initialize()`** — só quando o consentimento permite (`canRequestAds`). O log
   mostra o `AdapterStatus` de cada rede (`ready` / `NOT_READY`): é a checagem rápida de que a
   mediação está mesmo no build.
3. **Nada disso roda** para usuário premium nem com `is_ads_enabled: false`.

```typescript
import Utils from "expo-utils";

// Só mostre o botão quando existir formulário para abrir (EEA/UK/US regulado que já consentiu).
const mostrarBotao = await Utils.isPrivacyOptionsRequired();

const {shown, reason} = await Utils.showPrivacyOptionsForm();
// shown=false + reason="not-required" → não há form nesta região/estado; nada a exibir.
// O form leva 1–3s para carregar (vem da rede): deixe o botão em loading.

Utils.resetAdsConsent(); // QA: zera o UMP e força o formulário no próximo boot
```

⚠️ **Botão que "não faz nada"**: `showPrivacyOptionsForm()` do SDK só abre algo quando
`privacyOptionsRequirementStatus === REQUIRED`. Fora da EEA (ou antes do consentimento ser
coletado) não existe formulário — por isso use `isPrivacyOptionsRequired()` para esconder o botão,
e o `reason` do retorno para logar o motivo quando ele mesmo assim não abrir.

**Receita por impressão (ILRD)**: banner, interstitial, rewarded e app-open disparam
`ad_revenue` via `logUtilsEvent`, com formato, placement e valor/moeda/precisão quando disponíveis.
Valor ou moeda ausentes não viram zero/USD. Para análise por rede, ligue o *Impression-level
ad revenue* no console do AdMob + o link AdMob↔Firebase e use `ad_impression` com `ad_source`.
Não somar ambos como receitas adicionais.

**Taichi automático:** 20 limites de receita acumulada em USD, de US$ 0,0001 a US$ 0,25,
nas primeiras 24h, 72h e 7 dias: 60 eventos com nomes próprios, sem parâmetros monetários,
por exemplo `taichi_rev_0_001usd_24h`. `Utils.prepare` inicia o acumulador; o estado e os
marcos ficam no AsyncStorage. Instalações já marcadas por `@first_open_logged`, sem estado
Taichi, ficam excluídas para não parecerem novas no upgrade. Hosts mais antigos sem esse
marcador devem seguir a [migração](docs/UPGRADE-EXPO57-EXPO-UTILS.md#taichi).

No bloco `utils` do Remote Config, `taichi_events` ausente habilita todos, `[]` desliga as
emissões, e uma lista seleciona nomes exatos. A soma continua sendo coletada com `[]`;
ativação posterior pode qualificar marcos ainda não emitidos na próxima impressão válida,
se a janela continuar aberta. Não há conversão de BRL para USD. Consulte os
[60 eventos e limites de persistência/deduplicação](docs/ANALYTICS-EVENTS.md#taichi).
Para tCPA, selecione o marco pretendido; para tROAS de publicidade, use `ad_impression`.

## 🌍 Sistema de Internacionalização

### Idiomas Suportados

| Código | Idioma    | Código | Idioma     |
| ------ | --------- | ------ | ---------- |
| `pt`   | Português | `en`   | English    |
| `es`   | Español   | `fr`   | Français   |
| `de`   | Deutsch   | `it`   | Italiano   |
| `ja`   | 日本語    | `ko`   | 한국어     |
| `zh`   | 中文      | `ru`   | Русский    |
| `ar`   | العربية   | `nl`   | Nederlands |

### Uso das Traduções

```typescript
import {getLocalizedMessages} from "expo-utils";

const messages = getLocalizedMessages();

// Usar nas mensagens
Alert.alert(messages.updateRequired, messages.updateMessage);

// Detecção automática do idioma do sistema
const systemLang = getSystemLanguage(); // 'pt-BR' → 'pt'
```

**Mensagens Disponíveis:**

- `updateRequired` - Título para atualização obrigatória
- `updateMessage` - Mensagem de atualização disponível
- `updateNow` - Botão "Atualizar Agora"
- `newMessage` - Mensagem genérica

## 🎨 Estilos Pré-definidos

O expo-utils inclui uma coleção de estilos úteis prontos para uso:

```typescript
import { ExpoUtilsStyles } from 'expo-utils';

// Usar os estilos
<View style={ExpoUtilsStyles.footerBanner}>
    {/* Conteúdo do banner footer */}
</View>

<View style={ExpoUtilsStyles.container}>
    {/* Container centralizado */}
</View>

<View style={[ExpoUtilsStyles.card, ExpoUtilsStyles.shadow]}>
    {/* Card com sombra */}
</View>
```

### Estilos Disponíveis

| Estilo          | Descrição                                             |
| --------------- | ----------------------------------------------------- |
| `footerBanner`  | Banner fixo no rodapé (position absolute, bottom 0)   |
| `container`     | Container flex centralizado                           |
| `centerContent` | Conteúdo centralizado                                 |
| `fullWidth`     | Largura 100%                                          |
| `fullHeight`    | Altura 100%                                           |
| `absoluteFill`  | Preenchimento absoluto (top, left, right, bottom = 0) |
| `shadow`        | Sombra padrão para iOS/Android                        |
| `card`          | Card com fundo branco, bordas arredondadas e sombra   |

### BannerAdComponent

```typescript
// Props: unitId? (string) e tag? (string)
<BannerAdComponent />
<BannerAdComponent unitId="ca-app-pub-xxx/xxx" />
<BannerAdComponent tag="settings-bottom" />
```

O `tag` é usado pelo sistema de Ad Placement Tracking para gerar IDs únicos de placement (e poder bloquear via `ad_blocklist`).

## 📬 Gerenciamento de Tópicos FCM

### Tópicos inscritos automaticamente

```typescript
// meu-app                          ← todos os usuários
// meu-app-br                       ← por país (regionCode)
// meu-app-lang-pt                  ← por idioma (languageCode)
// meu-app-purchase-free            ← estado da assinatura (1 por vez, troca sozinho)
// meu-app-purchase-trial_started   ← marco: já iniciou um trial (acumula, nunca sai)
// meu-app-purchase-converted       ← marco: passou do trial para pago (acumula, nunca sai)
```

### Estado da assinatura: `meu-app-purchase-{status}`

Um tópico por aparelho: a cada mudança a lib sai do anterior e entra no novo. O mesmo valor vai na
user property `rc_status` do Analytics.

| Status | Quando |
|--------|--------|
| `free` | Nunca comprou |
| `trial` | Em trial com renovação ligada — é onde cai quem acabou de iniciar o trial |
| `trial_cancelled` | Cancelou o trial (renovação desligada) e ainda tem acesso até o fim dele |
| `billing_issue` | Falha na renovação: a cobrança foi recusada. Vale na carência (ainda com acesso) e até 60 dias depois de perder o acesso, enquanto a loja segue tentando cobrar. Inclui a cobrança do fim do trial |
| `intro` | Preço introdutório com renovação ligada |
| `active` | Pagante com renovação ligada (inclui quem converteu do trial) |
| `cancelled` | Pagante que desligou a renovação e ainda tem acesso |
| `trial_expired` | O trial acabou sem virar pago |
| `expired` | O período pago acabou (ou a falha de cobrança passou de 60 dias) |
| `refunded` | Reembolsado |

Ordem das regras: falha de cobrança vence tudo → renovação desligada (`unsubscribeDetectedAt`) →
tipo do período (`TRIAL` / `INTRO` / pago). Com mais de um entitlement ativo, decide a assinatura
que vence por último; um vitalício só decide quando não há assinatura ativa.

### Marcos: `meu-app-purchase-trial_started` e `meu-app-purchase-converted`

Acumulam: o aparelho entra uma vez e **nunca sai**.

- `trial_started`: o aparelho viu um trial, ativo ou já expirado.
- `converted`: depois do trial, o aparelho viu um período pago **ativo** e sem falha de cobrança.
  Carência e cobrança do fim do trial que falhou não contam.

O histórico do trial fica no aparelho (`@expo_utils_rc_milestones`), porque o `customerInfo` deixa
de mostrar o trial depois da conversão. Quem reinstala ou troca de aparelho depois de converter,
sem restaurar backup, não entra nos marcos.

### Quando o tópico muda

No boot e a cada `customerInfo` novo do RevenueCat — ou seja, **só quando o app abre**. Quem
cancela o trial nas configurações da loja e não abre mais o app continua em `trial`. Configure no
RevenueCat as **App Store Server Notifications** e as **Google Real-time Developer Notifications**:
sem elas, cancelamento e falha de cobrança demoram a chegar ao SDK mesmo com o app aberto.

- Em simulador iOS (sem APNS) a lib pula os tópicos, mas grava `rc_status` e os marcos.
- A cada sessão a lib reinscreve o aparelho no tópico atual e nos marcos (1x, sem evento):
  backup restaurado traz o armazenamento do app com um token FCM novo, que não está em tópico nenhum.
- Compras sandbox (TestFlight, testadores) também entram nos tópicos — são os aparelhos do time.
- Os eventos de transição (`rc_trial_start`, `purchase`, `rc_cancellation`, `rc_billing_issue`…)
  vêm da integração Firebase do RevenueCat, pelo servidor. A lib não loga de novo.

### Uso Manual

```typescript
import Utils from "expo-utils/utils/Utils";
import type {RcStatus} from "expo-utils";

// Atualizar agora (rckey = chave RevenueCat). Sem o 3º argumento, busca o customerInfo no RevenueCat.
await Utils.updateRCStatusMessagingTopic(appConfig, rckey);
await Utils.updateRCStatusMessagingTopic(appConfig, rckey, customerInfo);

// Só o status
const status: RcStatus = Utils.getRevenueCatStatus(await Purchases.getCustomerInfo());
console.log(status); // "active", "free", "trial_cancelled", etc.
```

### Segmentação de Push Notifications

Use **topic conditions** para combinar idioma + status e enviar push localizado:

```javascript
// Firebase Admin SDK (servidor)

// Free users que falam português (BR, PT, AO...)
admin.messaging().send({
    condition: "'meu-app-purchase-free' in topics && 'meu-app-lang-pt' in topics",
    notification: { title: 'Oferta Especial!', body: 'Assine com 50% de desconto!' }
});

// Free users que falam inglês (US, GB, AU...)
admin.messaging().send({
    condition: "'meu-app-purchase-free' in topics && 'meu-app-lang-en' in topics",
    notification: { title: 'Special Offer!', body: 'Subscribe with 50% off!' }
});

// Cancelou o trial e ainda tem acesso: oferta antes de o trial acabar
admin.messaging().send({
    condition: "'meu-app-purchase-trial_cancelled' in topics && 'meu-app-lang-pt' in topics",
    notification: { title: 'Fica com o premium', body: '50% de desconto no 1º mês.' }
});

// Falha na renovação — todos os idiomas
admin.messaging().send({
    topic: 'meu-app-purchase-billing_issue',
    notification: { title: 'Payment issue', body: 'Update your payment info.' }
});

// Iniciou trial e nunca pagou (inclui quem ainda está no trial)
admin.messaging().send({
    condition: "'meu-app-purchase-trial_started' in topics && !('meu-app-purchase-converted' in topics)",
    notification: { title: 'Volte para o premium', body: 'Seu desconto de boas-vindas ainda vale.' }
});

// Todos os brasileiros (qualquer status)
admin.messaging().send({
    topic: 'meu-app-br',
    notification: { title: 'Novidade!', body: 'Confira a nova atualização.' }
});
```

> O FCM aceita até **5 tópicos** por condição, com `&&`, `||` e `!`. Com tópicos por idioma, 12
> idiomas = 12 envios (em vez de dezenas por país). **Nunca use `!` sozinho**: `!('x' in topics)`
> atinge todos os aparelhos do projeto Firebase, inclusive os de outros apps e os sem tópico.

## ⭐ Sistema de Avaliações

### Função `askForReview()`

Dispara o pedido de review conforme `review_type` do Remote Config (`store-review` | `popup` | `dialog`). Não mostra de novo se `@user_rated` já estiver setado.

```typescript
import {askForReview} from "expo-utils/utils/ask-for-review";

// Usa RC `review_show_delay` (ou 0 se ausente)
await askForReview();

// Override local: espera 3s (ignora o RC neste call)
await askForReview(undefined, undefined, 3000);

// Com textos/imagem custom + delay
await askForReview(
    {title: "...", message: "...", notNow: "...", rateNow: "..."},
    require("./assets/review.png"),
    5000,
);
```

| Parâmetro   | Tipo                 | Padrão | Descrição |
| ----------- | -------------------- | ------ | --------- |
| `texts`     | `AskForReviewTexts?` | —      | Textos do dialog (modo `dialog`) |
| `image`     | `any?`               | —      | Imagem do popup (modo `popup`) |
| `showDelay` | `number?`            | RC / `0` | **ms antes do review aparecer**. Se omitido → `remoteConfigUtils.review_show_delay` → `0` |

> **Não confundir** com `delay` do `AskForReviewOverlay` / `review_type_delay` do RC — esses controlam só o tempo até habilitar o botão **"Agora não"** no popup, não quando o card abre.

### Função openReviewURL()

Abre automaticamente a tela de avaliação da loja apropriada usando os dados já configurados no projeto:

```typescript
import Utils from "expo-utils/utils/Utils";

// Usar configurações automáticas (recomendado)
await Utils.openReviewURL();

// Forçar abertura no navegador
await Utils.openReviewURL(false);

// Verificar se abriu com sucesso
const success = await Utils.openReviewURL();
if (success) {
    console.log("Review aberto com sucesso!");
}
```

### Parâmetros

| Parâmetro           | Tipo      | Padrão | Descrição                                            |
| ------------------- | --------- | ------ | ---------------------------------------------------- |
| `preferNativeStore` | `boolean` | `true` | `true` = abre loja nativa, `false` = abre no browser |

### Dados Utilizados Automaticamente

**🤖 Android:** `Application.applicationId` (detectado automaticamente)  
**🍎 iOS:** `Application.applicationId` → busca automática do App ID via iTunes API

### Comportamento por Plataforma

**🤖 Android:**

- **Loja nativa**: `market://details?id=PACKAGE&showAllReviews=true`
- **Browser**: `https://play.google.com/store/apps/details?id=PACKAGE&showAllReviews=true`
- Detecta package automaticamente via `Application.applicationId`

**🍎 iOS:**

- **Loja nativa**: `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id=APP_ID?action=write-review`
- **Browser**: `https://apps.apple.com/app/apple-store/id=APP_ID?action=write-review`
- **App ID detectado automaticamente** via iTunes API usando o bundle ID

### Busca Automática do App ID (iOS)

O expo-utils busca automaticamente o App ID do iOS fazendo uma requisição para:

```
https://itunes.apple.com/lookup?bundleId=SEU_BUNDLE_ID
```

**✅ Vantagens:**

- **Zero configuração** necessária
- **Busca automática** via iTunes API oficial
- Na verificação de update obrigatório (`checkForRequiredUpdateDialog`), faz fallback para `ios_app_id` do Remote Config se a busca automática falhar

### Retorno

- `Promise<boolean>` - `true` se abriu com sucesso, `false` se houve erro

## 🚦 Ads Somente Após o Release na Loja

### Função disableAdsIfBuildIsNewerThanStore()

Kill switch de ads por versão de loja, **fail-closed**: os anúncios só permanecem ligados com a versão da loja **confirmada** e o build local **menor ou igual** à da loja. Build mais novo que a loja (App Review, TestFlight, teste interno), app ainda **não publicado** (review da 1ª versão!), erro de rede ou timeout → ads **OFF**. Fail-open não cobriria justamente a 1ª submissão — app sem versão na loja mostraria ads durante o review.

### Ativação via app.json (default: desativado)

A checagem **não roda por padrão**. Para ativar a execução automática no boot (dentro do `prepare()`, logo após os remote configs globais serem populados), adicione a flag no plugin do expo-utils:

```json
{
    "expo": {
        "plugins": [["expo-utils", {"disableAdsIfBuildIsNewerThanStore": true}]]
    }
}
```

A flag é lida em **runtime** (como `disableWarnings`/`disableLogs`). O gate roda dentro do `prepare()`, **depois** do `setupGlobalConfigs` (que reseta os globals de ads — por isso um gate rodando por fora, em paralelo ao boot, é sobrescrito) e é **aguardado** antes do `setAppIsReady` — assim os banners (que leem `global.isAdsEnabled` uma única vez, no mount) já montam com o veredito final. Não pendura o boot: a consulta tem timeout de 5s e nunca rejeita. Sem a flag (ou com `false`), nada roda automaticamente.

### Chamada Manual

Também dá para chamar direto, **depois** do `Utils.prepare()` (que popula os remote configs globais — se chamar antes, o `setupGlobalConfigs` sobrescreve o resultado). É memoizada (roda 1x por sessão) e resolve `true` quando os ads foram bloqueados:

```typescript
import Utils from "expo-utils/utils/Utils";

const adsBlocked = await Utils.disableAdsIfBuildIsNewerThanStore();
```

### Como Funciona

1. Lê a versão instalada de `Application.nativeApplicationVersion`.
2. Busca a versão publicada na loja:
    - **🍎 iOS**: iTunes lookup — tenta primeiro a storefront do usuário (`country=<regionCode>`, onde o app certamente existe, já que foi de onde ele instalou) e cai para a consulta global (storefront US)
    - **🤖 Android**: página do app no Play Store
    - **Fallback/válvula**: `ios_store_version` / `android_store_version` do Remote Config (bloco `utils`) — vale inclusive quando o lookup está fora do ar
3. **Fail-closed**: sem versão da loja confirmada, ou com build local **maior** que a loja, desliga tudo — `global.isAdsEnabled = false`, `is_ads_enabled: false` nos remote configs globais e `global.adsDisabledByStoreGate = true`. `LoadAdsManager`, app-open e `BannerAdComponent` param de exibir ads.

### Comportamento

| Cenário | Resultado |
|---|---|
| Build 1.0.1, loja 1.0.0 (review/TestFlight de update) | ads OFF |
| Build == loja (produção normal) | ads ON |
| App **não publicado** (review da 1ª versão; lookup vazio, sem chave no RC) | ads OFF |
| App não publicado, `ios_store_version: "1.0.0"` no Remote Config | ads ON (válvula de emergência/override) |
| Sem rede / timeout / erro no lookup | ads OFF (sem rede o AdMob não serviria mesmo) |
| Dev/simulador (app não publicado) | ads OFF — em dev os ads já vêm OFF por padrão; para ver ads use o toggle do dev menu ou a chave no RC |

> 💡 `global.adsDisabledByStoreGate === true` indica que foi **o gate** que bloqueou os ads (flag própria — o `prepare()` não mexe nela). Útil, por exemplo, para esconder o espaço reservado do banner na UI.

## 🎁 Conteúdo Promocional

O expo-utils inclui um sistema completo de conteúdo promocional para promover outros apps ou conteúdos. Suporta 5 tipos de exibição, todos configuráveis via bloco `utils` do Firebase Remote Config.

### Tipos de Exibição

| Tipo | Componente | Descrição |
|------|-----------|-----------|
| `bottom-sheet` | `PromotionalContent` | Modal 65% da tela, slide-up, drag-to-dismiss |
| `card-banner-bottom` | `PromotionalContent` | Card compacto no bottom, swipe + X para fechar |
| `notification` | `PromotionalContent` | Card estilo notificação iOS, slide top/bottom, swipe-to-dismiss |
| `fullscreen` | `PromotionalContent` | Interstitial tela inteira com timer countdown |
| `banner` | `PromotionalBanner` | View inline (não é modal), dev coloca onde quiser |

### Configuração no Remote Config (bloco `utils`)

O objeto `promotional` fica dentro do bloco `utils` do Firebase Remote Config:

```json
{
    "promotional": {
        "enabled": true,
        "type": "bottom-sheet",
        "icon": "https://exemplo.com/icone-app.png",
        "name": "Meu Outro App",
        "description": "Descrição incrível do app que você quer promover",
        "buttonText": "Baixar Agora",
        "gradientColors": ["#22C55E", "#16A34A"],
        "primaryColor": "#22C55E",
        "storeUrl": "https://apps.apple.com/app/id123456789",
        "delayMs": 5000,
        "imageUrl": "https://exemplo.com/banner.png",
        "videoUrl": "https://exemplo.com/promo.mp4",
        "bannerHeight": 200,
        "showDontShowAgain": true,
        "closeBtnDelayMs": 5000,
        "shadow": { "color": "#000", "offsetY": 6, "opacity": 0.2, "radius": 16, "elevation": 12 },
        "notificationTitle": "New from My App 🚀",
        "notificationBody": "Check out our latest feature!",
        "position": "bottom",
        "targetScreens": ["/settings", "/details"],
        "nthImpression": "1+2n"
    }
}
```

> **Backward compatibility**: a chave `appmodal` continua funcionando como fallback. Se `promotional` não existir, o sistema lê `appmodal` automaticamente.

> **Gerador de JSON**: em vez de montar à mão, use o [gerador](https://pixel-logic-apps.github.io/expo-utils/) (`docs/index.html`) — cole o link da App Store/Google Play e ele preenche nome, ícone, descrição, URLs e cores, e gera o JSON de `promotional`, `appmodal` ou `cross_promo`.

### Campos da Configuração

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `enabled` | boolean | Habilita/desabilita o conteúdo promocional |
| `type` | string | Tipo de exibição: `bottom-sheet`, `card-banner-bottom`, `notification`, `banner`, `fullscreen` |
| `icon` | string | URL do ícone do app |
| `name` | string | Nome/título do app ou conteúdo |
| `description` | string | Descrição promocional |
| `buttonText` | string | Texto do botão principal |
| `gradientColors` | [string, string] | Cores do gradiente de fundo |
| `primaryColor` | string | Cor do botão principal |
| `storeUrl` | string | URL da loja para download |
| `delayMs` | number | Delay em ms antes de mostrar (default: 5000) |
| `imageUrl` | string | URL de imagem banner (substitui o gradiente) |
| `videoUrl` | string | URL de vídeo para fullscreen (requer `expo-av`). Prioridade sobre `imageUrl` |
| `bannerHeight` | number | Altura do banner em pixels (default: 200) |
| `showDontShowAgain` | boolean | Mostrar botão "Não mostrar novamente" |
| `closeBtnDelayMs` | number | Milissegundos antes do botão X aparecer no fullscreen (default: 5000) |
| `shadow` | object | Configuração de sombra: `{ color, offsetX, offsetY, opacity, radius, elevation }` |
| `notificationTitle` | string | Título do header (tipo notification). Fallback: `name` |
| `notificationBody` | string | Subtítulo do header (tipo notification). Fallback: `description` |
| `position` | string | Posição: `"top"` ou `"bottom"` (tipo notification, default: bottom) |
| `notificationCompact` | boolean | Se `true` (default), notification inicia compacto (só header) e expande ao clicar |
| `targetScreens` | string[] | Rotas onde o promotional deve aparecer (ex: `["/settings", "/details"]`). Se omitido, aparece em qualquer tela |
| `nthImpression` | string | Expressão CSS nth-child para controlar em quais visitas aparece. Ex: `"1"` (só 1x), `"2n"` (a cada 2), `"1+2n"` (visitas 1,3,5...) |

### Uso no Código

Coloque `PromotionalContent` no `_layout.tsx` (root layout) e passe o pathname para `usePromotional`. O hook auto-triggera com base em `targetScreens`, `delayMs` e `nthImpression`:

```typescript
import { usePathname } from 'expo-router';
import PromotionalContent, { usePromotional } from 'expo-utils/utils/modal-promotional-content';

export default function RootLayout() {
    const pathname = usePathname();
    const { visible, hide } = usePromotional(pathname);

    return (
        <>
            <Stack />
            <PromotionalContent visible={visible} onClose={hide} />
        </>
    );
}
```

### Banner Inline

Para o tipo `banner`, use o componente `PromotionalBanner` — é uma View inline (não modal) que o dev posiciona onde quiser:

```typescript
import { PromotionalBanner } from 'expo-utils/utils/modal-promotional-content';

function MinhaScreen() {
    return (
        <View>
            {/* Aparece somente se type === "banner" e enabled === true */}
            <PromotionalBanner />

            {/* Com estilo customizado */}
            <PromotionalBanner style={{ marginHorizontal: 16, marginTop: 8 }} />

            {/* Modo large: card com imagem de fundo */}
            <PromotionalBanner size="large" height={250} />

            {/* Sem botão fechar */}
            <PromotionalBanner showClose={false} />
        </View>
    );
}
```

**Props do PromotionalBanner:**

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `size` | `"small" \| "large"` | `"small"` | Small = row compacta, Large = card com imagem |
| `showClose` | `boolean` | `true` | Mostrar/ocultar botão de fechar |
| `height` | `number` | `200` | Altura do banner no modo large |
| `colors` | `Partial<ModalColors>` | — | Cores customizadas |
| `style` | `ViewStyle` | — | Estilo adicional do container |
| `t` | `(key: string) => string` | — | Função de tradução |

### Customização de Cores

```typescript
<PromotionalContent
    visible={visible}
    onClose={hide}
    colors={{
        overlayBackground: "rgba(0,0,0,0.7)",
        modalBackground: "#1F2937",
        handleColor: "rgba(255,255,255,0.5)",
        titleText: "#FFFFFF",
        descriptionText: "#9CA3AF",
        primaryButtonText: "#FFFFFF",
        secondaryButtonText: "#9CA3AF",
    }}
/>
```

### Suporte a Internacionalização

Use a prop `t` para traduzir textos dinâmicos com o pattern `%{key}`:

```json
{
    "promotional": {
        "name": "%{app_name}",
        "description": "%{app_description}",
        "buttonText": "%{download_button}"
    }
}
```

```typescript
import { useTranslation } from 'sua-lib-i18n';

function MyScreen() {
    const { t } = useTranslation();
    const { visible, hide } = usePromotional();

    return (
        <PromotionalContent
            visible={visible}
            onClose={hide}
            t={t}
        />
    );
}
```

### Detalhes por Tipo

**bottom-sheet** (padrão):
- Modal com 65% da tela, slide-up com spring animation
- Swipe down para fechar, overlay escuro
- Gradiente com círculos decorativos ou imagem banner

**card-banner-bottom**:
- Card compacto no bottom da tela (~140px)
- Overlay leve (0.2), swipe down + botão X para fechar
- Layout horizontal: texto à esquerda, ícone à direita
- Gradient ou imagem como background do card
- Com `imageUrl`: overlay de gradiente para legibilidade, ícone em container branco elevado

**notification**:
- Card estilo notificação do iOS com duas seções
- Header branco: ícone pequeno + `notificationTitle` + `notificationBody` + "now"
- Body: imagem de fundo (terrazzo padrão ou `imageUrl`) + gradiente overlay + título + CTA + ícone grande
- `notificationCompact: true` (default) — inicia compacto (só header), expande ao clicar com spring animation
- `notificationCompact: false` — abre já expandido com header + body
- `position: "top"` — slide de cima para baixo, swipe up para fechar
- `position: "bottom"` — slide de baixo para cima, swipe down para fechar
- Safe area respeitada em ambas posições

**fullscreen**:
- Interstitial tela inteira com fade-in
- Timer countdown visível no canto superior direito
- Botão X aparece somente após `closeBtnDelayMs` com fade-in
- Sem `imageUrl`/`videoUrl`: gradient + ícone + texto + botões
- Com `imageUrl`: imagem full-screen, tap abre storeUrl, sem botões
- Com `videoUrl`: vídeo full-screen auto-play loop (requer `expo-av`), tap abre storeUrl. Se `expo-av` não instalado, fallback para `imageUrl`

**banner** (PromotionalBanner):
- View inline, não usa Modal
- `size="small"`: layout compacto horizontal: ícone + texto + botão CTA
- `size="large"`: card com imagem de fundo, título, descrição, CTA e ícone elevado
- Botão X para dismiss (configurável via `showClose`, salva no AsyncStorage se `showDontShowAgain`)
- Pressable inteiro abre `storeUrl`

### Características

- ✅ **5 tipos de exibição** - bottom-sheet, card, notification, fullscreen e banner inline
- ✅ **Swipe para fechar** - Arraste para baixo para dispensar (bottom-sheet e card)
- ✅ **Timer countdown** - Botão X aparece após timer no fullscreen
- ✅ **Animações suaves** - Spring animations nativas
- ✅ **Banner ou Gradiente** - Escolha entre imagem ou gradiente animado
- ✅ **"Não mostrar novamente"** - Persiste preferência no AsyncStorage
- ✅ **Safe Area** - Respeita insets do dispositivo
- ✅ **Cores customizáveis** - Todas as cores podem ser sobrescritas
- ✅ **Backward compatible** - `appmodal` e nomes antigos continuam funcionando
- ✅ **Auto-traduções** - 31 idiomas para textos de UI (botão CTA, "não mostrar", "agora", etc.). Textos do remote config têm prioridade; se não definidos, usa tradução automática baseada no locale do device
- ✅ **Fullscreen Video** - Suporte a vídeo fullscreen via `videoUrl` (requer `expo-av`)

---

## 🔁 Modal de Retenção (trial cancelado, falha de pagamento, vencido…)

Oferta para quem cancelou, teve falha de pagamento ou deixou a assinatura vencer, no mesmo formato da Retention
Messaging da App Store: imagem (ou o ícone do app), título, texto, bullets opcionais, a linha da data e os cartões de
oferta. Planos: `docs/PLANO-RETENCAO-TRIAL-CANCELADO.md` e `docs/PLANO-RETENCAO-OFERTAS.md`.

**Status (08/10/2026):** a interface de todos os segmentos e ofertas está pronta, e o `showRetention()` confere as
ofertas na loja, abre o modal e **compra de verdade** (desconto, vitalício, assinatura, assinar de novo, win-back) ou
abre o resgate do código. Ainda **não existe** a detecção que abre sozinha (volta ao primeiro plano, `max_shows`,
intervalo): em produção o modal só abre quando o app chama `showRetention()`.

- **Formato**, igual nas duas plataformas (`retention.style` no Remote Config ou `style` na chamada):
  `bottomsheet` = folha embaixo, da altura do conteúdo (toque fora, arrastar para baixo ou voltar fecham);
  `fullscreen` = folha da altura da tela, com o conteúdo no meio e os botões no rodapé (no iOS é a folha nativa
  `pageSheet`). Sem nada: `fullscreen` no iOS e `bottomsheet` no Android. Árabe da direita para a esquerda, só no modal.
- **Segmentos:** `trial_cancelled`, `cancelled`, `billing_issue` (ilustração de cartão com alerta), `expired`,
  `trial_expired` e `free`. Linha da data: fim do teste (`trial_cancelled`) ou do período pago (`cancelled`).
- **Ofertas:** a 1ª da lista é o botão principal (com o cartão dela acima, quando tem); a 2ª vira um cartão tocável
  abaixo do botão, com botão próprio; as outras são ignoradas. "Agora não" sempre embaixo.
- Depois de "Reativar"/"Atualizar pagamento", o modal mostra "Já reativei"/"Já atualizei", que confere de novo no RevenueCat.
- Compra: spinner no botão tocado e os outros desligados; comprou → fecha; cancelou → volta ao normal; pendente ou
  falhou → "Pagamento pendente…" / "Não deu para concluir a compra. Tente de novo." acima do botão, e o modal continua.
- Vitalício comprado com falha de pagamento: aviso "Cancele a assinatura antiga para não ser cobrado de novo", com o
  botão que abre as assinaturas da loja.
- Não precisa de linha nova no app: o `ExpoUtilsLayout`, o `AskForReviewOverlay` e o `PromotionalContent` já montam o
  modal. App sem nenhum desses três: `<RetentionModalSlot />` no `_layout`.

| Tipo (`type`) | Botão | Cartão |
| --- | --- | --- |
| `resubscribe` | Reativar (trial/assinatura cancelados) · Atualizar pagamento (`billing_issue`) · Assinar de novo (vencidos) | só nos vencidos: preço por período |
| `discount` / `winback` | Quero o desconto / Voltar com desconto | preço novo, riscado, selo −50%, "nos 3 primeiros meses", "depois R$ 19,90/mês" |
| `subscription` | Assinar | preço por período |
| `lifetime` | Comprar vitalício | "Pague uma vez, use para sempre", preço (riscado e selo com `compare_product_id`) |
| `offer_code` | Usar código | o código em fonte monoespaçada + "válido na loja" |

### Abrir com compra de verdade

```typescript
import {showRetention} from "expo-utils";

// Segmento do RevenueCat (rc_status) + a lista de ofertas do Remote Config para ele:
const {request, reason, skipped} = await showRetention();
// Ofertas do app (nomes de retention.offers, as embutidas, o próprio tipo ou objetos no formato do Remote Config):
await showRetention({offers: ["resubscribe", "lifetime"]});
// Teste: segmento forçado (abre mesmo com Premium) e produto anterior trocado
await showRetention({segment: "expired", offers: ["resubscribe", "lifetime"], productIdentifier: "monthly"});
// Formato só desta abertura (sem ele: retention.style do Remote Config e, sem esse, o padrão da plataforma)
await showRetention({style: "bottomsheet"});
```

- Não abre (`reason`): `disabled` (`retention.enabled: false`), `rc_unavailable`, `not_retention_segment` (pagante,
  trial normal…), `premium` (Premium ativo e segmento não forçado), `no_offers` (sem lista), `no_valid_offers` (a loja
  não tinha nenhuma; o motivo de cada uma em `skipped`), `error`. Nunca lança.
- Cada oferta é conferida na loja e para em 2 válidas; a que a loja não tem é pulada (evento
  `retention_offer_unavailable`) e vale a próxima. Preço sempre da loja. Regras por tipo (iOS × Android) na seção 14 do
  `docs/PLANO-RETENCAO-OFERTAS.md`.
- Também exportados: `resolveRetentionOffers`, `purchaseRetentionOffer`, `redeemRetentionCode`,
  `findRetentionPreviousProduct`. Eventos `retention_*`: `docs/ANALYTICS-EVENTS.md`.
- No `expo-utils-lab`: bloco "Retenção — compra de verdade (loja de teste)" e `expoutilslab://retencao?live=<cenário>`.

### Testar sem loja (pré-visualização)

```typescript
import {showRetentionPreview} from "expo-utils";

showRetentionPreview();                                         // trial cancelado, variante do Remote Config
showRetentionPreview({variant: "premium_kept", locale: "ar"});  // Premium até o fim, em árabe
showRetentionPreview({segment: "billing_issue", offers: ["resubscribe", "lifetime_deal"]});
showRetentionPreview({segment: "expired", offers: ["discount_50", {type: "lifetime", compare_product_id: "lifetime"}], locale: "en"});
showRetentionPreview({segment: "billing_issue", offers: ["resubscribe", "lifetime_deal"], state: "lifetime_notice"}); // aviso pós-compra
showRetentionPreview({style: "bottomsheet"});                   // bottom sheet também no iOS (fullscreen: a folha cheia no Android)
```

Dados falsos (R$ 19,90/mês; 50% por 3 meses = R$ 9,90; vitalício R$ 59,90 contra R$ 99,90; USD fora do português) e
nenhuma chamada ao RevenueCat: os botões só registram no log (`[expo-utils] retention preview: …`) e seguem o fluxo.
Ofertas por nome (`resubscribe`/`winback` embutidas, as de `retention.offers` do Remote Config, as de exemplo
`discount_50`/`lifetime_deal`/`promo_code` ou o próprio tipo) ou como objeto no formato do Remote Config. No menu de
dev: **Simular trial cancelado**. No `expo-utils-lab`: bloco "Retenção — casos" e `expoutilslab://retencao?case=<id>`.

### Remote Config (bloco `utils`, opcional)

Sem a chave `retention`, fica desligado. A lib não tem regra própria de "quem vê o quê": cada segmento mostra só a lista
dele, na ordem; segmento sem lista não vê nada. Nomes de campo em inglês.

```json
{
    "retention": {
        "enabled": true,
        "style": "bottomsheet",
        "segments": {
            "trial_cancelled": {"offers": ["discount_50", "resubscribe"], "max_shows": 2, "min_interval_hours": 12, "reminder_hours_before_end": 24},
            "billing_issue": {"offers": ["resubscribe", "lifetime_deal"], "max_shows": 3, "min_interval_hours": 24},
            "expired": {"offers": ["winback", "discount_50", "lifetime_deal"], "max_days_after_expiration": 60},
            "free": {"offers": ["lifetime_deal"], "after_paywall_dismissals": 3}
        },
        "offers": {
            "discount_50": {"type": "discount", "ios_offer_id": "retention_50", "android_offer_tag": "retention-50"},
            "lifetime_deal": {"type": "lifetime", "product_id": "lifetime_retention", "compare_product_id": "lifetime"},
            "promo_code": {"type": "offer_code", "ios_code": "COMEBACK50"}
        },
        "image_url": "https://…/retencao.png",
        "texts": {"pt": {"billing_issue.title": "…", "offers.lifetime_deal.cta": "…"}}
    }
}
```

- **Oferta sem `product_id`:** vale para a MESMA assinatura que a pessoa tinha. **Com `product_id`:** aquele produto.
  `subscription` = uma assinatura específica pelo preço normal. `resubscribe` e `winback` não precisam estar em `offers`.
- **Textos** (`texts.<língua>`): `<segmento>.title|body|bullets|date`, `offers.<nome>.cta|title|period|terms|badge|hint`,
  `notice.title|body|cta`, `purchase.error|pending` e `dismiss`. As chaves da fase 1 (`header`, `body`, `bullets`, `cta`) continuam valendo no
  `trial_cancelled`. Ordem: Remote Config na língua → lib na língua (12 línguas) → Remote Config `en` → lib `en`.
- **Variáveis:** `{app}`, `{price}`, `{original_price}`, `{discount}`, `{period}`, `{date}`, `{code}` e `{per}` ("/mês").
  Preço com `Intl.NumberFormat` na língua da pessoa.
- **Variante** (`trial_cancelled` e `cancelled`): `is_opted_out_trial_enabled: true` → "Você ainda tem o Premium até o
  fim…"; falso ou ausente → "Os anúncios voltaram".
- **Limites da Apple** (testados nas 12 línguas, com `{app}` de 20 caracteres e preços reais): título e cada bullet até
  66 caracteres, texto até 144.
- **`style`:** `bottomsheet` ou `fullscreen`, nas duas plataformas. Sem ele (ou com o `"sheet"` da fase 1), o padrão de
  cada uma: `fullscreen` no iOS, `bottomsheet` no Android. Os eventos `retention_*` do modal levam o `style`.
- O formato da fase 1 (`max_shows`, `reminder_hours`) continua aceito. As regras de exibição
  (`max_shows`, `min_interval_hours`…) só vão valer com a detecção automática; o `showRetention` não as lê.

---

## 🔌 Integrações Opcionais

### TikTok Ads SDK

Configuração no bloco `utils` do Firebase Remote Config:

```json
{
    "tiktokads": {
        "token": "seu_token",
        "appid": "seu_app_id",
        "tkappid": "seu_tiktok_app_id",
        "isdebug": false
    }
}
```

**Eventos rastreados automaticamente:**
- `launch_app` - A cada abertura do app
- `install_app` - Na primeira instalação

### HotUpdater (Updates OTA)

A URL do HotUpdater é configurada diretamente no `_layout.tsx` via `HotUpdater.wrap()`:

```typescript
export default HotUpdater.wrap({
    baseURL: "https://YOUR-WORKER.workers.dev/api/check-update",
    updateMode: "manual",
})(RootLayout);
```

O expo-utils verifica automaticamente por updates no `prepare()` e aplica se necessário.

### Trendings Tracker

Configuração no bloco `utils` do Firebase Remote Config:

```json
{
    "trends_tracking_url": "https://trendings.app/api"
}
```

Rastreia instalações automaticamente na primeira abertura do app. Se `trends_tracking_url` não estiver definido, usa o fallback `https://trendings.app/api`.

### Microsoft Clarity

Configuração no bloco `utils` do Firebase Remote Config:

```json
{
    "clarity_id": "seu_project_id"
}
```

## 🔧 Dependências e Compatibilidade

### Dependências Principais Incluídas

**🔥 Firebase (v24+/v25 API Modular + Remote Config dual-path)**

- `@react-native-firebase/app` - Core Firebase
- `@react-native-firebase/analytics` - Analytics e eventos
- `@react-native-firebase/auth` - Autenticação
- `@react-native-firebase/firestore` - Banco de dados
- `@react-native-firebase/messaging` - Push notifications
- `@react-native-firebase/remote-config` - Configurações remotas

**📱 Expo Utilities**

- `expo-application` - Informações do app
- `expo-insights` - Monitoramento de crashes
- `expo-store-review` - Solicitação de avaliações
- `expo-tracking-transparency` - Permissões de rastreamento iOS
- `expo-updates` - Atualizações OTA

**💰 Monetização**

- `react-native-google-mobile-ads` - Sistema de anúncios Google
- `react-native-purchases` - Compras in-app e assinaturas

**🔧 Utilitários**

- `@react-native-async-storage/async-storage` - Armazenamento local
- `react-native-fbsdk-next` - Facebook SDK
- `@microsoft/react-native-clarity` - Analytics Microsoft
- `react-native-edge-to-edge` - Layout edge-to-edge

### Sistema de Peer Dependencies

O `expo-utils` usa **peer dependencies** para não duplicar bibliotecas:

✅ **Sem Duplicação**: Usa as mesmas versões do seu projeto  
✅ **Imports Dinâmicos**: Carrega apenas quando necessário  
✅ **Fallbacks Seguros**: Funciona mesmo sem algumas dependências  
✅ **Bundle Otimizado**: Não adiciona peso desnecessário

### Resolvendo Erros TypeScript

Se aparecerem erros como `Cannot find module 'expo-splash-screen'`:

**Opção 1 - Instalar dependência (Recomendado):**

```bash
npm install expo-splash-screen
```

**Opção 2 - Usar tipos mock:**

```json
// tsconfig.json
{
    "compilerOptions": {
        "typeRoots": ["./node_modules/@types", "./node_modules/expo-utils/types"]
    }
}
```

## 📋 Configuração Avançada

### Configuração Completa appConfig

```javascript
const appConfig = {
    expo: {
        slug: "meu-app",
        android: {
            package: "com.meuapp.app",
        },
        ios: {
            bundleIdentifier: "com.meuapp.app",
        },
        plugins: [
            [
                "react-native-fbsdk-next",
                {
                    appID: "1234567890",
                    clientToken: "abc123...",
                    displayName: "Meu App",
                },
            ],
            [
                "react-native-purchases",
                {
                    androidApiKey: "goog_xxx",
                    iosApiKey: "appl_xxx",
                },
            ],
            [
                "react-native-google-mobile-ads",
                {
                    androidAppId: "ca-app-pub-xxx~xxx",
                    iosAppId: "ca-app-pub-xxx~xxx",
                },
            ],
            // Plugin expo-utils é opcional, apenas para configurações avançadas
            // ["expo-utils", { "disableWarnings": true }]
        ],
    },
};
```

### AppStrings e AdUnits

Os Unit IDs de anúncios e a chave RevenueCat são definidos **localmente** no projeto (não no Remote Config). Crie o arquivo `src/constants/Strings.ts`:

```typescript
import type {AppStrings} from "expo-utils";

const appStrings: AppStrings = {
    rckey: "appl_SuaChaveRevenueCatAqui", // ou "goog_xxx" para Android
    adUnits: {
        appOpen: "ca-app-pub-xxx/xxx",
        banner: "ca-app-pub-xxx/xxx",
        interstitial: "ca-app-pub-xxx/xxx",
        rewarded: "ca-app-pub-xxx/xxx",
    },
};

export default appStrings;
```

**Interfaces:**

```typescript
export interface AdUnits {
    appOpen?: string;
    banner?: string;
    interstitial?: string;
    rewarded?: string;
}

export interface AppStrings {
    rckey?: string;       // Chave RevenueCat (appl_ ou goog_)
    adUnits?: AdUnits;    // Unit IDs do AdMob
    [key: string]: any;   // Campos extras opcionais
}
```

Os `adUnits` são carregados automaticamente em `global.adUnits` pela função `prepare()`. O `rckey` é usado para configurar o RevenueCat e atribuições.

### Configurações Remotas Firebase (RemoteConfigUtilsType)

Estrutura do bloco `utils` no Remote Config, acessível via `global.remoteConfigUtils`:

```typescript
interface RemoteConfigUtilsType {
    is_ads_enabled: boolean;        // Master toggle de anúncios
    min_version: number;            // Versão mínima obrigatória
    ios_app_id: string;             // Fallback App ID iOS
    review_type?: string;           // "store-review" | "popup" | "dialog"
    review_type_delay?: number;     // ms até habilitar "Agora não" no popup
    review_show_delay?: number;     // ms antes do review aparecer (askForReview; override: showDelay)
    repeat_ads_count?: number;      // Ações antes de mostrar anúncio
    taichi_events?: string[];       // Ausente = 60 marcos; [] = sem emissões; lista = subconjunto
    ad_blocklist?: string[];        // Placement IDs bloqueados
    promotional?: PromotionalConfig; // Config de conteúdo promocional
    tiktokads?: { token: string; appid: string; tkappid: string; isdebug: boolean };
    clarity_id?: string;
    trends_tracking_url?: string;
}
```

## 🧪 TypeScript e Tipagem

### Interfaces Principais

```typescript
import type {
    AppConfig,
    AppStrings,
    AdUnits,
    RemoteConfigUtilsType,
    FacebookConfig,
    RevenueCatKeys,
    PromotionalType,
    PromotionalConfig,
} from 'expo-utils';

const myConfig: AppConfig = {
    expo: {
        slug: "meu-app",
        plugins: [...]
    }
};

const revenueCatKeys: RevenueCatKeys = {
    androidApiKey: "goog_xxx",
    iosApiKey: "appl_xxx"
};
```

### Declarações Globais Necessárias

```typescript
// No _layout.tsx de cada app
import type {RemoteConfigUtilsType} from "expo-utils/utils/types";

declare global {
    var remoteConfigUtils: RemoteConfigUtilsType;  // Tipado — configs do expo-utils (bloco "utils")
    var remoteConfigScreens: any;                  // Livre — configs de telas do app (bloco "screens")
    // global.remoteConfigs (os dois blocos juntos) já vem declarado pela lib
    var isAdsEnabled: boolean;
    var adUnits: any;
}
```

## 🎁 Recursos Incluídos

### Templates Prontos

- `_layout.tsx` - Layout principal com inicialização completa
- `index.tsx` - Tela inicial básica
- `Strings.ts` - Template de constantes do app (copiado para src/constants/)
- `AGENTS.md` - Instruções para agentes de IA (copiado para raiz do projeto)
- `CLAUDE.md` - Ponteiro `@AGENTS.md` para o Claude Code (copiado para raiz do projeto)
- `POLICY-CHECKS.md` - Regras de review que já derrubaram build, com app/versão/data da rejeição (copiado para `.claude/` do projeto e **ressincronizado** a cada install; a REGRA 6 do `AGENTS.md` manda ler antes de todo build de submissão)
- `google-services.json` - Placeholder Firebase Android
- `GoogleService-Info.plist` - Placeholder Firebase iOS
- `babel.config.js` - Config com Hot Updater plugin

### Configurações Automáticas

- `eas.json` - Configuração básica EAS Build
- `app.json` - Plugins pré-configurados
- `experiments.buildCacheProvider` - EAS Build cache
- **`extra.eas.projectId` NÃO é preenchido** — é por-projeto no EAS; um valor fixo faria um app novo apontar pro projeto EAS de outro app. Rode `eas init` (ou o primeiro `eas build`) pra linkar o app a um projeto real.
- `eas-build-cache-provider` - Adicionado às devDependencies
- `.easignore` - Ignora ios/, android/, bun.lock, etc.
- `.gitignore` - Atualizado com ios/, android/, bun.lock
- SKAdNetwork IDs - Lista completa para iOS
- Permissões - Rastreamento e notificações
- Hot Updater - babel.config.js, .env, .env.hotupdater
- Remove bloco `updates` do app.json (não necessário com Hot Updater)

### Utilitários de Desenvolvimento

- Sistema de warnings configurável
- Imports dinâmicos com fallbacks
- Verificação de dependências automática
- Estrutura de projeto organizada

## 🚨 Suporte a Warnings e Logs

Para suprimir warnings e/ou logs do expo-utils, adicione a configuração no seu `app.json` (opcional):

```json
// app.json
{
    "expo": {
        "plugins": [
            [
                "expo-utils",
                {
                    "disableWarnings": true, // Suprime warnings
                    "disableLogs": true, // Suprime console.log (opcional)
                    "firebaseLogLevel": "error", // Cala o log nativo do Firebase iOS (opcional)
                    "analyticsAdSupport": false, // Desliga IDFA/AdSupport no Analytics iOS (default: true)
                    "analyticsOnDeviceConversion": false // Desliga on-device conversion (default: true)
                }
            ]
        ]
    }
}
```

**Configurações disponíveis:**

- `disableWarnings: true` - Suprime todos os warnings (`console.warn`) do expo-utils (runtime)
- `disableLogs: true` - Suprime todos os console.log do expo-utils (útil em produção, runtime)
- `firebaseLogLevel: "error"` - **Opt-in.** Cala o log **nativo** do Firebase SDK no iOS (ex.: `[FirebaseAnalytics][I-ACS...]`). No **prebuild** o plugin gera/mergeia `react-native.app_log_level` num `firebase.json` na raiz do projeto — você **não precisa criar esse arquivo na mão**. Valores: `"error" | "warn" | "info" | "debug"` (ou `true` = `"error"`). Preserva outras chaves do `firebase.json` e não sobrescreve um `app_log_level` definido manualmente. _Não_ silencia os logs `RNFB...[Line N]` (esses são debug-only e somem em release).
- `analyticsAdSupport` - **Ligado por padrão** (apps ads-first). No **prebuild** injeta `$RNFirebaseAnalyticsEnableAdSupport = true` no `Podfile` iOS → linka `AdSupport.framework`, dando ao Firebase Analytics acesso ao IDFA (demografia/interesses no iOS, como no Android). ⚠️ Coleta IDFA em **produção**: precisa de ATT (expo-utils já pede) + IDFA declarado no privacy manifest/App Store. Inócuo em apps com AdMob (IDFA já coletado). **Desligue num app sem ads** com `"analyticsAdSupport": false`. Precisa `prebuild --clean` + rebuild.
- `analyticsOnDeviceConversion` - **Ligado por padrão.** No **prebuild** injeta `$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion = true` no `Podfile` iOS → adiciona o pod `GoogleAdsOnDeviceConversion` (resolve o log `[FirebaseAnalytics] Failed to initiate on-device conversion measurement... dependency does not support this feature`). Desligue com `"analyticsOnDeviceConversion": false`. _Obs.:_ feito via Podfile (não via config plugin do `@react-native-firebase/analytics`, que **não existe na v24** e quebraria o prebuild). Precisa `prebuild --clean` + rebuild.
- `mediation` - **Ligado por padrão com 4 redes**: **AppLovin, Meta Audience Network, Unity Ads e Pangle**. O catálogo tem outras 5 disponíveis que **só entram se você pedir pelo nome** — `liftoff` (alias `vungle`), `mintegral`, `bidmachine` (alias `appodeal`), `moloco` e `bigo` —, para o build não engordar sozinho quando o catálogo crescer. No **prebuild** injeta os adapters no `android/app/build.gradle`, os repositórios Maven de Mintegral/Pangle no `android/build.gradle` e os pods no `ios/Podfile` — nada de mexer em Podfile/Gradle na mão nem plugin local no app. As versões vêm de `data/mediation_adapters.json` e são **pinadas** (o pod do Pangle 8.2.0.7+ exige `Google-Mobile-Ads-SDK ~> 13.6` e quebraria o `pod install` com o 13.5.0 do RNGMA 16.4.0). Desligue com `"mediation": false`, escolha as redes com `"mediation": ["applovin", "meta"]` ou troque versão com `"mediation": {"applovin": "13.6.3.0"}` (string vale pras duas plataformas; use `{"ios": "…", "android": "…"}` pra separar).

**SDK da rede vem junto:** no Android quase todo adapter declara o SDK da rede no POM — **menos o da Unity** ("This build does not contain the UnityAds SDK"): sem o SDK o app vai só com o adapter e a Unity fica com **0% de match** no bidding (visto num APK de produção em 06/10/2026). Desde 07/10/2026 o catálogo acrescenta `implementation("com.unity3d.ads:unity-ads:4.19.0")` logo após o adapter (`android.extraArtifacts` em `data/mediation_adapters.json`; versão = a do "built and tested with" do adapter 4.19.0.0). Trocar a versão do adapter da Unity troca a do SDK junto (`4.20.1.0` → `4.20.1`). App que já declarava o SDK numa chave própria (ex.: `"unity-sdk": {"android": {"artifact": "com.unity3d.ads:unity-ads", "version": "4.19.0"}}`) pode tirar a chave — se ficar, sai **uma** linha só e a versão do app.json vence a do catálogo. No iOS todo pod já puxa o SDK pelo CocoaPods. Conferir de novo ao subir versão: `node scripts/check-mediation-poms.js` (lê os POMs no Google Maven e os podspecs no CocoaPods; não roda nos testes).

**Rede fora do catálogo:** defina inteira no `app.json` — não precisa mexer na lib. Vale para qualquer ad source do AdMob, e definição só de uma plataforma é aceita (injeta só nela):

```jsonc
["expo-utils", {
  "mediation": {
    "applovin": "13.6.3.0",                                  // do catálogo
    "moloco": {                                              // rede nova
      "android": {"artifact": "com.google.ads.mediation:moloco", "version": "4.11.0.0"},
      "ios": {"pod": "GoogleMobileAdsMediationMoloco", "version": "4.9.0.0"}
    },
    "mintegral_privado": {                                   // com repositório próprio
      "android": {"artifact": "com.exemplo:adapter", "version": "1.0.0", "mavenRepo": "https://repo.exemplo.com/maven"}
    }
  }
}]
```

Antes de fixar a versão do **pod**, confira a restrição `Google-Mobile-Ads-SDK ~> X` dele: o RNGMA 16.4.0 traz o **13.5.0**, então precisa ser um adapter da família `~> 13.3`/`~> 13.5` — foi assim que o Pangle 8.2.0.7+ (que exige `~> 13.6`) derrubaria o `pod install`. Requer `react-native-google-mobile-ads >= 16.4.0` e `prebuild --clean` + rebuild. No Android o plugin também exclui automaticamente a cópia do TikTok Business SDK que o Pangle embute quando o app tem `expo-tiktok-ads-events` (senão o build morre em `checkReleaseDuplicateClasses`). ⚠️ **Adapter no build não serve ad sozinho**: cada rede precisa de conta própria + grupo de mediação configurado na UI do AdMob; sem isso só pesa o build. **Custo medido** em app real (APK release universal): 127,5 MB sem mediation → 140,5 MB com 6 redes → 148,8 MB com 9. As 4 do default ficam em torno de **+9 MB**.
- `firebaseDisableSPM` - **Ligado por padrão.** Injeta `$RNFirebaseDisableSPM = true` no `Podfile`. Do RNFirebase **v25+** o Firebase iOS vem por Swift Package, e com `useFrameworks: "static"` (que o CLI configura) o `pod install` **aborta**: _"[react-native-firebase] SPM + static linkage is not supported"_. Só desligue (`"firebaseDisableSPM": false`) se o app for para `useFrameworks: "dynamic"`.
- `umpDebugGeography` / `umpTestDeviceIds` - **Opt-in, só para QA.** Força o formulário de consentimento do UMP a aparecer fora da Europa: `"umpDebugGeography": "EEA"` (ou `"REGULATED_US_STATE"`, `"OTHER"`, `"DISABLED"`) + `"umpTestDeviceIds": ["<id do device no log do SDK>"]`. Em produção deixe fora do app.json.
- `usageDescriptions` - **Ligado por padrão.** No **prebuild** injeta no `Info.plist` as purpose strings de privacidade que SDKs comuns exigem (`expo-image`/`expo-video`/`expo-file-system` e o `FBSDKShareKit` referenciam a galeria) — resolve o **ITMS-90683** ("Missing purpose string") na submissão à App Store. Adiciona `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` e `NSCameraUsageDescription` **só se você ainda não definiu** (preserva o que está no `app.json` `ios.infoPlist`). Texto base em **inglês**; a tradução por idioma vem do `--languages` (via `expo.locales` → `InfoPlist.strings`). Desligue tudo com `"usageDescriptions": false`, ou por chave: `"usageDescriptions": { "NSCameraUsageDescription": false }` (ou passe uma string pra trocar o texto). **Android não tem equivalente** — o ITMS-90683 é só do iOS.

**Nota**: O plugin expo-utils é completamente opcional. O projeto funciona normalmente sem ele.

## ⚠️ Notas Importantes sobre iOS

### Ordem de Permissões

O iOS tem um comportamento específico com diálogos de permissão que pode causar problemas:

1. **Diálogos são exibidos "out of process"** - fora do processo do app
2. **Quando um diálogo aparece, o app entra em estado `inactive`**
3. **ATT (App Tracking Transparency) REQUER estado `active`**

Se você chamar múltiplas permissões em sequência rápida, o diálogo ATT pode:
- Não aparecer (iOS 15)
- Retornar `not-determined` silenciosamente
- Se sobrepor com outros diálogos

**Solução aplicada no expo-utils:**
- As permissões são chamadas em sequência com tratamento adequado
- Use `requestPermissions: false` se quiser controlar o timing manualmente

### Ordem de Inicialização de SDKs

O Facebook SDK **DEVE** ser inicializado antes do RevenueCat para que `getAnonymousID()` funcione corretamente. O expo-utils já gerencia essa ordem automaticamente.

## 🔄 Compatibilidade Firebase v24+ / v25

Compatível com a **API modular** do React Native Firebase v24+ e com a API de instância do **v25** (Remote Config sem `setConfigSettings`/`setDefaults` modulares):

✅ Não usa métodos deprecated  
✅ Imports modulares otimizados  
✅ Inicialização moderna  
✅ Sem warnings de compatibilidade

```typescript
// Exemplo de uso moderno automático
import {getAnalytics, logEvent} from "@react-native-firebase/analytics";
import {getRemoteConfig, fetchAndActivate} from "@react-native-firebase/remote-config";

// Tudo já configurado automaticamente pelo Utils.prepare()
```

## 📖 Exemplos de Uso Completo

### Projeto Básico com Anúncios

```typescript
// _layout.tsx
import Utils from 'expo-utils/utils/Utils';
import appStrings from '../constants/Strings';
import appConfig from '../../app.json';

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, appStrings);
    }, []);

    return appIsReady ? <Stack /> : null;
}

// Qualquer tela
import LoadAdsManager from 'expo-utils/utils/LoadAdsManager';
import BannerAdComponent from 'expo-utils/utils/banner-ad';

function MinhaScreen() {
    const showAd = async () => {
        await LoadAdsManager.showInterstitial();
    };

    return (
        <View>
            <Button onPress={showAd} title="Mostrar Anúncio" />
            <BannerAdComponent />
        </View>
    );
}
```

### Projeto com Monetização Completa

```typescript
// src/constants/Strings.ts
import type {AppStrings} from "expo-utils";

const appStrings: AppStrings = {
    rckey: "appl_SuaChaveRevenueCatAqui",
    adUnits: {
        appOpen: "ca-app-pub-xxx/xxx",
        banner: "ca-app-pub-xxx/xxx",
        interstitial: "ca-app-pub-xxx/xxx",
        rewarded: "ca-app-pub-xxx/xxx",
    },
};
export default appStrings;

// _layout.tsx
import appStrings from "../constants/Strings";

useEffect(() => {
    global.isAdsEnabled = !__DEV__;
    Utils.prepare(setAppIsReady, appConfig, appStrings);
}, []);

// Verificação de premium
import AsyncStorage from "@react-native-async-storage/async-storage";

const checkPremium = async () => {
    const isPremium = await AsyncStorage.getItem("@isPremium");
    if (isPremium === "true") {
        // Usuário é premium - não mostrar anúncios
    }
};
```

### Uso das Traduções

```typescript
import { getLocalizedMessages } from 'expo-utils';

function UpdateScreen() {
    const messages = getLocalizedMessages();

    return (
        <View>
            <Text>{messages.updateRequired}</Text>
            <Text>{messages.updateMessage}</Text>
            <Button title={messages.updateNow} />
        </View>
    );
}
```

### Abertura de Tela de Avaliação

```typescript
import Utils from "expo-utils/utils/Utils";

// Uso simples - detecta tudo automaticamente
await Utils.openReviewURL();

// Forçar abertura no browser
await Utils.openReviewURL(false);
```

## 🤝 Contribuição

Este projeto é mantido pela [Pixel Logic Apps](https://github.com/Pixel-Logic-Apps). Contribuições são bem-vindas!

## 📄 Licença

ISC License - veja o arquivo LICENSE para detalhes.

---

**💡 Dica**: Execute `npx expo-utils-install --new` em um projeto novo para ver toda a magia acontecer!
