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
| README do utils | `expo-utils/README.md` (Remote Config `settings` com `utils` + `screens`, CLI) |

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
- Remote Config Firebase: parâmetro **`settings`** com os blocos `utils` e `screens` (lib 1.5.0+, seção 5.1); antes da 1.5.0, os parâmetros `utils` e `screens`
- `app.json` limpo (SKAd injetado pelo plugin no prebuild)
- Premium via **`PremiumUtils`**
- TypeScript limpo (`npx tsc --noEmit` exit 0 no app)

### 0.1 Expo SDK 58 (expo-utils 1.5.2)

A lib 1.5.2 serve os dois SDKs: app no **SDK 57** segue como está (RNFB 24–26, Hot Updater v0, stack iOS estático) e o
**SDK 58** muda o que está abaixo. **Combinação testada** em 27/10/2026 no Eleições 1.6.0 (SDK 58, RNFB 27.1.0, RNGMA
17.4.0): Release no iOS (Xcode 27.1, simulador) e no Android (`assembleRelease` com R8, instalado e aberto no emulador),
com exatamente a coluna da direita. No Android, o Release só abre com a lib **1.5.2** ou mais nova (linha "R8"
abaixo); com a 1.5.1 ele compila e fecha ao abrir.

| Tema | SDK 57 (como antes) | SDK 58 |
|---|---|---|
| Versões | expo 57, RN 0.86, React 19.2.3 | expo **58.0.19**, RN **0.88.0**, React **19.3.0**, `@types/react ~19.3.0`, TypeScript **~6.0.3** |
| Firebase | RNFB 24–26 | RNFB **27.1.0** (Firebase iOS 13 só por Swift Package; Android BoM 35) |
| iOS (`expo-build-properties`) | `useFrameworks: "static"` + RNFB* no `forceStaticLinking`; o plugin da lib põe `$RNFirebaseDisableSPM` | `useFrameworks: "dynamic"`, `forceStaticLinking: ["RNGoogleMobileAds", "react-native-fbsdk-next"]`; **sem** `$RNFirebaseDisableSPM` (o plugin não põe com RNFB 27) |
| Android (`expo-build-properties`) | — | `kotlinVersion: "2.4.20"` (o BoM 35 exige ≥ 2.4.0; **não** 2.4.21, ver 11) |
| R8 (Release Android) | desligado no template | **ligado** no template (`android.enableMinifyInReleaseBuilds=true`), e o AGP 9 não mantém mais o construtor vazio por `-keep class A`: o plugin da lib (**1.5.2+**, `androidR8KeepRules`) põe as regras do Room, do WorkManager e do Glance. **Não** desligar o R8 no app (ver 43) |
| Edge-to-edge | `react-native-edge-to-edge` (pode ficar) | sai (descontinuado; o RN ≥ 0.86 já desenha edge-to-edge): `["expo-navigation-bar", {"enforceContrast": false}]` |
| `@expo/ui` e `expo-device` | o `@expo/ui` vem com o expo-router | **dependência direta obrigatória**: a lib importa os dois e o expo-router 58 não traz mais o `@expo/ui` |
| AdMob | RNGMA 16.4+ (no 16.x o Pangle fica no `compat`, seção 3.3) | RNGMA **17.4.0** (o catálogo da mediação segue ele) |
| Hot Updater | v0 (0.35/0.36) | v0 ou **v1 1.1.3** com servidor novo (seção 2.4) |
| Plugin local `withPodsDeploymentTarget` | — | **não precisa** (o expo-modules-autolinking ≥ 57.0.5 corrigiu o expo#47537): apague se o app tiver |
| `experiments.buildCacheProvider` | `"eas"` | igual (o depreciado é o `experiments.remoteBuildCache`) |

Passo a passo para um app que já está no SDK 57 com a lib:

1. `npx expo install expo@^58.0.19` e depois `npx expo install --fix` (alinha os pacotes do Expo ao SDK);
   `react`/`react-dom` 19.3.0, `@types/react ~19.3.0`, `typescript ~6.0.3`.
2. Todos os `@react-native-firebase/*` em **27.1.0**; `react-native-google-mobile-ads` **17.4.0**;
   `react-native-purchases` 10.15.1; `@microsoft/react-native-clarity` 4.9.2.
3. `npx expo-utils-install` (instala `@expo/ui`, `expo-device` e `expo-navigation-bar` se faltarem, na versão do SDK)
   e `npx expo-utils-install --fix-ios-build --config` (o `--fix-ios-build` escreve o bloco do RNFB 27 lendo a versão
   instalada; o `--config` acrescenta o `expo-navigation-bar`).
4. Tirar o `react-native-edge-to-edge` do `package.json` e o plugin dele do `app.json` (o CLI não remove).
5. Hot Updater: ficar no v0 ou migrar para o v1 (seção 2.4).
6. `npx tsc --noEmit`, `npx expo-doctor`, `npx expo prebuild --clean` e build **Release** nas duas plataformas.

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
| @react-native-firebase/* | >=24 (SDK 57: 24–26, ideal **25.1.0** como meclivros; SDK 58: **27.1.0**) |
| @hot-updater/* / hot-updater | `>=0.35.3 <1 \|\| >=1.1.3 <2` (v0 por padrão; v1 só com servidor v1 — ver 2.4) |
| react-native-purchases | >=10.4.2 (SDK 58: 10.15.1) |
| react-native-google-mobile-ads | >=16.4.0 (SDK 58: **17.4.0**, o do catálogo da mediação) |
| @expo/ui, expo-device | >=57 — **obrigatórios** como dependência direta (a lib importa os dois; o expo-router 58 não traz o `@expo/ui`) |
| expo-navigation-bar | >=57, opcional (substitui o `react-native-edge-to-edge`) |
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

**SDK 58: todos em 27.1.0.** O Firebase iOS 13 só vem por Swift Package: frameworks dinâmicos no iOS e Kotlin 2.4.20
no Android (seção 3.3). O `--fix-ios-build` escolhe a configuração pela versão instalada.

### 2.4 Hot Updater

**Duas gerações que não se falam** (guia "Move from v0 to v1" do hot-updater.dev): binário v0 só fala com servidor
v0, binário v1 só com servidor v1. A lib atende as duas com o mesmo `initHotUpdater`, que descobre a geração pela API
instalada (`checkForUpdate` estático = v0). Os peers aceitam as duas (`>=0.35.3 <1 || >=1.1.3 <2`).

**v0 — padrão do `expo-utils-install --hot-updater` (todo app no ar hoje):**

```text
@hot-updater/react-native   0.36.19   (faixa >=0.35.3 <1)
@hot-updater/expo           0.36.19   (devDependency)
@hot-updater/cloudflare     0.36.19   (devDependency)
hot-updater                 0.36.19   (devDependency)
```

- Plugin `["@hot-updater/react-native", {"channel": "production"}]`; `hotUpdaterUrl` = `https://<worker-v0>/api/check-update`.
- Em binário novo, prefira a **0.36.19** (último da v0) e evite 0.36.14–0.36.17 (rollback falso depois de push com o
  app fechado, gronxb/hot-updater#1468, corrigido na 0.36.18). `npm view @hot-updater/react-native dist-tags`: a v0
  fica na tag `v0`.
- **Nunca** deixe spec sem teto (`>=0.35.3`): o `latest` do npm é a 1.x desde 20/10/2026 e um install novo pegaria o
  v1 com o servidor v0. O CLI escreve `>=0.35.3 <1` e trava um spec v0 sem teto que encontrar.

**v1 — `expo-utils-install --hot-updater-v1` (ou o `--hot-updater` num app que já declara a 1.x); só em binário NOVO:**

```text
@hot-updater/react-native   1.1.3   (faixa >=1.1.3 <2)
@hot-updater/expo           1.1.3   (devDependency: plugin do Expo + adaptador de build)
@hot-updater/cloudflare     1.1.3   (devDependency)
hot-updater                 1.1.3   (devDependency)
```

1. **Servidor novo**: `npx hot-updater init` com **D1 e Worker novos** (o init do v1 recusa recursos do v0). O v0
   continua no ar para os binários antigos. Guarde a URL do Worker v1 e a `HOT_UPDATER_API_KEY`.
2. `.env.hotupdater` com as chaves do v1 (`templates/.env.hotupdater.v1.template`): `ACCOUNT_ID`, `API_TOKEN`,
   `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PRIVATE`, `WORKER_NAME`, `D1_DATABASE_ID`,
   `D1_DATABASE_NAME` (todas com o prefixo `HOT_UPDATER_CLOUDFLARE_`) e `HOT_UPDATER_API_KEY`. O CLI acrescenta as que
   faltam sem mexer nas existentes — troque as do D1/Worker do v0 pelas novas (ou deixe vazias para o init criar).
3. `app.json`: `["@hot-updater/expo", {"channel": "production"}]` **no lugar** do `@hot-updater/react-native` (o pacote
   RN 1.x não tem `app.plugin.js`; os dois juntos nunca). O CLI troca e mantém as opções (`channel`, `publicKeyPath`).
4. `Strings.ts`: `hotUpdaterUrl` = raiz do Worker v1, **sem** `/api/check-update`, e `hotUpdaterApiKey` = a
   `HOT_UPDATER_API_KEY` (o CLI insere a chave e copia o valor do `.env.hotupdater` quando ele existe). Tirar o
   `/api/check-update` da URL do v0 não serve: é outro servidor.
5. `hot-updater.config.ts`: sem `compressStrategy`; `r2Storage({credentials: {accessKeyId, secretAccessKey}})`;
   `plugins: [apiKeys(), insights(), remoteConfig()]` de `hot-updater/plugins` (o init gera o modelo).
6. Boot: nada muda no `ExpoUtilsLayout` (`initHotUpdater(appStrings.hotUpdaterUrl, {apiKey: appStrings.hotUpdaterApiKey})`).
   App com instância própria (`export const hotUpdater = HotUpdater.init({...})` num módulo, como o Eleições):
   `initHotUpdater(hotUpdater)` — a lib usa a do app e não cria outra. No v1, URL de v0 ou chave ausente viram o aviso
   `initHotUpdater: … OTA desligado.` e nada roda.
7. Conferir: `npx hot-updater doctor --server-base-url <url v1>`, build Release, OTA num canal de teste e rollback.
   `getRunningBundleId()` (export da lib) é o pacote que está rodando; no v1 o `getBundleId()` da instância já aponta
   para o baixado antes de reiniciar.

### 2.5 Ads / IAP / tracking / utils peers

```text
react-native-google-mobile-ads   16.4.0   (SDK 58: 17.4.0)
react-native-purchases           10.4.2   (SDK 58: 10.15.1)
react-native-fbsdk-next          13.4.3
expo-navigation-bar              ~57/~58  (no lugar do react-native-edge-to-edge, descontinuado)
react-native-fs                  2.20.0
@microsoft/react-native-clarity  4.6.3    (SDK 58: 4.9.2)
@react-native-async-storage/async-storage  2.2.0
@react-native-community/slider   5.2.0
expo-tracking-transparency       ~57.0.1
expo-device                      ~57.0.1
expo-video                       ~57.0.1
expo-tiktok-ads-events           0.1.6
react-native-applifecycle        1.0.0    (opcional; Android: gatilho do app open, ver §8)
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
@expo/ui                         ~57.0.19  # já vem com o expo-router 57 (dependência dele); declare mesmo assim
                                           # (pnpm não içaria). Os botões do review/retenção usam o glass nativo
                                           # e o Alert.alert passa a ser desenhado por ele (seção 4.2.2).
                                           # SDK 58: ~58.0.23 e OBRIGATÓRIO no package.json — o expo-router 58 não
                                           # traz mais (virou peer opcional dele) e o import da lib quebra o bundle.
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

4. `android.edgeToEdgeEnabled` se o schema do Expo 57 reclamar (expo-doctor: *should NOT have additional property*). Edge-to-edge via plugin `react-native-edge-to-edge` no SDK 57; no **SDK 58** o plugin e o pacote saem (descontinuado — o RN ≥ 0.86 já desenha edge-to-edge e o tema do SDK 58 já é `Theme.AppCompat.DayNight.NoActionBar` com `edgeToEdgeEnabled=true`) e entra o `expo-navigation-bar` (abaixo).

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

**Único bloco `expo-build-properties`** — depende da versão do RNFirebase (o `--fix-ios-build` lê a instalada e escreve
o certo):

RNFB 24–26 (SDK 57):

```json
[
  "expo-build-properties",
  {
    "ios": {
      "useFrameworks": "static",
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

RNFB 27+ (SDK 58; combinação testada no Eleições, seção 0.1):

```json
[
  "expo-build-properties",
  {
    "ios": {
      "useFrameworks": "dynamic",
      "forceStaticLinking": ["RNGoogleMobileAds", "react-native-fbsdk-next"]
    },
    "android": {
      "kotlinVersion": "2.4.20"
    }
  }
]
```

- Com o RNFB 27 os pods RNFB* **não** podem estar no `forceStaticLinking` e o estático aborta o `pod install` ("SPM +
  static linkage is not supported"). O `RNGoogleMobileAds` fica estático pela doc do RNGMA e o `react-native-fbsdk-next`
  pela fbsdk-next#678.
- `useModularHeaders` **sai**: não é chave do `expo-build-properties` e era ignorado em silêncio.
- `$RNFirebaseDisableSPM` é decidido pelo plugin da lib pela versão do RNFB instalada (24–26 sim, 27+ não): **não
  ponha `firebaseDisableSPM` no `app.json`**.

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

**Mediação (`mediation`, ligada por padrão):** não declarar SDK de rede do catálogo à parte. Desde
07/10/2026 o plugin já acrescenta `com.unity3d.ads:unity-ads` no Android (o adapter da Unity não traz o
SDK — sem ele a Unity fica com 0% de match). App migrado que tinha a chave própria `"unity-sdk"` no
`mediation` (caso do expo-bobbie-goods) pode removê-la; se ficar, o prebuild gera **uma** linha só e a
versão do app.json vence. Conferir com `grep -n "unity" android/app/build.gradle` depois do prebuild.

**barra de navegação (Android):**

```json
["expo-navigation-bar", {"enforceContrast": false}]
```

No lugar do `["react-native-edge-to-edge", {"android": {"parentTheme": "Default", "enforceNavigationBarContrast": false}}]`
de antes (o `parentTheme` não precisa de nada no SDK 58). App no SDK 57 pode manter o edge-to-edge; os dois juntos
gravam o mesmo `enforceNavigationBarContrast=false`.

**experiments:**

```json
"experiments": {
  "typedRoutes": true,
  "reactCompiler": true,
  "buildCacheProvider": "eas"
}
```

**Hot updater plugin** (um só, o da geração — seção 2.4):

```json
["@hot-updater/react-native", { "channel": "production" }]
```

v1: `["@hot-updater/expo", { "channel": "production" }]` no lugar do de cima.

**Ordem de plugins (padrão limpo):**

1. Strings simples: `expo-router`, `expo-localization`, `expo-mail-composer`, `expo-sharing`, `expo-font`, `expo-video`, `expo-web-browser`, `@react-native-firebase/app`, `@react-native-firebase/crashlytics`
2. Com config: splash, build-properties, image-picker/camera (se houver), tracking-transparency, google-mobile-ads, fbsdk-next, expo-navigation-bar, expo-utils, hot-updater

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
#   --hot-updater-v1 no lugar do --hot-updater só para binário novo com servidor v1 (seção 2.4)
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

const hotUpdaterUrl = "https://SEU-WORKER.workers.dev/api/check-update"; // v1: raiz do Worker v1
const hotUpdaterApiKey = "";  // só Hot Updater v1: a HOT_UPDATER_API_KEY do servidor (x-api-key)

const ios = {
  hotUpdaterUrl,
  hotUpdaterApiKey,
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
  hotUpdaterApiKey,
  rckey: "goog_…",
  adUnits: { /* … */ },
};

export default Platform.OS === "android" ? android : ios;
```

**Conferir:**

- [ ] `hotUpdaterUrl` aponta para o worker **deste** app (v0: termina em `/api/check-update`; v1: a raiz do Worker v1 + `hotUpdaterApiKey` preenchida)
- [ ] `rckey` iOS começa com `appl_`, Android com `goog_`
- [ ] Ad units reais (não placeholder `…/0000` — no plant o interstitial Android estava quebrado e foi restaurado para o ID real)
- [ ] Placeholder `YOUR_REVENUECAT` desativa RevenueCat no utils — nunca deixe em produção
- [ ] (opcional, só Android com campanha na Meta) `metaInstallReferrerKey: "<hex de 64 chars>"` no bloco `android` — ou, melhor, `meta_install_referrer_key` no Remote Config (§5.4), que tem prioridade e troca sem release

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

- `initHotUpdater(appStrings.hotUpdaterUrl, {apiKey: appStrings.hotUpdaterApiKey})` (v0 e v1; seção 2.4)
- `Utils.prepare` (Remote Config, RevenueCat, globals)
- App-open ads listener
- Promo modal
- Ask-for-review overlay
- ATT pós-primeiro-frame (`Utils.handleReady`)
- Splash control
- Atribuição do RevenueCat em duas fases + geo por IP + telemetria (v1.4.0 — seção 4.2.1)
- `Alert.alert` desenhado pelo Expo UI: SwiftUI no iOS, Material 3 no Android (seção 4.2.2)

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
  origem do install no Android (Play Install Referrer → Media Source / Campaign / Keyword / Creative;
  anúncio da **Meta** vem cifrado e é aberto no aparelho com a `meta_install_referrer_key`),
  `setUserId` do GA4 = App User ID do RevenueCat. Desde 07/10/2026 o referrer é lido **1x por install**
  (AsyncStorage `@expo_utils_install_referrer`) e o `install_attribution` (`play_referrer`) sai só nessa
  leitura; o id do clique do Google Ads segue em `gclid` + `click_id_type` (`gclid`/`gbraid`/`wbraid`).
- **Link-in-bio** (`trends_tracking_url`): a flag `tr_is_first_launch_tracking` só é gravada com resposta
  do servidor; falha de rede vira `install_attribution_error` e tenta de novo na próxima abertura. Não
  apagar essa chave no app (reenviaria o install).
- **Meta × RevenueCat (configuração)**: com a integração Meta do RC ligada **e** `autoLogAppEventsEnabled:
  true` no plugin do `react-native-fbsdk-next`, a compra pode chegar 2x na Meta (servidor do RC + log
  automático do SDK). Conferir no Events Manager e manter uma fonte só; a lib não muda essa flag.
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
- **Tópicos de assinatura (FCM)**: a lib mantém o aparelho em UM tópico de estado
  `{slug}-purchase-{status}` (`free`, `trial`, `trial_cancelled`, `intro`, `active`, `cancelled`,
  `billing_issue`, `trial_expired`, `expired`, `refunded`) e nos marcos acumulados
  `{slug}-purchase-trial_started` / `{slug}-purchase-converted` (`utils/rc-status.ts`). **Mudou o
  significado de `trial`**: trial cancelado agora é `trial_cancelled` e a cobrança do fim do trial que
  falhou é `billing_issue` — sender que mirava `-purchase-trial` para "trial cancelado" precisa trocar
  de tópico. **Não reimplementar no app** (nada de `subscribeToTopic` de status no app host) e não
  apagar a chave `FCM_CURRENT_TOPIC` do AsyncStorage: é por ela que a lib sai do tópico antigo.
- **Params de push renomeados**: `topic` → `fcm_topic` e `message_id` → `fcm_message_id` em `push_received`,
  `push_received_bg`, `push_opened` e `fcm_topic_*`. Os nomes antigos NUNCA chegavam ao GA4 (o SDK envia, o GA4 não
  mostra — provável colisão com os nomes que o FCM usa nos próprios eventos). Dimensão personalizada criada como `topic` → recriar como `fcm_topic`.
  Evento próprio do app também não pode usar `topic` / `message_id` como nome de parâmetro.

Exports novos do pacote (`index.ts` **e** `index.d.ts`): `logUtilsEvent`, `setUtilsUserId`,
`setUtilsUserProperty`, `AnalyticsParams`, `setRevenueCatAttributes`, `scheduleRcSync`,
`getContextAttributes`, `lookupGeo`, `GEO_PROVIDERS`, `GeoResult`. Catálogo de eventos:
`docs/ANALYTICS-EVENTS.md`.

### 4.2.2 `Alert.alert` nativo (Expo UI)

**O app não muda nada:** continua chamando `Alert.alert` do `react-native`. Com o `NativeAlertSlot` montado, a lib troca
o método e desenha o diálogo pelo `@expo/ui`: `Alert` do SwiftUI no iOS, `AlertDialog` do Material 3 no Android
(`utils/native-alert.ts`, `utils/native-alert-slot.tsx`, `utils/native-alert-dialog.ios.tsx` / `.android.tsx`).

- **Quem monta:** o `AskForReviewOverlay`, que o `ExpoUtilsLayout` sempre renderiza (o template `RootLayout.tsx` e o lab
  renderizam o overlay sem o `ExpoUtilsLayout`). App sem nenhum dos dois (ex.: só com o `PromotionalContent`, como o
  expo-eleicao): `<NativeAlertSlot />` no `_layout`, senão continua no Alert do RN.
- **Comportamento novo:** um diálogo de cada vez (fila). Alerta chamado dentro do `onPress` de outro aparece depois dele;
  no Android o RN abria o 2º por cima do 1º. No iOS o próximo espera meio segundo depois de o anterior fechar. Cada
  botão chama o `onPress` uma vez só.
- **Igual ao RN:** `cancelable` padrão `false` (só fecha por botão); `cancelable: true` + `onDismiss` só no Android; no
  máximo 3 botões no Android (o último no Confirm, os anteriores no Dismiss, na ordem); sem botões, um "OK" (no iOS, o
  do sistema, traduzido). `destructive` na cor de erro do Material 3 no Android e com `role` destrutivo no iOS; no iOS a
  Apple pode reordenar os botões pelo role. Ignorados nesse caminho: `userInterfaceStyle` e `isPreferred`.
- **Cor no Android:** `seedColor` no `Strings.ts` (AppStrings) vai para o Host e gera a paleta do Material 3 do
  alerta (fundo e botões). Sem ele, a cor dinâmica do aparelho (papel de parede), que tira a identidade do app.
- **Cai no Alert do RN, com os mesmos argumentos:** alerta antes de o layout montar, app sem slot e erro ao carregar ou
  desenhar o diálogo (`expo_utils_warn`; depois de um erro, o resto da sessão fica no Alert do RN). O `Alert.prompt`
  nunca passa pela lib.
- **Binário sem o módulo nativo `ExpoUI` não é coberto:** o diálogo e o `glass-button.tsx` (review e retenção) importam
  o `@expo/ui` no topo (regra de imports), e o `@expo/ui` lança no carregamento sem o módulo; o app cai no boot.
- **Dependência:** nenhuma nova e sem rebuild no SDK 57 (o `@expo/ui` vem com o expo-router 57). No SDK 58 o expo-router
  deixou o `@expo/ui` opcional: o app precisa declará-lo antes de gerar o binário, porque a OTA com esta lib chega a todo
  binário da mesma versão do app.
- **Export novo** (`index.ts` / `index.d.ts`): `NativeAlertSlot`.
- **Ainda não visto no aparelho.** Conferir antes de soltar (seção 10.3), principalmente no iOS, onde o alerta sai de
  um Host na raiz do app e não de uma janela própria como o do RN: alerta com um `Modal` ou uma tela `modal` /
  `fullScreenModal` aberta, com intersticial ou app open na tela, e alerta aberto logo depois de outro. Se o UIKit
  recusar a apresentação, nenhum evento volta e os alertas seguintes ficam presos na fila até o app fechar.

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

Já no formato `@hot-updater/cloudflare` + `expo()` + `updateStrategy: "appVersion"` → só garantir deps 0.35.x/0.36.x.  
Não misturar API do hot-updater 0.20. No v1 o arquivo muda (sem `compressStrategy`, credenciais do R2, `plugins`): seção 2.4.

---

## 5. Remote Config — migração de código + Firebase

### 5.1 Modelo novo (expo-utils 1.5.0+)

Os dois blocos ficam num parâmetro só, **`settings`**, com um valor por plataforma (cada plataforma é um app no
Firebase, com a sua condição):

```json
{
  "utils":   { "is_ads_enabled": true, "review_type": "store-review" },
  "screens": { "api_url": "https://…", "cross_promo": { "enabled": true } }
}
```

| Bloco | Global no app | Conteúdo |
|-------|---------------|----------|
| `utils` | `global.remoteConfigUtils` | o que a lib lê: ads, review, promo, clarity, tiktok, min_version… (`RemoteConfigUtilsType`) |
| `screens` | `global.remoteConfigScreens` (`RemoteConfigScreensType`) | features do app: api, paywall, limits, flags + **`cross_promo` (obrigatório em todo app — ver 5.3)** |
| os dois | `global.remoteConfigs` | os dois blocos juntos; em conflito vale o `utils`. Até a 1.4 era apelido do `remoteConfigUtils` |

- **Publicar:** `pldev firebase rc push`. O pldev olha a versão **instalada** da lib (`node_modules/expo-utils`):
  abaixo da 1.5.0 publica os parâmetros `utils` e `screens`, como antes; da 1.5.0 em diante cria e atualiza o
  `settings` com a condição `app.id` + `app.version >= V` (V = a primeira versão do app com a lib nova) e continua
  publicando cópias de `utils` e `screens` para os builds antigos até `pldev firebase rc legacy off`. Plano completo:
  `docs/PLANO-SETTINGS.md`.
- **Sem o `settings` no formato de blocos** (ausente, JSON inválido ou o `settings` plano de antes de fevereiro de
  2026), a lib lê os parâmetros `utils` + `screens`, como antes. O evento `cfg_integrity` diz qual caminho valeu:
  `cfg_source` = `settings`, `legacy` ou `default`.
- **Nunca publique `settings` com blocos sem a condição de versão** em app que ainda tem build com a lib 1.0.x nas
  lojas: esses builds leem o `settings` no formato plano antigo (caso real: o expo-urna e o expo-urna-v2 são o mesmo
  app Android no Firebase).
- Antes da 1.5.0 os blocos eram os parâmetros `utils` (→ `remoteConfigUtils` e o apelido `remoteConfigs`) e `screens`
  (→ `remoteConfigScreens`), com o mesmo conteúdo.

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

### 5.3 Exemplo do bloco `screens` (plant)

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

Para preencher o `cross_promo` (e o `promotional` do bloco `utils`) sem digitar à mão: gerador em <https://pixel-logic-apps.github.io/expo-utils/> (`docs/index.html` deste repo) — cola o link da App Store/Google Play do app anunciado e ele devolve o JSON pronto.

### 5.4 Exemplo mínimo do bloco `utils`

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
  "geo_lookup_url": "",
  "meta_install_referrer_key": ""
}
```

Valores de `review_type`: `"store-review"` | `"popup"` | `"dialog"`.

`geo_lookup_enabled` (v1.4.0, default `true`): `false` desliga a geo por IP sem build novo.
`geo_lookup_url` (opcional, só `https`): endpoint próprio tentado antes dos provedores gratuitos
embutidos (ipwho.is → BigDataCloud → GeoJS); contrato `{country, region, regionCode, city}`.

`meta_install_referrer_key` (v1.4.0, opcional, só Android): a **“Install Referrer Decryption Key”** do app
na Meta (Meta for Developers → Configurações do app → Básico → Android; hex de 64 chars). Com ela, o
install vindo de anúncio do Facebook/Instagram grava no customer do RevenueCat Media Source
(`Instagram Ads`/`Facebook Ads`/…), Campaign, Ad Group e Ad com os nomes reais — sem MMP. Sem ela a lib
marca só a rede e guarda o dado cifrado (`meta_ref_*`). Tem prioridade sobre
`AppStrings.metaInstallReferrerKey`. Conferir em produção pelo parâmetro `meta` do evento
`install_attribution` (`decrypted` = chave certa; `decrypt_failed` = chave errada).

Pré-carga e espera dos anúncios de tela cheia (opcionais; sem as chaves = comportamento de antes, então não precisam
entrar no JSON da migração): `appopen_preload_enabled` / `interstitial_preload_enabled` (padrão `false`),
`appopen_preload_max_age_minutes` (padrão 240) / `interstitial_preload_max_age_minutes` (padrão 60),
`ad_preload_error_pause_seconds` (padrão 0) e `ad_load_max_wait_seconds` (padrão 0 = sem limite). Mudam só como e
quando o anúncio carrega; posição e frequência continuam com o app. Detalhes no README ("App open: volta ao app e
pré-carga").

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
**Botões: glass nativo no iOS 26, cápsula no resto (`utils/glass-button.tsx`, 1.5.1).** No iOS 26+ o review e o
modal de retenção usam o botão Liquid Glass do SwiftUI pelo `@expo/ui` (`glassProminent` com tint: a cor do app
no principal, cinza `#E9E9EB` — o `secondarySystemFill` que o iOS desenha no `bordered` — no "Agora não"). O
`glass` puro ficou de fora: sobre o card branco ele sai `#FDFDFD`, igual ao fundo, e o botão some (medido no
simulador). Android, iOS < 26 (o `@expo/ui` troca `glassProminent` por um botão sem fundo) e binário sem o módulo
nativo `ExpoUI` (JS novo por OTA num binário antigo): cápsula em RN com os números medidos no nativo — 50 de
altura, texto 17 **regular** (o peso do rótulo nativo), ponta em meio círculo pelo `borderRadius`. O módulo
nativo já está em todo binário SDK 57 com expo-router, então **não precisa de rebuild**; no SDK 58 o `@expo/ui` tem que
estar no `package.json` do app (o expo-router 58 não traz mais). "Agora não" **só texto**
(`variant="text"`: sem fundo nem borda, na cor do app, 44 de altura; no iOS 26 um botão SwiftUI `plain`) no
`centered` do review e no modal de retenção; nos outros layouts ele é a cápsula cinza. O `Host` do SwiftUI leva
`ignoreSafeArea="all"`: sem isso o vidro ficava 17pt acima do lugar quando o card entrava deslizando por baixo da
tela (formsheet e contagem — o SwiftUI aplicava a área segura de baixo e não desfazia).
Espaços: título e mensagem a 4 um do outro, 32 do texto até os botões (bottomsheet, centered e formsheet — com 24
o texto parecia colado no botão, com 40 alto demais), 12 entre os botões, 20 até o fim do card; no `fullscreen` a imagem fica no topo e o texto no meio do espaço
até o botão do rodapé; na retenção 12 entre botão, cartão da 2ª oferta e "Agora não", e o rodapé termina na área segura + 8.
Azul padrão `#1582EC` (antes `#007AFF`); app que passa `colors` continua com o `primary` dele, e `colors.secondary`
(novo, opcional) troca o cinza — sem ele vale o `border`, como antes. Durante o `review_type_delay` o "Agora não"
fica desabilitado (iOS: o desabilitado do sistema + opacidade 0.5; Android: opacidade 0.4).
**Cantos em squircle, sem dependência.** Card (`bottomsheet` 40, `centered` 28) e mídia (24) usam
superelipse em vez do arco circular do `borderRadius` — `utils/squircle.tsx`, um
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

### 5.4.2 Modal de retenção (`retention`, opcional)

- Chave nova e **opcional** no bloco `utils`: `retention` (`RetentionConfig` em `utils/types.ts`). Sem ela, fica
  desligado. Não migre nada: app que não usa continua compilando igual. O formato da fase 1 (`enabled`, `style`,
  `max_shows`, `reminder_hours`, `image_url`, `texts` com `header`/`body`/`bullets`/`cta`/`dismiss`) continua tipando.
- Formato novo (08/10/2026, plano `docs/PLANO-RETENCAO-OFERTAS.md`): `segments.<segmento>.offers` (lista na ordem; a lib
  não tem regra própria de "quem vê o quê") e `offers.<nome>` com `type` (`resubscribe` e `winback` são embutidas).
  Oferta sem `product_id` = a mesma assinatura que a pessoa tinha; com `product_id` = aquele produto.
- **Nenhuma linha nova no app.** O modal é montado pelo `ExpoUtilsLayout`, pelo `AskForReviewOverlay` e pelo
  `PromotionalContent` (só um desenha). App que não renderiza nenhum dos três: `<RetentionModalSlot />` no `_layout`.
- Botões iguais aos do review (seção 5.4.0): glass nativo no iOS 26 e "Agora não" só texto, na cor do app.
- **Formato (10/10/2026):** `retention.style` = `"bottomsheet"` ou `"fullscreen"`, igual nas duas plataformas
  (`fullscreen` no iOS é a folha nativa `pageSheet`; no Android, uma folha da altura da tela). Override por chamada:
  `style` no `showRetention`/`showRetentionPreview`/`RetentionEvents.show`. Sem a chave nada muda: `fullscreen` no iOS e
  `bottomsheet` no Android, como antes; o `"sheet"` da fase 1 também cai nesse padrão. Tipo novo `RetentionStyle`
  (exportado), `RetentionRequest.style` sempre preenchido, e os eventos `retention_*` do modal ganharam o parâmetro
  `style` (`docs/ANALYTICS-EVENTS.md`). Junto: arrastar para baixo passou a fechar a folha (antes o `Modal` do RN ficava
  com o toque e o arraste não fazia nada).
- Ainda **não abre sozinho** (a detecção é a próxima fase), mas **compra de verdade** desde 08/10/2026: o app chama
  `showRetention({segment?, offers?, ...})`, que lê o customerInfo, confere as ofertas na loja (preço sempre da loja) e
  abre o modal; o toque compra (`purchaseRetentionOffer`) ou abre o resgate do código. Nada muda para quem não chama.
  Precisa do RevenueCat configurado (sem ele, `reason: "rc_unavailable"`) e, no Remote Config, da lista
  `retention.segments.<segmento>.offers` (ou das ofertas passadas pelo app). Para ver sem loja:
  `showRetentionPreview({segment, offers, state, locale, variant, imageUrl})` ou o item **Simular trial cancelado** do
  menu de dev. Eventos novos `retention_*` (`docs/ANALYTICS-EVENTS.md`).
- Exports novos (`index.ts` / `index.d.ts`): `showRetentionPreview`, `RetentionEvents`, `RetentionModalSlot` e os tipos
  `RetentionConfig`, `RetentionTexts`, `RetentionTranslations`, `RetentionVariant`, `RetentionShowPayload`,
  `RetentionRequest`, `RetentionPreviewOptions`, `RetentionCloseMethod`, `RetentionClosedEvent` e (08/10)
  `RetentionSegment`, `RetentionOfferType`, `RetentionSegmentConfig`, `RetentionOfferConfig`, `RetentionPeriodUnit`,
  `RetentionPluralForms`, `RetentionOffer`, `RetentionOfferInput`, `RetentionPrice`, `RetentionPeriod`, `RetentionModalState`.
  Compra (08/10/2026): `showRetention`, `resolveRetentionOffers`, `purchaseRetentionOffer`, `redeemRetentionCode`,
  `findRetentionPreviousProduct` e os tipos `ShowRetentionOptions`, `ShowRetentionResult`, `ShowRetentionReason`,
  `ResolveRetentionOffersOptions`, `ResolvedRetentionOffers`, `RetentionPreviousProduct`, `RetentionPurchaseResult`,
  `RetentionRedeemResult`, `RetentionSkippedOffer`, `RetentionSkipReason`, `RetentionOfferAction`, `RetentionStoreRef`.
  `RetentionCloseMethod` ganhou `purchased` e `redeem`; `RetentionTranslations` ganhou `purchaseError` e
  `purchasePending` (só quebra app que monta um `Translations` à mão).
- `Translations` (i18n) ganhou o campo obrigatório `retention`, e `RetentionTranslations` ganhou (08/10) `segments`,
  `ctas`, `cards`, `notice` e `units`. Só quebra app que monta um `Translations` à mão.
- `RetentionTexts` aceita qualquer chave (`billing_issue.title`, `offers.<nome>.cta`…); `RetentionRequest` agora sempre
  tem `segment`, `offers` e `state` (o `RetentionEvents.show` preenche; sem eles = trial cancelado + "Reativar").
- O texto muda com o `is_opted_out_trial_enabled` (seção 6) no `trial_cancelled` e no `cancelled`: `true` = "Premium até o fim".

```json
"retention": {
  "enabled": true,
  "style": "bottomsheet",
  "segments": {"billing_issue": {"offers": ["resubscribe", "lifetime_deal"]}, "expired": {"offers": ["resubscribe"]}},
  "offers": {"lifetime_deal": {"type": "lifetime", "product_id": "lifetime_retention", "compare_product_id": "lifetime"}},
  "image_url": "https://…/retencao.png",
  "texts": {"pt": {"billing_issue.title": "…", "offers.lifetime_deal.cta": "…"}}
}
```

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
- Premium = entitlement ativo **sem** cancelamento (`unsubscribeDetectedAt`) e **sem** falha de cobrança:
  assinatura/trial renovando, compra **vitalícia**, plano **PREPAID** do Play e concessão **promocional**
  (`isPremiumEntitlement` em `utils/PremiumUtils.ts`, mesmo veredito do `rc_status = active`). Quem
  cancelou perde na hora, exceto com a flag RC `is_opted_out_trial_enabled` (aí basta assinatura ativa).
  Até 07/10/2026 a regra exigia `willRenew` e o vitalício "remover anúncios" seguia vendo anúncio — app
  com workaround local para isso pode voltar a usar só `PremiumUtils.getIsPremiumStatus()`.

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

Use URL em `appStrings.hotUpdaterUrl` + `initHotUpdater` dentro do `ExpoUtilsLayout`. No v1 o `HotUpdater` só tem
`init` (wrap, checkForUpdate, getBundleId e reload ficam na instância): `HotUpdater.wrap(...)` estático quebra o app ao
abrir. A lib já trata as duas gerações (seção 2.4).

---

## 8. Ads / review (mínimo a validar)

- Manter imports:
  - `expo-utils/utils/banner-ad`
  - `expo-utils/utils/LoadAdsManager`
  - `expo-utils/utils/styles` (ExpoUtilsStyles)
- `LoadAdsManager.showInterstitial()` — na lib nova **não pendura** (sempre resolve)
- **App open no Android:** instalar `react-native-applifecycle` (1.0.0, peer opcional) e fazer **build nativo novo**
  (o autolinking do prebuild liga o módulo; nada a editar em `android/`). OTA sozinho não traz o módulo. A lib detecta
  `NativeModules.ReactNativeAppLifecycle` e passa a decidir a volta pelo `ProcessLifecycleOwner`: fechar diálogo de
  permissão, intersticial, folha de compra ou de compartilhamento deixa de mostrar app open. Não importe o pacote no
  app para isso. Sem ele, e no iOS, fica o `AppState`, como antes.
- Pré-carga e espera máxima dos anúncios: chaves opcionais do `utils` (§5.4), desligadas por padrão; nada muda no
  código do app.
- Review local do app pode coexistir com overlay da lib — controle via `review_type` no RC para não double-prompt
- `global.isAdsEnabled` / store gate: se `disableAdsIfBuildIsNewerThanStore: true`, ads desligam em build mais nova que a loja

<a id="taichi"></a>

### Taichi: marcos de receita de anúncios

- Os callbacks existentes passam a acumular receita positiva em USD e emitir 60 nomes: 20 limites de US$ 0,0001 a US$ 0,25 × primeiras 24h, 72h e 168h. Lista completa em [ANALYTICS-EVENTS.md](ANALYTICS-EVENTS.md#taichi). São eventos de qualificação para contagem/tCPA, sem `value`; não somar marcos como receita. O tROAS nativo de publicidade usa `ad_impression`.
- Manter `Utils.prepare` no boot e usar os componentes/managers de ads da lib. O acumulador inicializa sem bloquear a UI, antes de `logFirstOpenOnce`; nenhum timer, plugin ou pacote nativo novo. Não repetir a coleta no host.
- `utils.taichi_events` (array opcional no JSON `utils`): ausente = todos; `[]` = desliga as emissões; lista de nomes = só aqueles. Exemplo: `{"taichi_events":["taichi_rev_0_001usd_24h","taichi_rev_0_003usd_72h"]}`. A soma continua com `[]`; habilitar depois permite qualificar um marco ainda não emitido no próximo callback válido, dentro do prazo. Não muda o significado dos nomes nem reinicia os prazos.
- Preservar `@first_open_logged` e `@expo_utils_taichi_v1`. Instalação com a flag antiga e sem estado Taichi fica excluída para não parecer nova ao atualizar. **Apps legados que nunca gravaram essa flag:** usar o marcador de instalação/primeiro uso já existente no host para gravar `@first_open_logged = "true"` nos usuários antigos, antes de `Utils.prepare`. A ausência dos dois marcadores é interpretada como primeiro uso; não é possível reconstruir esse histórico somente com o SDK de ads.
- Persistência é local por instalação. Sem dados válidos de moeda/valor não há marco; BRL não vira USD implicitamente. `ad_revenue` passa pelo logger central e omite `value`/`currency` ausentes, em vez de inventar zero/USD. Duplicações de fullscreen são filtradas por instância; banners dependem da identidade disponível no callback, nunca do preço.
- QA: em build do lab, conferir os callbacks, a soma persistida e os nomes no DebugView, incluindo reabertura e vencimento da janela. Ads de teste podem informar zero; valores sintéticos só validam a lógica e o transporte, não a receita real do AdMob. Conferir depois a importação no Google Ads e escolher a conversão da campanha.
- Validação em 23/09/2026: build Android do lab no Pixel_10a, com os **60 nomes vistos no DebugView de `local-desenv`, contagem 1 em cada um**, após repetição de callback e reabertura do processo. Receita positiva sintética para testar os limites; interstitial com ID de teste também entregou `PAID` nativo com USD/zero. [Evidências e roteiro](VALIDACAO-TAICHI.md). Não extrapolar para receita positiva de produção, iOS ou conversões importadas no Google Ads.

---

## 9. Ordem de execução (copy-paste mental)

```text
1.  Ler expo-utils package.json (versão + peers)
2.  Ler meclivros (package/app.json/_layout/Strings) como moldes
3.  Grep legado no app-alvo (seção 1.2)
4.  Reescrever package.json (core + peers + product packages)
5.  npm pack expo-utils 1.2.5 + npm install
6.  npx expo install --fix
7.  Reescrever app.json (SKAd out, plugins limpos, expo-build-properties pela versão do RNFB, flags utils)
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
- [ ] Um único `expo-build-properties`: RNFB 24–26 → `static` + `forceStaticLinking` RNFB*; RNFB 27 → `dynamic` +
      `forceStaticLinking` RNGoogleMobileAds/react-native-fbsdk-next + `android.kotlinVersion: "2.4.20"`; sem `useModularHeaders`
- [ ] Plugin `expo-utils` com flags (sem `firebaseDisableSPM`)
- [ ] Um plugin do Hot Updater só: `@hot-updater/react-native` (v0) **ou** `@hot-updater/expo` (v1)
- [ ] SDK 58: `expo-navigation-bar` no lugar do `react-native-edge-to-edge`; `@expo/ui` e `expo-device` no `package.json`
- [ ] Sem bloco `updates` se Hot Updater
- [ ] `UIBackgroundModes` inclui `remote-notification`
- [ ] AdMob / Facebook IDs do **produto**

### 10.3 Runtime (device/simulador)

- [ ] App passa do splash (não fica preto infinito)
- [ ] Onboarding / index navega
- [ ] Tabs renderizam
- [ ] Banner não crasha se sem unitId
- [ ] Android com `react-native-applifecycle`: Metro mostra `[expo-utils] AppOpen trigger: process-lifecycle`, e fechar
      um diálogo de permissão ou um intersticial não mostra app open (sair para a home e voltar mostra)
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
- [ ] Device físico / emulador Android: console do Metro mostra `Subscribed to topic: <slug>-purchase-<status>`
      (em simulador iOS não aparece — sem APNS a lib pula os tópicos). Entrega só se prova mandando uma
      push para o tópico e vendo chegar
- [ ] `Alert.alert` do app abre o diálogo do Expo UI (iOS: alerta do SwiftUI; Android: Material 3) e cada botão roda o
      `onPress` (seção 4.2.2). No iOS, conferir também com um `Modal` ou tela `fullScreenModal` aberta, com um
      intersticial na tela e com um alerta aberto dentro do `onPress` de outro. No Android, 3 botões na ordem do RN
      (o 1º à esquerda, o último à direita)

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
| 4 | Remote Config flat | paywall/API undefined | `settings` com os blocos `utils` + `screens` (pldev `rc push`) + rewrites |
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
| 29 | Gravar `$mediaSource`/`$campaign` “provisório” no app (ex.: `Organic` no boot) | no RevenueCat os campos de atribuição são **primeira gravação vence** (medido em 21/09/2026 com atributo-controle na mesma chamada): o valor provisório fica para sempre e a fonte real que chegar depois é ignorada | não gravar atribuição no app host; a lib só grava quando conhece a origem (orgânico vai só em `install_medium`) |
| 30 | Campanha na Meta sem a `meta_install_referrer_key` | customer Android só com Media Source = `Meta Ads`/`Instagram Ads`, sem campanha | pôr a chave no Remote Config (`utils.meta_install_referrer_key`); o dado cifrado dos installs antigos fica em `meta_ref_nonce` + `meta_ref_data_1..4` e pode ser aberto depois |
| 31 | Unity Ads na mediação Android (até 06/10/2026) | APK com as classes do adapter e sem `com.unity3d.ads`; bidding da Unity com 0% de match | o adapter não declara o SDK no POM; o catálogo agora acrescenta `com.unity3d.ads:unity-ads` (`extraArtifacts`). Rebuild nativo; a chave própria `"unity-sdk"` no app.json vira redundante (dedupe) |
| 32 | Compra vitalícia / PREPAID / promocional (até 06/10/2026) | quem comprou "remover anúncios" continuava vendo anúncio | `PremiumUtils` exigia `willRenew`, que o RC zera nesses casos; corrigido na lib (`isPremiumEntitlement`; com `is_opted_out_trial_enabled: true` o vitalício entra pelo entitlement ativo, porque `activeSubscriptions` não lista compra) — sem workaround no app. App que tem o contorno local (ex.: `src/lib/premium.ts` no Bobbie Goods) pode apagá-lo ao subir a lib |
| 33 | Link-in-bio com a 1ª abertura offline (até 06/10/2026) | install perdido para sempre e `install_attribution` com `matched: 0` igual a sem-match | flag só com resposta do servidor + `install_attribution_error` + nova tentativa na próxima abertura |
| 34 | Integração Meta do RevenueCat + `autoLogAppEventsEnabled: true` | compra possivelmente contada 2x na Meta | configuração: conferir no Events Manager e manter uma fonte só (integração do RC **ou** log automático do SDK) |
| 35 | RNFB 27 com `useFrameworks: "static"` (ou RNFB* no `forceStaticLinking`) | `pod install` aborta: "[react-native-firebase] SPM + static linkage is not supported" | `--fix-ios-build` (lê o RNFB instalado): `dynamic` + `forceStaticLinking` RNGoogleMobileAds/react-native-fbsdk-next |
| 36 | `$RNFirebaseDisableSPM = true` / `disableSPM` com RNFB 27 | `pod install` falha ("no longer distributed through CocoaPods") | o plugin da lib só põe a global com RNFB 24–26; não usar `firebaseDisableSPM` no app.json |
| 37 | `android.kotlinVersion: "2.4.21"` | Gradle não resolve `io.github.expo.pika:pika-compiler:1.1.0-2.4.21` (os compiler plugins do Expo só vão até a 2.4.20 no Maven Central) | `"2.4.20"` (o RNFB 27 exige ≥ 2.4.0) |
| 38 | SDK 58 sem `@expo/ui` (ou `expo-device`) no `package.json` | bundle quebra no import da lib (o expo-router 58 não traz mais o `@expo/ui`) | `npx expo-utils-install` (instala os peers que faltam) ou `npx expo install @expo/ui expo-device` |
| 39 | Hot Updater 1.x num app com servidor/URL do v0 | v1 não fala com o servidor v0: OTA desligado (aviso `initHotUpdater: … OTA desligado.`); `HotUpdater.wrap`/`checkForUpdate` estáticos não existem | servidor v1 novo + `hotUpdaterUrl` (raiz do Worker v1) + `hotUpdaterApiKey`; ou ficar no v0 com `>=0.35.3 <1` (seção 2.4) |
| 40 | Pangle 8.3 (catálogo do RNGMA 17.4) num app no RNGMA 16.x | `pod install` quebra: o pod exige `Google-Mobile-Ads-SDK ~> 13.6` e o RNGMA 16 pina o 13.5.0 | automático: o plugin lê o RNGMA instalado e usa o `compat` (Pangle 8.2.0.3.0/8.2.0.4.0); ou subir o RNGMA para 17.4.0 |
| 41 | Plugin local `withPodsDeploymentTarget` mantido no SDK 58 | sobra de um bug já corrigido (expo#47537, expo-modules-autolinking ≥ 57.0.5) | apagar o plugin e a entrada no app.json (o Eleições compilou sem ele) |
| 42 | `tsconfig.json` do app com `baseUrl` / `moduleResolution: "node"` no TypeScript 6 (SDK 58) | `tsc` falha com TS5101/TS5107 ("deprecated and will stop functioning in TypeScript 7.0") | `extends: "expo/tsconfig.base"` (já usa `bundler`) e `paths` sem `baseUrl`; ou `"ignoreDeprecations": "6.0"` |
| 43 | SDK 58 (R8 ligado) com a lib 1.5.1, ou com `androidR8KeepRules: false` | Release Android fecha ao abrir: "Failed to create an instance of class androidx.work.impl.WorkDatabase.canonicalName" (no `InitializationProvider`); os jobs do WorkManager e os botões de widget do Glance também falham | lib 1.5.2+ e prebuild: o `android/app/proguard-rules.pro` tem o bloco `expo-utils-r8-keep-rules` com as 3 regras `{ void <init>(); }` |
| 44 | Rede da mediação sem o SDK dela no app (só o adapter) | antes: o app ia para a loja e a rede não servia anúncio (Unity com 0% de match em 06/10/2026); desde a 1.5.3 o build para: Gradle (`expoUtilsConferirSdksDaMediacaoRelease`) ou `pod install` com "[expo-utils] Mediação sem o SDK da rede: …" | corrigir o catálogo (`android.sdk`/`extraArtifacts`, `ios.sdkPod`) e rodar `node scripts/check-mediation-poms.js`; rede definida no app.json: incluir `sdk`/`sdkPod`. Não desligar a conferência para passar o build |

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

1. Preencher os blocos em `.pldev/.firebaserc/rc-config-{ios,android}.json` (ou no `pldev firebase rc edit`):
   **`utils`** — ads/review/promo; **`screens`** — api_url, free_limits, paywall, flags, cross_promo.
2. `pldev firebase rc push`. Com a lib 1.5.0+ ele cria o `settings` com a condição de versão (confirma o V) e mantém
   `utils` + `screens` para os builds antigos; com lib anterior publica só `utils` + `screens`.
3. Remover dependência do JSON flat antigo (ou deixar de ler).
4. Quando o GA4 não mostrar mais versões abaixo de V: `pldev firebase rc legacy off`.

Sem isso o app “compila e abre”, mas paywall/limites/API podem ficar vazios.

---

*Gerado a partir da migração real do expo-plant-ai (Expo 53 → 57 + expo-utils 1.2.5). Atualize este doc se o expo-utils mudar peers ou contrato de prepare/layout.*
