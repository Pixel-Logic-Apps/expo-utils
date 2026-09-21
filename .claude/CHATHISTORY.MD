# Chat History - expo-utils

## 2026-09-20 - Review tutorial: reprodução do GIF, editor de animações e inglês

**Pedido e contexto:** reproduzir o GIF `/Users/plapps/Downloads/ob_04.gif` em HTML, com alta fidelidade visual, para reutilizar o tutorial de avaliação em vários apps sem gravar cada um manualmente. Referência: 426 × 240, 190 frames, 19 segundos. Nome, ícone, idioma e comentário devem ser configuráveis. O usuário pediu comparação frame a frame e inspeção visual, com uso econômico de tokens.

**Decisões do usuário que devem ser preservadas:**

- Manter o início (launcher e splash) feito nativamente em HTML/SVG. O usuário rejeitou a substituição do launcher por um print.
- Após os ajustes visuais, o usuário disse que o resultado ficou excelente e pediu controles para alterar a duração das animações entre eventos.
- A abertura do menu da conta deve permanecer centralizada e subir verticalmente, sem deslocamento horizontal ou escala na entrada. Não deve vir do canto direito.
- Os tempos abaixo foram fornecidos pelo usuário e aplicados como **padrão da biblioteca**, inclusive quando `timings` é omitido ou parcial:

```json
{
  "timings": {
    "storeOpen": 0.7,
    "homeEnter": 1.35,
    "accountOpen": 1.05,
    "manageOpen": 1.35,
    "slideDown": 0.25,
    "reviewsOpen": 0.5,
    "composerOpen": 0.65,
    "typing": 3.9
  }
}
```

**Implementação em `utils/review-tutorial/`:**

- `html.ts`: ajustados splash/ícone da Play Store, enquadramento e transições, entrada de Gerenciar apps, carregamento de avaliações, campo do comentário, digitação e cursor. Launcher com 12 ícones HTML/SVG e splash SVG. Textos e dados do app continuam dinâmicos.
- Animações e digitação compartilham o relógio de `document.timeline`; os tempos de referência continuam baseados nos 19 segundos originais. Alterar uma duração remapeia os keyframes e desloca os eventos seguintes juntos, sem perder sincronização. O preset aprovado resulta em **21,85 segundos por ciclo**.
- Digitação respeita grafemas (`Intl.Segmenter` com fallback), com limite de 500 codepoints. Corrigidos limites temporais do cursor e substituição de comentários que contêm `$&`. Mantido fallback para ícone inválido.
- Menu da conta: cartão de 288 px, centro em x=213 no canvas de 426 px; entrada exclusivamente por `translateY`. O fundo decorativo também foi alinhado. A transição posterior para Gerenciar apps mantém seus próprios movimentos.
- `art.ts` e `ROBOTO-LICENSE.txt`: fonte Roboto incorporada e recursos decorativos estáticos (laterais/banner). Não substituem o launcher ou o splash por screenshots.
- `timings.ts`: oito transições tipadas, intervalos de referência e `defaultDuration` com o preset acima. Durações aceitas entre 0,05 e 30 segundos; valores omitidos/inválidos usam o padrão.
- `index.tsx`: prop opcional `timings`, tipo `ReviewTutorialTimings` disponível pelo módulo, dependências do `useMemo` incluindo `userEmail` e `timings`. Não foram adicionados exports no `index.ts` da raiz.
- `editor.ts` / `editor.html`: editor visual com sliders e entradas numéricas, reprodução de um trecho em loop, play/pause, avanço de 0,1 s, scrub, cópia/download do JSON e exportação do HTML independente. Layout adaptado para celular. Salva ajustes por app e preset; a chave inclui os padrões para evitar que uma configuração antiga esconda os novos tempos. “Restaurar padrão” restaura o preset aprovado.
- API de inspeção: `window.reviewTutorialReady`; `window.reviewTutorial.duration`, `seek(seconds)`, `play()`, `pause()`, `setTimings(values)` e `getState()`. `#t=...` abre pausado no instante informado; segundos se referem ao ciclo ajustado.
- `preview.ts`: CLI Bun sem dependências adicionais. Aceita `--project`, `--params`, `--icon`, `--app-name`, `--locale` e `--output`. `--project` lê nome/ícone de `app.json` e incorpora o ícone local. Não executa configurações dinâmicas do Expo. Gera tutorial e editor juntos.

**Versão em inglês:**

- `result-en.html` e `result-en-editor.html` gerados com os mesmos tempos aprovados; `result.html` e `editor.html` mantêm o exemplo em português.
- Inglês disponível com `locale="en"` no componente ou `--locale en` no CLI. Inclui os nomes traduzíveis do launcher, textos do fluxo e comentário padrão “Love this app!”. Nome do produto é o nome informado pelo app, sem tradução automática.
- Exemplo para outro app: `bun utils/review-tutorial/preview.ts --project /caminho/do/app --locale en --output utils/review-tutorial/result-en.html`.
- Para regenerar exatamente os exemplos desta sessão, os parâmetros estão em `/tmp/review-tutorial-qa/params.json`: `bun utils/review-tutorial/preview.ts --params /tmp/review-tutorial-qa/params.json` e, para inglês, adicionar `--locale en --output utils/review-tutorial/result-en.html`. Esse arquivo em `/tmp` é temporário; o gerador e os HTMLs finais estão no repositório.

**Documentação:** criado `utils/review-tutorial/README.md` com uso, editor, tempos e idiomas. Atualizado `docs/UPGRADE-EXPO57-EXPO-UTILS.md` na mesma tarefa, incluindo props, defaults, CLI e duração do ciclo.

**Validação realizada:**

- Referência extraída nos 190 frames e comparada visualmente com capturas do gerador, incluindo launcher/splash, transições e digitação. O objetivo foi alta fidelidade; não foi declarada identidade pixel a pixel.
- QA em Chrome com Playwright: relógio compartilhado, seek/pause/play/loop, digitação, PT/EN/ES/RTL, escaping, limite de texto, fallback do ícone e dimensionamento. Editor: alteração de tempos, loop do trecho, persistência, reset, exportação e layout móvel.
- Abertura centralizada do menu conferida em 52 posições, incluindo duração alterada, RTL e editor.
- Validação final do preset e do inglês passou em `preset-en.mjs`: os oito tempos exatos em PT/EN e nos dois editores; ciclo de 21,85 s; primeira letra em 15,05 s; comentário completo em 19,05 s; menu centralizado; labels em inglês; overrides parciais e reset. Imagens de launcher, conta, avaliações e comentário em inglês também inspecionadas visualmente.
- Typecheck estrito dos módulos do gerador/editor/CLI e `git diff --check` passaram. Não foi feito build de um app host ou teste em WebView de dispositivo nesta etapa.
- Ferramentas, scripts e capturas de QA ficam em `/tmp/review-tutorial-qa/`, com dependências de teste fora do repositório. Alguns scripts anteriores assumem o ciclo original de 19 s; ajustar expectativas antes de reutilizá-los. O teste do preset atual é `node /tmp/review-tutorial-qa/preset-en.mjs`.

**Estado ao salvar:** mudanças implementadas e validadas localmente, sem commit ou publicação. Últimos pedidos de aplicar o preset e disponibilizar inglês atendidos. O usuário ainda não deu feedback sobre o preview em inglês. Preservar os arquivos modificados e os novos arquivos listados acima ao continuar.

---

## 2026-05-28 - Inicialização da memória + contexto v1.0.27

### Tarefa: Auto-atualização da memória do Claude Code

**Pedido:** Usuário pediu para "se auto atualizar" — inicializar o sistema de memória persistente para o projeto.

**Ações realizadas:**
- Criada estrutura de memória em `/Users/plapps/.claude/projects/-Users-plapps-Documents-projetos-expo-utils/memory/`
- Criado `user_profile.md` — perfil do usuário (Bruno Verçosa / Pixel Logic Apps)
- Criado `project_expo_utils.md` — visão geral do projeto, estrutura, padrões
- Criado `chathistory.md` — ponteiro para este arquivo
- Criado `MEMORY.md` — índice de memórias

**Estado do repositório:**
- Versão atual: **1.0.27**
- Branch: `main` (limpo)

### Commits desde v1.0.26 (relevantes para contexto)

| Hash | Descrição |
|------|-----------|
| `ff9489c` | feat: add expo-dev-client dependency and register dev menu items for storage clearing in Utils |
| `711df00` | feat: add remote-notification to UIBackgroundModes in ios.infoPlist and update babel plugin path |
| `8156e48` | feat: add tracking permissions request and log events for topic subscriptions in Utils |
| `a14723f` | feat: add policy.lock.json to easignore and gitignore handling |
| `2076abe` | feat: enhance button text handling in PaywallUtils (trial days messaging) |
| `4215012` | feat: add trial days calculation and subscription period parsing to PaywallUtils |
| `d578ee2` | refactor: clean up PaywallUtils — remove unused functions and constants |
| `a426ec3` | feat: add PaywallUtils (paywall controller), screen-size utility, fix install script ignores |
| `ba906cb` | fix: update dependency versions for eas-build-cache-provider and hot-updater |
| `d386353` | fix: expo-utils peer dependency range |

**Resultado:** Memória inicializada com sucesso ✅

---

## 2026-02-26 - Fix: deps não adicionadas ao package.json (build iOS falhava)

### Tarefa: Corrigir handleDependencyInstall() - pacotes não escritos no package.json

**Pedido:** Usuário reportou BUILD FAILED ao rodar `npx expo run:ios` no projeto de teste. Erro: `error: no such module 'FirebaseCore'` no AppDelegate.swift.

**Diagnóstico:**
- `bunx expo install` completava sem erro mas NÃO adicionava nenhum dos 33 pacotes ao `package.json`
- Os pacotes existiam em `node_modules` (hoisted do symlink local `bun add ../expo-utils`)
- `expo install` via bun detectava os pacotes já em `node_modules` e pulava silenciosamente
- Sem entradas no `package.json`, Expo autolinking não detectava módulos nativos
- `pod install` não incluía Firebase → `import FirebaseCore` falhava no Swift

**Ações realizadas:**

#### 1. Reescrita de `handleDependencyInstall()` em `bin/install.js`
Abordagem em 3 steps:
- **Step 1**: Escreve TODAS as deps direto no `package.json` antes de qualquer install (garante autolinking)
- **Step 2**: Roda `bunx expo install` apenas para os 15 pacotes expo-managed (ajusta versões SDK-compatíveis)
- **Step 3**: Roda `bun install` para instalar tudo
- Adicionado `maxBuffer: 10 * 1024 * 1024` nos `exec()` para evitar overflow em outputs grandes

#### 2. Teste E2E completo
1. `rm -rf expo-utils-test && bunx create-expo-app expo-utils-test`
2. `bun add ../expo-utils`
3. `bunx expo-utils-install --new` — 33 deps adicionadas ao package.json ✅
4. `npx expo run:ios` — **Build Succeeded** ✅
5. Firebase pods compilados: RNFBApp, RNFBAuth, RNFBCrashlytics, RNFBAnalytics, RNFBFirestore, RNFBMessaging, RNFBRemoteConfig
6. App instalado e aberto no simulador iPhone 16e

**Justificativa:** O `expo install` via bun tem comportamento diferente quando pacotes já existem em node_modules (hoisted de symlinks locais). A solução garante que o package.json é SEMPRE atualizado primeiro, independente do estado de node_modules.

**Arquivos modificados:**
- `bin/install.js` — `handleDependencyInstall()` reescrita (3-step approach)

**Erros (do usuário):**
```
/Users/plapps/Documents/projetos/expo-utils-test/ios/expoutilstest/AppDelegate.swift:2:8: error: no such module 'FirebaseCore'
import FirebaseCore

SwiftEmitModule normal x86_64 Emitting module for expoutilstest (in target 'expoutilstest' from project 'expoutilstest')
** BUILD FAILED **
```

**Resultado:** Sucesso ✅

---

## 2026-02-26 - Suporte a Bun no CLI + Teste E2E

### Tarefa: Adicionar detecção automática de package manager (bun como default)

**Pedido:** O CLI `expo-utils-install` não detectava bun como package manager. Quando rodado com bun, caía no fallback `npm install`. O `handleHotUpdaterFlag()` também tinha "npm install" hardcoded.

**Ações realizadas:**

#### 1. Criada função `detectPackageManager()` em `bin/install.js`
- Prioridade: lockfile > user agent > default **bun**
- Lockfiles: yarn.lock → pnpm-lock.yaml → package-lock.json → bun.lockb/bun.lock
- User agent: yarn → pnpm → bun → npm
- Default: bun

#### 2. Atualizada `handleDependencyInstall()`
- Substituída lógica inline de detecção de PM pela função helper
- Mapeamento de comandos: `addCmd` (bun add, npm install, yarn add, pnpm add)
- Mapeamento de runners: `execCmd` (bunx, npx -y)
- Log do PM detectado: `📦 Package manager: bun`

#### 3. Atualizada `handleHotUpdaterFlag()`
- Substituída mensagem hardcoded "npm install" por comando dinâmico
- `installCmd` map: bun install, npm install, yarn, pnpm install

#### 4. Documentação atualizada
- **README.md**: Instalação rápida agora usa bun como default, nota sobre outros PMs
- **CLAUDE.md**: Nova seção "Package Manager Support", testing strategy com bun

### Teste E2E
1. Deletado `/Users/plapps/Documents/projetos/expo-utils-test`
2. Criado novo projeto: `bunx create-expo-app@latest expo-utils-test`
3. Instalado expo-utils local: `bun add ../expo-utils`
4. Executado `bunx expo-utils-install --new` — todas as 33 deps instaladas via `bunx expo install`
5. Output confirmou: `📦 Package manager: bun` e `📝 Then run: bun install`
6. Build iOS: `npx expo run:ios` — em execução

**Arquivos modificados:**
- `bin/install.js` — detectPackageManager(), handleDependencyInstall(), handleHotUpdaterFlag()
- `CLAUDE.md` — seção Package Manager Support, testing strategy atualizada
- `README.md` — instalação rápida com bun, nota sobre outros PMs

---

## 2026-02-19 (cont.4) - Renomeações, FCM Language Topics, Deploy npm 1.0.22

### O que foi feito

#### 1. Fix README - Erros restantes
- Removido "4." orphaned numbering (linha 34)
- Corrigido "chave do Remote Config" → "chave do AppStrings local" (linha 252)
- Removido props `useFooterStyle` inexistentes do BannerAdComponent (só aceita `unitId` e `tag`)
- Adicionado `utils` key missing em seções de integrações opcionais
- Removidas falsas claims sobre "cache inteligente" e "fallback para remote config" em openReviewURL

#### 2. Removido `is_paywall_disabled` e `delay_close_paywall_button`
- Removidos de `utils/types.ts`, `utils/config-integrity.ts` e `README.md`
- Não faziam parte do escopo do expo-utils

#### 3. Rename `Strings` → `AppStrings` → `appStrings`
- Template e README: `import appStrings from "../constants/Strings"`
- `prepare()` param: `strings` → `appStrings`

#### 4. FCM Language Topic Subscription
- Implementado `{slug}-lang-{languageCode}` topic em `setupPushNotifications`
- Usa `expo-localization` (getLocales) para detectar idioma
- Permite push notifications segmentadas por idioma via FCM topic conditions

#### 5. Rename campos promotional
- `timerSeconds` → `closeBtnDelayMs` (agora em milissegundos, default 5000)
- `bannerImg` → `imageUrl`
- `bannerVideo` → `videoUrl`
- Atualizado em types.ts, modal-promotional-content.tsx e README

#### 6. Rename type `RemoteConfigSettings` → `RemoteConfigUtilsType`
- Sufixo `Type` para evitar conflito com global var `remoteConfigUtils`
- Cuidado com `replace_all` que acidentalmente renomeou funções — corrigido manualmente

#### 7. Rename global var `RemoteConfigUtils` → `remoteConfigUtils` (camelCase)
- Atualizado em: Utils.ts, ask-for-review.tsx, modal-promotional-content.tsx, LoadAdsManager.ts, PremiumUtils.ts
- Template e README já estavam com lowercase
- Declare global: `var remoteConfigUtils: RemoteConfigUtilsType`

#### 8. Deploy npm v1.0.22
- Publicado `expo-utils@1.0.22` no npm
- Inclui todas as mudanças acima

#### 9. Pesquisa `repeat_ads_count`
- Usado em 20+ projetos na pasta projetos
- Padrão: `setTimeout(() => showInterstitial(), repeatAdsCount * 1000)` para ads recorrentes

### Commits desta sessão
| Hash | Mensagem |
|------|----------|
| `e8812b9` | refactor: restructure Remote Config, rename globals, fix README |
| `49f73cd` | chore: add path alias @/* to tsconfig |
| `b22277c` | feat: add language-based FCM topic subscription |
| `23b27a4` | refactor: rename promotional fields |
| `a62dbdc` | docs: add paywall example to screens |
| `5ce6b21` | chore: bump version to 1.0.22 (npm published) |
| `94ea936` | refactor: rename type RemoteConfigSettings→RemoteConfigUtils |
| `c07a34f` | refactor: rename type to RemoteConfigUtilsType, variable appStrings |
| `6a6c680` | refactor: rename global variable RemoteConfigUtils to remoteConfigUtils |
| `67cc3a3` | chore: add bun.lock to .gitignore |

### Erros encontrados
- `replace_all` com `RemoteConfigUtilsType` renomeou acidentalmente `getRemoteConfigUtils` → `getRemoteConfigUtilsType` e `(global as any).RemoteConfigUtils` → `(global as any).RemoteConfigUtilsType`. Fix manual necessário.
- Commit `6a6c680` não atualizou code files (só README+template). Corrigido nesta sessão continuada.

### Arquivos modificados
- `utils/types.ts` — type rename, removed paywall fields, promotional field renames
- `utils/Utils.ts` — param rename, global var lowercase, language topic
- `utils/modal-promotional-content.tsx` — field renames, global var lowercase
- `utils/ask-for-review.tsx` — global var lowercase
- `utils/LoadAdsManager.ts` — global var lowercase
- `utils/PremiumUtils.ts` — global var lowercase
- `utils/config-integrity.ts` — removed paywall fields, type rename
- `templates/RootLayout.tsx` — all renames
- `index.ts`, `index.d.ts` — type export rename
- `README.md` — extensive updates

---

## 2026-02-19 (cont.3) - Refatoração Remote Config + Globals + README + Bug Fix

### O que foi feito

#### 1. Fix bug `trends_tracking_url` fallback
- **Bug:** `if(!remoteConfig?.trends_tracking_url) return;` retornava antes do `??` fallback
- **Fix:** Removida a linha. O `??` já cuida do fallback para `"https://trendings.app/api"`

#### 2. Refatoração `RemoteConfigSettings`
- **Removido:** `review_mode` (nunca usado), `hotupdater_url` (URL agora fixa no `HotUpdater.wrap()`)
- **Adicionados:** `review_type: string`, `review_type_delay: number`, `promotional: PromotionalConfig`
- Todos os campos FLAT (sem `ServiceConfigs`/`services` nesting)

#### 3. Reestruturação do Firebase Remote Config
- **Antes:** Uma key `settings` com tudo
- **Agora:** Duas keys no Remote Config:
  - `utils` → configs do expo-utils, tipado como `RemoteConfigSettings`
  - `screens` → configs de telas do app, tipo `any`, estrutura livre
- `getRemoteConfigUtils()` busca key `utils`, retorna `RemoteConfigSettings`
- Nova função `getRemoteConfigScreens()` busca key `screens`, retorna `any`

#### 4. Renomeação dos globals
- `global.remoteConfigs` → **removido**
- `global.RemoteConfigUtils` → configs do expo-utils (tipado `RemoteConfigSettings`)
- `global.remoteConfigScreens` → configs de telas (tipo `any`)
- `declare global` no template usa `import type {RemoteConfigSettings}` no topo

#### 5. Atualização de todos os acessos
- `utils/ask-for-review.tsx` → `global.RemoteConfigUtils?.review_type`
- `utils/modal-promotional-content.tsx` → `global.RemoteConfigUtils?.promotional`
- `utils/LoadAdsManager.ts` → `global.RemoteConfigUtils?.is_ads_enabled`
- `utils/PremiumUtils.ts` → `global.RemoteConfigUtils?.is_opted_out_trial_enabled`
- `templates/RootLayout.tsx` → `global.RemoteConfigUtils?.review_type_delay`

#### 6. Rewrite do README
- Template Remote Config com duas keys (`utils` e `screens`)
- Template `_layout.tsx` com `declare global` tipado
- Seção "Declarações Globais" atualizada
- Seção "Configurações Remotas" atualizada
- Corrigida assinatura do `prepare()` (4 params com `AppStrings`)
- `rckey`/`adUnits` documentados como locais (não Remote Config)
- `updateMessagingTopic` params corrigidos
- Exemplos corrigidos
- HotUpdater: URL fixa no `HotUpdater.wrap()`, não mais em Remote Config

### Arquivos modificados
- `utils/types.ts` — `RemoteConfigSettings` flat (sem ServiceConfigs)
- `utils/Utils.ts` — bug fix, novas funções RC, globals renomeados
- `utils/config-integrity.ts` — `review_mode` → `review_type`, `hotupdater_url` removido
- `utils/ask-for-review.tsx` — `global.RemoteConfigUtils`
- `utils/modal-promotional-content.tsx` — `global.RemoteConfigUtils`
- `utils/LoadAdsManager.ts` — `global.RemoteConfigUtils`
- `utils/PremiumUtils.ts` — `global.RemoteConfigUtils`
- `templates/RootLayout.tsx` — declare global tipado, import type
- `index.ts` — export limpo (sem ServiceConfigs)
- `README.md` — rewrite completo
- `CLAUDE.md` — atualizado

---

## 2026-02-19 (cont.2) - nthImpression + targetScreen + compact + fullscreen image-only

### O que foi feito

#### 1. nthImpression (substitui maxImpressions)
- **Removido**: `maxImpressions: number` do PromotionalConfig
- **Adicionado**: `nthImpression: string` — expressão CSS nth-child para controlar em quais visitas o promotional aparece
- Sintaxe: `"1"` (só 1x), `"2n"` (a cada 2), `"1+2n"` (visitas 1,3,5...), `"3n+2"` (visitas 2,5,8...)
- Parser: `parseNthExpression()` extrai {a, b} da expressão
- Matcher: `matchesNth(visit, a, b)` verifica se visit corresponde à fórmula an+b
- Visit count é incrementado a cada visita ao targetScreen (independente de mostrar ou não)
- Storage key: `@promo_visit_count`

#### 2. Auto-traduções (31 idiomas)
- Adicionado `PROMO_TRANSLATIONS` com 31 idiomas (mesmo set do ask-for-review)
- Textos traduzidos: `download` (CTA), `dontShowAgain`, `dontShow`, `close`, `now`
- 3 modos de resolução para cada texto:
  1. Remote config define o texto → usa ele (pode ter `%{key}` para i18n do user)
  2. Não definido → tradução automática baseada no locale do device
- `resolveText(configValue, fallbackKey, t)` encapsula essa lógica
- Todos os textos hardcoded em PT substituídos: "Não mostrar novamente", "Não mostrar", "Fechar", "now"
- Import de `expo-localization` (getLocales) para detecção de idioma
- Cache em `_cachedTr` para evitar chamadas repetidas

#### 3. bannerVideo (fullscreen vídeo)
- **Adicionado**: `bannerVideo?: string` ao PromotionalConfig
- Quando definido no tipo fullscreen, renderiza vídeo full-screen com auto-play e loop
- Usa `expo-av` via require dinâmico com try-catch (fallback para bannerImg se não instalado)
- Prioridade: bannerVideo > bannerImg > layout gradient padrão
- Vídeo é tappable (abre storeUrl), timer + botão X como no modo imagem

#### 3. targetScreens (array)
- **Adicionado**: `targetScreens?: string[]` ao PromotionalConfig
- Hook `usePromotional(currentScreen?)` aceita pathname do expo-router
- useEffect auto-triggera quando `currentScreen` muda e está incluído em `targetScreens`
- Se targetScreens não definido ou vazio, aparece em qualquer tela
- Usa `.includes()` para verificar se a tela atual está na lista

#### 3. Fullscreen image-only mode
- Quando fullscreen tem `bannerImg`, renderiza imagem full-screen sem botões/texto
- Só timer + botão fechar aparecem
- Tap na imagem abre storeUrl

#### 4. Notification compact mode
- `notificationCompact: true` (default) — inicia com só header visível
- Tap no header expande body com spring animation (Animated.Value 0→1)
- `useNativeDriver: false` necessário para animação de height

### Arquivos modificados
- `utils/modal-promotional-content.tsx` — parseNthExpression, matchesNth, STORAGE_KEY_VISIT_COUNT, rewrite do usePromotional hook
- `utils/types.ts` — removido `maxImpressions`, adicionado `nthImpression`, `targetScreens: string[]`, `bannerVideo`
- `templates/RootLayout.tsx` — usa usePathname() + usePromotional(pathname)
- `README.md` — documentação de targetScreen, nthImpression, uso com pathname

### Testado no simulador
- nthImpression "1+2n": Visita 1 ✓ (mostrou), Visita 2 ✓ (não mostrou), Visita 3 ✓ (mostrou)
- targetScreens ["/settings", "/details"]: aparece em Settings e Details, não em Home

---

## 2026-02-19 (cont.) - Notification Card + Banner Enhancements

### O que foi feito

#### 1. Fix: Banner inline não aparecia
- **Problema**: Clicar "Banner (inline)" chamava `mockPromoType("banner")` mas não re-renderizava o `PromotionalBanner`
- **Causa**: `global.remoteConfigs` não trigger React re-render
- **Solução**: Adicionado `bannerKey` state + `key={bannerKey}` para forçar re-mount

#### 2. Redesign: Card Banner Bottom (modo imagem)
- LinearGradient overlay (`transparent → rgba(255,255,255,0.85)`) sobre imagem para legibilidade
- CTA button com `backgroundColor: primaryColor` abaixo do título
- Ícone em container branco elevado (72x72, borderRadius 18, shadow)
- Cores configuráveis via `c.titleText` e `c.descriptionText`

#### 3. PromotionalBanner: novos props
- `size?: "small" | "large"` — small = row compacta, large = card com imagem
- `showClose?: boolean` (default true) — ocultar botão fechar
- `height?: number` — altura customizada para large mode

#### 4. NOVO tipo: "notification" (iOS notification card)
- **Header** (bg branco): ícone pequeno + notificationTitle + notificationBody + "now"
- **Separator**: hairline
- **Body**: imagem de fundo (default: terrazzo bundled) + LinearGradient overlay + título + descrição + CTA + ícone grande em container branco elevado
- **Posição**: `position: "top" | "bottom"` — slide de cima ou de baixo
- **Modo compacto**: `notificationCompact: true` (default) — inicia mostrando só o header, toque para expandir com spring animation
- **Swipe-to-dismiss**: PanResponder direção-aware (swipe up para top, down para bottom)
- **Asset**: `assets/notification-bg-terrazzo.jpg` (36KB JPEG, comprimido de 5.7MB PNG)

### Arquivos modificados
- `utils/modal-promotional-content.tsx` — novo `NotificationCardContent`, banner props
- `utils/types.ts` — `"notification"` no union, `notificationTitle`, `notificationBody`, `position` fields
- `assets/notification-bg-terrazzo.jpg` — novo asset (terrazzo pattern)

### Testado no simulador
- Notification (bottom): OK — slide de baixo, texto legível com gradient overlay
- Notification (top): OK — slide de cima, safe area respeitada
- Dismiss via overlay tap: OK
- Banner inline (small/large): OK
- Card Banner Bottom: OK

---

## 2026-02-19 - Refatoração do Sistema Promotional Content

### O que foi feito
Refatoração completa do sistema de conteúdo promocional para suportar múltiplos tipos de exibição.

### Arquivos modificados
1. **utils/types.ts** — Adicionados tipos `PromotionalType`, `PromotionalConfig` e `PromotionalShadow`
2. **utils/modal-promotional-content.tsx** — Refatoração completa (~1000 linhas):
   - Renomeado default export de `ModalPromotionalContent` → `PromotionalContent`
   - Renomeado hook `usePromotionalModal` → `usePromotional`
   - Aliases deprecated mantidos para backward compatibility
   - Remote config: lê `promotional` com fallback para `appmodal`
   - `getConfig()` — lê config do remote com fallback
   - `buildShadowStyle()` — converte PromotionalShadow para ViewStyle
   - Novo tipo `bottom-sheet`: código existente extraído para `BottomSheetContent`
   - Novo tipo `card-banner-bottom`: DOIS modos:
     - Sem `bannerImg`: gradient + title/description + CTA button + icon
     - Com `bannerImg`: imagem de fundo, layout tipo notificação (header + icon, sem botões, card inteiro clicável)
   - Novo tipo `fullscreen`: interstitial com timer countdown e botão X após timer
   - Novo componente `PromotionalBanner`: View inline (não modal) para tipo `banner`
   - Hook `usePromotional` ignora type `banner` (é inline, não modal)
3. **templates/RootLayout.tsx** — Atualizado imports e uso para novos nomes
4. **index.ts** + **index.d.ts** — Exportam `PromotionalType`, `PromotionalConfig` e `PromotionalShadow`
5. **utils/Utils.ts** — Refatorado `prepare()` para aceitar `AppStrings` com `rckey`/`adUnits`
6. **utils/appopen-ads.tsx** — Lê adUnits do global
7. **utils/config-integrity.ts** — Removido rckey/adunits do integrity reporting
8. **templates/Strings.ts** — Novo template para chaves por plataforma

### Backward compatibility
- `ModalPromotionalContent` exportado como alias deprecated
- `usePromotionalModal` exportado como alias deprecated
- `AppModalConfig` re-exportado como alias deprecated
- `getConfig()` faz fallback de `promotional` → `appmodal` no remote config

### Tipos de exibição suportados
| type | Componente | Descrição |
|------|-----------|-----------|
| `bottom-sheet` | PromotionalContent | Modal 65% tela, slide-up, drag-to-dismiss (existente) |
| `card-banner-bottom` | PromotionalContent | Card compacto no bottom, swipe+X para fechar. Com `bannerImg`: layout notificação |
| `fullscreen` | PromotionalContent | Interstitial com timer, botão X após timerSeconds |
| `banner` | PromotionalBanner | View inline, não é modal |

### Tipo PromotionalShadow
```typescript
export type PromotionalShadow = {
    color?: string;
    offsetX?: number;
    offsetY?: number;
    opacity?: number;
    radius?: number;
    elevation?: number;
};
```

### Teste no expo-utils-test
- App de teste com mock do remote config em `_layout.tsx`
- `mockPromoType()` permite trocar tipo dinamicamente
- Testado `bottom-sheet` — funciona OK
- **PENDENTE**: testar `card-banner-bottom` (com e sem bannerImg), `fullscreen`, `banner`

### Problema identificado com usePromotional hook
- O hook tem checks async (AsyncStorage) e `delayMs` timeout
- No teste, usar `useState` direto funciona; o hook pode ter race condition
- Bypassed com useState direto no teste

### Strings hardcoded em português
- Linha 280: "Não mostrar novamente" — hardcoded em PT
- Pode precisar ser traduzido via i18n ou prop `t`

### STATUS ATUAL (para retomar)
1. **FEITO**: Todas as mudanças de código commitadas e pushed para GitHub
2. **FEITO**: expo-utils reinstalado no expo-utils-test via `npm install github:Pixel-Logic-Apps/expo-utils`
3. **FEITO**: Mock atualizado com `bannerImg` e `shadow` no `_layout.tsx`
4. **FEITO**: `npx expo run:ios` executado — build succeeded, app abriu no simulador
5. **PENDENTE**: Testar visualmente cada tipo no simulador:
   - Clicar "Card Banner Bottom" para ver layout com imagem de fundo
   - Clicar "Fullscreen" para ver interstitial com timer
   - Verificar "Banner (inline)" na parte inferior da tela
   - Testar "Bottom Sheet" novamente
6. **PENDENTE**: Atualizar README com documentação do shadow
7. **PENDENTE**: Verificar se strings em PT precisam de i18n

---

## 2026-02-09 - Melhorar Métricas de Entrega FCM

### Problema
Firebase Console mostrava **186k envios** mas **0 Recebidas** e **0 Impressões**.

### Causa
- "Recebidas" e "Impressões" são métricas exclusivas do Android — iOS (APNs) nunca reporta
- Em frameworks cross-platform (React Native), os wrappers nem sempre propagam acknowledgments nativos
- As 312 "Visualizações" confirmam que notificações ESTÃO sendo entregues

### Solução Implementada
Alterações no `utils/Utils.ts` para criar tracking próprio via Firebase Analytics custom events:

1. **`push_received`** (foreground) — logEvent no `onMessage` handler com message_id, topic e title
2. **`push_received_bg`** (background) — setBackgroundMessageHandler com logEvent
3. **BigQuery export** — `experimentalSetDeliveryMetricsExportedToBigQueryEnabled(true)` para métricas detalhadas no Android

### Arquivos Modificados
- `utils/Utils.ts`:
  - Import adicionado: `logEvent` de `@react-native-firebase/analytics`
  - Import adicionado: `setBackgroundMessageHandler`, `experimentalSetDeliveryMetricsExportedToBigQueryEnabled` de `@react-native-firebase/messaging`
  - `setupPushNotifications()`: BigQuery export habilitado, logEvent no onMessage, setBackgroundMessageHandler registrado

### Nenhuma mudança necessária nos apps
- Tudo automático dentro do `prepare()` — apps existentes ganham tracking ao atualizar expo-utils

### Limitações
- iOS: apenas custom events em foreground + "Visualizações" (opens)
- Android: métricas nativas + custom events + BigQuery export
- `setBackgroundMessageHandler` no iOS funciona apenas para data-only messages

### Verificação Pendente
1. Verificar no Firebase Console se Google Analytics está vinculado ao projeto
2. Buildar app de teste com as mudanças
3. Verificar no Firebase Analytics > Events se `push_received` aparece

### Nenhum Erro Encontrado

---

## 2026-02-04

### Deploy v1.0.20

**Pedido:** Deploy e commit do pacote

**Ações realizadas:**
1. Verificado que repositório estava limpo (sem mudanças pendentes)
2. Versão 1.0.19 já estava publicada no npm
3. Incrementado versão para 1.0.20 (patch)
4. Publicado pacote no npm: `expo-utils@1.0.20`
5. Push do commit de versão e tags para GitHub

**Comandos executados:**
```bash
npm version patch  # v1.0.20
npm publish        # + expo-utils@1.0.20
git push && git push --tags
```

**Resultado:** Sucesso - pacote publicado e disponível no npm

---

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

## 2026-02-19 (cont.5) - Fix AskForReview ms delay + Deploy npm 1.0.24

### Tarefa: Fix delay do AskForReview de segundos para milissegundos

**Pedido:** Testar fix do delay do AskForReview no expo-utils-test e depois commit + deploy

**Contexto:** O `review_type_delay` é definido em milissegundos (3000 = 3s), mas o componente AskForReviewOverlay tratava o valor como segundos diretamente, causando "Agora Não (2979s)" ao invés de "Agora Não (3s)".

**Ações realizadas:**
- Copiou `ask-for-review.tsx` atualizado para `expo-utils-test/node_modules/expo-utils/utils/`
- Testou no simulador iOS (iPhone 16e - iOS 26.2): overlay mostrou "Agora Não" corretamente (3s countdown)
- Commit: `195c84a` - fix: convert review_type_delay from milliseconds to seconds in AskForReview overlay
- Bump versão: 1.0.24
- Publicou no npm: `expo-utils@1.0.24`
- Push GitHub + tags

**Arquivos modificados:**
- `utils/ask-for-review.tsx` — Adicionou `Math.ceil(delay / 1000)` para converter ms→s
- `README.md` — Documentou `review_type_delay` como milissegundos

**Fix técnico:**
```typescript
// Antes (bug): 3000ms tratado como 3000 segundos
setRemainingTime(delay);

// Depois (fix): 3000ms → 3 segundos
const delaySec = Math.ceil(delay / 1000);
setRemainingTime(delaySec);
```

**Resultado:** Sucesso — v1.0.24 publicada no npm

---

## 2026-02-26 - Chore: Remover eas_login.sh obsoleto

### Tarefa: Deletar eas_login.sh e todas as referências

**Pedido:** Usuário pediu para apagar o `eas_login.sh` pois é obsoleto.

**Ações realizadas:**
- Deletado `templates/eas_login.sh` (continha credenciais hardcoded)
- Removida função `handleEasLoginScriptFlag()` de `bin/install.js`
- Removida chamada no fluxo `--new` (linha 1047)
- Removido handler `--eas-login-script` dos flags individuais (linha 1087)
- Removido `eas_login.sh` do conteúdo do `.easignore` gerado
- Removida referência no `README.md` (seção Templates Prontos)
- Removida referência no `CLAUDE.md` (seção CLI flags)

**Arquivos modificados:**
- `templates/eas_login.sh` (deletado)
- `bin/install.js`
- `README.md`
- `CLAUDE.md`

**Resultado:** Sucesso — commit `bef89c0` pushed to main

---


## 2026-06-23 — Onde está o token de publish do npm

A senha/token de **publish** do npm (conta `developerpixellogicapps`, owner do `expo-utils`) está no **`~/.npmrc`** (chmod 600). `npm publish` usa ela direto — não precisa colar token nem OTP. O token NÃO fica em texto puro aqui.


---

## 2026-07-10 — CrossPromo, review_show_delay, RNFB v25 RC, Expo SDK 57 (1.1.21 → 1.2.1)

### Contexto da sessão
Trabalho no pacote `expo-utils` (lib + CLI). Releases publicadas no npm e push em `main`. Token npm em `~/.npmrc` (conta `developerpixellogicapps`).

### 1. CrossPromoCard (npm **1.1.21**)
**Pedido:** extrair cross-promo do app host como componente reutilizável; mínimo de código; cores sem import de `@/constants/colors`.

**Implementação:**
- Arquivo novo: `utils/cross-promo-card.tsx`
- Lê `global.remoteConfigScreens?.cross_promo` (RC key `screens`)
- Gate: `enabled && url && screens.includes(screen)` → senão `null`
- Props: `screen: string`, `colors: CrossPromoColors | {light, dark}`, `style?`
- `colors` aceita mapa light/dark (resolve com `useColorScheme`) **ou** theme resolvido / objeto item a item
- Sem Ionicons; CTA só texto; `Linking.openURL`
- Export em `index.ts` e `index.d.ts`

**RC shape (`screens.cross_promo`):**
```json
{
  "enabled": true,
  "title": "...",
  "app_name": "...",
  "subtitle": "...",
  "icon_url": "...",
  "cta": "Ver",
  "url": "...",
  "ios_url": "...",
  "android_url": "...",
  "screens": ["home", "perfil"]
}
```

**Commit:** `805f0b5` feat: add CrossPromoCard for RC-driven cross-promo

### 2. askForReview `showDelay` + RC `review_show_delay` (npm **1.1.22**)
**Pedido:** parâmetro de delay **antes do review aparecer** (não confundir com countdown do botão "Agora não"); também configurável via Remote Config; documentar.

**Implementação:**
- `askForReview(texts?, image?, showDelay?)` em `utils/ask-for-review.tsx`
- Prioridade: **arg `showDelay` → `global.remoteConfigUtils.review_show_delay` → 0**
- `RemoteConfigUtilsType.review_show_delay?: number` em `utils/types.ts`
- README: seção `askForReview()` + tabela RC + distinção vs `review_type_delay` / prop `delay` do overlay

| Campo / API | Função |
|-------------|--------|
| `showDelay` / `review_show_delay` | ms **antes do review aparecer** |
| `delay` / `review_type_delay` | ms até habilitar **"Agora não"** no popup |

**Commit:** `0799c8f` feat(review): add showDelay and RC review_show_delay

### 3. Fix Remote Config RNFB v25 (npm **1.2.0**)
**Causa raiz (app host):**
```
RC ERR: setConfigSettings is not a function (it is undefined)
```
Com `@react-native-firebase/remote-config@25`, `setConfigSettings` e `setDefaults` **sumiram do modular**. O throw em `getRemoteConfigUtils()` → catch → DEFAULT → `fetchAndActivate` nunca roda → `global.remoteConfigScreens === {}`.

**Fix dual-path em `utils/Utils.ts` (`fetchConfigs`):**
- v24: `setConfigSettings` / `setDefaults` se forem funções
- v25: `remoteConfig.settings = …` + `setDefaults` na instância **ou** `defaultConfig = …`
- `fetchAndActivate` / `getValue` inalterados
- Peers Firebase permanecem `>=24.0.0` (compat dual)

**Validação antes do commit (pedido do user):** script mock v24/v25/hybrid OK; sem commit até aprovação.

**Commit:** `dbf2016` fix(remote-config): support RNFB v25 settings/defaults API

### 4. Target Expo SDK 57 + deps (npm **1.2.1**)
**Pedido:** atualizar **todas** as deps, não só Firebase; mirar **Expo 57** (última).

**Peers / devDeps (resumo):**
| | Floor |
|--|--------|
| expo / expo-* | **>=57.x** (latest patch) |
| react-native | **>=0.86.0** |
| react | **>=19.2.3** |
| @expo/config-plugins | **>=57.0.3** |
| hot-updater trio | **>=0.35.3** |
| AdMob | **>=16.4.0** |
| purchases | **>=10.4.2** |
| clarity | **>=4.6.3** |
| slider | **>=5.2.0** |
| safe-area | **>=5.7.0** (bundled Expo 57) |
| webview | **>=13.16.1** (não 14) |
| async-storage | **>=2.2.0** (Expo 57 ainda 2.2; não forçar 3.x) |
| Firebase peers | **>=24** (dual); devDeps **>=25** |
| chalk | **^4** (CLI CJS; chalk 5 é ESM) |

**Docs/CLI:**
- README + CLAUDE: `default@sdk-57`, compat Firebase v24+/v25
- `bin/install.js`: pin hot-updater `>=0.35.3`

**Riscos documentados na conversa:**
- **Alto:** host em SDK 55/56 com expo-utils 1.2.1 → mismatch nativo; precisa upgrade + rebuild
- **Médio:** hot-updater parcialmente em 0.35; Firebase 24/25 misturado
- **Baixo:** AdMob/Purchases minors; dual-path RC; async-storage 2.x

**Commit:** `6f87d1d` chore(release): 1.2.1 — target Expo SDK 57

### Releases desta sessão

| Versão | Conteúdo |
|--------|----------|
| **1.1.21** | CrossPromoCard |
| **1.1.22** | showDelay + `review_show_delay` |
| **1.2.0** | RNFB v25 Remote Config dual-path |
| **1.2.1** | Peers Expo SDK 57 / RN 0.86 + docs |

### Arquivos tocados (resumo)
- `utils/cross-promo-card.tsx` (novo)
- `utils/ask-for-review.tsx`
- `utils/types.ts`
- `utils/Utils.ts` (RC dual-path)
- `index.ts`, `index.d.ts`
- `package.json`
- `bin/install.js`
- `README.md`, `CLAUDE.md`

### Uso rápido
```bash
bun add expo-utils@1.2.1
# Host deve estar em Expo 57 + RN 0.86; Firebase idealmente 25 alinhado; rebuild nativo
```

```tsx
import {CrossPromoCard} from "expo-utils";
import {askForReview} from "expo-utils/utils/ask-for-review";

<CrossPromoCard screen="home" colors={Colors} />
await askForReview(); // usa RC review_show_delay
await askForReview(undefined, undefined, 3000); // override local
```

**Resultado:** Sucesso — `expo-utils@1.2.1` no npm (`latest`), `main` em `6f87d1d`.


---

# 2026-07-31 — Store-Ready Playbook copiado do expo-eleicao-1

**Pedido:** Copiar o playbook que está em eleição para dentro do expo-utils.

**Ação:**
- Origem: `expo-eleicao-1/fastlane/STORE-READY-PLAYBOOK.md` (665 linhas)
- Destino: `expo-utils/docs/STORE-READY-PLAYBOOK.md`

Playbook operacional (pldev + Fastlane + AI) para deixar app Expo store-ready com gate humano passo a passo. Ainda **não commitado** no repo expo-utils nesta sessão (só copiado).


---

# 2026-09-20 — Review tutorial em produção, `review_style`, squircle e ícone automático (1.3.1)

**Pedido inicial:** ver o tutorial de avaliação num app de verdade, resolver os outros idiomas,
fazer funcionar sem parâmetro, medir/comprimir o tamanho e não publicar os HTMLs de teste.

### Tutorial de avaliação (`utils/review-tutorial/`)
- **31 idiomas** em `labels.ts`, **extraídos do APK da Play Store** (não traduzidos). Fonte: o
  universal `/product/priv-app/Phonesky/Phonesky.apk` de um emulador `google_apis_playstore` +
  `aapt2 dump resources`; o `base.apk` instalado só traz o idioma do aparelho. Os rótulos escritos
  à mão estavam errados em vários pontos (`Manage apps & device`, `Write feedback`,
  pt `Sem classificação`…). Cinco abas vêm do backend da Play e seguem só em pt/en/es.
- **Fonte Roboto embutida removida** (−34,8 KB): é Android-only e o Android já tem
  `<family name="roboto">`. HTML gerado: 127 → 75 KB.
- `defaultUserName` por idioma ("Você") + avatar laranja fixo quando não vem `userName`
  (hashear o nome traduzido daria uma cor por idioma). O círculo cinza do header virou avatar.
- `align: "top"` para o formsheet (o `contain` centralizava e deixava faixa sob a linha do header).
- HTMLs de preview fora do npm (`"!utils/review-tutorial/*.html"`): pacote 544 → ~262 KB.

### Ícone do app sem parâmetro (`app.plugin.js` → `withAppIconDataUri`)
O config plugin reduz `expo.icon` para 96px e grava o data URI em `extra.expoUtilsAppIcon`; o
overlay lê de `Constants.expoConfig`. **Não toca no `app.json`** (só o `app.config` gerado).
Usa `jimp-compact` (vem com `@expo/image-utils`) — **`sharp` NÃO é dep do Expo**, só aparecia no
expo-urna por causa do miniflare. Motivo de ser no plugin: em release no Android o asset do
bundle vira nome de drawable e `appIcon={require()}` some em silêncio.

### `review_style` (Remote Config) / prop `variant`
`bottomsheet` (padrão, histórico) · `formsheet` (100% largura, metade da tela, sem raio, só
slide-up sem bounce, X em header próprio) · `centered` (botões empilhados) · `fullscreen` (X +
1 botão no rodapé). Nos layouts com X ele **é** o "Agora não" e só aparece quando o
`review_type_delay` zera. Card do Android subiu para `marginBottom: 60` (ficava sobre a nav bar).

### Squircle sem dependência (`utils/squircle.tsx` + `squircle-assets.ts`)
9-slice de `View` + `Image` com `tintColor`. Três regras, todas de defeito medido em aparelho:
nada se sobrepõe (Android aplica opacity por filho → cruz sob alpha), tudo em px físico por
`left`/`top` (Yoga posiciona `bottom`/`right` contra o pai não arredondado → 1px de erro), PNG de
uma cadeia de tamanhos. `radius` lê igual a `borderRadius`: caixa 1,6·r, expoente 3,4282.
Gerador: `docs/squircle-gen.py`.

### Armadilhas desta sessão (também na memória do projeto)
- `bun add <tarball>` **reusa o cache por nome@versão** — instala código velho mesmo com
  `--force`. Extrair o tar por cima de `node_modules/expo-utils` e conferir com grep.
- Metro não checa tipos: rodar `tsc` num app host antes de fechar versão (pegou chave duplicada).
- Pendência conhecida, anterior a esta sessão: 6 erros de TS em `Utils.ts`
  (`logEvent(...).catch()` contra a tipagem `void` do RNFB novo).

**Resultado:** tudo verificado no emulador Android (app em `/tmp/rtdemo/demo`). iOS não testado.

### Publicação e pós-release (mesma sessão)
- **`expo-utils@1.3.1` publicado no npm** (conta `developerpixellogicapps`, é `latest`). Antes do publish:
  typecheck com `tsc` num app host de verdade (o Metro não checa tipos e o pacote distribui `.tsx`)
  — pegou chaves duplicadas (`noSidePadding`/`fillsScreen`) no preset `bottomsheet` de
  `ask-for-review.tsx`, corrigidas. Pendência anterior a esta sessão, NÃO resolvida: 6 erros de TS
  em `Utils.ts` (`logEvent(...).catch()` contra a tipagem `void` do RNFB novo).
- **Token npm**: veio do usuário direto (não estava no backup do Drive — varri por nome, por conteúdo
  <256KB e o backup de 4GB inflado; só havia `.npmrc` de terceiros/swagger e docs do próprio npm).
  Gravado em `~/.npmrc` desta máquina; **vence hoje 20/09 23:40 (Brasília)** — recriar depois.

### Atribuição RevenueCat — atributos vazios no dashboard (investigado, NÃO corrigido)
Usuário mostrou um assinante ativo (eyeidentifier) com TODOS os atributos vazios no RC: Name, E-mail,
Phone, APNS, FCM, IP, ATT Consent, idfa, idfv, GPS Ad ID, Media Source, Campaign, Ad Group, Ad.
O que achei no código (`Utils.setupAttribution`, `Utils.ts:1242`, chamado no fim de `requestTrackingWhenActive`):
- **Coisas que O CÓDIGO TENTA setar** (então "não implementado" é falso): `collectDeviceIdentifiers`
  (idfa/idfv/ip), `setFirebaseAppInstanceID`, `setFBAnonymousID`, `setPushToken`, `setAttributes({TikTok…})`,
  `enableAdServicesAttributionTokenCollection`.
- **Gaps que explicam o dashboard vazio (candidatos, precisam confirmação em device):**
  1. `collectDeviceIdentifiers()` só roda com `attGranted === true`. Mas **idfv e IP não dependem de ATT** —
     usuário que nega ATT fica sem idfv/IP também, quando podiam ser coletados. IDFA sim depende.
  2. `setPushToken(getToken(getMessaging()))` passa o **token FCM**; no iOS `setPushToken` espera o
     **APNS token** (a lib já tem `getAPNSToken` via `ensureApnsReady`). Suspeita de APNS errado/vazio.
  3. **Name / E-mail / Phone**: nunca setados (`setEmail`/`setPhoneNumber`/`setDisplayName` não existem no
     código) — vazios por design, não bug.
  4. **Media Source / Campaign / Ad Group / Ad**: vêm de SDK de atribuição (AppsFlyer/Adjust) — sem um,
     ficam vazios.
- **Sem visibilidade**: `setupAttribution` é fire-and-forget; toda falha vira `expoUtilsWarn`. Não há
  como saber em produção se coletou. **Nenhuma user property/`setUserId` no Firebase Analytics** liga
  RC↔GA4 (o inverso, `setFirebaseAppInstanceID`, já existe).
- **Ideias discutidas para a próxima versão (não implementadas):** (a) evento `rc_attribution` no Analytics
  com flags (att_granted, rckey_real, device_ids_coletados, push_token_set) para enxergar o porquê em
  produção; (b) chamar `collectDeviceIdentifiers()` sempre (idfa só sai com ATT, idfv/IP saem sempre);
  (c) conferir APNS vs FCM no `setPushToken`; (d) Firebase user property com o RC App User ID / status premium.

### Atribuição RevenueCat — diagnóstico fechado + plano (sessão seguinte, mesmo dia)
**Corrige a seção acima** (os "candidatos" eram hipótese; li o fonte dos SDKs nos Pods/AAR dos apps locais):
- O customer do print é **Android** (`...weekly:weekly` = `assinatura:basePlan`, formato Google Play) —
  APNS / ATT Consent / idfa / idfv vazios por plataforma. Dos 16 campos só FCM, IP e GPS Ad ID
  deveriam estar cheios.
- Candidato 1 ("idfv/IP só com ATT") **não explica o vazio**: `setFBAnonymousID` chama
  `collectDeviceIdentifiers` sozinho nas duas plataformas, então IP vazio prova que a cadeia inteira
  não rodou-e-sincronizou. O `if (attGranted)` não protege nada.
- Candidato 2 (FCM no lugar do APNS) é bug real **só no iOS** e deixaria o campo com valor errado, não vazio.
- Causa estrutural: `setupAttribution` é o último passo de uma fila serial com 3 prompts e getters sem
  timeout, e o SDK só envia atributos em compra/background — quem compra no 1º minuto e não volta sai vazio.
  Armadilha extra: só roda se o layout chama `Utils.handleReady` (o README diz que é o `prepare()`).
- Gaps de analytics confirmados: zero eventos em `PaywallUtils`, `ask-for-review`, `cross-promo-card`;
  nenhum `setUserId`/user property; `trackInstall()` devolve `{matched, campaign_id}` e é descartado.
- Pedido do usuário: atributos de **região, língua, país, estado, cidade** no RC. País/língua/região saem
  sem rede (`expo-localization` + `Purchases.getStorefront()`); estado/cidade só por IP → endpoint
  próprio via Remote Config `geo_lookup_url` (opt-in: muda o rótulo de privacidade). No GA4 geo já é automático.
- **Plano completo: `.claude/PLANO-1.4.0-atribuicao-analytics.md`** (fases, critérios de aceite medidos
  no destino, docs a atualizar, decisões em aberto). **Nada implementado.**

---

# 2026-09-20 — 1.4.0: atribuição RevenueCat em 2 fases, geo por IP, funis e push aberta

**Pedido:** "faça tudo e feche como 1.4.0", geo **ligada por padrão** e obtida por IP com serviço
gratuito (por último), + rastrear notificações recebidas **e abertas**. Plano: `.claude/PLANO-1.4.0-atribuicao-analytics.md` (§0 = o que foi entregue).

### O que entrou
- `utils/analytics.ts` — `logUtilsEvent`/`setUtilsUserId`/`setUtilsUserProperty`: logger único, módulo-folha,
  nunca lança, boolean→1/0. **Zerou os 8 erros de TS** com RNFB 26 (`logEvent` tipado `void`): 6 no
  `Utils.ts` + `LoadAdsManager` + `modal-promotional-content`. Em dev imprime cada evento no Metro.
- `utils/attribution.ts` — **fase 1** no boot logo após o `Purchases.configure` (AdServices, Firebase app
  instance id, contexto, storefront, `user_id` do GA4) e **fase 2** em cadeia destacada pós-ATT (device ids
  sempre, FB anon id, push token, geo). `runStep` = timeout por etapa; sync forçado; evento `rc_attribution`.
  iOS: `setPushToken` agora recebe o token **APNS**; o FCM do iOS vai em `fcm_token` (custom).
- `utils/geo.ts` — cadeia gratuita sem chave: **ipwho.is → BigDataCloud (client-side) → GeoJS**, termos
  lidos e os três testados ao vivo; cache 7d; `geo_lookup_enabled`, `geo_lookup_url`, `{"geoAttributes": false}`.
  Descartados: ipapi.co (403 Cloudflare p/ não-browser), ip-api.com (só HTTP + não-comercial), db-ip free
  (limite diário já estourado), ipinfo sem token.
- `utils/push-analytics.ts` — `push_received`, `push_received_bg`, **`push_opened`** (`onNotificationOpenedApp`
  + `getInitialNotification`, dedup por `message_id`), params `topic` (do `from`), `push_id`, `latency_s`.
- Funis: `paywall_*` (novo `placement` em `PaywallOptions`, `trackView`/`trackClose`), `review_*` (com `style`),
  `promo_*` no `CrossPromoCard`, `consent_flow`, `install_attribution` (link-in-bio → `$mediaSource`/`$campaign`).
  User properties `rc_status` e `att_status`. Watchdog de `handleReady` (30s).
- Docs: `docs/ANALYTICS-EVENTS.md` (novo), README, UPGRADE (§4.2.1, armadilhas 21–26), AGENTS.md (regra
  "integração externa só é ok medida no destino"), `templates/AGENTS.md` (REGRA 7).
- `tests/` (24 testes, `./tests/run.sh`, um processo por arquivo — o `mock.module` do bun vaza entre arquivos).

### Descoberto MEDINDO (não estava no plano)
**O Android suspende os timers do JS enquanto a Activity está pausada por diálogo do sistema.** Com o
debounce de 2s a fase 2 só reportou aos **150 s** (depois de eu responder a permissão de push no emulador).
Com envio **imediato** ao fim de cada fase: fase 1 em **1,6 s**, fase 2 em **6,6 s** com o diálogo na frente.
Os testes também pegaram `__DEV__` inexistente fora do runtime do RN (a etapa `uid` falhava).

### Verificado × NÃO verificado
- Verificado: `tsc` contra 3 hosts (RNFB 24.1.1/25.1.0/26.4.0) = 0 erros; 24 testes; geo ao vivo; boot completo
  no emulador Android (clone do `/tmp/rtdemo/demo`, Metro próprio na 8082 — o da outra sessão, 8081, intacto).
- **NÃO verificado:** atributo visível no customer do RevenueCat (no emulador a key era falsa → `synced:0`,
  "credentials issue"), eventos no DebugView, iOS, `push_opened` em aparelho. Falta rodar o §7 do plano num
  app com keys reais.
- Não feito de propósito: Play Install Referrer (módulo nativo novo sem como validar build aqui).
- Pendências do usuário: ligar RC→Firebase e Apple Search Ads no dashboard do RC; declarar "Coarse Location"
  nas lojas (ou desligar a geo); mandar `data.push_id` no `gpt-notification-system`; token npm vence 20/09 23:40.

---

# 2026-09-21 — Teste REAL da 1.4.0 (projeto dedicado) + 3 bugs achados e corrigidos

**Pedido:** "teste isso em um caso real. tudo isso." Comecei clonando o `expo-resultado` e o usuário cortou:
"pq vc n criou um projeto novo só pra testar tudo?" — certo. O clone foi apagado (a pasta real nunca foi escrita).

### Ambiente de teste que ficou montado
- **`~/Documents/projetos/expo-utils-lab`** — Expo 57 do zero, lib por `.tgz`, `expo-utils-install --new` inteiro,
  pacote `com.pixellogic.expoutilslab`, build Android ok (2min38). Telas: `src/app/index.tsx` e `paywall.tsx`.
- **Firebase real:** projeto `local-desenv` (app Android registrado por mim com autorização; DebugView + push de
  teste pelo console). **RevenueCat real:** projeto novo "ExpoUtils Lab" (isolado do "Main" de produção),
  loja de teste `test_…`, offering `default` com 3 produtos.

### Verificado NO DESTINO (Android, emulador)
- **RevenueCat:** customer com FCM, IP, GPS Ad ID, FB Anon ID, Firebase App Instance ID, `language`, `locale`,
  `device_region`, `currency`, `timezone`, `store_country`, `geo_country/state/state_code/city/source`, versão etc.
  **1 min após a 1ª abertura, sem compra e sem sair do app.** Depois: assinatura "Yearly USD 79.99" + entitlement
  ativo + `lab_test` (API `setRevenueCatAttributes`). `rc_attribution`: fase 1 ~3,5s, fase 2 ~7,1s, `synced:1`.
- **GA4 (DebugView):** `review_*` com params, `consent_flow`, `promo_impression`/`promo_click` do cross-promo,
  funil `paywall_*` inteiro (view, cancel, error code 42, product_select, success, close), `rc_attribution`,
  user properties `att_status` e `rc_status` (virou `active` na compra) e `user_id` = App User ID do RC.
- **Push com FCM de verdade:** `push_received` (foreground), `push_received_bg` (background) e `push_opened`
  (toque na notificação, mesmo `message_id`).
- **Instalação do zero:** CLI `--new` → prebuild (config plugin) → Gradle, tudo ok.

### Bugs achados pelo teste (corrigidos)
1. **Popup de review com recorte gigante do "4.7"** (bug da **1.3.1**, já no npm): a `<Image>` ficou só com `flex: 1`
   e `require()` dá o tamanho intrínseco (1024×572) como estilo padrão. Fix: `styles.mediaImage` 100%×100%.
   Verificado nos 4 estilos + medidor numérico validado contra o print ruim do usuário (261px = DEFEITO; 91px = ok).
2. **`AskForReviewEvents.setImage()` nunca era lido** para exibir (e o mount sobrescrevia com a imagem padrão) —
   desde a 1.3.0. O `expo-resultado` registra o banner assim e nunca o viu.
3. **`templates/Strings.ts` com `require("${iconPath}")` sem substituição** — quebrava o bundle de todo app novo
   (1.3.1). Linha removida (nada lê `appStrings.appIcon`).
4. **`synced:0` falso negativo:** `syncAttributesAndOfferingsIfNeeded` rejeita com código 23 quando o projeto do RC
   não tem offering — com os atributos JÁ no customer. Agora códigos 23/2 resolvem `2`.

### Lições de procedimento (também no AGENTS.md)
- Matar o Metro com `lsof -ti tcp:8082 | xargs kill` derruba o emulador (o `netsimd` segura essa porta) — fiz 3x.
- Emulador restaurado de snapshot: FCM só entrega depois de religar a rede (airplane on/off).
- Achado no `expo-resultado` (do app): escolher ícone no onboarding desabilita a `MainActivity`, e os deep links
  (`exporesultado://`) só existem nela → param de funcionar; o dev launcher também não abre mais o app.

### NÃO verificado
iOS inteiro (ATT, APNS no `setPushToken`, AdServices), `push_opened` com o app FECHADO (dev client abre o launcher),
link-in-bio/TikTok (dependem de Remote Config), aparelho físico.
