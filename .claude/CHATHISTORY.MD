# Chat History - expo-utils

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
