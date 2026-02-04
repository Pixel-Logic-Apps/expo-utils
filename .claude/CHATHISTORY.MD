# Chat History - expo-utils

## 2026-02-04

### Tarefa: Remover Strings.ts (deprecated)

**Pedido:** Remover arquivo `constants/Strings.ts` e código relacionado no CLI, pois não é mais utilizado.

**Ações realizadas:**
1. Deletado arquivo `constants/Strings.ts`
2. Simplificada função `handleConstantsFlag()` em `bin/install.js` - agora só cria pasta constants
3. Atualizada documentação em `CLAUDE.md` e `README.md`

**Arquivos modificados:**
- `constants/Strings.ts` - DELETADO
- `bin/install.js` - removido código de cópia do Strings.ts
- `CLAUDE.md` - atualizada descrição da flag --constants
- `README.md` - atualizada tabela de flags e seção de Unit IDs (agora usa Firebase Remote Config)

**Motivo:** Unit IDs de anúncios agora são configurados via Firebase Remote Config em vez de arquivo local.

**Resultado:** Sucesso

---

### Tarefa: Corrigir configuração do @hot-updater/react-native no app.json

**Pedido:** O plugin `@hot-updater/react-native` estava sendo adicionado ao app.json apenas como string, mas o correto é como array com configuração de channel: `["@hot-updater/react-native", { "channel": "production" }]`

**Ações realizadas:**
1. Verificado que o código original NÃO adicionava o plugin ao app.json (só configurava package.json, babel.config.js e arquivos .env)
2. Adicionada seção 5 na função `handleHotUpdaterFlag()` para configurar o plugin no app.json
3. Seguido padrão do `expo-tracking-transparency` para merge de configuração

**Justificativa:** O hot-updater requer a configuração de channel no plugin do app.json para funcionar corretamente. Sem essa configuração, o plugin não saberia qual canal de updates usar.

**Arquivos modificados:**
- `bin/install.js` - adicionada seção 5 em `handleHotUpdaterFlag()` para configurar app.json

**Código adicionado:**
```javascript
// --- 5. Add @hot-updater/react-native plugin to app.json ---
const config = getAppConfig();
if (config) {
    const pluginName = "@hot-updater/react-native";
    const hotUpdaterConfig = { channel: "production" };

    // Find existing plugin or add new
    const hotUpdaterIndex = config.expo.plugins.findIndex((p) =>
        (Array.isArray(p) && p[0] === pluginName) || p === pluginName
    );

    if (hotUpdaterIndex !== -1) {
        // Merge with existing configuration
        // ...
    } else {
        config.expo.plugins.push([pluginName, hotUpdaterConfig]);
    }
    writeAppConfig(config);
}
```

**Resultado:** Sucesso

---

## 2026-01-30

### Tarefa: Teste de Build iOS com expo-utils-test

**Pedido:** Continuar testes de integracao do expo-utils em projeto novo. Usuario queria validar se as correcoes anteriores (try-catch global, HotUpdater API) funcionam.

**Acoes realizadas:**
1. Tentativa de recriar projeto expo-utils-test do zero
2. Build iOS iniciado com `npx expo run:ios`
3. Encontrados erros de dependencias e configuracao

**Erros encontrados:**

1. **PluginError @hot-updater/react-native:**
```
PluginError: Failed to resolve plugin for module "@hot-updater/react-native" relative to "/Users/plapps/Documents/projetos/expo-utils-test". Do you have node modules installed?
```
- Causa: Plugin listado no app.json mas pacote nao instalado nos node_modules

2. **Build iOS - no such module 'FirebaseCore':**
```
❌  (ios/expoutilstest/AppDelegate.swift:2:8)

  1 | import Expo
> 2 | import FirebaseCore
    |        ^ no such module 'FirebaseCore'
  3 | import React
```
- Causa: Firebase pods nao instalados corretamente
- O Podfile usa `use_frameworks! :linkage => :static` conforme app.json
- Prebuild rodou, CocoaPods instalou, mas Firebase nao foi incluido

**Arquivos relevantes:**
- `/Users/plapps/Documents/projetos/expo-utils-test/package.json` - dependencias do projeto teste
- `/Users/plapps/Documents/projetos/expo-utils-test/ios/Podfile` - configuracao CocoaPods
- `/Users/plapps/Documents/projetos/expo-utils-test/app.json` - plugins Expo

**Configuracao do projeto teste:**
```json
{
  "plugins": [
    "@hot-updater/react-native",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-firebase/crashlytics",
    "@react-native-firebase/messaging",
    ["expo-build-properties", {
      "ios": {
        "useFrameworks": "static",
        "useModularHeaders": true,
        "forceStaticLinking": ["RNFBApp", "RNFBAuth", "RNFBFirestore"]
      }
    }]
  ]
}
```

**Resultado:** Bloqueado - Build iOS falhou por Firebase nao estar nos Pods

**Proximos passos necessarios:**
1. Deletar projeto expo-utils-test
2. Recriar projeto do zero
3. Garantir que `npm install` complete antes de `expo run:ios`
4. Verificar se Firebase pods estao sendo incluidos pelo autolinking

---

### Contexto: Estado Atual das Versoes

**expo-utils versao atual:** 1.0.18 (publicada em 2026-01-29)

**Ultimos commits relevantes:**
- `f2220e5` - fix: validate TikTok SDK initialization parameters in initTikTokSDK function
- `43e0a2c` - fix: add setupAppOpenListener call in RootLayout component
- `402e591` - docs: update README and template files with placeholder values for Firebase configuration
- `cfde219` - docs: update CHATHISTORY with details on config plugin error resolution
- `c32bf67` - fix: remove main and exports fields to restore subpath imports

**Problema Firebase API_KEY (sessao anterior):**
- Template `GoogleService-Info.template.plist` tinha `YOUR_API_KEY_HERE`
- Firebase SDK valida formato da API_KEY e crashava
- Corrigido para `AIzaSyDUMMYKEY000000000000000000000000` (formato valido)
- MAS Firebase ainda valida a key contra servidores Google e crasha

**Conclusao importante:**
Firebase SDK NAO PODE funcionar com credenciais placeholder. Usuarios DEVEM fornecer GoogleService-Info.plist real para testar builds iOS com Firebase.

---

## 2026-01-29

### Refatoracao HotUpdater + Try-Catch Global

**Arquivos modificados:**
- `utils/Utils.ts`
- `templates/RootLayout.tsx`

**Mudancas em Utils.ts:**
1. Removido `getUpdateSource` do import do HotUpdater
2. Adicionado try-catch em TODAS as chamadas no `prepare()`:
   - `maybeApplyUpdate`, `checkForRequiredUpdateDialog`, `setupRevenueCat`, `setupGlobalConfigs`
   - `initFBSDK`, `initTikTokSDK`, `setupClarity`, `initLinkInBioTracking`
   - `setupAttribution`, `updateMessagingTopic`, `addCustomerInfoUpdateListener`
3. Descomentado `expoUtilsWarn("Error in prepare:", e)`
4. Adicionado early return em `initLinkInBioTracking` se nao tiver `trends_tracking_url`
5. Simplificado `maybeApplyUpdate()`:
   - Removido parametro `remoteConfigs` (URL agora vem do wrapper)
   - Mudou de `runUpdateProcess` + `getUpdateSource` para nova API `checkForUpdate` + `updateBundle`

**Mudancas em RootLayout.tsx:**
1. Removido `React` do import (usa destructuring direto)
2. Adicionado import do `HotUpdater`
3. Mudou de `export default function RootLayout()` para `function RootLayout()`
4. Export com wrapper: `export default HotUpdater.wrap({baseURL, updateMode})(RootLayout)`

**Nova arquitetura HotUpdater:**
- Antes: URL vinha do RemoteConfig (`remoteConfigs.hotupdater_url`)
- Agora: URL configurada no wrapper do componente root

**Nota:** URL no template mudada para placeholder `https://YOUR-WORKER.workers.dev/api/check-update`

**Commit:** `d50fea6` - refactor: add try-catch to all SDK initializations and update HotUpdater API
**Versao:** 1.0.17

---

## 2026-01-28 (Sessao Atual)

### Tarefa 0: Corrigir erro de config plugin e imports - PluginError + Metro

**Problemas:**
1. Ao usar expo-utils como plugin no app.json:
```
PluginError: Unable to resolve a valid config plugin for expo-utils.
• No "app.plugin.js" file found in expo-utils
• main export of expo-utils does not appear to be a config plugin: Stripping types is currently unsupported for files under node_modules
```

2. Metro bundler nao conseguia resolver subpath imports:
```
Unable to resolve module expo-utils/utils/Utils from src/app/_layout.tsx
```

**Causa raiz:**
- Commits `1ca6ece` e `f1f4f57` adicionaram campos `main` e `exports` no package.json
- O campo `exports` restringe quais arquivos podem ser importados do pacote
- `main` foi alterado para `./app.plugin.js` (config plugin, nao a biblioteca)
- Na versao 1.0.15 que funcionava, NAO havia nem `main` nem `exports`

**Investigacao:**
- Inicialmente tentei varias combinacoes de `main` e `exports` sem sucesso
- Descobri que o projeto de teste estava instalado via `file:../expo-utils` (symlink) ao inves de via GitHub
- O watchman (usado pelo Metro) NAO segue symlinks, entao nao conseguia ver os arquivos
- A instalacao correta e via `npm install github:Pixel-Logic-Apps/expo-utils`

**Solucao final aplicada:**
- Removido campo `main` completamente (nao existia na 1.0.15)
- Removido campo `exports` completamente (nao existia na 1.0.15)
- O Expo encontra `app.plugin.js` automaticamente pelo nome do arquivo
- Sem `exports`, o Metro resolve subpaths normalmente

**Arquivos modificados:**
- `package.json` - removido `main` e `exports`

**Commit:** `c32bf67` - fix: remove main and exports fields to restore subpath imports

**Licao aprendida:**
- Instalacao via `file:` cria symlink que o watchman nao segue
- Sempre testar com `npm install github:user/repo` para simular instalacao real
- Campos `main` e `exports` podem quebrar resolucao de subpaths se nao configurados corretamente

---

### Tarefa 1: Resolver conflito de dependencias do hot-updater

**Pedido:** Usuario tentou instalar `hot-updater` e recebeu erro de conflito de peer dependencies. Pediu para resolver SEM usar `--force` ou `--legacy-peer-deps`.

**Acoes realizadas:**
- Analisado erro: `react-dom@19.2.4` requer `react@^19.2.4`, mas Expo SDK 54 usa `react@19.1.0`
- Adicionado `react-dom@19.1.0` como dependencia explicita
- Adicionado `overrides` no package.json para forcar versao correta

**Justificativa:** O npm tenta instalar a versao mais recente do `react-dom` quando o `expo-router` tem `react-dom@"*"` como peer dependency opcional. O override forca a versao compativel.

**Arquivos modificados:**
- `/Users/plapps/Documents/projetos/expo-utils-test/package.json`

**Resultado:** Parcialmente resolvido - usuario pediu para automatizar no CLI

---

### Tarefa 2: Criar flag --hot-updater no CLI

**Pedido:** Automatizar a instalacao do hot-updater na flag `--new` do CLI, incluindo criacao de `babel.config.js`, `.env` e `.env.hotupdater`.

**Acoes realizadas:**
1. Criado template `templates/babel.config.js` com plugin hot-updater
2. Criado template `templates/.env.hotupdater.template` com placeholders Cloudflare
3. Implementada funcao `handleHotUpdaterFlag()` no `bin/install.js`
4. Adicionada chamada no bloco `--new` e como flag individual
5. Atualizado `CLAUDE.md` com documentacao da nova flag

**Justificativa:** Usuarios precisavam manualmente configurar 4+ arquivos para usar hot-updater. Automatizar reduz erros e tempo de setup.

**Comandos/Ferramentas:**
```bash
# Uso da nova flag
npx expo-utils-install --hot-updater
# Ou incluido no --new
npx expo-utils-install --new
```

**Arquivos modificados:**
- `templates/babel.config.js` (novo)
- `templates/.env.hotupdater.template` (novo)
- `bin/install.js` - nova funcao `handleHotUpdaterFlag()`
- `CLAUDE.md` - documentacao atualizada

**Resultado:** Sucesso - commits `6aeaac2` e `94ac0d9`

---

### Tarefa 3: Corrigir erro de resolucao de modulo no CLI

**Pedido:** CLI falhou ao executar com erro `Cannot find module 'expo-utils/package.json'`

**Acoes realizadas:**
- Identificado que `require("expo-utils/package.json")` nao funciona quando instalado via path local
- Substituido por `path.join(__dirname, "..")` para resolver caminhos relativos ao script
- Removidas redeclaracoes locais de `moduleDir` que ficaram redundantes

**Justificativa:** O `require.resolve` nao consegue resolver o proprio pacote quando executado via symlink de instalacao local.

**Comandos/Ferramentas:**
```javascript
// Antes (falhava)
const modulePkg = require("expo-utils/package.json");

// Depois (funciona)
const moduleDir = path.join(__dirname, "..");
const modulePkg = require(path.join(moduleDir, "package.json"));
```

**Arquivos modificados:**
- `bin/install.js` - linha 13 e todas ocorrencias de `path.dirname(require.resolve(...))`

**Resultado:** Sucesso - commit `94ac0d9`

---

### Tarefa 4: Testar instalacao completa do zero

**Pedido:** Apagar projeto de teste e recriar do zero para validar que tudo funciona.

**Acoes realizadas:**
1. Removido `/Users/plapps/Documents/projetos/expo-utils-test`
2. Criado novo projeto com `npx create-expo-app expo-utils-test`
3. Instalado expo-utils via GitHub
4. Executado `npx expo-utils-install --new`
5. Executado `npx expo run:ios`

**Comandos/Ferramentas:**
```bash
rm -rf /Users/plapps/Documents/projetos/expo-utils-test
cd /Users/plapps/Documents/projetos && npx create-expo-app expo-utils-test
npm install github:Pixel-Logic-Apps/expo-utils
npx expo-utils-install --new
npx expo run:ios
```

**Erros encontrados:**
```
Unable to resolve module expo-utils/utils/Utils from src/app/_layout.tsx:
expo-utils/utils/Utils could not be found within the project or in these directories:
  node_modules
```

**Resultado:** Build iOS compilou, mas Metro bundler falhou ao resolver imports

---

### Tarefa 5: Corrigir imports de subpath do expo-utils

**Pedido:** (Identificado durante teste) Metro nao consegue resolver `expo-utils/utils/Utils`

**Acoes realizadas:**
- Adicionado campo `exports` no `package.json` do expo-utils
- Configurado exports para permitir subpath imports

**Justificativa:** Sem o campo `exports`, o Node/Metro nao sabe como resolver imports como `expo-utils/utils/Utils`. O campo exports define explicitamente quais subpaths sao permitidos.

**Comandos/Ferramentas:**
```json
"exports": {
  ".": "./index.ts",
  "./utils/*": "./utils/*",
  "./constants/*": "./constants/*",
  "./package.json": "./package.json"
}
```

**Arquivos modificados:**
- `package.json` - adicionado campo `exports`

**Resultado:** PENDENTE - commit `1ca6ece` feito, aguardando teste

---

### Commits desta sessao

| Hash | Mensagem |
|------|----------|
| `6aeaac2` | feat: add --hot-updater flag to CLI |
| `94ac0d9` | fix: use __dirname for module resolution in CLI |
| `fb57ef0` | docs: update CHATHISTORY |
| `1ca6ece` | fix: add exports field to package.json for subpath imports |

### Problemas Pendentes

1. **Metro bundler nao resolve imports** - Adicionado `exports` no package.json, precisa testar
2. **Warnings no build iOS:**
   - `A firebase.json file was not found` - Normal sem config real
   - `ios_app_id key not found in react-native-google-mobile-ads` - Usando placeholder

### Licoes Aprendidas

1. **Sempre testar instalacao via GitHub, nao via path local** - Symlinks tem comportamento diferente
2. **Verificar se `exports` esta configurado** quando biblioteca tem subpath imports
3. **`require.resolve` nao funciona bem** com symlinks de instalacao local

---

## Sessao: 2026-01-28 (nova feature hot-updater)

### Nova Flag --hot-updater Adicionada

#### Problema Identificado
- Ao instalar `hot-updater` em projetos Expo SDK 54, ocorre conflito de peer dependencies
- `react-dom@19.2.4` requer `react@^19.2.4`, mas Expo SDK 54 usa `react@19.1.0`
- Usuario precisava manualmente criar `babel.config.js`, `.env` e `.env.hotupdater`

#### Solucao Implementada
Nova flag `--hot-updater` no CLI que automaticamente:
1. Adiciona `react-dom` (mesma versao do react) ao package.json
2. Adiciona `hot-updater@^0.25.7` ao package.json
3. Adiciona `overrides` no package.json para forcar versao do react-dom
4. Cria/atualiza `babel.config.js` com plugin `hot-updater/babel-plugin`
5. Cria `.env` e `.env.hotupdater` com placeholders Cloudflare
6. Atualiza `.gitignore` para ignorar arquivos .env

#### Arquivos Criados/Modificados
- `templates/babel.config.js` - Template do babel config
- `templates/.env.hotupdater.template` - Template dos arquivos .env
- `bin/install.js` - Nova funcao `handleHotUpdaterFlag()`
- `CLAUDE.md` - Documentacao atualizada

#### Uso
```bash
npx expo-utils-install --hot-updater
# ou incluido automaticamente no --new
npx expo-utils-install --new
```

#### Correcao Adicional
- CLI usava `require("expo-utils/package.json")` que falhava em algumas instalacoes
- Corrigido para usar `path.join(__dirname, "..")` para resolver caminhos relativos ao script

#### Teste
- Projeto de teste criado do zero com `create-expo-app`
- CLI `--new` executado com sucesso
- Build iOS compilou sem erros
- App executou no simulador iPhone 16e

---

## Sessao: 2026-01-28 (continuacao)

### Deploy 1.0.15 - Fix expo-image

#### Problema Identificado
- App de teste crashou ao rodar com erro: "Cannot find native module 'ExpoImage'"
- `modal-promotional-content.tsx` estava usando `expo-image` ao inves de React Native Image

#### Correcao Aplicada
- Mudou import de `import {Image} from "expo-image"` para usar Image do `react-native`
- Mudou `contentFit="cover"` para `resizeMode="cover"` (sintaxe React Native)

#### Deploy
- Versao: 1.0.15
- Motivo: Fix para nao depender de expo-image

---

## Sessao: 2026-01-28

### Contexto do Projeto
- **Nome:** expo-utils
- **Versao:** 1.0.12 → 1.0.14
- **Tipo:** Biblioteca/CLI para projetos Expo/React Native
- **Autor:** Pixel Logic Apps

### Atividades da Sessao

#### 1. Analise de Sobreposicao de Dialogos iOS
- **Problema identificado:** `requestTrackingPermissionsAsync()` e `requestPermission()` do Firebase Messaging podem se sobrepor em iOS
- **Causa:** iOS exibe dialogos de privacidade "out of process", colocando o app em estado `inactive`
- **ATT requer estado `active`** para funcionar corretamente
- **Versoes afetadas:**
  - iOS 15: Retorna `not-determined` sem mostrar dialogo
  - iOS 17: Problema especifico com TestFlight (app inicia em background)
- **Solucao recomendada:** Adicionar delay de ~1 segundo entre as chamadas de permissao

#### 2. Ordem de Inicializacao Corrigida
- **Problema:** `setupRevenueCat()` chamava `AppEventsLogger.getAnonymousID()` ANTES do Facebook SDK estar inicializado
- **Solucao:** Facebook SDK deve ser inicializado PRIMEIRO, depois RevenueCat

#### 3. Novo Parametro `requestPermissions` na funcao `prepare()`
- Permite controlar se as permissoes (ATT e Push) devem ser solicitadas no inicio
- **Assinatura:** `prepare(setAppIsReady, appConfig, requestPermissions = true)`
- **Uso:** `Utils.prepare(setAppIsReady, appConfig, false)` para pular permissoes

#### 4. Nova Funcao `getRevenueCatStatus()`
Retorna status detalhado do usuario baseado no RevenueCat:
- `trial` - Em periodo de trial
- `intro` - Em periodo introdutorio
- `billing_issue` - Problema de cobranca
- `cancelled` - Cancelou mas ainda ativo
- `active` - Assinatura ativa normal
- `refunded` - Reembolsado
- `expired` - Expirado
- `free` - Nunca comprou

#### 5. Nova Funcao `updateMessagingTopic()`
- Gerencia topicos FCM baseado no status do usuario
- Topic format: `{slug}-purchase-{status}`
- Automaticamente desinscreve do topico anterior quando muda
- Usa AsyncStorage para persistir topico atual

#### 6. Nova Funcao `setupAttribution()`
Configura atribuicoes para RevenueCat:
- `enableAdServicesAttributionTokenCollection()`
- `collectDeviceIdentifiers()`
- `setFBAnonymousID()`
- `setPushToken()`
- `setFirebaseAppInstanceID()`
- `setAttributes()` com TikTok Anonymous ID

#### 7. Novas Integracoes Adicionadas
- **TikTok Ads SDK:** `initTikTokSDK()` - Inicializa SDK e rastreia eventos
- **HotUpdater:** `maybeApplyUpdate()` - Verificar e aplicar updates OTA
- **Trendings Tracker:** `initLinkInBioTracking()` - Rastreamento de instalacoes

#### 8. Discussao sobre Promise.all vs Promise.allSettled
- **Promise.all:** Executa em paralelo, mas PARA na primeira falha
- **Promise.allSettled:** Executa em paralelo, espera TODAS terminarem (mesmo com falhas)
- **Recomendacao:** Usar `Promise.allSettled` para SDKs independentes

#### 9. ModalPromotionalContent (outro projeto)
Melhorias discutidas:
- Cores customizaveis via prop `colors`
- Suporte a banner de imagem via `bannerImg` no RemoteConfig
- Suporte a i18n com pattern `%{key}`
- Swipe para baixo para fechar

### Problemas Conhecidos
- Modulos nao instalados causando erros TypeScript:
  - `expo-tiktok-ads-events`
  - `@hot-updater/react-native`
- **Solucao:** Instalar os pacotes ou usar imports dinamicos com try/catch

### Decisoes Tecnicas Importantes
1. Facebook SDK DEVE ser inicializado antes de RevenueCat
2. Delay de 1s recomendado entre dialogos de permissao no iOS
3. `Promise.allSettled` preferido para inicializacao de SDKs independentes
4. Topicos FCM baseados em status do usuario para segmentacao de push

---

## Sessao: 2026-01-12

### Contexto do Projeto
- **Nome:** expo-utils
- **Versao:** 1.0.12
- **Tipo:** Biblioteca/CLI para projetos Expo/React Native
- **Autor:** Pixel Logic Apps

### Resumo do Projeto
CLI tool e biblioteca de utilitarios que automatiza 90% da configuracao inicial de projetos Expo/React Native:
- Instalacao automatica de dependencias peer
- Utilitarios para AdMob, Firebase, i18n, analytics
- Templates para scaffolding de projetos
- Configuracao de Firebase, RevenueCat, Facebook SDK

### Ultimos Commits
1. `573b5d1` - 1.0.12 (versao atual)
2. `b03156b` - fix: merge expo-tracking-transparency config instead of skipping
3. `deac476` - 1.0.11
4. `8839523` - chore: update peerDependenciesMeta to mark dependencies as optional
5. `18ea850` - 1.0.10

### Atividades da Sessao
- Iniciada sessao de desenvolvimento
- Atualizado CLAUDE.md com flags CLI faltantes (--fix-ios-build, --eas-login-script, --gitignore)
- Criado arquivo CHATHISTORY.MD

### Decisoes Tecnicas Importantes
- Todas peer dependencies marcadas como opcionais em peerDependenciesMeta
- Firebase usa API modular v22+
- expo-tracking-transparency config agora faz merge ao inves de pular
- expo-build-properties config faz merge corretamente

### Problemas Conhecidos
- Nenhum problema pendente identificado

---
