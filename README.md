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

### 4. Configurar Firebase Remote Config

Após criar seu projeto no Firebase Console, vá em **Remote Config** e adicione o seguinte JSON como template:

```json
{
  "is_ads_enabled": true,
  "rckey": "appl_SuaChaveRevenueCatAqui",
  "hotupdater_url": "",
  "trends_tracking_url": "",
  "adunits": {
    "ios": {
      "appOpen": "ca-app-pub-xxx/xxx",
      "banner": "ca-app-pub-xxx/xxx",
      "interstitial": "ca-app-pub-xxx/xxx",
      "rewarded": "ca-app-pub-xxx/xxx"
    },
    "android": {
      "appOpen": "ca-app-pub-xxx/xxx",
      "banner": "ca-app-pub-xxx/xxx",
      "interstitial": "ca-app-pub-xxx/xxx",
      "rewarded": "ca-app-pub-xxx/xxx"
    }
  },
  "tiktokads": {
    "token": "",
    "appid": "",
    "tkappid": "",
    "isdebug": false
  },
  "clarity_id": "",
  "min_version": 0,
  "review_mode": 0,
  "repeat_ads_count": 3,
  "delay_close_paywall_button": 5,
  "ios_app_id": "",
  "is_paywall_disabled": false
}
```

**Descrição dos campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `is_ads_enabled` | boolean | Habilita/desabilita anúncios globalmente |
| `rckey` | string | Chave do RevenueCat (começa com `appl_` ou `goog_`) |
| `hotupdater_url` | string | URL do servidor HotUpdater para updates OTA |
| `trends_tracking_url` | string | URL do Trendings Tracker para rastreamento |
| `adunits` | object | Unit IDs do AdMob por plataforma |
| `tiktokads` | object | Configurações do TikTok Ads SDK |
| `clarity_id` | string | Project ID do Microsoft Clarity |
| `min_version` | number | Versão mínima obrigatória (ex: 100 = 1.0.0) |
| `min_version_force` | boolean | Se true, força atualização bloqueando o app |
| `review_mode` | number | Modo de review (0 = normal) |
| `repeat_ads_count` | number | Quantidade de ações antes de mostrar anúncio |
| `delay_close_paywall_button` | number | Segundos antes de mostrar botão de fechar paywall |
| `ios_app_id` | string | App ID do iOS (fallback se busca automática falhar) |
| `is_paywall_disabled` | boolean | Desabilita paywall globalmente |

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
| `--constants`             | Cria pasta constants e copia Strings.ts         |
| `--eas-config`            | Configura eas.json básico                       |
| `--tracking-permission`   | Adiciona permissão de rastreamento iOS          |

## 📱 Configuração do Projeto

### 1. Template \_layout.tsx

O `expo-utils` fornece um template completo para `_layout.tsx`:

```typescript
import { Stack } from "expo-router";
import Utils from "expo-utils/utils/Utils";
import React, { useEffect, useState } from "react";
import appConfig from "../../app.json";
import adUnits from "@/constants/Strings";

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
    var adUnits: any;
}

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, adUnits).then();
    }, []);

    if (!appIsReady) {
        return null; // ou splash screen
    }

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
    );
}
```

### 2. Função Utils.prepare()

A função principal que inicializa tudo automaticamente:

```typescript
Utils.prepare(
    setAppIsReady,        // Callback quando app estiver pronto
    appConfig,            // Configuração do app (opcional)
    requestPermissions    // Solicitar permissões ATT/Push no início (default: true)
);
```

**Parâmetros:**

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `setAppIsReady` | `(ready: boolean) => void` | - | Callback chamado quando inicialização termina |
| `appConfig` | `any` | `undefined` | Configuração do app.json |
| `requestPermissions` | `boolean` | `true` | Se deve solicitar permissões ATT e Push no início |

**Exemplo sem solicitar permissões no início:**
```typescript
// Útil quando você quer controlar quando mostrar os diálogos
Utils.prepare(setAppIsReady, appConfig, false);
```

**O que a função prepare() faz automaticamente:**

✅ Solicita permissões de rastreamento iOS (ATT)
✅ Solicita permissão de Push Notifications
✅ Carrega configurações remotas do Firebase
✅ Verifica e aplica atualizações OTA (HotUpdater)
✅ Valida versão mínima obrigatória
✅ Configura RevenueCat com chave do Remote Config
✅ Inicializa Facebook SDK
✅ Inicializa TikTok Ads SDK
✅ Configura Microsoft Clarity analytics
✅ Configura atribuições (IDFA, FCM Token, Firebase App Instance)
✅ Gerencia tópicos FCM baseado no status do usuário
✅ Configura push notifications e inscreve em tópicos

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

// Banner fixo na tela (com estilo footer automático)
<BannerAdComponent />
<BannerAdComponent unitId="ca-app-pub-xxx/xxx" />

// Banner sem estilo footer
<BannerAdComponent useFooterStyle={false} />
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

- Usa unit IDs do `constants/Strings.ts` como padrão
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

### BannerAdComponent com Estilos

O componente de banner agora aceita o parâmetro `useFooterStyle`:

```typescript
// Com estilo footer (padrão)
<BannerAdComponent />

// Sem estilo footer (você controla o posicionamento)
<BannerAdComponent useFooterStyle={false} />

// Com unit ID customizado e estilo footer
<BannerAdComponent unitId="ca-app-pub-xxx/xxx" useFooterStyle={true} />
```

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

// Atualizar tópico manualmente
await Utils.updateMessagingTopic(appConfig, remoteConfigs);

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
- **Cache inteligente** para melhor performance
- **Fallback seguro** para remote config se necessário

### Retorno

- `Promise<boolean>` - `true` se abriu com sucesso, `false` se houve erro

## 🔌 Integrações Opcionais

### TikTok Ads SDK

Configuração via Firebase Remote Config:

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

Configuração via Firebase Remote Config:

```json
{
    "hotupdater_url": "https://seu-servidor.com/updates"
}
```

O expo-utils verifica automaticamente por updates e aplica se necessário.

### Trendings Tracker

Configuração via Firebase Remote Config:

```json
{
    "trends_tracking_url": "https://trendings.app/api"
}
```

Rastreia instalações automaticamente na primeira abertura do app.

### Microsoft Clarity

Configuração via Firebase Remote Config:

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

### Unit IDs de Anúncios

```typescript
// constants/Strings.ts
import {Platform} from "react-native";

const iosAdUnits = {
    appOpen: "ca-app-pub-xxx/xxx",
    banner: "ca-app-pub-xxx/xxx",
    interstitial: "ca-app-pub-xxx/xxx",
    rewarded: "ca-app-pub-xxx/xxx",
};

const androidAdUnits = {
    appOpen: "ca-app-pub-xxx/xxx",
    banner: "ca-app-pub-xxx/xxx",
    interstitial: "ca-app-pub-xxx/xxx",
    rewarded: "ca-app-pub-xxx/xxx",
};

export default Platform.select({
    android: androidAdUnits,
    default: iosAdUnits,
});
```

### Configurações Remotas Firebase

As seguintes configurações remotas são suportadas automaticamente:

```json
{
    "is_ads_enabled": true,
    "min_version": 100,
    "review_mode": 0,
    "repeat_ads_count": 3,
    "delay_close_paywall_button": 5,
    "ios_app_id": "1234567890",
    "is_paywall_disabled": false
}
```

## 🧪 TypeScript e Tipagem

### Interfaces Principais

```typescript
import type {
    AppConfig,
    RemoteConfigSettings,
    FacebookConfig,
    RevenueCatKeys,
    Translations
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
declare global {
    var remoteConfigs: any;
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
import adUnits from '@/constants/Strings';

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, adUnits);
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
// _layout.tsx com RevenueCat
useEffect(() => {
    Utils.prepare(
        setAppIsReady,
        appConfig,
        adUnits,
        {
            androidApiKey: "goog_xxx",
            iosApiKey: "appl_xxx",
        },
        "clarity_project_id",
    );
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
