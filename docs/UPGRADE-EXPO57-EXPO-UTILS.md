# Guia completo: migrar app Expo (SDK 53) → Expo 57 + expo-utils 1.2.5

Documento operacional para **qualquer IA** (ou humano) repetir exatamente o que foi feito no **expo-plant-ai**.  
Não pule passos. Se o app-alvo for outro, mantenha a mesma **ordem** e o mesmo **checklist**; só troque IDs, keys e nomes de produto.

**Referências usadas na migração bem-sucedida:**

| O quê | Onde |
|--------|------|
| Código-fonte do expo-utils (última versão) | `../expo-utils` (local) ou `github:Pixel-Logic-Apps/expo-utils` |
| Versão do expo-utils neste trabalho | **1.2.5** |
| App referência Expo 57 + utils moderno | `../expo-meclivros` (`package.json`, `app.json`, `src/app/_layout.tsx`, `src/constants/Strings.ts`) |
| App de referência secundária | `../expo-carsoundidentifier` |
| Template oficial do utils | `expo-utils/templates/RootLayout.tsx`, `Strings.ts`, `babel.config.js` |
| README do utils | `expo-utils/README.md` (Remote Config `utils` + `screens`, CLI) |

---

## 0. Objetivo e resultado esperado

### Antes (estado típico legado)

- Expo **~53**, React **19.0**, RN **0.79.x**
- `expo-utils` via GitHub com API antiga:
  - `Utils.prepare(setAppIsReady, appConfig, adUnits, revenueKeys)`
  - `HotUpdater.wrap({ source: getUpdateSource(...) })(RootLayout)`
- `Strings.ts` exporta **só ad units**
- Remote Config **flat** em `global.remoteConfigs` (paywall_data, free_limits, api_url, store_ratings_type, is_ads_enabled tudo junto)
- `app.json` com **centenas de SKAdNetworkItems** no `infoPlist`
- `babel`: `hot-updater/babel-plugin`
- Premium local com `Purchases.getCustomerInfo()` + AsyncStorage

### Depois (estado alvo)

- Expo **57.x**, React **19.2.3**, RN **0.86.0**
- expo-utils **1.2.5**
- Boot via **`<ExpoUtilsLayout appConfig appStrings>`**
- `Strings.ts` = **AppStrings**: `hotUpdaterUrl` + `rckey` + `adUnits` por plataforma
- Remote Config Firebase: keys **`utils`** e **`screens`**
- `app.json` limpo (SKAd injetado pelo plugin no prebuild)
- Premium via **`PremiumUtils`**
- TypeScript limpo (`npx tsc --noEmit` exit 0 no app)

---

## 1. Análise obrigatória ANTES de editar código

Execute e leia tudo isto. Não edite cego.

### 1.1 Inventário do app-alvo

```bash
cat package.json
cat app.json   # ou app.config.*
cat babel.config.js
cat tsconfig.json
cat hot-updater.config.ts 2>/dev/null
find src -name '_layout.tsx' | head
cat src/app/_layout.tsx   # ou app/_layout.tsx
cat src/constants/Strings.ts 2>/dev/null
```

### 1.2 Grep de APIs legadas (lista completa a migrar)

```bash
# Boot / utils legado
rg -n "Utils\.prepare|HotUpdater\.wrap|getUpdateSource|revenueKeys|from \"expo-utils" src

# Remote Config flat
rg -n "global\.remoteConfigs|paywall_data|store_ratings_type|free_limits|is_paywall_enabled|api_url" src

# Premium local
rg -n "checkPremiumStatus|getCustomerInfo|@isPremium|PREMIUM_STATUS|Purchases\." src

# Ads
rg -n "banner-ad|LoadAdsManager|showInterstitial|isAdsEnabled|adUnits" src

# FileSystem (quebra no SDK 57 se usar API antiga no import principal)
rg -n "expo-file-system|uploadAsync|FileSystemUploadType|getInfoAsync" src

# Tema / color scheme (quebra com ColorSchemeName 'unspecified' no RN novo)
rg -n "Colors\[colorScheme|useColorScheme" src

# Hot updater babel
rg -n "hot-updater|@hot-updater" babel.config.js package.json
```

### 1.3 Versões do expo-utils e peers

Leia **sempre** o `package.json` do expo-utils local ou instalado:

```bash
cat ../expo-utils/package.json | head -100
# Foque em: version, peerDependencies (expo, react, react-native, firebase, hot-updater, purchases, admob…)
```

**Peers críticos 1.2.5 (mínimos):**

| Pacote | Peer aproximado |
|--------|------------------|
| expo | >=57.0.4 |
| react | >=19.2.3 |
| react-native | >=0.86.0 |
| @react-native-firebase/* | >=24 (ideal **25.1.0** como meclivros) |
| @hot-updater/* / hot-updater | >=0.35.3 |
| react-native-purchases | >=10.4.2 |
| react-native-google-mobile-ads | >=16.4.0 |
| react-native-reanimated | 4.x → **exige** `react-native-worklets` |
| eas-build-cache-provider | >=20.0.0 |
| expo-device, expo-video, expo-tiktok-ads-events | peers opcionais mas recomendados |

### 1.4 App referência Expo 57

```bash
cat ../expo-meclivros/package.json
cat ../expo-meclivros/app.json
cat ../expo-meclivros/src/app/_layout.tsx
cat ../expo-meclivros/src/constants/Strings.ts
cat ../expo-meclivros/babel.config.js
```

**Copie a estrutura mental, não o branding/IDs do meclivros.**

---

## 2. Dependências (`package.json`) — checklist item a item

### 2.1 Core a fixar

Atualize (ou alinhe com `npx expo install --fix` depois) para algo equivalente a:

```text
expo                          ~57.0.6   (ou pin 57.0.4+)
react                         19.2.3
react-dom                     19.2.3
react-native                  0.86.0
expo-router                   ~57.0.6
```

Adicione override:

```json
"overrides": {
  "react-dom": "19.2.3"
}
```

### 2.2 expo-utils

Opções (preferência nesta ordem):

1. **Tarball local da 1.2.5** (mais seguro se o GitHub não tiver tag):
   ```bash
   cd ../expo-utils && npm pack
   cd ../SEU-APP && npm install ../expo-utils/expo-utils-1.2.5.tgz
   ```
   Em package.json: `"expo-utils": "file:../expo-utils/expo-utils-1.2.5.tgz"`

2. **file:../expo-utils** (symlink) — funciona no Metro, mas o **tsc pode typecheckar o source do utils fora do app** e gerar erros de peers no `../expo-utils`. Prefira tarball se `tsc` reclamar.

3. `github:Pixel-Logic-Apps/expo-utils` se a branch/main já for 1.2.5+.

**NÃO** use `file:` symlink + incluir `../expo-utils` no `tsc` do app sem exclusão — vai poluir erros.

### 2.3 Firebase (todos na MESMA versão)

```text
@react-native-firebase/app            25.1.0
@react-native-firebase/analytics      25.1.0
@react-native-firebase/auth           25.1.0
@react-native-firebase/crashlytics    25.1.0
@react-native-firebase/firestore      25.1.0
@react-native-firebase/messaging      25.1.0
@react-native-firebase/remote-config  25.1.0
```

### 2.4 Hot Updater

```text
@hot-updater/react-native   0.35.3
@hot-updater/expo           0.35.3   (devDependency)
@hot-updater/cloudflare     0.35.3   (devDependency)
hot-updater                 0.35.3   (devDependency)
```

### 2.5 Ads / IAP / tracking / utils peers

```text
react-native-google-mobile-ads   16.4.0
react-native-purchases           10.4.2
react-native-fbsdk-next          13.4.3
react-native-edge-to-edge        1.8.1
react-native-fs                  2.20.0
@microsoft/react-native-clarity  4.6.3
@react-native-async-storage/async-storage  2.2.0
@react-native-community/slider   5.2.0
expo-tracking-transparency       ~57.0.1
expo-device                      ~57.0.1
expo-video                       ~57.0.1
expo-tiktok-ads-events           0.1.6
eas-build-cache-provider         20.0.0   (devDependency)
```

### 2.6 Navigation / UI RN (compat SDK 57)

```text
react-native-reanimated          4.5.0
react-native-worklets            0.10.0    # OBRIGATÓRIO com Reanimated 4
react-native-gesture-handler     2.32.0
react-native-screens             4.25.2
react-native-safe-area-context   5.7.0
react-native-webview             13.16.1
react-native-web                 0.21.2
@expo/vector-icons               15.x
@react-navigation/*              versões modernas alinhadas (meclivros: bottom-tabs 7.18.x etc.)
```

### 2.7 Pacotes expo-* do app (manter features do produto)

Para cada pacote `expo-*` que o app já usa, force família **57**:

```bash
npx expo install expo-camera expo-image-picker expo-image-manipulator \
  expo-media-library expo-haptics expo-image expo-file-system \
  expo-font expo-splash-screen expo-linking expo-constants \
  expo-localization expo-mail-composer expo-sharing expo-print \
  expo-network expo-application expo-blur expo-linear-gradient \
  expo-store-review expo-status-bar expo-system-ui expo-symbols \
  expo-web-browser expo-dev-client expo-build-properties expo-insights
```

Depois:

```bash
npx expo install --fix
```

### 2.8 Remover / não trazer de volta

| Remover | Motivo |
|---------|--------|
| `expo-updates` (se o fluxo for Hot Updater) | Conflito conceitual; meclivros não usa |
| Bloco `"updates": {...}` no app.json | Idem |
| `^` / `~` excessivos se o time pina deps (opcional) | Pin como meclivros se quiser builds reprodutíveis |

### 2.9 DevDependencies

```text
typescript           ~6.0.3
@types/react         19.2.x
eslint-config-expo   57.x
dotenv               atual
```

### 2.10 Install limpo

```bash
rm -rf node_modules package-lock.json   # se npm
npm install
npx expo install --fix
```

Detectar package manager: lockfile (`package-lock.json` → npm, `bun.lock` → bun). O CLI `expo-utils-install` também detecta.

---

## 3. `app.json` — o que REMOVER, MANTER e ADICIONAR

### 3.1 REMOVER (obrigatório / recomendado)

1. **Todo** `ios.infoPlist.SKAdNetworkItems`  
   - O plugin do expo-utils injeta ~162 IDs no **prebuild**.  
   - Lista gigante no app.json = legado.  
   - CLI: `npx expo-utils-install --skadnetwork`

2. **Bloco `updates`** (Expo Updates) se usar Hot Updater.

3. **Plugins duplicados** (muito comum no legado):
   - `expo-build-properties` 2x
   - `expo-tracking-transparency` 2x  
   Deixe **um** de cada.

4. `android.edgeToEdgeEnabled` se o schema do Expo 57 reclamar (expo-doctor: *should NOT have additional property*). Edge-to-edge via plugin `react-native-edge-to-edge`.

5. `newArchEnabled` se o template referência não usa (opcional; meclivros não declara).

### 3.2 MANTER (específico do produto)

- `name`, `slug`, `scheme`, `version`, `runtimeVersion`
- `ios.bundleIdentifier` / `android.package`
- `googleServicesFile` (iOS + Android) — **arquivos reais**, não template
- `extra.eas.projectId`
- Plugins de **câmera**, **image-picker**, permissões de mídia se o app precisa
- IDs AdMob e Facebook do **app** (não copiar do meclivros)
- `locales` / `languages/*`

### 3.3 ADICIONAR / ALINHAR

**iOS infoPlist mínimo (além do que o plugin injeta):**

```json
"infoPlist": {
  "CFBundleAllowMixedLocalizations": true,
  "ITSAppUsesNonExemptEncryption": false,
  "UIBackgroundModes": ["remote-notification"]
}
```

**entitlements:**

```json
"entitlements": { "aps-environment": "production" }
```

**Único bloco `expo-build-properties`:**

```json
[
  "expo-build-properties",
  {
    "ios": {
      "useFrameworks": "static",
      "useModularHeaders": true,
      "forceStaticLinking": [
        "RNFBApp",
        "RNFBAuth",
        "RNFBFirestore",
        "RNFBMessaging",
        "RNFBCrashlytics",
        "RNFBAnalytics",
        "RNFBRemoteConfig"
      ]
    }
  }
]
```

**Plugin expo-utils (flags recomendadas meclivros):**

```json
[
  "expo-utils",
  {
    "disableWarnings": false,
    "disableLogs": false,
    "skipDevMenuOnboarding": true,
    "analyticsAdSupport": true,
    "analyticsOnDeviceConversion": true,
    "usageDescriptions": true,
    "androidKotlinAdsFix": true,
    "appIcon": true,
    "firebaseLogLevel": "error",
    "disableAdsIfBuildIsNewerThanStore": true
  }
]
```

**edge-to-edge:**

```json
[
  "react-native-edge-to-edge",
  {
    "android": {
      "parentTheme": "Default",
      "enforceNavigationBarContrast": false
    }
  }
]
```

**experiments:**

```json
"experiments": {
  "typedRoutes": true,
  "reactCompiler": true,
  "buildCacheProvider": "eas"
}
```

**Hot updater plugin:**

```json
["@hot-updater/react-native", { "channel": "production" }]
```

**Ordem de plugins (padrão limpo):**

1. Strings simples: `expo-router`, `expo-localization`, `expo-mail-composer`, `expo-sharing`, `expo-font`, `expo-video`, `expo-web-browser`, `@react-native-firebase/app`, `@react-native-firebase/crashlytics`
2. Com config: splash, build-properties, image-picker/camera (se houver), tracking-transparency, google-mobile-ads, fbsdk-next, edge-to-edge, expo-utils, hot-updater

CLI útil: `npx expo-utils-install --sort-plugins`

**Opcional root-level (AdMob):**

```json
"react-native-google-mobile-ads": {
  "android_app_id": "ca-app-pub-…~…",
  "ios_app_id": "ca-app-pub-…~…"
}
```

Nota: o Expo 57 pode avisar que a chave root não é do schema `expo` — ainda assim meclivros usa; os IDs **também** vão no plugin.

### 3.4 CLI expo-utils (depois de ter o pacote instalado)

```bash
npx expo-utils-install
npx expo-utils-install --skadnetwork --sort-plugins --fix-ios-build --eas-config --hot-updater
npx expo-utils-install --policy-checks   # SEMPRE (também em app já migrado)
# Opcional: --languages  (purpose strings iOS localizadas)
```

**Não rode `--layout` se o app já tem Stack custom** — reescreva o layout manualmente (seção 4).

**`--policy-checks` é obrigatório no upgrade** (e barato: só escreve doc). Ele sincroniza
`.claude/POLICY-CHECKS.md` — a lista de regras de review que já derrubaram build de verdade
(Apple/Google) — e, se o `AGENTS.md` do app não citar o arquivo, adiciona o ponteiro no fim dele.
O arquivo é **gerado**: é sobrescrito a cada install, para o app nunca ficar com a lista da versão
em que foi criado. Regra nova vai em `templates/POLICY-CHECKS.md` do repo `expo-utils`, nunca na
cópia do app. Rode de novo a cada bump do expo-utils, para o app pegar as regras novas.

---

## 4. Boot: `_layout.tsx` + `Strings.ts` + babel

### 4.1 `src/constants/Strings.ts` (AppStrings)

**ANTES (legado plant):**

```ts
export default Platform.select({ android: androidAdUnits, default: iosAdUnits });
// prepare(…, adUnits, revenueKeys)  ← 4º arg keys RevenueCat separado
```

**DEPOIS (obrigatório):**

```ts
import {Platform} from "react-native";

const hotUpdaterUrl = "https://SEU-WORKER.workers.dev/api/check-update";

const ios = {
  hotUpdaterUrl,
  rckey: "appl_…",           // RevenueCat iOS
  adUnits: {
    appOpen: "ca-app-pub-…/…",
    banner: "ca-app-pub-…/…",
    interstitial: "ca-app-pub-…/…",
    rewarded: "ca-app-pub-…/…",
  },
};

const android = {
  hotUpdaterUrl,
  rckey: "goog_…",
  adUnits: { /* … */ },
};

export default Platform.OS === "android" ? android : ios;
```

**Conferir:**

- [ ] `hotUpdaterUrl` aponta para o worker **deste** app
- [ ] `rckey` iOS começa com `appl_`, Android com `goog_`
- [ ] Ad units reais (não placeholder `…/0000` — no plant o interstitial Android estava quebrado e foi restaurado para o ID real)
- [ ] Placeholder `YOUR_REVENUECAT` desativa RevenueCat no utils — nunca deixe em produção

### 4.2 `src/app/_layout.tsx`

**REMOVER:**

- `import Utils from "expo-utils/utils/Utils"`
- `import { getUpdateSource, HotUpdater } from "@hot-updater/react-native"`
- `useState(appIsReady)` + `useEffect` com `Utils.prepare(...)`
- `export default HotUpdater.wrap(...)(RootLayout)`
- `SafeAreaProvider` só se não for mais necessário (edge-to-edge + layout do utils cobrem o comum)
- `revenueKeys` embutido no layout

**ADICIONAR padrão meclivros:**

```tsx
import {Stack} from "expo-router";
import {ExpoUtilsLayout} from "expo-utils/utils/ExpoUtilsLayout";
import type {RemoteConfigUtilsType} from "expo-utils/utils/types";
import appConfig from "../../app.json";
import appStrings from "@/constants/Strings";

declare global {
  var remoteConfigUtils: RemoteConfigUtilsType;
  var remoteConfigScreens: any;
  var isAdsEnabled: boolean;
  var adUnits: any;
}

export default function RootLayout() {
  return (
    <ExpoUtilsLayout appConfig={appConfig} appStrings={appStrings}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* MANTER todas as Stack.Screen do app: tabs, paywall, camera, etc. */}
      </Stack>
    </ExpoUtilsLayout>
  );
}
```

**O que o ExpoUtilsLayout já faz (não reimplementar):**

- `initHotUpdater(appStrings.hotUpdaterUrl)`
- `Utils.prepare` (Remote Config, RevenueCat, globals)
- App-open ads listener
- Promo modal
- Ask-for-review overlay
- ATT pós-primeiro-frame (`Utils.handleReady`)
- Splash control
- Atribuição do RevenueCat em duas fases + geo por IP + telemetria (v1.4.0 — seção 4.2.1)

Props opcionais: `fcmTrackingAllowed={false}` se o app pede push só no onboarding; `onReady` callback.

### 4.2.1 Contrato de boot da v1.4.0 (atribuição, push aberta, analytics)

**`Utils.prepare()` sozinho NÃO roda UMP, ATT, permissão de push, Facebook, TikTok nem a fase 2 da
atribuição.** Quem dispara tudo isso é o `Utils.handleReady` — o `<View onLayout={Utils.handleReady} />`
que o `ExpoUtilsLayout` (e o template `RootLayout.tsx`) renderizam. App migrado que mantiver um
`_layout.tsx` próprio chamando só `prepare()` fica **sem ATT, sem push e com o customer vazio no
RevenueCat**, em silêncio. Desde a 1.4.0 um watchdog acusa: 30s após o `prepare()` sem `handleReady` →
`expoUtilsWarn` → evento `expo_utils_warn` no Analytics.

Ordem real do boot:

```text
prepare()                       Remote Config → Purchases.configure → ATRIBUIÇÃO FASE 1 (destacada) → globals → ready
handleReady (1º frame)          3s de splash + 2s
requestTrackingWhenActive       UMP → ATT → [FB → ATRIBUIÇÃO FASE 2] (destacada) → push → consent_flow
                                → TikTok → link-in-bio → update dialog
```

- **Fase 1** (sem consentimento): AdServices (iOS), `$firebaseAppInstanceId`, atributos de contexto
  (`language`, `locale`, `device_region`, `currency`, `timezone`, `store_country`, `app_version`…),
  `setUserId` do GA4 = App User ID do RevenueCat.
- **Fase 2** (pós-ATT, não espera push/TikTok): device identifiers **sempre**, `$fbAnonId`, push token,
  geo por IP. Cada etapa com timeout; cada fase termina com `syncAttributesAndOfferingsIfNeeded()`
  **imediato** (o Android suspende timers do JS enquanto um diálogo do sistema está na frente) e o
  evento `rc_attribution`.
- **Não reimplementar no app**: nada de `collectDeviceIdentifiers` / `setFirebaseAppInstanceID` /
  `setPushToken` / `setAttributes` de contexto no app host. Atributo próprio do app vai por
  `setRevenueCatAttributes({...})` (export do pacote), que já força o envio.
- `Utils.setupAttribution(rckey, attGranted, attStatus?)` continua existindo (agora é a fase 2,
  memoizada) e `Utils.requestPushPermission()` passou a **devolver** o status (`granted`/`denied`/…).
- **Geo por IP vem LIGADA.** Cidade/estado gravados contra o customer contam como "Coarse Location"
  (App Store) / "Approximate location" (Play Data Safety): declarar nas lojas **ou** desligar com
  `{"geoAttributes": false}` no plugin / `geo_lookup_enabled: false` no Remote Config.
- **Push aberta**: `push_opened` sai do `onNotificationOpenedApp` + `getInitialNotification` do RNFB.
  App que instalar `expo-notifications` no iOS toma o delegate do `UNUserNotificationCenter` e pode
  calar esse evento — não adicionar sem testar.
- **Paywall**: passar `placement` no `usePaywall({placement: "onboarding"})` para o funil `paywall_*`
  sair segmentado (omitido = rota atual).

Exports novos do pacote (`index.ts` **e** `index.d.ts`): `logUtilsEvent`, `setUtilsUserId`,
`setUtilsUserProperty`, `AnalyticsParams`, `setRevenueCatAttributes`, `scheduleRcSync`,
`getContextAttributes`, `lookupGeo`, `GEO_PROVIDERS`, `GeoResult`. Catálogo de eventos:
`docs/ANALYTICS-EVENTS.md`.

### 4.3 `babel.config.js`

**ANTES:**

```js
plugins: ["hot-updater/babel-plugin"]
```

**DEPOIS:**

```js
plugins: ["@hot-updater/expo/babel-plugin"]
```

Preset: `babel-preset-expo`.

### 4.4 `hot-updater.config.ts`

Já no formato `@hot-updater/cloudflare` + `expo()` + `updateStrategy: "appVersion"` → só garantir deps 0.35.x.  
Não misturar API do hot-updater 0.20.

---

## 5. Remote Config — migração de código + Firebase

### 5.1 Modelo novo (expo-utils 1.x+)

| Key no Firebase Console | Global no app | Conteúdo |
|-------------------------|---------------|----------|
| `utils` (JSON string) | `global.remoteConfigUtils` **e** alias `global.remoteConfigs` | ads, review, promo, clarity, tiktok, min_version… |
| `screens` (JSON string) | `global.remoteConfigScreens` (`RemoteConfigScreensType`) | features do app: api, paywall, limits, flags + **`cross_promo` (obrigatório em todo app — ver 5.3)** |

**Se o Firebase continuar com um único JSON flat antigo, o app sobe com defaults e paywall/API quebram.**

### 5.2 Tabela de substituição de leituras (plant-ai — adapte ao app)

| Código legado | Código novo |
|---------------|-------------|
| `global.remoteConfigs?.api_url` | `global.remoteConfigScreens?.api_url` |
| `global.remoteConfigs?.paywall_data.*` | `global.remoteConfigScreens?.paywall?.*` |
| `global.remoteConfigs?.free_limits` | `global.remoteConfigScreens?.free_limits` |
| `global.remoteConfigs?.is_paywall_enabled` | `global.remoteConfigScreens?.is_paywall_enabled` |
| `global.remoteConfigs?.store_ratings_type` | `global.remoteConfigUtils?.review_type` |

**Arquivos tocados no plant (lista real):**

- `src/services/plant-api.ts`
- `src/app/paywall.tsx`
- `src/app/result.tsx`
- `src/app/(tabs)/index.tsx`
- `src/app/(tabs)/diagnostic.tsx`
- `src/app/(tabs)/my-garden.tsx`
- `src/app/(tabs)/settings.tsx`
- `src/app/(tabs)/_layout.tsx`
- `src/utils/plant-storage.ts`

### 5.3 Exemplo de JSON `screens` (plant)

```json
{
  "api_url": "https://…",
  "is_paywall_enabled": true,
  "free_limits": {
    "total_identifications": 3,
    "total_diagnoses": 3,
    "max_history": 20,
    "max_group": 2
  },
  "cross_promo": {
    "enabled": true,
    "title": "…",
    "app_name": "…",
    "subtitle": "…",
    "cta": "…",
    "ios_url": "https://apps.apple.com/…",
    "android_url": "https://play.google.com/…",
    "screens": ["home"]
  },
  "paywall": {
    "selected_product": "…",
    "close_button_delay": 5000,
    "primary_button_text": "…",
    "disclaimer_text": "…",
    "list_of_products": [ /* … */ ],
    "extras": { "show_arrow": true }
  }
}
```

**`cross_promo` é campo OBRIGATÓRIO do `RemoteConfigScreensType` (`utils/types.ts`)** — todo app do portfólio deve ter cross-promo implementado em algum lugar. O card pronto é o `CrossPromoCard` (`utils/cross-promo-card.tsx`); sem a key no Remote Config o app monta `remoteConfigScreens` incompleto e o typecheck acusa.

Para preencher o `cross_promo` (e o `promotional` do parâmetro `utils`) sem digitar à mão: gerador em <https://pixel-logic-apps.github.io/expo-utils/> (`docs/index.html` deste repo) — cola o link da App Store/Google Play do app anunciado e ele devolve o JSON pronto.

### 5.4 Exemplo mínimo `utils`

```json
{
  "is_ads_enabled": true,
  "min_version": 0,
  "ios_app_id": "",
  "review_type": "store-review",
  "review_type_delay": 0,
  "review_show_delay": 0,
  "review_style": "bottomsheet",
  "review_tutorial_enabled": false,
  "repeat_ads_count": 3,
  "ad_blocklist": [],
  "promotional": { "enabled": false },
  "clarity_id": "",
  "trends_tracking_url": "",
  "geo_lookup_enabled": true,
  "geo_lookup_url": ""
}
```

Valores de `review_type`: `"store-review"` | `"popup"` | `"dialog"`.

`geo_lookup_enabled` (v1.4.0, default `true`): `false` desliga a geo por IP sem build novo.
`geo_lookup_url` (opcional, só `https`): endpoint próprio tentado antes dos provedores gratuitos
embutidos (ipwho.is → BigDataCloud → GeoJS); contrato `{country, region, regionCode, city}`.

### 5.4.0 Layout do popup (`review_style`)

Troca o desenho do `AskForReviewOverlay` **sem release**. Três valores:

| valor | layout |
|---|---|
| `bottomsheet` | card embaixo com respiro lateral, **dois botões** lado a lado — **padrão**, é o layout histórico |
| `formsheet` | sheet colado nas bordas (100% de largura, **sem cantos arredondados**), **metade da altura da tela**, entra **só deslizando**, **X** num cabeçalho separado por uma linha acima da mídia, e **um botão só** de largura total |
| `centered` | card no meio da tela, **dois botões** empilhados e de largura total |
| `fullscreen` | tela inteira, **X** no canto, **um botão só** de largura total ancorado no rodapé |

Nos layouts com **X**, ele *é* o "Agora não": o botão secundário não é renderizado e o X fica
**escondido enquanto o `review_type_delay` corre**, aparecendo quando o contador zera. Assim o
delay continua valendo sem precisar do botão com `(3s)`.

Ausente ou com valor desconhecido cai em `bottomsheet`, então **nenhum app existente muda de
aparência** ao subir a versão. Override local: prop `variant` do overlay (a prop ganha do RC).

```tsx
<AskForReviewOverlay visible={v} onClose={c} variant="fullscreen" />
```

A animação de
entrada acompanha o layout: `bottomsheet` e `formsheet` deslizam de baixo, `centered` e
`fullscreen` entram com fade/escala. O `formsheet` arredonda só os cantos de cima (está colado
nas laterais) e o `fullscreen` não arredonda nada. O slot de mídia vai a 240 no `fullscreen`,
fica em 200 no `bottomsheet`/`centered` e no `formsheet` usa `flex: 1` — fica com o que sobrar
depois do cabeçalho, do texto e do botão, então a proporção se mantém em qualquer aparelho.
**Cantos em squircle, sem dependência.** Card (`bottomsheet` 40, `centered` 28), botões (20) e
mídia (24) usam superelipse em vez do arco circular do `borderRadius` — `utils/squircle.tsx`, um
9-slice de `View` + `Image` com `tintColor`, PNGs embutidos em `utils/squircle-assets.ts`
(gerados por `docs/squircle-gen.py`). Nada a instalar: não usa `react-native-svg` nem módulo
nativo (`borderCurve: "continuous"` é só iOS; `clipToOutline` com path só clipa em Android novo).
`radius` tem a MESMA leitura visual de `borderRadius: radius` — o canto ocupa 1,6·r de aresta com
expoente 3,4282, que iguala a profundidade de corte do círculo. As três regras que o arquivo
documenta vieram de defeito medido em aparelho: nada se sobrepõe (o Android aplica `opacity` por
filho, sobreposição vira cruz sob alpha — inclusive no `TouchableOpacity` pressionado), tudo em
pixel físico inteiro por `left`/`top` (o Yoga posiciona `bottom`/`right` contra a dimensão não
arredondada do pai e desloca 1px), e o PNG vem de uma cadeia de tamanhos (reamostrar mais que
~18% serrilha ou borra). `layouts` de canto reto (`formsheet`, `fullscreen`) não usam squircle.

A altura do `formsheet` é `FORMSHEET_FRACTION` (0.5) de `useWindowDimensions().height`, então
acompanha rotação e split-screen; é uma constante só, em `utils/ask-for-review.tsx`.
Com 1/3 sobravam só 93dp pra mídia e o tutorial ficava 165×93; com metade sobram 246dp e ele
encosta nas duas bordas (412×232 num aparelho de 922dp).

### 5.4.1 Tutorial animado da Play Store (`review_tutorial_enabled`)

O `AskForReviewOverlay` aceita a prop `tutorial`, que troca a imagem estática do card por um
tutorial animado de 21,85 s por padrão mostrando o caminho até a avaliação na Play Store. Ele é renderizado
como HTML/CSS/JS numa WebView, então **nome do app, ícone, nome do usuário, idioma, cor de
destaque e relógio são parâmetros** — nada fica queimado num arquivo de mídia.

```tsx
import AskForReviewOverlay from "expo-utils/utils/ask-for-review";

<AskForReviewOverlay
    visible={visible}
    onClose={close}
    tutorial={Platform.OS === "android"}
/>
```

Customizando:

```tsx
tutorial={{
    appName: "Meu App",
    appIconUrl: "https://.../icon.png",  // URL quebrada cai num placeholder com a inicial
    userName: "Ana",
    locale: "pt",
    accent: "#01875F",                   // verde padrão da Play; default é Material You azul
}}
```

Ou também pode usar o componente direto, fora do overlay:

```tsx
import {ReviewTutorial} from "expo-utils/utils/review-tutorial";
```

Pontos de atenção:

- **Requer `react-native-webview`** (peer opcional; o `expo-utils-install` já o instala junto
  com os demais peers). Como `ask-for-review` é deep-import, apps que não importam esse arquivo
  não carregam a dependência — mas **um app que já usa `ask-for-review` e ainda não tem o
  webview instalado passa a precisar dele**, mesmo sem ligar o tutorial (é o comportamento que
  o AGENTS.md pede: dependência ausente falha no bundle, não escondida em runtime). Rode
  `bunx expo-utils-install` para instalar os peers que faltam.
- **Só faz sentido no Android.** No iOS o fluxo de avaliação é o `SKStoreReviewController`
  nativo, sem esse caminho pela loja.
- Desenhado para o aspecto **1,775:1** — é o mesmo do slot de mídia do overlay
  (`width: "100%", height: 200`).
- Os rótulos da própria Play Store (`Gerenciar apps e dispositivos`, `Notas e avaliações`,
  `Postar`…) estão preenchidos nos **31 idiomas** da tabela `TRANSLATIONS` de `ask-for-review.tsx`,
  **extraídos do APK da Play Store** (não traduzidos à mão) — o procedimento com `adb` + `aapt2`
  está no topo de `utils/review-tutorial/labels.ts`, e é o mesmo para atualizar quando o Google
  mudar um rótulo. **Não traduza à mão**: o usuário vai procurar na tela dele exatamente o
  rótulo que o Google usa.
  Cinco rótulos não existem no APK porque a Play os recebe do backend — as quatro abas da home
  (`tabForYou`, `tabTrending`, `tabWorkApps`, `tabKids`) e `tabPosted`. Esses seguem em pt/en/es
  e caem no inglês nos demais; são decoração, nenhuma seta do tutorial aponta para eles.
- **Sem fonte embutida.** O Android já usa Roboto como fonte de sistema, então o tutorial pede
  `font-family: Roboto` e não carrega `@font-face`. Isso tirou 34,8 KB do bundle e ainda melhorou
  o texto (a fonte de sistema tem os pesos reais, o subset embutido só tinha o 400 e caía no
  sistema mesmo para cirílico/CJK/árabe). Como o tutorial é Android-only, não há perda.
- `review_tutorial_html` (RC) substitui o HTML inteiro. É a válvula para corrigir um redesenho
  da Play Store nos apps já publicados, sem release.
- O renderer sincroniza transições, digitação e cursor no mesmo loop (21,85 s no preset atual). Nome,
  ícone e textos continuam dinâmicos; o launcher e o logo da Play são HTML/SVG.
  Para gerar e conferir um preview com nome e ícone lidos do `app.json` do host:
  `bun utils/review-tutorial/preview.ts --project ../meu-app --locale pt --output /tmp/tutorial.html`.
  Abra o HTML com `#t=12.2` para inspecionar um instante. Veja
  [os parâmetros e a API de captura](../utils/review-tutorial/README.md).
  Essa descoberta do ícone é do script: no componente, use `appIcon` ou `appIconUrl`.
- **O ícone do app entra sozinho, sem você fazer nada.** O config plugin (`withAppIconDataUri`,
  opt-out `{ "appIcon": false }`) lê `expo.android.icon` / `expo.icon`, reduz para 96px com o
  `jimp-compact` e grava o data URI em `extra.expoUtilsAppIcon`; o
  `ask-for-review` lê de `Constants.expoConfig`. **Não mexe no `app.json`** — o config muda só em
  memória e sai no `app.config` gerado dentro do APK/IPA, que já é ignorado pelo git. Usa spread
  no `extra`, então `eas.projectId` / `router.origin` continuam lá. Medido: ~8 KB de data URI,
  234 ms na primeira resolução e 69 ms depois (cache em `node_modules/.cache/expo-utils/`,
  chaveado por mtime+tamanho do ícone, porque `getConfig` roda em todo `metro start`). Sem
  ícone, sem `jimp` ou erro no encode: deixa o config intacto e o tutorial cai no círculo com a
  inicial. **Não é `sharp`**: `sharp` não é dependência do Expo e não existe num projeto limpo;
  `jimp-compact` vem dentro do `@expo/image-utils`, que o `expo-asset/app.plugin.js` já carrega
  na resolução do config.
  Vale para apps que já existem — basta rebuildar, nenhum arquivo do projeto muda.
  Motivo de ser no plugin e não em runtime: em release no Android o asset do bundle vira **nome
  de drawable** (`expo-asset` seta `localUri = uri` quando a URI não tem `:`), e aí o
  `FileSystem.readAsStringAsync` falha — `appIcon={require(...)}` funciona no dev e some no
  release. O data URI não passa pelo pipeline de asset, então é igual nos dois.
  Se o RC já fornece `review_tutorial_html`, ele continua tendo precedência sobre o template
  atualizado; remova ou regenere esse override para receber as correções visuais.
- `align` (`"center"` | `"top"`, default `"center"`) decide onde o vídeo fica quando o slot não tem
  o aspecto 426:240. O encaixe é `contain`, então sobra uma faixa da cor de fundo: `"center"` a
  divide em cima e embaixo, `"top"` cola o vídeo na borda de cima e manda a sobra toda para baixo.
  O `formsheet` usa `"top"` sozinho, porque lá a mídia encosta na linha do header e a faixa de
  cima leria como folga. **Não resolva isso com margem negativa no slot**: a sobra é interna à
  WebView, muda por aparelho, e a mídia desenha por cima do header — cobriria a linha.
- As durações agora podem ser ajustadas pela prop `timings`, também dentro de
  `tutorial` do overlay: `tutorial={{timings: {slideDown: 1.0, accountOpen: 0.6}}}`.
  Os valores são **segundos** e deslocam os próximos eventos juntos; campos omitidos usam
  os padrões de `utils/review-tutorial/timings.ts`: `storeOpen: 0.7`, `homeEnter: 1.35`,
  `accountOpen: 1.05`, `manageOpen: 1.35`, `slideDown: 0.25`, `reviewsOpen: 0.5`,
  `composerOpen: 0.65`, `typing: 3.9` (loop de **21,85 s**).
  O script acima também gera um `*-editor.html` (ou `editor.html`
  na saída padrão), com sliders, repetição de trecho e exportação de JSON/HTML.
  O HTML exportado já contém as durações escolhidas e pode substituir o override do RC.
  Para ver em inglês, use `--locale en` no script ou `locale: "en"` nas props do tutorial.

### 5.5 Optional chaining

Sempre use `?.` em `paywall`, `free_limits`, `extras` — se `screens` vier `{}` no boot, **não pode crashar**.

---

## 6. Premium unificado

### 6.1 Problema

Código local duplicava lógica do RevenueCat e podia divergir de banners/app-open/interstitial (que usam a lib).

### 6.2 Correção

```ts
// plant-storage.ts (ou util equivalente)
import {PremiumUtils} from "expo-utils/utils/PremiumUtils";

export async function checkPremiumStatus(): Promise<boolean> {
  return PremiumUtils.getIsPremiumStatus();
}
```

**Por que path profundo `expo-utils/utils/PremiumUtils`?**  
O `index.d.ts` da 1.2.5 pode estar **desatualizado** em relação ao `index.ts` (que exporta `PremiumUtils`). O deep import evita erro TS/`Did you mean default import`.

### 6.3 Escrita de premium (paywall)

```ts
await PremiumUtils.setIsPremiumStatus(true);
// em vez de AsyncStorage.setItem("@isPremium", "true")
```

### 6.4 Comportamento da lib (não reimplementar)

- **DEV:** lê `@isPremium === "true"` (toggle)
- **PROD:** sempre RevenueCat via `isRevenueCatActive()`; storage **não** é fonte de verdade
- `willRenew` + `unsubscribeDetectedAt` controlam opt-out (exceto flag RC `is_opted_out_trial_enabled`)

Key AsyncStorage: `@isPremium` (mesmo valor que muitos apps já usam em `STORAGE_KEYS.PREMIUM_STATUS`).

---

## 7. Breaking changes de APIs do Expo 57 / RN 0.86

### 7.1 `expo-file-system`

**Sintoma TS:**

```text
Property 'FileSystemUploadType' does not exist on type 'typeof import("expo-file-system")'
```

**Correção:** importar o legacy:

```ts
import * as FileSystem from "expo-file-system/legacy";
// uploadAsync, FileSystemUploadType, FileSystemSessionType, getInfoAsync continuam iguais
```

O import principal do pacote **joga** nas APIs deprecadas em runtime se usado sem `/legacy`.

### 7.2 `ColorSchemeName` inclui `"unspecified"`

**Sintoma TS:**

```text
Element implicitly has an 'any' type because expression of type 'ColorSchemeName'
can't be used to index type { light: …; dark: … }
Property 'unspecified' does not exist…
```

**Correção (feita no plant):**

```ts
// Colors.ts
export function getColors(scheme?: string | null) {
  return Colors[scheme === "dark" ? "dark" : "light"];
}
```

Substituir **todas** as ocorrências:

```ts
// ANTES
const colors = Colors[colorScheme ?? "light"];
// DEPOIS
const colors = getColors(colorScheme);
```

E em props que aceitam só `"light" | "dark"`:

```tsx
appearance={colorScheme === "dark" ? "dark" : "light"}
```

Arquivos plant com `getColors`: todos os screens/components que usavam `Colors[colorScheme ?? "light"]` (~17 arquivos).

### 7.3 Reanimated 4

Sem `react-native-worklets` o bundle quebra. Instale na versão pedida pelo `expo install`.

### 7.4 HotUpdater API

Não use mais:

```ts
HotUpdater.wrap({ source: getUpdateSource(url, { updateStrategy: "appVersion" }) })(RootLayout)
```

Use URL em `appStrings.hotUpdaterUrl` + `initHotUpdater` dentro do `ExpoUtilsLayout`.

---

## 8. Ads / review (mínimo a validar)

- Manter imports:
  - `expo-utils/utils/banner-ad`
  - `expo-utils/utils/LoadAdsManager`
  - `expo-utils/utils/styles` (ExpoUtilsStyles)
- `LoadAdsManager.showInterstitial()` — na lib nova **não pendura** (sempre resolve)
- Review local do app pode coexistir com overlay da lib — controle via `review_type` no RC para não double-prompt
- `global.isAdsEnabled` / store gate: se `disableAdsIfBuildIsNewerThanStore: true`, ads desligam em build mais nova que a loja

---

## 9. Ordem de execução (copy-paste mental)

```text
1.  Ler expo-utils package.json (versão + peers)
2.  Ler meclivros (package/app.json/_layout/Strings) como moldes
3.  Grep legado no app-alvo (seção 1.2)
4.  Reescrever package.json (core + peers + product packages)
5.  npm pack expo-utils 1.2.5 + npm install
6.  npx expo install --fix
7.  Reescrever app.json (SKAd out, plugins limpos, forceStaticLinking, flags utils)
8.  Strings.ts → AppStrings
9.  _layout.tsx → ExpoUtilsLayout + Stack existente
10. babel → @hot-updater/expo/babel-plugin
11. Migrar todas as leituras remoteConfig* (grep até zero legado)
12. PremiumUtils em checkPremium / set premium
13. expo-file-system/legacy se uploadAsync/getInfoAsync
14. getColors se Colors[colorScheme]
15. npx tsc --noEmit  (corrigir até zero erros DO APP)
16. npx expo-doctor   (schema app.json limpo)
17. Firebase Console: migrar keys utils + screens  (HUMANO / ops)
18. npx expo run:ios / run:android  (primeira build demora: gRPC/Firestore)
19. Smoke test telas
```

---

## 10. Checklist de verificação (pass/fail)

### 10.1 Instalação / types

- [ ] `npm install` (ou bun) sem erro fatal
- [ ] `npx tsc --noEmit` → **exit 0** no app (erros só em `../expo-utils` se symlink = trocar por tarball)
- [ ] Não há `global.remoteConfigs?.paywall_data` nem `store_ratings_type` no src
- [ ] Não há `HotUpdater.wrap` nem `Utils.prepare` no `_layout`
- [ ] `babel.config.js` usa `@hot-updater/expo/babel-plugin`
- [ ] Existe `react-native-worklets` no package.json
- [ ] Todos `@react-native-firebase/*` na mesma versão

### 10.2 app.json

- [ ] Zero `SKAdNetworkItems` no app.json
- [ ] Um único `expo-build-properties` com `forceStaticLinking` RNFB*
- [ ] Plugin `expo-utils` com flags
- [ ] Plugin `@hot-updater/react-native`
- [ ] Sem bloco `updates` se Hot Updater
- [ ] `UIBackgroundModes` inclui `remote-notification`
- [ ] AdMob / Facebook IDs do **produto**

### 10.3 Runtime (device/simulador)

- [ ] App passa do splash (não fica preto infinito)
- [ ] Onboarding / index navega
- [ ] Tabs renderizam
- [ ] Banner não crasha se sem unitId
- [ ] Paywall abre se `screens.paywall` + rckey válidos
- [ ] Identificação/API se `screens.api_url` válido
- [ ] Interstitial não trava o fluxo
- [ ] Premium dev toggle / compra grava e `checkPremiumStatus` reflete
- [ ] Console do Metro mostra `[expo-utils] event rc_attribution {"phase":1,...}` **e** `{"phase":2,...}`
      (só a fase 1 = layout sem `Utils.handleReady`; `synced:1` = o RevenueCat aceitou o envio)
- [ ] `[expo-utils] RC appUserID: ...` no console → buscar esse ID no dashboard do RevenueCat e conferir
      os atributos (`$firebaseAppInstanceId`, `language`, `store_country`, `geo_*`, `$ip`, push token).
      **Só isto prova que chegou** — log local não prova
- [ ] Sem o warn `handleReady nunca foi chamado` depois de 30s
- [ ] Tocar numa notificação com o app em background → `push_opened` no console/DebugView

### 10.4 Expo doctor

- [ ] Schema app.json sem propriedades inválidas
- [ ] Avisos de Directory (`react-native-fs` unmaintained) são **esperados** (peer do utils) — não bloqueiam

---

## 11. Armadilhas reais encontradas neste projeto

| # | Armadilha | Sintoma | Correção |
|---|-----------|---------|----------|
| 1 | `Utils.prepare(..., adUnits, revenueKeys)` | RC key errada / RevenueCat não configura | AppStrings com `rckey` + `adUnits` |
| 2 | SKAd no app.json | arquivo monstro, IDs duplicados | remover; plugin prebuild |
| 3 | Plugins duplicados | prebuild confuso | um de cada |
| 4 | Remote Config flat | paywall/API undefined | keys `utils` + `screens` + rewrites |
| 5 | `paywall_data` nome | UI vazia | renomear para `paywall` em screens |
| 6 | `store_ratings_type` | review nunca no modo certo | `review_type` em utils |
| 7 | HotUpdater.wrap legado | API 0.20 | ExpoUtilsLayout + hotUpdaterUrl |
| 8 | babel `hot-updater/babel-plugin` | OTA plugin errado | `@hot-updater/expo/babel-plugin` |
| 9 | Sem worklets | crash Reanimated 4 | `react-native-worklets` |
| 10 | Firebase 23 + Expo 57 | pods/native mismatch | Firebase 25 monorepo pin |
| 11 | `file:../expo-utils` symlink | tsc errora em peers do utils | tarball `.tgz` |
| 12 | `index.d.ts` sem PremiumUtils | TS2614 | import `expo-utils/utils/PremiumUtils` |
| 13 | FileSystem v57 | TS + runtime throw | `expo-file-system/legacy` |
| 14 | ColorScheme `unspecified` | TS7053 em 15+ arquivos | `getColors()` |
| 15 | Interstitial Android `…/0000` | ads mortos | restaurar unit ID real |
| 16 | `edgeToEdgeEnabled` no android | expo-doctor schema fail | remover do app.json |
| 17 | Root key `react-native-google-mobile-ads` | warning schema | ok manter + plugin |
| 18 | Primeira `expo run:ios` | “travado” em gRPC-Core | normal 10–30+ min; é compile |
| 19 | `smctl` | comando não existe | usar `xcrun simctl` (+ screenshots/maestro) |
| 20 | Premium local vs ads | usuário premium ainda vê ads | `PremiumUtils` fonte única |
| 21 | `_layout` legado só com `Utils.prepare()` | sem prompt de ATT/push; customer **vazio** no RevenueCat | `ExpoUtilsLayout` (ou `<View onLayout={Utils.handleReady} />`); o watchdog da 1.4.0 acusa em `expo_utils_warn` |
| 22 | Atribuição no fim da fila (≤ 1.3.x) | assinante de paywall de onboarding sem NENHUM atributo no RC | 1.4.0: fase 1 no boot + fase 2 destacada + sync forçado |
| 23 | Timer do JS no Android com diálogo do sistema na frente | `setTimeout` não dispara enquanto a Activity está pausada (permissão, UMP, compra) — medido: envio com debounce saiu 150s depois | caminho crítico sem timer (sync imediato); nunca depender de `setTimeout` para algo que precisa sair durante um prompt |
| 24 | Product id `assinatura:basePlan` no RevenueCat | ler customer Android como se fosse iOS (APNS/ATT/idfa/idfv "vazios") | `:` no product id = Google Play; esses campos são vazios por plataforma |
| 25 | `setPushToken(tokenFCM)` no iOS | campo APNS do RC com valor errado | 1.4.0 passa o token APNS; o FCM do iOS vai na chave custom `fcm_token` |
| 27 | `Strings.ts` gerado pelo CLI da **1.3.1** | bundle quebra com `Unable to resolve module ${iconPath}` (o template tinha `appIcon: require("${iconPath}")` sem substituição) | apagar a linha `appIcon` do `Strings.ts` — nada na lib lê esse campo (o ícone vem do config plugin). Corrigido no template da 1.4.0 |
| 28 | Popup de review com a imagem estourada (1.3.1) | recorte gigante da imagem (o "4.7" do banner padrão) e banner registrado com `AskForReviewEvents.setImage()` ignorado | 1.4.0: imagem com largura/altura explícitas e o slot global passa a ser lido |
| 26 | Geo por IP ligada por padrão | rótulo de privacidade sem "Coarse Location" | declarar nas lojas ou `{"geoAttributes": false}` / `geo_lookup_enabled: false` |

---

## 12. O que NÃO reescrever (escopo)

A menos que o usuário peça:

- UI visual das telas (layout, cores de marca)
- Lógica de negócio específica (API de plantas, storage de garden, onboarding steps)
- `server/` PHP ou backend
- Trocar i18n local (`i18n-js`) pelo i18n do utils (opcional; plant manteve o local)
- Migrar paywall custom → `usePaywall` (opcional; plant manteve UI custom, só mudou fonte RC)

---

## 13. Comandos úteis pós-migração

```bash
# Types
npx tsc --noEmit

# Doctor
npx expo-doctor

# iOS (primeira build nativa demora)
npx expo run:ios --device "iPhone 16 Pro"

# Android
npx expo run:android

# Simulador screenshots (em vez de smctl)
xcrun simctl io booted screenshot /tmp/screen.png
xcrun simctl openurl booted "expoplantai://"

# Grep anti-regressão
rg -n "paywall_data|store_ratings_type|HotUpdater\.wrap|Utils\.prepare\(|hot-updater/babel-plugin|Colors\[colorScheme" src package.json babel.config.js || echo "OK limpo"
```

---

## 14. Mapa de arquivos alterados no expo-plant-ai (referência)

| Arquivo | Tipo de mudança |
|---------|-----------------|
| `package.json` / lock | Expo 57 + utils 1.2.5 + peers |
| `app.json` | limpeza SKAd, plugins, experiments |
| `babel.config.js` | plugin hot-updater novo |
| `src/constants/Strings.ts` | AppStrings |
| `src/constants/Colors.ts` | `getColors()` |
| `src/app/_layout.tsx` | ExpoUtilsLayout |
| `src/utils/plant-storage.ts` | PremiumUtils + free_limits path |
| `src/services/plant-api.ts` | remoteConfigScreens + file-system/legacy |
| `src/app/paywall.tsx` | screens.paywall + PremiumUtils.set |
| `src/app/result.tsx` | review_type + getColors + appearance |
| `src/app/(tabs)/*` | remoteConfigScreens / Utils + getColors |
| `src/components/*` | getColors |
| `hot-updater.config.ts` | deps ok (já formato novo) |

---

## 15. Prompt mínimo para outra IA

Cole isto no início da tarefa:

```text
Migre este app Expo legado para Expo SDK 57 + expo-utils 1.2.5.

Siga o arquivo docs/UPGRADE-EXPO57-EXPO-UTILS.md do zero ao fim, sem pular checklist.

Use como referência:
- ../expo-utils (package.json peers, templates/RootLayout.tsx, templates/Strings.ts)
- ../expo-meclivros (package.json, app.json, _layout, Strings)

Regras:
1. ExpoUtilsLayout no root; sem HotUpdater.wrap legado.
2. Strings = { hotUpdaterUrl, rckey, adUnits } por plataforma.
3. Firebase RC keys utils + screens; reescrever todas as leituras no código.
4. PremiumUtils para premium.
5. Remover SKAdNetworkItems do app.json.
6. babel: @hot-updater/expo/babel-plugin.
7. Reanimated 4 + react-native-worklets.
8. expo-file-system/legacy se usar uploadAsync/getInfoAsync.
9. getColors() se Colors[colorScheme] quebrar com "unspecified".
10. npx tsc --noEmit limpo; npx expo install --fix; não commitar secrets .env.hotupdater.
11. NÃO reescrever UI de features; só stack + contrato utils + breaking APIs.
12. Ao final, listar o que falta no Firebase Console (humano).
```

---

## 16. Status Firebase (ação humana, fora do repo)

Após o código, alguém com acesso ao Firebase Remote Config do app deve:

1. Criar/atualizar parâmetro **`utils`** (JSON) — ads/review/promo.
2. Criar/atualizar parâmetro **`screens`** (JSON) — api_url, free_limits, paywall, flags.
3. Remover dependência do JSON flat antigo (ou deixar de ler).
4. Publicar RC para os apps iOS/Android corretos.

Sem isso o app “compila e abre”, mas paywall/limites/API podem ficar vazios.

---

*Gerado a partir da migração real do expo-plant-ai (Expo 53 → 57 + expo-utils 1.2.5). Atualize este doc se o expo-utils mudar peers ou contrato de prepare/layout.*
