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
✅ **Compatibilidade Moderna**: Firebase v22+ com API modular

## 📦 Instalação Rápida

### Novo Projeto (Recomendado)

```bash
# 1. Criar projeto Expo
npx create-expo-app@latest MeuApp
cd MeuApp

# 2. Instalar expo-utils
npm install github:Pixel-Logic-Apps/expo-utils

# 3. Configurar tudo automaticamente
npx expo-utils-install --new
```

### Configurar Firebase Remote Config

Após criar seu projeto no Firebase Console, vá em **Remote Config** e adicione duas keys:

**Key `utils`** — configurações do expo-utils (tipado como `RemoteConfigSettings`):

```json
{
  "is_ads_enabled": true,
  "min_version": 0,
  "ios_app_id": "",
  "review_type": "popup",
  "review_type_delay": 0,
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

**Key `screens`** — configurações de telas do app (tipo `any`, estrutura livre):

```json
{
  "home": {
    "banner_url": "https://...",
    "show_carousel": true
  },
  "onboarding": {
    "enabled": true,
    "steps": 3
  }
}
```

> A key `screens` é opcional. Sua estrutura é livre e acessada via `global.remoteConfigScreens`.

**Descrição dos campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `is_ads_enabled` | boolean | Habilita/desabilita anúncios globalmente |
| `min_version` | number | Versão mínima obrigatória (ex: 100 = 1.0.0) |
| `ios_app_id` | string | App ID do iOS (fallback se busca automática falhar) |
| `review_type` | string | Modo de review: `"store-review"`, `"popup"` ou `"dialog"` |
| `review_type_delay` | number | Segundos antes de habilitar botão "Agora não" no popup de review |
| `repeat_ads_count` | number | Quantidade de ações antes de mostrar anúncio |
| `ad_blocklist` | string[] | Lista de placement IDs bloqueados |
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

**Executa configuração completa para novos projetos** (com confirmação para mudanças destrutivas)

### Comandos Individuais

| Comando                   | Descrição                                       |
| ------------------------- | ----------------------------------------------- |
| `npx expo-utils-install`  | Instala apenas dependências faltantes           |
| `--config`                | Adiciona plugins AdMob e Facebook ao app.json   |
| `--firebase-placeholders` | Cria arquivos Firebase placeholder              |
| `--layout`                | Substitui \_layout.tsx por template configurado |
| `--srcapp`                | Move pasta app para src/app                     |
| `--languages`             | Cria pasta languages com traduções              |
| `--skadnetwork`           | Adiciona SKAdNetworkItems para iOS              |
| `--constants`             | Cria pasta constants                            |
| `--eas-config`            | Configura eas.json básico                       |
| `--tracking-permission`   | Adiciona permissão de rastreamento iOS          |

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
import AppStrings from "../constants/Strings";
import {HotUpdater} from "@hot-updater/react-native";
import type {RemoteConfigSettings} from "expo-utils/utils/types";

declare global {
    var RemoteConfigUtils: RemoteConfigSettings;
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
        Utils.prepare(setAppIsReady, appConfig, AppStrings).then(() => {
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
                delay={global.RemoteConfigUtils?.review_type_delay || 0}
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
    strings,              // AppStrings com rckey e adUnits (opcional)
    requestPermissions    // Solicitar permissões ATT/Push no início (default: true)
);
```

**Parâmetros:**

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `setAppIsReady` | `(ready: boolean) => void` | - | Callback chamado quando inicialização termina |
| `appConfig` | `any` | `undefined` | Configuração do app.json |
| `strings` | `AppStrings` | `undefined` | Objeto com `rckey` (chave RevenueCat) e `adUnits` (unit IDs do AdMob) |
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
✅ Configura atribuições (IDFA, FCM Token, Firebase App Instance)
✅ Gerencia tópicos FCM baseado no status do usuário
✅ Configura push notifications e inscreve em tópicos
✅ Rastreia entrega de push via custom analytics events (`push_received`, `push_received_bg`)
✅ Habilita export de métricas de entrega para BigQuery (Android)

## 📊 Push Notification Delivery Tracking

O expo-utils rastreia automaticamente a entrega de push notifications via Firebase Analytics custom events. Isso resolve a limitação do Firebase Console que mostra "Recebidas: 0" em apps cross-platform.

### Eventos Rastreados

| Evento | Quando dispara | Plataforma |
|--------|---------------|------------|
| `push_received` | App em foreground recebe notificação | iOS + Android |
| `push_received_bg` | App em background/fechado recebe notificação | Android (iOS apenas data-only) |

### Onde Visualizar

Os eventos aparecem em **Firebase Console > Analytics > Events**, não na tela de "Mensagens" do FCM.

### Parâmetros dos Eventos

**`push_received` (foreground):**
- `message_id` — ID único da mensagem FCM
- `topic` — Tópico FCM de origem
- `title` — Título da notificação (max 100 chars)

**`push_received_bg` (background):**
- `message_id` — ID único da mensagem FCM

### BigQuery Export

O expo-utils habilita automaticamente `experimentalSetDeliveryMetricsExportedToBigQueryEnabled` para exportar métricas detalhadas de entrega para o BigQuery (requer configuração no Firebase Console).

### Limitações Conhecidas

- **iOS**: "Recebidas" e "Impressões" no Firebase Console são métricas exclusivas do Android — a Apple não permite esse tipo de tracking
- **iOS background**: `setBackgroundMessageHandler` no iOS funciona apenas para data-only messages (sem `notification` payload)
- **Firebase Console > Mensagens**: As métricas nativas "Recebidas"/"Impressões" dependem de Google Analytics estar vinculado ao projeto Firebase + `google-services.json` correto nos apps Android

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

**Usuários Premium** (via AsyncStorage):

```typescript
// Marcar como premium (anúncios não aparecem)
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

### Tópicos Baseados no Status do Usuário

O expo-utils gerencia automaticamente a inscrição em tópicos FCM baseado no status de assinatura do usuário:

```typescript
// Formato do tópico: {slug}-purchase-{status}
// Exemplos:
// meu-app-purchase-free
// meu-app-purchase-active
// meu-app-purchase-trial
// meu-app-purchase-expired
```

### Status Disponíveis

| Status | Descrição |
|--------|-----------|
| `trial` | Usuário em período de trial |
| `intro` | Usuário em período introdutório |
| `billing_issue` | Problema de cobrança detectado |
| `cancelled` | Cancelou mas ainda está ativo |
| `active` | Assinatura ativa normal |
| `refunded` | Usuário foi reembolsado |
| `expired` | Assinatura expirada |
| `free` | Nunca comprou nada |

### Uso Manual

```typescript
import Utils from "expo-utils/utils/Utils";

// Atualizar tópico manualmente (rckey = chave RevenueCat)
await Utils.updateMessagingTopic(appConfig, rckey);

// Obter status do usuário
const customerInfo = await Purchases.getCustomerInfo();
const status = Utils.getRevenueCatStatus(customerInfo);
console.log(status); // "active", "free", "trial", etc.
```

### Segmentação de Push Notifications

Use os tópicos para enviar notificações segmentadas:

```javascript
// Firebase Admin SDK (servidor)
admin.messaging().sendToTopic('meu-app-purchase-free', {
    notification: {
        title: 'Oferta Especial!',
        body: 'Assine agora com 50% de desconto!'
    }
});

admin.messaging().sendToTopic('meu-app-purchase-billing_issue', {
    notification: {
        title: 'Problema com pagamento',
        body: 'Atualize seus dados de pagamento para continuar.'
    }
});
```

## ⭐ Sistema de Avaliações

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

## 🎁 Conteúdo Promocional

O expo-utils inclui um sistema completo de conteúdo promocional para promover outros apps ou conteúdos. Suporta 5 tipos de exibição, todos configuráveis via key `utils` do Firebase Remote Config.

### Tipos de Exibição

| Tipo | Componente | Descrição |
|------|-----------|-----------|
| `bottom-sheet` | `PromotionalContent` | Modal 65% da tela, slide-up, drag-to-dismiss |
| `card-banner-bottom` | `PromotionalContent` | Card compacto no bottom, swipe + X para fechar |
| `notification` | `PromotionalContent` | Card estilo notificação iOS, slide top/bottom, swipe-to-dismiss |
| `fullscreen` | `PromotionalContent` | Interstitial tela inteira com timer countdown |
| `banner` | `PromotionalBanner` | View inline (não é modal), dev coloca onde quiser |

### Configuração no Remote Config (key `utils`)

O objeto `promotional` fica dentro da key `utils` do Firebase Remote Config:

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
        "bannerImg": "https://exemplo.com/banner.png",
        "bannerVideo": "https://exemplo.com/promo.mp4",
        "bannerHeight": 200,
        "showDontShowAgain": true,
        "timerSeconds": 5,
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
| `bannerImg` | string | URL de imagem banner (substitui o gradiente) |
| `bannerVideo` | string | URL de vídeo para fullscreen (requer `expo-av`). Prioridade sobre `bannerImg` |
| `bannerHeight` | number | Altura do banner em pixels (default: 200) |
| `showDontShowAgain` | boolean | Mostrar botão "Não mostrar novamente" |
| `timerSeconds` | number | Segundos antes do botão X aparecer no fullscreen (default: 5) |
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
- Com `bannerImg`: overlay de gradiente para legibilidade, ícone em container branco elevado

**notification**:
- Card estilo notificação do iOS com duas seções
- Header branco: ícone pequeno + `notificationTitle` + `notificationBody` + "now"
- Body: imagem de fundo (terrazzo padrão ou `bannerImg`) + gradiente overlay + título + CTA + ícone grande
- `notificationCompact: true` (default) — inicia compacto (só header), expande ao clicar com spring animation
- `notificationCompact: false` — abre já expandido com header + body
- `position: "top"` — slide de cima para baixo, swipe up para fechar
- `position: "bottom"` — slide de baixo para cima, swipe down para fechar
- Safe area respeitada em ambas posições

**fullscreen**:
- Interstitial tela inteira com fade-in
- Timer countdown visível no canto superior direito
- Botão X aparece somente após `timerSeconds` com fade-in
- Sem `bannerImg`/`bannerVideo`: gradient + ícone + texto + botões
- Com `bannerImg`: imagem full-screen, tap abre storeUrl, sem botões
- Com `bannerVideo`: vídeo full-screen auto-play loop (requer `expo-av`), tap abre storeUrl. Se `expo-av` não instalado, fallback para `bannerImg`

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
- ✅ **Fullscreen Video** - Suporte a vídeo fullscreen via `bannerVideo` (requer `expo-av`)

---

## 🔌 Integrações Opcionais

### TikTok Ads SDK

Configuração na key `utils` do Firebase Remote Config:

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

Configuração na key `utils` do Firebase Remote Config:

```json
{
    "trends_tracking_url": "https://trendings.app/api"
}
```

Rastreia instalações automaticamente na primeira abertura do app. Se `trends_tracking_url` não estiver definido, usa o fallback `https://trendings.app/api`.

### Microsoft Clarity

Configuração na key `utils` do Firebase Remote Config:

```json
{
    "clarity_id": "seu_project_id"
}
```

## 🔧 Dependências e Compatibilidade

### Dependências Principais Incluídas

**🔥 Firebase (v22+ API Modular)**

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

const AppStrings: AppStrings = {
    rckey: "appl_SuaChaveRevenueCatAqui", // ou "goog_xxx" para Android
    adUnits: {
        appOpen: "ca-app-pub-xxx/xxx",
        banner: "ca-app-pub-xxx/xxx",
        interstitial: "ca-app-pub-xxx/xxx",
        rewarded: "ca-app-pub-xxx/xxx",
    },
};

export default AppStrings;
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

### Configurações Remotas Firebase (RemoteConfigSettings)

Estrutura da key `utils` no Remote Config, acessível via `global.RemoteConfigUtils`:

```typescript
interface RemoteConfigSettings {
    is_ads_enabled: boolean;        // Master toggle de anúncios
    min_version: number;            // Versão mínima obrigatória
    ios_app_id: string;             // Fallback App ID iOS
    review_type?: string;           // "store-review" | "popup" | "dialog"
    review_type_delay?: number;     // Delay do botão "Agora não" no review
    repeat_ads_count?: number;      // Ações antes de mostrar anúncio
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
    RemoteConfigSettings,
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
import type {RemoteConfigSettings} from "expo-utils/utils/types";

declare global {
    var RemoteConfigUtils: RemoteConfigSettings;  // Tipado — configs do expo-utils (key "utils")
    var remoteConfigScreens: any;                  // Livre — configs de telas do app (key "screens")
    var isAdsEnabled: boolean;
    var adUnits: any;
}
```

## 🎁 Recursos Incluídos

### Templates Prontos

- `_layout.tsx` - Layout principal com inicialização completa
- `index.tsx` - Tela inicial básica
- `google-services.json` - Placeholder Firebase Android
- `GoogleService-Info.plist` - Placeholder Firebase iOS
- `eas_login.sh` - Script de login EAS

### Configurações Automáticas

- `eas.json` - Configuração básica EAS Build
- `app.json` - Plugins pré-configurados
- SKAdNetwork IDs - Lista completa para iOS
- Permissões - Rastreamento e notificações

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
                    "disableLogs": true // Suprime console.log (opcional)
                }
            ]
        ]
    }
}
```

**Configurações disponíveis:**

- `disableWarnings: true` - Suprime todos os warnings do expo-utils
- `disableLogs: true` - Suprime todos os console.log do expo-utils (útil em produção)

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

## 🔄 Compatibilidade Firebase v22+

Totalmente compatível com a **API modular** do React Native Firebase v22+:

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
import AppStrings from '../constants/Strings';
import appConfig from '../../app.json';

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, AppStrings);
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

const AppStrings: AppStrings = {
    rckey: "appl_SuaChaveRevenueCatAqui",
    adUnits: {
        appOpen: "ca-app-pub-xxx/xxx",
        banner: "ca-app-pub-xxx/xxx",
        interstitial: "ca-app-pub-xxx/xxx",
        rewarded: "ca-app-pub-xxx/xxx",
    },
};
export default AppStrings;

// _layout.tsx
import AppStrings from "../constants/Strings";

useEffect(() => {
    global.isAdsEnabled = !__DEV__;
    Utils.prepare(setAppIsReady, appConfig, AppStrings);
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
