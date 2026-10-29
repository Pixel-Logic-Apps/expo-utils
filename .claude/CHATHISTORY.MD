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

### 2026-09-21 (cont.) — iOS verificado, origem do install no Android e evidências
- **iOS no destino** (simulador iPhone 17 Pro Max, ATT gravado como NEGADO no TCC.db do simulador — sem acesso de
  acessibilidade pra tocar no prompt): customer no RC com `ATT Consent: Denied`, `idfa` zerado, **`idfv`**, IP, FB Anon ID,
  Firebase App Instance ID, contexto (`store_country: USA`, alpha-3) e `geo_*`. `rc_attribution`: fase 1
  `adsvc,fid,ctx,store,uid` em ~2,1s; fase 2 `ids,fb,geo` em ~6,3s, `synced:1`, `att: denied`. Build iOS do projeto novo ok.
  Ambiente: `pod` só abre com `RUBYOPT=-rlogger` (activesupport 6.1 × concurrent-ruby 1.3.8 no Ruby 2.6 do sistema) e o UDID
  de simulador do `templates/AGENTS.md` (REGRA 0) não existe mais no Xcode 27 — usar o nome "iPhone 17 Pro Max".
- **Origem do install (C3 do plano) — feita:** `utils/install-referrer.ts` lê o Play Install Referrer por
  `Application.getInstallReferrerAsync()` e grava `$mediaSource/$campaign/$adGroup/$ad/$keyword/$creative` na fase 1
  (+ `install_referrer`, `install_medium`, `gclid`). Verificado no destino: **Media Source = Organic** no customer Android.
  Eu tinha adiado isso dizendo que exigia módulo nativo novo — errado, o `expo-application` já tinha a API.
- **Limites reais (respondidos ao usuário):** Google Ads só entrega `gclid` no aparelho (campanha/keyword/criativo só via
  Google Ads↔GA4 ou MMP); Meta/TikTok nada; Android ID não é mais coletado pelo SDK do RC (e não gravamos: política do Play);
  APNS só em iPhone físico.
- **Evidências:** `~/Documents/projetos/expo-utils-lab/evidencias/` (12 prints + `logs-do-teste.txt` + `LEIA-ME.md`),
  incluindo o DebugView com `push_received`, `push_received_bg` e `push_opened`. O usuário procurou esses eventos na tela
  do FCM/Messaging — eles são eventos do **Analytics** (DebugView/Events), não aparecem em Messaging.

### 2026-09-21 (cont. 2) — anúncio da Meta sem MMP + regra "primeira gravação vence" do RevenueCat
- **Pergunta do usuário:** "tem como saber se veio do instagram tiktok facebook sem usar o MMP?" → 3 propostas; ele escolheu a **1**
  (tratar o install referrer dos anúncios da Meta no Android).
- **Feito:** `utils/aes-gcm.ts` (AES-256-GCM só decriptação, TS puro — Hermes não tem WebCrypto; validado contra o `crypto` do Node
  com 200 casos aleatórios + vetor NIST + adulteração) e `mapMetaReferrer` em `utils/install-referrer.ts`. Chave: Remote Config
  `meta_install_referrer_key` (prioridade) ou `AppStrings.metaInstallReferrerKey`. Com chave: Media Source pela plataforma
  (`Instagram Ads`/`Facebook Ads`/`Meta Audience Network`/`Messenger Ads`) + Campaign/Ad Group/Ad com nomes reais + `meta_*`;
  sem chave: marca a rede e guarda `meta_ref_nonce` + `meta_ref_data_1..4`. Evento `install_attribution` ganhou o param `meta`.
  Export novo: `mapInstallReferrer`.
- **Verificado no destino (lab, Android):** referrer sintético no formato da Meta aberto NO APARELHO em 6 ms e os 4 campos
  visíveis no customer do RC (evidência 13). **NÃO verificado com anúncio real** (exige app na Play + campanha).
- **Descoberta medindo — atribuição do RC é "primeira gravação vence":** no customer antigo o `Organic` do boot (16:20 UTC)
  não virou `Instagram Ads` (16:48) embora o `$campaign` da MESMA chamada tenha chegado. Teste de confirmação com
  atributo-controle: `setAttributes({$mediaSource: "Sobrescrita Teste", $campaign: "Campanha Sobrescrita", overwrite_probe})`
  → `overwrite_probe` chegou (17:03 UTC), `$mediaSource`/`$campaign` ficaram como estavam (última atualização 16:51) —
  evidências 14a/14b. Consequência: install orgânico **não grava mais** `$mediaSource` (só `install_medium = organic`).
- **Armadilha de procedimento:** com simulador iOS e emulador Android no MESMO Metro, o Fast Refresh aplicou a edição só no iOS;
  o Android seguiu no bundle antigo e o atributo-controle "não chegava". Editou a tela de teste → recarregar o app Android do zero
  (force-stop + deep link do dev client) antes de concluir qualquer coisa. E os logs do Metro dos dois aparelhos vêm misturados.
- **Pendente (pedido no meio da tarefa):** propostas para o pxdash / previsibilidade de campanha, ARPU e receita rumo a US$ 100k/mês
  — é PERGUNTA: responder com proposta, não codar o pxdash sem ok.

---

# 2026-10-07 — SDK da Unity na mediação Android, Premium vitalício e 3 bugs de atribuição (sem versão nova)

**Pedido:** corrigir bugs confirmados, cada um com teste automatizado, sem commit/push/publish/bump:
(1) Unity Ads na mediação Android ia **sem o SDK** — o adapter `com.google.ads.mediation:unity:4.19.0.0` não
declara `com.unity3d.ads:unity-ads` no POM (APK de produção com o adapter e sem `com.unity3d.ads` → 0% de
match); conferir o POM de TODAS as redes do catálogo; (2) compra vitalícia / PREPAID / promocional não era
Premium (`willRenew` exigido); (3a) link-in-bio perdia o install que falhava na 1ª abertura e mandava
`matched: 0` na falha; (3b) Play Install Referrer lido e `install_attribution` emitido a CADA abertura;
(3c) gbraid/wbraid gravados como `gclid` sem dizer o tipo; (4) só nota de doc: compra possivelmente contada
2x na Meta (integração Meta do RC + `autoLogAppEventsEnabled`).

### O que entrou
- **Mediação** — `data/mediation_adapters.json`: `android.extraArtifacts` (Unity → `com.unity3d.ads:unity-ads:4.19.0`,
  a versão do "Built and tested with" do CHANGELOG do adapter 4.19.0.0; está no Maven Central). `app.plugin.js`:
  `resolveMediationNetworks` marca `fromApp` e resolve os extras (app que troca a versão do adapter leva o SDK junto:
  4.20.1.0 → 4.20.1); `androidMediationDependencies` monta as linhas com dedupe por artefato — a versão do app.json
  vence a do catálogo (a chave `"unity-sdk"` do expo-bobbie-goods continua dando 1 linha). Funções puras expostas em
  `plugin.mediationInternals` só para teste. JSDoc que dizia "TODAS as redes do catálogo" corrigido.
- `scripts/check-mediation-poms.js` (precisa de rede; fora do `run.sh`): POM do adapter no Google Maven + podspec no
  CocoaPods CDN, confere que o extra existe (Maven Central/Google Maven/mavenRepo); exit 1 se alguma rede ficar sem SDK.
- **Premium** — `isPremiumEntitlement` (`utils/PremiumUtils.ts`): ativo e sem `unsubscribeDetectedAt`; `willRenew` →
  Premium; senão, sem falha de cobrança e (sem `expirationDate` | PREPAID | `store: PROMOTIONAL`). Lido no FONTE:
  iOS 5.88.0 `EntitlementInfo.willRenewWithExpirationDate` (Pods do expo-urna-v2) e Android 10.24.0
  `EntitlementInfoHelper.getWillRenew` (AAR do cache do Gradle, javap) zeram `willRenew` em promo, vitalício,
  cancelado, falha de cobrança e PREPAID. Ramo `is_opted_out_trial_enabled` intocado.
- **Link-in-bio** — `utils/link-in-bio.ts` novo (o `Utils.initLinkInBioTracking` delega): a flag
  `tr_is_first_launch_tracking` só é gravada com resposta do servidor (`success: true` ou `matched: true`); sem resposta
  → `install_attribution_error {source, error}` e nova tentativa na próxima abertura; 1x por sessão.
- **Play Install Referrer** — `utils/attribution.ts`: API lida 1x por install; resultado no AsyncStorage
  `@expo_utils_install_referrer` com o `firstInstallTime` (reinstalação/backup restaurado em outro aparelho lê de novo);
  `install_attribution` só nessa leitura; atributos regravados a cada sessão a partir do valor guardado; grava DEPOIS do
  evento (falha no meio = lê e emite de novo na próxima).
- **`click_id_type`** — `utils/install-referrer.ts`: o valor continua em `gclid` (chave que os customers já têm) e o tipo
  vai em `click_id_type` (gclid | gbraid | wbraid).
- Docs: README (SDK da Unity na mediação, Premium em produção, referrer 1x, link-in-bio, `click_id_type`, nota Meta×RC),
  `docs/ANALYTICS-EVENTS.md` (`install_attribution` 1x por install, `install_attribution_error`, `click_id_type`),
  playbook (§3.3 mediação, §4.2.1 com a nota da Meta, §6.4 Premium, armadilhas 31–34), AGENTS.md, `templates/AGENTS.md`
  (REGRA 5).
- Testes novos: `mediation-catalog.test.ts` (tabela do POM por rede NA versão conferida — quebra se a versão do catálogo
  mudar sem rodar o script ou se rede sem SDK no POM ficar sem `extraArtifacts`), `premium.test.ts`, `link-in-bio.test.ts`,
  `install-referrer-once.test.ts` e casos de `click_id_type` em `install-referrer.test.ts`. Fixtures do RC movidas para
  `tests/helpers/rc-fixtures.ts` (o `rc-status.test.ts` importa de lá). `rn-mocks.ts`: `getCustomerInfo`, `setMediaSource`,
  `setCampaign`, `isRevenueCatActive`, `NativeModules`, `installedAt`, e `getInstallReferrerAsync` passou a ser contado.
  `advance()` esvazia 100 microtasks por passo (eram 25): com os awaits novos da fase 1 o `rc_attribution` (num `.then`
  destacado) chegava depois da asserção — orçamento de microtask, nenhum timer envolvido.

### POM / podspec de cada rede (`node scripts/check-mediation-poms.js`, 2026-10-07)
| rede | adapter Android | SDK no POM do adapter | pod iOS → SDK no podspec |
|---|---|---|---|
| applovin | applovin 13.6.3.0 | com.applovin:applovin-sdk:13.6.3 | AppLovin 13.6.3.0 → AppLovinSDK 13.6.3 |
| meta | facebook 6.22.0.0 | com.facebook.android:audience-network-sdk:6.22.0 | Facebook 6.22.0.0 → FBAudienceNetwork 6.22.0 |
| **unity** | unity 4.19.0.0 | **NÃO declara** → catálogo acrescenta com.unity3d.ads:unity-ads:4.19.0 | Unity 4.19.0.0 → UnityAds 4.19.0 |
| liftoff | vungle 7.7.7.0 | com.vungle:vungle-ads:7.7.7 | Vungle 7.7.6.0 → VungleAds 7.7.6 |
| mintegral | mintegral 17.1.71.0 | com.mbridge.msdk.oversea:mbridge_android_sdk:17.1.71 | Mintegral 8.1.6.0 → MintegralAdSDK/All 8.1.6 |
| bidmachine | bidmachine 3.7.1.1 | io.bidmachine:ads:3.7.1 | BidMachine 3.7.1.0.1 → BidMachine 3.7.1 |
| moloco | moloco 4.11.0.0 | com.moloco.sdk:moloco-sdk:4.11.0 | Moloco 4.9.0.0 → MolocoSDKiOS 4.9.0 |
| bigo | bigo 5.10.1.0 | com.bigossp:bigo-ads:5.10.1 | Bigo 5.3.0.0 → BigoADS 5.3.0 |
| pangle | pangle 8.2.0.4.0 | com.pangle.global:pag-sdk:8.2.0.4 | Pangle 8.2.0.3.0 → Ads-Global-Beta 8.2.0.3 |

### Verificado × NÃO verificado
- `./tests/run.sh`: **123 pass / 0 fail** em 16 arquivos (antes: 84/0 em 12). Cada teste novo foi rodado contra o código
  ANTIGO numa cópia temporária e falha: premium 7, link-in-bio 3, referrer 5, catálogo sem `extraArtifacts` 4; o script
  sem `extraArtifacts` sai com exit 1.
- `tsc` (receita do AGENTS: pasta temporária com symlinks, nada escrito nos hosts) contra expo-utils-lab (RNFB 26.4.0,
  RC 10.10.1) e expo-urna-v2 (RNFB 24.1.1, RC 10.9.1): **0 erros**. `utils/review-tutorial/preview.ts` (script Node) fica
  fora do include: erra igual antes e depois (host sem @types/node).
- `expo prebuild -p android --no-install` numa cópia temporária do expo-utils-lab (node_modules por symlink; expo-utils =
  cópia do repo): bloco com `implementation("com.unity3d.ads:unity-ads:4.19.0") // Unity Ads SDK` logo após o adapter;
  com o `mediation` exato do expo-bobbie-goods, 1 linha só (mesmo hash de sync). Gradle
  `:app:dependencies --configuration releaseRuntimeClasspath --no-daemon` numa cópia APFS (`cp -c`) do node_modules:
  adapter da Unity sem filho `com.unity3d.ads`, `com.unity3d.ads:unity-ads:4.19.0` resolvido em 4.19.0, 0 FAILED.
  `find -newer` no lab e no bobbie-goods: nada escrito.
- **NÃO verificado:** APK montado com `com.unity3d.ads` dentro e match da Unity no AdMob (precisa de build publicado);
  link-in-bio contra o servidor real; referrer 1x num aparelho; compra vitalícia real no RevenueCat; a contagem em
  dobro na Meta (hipótese de configuração — só nota na doc, flag intocada).
- Achado NÃO corrigido (pedido era manter o ramo): com `is_opted_out_trial_enabled: true` o Premium vem de
  `activeSubscriptions`, que no SDK sai só de `subscriber.subscriptions` (`CustomerInfo+ActiveDates.swift`) — compra
  vitalícia continua sem Premium nesse ramo.
- Corrigido em seguida (mesmo dia): nesse ramo o Premium agora é `activeSubscriptions.length > 0` **ou** algum
  entitlement ativo. Teste novo em `tests/premium.test.ts` (vitalício e promocional com a flag ligada) — falha com o
  ramo antigo, passa com o novo; suíte 124 pass / 0 fail em 16 arquivos. AGENTS.md (Premium User Detection) e a
  armadilha 32 do playbook atualizados.
- Notas: o `device_id` do TrendingsTracker é aleatório por sessão, então app morto entre o servidor processar e a
  resposta chegar reenvia (raro; antes o install se perdia). O POM do unity-ads 4.19.0 traz
  `com.unity3d.ads-mediation:adquality-sdk:(,10.0.0)` (faixa dinâmica — resolveu 9.10.0).

---

# 2026-10-08 — Retenção: UI de todos os segmentos e ofertas + casos no expo-utils-lab (sem versão nova)

**Pedido:** estender o modal de retenção para PRÉ-VISUALIZAR no expo-utils-lab todos os casos do plano novo
(`docs/PLANO-RETENCAO-OFERTAS.md`, seções 3, 4, 7 e 8). Só UI + pré-visualização: sem motor de detecção, sem compra de
verdade, sem commit/push/publish/bump, sem Metro/emulador/simulador (a sessão principal roda). Remote Config em inglês;
a lib não tem regra própria de "quem vê o quê".

### O que entrou
- **Tipos** (`utils/types.ts`, exportados em `index.ts`/`index.d.ts`): `RetentionSegment`, `RetentionOfferType`,
  `RetentionSegmentConfig`, `RetentionOfferConfig`, `RetentionPeriodUnit`; `RetentionConfig` ganhou `segments` e `offers`
  (o formato da fase 1 — `style`, `max_shows`, `reminder_hours`, `image_url`, `texts` — continua tipando);
  `RetentionTexts` aceita qualquer chave (`billing_issue.title`, `offers.<nome>.cta`…). Oferta sem `product_id` = a
  mesma assinatura que a pessoa tinha; com `product_id` = aquele produto; `subscription` = assinatura específica pelo
  preço normal. `resubscribe`/`winback` embutidas.
- **Textos** (`utils/i18n.ts`, 12 línguas): `segments` (cancelled com as 2 variantes + data "Sua assinatura termina em
  {date}.", billing_issue "Seu pagamento não passou" + estado "Já atualizei", expired "Sentimos sua falta",
  trial_expired "Seu teste grátis acabou", free "Que tal o Premium?" / "…para sempre?" quando a 1ª oferta é o vitalício),
  `ctas`, `cards`, `notice` ("Cancele a assinatura antiga para não ser cobrado de novo" + "Gerenciar assinaturas") e
  `units` (sufixo "/mês" e "nos 3 primeiros meses" por categoria de plural do CLDR). Coreano sem `{app}` (partícula
  을/를 depende do nome).
- **`utils/retention-offers.ts`** (novo, puro): tipo × segmento → botão (`retentionCtaKey`), cartão
  (`retentionCardKind`), ação (`retentionOfferAction`) e próximo estado da pré-visualização (`retentionPreviewNext`);
  `retentionDiscountPercent`, `formatRetentionPrice`/`formatRetentionPercent` (`Intl.NumberFormat`; o `formatted` da
  loja vence), `retentionPluralCategory` à mão (o Hermes do lab não tem `Intl.PluralRules`: `strings` no hermesvm acha
  NumberFormat/DateTimeFormat/Collator e 0 PluralRules), catálogo de exemplo (`discount_50`, `lifetime_deal`,
  `promo_code`) e preços falsos (BRL 19,90 / 9,90 por 3 meses / vitalício 59,90 × 99,90; USD 4,99 / 2,49 / 14,99 × 24,99).
- **`utils/retention-view.ts`** (novo, puro): `buildRetentionView` monta a tela inteira (título/texto/bullets/data do
  segmento, botão principal, no máximo 1 cartão secundário, estado "conferindo", aviso pós-compra) com a mesma ordem de
  textos da fase 1. Para `trial_cancelled` + `resubscribe` o resultado é igual ao `resolveRetentionTexts` (teste compara
  16 línguas × 2 variantes × bullets × 5 Remote Configs).
- **`utils/retention-events.ts`**: `RetentionEvents.show` aceita `segment`, `offers` (já com preço) e `state`
  (`lifetime_notice`); sem eles = fase 1. `showRetentionPreview` ganhou `segment`, `offers` (nomes e/ou objetos no formato
  do Remote Config) e `state`; as opções antigas continuam. Data padrão: 5 dias (trial), 12 (cancelled), nenhuma nos outros.
- **`utils/retention-modal.tsx`**: cabeçalho por segmento (cartão de pagamento com alerta âmbar desenhado com Views na
  falha de pagamento; "✓" verde no aviso), cartão da oferta principal (desconto: preço novo, riscado, selo verde
  #34C759/#30D158, período e regra; vitalício; preço por período; código em pílula monoespaçada + "válido na loja"),
  2ª oferta como cartão tocável com botão próprio abaixo do principal, "Agora não" sempre embaixo. Fora da
  pré-visualização só "Reativar"/"Atualizar pagamento" fazem algo (gestão da assinatura); compra/código dão
  `expoUtilsWarn` e nada. Na pré-visualização cada toque sai no Metro (`[expo-utils] retention preview: …`).
- **Lab**: `src/constants/retention-cases.ts` (novo), bloco "Retenção — casos" em `src/app/index.tsx` (um botão por caso,
  variante do bloco de cima, botão `casos-lingua` alterna aparelho → 12 línguas) e `?case=` em `src/app/retencao.tsx`
  (parâmetros antigos mantidos). Instalado como manda o AGENTS: `npm pack` (no scratchpad) → `tar -xzmf` por cima de
  `node_modules/expo-utils` (o `-m` grava mtime atual: com o 1985 do pack, um Metro com cache por mtime podia servir o
  arquivo antigo) → `cmp` dos 10 arquivos + grep. `package.json` do lab intocado.
- **Docs**: README (seção do modal), playbook §5.4.2, AGENTS.md (seção do modal + lab). `docs/ANALYTICS-EVENTS.md` não
  mudou: nenhum evento novo nesta fase.

### Casos (deep link `expoutilslab://retencao?case=<id>&locale=pt`)
`trial_cancelled_resubscribe`, `trial_cancelled_discount`, `cancelled_resubscribe`, `billing_issue_resubscribe_lifetime`,
`billing_issue_lifetime_bought`, `expired_resubscribe`, `expired_winback`, `expired_discount_lifetime`,
`trial_expired_lifetime`, `free_lifetime`, `offer_code`.

### Verificado × NÃO verificado
- `./tests/run.sh`: **245 pass / 0 fail em 19 arquivos** (antes 185/0 em 18). Novo `tests/retention-offers.test.ts` (48):
  limites da Apple em 6 segmentos × 2 variantes × 6 × 6 ofertas nas 12 línguas com `{app}` de 20 e preços reais (botão
  ≤ 30), tabela de botão/cartão/ação/próximo estado, cartões, Remote Config, plurais, compatibilidade com a fase 1.
  `retention-events.test.ts` 6 → 18 (preview novo + compatibilidade das opções antigas). 6 mutações numa cópia
  (título de 70 caracteres, botão do billing, cartão no resubscribe, `cta` legado em todo segmento, plural russo,
  regra sem `{per}`) — todas quebram os testes.
- `tsc` pela receita do AGENTS (symlinks no scratchpad, strict) contra expo-utils-lab (RNFB 26.4.0, RC 10.10.1) e
  expo-urna-v2 (RNFB 24.1.1, RC 10.9.1): **0 erros**. `bunx tsc --noEmit` no lab: só o erro antigo de
  `src/components/app-tabs.web.tsx` (rota `/explore` apagada), igual antes da mudança. Babel do lab (babel-preset-expo)
  transforma os 12 arquivos tocados para android e ios.
- **NÃO verificado:** nada foi desenhado num aparelho (layout, cores, modo escuro, RTL do árabe, folha do iOS, bottom
  sheet do Android, cartão secundário em tela estreita); `Intl` do Hermes no aparelho (os testes usam o ICU do bun: no
  Hermes o árabe pode sair com algarismos ١٢); as traduções não passaram por revisão humana; nenhuma compra, oferta da
  loja, win-back ou código foi exercitado (o motor é a próxima fase); `docs/index.html` (gerador do JSON) não ganhou o
  `retention`.

---

# 2026-10-08 — Retenção: compra de verdade (`showRetention`) + cenários na loja de teste do lab (sem versão nova)

**Pedido:** o Bruno aprovou "pode colocar o purchase pra funcionar". Até aqui o modal só tinha as telas: na
pré-visualização os botões só registravam no log e fora dela `purchase`/`redeem` davam um warn. Implementar a compra
de verdade (conferência das ofertas na loja, compra, resgate de código, analytics) e um bloco de teste no
expo-utils-lab com os produtos da loja de teste da RevenueCat. Sem commit/push/publish/tag, sem mexer em aparelho, sem
prebuild/build nativo, Metro do lab (8082) intocado, expo-urna-v2 só para typecheck.

**Fatos medidos antes (loja de teste, chave `test_…` do lab):** offering "default" com `monthly` (SUBSCRIPTION,
US$ 9,99, P1M, base plan `testBasePlanId` sem tags, sem intro, sem discounts), `yearly` (US$ 79,99, P1Y) e `lifetime`
(NON_SUBSCRIPTION, US$ 99,99; CONSUMABLE no Android, NON_CONSUMABLE no iOS). Sem descontos, tags, win-back nem códigos.
Cliente do Pixel: `expoutils_lab_pro`, produto `monthly`, TEST_STORE, vencido em 24/09 (`expired`); iPhone: `free`.

### O que entrou (lib)
- **`utils/retention-store.ts`** (novo, importa o SDK, sem UI): `findRetentionPreviousProduct` (por segmento:
  `trial_cancelled`/`cancelled`/`billing_issue` → o entitlement do `rc_status`, via `getLifecycleEntitlement` exportado
  de `utils/rc-status.ts`; `expired`/`trial_expired` → a assinatura vencida mais recente; `free` → nenhum; override
  `productIdentifier`), `resolveRetentionOffers` (nome → `retention.offers` → embutidas → tipo; o catálogo de exemplo
  NÃO vale; confere na loja e para em 2 válidas; puladas em `skipped` com motivo), `purchaseRetentionOffer`
  (`purchased`/`cancelled`/`pending`/`failed`, nunca lança, grava `@isPremium` com Premium), `redeemRetentionCode`.
  Regras por tipo na seção 14 do `docs/PLANO-RETENCAO-OFERTAS.md` (resubscribe iOS × Android, base plan explícito no
  Android com várias opções, comparação normalizada por `pricePerX`, promotional offer assinada de novo na compra, tag
  do Android só em oferta, win-back só iOS, links de código). Produto pelo `getProducts`, com os pacotes dos offerings
  de reserva.
- **Lido no AAR** (purchases 10.22.1, puxado pelo hybrid-common 19.2.0 do RN purchases 10.10.1; `javap`):
  `getProducts(["assinatura"])` devolve um produto por base plan; `getProducts(["assinatura:basePlan"])` filtra pelo
  `GoogleStoreProduct.basePlanId` — na loja de teste o produto não é Google, então pedir `monthly:testBasePlanId` não
  devolveria nada. Por isso a lib pede o id do entitlement como está e escolhe o base plan na resposta. A compra por
  produto (hybrid `purchaseProduct`) busca a assinatura e acha o produto pelo id exato (`storeProductForProductId`).
- **`utils/retention-show.ts`** (novo): `showRetention(options)` → `{request, segment, skipped, reason}`; ordem:
  `retention.enabled === false` → customerInfo → segmento (forçado ou `rc_status`) → Premium ativo não recebe (a não ser
  forçado) → lista (`offers` do app ou `retention.segments.<segmento>.offers`) → loja → `RetentionEvents.show`. Fora do
  `retention-events.ts` porque aquele é módulo-folha (o `Utils.ts` importa dele).
- **`utils/retention-analytics.ts`** (novo): `retention_impression` (1x por pedido), `retention_click`,
  `retention_close`, `retention_purchase`, `retention_purchase_error` (`status` failed/pending + `code`),
  `retention_offer_unavailable`. Preço em `price` + `price_currency` (regra da lib desde o paywall — o pedido falava em
  `currency`; ver "Decisões").
- **Modal** (`utils/retention-modal.tsx`): spinner no botão tocado, todos os botões desligados enquanto compra;
  comprou → fecha com `purchased` (vitalício em `billing_issue` → aviso); cancelou → nada; pendente/falhou → linha acima
  do botão e continua aberto; `resubscribe` com código 6 (loja diz que já é da pessoa, Android) → reativar pela gestão;
  código → `redeemRetentionCode` e fecha com `redeem` (a folha da Apple espera 600 ms o modal sair). Pré-visualização
  igual a antes. Host: `retention_impression` e `retention_close` (inclusive `hidden`).
- `RetentionOffer` ganhou `action` (decidida na conferência; a view usa ela antes do tipo × segmento) e `store`
  (`RetentionStoreRef`, opaca para a view). `RetentionCloseMethod` ganhou `purchased` e `redeem`. Textos novos nas 12
  línguas: `purchaseError` / `purchasePending` (Remote Config `purchase.error` / `purchase.pending`), expostos em
  `view.purchase`. Exports novos no `index.ts`/`index.d.ts` (iguais).
- Docs: plano (status + seção 14 + tabela de eventos + o que foi conferido), `docs/ANALYTICS-EVENTS.md` (seção
  "Retenção"), AGENTS.md (seção do modal, testes, lab), README (abrir com compra), upgrade §5.4.2. `templates/AGENTS.md`
  não fala de retenção: intocado. `docs/index.html` (gerador do JSON) continua sem `retention`.

### Lab (expo-utils-lab)
- `src/constants/retention-live.ts` (novo): cenários `minha_situacao` (segmento real + ofertas do lab para ele),
  `venceu` (expired: resubscribe + lifetime; override `monthly` só quando o cliente não tem produto anterior),
  `anual_comparado` (subscription `yearly` × `monthly`: US$ 79,99 contra US$ 119,88, selo −33%), `falha_pagamento`
  (billing_issue forçado: atualizar + vitalício → aviso pós-compra), `nunca_assinou` (free: vitalício),
  `desconto_inexistente` (discount pulado com `offer_not_found`, valem resubscribe + vitalício); `runRetentionLive`,
  `newLabCustomer` (`Purchases.logIn("lab-" + Date.now())`), `describeLabCustomer`.
- `src/app/index.tsx`: bloco "Retenção — compra de verdade (loja de teste)" (linha do cliente, último resultado, botões
  `live-<id>`, `live-novo-cliente`, `live-atualizar-cliente`; a linha se atualiza a cada fechamento do modal).
- `src/app/retencao.tsx`: `expoutilslab://retencao?live=<id>` (aceita `locale`, `image=1`, `bullets=1`) e
  `live=novo_cliente`; log `[lab] retention-live <id> {about, request, segment, reason, productIdentifier, offers,
  skipped}`. `src/app/rc-produtos.tsx` mantido.
- Instalado como antes: `npm pack` no scratchpad → `tar -xzmf --strip-components=1` por cima de
  `node_modules/expo-utils` → `cmp` dos 70 arquivos do pacote (0 diferentes). `package.json` do lab com o mesmo md5.

### Verificado × NÃO verificado
- `./tests/run.sh`: **312 pass / 0 fail em 21 arquivos** (antes 245/0 em 19). Novos: `tests/retention-store.test.ts`
  (53), `tests/retention-show.test.ts` (12), +2 em `retention-offers.test.ts`; mocks em `tests/helpers/rc-store-mock.ts`
  (getProducts com o filtro de base plan do SDK) e produtos no formato do SDK em `tests/helpers/rc-store-fixtures.ts`.
  15 mutações numa cópia: 14 quebram os testes; a que sobrevive (tag no base plan contar como desconto) é equivalente
  na prática — base plan do Play não tem fase com desconto e a lib já pula opção sem ela.
- `tsc` strict pela receita (symlinks no scratchpad) contra expo-utils-lab (RC 10.10.1 / internal 19.2.0) e expo-urna-v2
  (RC 10.9.1 / internal 18.37.0): **0 erros** nos dois. `bunx tsc --noEmit` no lab: só o erro antigo do
  `app-tabs.web.tsx` (`/explore`). ESLint do lab (config `eslint-config-expo/flat` temporária no scratchpad; o lab não
  tem config): os mesmos 4 achados de antes (2 erros + 2 avisos em código antigo do `index.tsx`/`retencao.tsx`), 0 no
  arquivo novo. Babel do lab transforma os arquivos tocados para android e ios.
- O Metro recarregou os apps sozinho (sem ninguém tocar nos aparelhos por esta tarefa) e o log mostrou a linha nova do
  bloco: Pixel `expired · monthly (expoutils_lab_pro, TEST_STORE, até 2026-09-24)`, iPhone `free · nenhum produto`.
- **NÃO verificado:** nenhuma compra rodou (o Bruno testa no lab); se o `getProducts` da loja de teste devolve os
  produtos (a lib cai nos offerings se não); o código que a loja de teste devolve na falha simulada (42 esperado);
  se o vitalício da loja de teste libera o `expoutils_lab_pro` (sem isso: `premium: false`, o modal fecha igual); e,
  só em loja de verdade: promotional offer do iOS, oferta com tag do Play, win-back, offer codes/códigos do Play,
  resubscribe US$ 0 no Android (e o código 6), pagamento pendente, `managementURL` real.

### Decisões tomadas sem perguntar (anotar para o Bruno)
- `retention_purchase` com `price_currency` em vez de `currency` (regra documentada da lib: `value`/`currency` viram
  receita no GA4 e duplicam o `in_app_purchase`). Cancelamento não gera evento (= cliques − compras − erros).
- `resubscribe` no Android que falha com código 6 cai no "Reativar" pela gestão (não pedido, mas evita erro na cara de
  quem já tem a assinatura ativa e cancelada).
- Produto anterior também busca nos offerings quando o `getProducts` não devolve; `retention.enabled: false` desliga até
  com ofertas passadas pelo app.
- Entrada desta passada no FIM do CHATHISTORY (o arquivo é cronológico e as de 07–08/10 estão no fim; o topo é de 20/09).

### 2026-10-08 — Compra conferida nos aparelhos + review (formsheet/fullscreen) na área segura
- **Compra na loja de teste da RevenueCat (lab, Metro 8082):**
  - **Pixel 10a** (cliente `expired · monthly`): `live=minha_situacao` abriu "Sentimos sua falta" com "Seu plano US$ 9,99/mês" + cartão do vitalício US$ 99,99.
    - "Assinar de novo" abre o diálogo "Test Store Purchase" (monthly, US$ 9,99) com spinner no botão.
    - Cancelar: o modal continua aberto, sem aviso.
    - Falha simulada: `retention_purchase_error` code 42 e a linha "Não deu para concluir a compra. Tente de novo.".
    - Compra válida: `retention_purchase` premium 1, `retention_close` purchased, e o cliente passou a `active · monthly`.
  - **`live=falha_pagamento`:** "Comprar vitalício" abre o diálogo e leva ao aviso "Seu Premium vitalício está ativo / Cancele a assinatura antiga / Gerenciar assinaturas". O vitalício da loja de teste libera o `expoutils_lab_pro`.
  - **`anual_comparado`:** US$ 79,99/ano, riscado US$ 119,88, −33%.
  - **`desconto_inexistente`:** `discount_50` pulado; ficam resubscribe + vitalício.
  - **iPhone 17 Pro** (cliente `free`): "Que tal o Premium para sempre?" com vitalício + anual −33%; compra válida → `active · lifetime`.
- **Review (`utils/ask-for-review.tsx`):** o formsheet e o fullscreen passam a usar a área segura de verdade (`SafeAreaInsetsContext`; sem provider, reserva do `StatusBar`/`expo-constants`). Antes, no iOS, os dois usavam 0:
  - **fullscreen:** o X ficava a 8 pt do topo, embaixo do relógio/Dynamic Island, e não dava para tocar;
  - **formsheet:** o botão encostava na borda, sob a barra de gestos e cortado pelos cantos da tela.

  Agora o formsheet fica a `bottom + 8` e o fullscreen tem `top + 56`, X em `top + 8` e `bottom + 24`. Conferido no iPhone 17 Pro e no Pixel 10a: o X fecha (`review_prompt_action later/close`) e o botão fica acima da barra.
- **Testes e tipos:** `./tests/run.sh` com 312 pass; `bunx tsc --noEmit` do lab só com o erro antigo do `/explore`. Nada commitado.

# 2026-10-09 — Remote Config em blocos: parâmetro `settings` ({utils, screens}) — lib 1.5.0 + pldev

### Pedido (em ordem)
- Reunir `utils` e `screens` ("ficou muito ruim isso", "quero tudo em settings"), mexendo também no pldev.
- Juntar tudo de novo como era antes, sem emenda para o app. Um editor online simples, com controle de versão, fica para depois.
- Versionar pelo próprio Remote Config ("if app.version >= 2.0.0 lê settings 2") e ter `remoteConfigUtils` e `remoteConfigScreens`
  disponíveis separados e juntos.
- Mockup do editor: apps NÃO agrupados (iOS e Android são itens separados, "pode acontecer de estarem em firebases diferentes"),
  abas utils/screens, chave Formulário/JSON no canto superior direito, formulário deduzido do valor, funcionar no celular.
- Sem arquivo de schema ("é menos um arquivo pra manutenção"): ler direto o `types.ts`.
- O pldev escolhe o modelo pela versão do expo-utils do app "até estar pronto pra migrar de vez"; arquivo `rc-config-<plataforma>.json`.
- "ótimo pode fazer" → implementado na lib e no pldev.
- Depois achou o código complexo ("pq usou Record?"). Propus encolher o `settings.ts` e trocar `source: "legacy"` por um booleano;
  resposta: **"n precisa mexer em nada"**. O código fica como está.
- Pediu um diagrama com animação explicando tudo → página publicada (abaixo).

### Decisões (preservar)
- Um parâmetro `settings` por plataforma = `{"utils": {...}, "screens": {...}}`. Os blocos guardam exatamente o que `utils` e
  `screens` guardam hoje: migrar é embrulhar, nada é convertido.
- Versão pela condição: `app.id == '<id>' && app.version.>=(['<V>'])` (a API recusa `app.version >= '1.2.3'`), ACIMA das outras
  condições do app, porque vale a 1ª condição verdadeira na ordem do template. V = 1ª versão do app que sai com a lib ≥ 1.5.0.
- Builds abaixo de V seguem com `utils` + `screens` (cópias exatas que o pldev grava a cada push) ou com o `settings` plano antigo
  (lib 1.0.x). `rc legacy off` apaga as cópias quando o GA4 não mostrar mais versões abaixo de V.
- O formulário sai do `RemoteConfigUtilsType` (parser do TypeScript; tags `@section`/`@label`/`@default`/`@platform` no comentário
  de cada campo). Sem arquivo de schema.
- Modelo pela versão INSTALADA da lib (`node_modules/expo-utils/package.json`; o `package.json` do app pode apontar para um `.tgz`).
- O código da lib fica como está (decisão de 09/10, depois da proposta de simplificar).

### Lib — commit `a721fad` (de Bruno Martins, 09/10 05:37), `package.json` 1.5.0; o npm segue na 1.3.1
- `utils/settings.ts` (novo, módulo-folha): `parseSettingsValue` (aceita `settings` com o bloco `utils` e/ou `screens` como
  objeto; o `settings` plano antigo volta null), `readRemoteConfigBlocks(read)` → `{utils, screens, source: "settings" | "legacy"}`
  e `mergeRemoteConfigBlocks` (`{...screens, ...utils}`).
- `utils/Utils.ts`: default `settings: "{}"`; o `getRemoteConfigUtils` lê os blocos, guarda `remoteConfigScreensBlock` e
  `remoteConfigSource` (começa em `"default"`) e devolve `{...DEFAULT, ...blocks.utils}`; o `getRemoteConfigScreens` sai da mesma
  leitura (se ela não terminou no teto de 10 s, lê os valores ativos direto); o `setupGlobalConfigs` monta os 3 globals; o
  `reportConfigIntegrity` recebe a origem.
- `utils/config-integrity.ts`: o `cfg_integrity` ganhou `cfg_source` (`settings` / `legacy` / `default` = o boot seguiu com os
  padrões). O `cfg_hash` continua sendo o MD5 do bloco utils inteiro: o mesmo hash num build antigo e num novo prova a cópia.
- `utils/PaywallUtils.ts`: a leitura legada usa `remoteConfigUtils || remoteConfigs`.
- `utils/types.ts`: todo campo do `RemoteConfigUtilsType` com comentário e tags; `ReviewType` (union), `appmodal`, `hash`,
  `RemoteConfigSettingsType`; `global.remoteConfigs` tipado como utils & screens. `index.ts`/`index.d.ts` exportam
  `RemoteConfigScreensType`, `RemoteConfigSettingsType` e `ReviewType`.
- `tests/settings.test.ts` (15): formato novo, `settings` plano antigo ignorado, reserva em utils + screens, JSON inválido,
  junção e tags em todo campo.
- Docs na mesma tarefa: README, AGENTS.md, playbook `UPGRADE-EXPO57` (§5.1 e §16), `ANALYTICS-EVENTS.md` (`cfg_source`),
  `STORE-READY-PLAYBOOK.md`, texto do `docs/index.html`, `templates/AGENTS.md` e o plano novo `docs/PLANO-SETTINGS.md` (sem IDs
  de projeto Firebase nem app.id: o repo é público).

### Globals na 1.5.0 (nenhum app precisa mudar)
- `remoteConfigUtils` = bloco utils, com o padrão `{is_ads_enabled: !__DEV__, min_version: 1.0}` por baixo.
- `remoteConfigScreens` = bloco screens.
- `remoteConfigs` = `{...screens, ...utils}` (em conflito vale o utils). `global.remoteConfigs.is_ads_enabled` dá o mesmo valor do
  `remoteConfigUtils.is_ads_enabled`, e agora também traz as chaves do screens (`global.remoteConfigs.apiUrl`).
- Diferença para a 1.4: lá os dois nomes eram o MESMO objeto; agora são dois. Ler dá igual; escrever dentro de um não muda o
  outro. Nem a lib nem os 12 apps de `~/Documents/projetos` escrevem dentro desses objetos (busca em 09/10). O gate da loja grava
  `is_ads_enabled: false` nos dois.

### pldev — SEM commit (detalhes em `pldev/.claude/CHATHISTORY.md`, entrada de 2026-10-09)
- `lib/firebase-rc-editor/rc-model.js` (novo): `planPublish`, `planLegacyOff`, `findAppState`, `readAppConfig` e versões.
  `utils-schema.js` (novo) lê o `types.ts` com o `typescript` do app; `schema-utils.js` removido.
- Um arquivo por plataforma (`.pldev/.firebaserc/rc-config-{ios,android}.json` = `{utils, screens}`; os 4 antigos são juntados
  sozinhos), `rc push --dry-run` (`validateOnly`), `rc legacy off`, `rc create` sem campos de enfeite, editor com o modelo no topo
  e o formulário vindo do tipo.

### Verificado × NÃO verificado
- `./tests/run.sh` no HEAD `a721fad`: **327 pass / 0 fail em 22 arquivos** (312 de 08/10 + 15 do settings).
- `tsc` da lib limpo contra apps com RNFB 24, 25 e 26 (o expo-eleicao tem 3 erros no próprio código, que já existiam com a 1.4.0).
- pldev: `npm test` passa; editor dirigido com Playwright em 1280 e 390 px.
- Sintaxe da condição conferida na API real com `PUT ?validateOnly=true`.
- `pldev firebase rc push --dry-run --account-platform ios` de verdade numa cópia dos arquivos do Resultados: juntou os 2 arquivos,
  viu a lib 1.5.0, perguntou o V (1.1.0), montou a condição "iOS expo resultado Settings", o template ficou com 2.841 de 1.000.000
  caracteres e o Firebase validou. Releitura depois: versão do template inalterada, nada publicado.
- **NÃO verificado:** nenhum app leu o `settings` de verdade. Verifiquei que não quebra; NÃO verifiquei que chega: nada foi
  publicado e nenhum `cfg_source` apareceu no DebugView. O projeto do lab (`local-desenv`) não está nas contas do pldev.

### Páginas (privadas)
- Explicação com diagramas e animação: https://claude.ai/artifact/86MM7QRDpnAZTXji6d5qBx — antes/depois; "quem recebe o quê"
  animado (build novo, build 1.4 das lojas, build da lib 1.0.20 com o `settings` plano, lib nova por hot-updater num binário abaixo
  de V); boot da lib; fluxo do `rc push`; saída real do dry run (conta e IDs escondidos); transição em 5 passos. O `.html` ficou
  no scratchpad temporário: vale a versão publicada, que se atualiza publicando no mesmo link.
- Mockup do editor online: https://claude.ai/artifact/1vSwBmXLzw2CaXRgFfDjnK

### Pendências
- Commitar o pldev (perguntar antes). O `eas-accounts.json` de lá já estava modificado antes desta sessão.
- O status no topo do `docs/PLANO-SETTINGS.md` ainda diz "sem commit" (a lib já está no `a721fad`).
- Medir no destino: autorizar o `local-desenv` no pldev (`pldev firebase auth`), publicar no lab e ver o `cfg_integrity` com
  `cfg_source = settings`.
- `rc pull` antes do 1º `rc push` de cada app: o arquivo local do Resultados (02/10) é mais velho que o Firebase (console em 03/10).
- Ordem sugerida: lab → um app pequeno → apps de eleição só depois do 2º turno (25/10).
- Armadilhas: expo-urna (lib 1.0.20) e expo-urna-v2 são o MESMO app Android, e builds antigos ainda leem o `settings` plano:
  nunca publicar `settings` com blocos sem a condição de versão. O expo-eleicao tem iOS e Android em projetos (contas) diferentes.
  O `node_modules/expo-utils` "1.3.0" do expo-eleicao traz `app_open_enabled` e `preloadInterstitial`, que a lib principal não tem.
- Editor online: depois (Cloudflare Pages + Worker + D1 + Access; §8 do plano).

# 2026-10-10 — Botões glass nativos do iOS 26 no review e na retenção — release 1.5.1

### Pedido (em ordem)
- Botões do review no estilo e no tom de uma imagem do Liquid Glass (Cancel cinza + Accept azul, cápsulas).
- "rode no lab pra eu ver". Depois: o cinza estava errado e a fonte tinha que ser mais leve ("descubra você"); trocar também os
  botões do modal de retenção.
- "de preferência use o glass button do iOS 26 27 nativo, não só tentar deixar parecido" (doc do `@expo/ui` Button).
- Ajustar espaçamentos; "outlined" na retenção e no `centered` do review — depois esclarecido: **"outlined sem borda, só texto"**.
- Prints de todos os componentes no iOS e no Android numa página. Rodadas de ajuste: formsheet com o botão alto e o texto colado,
  fullscreen (escolheu imagem no topo + texto no centro entre as opções A e B), texto 24 → 40 ("muito alto") → 32, título junto
  da mensagem.
- "faça e suba a versão pro expo utils bumping 0.0.1".

### Decisões (preservar)
- `utils/glass-button.tsx`: iOS 26+ com o módulo `ExpoUI` → botão SwiftUI do `@expo/ui` (`glassProminent` + tint; o "Agora não"
  só texto é `plain`). Android, iOS < 26 (o `@expo/ui` troca `glassProminent` por `.automatic`, sem fundo) e binário sem o
  módulo → cápsula RN com os números do nativo. O `@expo/ui` é **dependência do expo-router 57**: já está linkado nos apps
  (Podfile.lock do urna-v2/resultado), sem rebuild. Entrou como peer opcional.
- `glass` puro sobre card branco sai #FDFDFD (= fundo) e some → secundário é `glassProminent` com tint #E9E9EB (o
  `secondarySystemFill` medido no `bordered` nativo; escuro #39393D). Azul padrão #1582EC (o da imagem; o do sistema no iOS 26
  mede #0088FE). Rótulo 17 **regular** (haste/altura do "l" 0,114 = RN 400; o 500 de antes dava 0,142).
- `Host` com `ignoreSafeArea="all"`: sem isso o vidro ficava 17pt acima do lugar no formsheet e na contagem (o SwiftUI aplica a
  área segura enquanto o card entra deslizando por baixo da tela e não desfaz).
- Espaços medidos nos prints: título→mensagem 4; texto→botões 32 (bottomsheet/centered/formsheet); 12 entre botões; 20 até o fim
  do card; formsheet com o botão na área segura + 8; fullscreen com imagem no topo e texto no meio (marginTop auto no bloco e nos
  botões). Retenção: 12 entre botão, cartão e "Agora não"; rodapé = área segura + 8.

### Verificado × NÃO verificado
- iOS (simulador iPhone 17 Pro, iOS 26) e Android (emulador): prints de 12 componentes, medidas por script (alturas 49,7–50, cores,
  vãos), pontas da cápsula RN a ≤0,12px do semicírculo (controle: squircle antigo 15,6px).
- Android: toques via adb chegam (`review_prompt_action` later nos dois "Agora não"; o da retenção fecha o modal).
- `./tests/run.sh` todos passando; `tsc` dos 3 arquivos contra o `node_modules` do lab.
- **NÃO verificado:** toque nos botões nativos do iOS (o simulador roda sem o Simulator.app e não aceita toque por linha de
  comando). Spinner de compra só no harness (`expoutilslab://botoes`), não numa compra.

### Lab (`expo-utils-lab`, sem commit)
- Deep links: `expoutilslab://review?style=&lang=pt|en|fr|ms|el|tr&delay=` e `?hide=1`; `retencao?hide=1`; tela `botoes`
  (harness do glass nativo).

### Página (privada)
- Prints iOS × Android de todos os componentes: https://claude.ai/artifact/GsKGKrVnX8AcUUBD9khYSS

### Pendências
- npm: `latest` = 1.3.1 (1.4.0 e 1.5.0 nunca foram publicadas) e o token do `~/.npmrc` deu 401 no `npm whoami`.

# 2026-10-20 — Startup quase zero, splash animado e a SDK 58 (análise, sem código)

### Pedido (em ordem)
- "análise do expo-utils e dos projetos e avaliar alguma forma de diminuir o startup pra próximo de nulo e alguma forma de
  criar um splash screen mais bacana animado mas sem esforço ... praticamente zerar o tempo de carregamento".
- Legenda com quadradinhos nas barras da página (o que é o azul, o amarelo, o vermelho e o verde).
- "e a SDK 58 não ajuda nada?" → depois: pôr a SDK 58 no relatório e a animação da 1ª abertura sem cache e sem OTA; depois
  também a 1ª abertura sem cache COM OTA e o seletor de cenário no centro.
- "o remote config demora, não tem o que fazer mesmo?" → pediu (sim) as saídas no plano e na página.
- "se eu usar OTA, não precisa de remote config?" (respondido: o RC continua; ver abaixo).
- Salvar tudo aqui para encerrar e ter acesso depois.

### Medido (release do expo-utils-lab, emulador Pixel_10a API 37, n=10 intercalado)
- 1º frame: **4.621 → 625 ms** tirando (a) o `setTimeout(3000)` do `Utils.handleReady` (3.012 ms, sem motivo registrado; entrou
  em `0bf2d78`), (b) o `await initHotUpdater` e (c) o Remote Config pela rede em toda abertura (~990 ms). Piso que sobra: ~0,45 s
  de nativo + JS. AOT completo não mudou nada.
- 1ª abertura sem cache e sem OTA: 5.567 ms hoje (nativo 477, JS 345, RC 1.581 com o Firebase Installation, espera 3.005).
- expo-resultado (logcat de QA já no repo dele): TTID 5,9–6,5 s; num cold start a 1ª janela foi o intersticial e a home ficou
  livre ~19,6 s depois do processo.
- Workers do hot updater (curl do Mac): check 335–638 ms; os 10 pares app×plataforma com bundle publicado são `-f`; zips de
  2,3–27 MB. RC por REST: fetch ~0,47 s + Firebase Installation ~0,53 s no 1º install.
- SDK 58 × 57 (templates padrão, release): 414 × 420 ms, sem diferença detectável (IC95 −105 a +161 ms); o R8 da 58 deixa o DEX
  com 9,8 MB (45 MB sem R8) e deu −39 ms, sem significância.

### Conclusões (preservar)
- Quase todo o tempo é espera artificial e rede dentro da lib, não nativo. "Zerar" de verdade não existe (piso ~0,45 s no
  emulador); a tela útil de quem não é premium é dominada por intersticial/paywall no cold start (decisão do dono).
- Ordem do plano (seção 4): medir antes (Android vitals + evento `boot_timing`, lab como bancada válida) → tirar SÓ os 3000 ms
  e consertar o app-open junto → mudanças baratas (configure do RevenueCat antes do RC, `cfg_integrity` sem await, guard do
  `YOUR-WORKER`, telemetria do OTA) → RC do cache + veredito de ads → OTA fora do caminho → splash adaptativo → consentimento
  sem os +2 s → bundle/nativo baratos.
- Os +2000 ms ficam por enquanto: separavam por acaso os prompts da home dos da lib (ATT some no iOS com outro prompt
  pendente; o 2º pedido de permissão é cancelado no Android).
- RC: `fetchAndActivate` destacado como ÚLTIMA chamada nativa; nunca `fetchConfig` (TypeError no RNFB 24, medido) nem
  `ensureInitialized` (trava a thread `v_native` no Android); modo cache só com `fetchTimeMillis > 0` + valor remoto + marca
  {versão, build, bundle OTA}; kill switch de ads na mesma sessão. 1ª abertura: embutir no build a config que os apps já
  guardam (`rc-config-*.json`) como padrão, anúncios esperando a resposta do servidor (estimado −1,5 s).
- OTA: hot-updater nativo 0.36.14–0.36.17 tem rollback falso por push headless (gronxb/hot-updater#1468, corrigido na 0.36.18):
  eleicao, bobbie e lab só com binário ≥0.36.19. Nunca recarregar com a UI na tela; o `-f` vira "baixar já".
- Splash: overlay em JS com os recursos que o expo-splash-screen já gera (`splashscreen_logo` / `SplashScreenLogo`,
  `PlatformColor`), sem dependência nova; pula a animação quando a home fica pronta em ≤250 ms do onLoad; opt-in por app.
  Correções exigidas: status bar no Android 12+, `setOptions` dos layouts, fade da janela no Android 11, One UI 4, logos maiores
  que o círculo de 192 dp (bobbie, fakeit).
- Não fazer agora: tree shaking + `inlineRequires` (expo#41620), Baseline Profile, tirar os providers do FB/Meta AN, bootsplash/
  Lottie/Rive. Fazer barato: stub do SDK web do RevenueCat no Metro (−28% do bundle, medido), Firestore/Auth fora dos peers.
- SDK 58 não ajuda no startup; migrar exige RNFB 27 no iOS (SPM + frameworks dinâmicos, o contrário do que a lib configura),
  `@expo/ui` explícito, reanimated/worklets/screens/AdMob novos. Só depois de 26/10, a partir da 58.0.16, com a lib adaptada.
- OTA não substitui o Remote Config: o RC desliga ads na mesma sessão, o `min_version` chega em binários antigos que o OTA não
  alcança, uma mudança pesa KB (não MB) e não arrisca crash.
- Calendário: nada de boot novo nos apps eleitorais antes de 26/10 (2º turno em 25/10).

### Achados fora do boot
- App-open no Android depois de diálogo do sistema e de intersticial (RN manda `background` no `onHostPause`): 9 de 10 no
  logcat do resultado; 3× `show()` com o app em 2º plano.
- `banner-ad`/`safe-banner-ad` sem o ramo `isAdsEnabled === false`; UMP com erro pula o `mobileAds().initialize()` (no lab e no
  resultado: "no form(s) configured"); teto do RC usa o DEFAULT (ads ligados) em vez do cache.
- Worker do OTA do bobbie responde 400 (OTA morto); bobbie baixa ~35 MB por cold start.
- expo-eleicao: `TEST_PAYWALL_VARIANT` sem guarda de `__DEV__` (o override vence o RC em produção); SDK do Facebook com
  `OAuthException 190` no logcat.
- RevenueCat Test Store em release fecha o app ("Wrong API Key… The app will close now"): para medir release no lab, chave
  `goog_` ou `DangerousSettings.forceAllowTestStoreInReleaseBuilds()`.
- Xcode 27 sem `ios.enableSceneSupport`: segundo a doc, app não abre direito no iOS 27; nenhum app tem; a SDK 57.0.23+ já
  suporta. Não testado.

### Verificado × NÃO verificado
- Medido: tudo da seção "Medido" acima (Android, emulador), mais o TypeError do `fetchConfig` contra o RNFB 24.1.1 real.
- Lido no fonte, sem reprodução: rollback falso em headless; cancelamento do fetch do RC no iOS (RNFB ≤ 26.0); `onLoad` do
  Fresco com o desenho bloqueado; cor das barras no Android 12+; ATT `notDetermined` com outro prompt pendente.
- NÃO medido: iOS, aparelho real, 4G, tela útil dos apps reais, cadeia UMP → ATT → push sem os +2 s, o overlay (não existe).
- Lab: a medição usou mudanças temporárias (instrumentação, ablação, patch do RevenueCat), todas desfeitas e conferidas com
  `cmp`/`sha256`; o `git status` do lab ficou igual.

### Arquivos e links
- Plano: `docs/PLANO-STARTUP-ZERO.md` (sem commit). Decisões pendentes na seção 8.
- Página (privada): https://claude.ai/artifact/JE14uherTfLHPDZqPrxspJ — hoje × proposto (seletor central: dia a dia, 1ª
  abertura sem OTA, 1ª abertura com OTA; opções do proposto para o RC e o OTA), as 4 animações com os ícones reais, gráfico,
  SDK 58, plano e tabela por app.
- Evidências fora do scratchpad: `~/appdata/startup-zero-2026-10-20/` (`LEIAME.md` explica cada pasta; fonte da página em
  `evidencias/artifact/`, rebuild com `python3 build.py`).
- Sessão: `7b20219f-c66a-41cd-97e5-a42a14f3a047` (`claude --resume` dentro do repo).

### Pendências
- Decisões do dono (seção 8 do plano): os 3 s eram marca? kill switch na mesma sessão? 1º install sem resposta do RC: ads off?
  o `-f` deixa de recarregar? 1ª abertura: esperar o OTA ou rodar o JS da loja? binário com hot-updater ≥0.36.19 no eleicao e
  no bobbie? App Open continua? intersticial e paywall no cold start? splash opt-in e qual preset? `imageWidth` de fakeit e
  bobbie? A/B nos parâmetros do RC? worker de OTA e formulário do UMP só para o lab?
- Nada desta sessão foi commitado (plano, esta entrada).

# 2026-10-21 — Startup: pesquisa da próxima versão (Hot Updater 1.1, Firebase/RNFB 27, Expo 58, libs novas, Firebase em JS)

### Pedido (em ordem)
- Pesquisar se saiu lib nova que encurta o loading, se o Hot Updater 1.1 faz algo a respeito e se o Firebase tem outra
  saída para ficar mais rápido; continuar a pesquisa de 20/10 e atualizar a página.
- Enquadramento do dono: é para a PRÓXIMA versão da lib, que sobe para o próximo Expo com todas as libs atualizadas e "tudo o
  mais otimizado possível"; "não é para resolver nada nesse momento com OTA".
- À parte: compensa trocar o Firebase nativo pelo SDK JavaScript (bundle, build, carregamento, startup)?
- Explicar o "brownfield" do Hot Updater com desenhos e prints, só no que interessa ao Hot Updater.
- "pode travar" o Hot Updater abaixo da 1.0 até a próxima versão.

### Achados (preservar)
- Próximo SDK = **58** (58.0.16, RN 0.88); não existe 59 nem canary; RN 0.89 só nightly.
- Nenhuma lib nova chega perto das 3 esperas da lib (−4 s no lab). Ganhos de fora: centenas de ms no iOS, dezenas no Android.
- **Expo 58 no iOS:** registro de módulos sem buscas de protocolo do Swift (`expo-modules-core` ≥58.0.19 #51455/#51456,
  `@expo/ui` ≥58.0.18 #51459). Terceiro mediu 403/787/482 ms (sem/com `@expo/ui`/com conserto; simulador; expo#51042). Só no
  58. "A 58 não ajuda" vale só para o Android.
- **Hot Updater 1.1:** sozinho não acelera (escolha do bundle igual à 0.36; o SDK não checa sozinho); check 301 → 50 ms com
  cache quente (autor); 1ª OTA −19% com Brotli (medido no bundle do lab) + reaproveita assets; servidor v1 por app; API nova
  (instância; `checkForUpdate` estático some); plugin em `@hot-updater/expo`; Remote Config próprio (08/10; leitura síncrona,
  sem país/idioma/A/B, limite 60.000 caracteres). O bundle do OTA já é HBC (`compileHermes` no adaptador do Expo).
- **Brownfield** (1.1.0): API nativa para app nativo com RN embutido (XCFramework/AAR) que checa antes de o RN subir. Nada
  muda nos apps greenfield.
- **RNFB 27 como piso:** somem o TypeError do `fetchConfig` (consertado na 25.0.0) e o cancelamento por leitura no iOS
  (26.3.0, não 26.0); fica `ensureInitialized` proibido; o setter de `settings` ainda cancela. Desenho novo do RC: boot com
  config embutida + `activate`, fetch depois do 1º frame decide os ads, depois `onConfigUpdate`. Tempo real não avisa "está
  em dia"; `downloadDefaults` só traz o valor padrão; Performance Monitoring para antes do JS.
- **Risco do iOS:** RNFB 27 aborta com linkagem estática (SPM + dinâmico obrigatório); lab tem 13 frameworks dinâmicos,
  estimativa 24–51 (+30 a +230 ms, não medido); `react-native-fbsdk-next` 13.4.3 não linka em dinâmico (#678). Ficar no
  26.4 estático congela o Firebase iOS na 12.19.0 (CocoaPods só leitura em 02/12/2026).
- **Firebase em JS:** não compensa. Só o RC roda (com 3 polyfills); bundle +176 KB JS / +241 KB HBC; perde Analytics,
  Crashlytics, push/tópicos, ILRD, conversões, `$firebaseAppInstanceId`. Init nativo Android 24,5 ms (mediana, n=62).
  Valem: tirar Firestore/Auth (−3,0 a −3,2 MB de DEX; −14 pods) e `analyticsOnDeviceConversion` por app (2,51 MB no iOS).
- Outras libs: manter o stub do RevenueCat (10.15.0 ainda avalia 966 KB); expo-router 58.0.18+ (layouts sob demanda);
  medição com `react-native-performance` 7, release-profiler, Rozenite, EAS Observe (piloto); talvez nitro-fetch, MMKV,
  Baseline Profiles; não: Hermes V1 (já roda), Static Hermes, Re.Pack, Rock, async routes nativo, tree shaking, bootsplash.
- RNGMA 17.2.0 trouxe `useAppOpenAdManager` com supressão depois de outro anúncio de tela cheia (AO-2): avaliar no 4.1.

### Feito
- **Trava do Hot Updater (com ok do dono, SEM commit):** `package.json` (peers `@hot-updater/expo`, `@hot-updater/react-native`,
  `hot-updater` e a devDependency) e `bin/install.js` (`--hot-updater`) em `>=0.35.3 <1`; playbook (1.3 e 2.4) e AGENTS.md
  (`--hot-updater`). Motivo: o `latest` virou 1.1.1 em 20/10 e app novo resolvia a 1.x (sem plugin no pacote, sem
  `checkForUpdate` estático, servidor v0 não atende). Faixa resolve 0.36.19; `./tests/run.sh` passou.
- Plano: seção 13 nova (resumo, Hot Updater, Firebase, Expo 58 e libs, Firebase em JS, ordem, decisões 11–14) e correções nas
  seções 0, 4.3, 4.4, 7 e 11.
- Páginas: startup atualizada (seção "Próxima versão", passo novo "Spike do iOS"); página do brownfield.

### Verificado × NÃO verificado
- Lido no fonte/notas: tudo acima marcado como consertado/versão; conferidos por mim: expo#51042, changelogs do
  `expo-modules-core` 58.0.23 e `@expo/ui` 58.0.21, fbsdk-next#678, `firebase_spm.rb` do RNFB 27, os 13 frameworks do lab,
  `dist-tags` do hot-updater, plugin de RC do Hot Updater (`getStorageItem` síncrono), `compileHermes`, RNGMA 17.2.0.
- Medido hoje: Brotli no bundle do lab (−19,4%); bundles do SDK JS × RNFB (projeto Expo 57 isolado + hermesc); DEX dos APKs
  locais; init do Firebase no logcat de 20/10; CDN ~0,12 s (curl).
- NÃO medido: nada em aparelho; o ganho do iOS do 58; o custo dos frameworks dinâmicos; o check do Hot Updater v1 com cache
  frio; o Remote Config do Hot Updater.

### Arquivos e links
- Plano: `docs/PLANO-STARTUP-ZERO.md` (sem commit), seção 13.
- Página do startup (privada, nova URL; a de 20/10 não abriu nesta conta): https://claude.ai/artifact/RQ9BrGD8MnwnhRNm7t642J
- Página do brownfield (privada): https://claude.ai/artifact/86BsSaV799M1yqCyywLn2V
- Relatórios: `~/appdata/startup-zero-2026-10-20/evidencias/pesquisa-2026-10-21/{hot-updater,firebase,libs,firebase-js}/`;
  fonte das páginas em `evidencias/artifact/` e `evidencias/brownfield/` (`python3 build.py`).

### Pendências
- Commit da trava do Hot Updater (o dono não pediu ainda) e, se quiser que valha para quem instala do GitHub, push.
- Decisões das seções 8 e 13.7: RNFB 27 × 26.4 estático (depois do spike do iOS), RC do Hot Updater, servidores v1 do OTA,
  piloto do EAS Observe.

### Adendo de 21/10/2026: regra do Remote Config fresco e o remote próprio
- **Regra do dono (imprescindível):** o app só aparece com todo o Remote Config da abertura carregado da rede; nada pode
  aparecer e sumir (anúncio que liga e desliga, botão que aparece e some). O "cache primeiro" e o boot com a config
  embutida saíram do plano (4.3 reescrita). Falha/teto: última config boa (ou a embutida) e anúncios desligados; config
  congelada na sessão. Bug a corrigir: no teto de 10 s a lib liga os anúncios pelo `DEFAULT`.
- Com a regra, o proposto no lab fica em **~1,6 s** com o Firebase (soma das fases medidas; antes se falava em 0,6 s, que
  supunha o RC do cache).
- Pergunta: um remote próprio deixaria mais rápido? **Sim (estimado).** Medido do Mac, conexão nova, n=12: arquivo no site
  do dono na Cloudflare 154 ms × Firebase 393 ms só a ida e volta (fetch real ~470 ms, 20/10) e +0,53 s de Installation na
  1ª abertura. No app: ~1,0 s hoje × ~0,3 s estimado → abertura ~0,9 s, ~0,6 s com a busca saindo do nativo
  (nitro-fetch `prefetchOnAppStart` ou módulo próprio). O Remote Config do Hot Updater 1.x já é esse remote pronto.
  Criptografia não pesa; assinar é o que impede mexer na resposta. Seção 13.8 do plano.
- Página do startup republicada (mesmo link) com a simulação buscando o RC na rede e o seletor Firebase × próprio.
- Pendências novas: teto da espera; kill switch no meio da sessão; decisão 15 (remote próprio); medir no lab (a) Firebase,
  (b) JSON estático na Cloudflare a partir do import, (c) com busca no nativo.

# 2026-10-21 (2) — Volta do 2º plano: teste real Android + iOS, o "fantasma" e o conserto ("aplica ao sair")

Continuação do dia, já descendo do plano para o TESTE REAL do comportamento de voltar do 2º plano (plano
`docs/PLANO-STARTUP-ZERO.md`, seção 4.3). Tudo no `expo-utils-lab` (NUNCA em app de produção). NADA commitado; nada
na lib ainda — a feature "volta do 2º plano" é protótipo de lab. É pra PENSAR em implementar depois.

### Pedido (em ordem, palavras do dono)
- Trade-offs de "saiu / voltou / atualizou": quais comportamentos dá pra escolher, benefícios e malefícios. (Expliquei
  mal na 1ª vez; refiz como 5 comportamentos de volta.)
- "1 e 2 são as melhores opções" (off e apply) → depois: "N sei se tem necessidade, talvez isso poderia ser
  parametrização" (em vez de decidir agora).
- "Como ficaria essa cortina?" / "Faz um vídeo com e sem cortina simulando pra eu ver se vai quebrar demais, pensei numa
  variante de skeleton."
- "Quero um teste real" → "Faz com iOS tb" → "Testa com remote config tb pra comparação".
- "N consigo ver o vídeo aqui no celt" → passei a mandar os arquivos por SendUserFile (regra global).
- "Não dá pra já mudar em background mesmo? E quando ele voltar já tá alterado?" (o modo "aplica ao sair").
- "Quando gravar vídeo grava só na vertical pra eu ver no celular."
- "Usa um remote config qualquer... coloca no Cloudflare... Faz um mock, cara. Não precisa mandar nada pro servidor."
  (não publicar no Firebase de verdade) → depois: "coloca um arquivo lá no servidor do remote config próprio... pega de
  lá direto" (usar o Cloudflare de verdade).
- "Verifica se no Android não tem alguma forma de desabilitar esse efeito de fantasma."
- "Faz o ajuste. Coloca esse setRecentsScreenshotEnabled(false). Já era pra ter feito."
- "Cara, quando for fazer teste, faz em release."
- "Vamos focar só na versão sem skeleton e sem cortina. Só do sem nada mesmo, sem efeito." (= só o "aplica ao sair")
- "Grava um vídeo só, Android, Cloudflare, sair e voltar rápido. Sem fantasma, sem capa, sem splash. Depois o iOS."
- Vídeos: "um abaixo do outro com legenda" (depois: "não é pra juntar os 3 num vídeo só"); "um pouquinho mais lento,
  ficou rápido pra caralho"; "ficou com lag do Android"; sobre o raw: "por que ficou essa merda de splash e lento?".
- No fim: "ficou ótimo. Salva tudo no chat history pra começar a pensar em implementar. Nenhuma informação pode ser
  perdida."

### Comportamentos da volta (o que dá pra escolher) — preservar
Parâmetro proposto `resume_config` (um por app, no Remote Config):
- `off` — não busca nada ao voltar; só muda quando o app fecha e abre. É a lib de hoje.
- `apply` — ao voltar, busca e, se mudou, troca na frente da pessoa (sem cortina).
- `curtain` — ao voltar depois de N min, cobre com o splash, busca, aplica, remonta e sai.
- `curtain_on_change` — busca em toda volta sem cobrir; só quando MUDOU, a cortina cobre, troca e sai.
- `on_leave` / "aplica ao sair" — busca e aplica ESCONDIDO quando a pessoa SAI; na volta confere de novo e só usa a
  cortina se mudou depois da saída.
Companheiros propostos: `resume_config_after_min`, `resume_curtain_max_ms`, `resume_ads_off`, `boot_config_timeout_ms`.
**Decisão do dono (evoluiu nesta sessão):** começou em "1 e 2" (off/apply), virou "parametrizar", e no fim FOCOU só no
"aplica ao sair" (`on_leave`/`background`), SEM cortina e SEM skeleton. Os modos curtain/skeleton ficam de reserva,
parametrizáveis, mas fora do foco agora.

### Infra de teste criada (tudo em `~/appdata/startup-zero-2026-10-20/evidencias/volta-real/`)
- **Cloudflare DE VERDADE:** Worker `volta-lab` (`https://volta-lab.bruno-vmartins2.workers.dev/volta-config.json`),
  criado nesta sessão a pedido do dono, SEPARADO dos sites dele (conta Cloudflare `541509ac6e9a327338e9bd3359282bba`,
  subdomínio `bruno-vmartins2`). Só serve um JSON estático (`cf/public/volta-config.json`), sem código. Cabeçalhos
  `cache-control: public, max-age=0, must-revalidate` + ETag (304). Medido do Mac, conexão nova: 0,15–0,16 s (borda GRU).
  **Troca de config no teste NÃO é deploy** (~19 s): v1/v2/v3 estão enviadas como VERSÕES (`cf/versions.txt`) e
  `cf/cf_switch.sh <v>` aponta 100% do tráfego pra uma delas por chamada à API (1,5–2,5 s até a borda servir o novo).
  **O Worker continua no ar, sem custo. Apagar quando o dono mandar.**
- **Firebase SIMULADO (mock):** o dono mandou NÃO publicar no Firebase de verdade ("Faz um mock"). `server.py` serve o
  mesmo JSON com atraso configurável: `PORT=8788 DELAY_MS=1000` imita o 1 s que o `fetchAndActivate` levou no lab
  (precisa de `adb reverse tcp:8788 tcp:8788`). Por que não o Firebase real: NENHUMA conta do pldev (`eas-accounts.json`)
  abre o projeto `local-desenv` do lab (todas deram HTTP 403), e o Claude in Chrome estava desconectado. A 3ª fonte
  `firebase-sdk` (o parâmetro real `lab_volta_demo` do Remote Config) existe no harness mas não foi usada (sem credencial;
  `rc_publish.mjs` não rodou).
- **iOS destravado:** o dono rodou `sudo xcodebuild -runFirstLaunch` no Mac (o Xcode 27.1 tinha vindo com os pacotes de
  sistema do 27.0; `simctl` ficava "Unable to discover any Simulator runtimes"). Simulador dedicado só pro teste:
  **`iPhone 17 Pro (lab volta)`**, UDID `CA8BD194-7224-45C2-8112-E59ADF52F735` (em `ios-udid.txt`), iOS 26.5.
- **Scripts:** `run_android.sh`/`run_android_bg.sh` (4 modos + background, cena 1 e 2), `run_android_leave.sh` (só a cena
  boa do "aplica ao sair", `NO_SNAPSHOT=0|1`), `run_android_fast.sh` (volta rápida, `GAP`), `run_mock_batch.sh`;
  `run_ios*.sh` idem (release: launch arg em vez de `simctl openurl`, que pede toque); `make_leave_video.sh` (clipe +
  câmera lenta no fim), `compose_vertical.sh` (grade 2×2). `set_config` escolhe `cloudflare` (cf_switch) | `firebase`
  (mock 8788) | `firebase-sdk` (RC real).

### Mudanças no lab (SEM commit; o lab não é versionado)
- `src/lab-volta/resume.tsx` — provider `ResumeRoot`: modos `off|apply|curtain|skeleton|background`; fontes
  `cloudflare|firebase|firebase-sdk`; `st.current.touched` pra o deep link / launch arg vencer o modo salvo no
  AsyncStorage (efeito do filho roda antes do pai no React — sem o guard, o modo da rodada anterior sobrescrevia); cortina
  = fade 150 ms → commit → remonta (`setRootKey`) → o expo-router volta sozinho pra rota (NÃO usar `router.replace`, abre
  2ª cópia); skeleton cobre conteúdo + banner; `onBackground` aplica escondido na saída sem timers (Android pausa timers
  em 2º plano).
- `src/app/volta.tsx` — tela "Datas" estilo Título: chips de modo e fonte, `config.title`, botão "★ Seja Premium"
  (→ /paywall), `BannerAd` de teste real do AdMob; deep link `expoutilslab://volta?modo=…&fonte=…`.
- `src/lab-volta/ios-launch.ts` — NOVO: lê `Settings.get("labVoltaModo"/"labVoltaFonte")` e manda `router.replace` pra
  /volta. É assim que o release do iOS (sem Metro, sem `openurl`) abre direto na tela.
- `src/app/_layout.tsx` e `src/app/index.tsx` — montam o `ResumeRoot` e, no iOS com launch arg, roteiam pra /volta e só
  escondem o splash (sem ATT/push no teste).
- `android/app/src/main/java/com/pixellogic/expoutilslab/MainActivity.kt` — **o conserto do fantasma**:
  `if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false)` no `onCreate`, agora LIGADO POR PADRÃO
  (o extra `labNoSnapshot=false` do deep link religa, pra gravar o "com fantasma"). Na LIB isso vira um config plugin
  `withMainActivity`.
- `src/constants/Strings.ts` — a chave da Test Store do RevenueCat (`test_ROtutJeZoDJOVpIgPCEdoeaKKyL`) FECHA o app em
  release ("Wrong API Key… The app will close now"). Pros builds de release eu esvaziei a chave (o teste da volta não usa
  RevenueCat) e RESTAUREI depois. O SDK nativo tem `DangerousSettings.forceAllowTestStoreInReleaseBuilds()`, mas o
  `react-native-purchases` 10.10.1 NÃO expõe isso no JS (só `autoSyncPurchases`/`customEntitlementComputation`).

### Achados (preservar — base pra implementar)
- **O "fantasma" (Android):** no "aplica ao sair", ao VOLTAR o Android mostra por ~0,2 s a FOTO que tirou da tela ao SAIR
  (a tela ANTIGA, com anúncio e Premium) antes de a tela nova aparecer — mesmo o app já tendo trocado a config escondido.
  **Conserto: `Activity.setRecentsScreenshotEnabled(false)` (API 33+).** Medido em release: com ela OFF a tela antiga NÃO
  pisca; entra um QUADRO BRANCO (o fundo da janela) por ~0,15 s e já vem a nova. Dá pra pintar esse branco com a cor do
  splash (vira um flash da marca) — mexe no tema nativo; o dono pode querer. Antes da API 33 só havia `FLAG_SECURE`, que
  tira a foto mas bloqueia screenshot no app TODO — não serve.
- **iOS NÃO tem o fantasma:** no iOS o "aplica ao sair" é limpo de fábrica — ao voltar, o app desliza já mostrando a
  config nova (v2), sem foto antiga. NÃO precisa de ajuste. (Testado via `simctl launch` = caminho de tocar no ícone; o
  caminho de arrastar no seletor de apps não foi testado.)
- **Volta RÁPIDA:** o "aplicar escondido" só funciona se a BUSCA da saída terminar ANTES de a pessoa voltar. Se voltar
  antes (rede lenta / Firebase ~1 s), a busca termina com o app já ATIVO e a troca acontece NA FRENTE da pessoa
  (`estado=active` no log). Com o Cloudflare (~0,1 s) a janela é de ~0,1 s → na prática nunca pega. Mais um ponto a favor
  do remote rápido. Mitigação possível (fora do foco agora, porque tira a cortina): na volta, se a busca da saída ainda
  está em curso (`busy`), cobrir com a cortina até terminar.
- **Cold start na volta (NÃO é o normal):** se o Android MATA o processo em 2º plano, a volta é abertura do ZERO (splash
  3 s do `handleReady` + boot inteiro), não retomada. Peguei isso por acidente logo depois de REINSTALAR o APK (a 1ª
  abertura do build novo mostrou o pedido de permissão de notificação e o processo reiniciou). Na retomada QUENTE (processo
  vivo) não tem splash nenhum. Lição pro teste: conceder `POST_NOTIFICATIONS` por `adb`, aquecer o app e só então medir.
- **Tempos (release Android, Cloudflare de verdade):** 1ª busca 375 ms (a frio, DNS+TLS); quentes 67–204 ms. Firebase
  mock ~1 s sempre. iOS release: Cloudflare 93–209 ms; Firebase mock ~1 s.
- Achados de harness: o modo salvo no AsyncStorage sobrescrevia o launch arg (consertado com `touched`); o skeleton tinha
  que cobrir o banner; `router.replace` depois de remontar abre 2ª cópia da tela.

### Vídeos entregues (todos em `~/Downloads/claude/`, enviados por SendUserFile; regra: vertical, pro celular)
- Android e iOS dos 4 modos (dev) e depois o foco em "aplica ao sair".
- `android-cloudflare-sair-voltar-rapido.mp4` — versão final boa: retomada QUENTE, release, velocidade normal, sem
  splash, sem fantasma (quadro branco rápido). **O dono aprovou ("ficou ótimo").**
- `ios-cloudflare-sair-voltar-rapido.mp4` — iOS release, 2× mais lento e suavizado (interpolação `minterpolate` blend
  60 fps), volta limpa já em v2.
- `android-cloudflare-raw-emulador.mp4` — o MP4 cru do emulador (comparação); mostrou o lag do emulador e, numa tomada,
  o cold-start com splash (bug da regravação, já explicado).
- Lições de edição: câmera lenta sem interpolação PULA (parece lag); `minterpolate=mci` DEFORMA na troca app→tela inicial;
  `minterpolate=blend` faz crossfade suave (bom). O "lag" que o dono viu era (a) o emulador engasgando e (b) a câmera
  lenta sem suavização — no aparelho de verdade é liso.

### Verificado × NÃO verificado
- Medido no aparelho (emulador Android Pixel + simulador iPhone 17 Pro), em DEV e em RELEASE: o fantasma e o conserto, a
  volta rápida, a limpeza do iOS, os tempos de busca Cloudflare × mock. Logs `[lab] volta …` no Metro (dev) e no logcat
  (release; o `console.log` sobrevive no release Android).
- Cloudflare medido DE VERDADE (Worker no ar, borda GRU). Firebase foi SIMULADO (mock de 1 s) — o número de 1 s vem da
  medição real do `fetchAndActivate` no lab, mas o Firebase real NÃO foi exercido nesta sessão.
- NÃO verificado: aparelho FÍSICO (só emulador/simulador); o caminho de voltar pelo SELETOR de apps do iOS (só o de tocar
  no ícone); o comportamento com o processo morto de propósito (só o acidental); a feature na LIB (é protótipo de lab).

### Para implementar depois (o dono quer começar a pensar)
- Levar o "aplica ao sair" pra lib (hoje é só no lab): onde mora o provider, como o app marca as telas que leem a config.
- O conserto do fantasma como **config plugin** `withMainActivity` (`setRecentsScreenshotEnabled(false)`, API 33+),
  provavelmente opt-out; decidir se pinta o quadro branco com a cor do splash.
- Parametrizar `resume_config` (e companheiros) no Remote Config; decidir padrões por app.
- Fechar Cloudflare × Firebase como fonte do remote (o rápido mata a volta rápida); se Cloudflare, apagar/renomear o
  `volta-lab` de teste e desenhar o de produção.
- Mitigação da volta rápida (cortina só enquanto a busca da saída está em curso) — só se a cortina voltar ao escopo.
- iOS: nada a consertar no fantasma; confirmar no caminho do seletor de apps e em aparelho físico.

### Pendências de limpeza
- O Worker `volta-lab` no Cloudflare continua PUBLICADO (sem custo). Apagar quando o dono mandar.
- Simulador `iPhone 17 Pro (lab volta)` e os builds de release do lab (Android `app-release.apk`, iOS
  `Release-iphonesimulator`) ficaram na máquina; a chave do RevenueCat do lab foi RESTAURADA.

# 2026-10-22 — Remote Config próprio: arquitetura (dois planos, variáveis/A-B) + relatório PDF em Material 3

Continuação do teste da volta (entrada 2026-10-21 (2)). O dono pediu o DESENHO de um Remote Config próprio
"abraçando todas as possibilidades futuras" e, no fim, um relatório PDF (com ilustração, print e GIF) por
e-mail para analisar e finalizar. Nada de código novo — é projeto/pesquisa. Salvo aqui para implementar depois.

## Arquitetura do Remote Config próprio (respostas ao dono)

- **Dois planos.** Plano de CONTROLE (no publish, uma vez, toda a inteligência): confere tipos/esquema do
  payload, resolve as regras (país, cidade, versão…), monta os A/B e variantes, PRÉ-CALCULA 1 JSON por
  segmento, publica os arquivos + dedupe por hash do conteúdo. Plano de DADOS (no runtime, a cada abertura,
  burro e rápido): o app monta a CHAVE do segmento, pede o arquivo dessa chave à borda (cache do data center
  mais perto), recebe o JSON pronto — nenhuma regra avaliada no app. Segmento novo → um Worker calcula na hora
  e cacheia (compute-on-miss). "O Worker monta a URL de resposta e o JSON é gerado uma vez", como o dono pediu.
- **A chave do segmento É a URL.** Resumo compacto e determinístico do contexto (hash) = nome do arquivo
  estático (ex.: `/cfg/ios/58/BR/premium/homeA.json`). Fallback hierárquico cidade→país→global; saídas
  idênticas apontam para o mesmo arquivo (dedupe). Custo de montar a chave ~0 ms (hash em memória,
  sub-ms) MESMO com muitas variáveis — "URL complexa" não é "cálculo lento". O custo é só I/O: a ida e volta
  (~0,15–0,4 s) e, 1x por sessão, a descoberta do país (~0,15 s).
- **Hierarquia de regras que se sobrepõem** (país × cidade × IP): 1º prioridade explícita (número na regra);
  2º especificidade no empate — IP/CIDR > cidade > estado > país > continente > global; 3º desempate estável
  por ordem/ID + aviso de conflito no publish. Resolvido CAMPO A CAMPO (a cidade manda no banner, o país nos
  anúncios, no mesmo usuário) e TUDO no publish → custo de runtime zero; o app lê valores já achatados.
- **Variáveis abstratas e A/B** (pergunta final do dono: "fez uma compra", "marcou o checkbox", propriedade
  custom, A/B 50% como no Firebase). Duas famílias: (a) o que o SERVIDOR sabe (país, idioma, plataforma,
  versão, o que você sincronizou pro backend) → vira a URL; (b) o que SÓ O APARELHO sabe (comprou? checkbox?
  propriedade custom, balde do A/B) → vem como REGRINHA dentro do arquivo e o app resolve local, com um
  avaliador minúsculo, em sub-ms, ANTES do 1º quadro (não fere a regra do "nada aparece e some"). A/B 50% =
  `variante = hash(idEstável + "exp") % 100 < 50 ? "A" : "B"` — determinístico, mesmo usuário sempre no mesmo
  lado, offline; idEstável = App User ID do RevenueCat ou um install id gravado 1x (= "percentual estável por
  instalação", que o pixel-config já tem). Híbrido: poucas e baratas (premium, comprou) DOBRAM na chave
  (build pré-calcula variantes, 100% estático); muitas/arbitrárias ficam como regra local (sem explodir o nº
  de arquivos). Caso extremo (controle total no servidor, modo rico tipo Firebase) = POST ao Worker com o
  contexto — mais lento, por pedido, reservado só pro que exige. 95% de A/B + propriedade custom resolve com
  regra local no arquivo estático.
- **Por que o D1 engargala** (pergunta do dono): só é consultado em leitura por pedido; cada banco D1 atende
  UMA consulta por vez (~1.000/s com consultas de 1 ms) e devolve "overloaded" quando a fila enche — é o
  desenho dos servidores v0 do Hot Updater (335–638 ms medidos em 20/10). Por isso a resposta é pré-montada no
  publish e servida como ARQUIVO estático, não montada por pedido lendo banco.
- **Protocolo mais rápido (Tom/socket)?** Ajuda pouco: o custo é a ida e volta FÍSICA (DNS+TCP+TLS+distância),
  não o protocolo nem o tamanho. O que ajuda: keep-alive, HTTP/3 (QUIC)+TLS 1.3 0-RTT, borda perto, e começar
  a busca no NATIVO antes do bundle. Socket cru não muda a física.
- **Escala (1 milhão/dia, ~3 mi pedidos/dia, ~35/s; push blast = alguns mil/s por minutos):** arquivo estático
  na borda = grátis e ilimitado; Worker com lógica por pedido ~US$29/mês; +KV +~US$40/mês; +D1 engargala. O
  risco não é carga, é QUEDA (Cloudflare caiu global em 18/11/2025) → endereço de reserva em outro provedor
  (o próprio Firebase pode ser a reserva, pldev publica nos dois).
- País de graça na borda (`request.cf.country`); língua/versão o app manda na URL; a escolha por
  `app.id`/`app.version` do `settings` vira o nome do arquivo.

## Relatório entregue (PDF Material 3 + GIFs + e-mail)

- O dono pediu o relatório no estilo do **Material Design 3** (https://m3.material.io/) — "siga todos os
  guidelines: tipografia, fundo, cor, elementos, animação". Aplicado: papéis de cor M3 (esquema claro de
  dynamic color com semente teal — primary/secondary/tertiary/error + cor custom "warning"), containers tonais
  nos callouts, escala tipográfica Roboto (Display/Headline/Title/Body/Label), shape (cards 12dp, chips 8dp,
  badge circular, mídia 26dp), elevação M3 e cards filled/elevated/outlined. Diagramas SVG recoloridos para os
  papéis M3. Animação: PDF não anima — a "motion" vai nos GIFs do e-mail. (O site m3.material.io é SPA; o
  WebFetch só traz o título, então apliquei as specs canônicas do M3 que já conheço.)
- **PDF:** 13 páginas, ~2,1 MB, autossuficiente (Roboto embutido como woff2 base64 + prints embutidos). Capa +
  12 seções: resumo, abertura (gráfico), Firebase×próprio (tabela+medições), volta "aplica ao sair", o fantasma
  e o conserto (3 prints: v1 / fantasma / v2), iOS + volta rápida, dois planos, chave=URL, hierarquia,
  variáveis/A-B, escala/custo, verificado×a-medir + pendências. Renderizado com Chrome headless
  `--print-to-pdf` a partir de HTML+SVG (fonte em `~/appdata/.../report/`, ver abaixo).
- **GIFs (Android, release, câmera lenta ~2,5x, 360px, Roboto n/a):** `fantasma-com-android.gif` (a v1 "Como ler
  estas datas" + Seja Premium + anúncio pisca ~0,15 s na volta, depois vira v2) e `fantasma-sem-android.gif`
  (com o conserto: volta já na v2, só um clareado rápido, nunca a v1). Gerados dos clipes crus
  `android-leave-comfoto.mp4`/`-semfoto.mp4` (volta em ~t=11,5 s / ~t=9,0 s). Verificado quadro a quadro.
- **E-mail:** enviado por Resend (HTTP 200, id 01a161d4-…) para bruno.vmartins2@gmail.com, de
  `onboarding@resend.dev` (a chave do pixel-analytics sumiu; li do `gpt-notification-system/report.php`). Corpo
  HTML M3 com os 2 GIFs inline (cid) + PDF e GIFs anexos. SendUserFile também entregou PDF + 2 GIFs ao celular.
- **Arquivos na máquina:** `~/Downloads/claude/volta-2plano-remote-config-proprio.pdf`,
  `~/Downloads/claude/fantasma-com-android.gif`, `fantasma-sem-android.gif`. Fonte do relatório (HTML, SVGs,
  `build_m3.py`, `send_email.py`, assets, fonts.css) no scratchpad da sessão (regerável; não copiada pro repo).

## Pendências (iguais, reafirmadas)
- Worker `volta-lab` do Cloudflare ainda PUBLICADO — apagar quando o dono mandar.
- Builds de release e simulador iOS do lab ficam na máquina; chave do RevenueCat do lab RESTAURADA.
- Nada commitado nem publicado em produção. É projeto para implementar na próxima versão (Expo 58).
# 2026-10-27 — App open pelo ProcessLifecycleOwner + pré-carga atrás do Remote Config (ramo feat/anuncios-preload, sem versão nova)

### Pedido
- Duas mudanças de anúncio aprovadas pelo Bruno (via agente coordenador da sessão do eleicoes-ota): (1) no Android, o gatilho
  do app open passa a usar o ProcessLifecycleOwner quando o app tiver o módulo nativo do `react-native-applifecycle` — o
  AppState contava como volta o fechamento de diálogo de permissão, intersticial, folha de compra/compartilhamento; (2)
  pré-carga de app open e intersticial atrás de chaves do Remote Config, com o padrão igual ao de hoje.
- Regras: não mudar posição nem frequência; todo comportamento novo atrás de chave com padrão = hoje; a lib não tem nativo
  próprio (vai por OTA); sem capa, trava de tempo ou temporizador para "voltar". Worktree próprio; sem bump, push ou publish.

### O que foi feito
- `utils/app-lifecycle.ts` (novo, módulo-folha): Android com `NativeModules.ReactNativeAppLifecycle` → assina o evento
  `ReactNativeAppLifecycle` (`ON_START`/`ON_STOP` → `active`/`background`) com `NativeEventEmitter`; sem o módulo, ou no iOS,
  `AppState`. O pacote JS NÃO é importado (app sem ele não quebra no bundle).
- `utils/ad-preload.ts` (novo): leitura das chaves, conferências por timestamp (idade, pausa por erro, espera máxima) e a
  reserva de UM anúncio pronto por formato (`createAdPreloader`: `wants`/`preload`/`take`/`adopt`/`noteLoadError`).
- `utils/appopen-ads.tsx`: mesma janela (10 s depois do CLOSED), mesmas checagens e mesmo registro único; volta decidida pelo
  `addAppLifecycleListener`; pronto usado na volta; espera máxima conferida pela hora no LOADED (sem timer); 1ª pré-carga
  depois de `waitAttFlowDone(2 min)`; pré-carga do próximo no CLOSED.
- `utils/LoadAdsManager.ts`: `showInterstitial` dividido em `presentInterstitial` (listeners da exibição) e
  `loadInterstitial` (carga na hora + espera máxima); pronto usado na chamada; pré-carga no CLOSED. Rewarded intocado.
- `utils/AdPlacementTracker.ts`: `isAdTypeBlocked` (só `*` e o tipo). `utils/types.ts`: 6 chaves com as tags do pldev.
- `package.json`: peer opcional `react-native-applifecycle >=1.0.0`. README (tabela + seção "App open: volta ao app e
  pré-carga") e playbook (§2.5, §5.4, §8, §10.3). `docs/ANALYTICS-EVENTS.md` intocado (nenhum evento/parâmetro mudou).
- Testes: `tests/ad-preload.test.ts` (18), `tests/appopen-ads.test.ts` (16), `tests/interstitial-preload.test.ts` (12) e o
  helper `tests/helpers/ads-mocks.ts` (SDK de anúncios falso, AppState e módulo nativo mockados).

### Chaves novas (bloco `utils`, seção Anúncios)
- `appopen_preload_enabled` (false) · `interstitial_preload_enabled` (false) · `appopen_preload_max_age_minutes` (240) ·
  `interstitial_preload_max_age_minutes` (60) · `ad_preload_error_pause_seconds` (0) · `ad_load_max_wait_seconds` (0 = sem limite).

### Decisões (preservar)
- Pré-carga confere o bloqueio só por TIPO (`isAdTypeBlocked`): chamar `generatePlacementId` na pré-carga registraria um
  chamador a mais e poderia deslocar o índice de um placement real (colisão de hash). Página/placement valem na exibição.
- AdLOADED do pronto sai na hora da exibição, com o placement dela (na pré-carga não há placement); erro da pré-carga e o
  que chega depois da espera máxima não geram AdLOADED/AdERROR. PAID sempre com o placement da exibição.
- 1ª pré-carga do app open espera o fluxo de UMP/ATT de verdade: o teto padrão de 15 s do `waitAttFlowDone` (o do promo)
  passaria com o formulário do UMP aberto (o próprio UMP espera até 20 s). 2 min só para layout sem `handleReady`.
- Intersticial não tem gatilho de boot (não há "setup" de intersticial e o ExpoUtilsLayout ficou fora do escopo): o 1º da
  sessão carrega na chamada e a pré-carga começa no fechamento dele.
- Espera máxima do intersticial usa `setTimeout` só para liberar o fluxo no limite; o LOADED confere a hora também (timer
  suspenso no Android não deixa o atrasado aparecer) e com 0 nenhum timer é criado. Passou do limite → resolve `true`.
- Anúncio que chega depois da espera máxima vira o pronto quando a pré-carga está ligada (sem gastar outro pedido).
- Pré-carga não tenta de novo sozinha depois de erro (evita laço de no-fill); a próxima tentativa vem do próximo gatilho.
- Commit sem `Co-Authored-By`: a última linha do AGENTS.md proíbe e nenhum commit do repo tem.

### Verificado × NÃO verificado
- `./tests/run.sh`: **379 pass / 0 fail em 25 arquivos** (antes 333 em 22). Os testes novos rodados contra o `main` puro
  (cópia no scratchpad): os 3 de "tudo desligado" do intersticial e os 3 do app open (pelo AppState) PASSAM no código antigo
  — prova de que o padrão reproduz o de hoje —; os de gatilho, pré-carga e espera falham. 9 mutações (ON_START inicial,
  sem portão do ATT, limite da idade, sem pausa, só timer na espera, duas fontes, placement da pré-carga, sem bloqueio do
  tipo, app open atrasado aparecendo) — todas quebram algum teste.
- `tsc` strict pela receita do AGENTS (symlinks no scratchpad) contra expo-utils-lab (RNGMA 17.0.0, RNFB 26.4.0) e
  expo-urna-v2 (RNGMA 16.5.0, RNFB 24.1.1): **0 erros**; erro proposital num arquivo novo é pego (os arquivos entram).
- Fonte conferida: RN 0.86.3 (`BridgelessNativeModuleProxy` devolve módulo legado pelo interop ou `null`; o
  `TurboModuleManager` chama `initialize()` do legado; arquitetura nova liga o interop); AGP 8.12 ainda tem o `lintOptions`
  que o `build.gradle` do pacote usa; RN 0.86 ainda tem o `ReactAndroid/gradle.properties` que ele lê; RNGMA 17.0.0
  `AdStalenessGuidanceMillis` = 4 h app open / 1 h outros; npm: `react-native-applifecycle@1.0.0` é o `latest`.
- **NÃO verificado:** nada no aparelho nem build Android com o pacote instalado (autolinking, eventos ON_START/ON_STOP
  chegando, folha de compartilhamento para outro app de tela cheia — essa conta como volta, igual ao Google).

### Pendências
- Testar no lab: instalar o `react-native-applifecycle`, prebuild + build, conferir `[expo-utils] AppOpen trigger:
  process-lifecycle` e os casos de diálogo/intersticial/compra; depois ligar as chaves de pré-carga e olhar o show rate no AdMob.
- AGENTS.md não ganhou nota sobre o gatilho/pré-carga (fora do pedido; a pasta principal tem o AGENTS.md alterado por outro trabalho).

# 2026-10-26 — Alert.alert desenhado pelo Expo UI (SwiftUI no iOS, Material 3 no Android) — ramo feat/alert-expo-ui, sem versão nova

### Pedido
- Bruno (26/10/2026): "implementar no Expo Utils uma abstração do Expo UI para chamar os diálogos de alert. Em todos os
  outros aplicativos continue chamando o alert do mesmo jeito, só que na verdade ele vai abstrair para o novo Expo UI para
  chamar o do nativo." Corrigiu no meio: iOS com o Alert do SwiftUI e Android com o Jetpack Compose (não deixar o iOS no
  Alert do RN); e quer na main, na 1.5.1, sem ramo à parte.
- Regras: a lib sem módulo nativo próprio (vai por OTA); `@expo/ui` como peer opcional, detectado com
  `requireOptionalNativeModule("ExpoUI")`, caindo no Alert do RN sem ele; sem Metro/simulador/build; sem mexer em app nem
  nos arquivos de anúncio; sem bump, push ou publish.
- Feito no worktree `/Users/plapps/Documents/projetos/expo-utils-alert`, ramo `feat/alert-expo-ui` (base ebec071): commits
  `c2552f9` (implementação) e `553401b` (achados da revisão). A main andou para d551d68 nesse meio-tempo.

### O que foi feito
- `utils/native-alert.ts` (folha, testada no bun): troca o `Alert.alert` quando o 1º host registra; sem host, ou depois de
  erro do diálogo, repassa ao Alert do RN com os mesmos argumentos; fila (um diálogo de cada vez), dono único (só o 1º host
  desenha), callback uma vez só, `failNativeAlert` e o mapeamento dos botões (`composeAlertButtons`, `swiftAlertRoles`).
- `utils/native-alert-slot.tsx` (`NativeAlertSlot`, exportado em `index.ts` e `index.d.ts`): só carrega o diálogo com o
  módulo ExpoUI (require em try/catch, exceção anotada na regra de imports do AGENTS.md) e tem error boundary.
- `utils/native-alert-dialog.ios.tsx`: `Alert` do `@expo/ui/swift-ui` com `Alert.Trigger` invisível num Host de 1 pt, um
  Alert por pedido (`key`), role cancel/destructive pelo style. O pedido sai da fila 0,5 s depois do
  `onIsPresentedChange(false)` (remendo: o @expo/ui não avisa o fim da saída e o UIKit recusa o próximo durante ela).
- `utils/native-alert-dialog.android.tsx`: `AlertDialog` do M3 (`@expo/ui/jetpack-compose`), tipografia explícita, cor de
  erro no destructive, `cancelable`/`onDismiss`, mensagem com rolagem; botões do Dismiss invertidos para sair na ordem do RN.
- Quem monta o slot é o `AskForReviewOverlay` (`withSlots`), que o `ExpoUtilsLayout` sempre renderiza; o slot do layout
  saiu na revisão (nunca desenhava) e o `utils/ExpoUtilsLayout.tsx` voltou a ser igual ao da base.
- Último botão sem texto vira "OK" (como o RN). README (seção "Alert.alert nativo"), AGENTS.md (seção própria, imports e
  testes) e playbook (4.2.2 e checklist 10.3). Testes: `tests/native-alert.test.ts` (12).
- Arquivos alterados no ramo: `utils/native-alert.ts`, `utils/native-alert-slot.tsx`, `utils/native-alert-dialog.ios.tsx`,
  `utils/native-alert-dialog.android.tsx`, `utils/ask-for-review.tsx`, `index.ts`, `index.d.ts`,
  `tests/native-alert.test.ts`, `README.md`, `AGENTS.md`, `docs/UPGRADE-EXPO57-EXPO-UTILS.md`.

### Revisão (3 revisores) — decisões (preservar)
- Aplicados: atraso de 0,5 s no iOS (fórum da Apple, thread 721190: próximo alerta logo depois do false → "already
  presenting"); ordem dos 3 botões no Android (material3 1.5.0-alpha17/beta01 põe o confirm como 1º item de um FlowRow de
  direção invertida e cada botão do slot vira um item: [A, B, C] saía "B A C"); "OK" no último sem texto; slot morto do
  layout; docs que prometiam fallback num binário sem ExpoUI.
- NÃO aplicados, ficam com o Bruno: (1) trocar o iOS para o Alert do RN — com Modal, rota modal/fullScreenModal (paywall do
  fakeit, modal-novo-cargo do urna-v2), intersticial ou UMP aberto, o alerta do SwiftUI (sai do Host na raiz) pode não
  aparecer e travar a fila; o do RN usa janela própria. Sem nativo não há contorno nem como detectar a recusa. (2) Manter o
  require protegido do diálogo ou trocar por import no topo como o glass-button: hoje nenhum dos dois salva um binário sem
  ExpoUI, porque o `glass-button.tsx` importa o @expo/ui no topo e o app cai no boot antes. (3) Rebase na main: fica para a
  junção.
- Commits sem `Co-Authored-By` (última linha do AGENTS.md), só com `Claude-Session`.

### Verificado × NÃO verificado
- `./tests/run.sh`: 23 arquivos, 345 pass, 0 fail. `tsc` pela receita do AGENTS contra expo-fakeit, expo-resultado,
  expo-urna-v2, expo-titulo-eleitor e @expo/ui 57.0.0/58.0.23: só os 4 TS2591 de sempre do preview.ts; strict sem ele, 0.
  SDK 58 (node_modules do worktree expo-utils-sdk58: RN 0.88.0, @expo/ui 58.0.23): nenhum erro nos arquivos do alerta.
- NÃO verificado no aparelho: nada rodou (sem Metro, simulador ou build). Testar primeiro no iOS: alerta com Modal, rota
  modal/fullScreenModal, intersticial/app open/UMP, alertas seguidos e alerta dentro do onPress de outro. No Android: 3
  botões na ordem do RN.

### Pendências
- Juntar na main (d551d68): `git merge-tree` dá 2 conflitos de texto — AGENTS.md (lista de testes: manter o parágrafo da
  main e incluir `native-alert.test.ts`) e playbook (bloco de versões do @expo/ui: manter a nota do SDK 58 da main e
  acrescentar a frase do Alert). Depois apagar o ramo e o worktree.
- Decisões (1) e (2) acima. O expo-eleicao só ganha o alerta novo com `<NativeAlertSlot />` no `_layout`.

## 2026-10-27 — 1.5.1 completa na main: SDK 58, Hot Updater v0/v1, anúncios e alerta com Expo UI (junção dos ramos)

### Pedido
O Bruno quer a 1.5.1 com tudo na main ("sem ser outro branch") e, depois de ver o código, commit + tag `v1.5.1` no GitHub, com os apps apontando para `github:Pixel-Logic-Apps/expo-utils#v1.5.1`.

### O que foi feito
- Commit 5585c58: registros das sessões de 21 e 22/10 que estavam sem commit. A trava `<1` do hot-updater de 21/10 (sem commit em package.json, bin/install.js, AGENTS.md e playbook) foi descartada porque o ramo do SDK 58 a substitui pela faixa dupla v0/v1; cópia do diff e do docs/PLANO-STARTUP-ZERO.md (que continua sem commit, intocado) em /private/tmp/claude-501/-Users-plapps-Documents-projetos-eleicoes-ota/7882086e-2861-47bc-a4e2-85a5078ea236/scratchpad/expo-utils-main-backup/.
- Três ramos rebaseados e levados à main por fast-forward (histórico linear, sem `Co-Authored-By`, conferido):
  - `feat/sdk58` (0f41104…f101687): `$RNFirebaseDisableSPM` só com RNFB 24–26; Hot Updater v0 e v1 no `initHotUpdater` (URL+apiKey ou instância; `getHotUpdater`, `hotUpdaterGeneration`, `getRunningBundleId`); devDependencies do SDK 58 e tsconfig `bundler`; instalador do SDK 58 (`--fix-ios-build` pela major do RNFB, Kotlin 2.4.20, `--hot-updater-v1`, `expo-navigation-bar` no lugar do edge-to-edge, babel.config.js sem sobrescrever); catálogo de mediação do RNGMA 17.4 com compat do Pangle para o 16.x; docs.
  - `feat/anuncios-preload` (d551d68): app open pelo ProcessLifecycleOwner (módulo `ReactNativeAppLifecycle`, sem importar o pacote) e pré-carga de app open e intersticial atrás de 6 chaves do RC com padrão igual ao de antes. Conflitos resolvidos: package.json (fica o peer `react-native-applifecycle`, sai o edge-to-edge) e CHATHISTORY.
  - `feat/alert-expo-ui` (06ce75a, 6d232cf): Alert.alert desenhado pelo Expo UI (SwiftUI no iOS, AlertDialog do Material 3 no Android), montado no AskForReviewOverlay. Conflitos de texto no AGENTS.md e no playbook resolvidos com o texto da main + a parte do alerta.
- Validação na main (worktree do alerta, SDK 58): `tsc --noEmit` exit 0; `tests/run.sh` 431 pass, 0 fail.

### Pendências (decisão do Bruno)
- iOS: o Alert do SwiftUI é apresentado pelo controlador da raiz; com Modal do RN, rota modal, intersticial ou formulário UMP por cima, o UIKit pode recusar e a fila trava até fechar o app. Testar no aparelho antes de publicar, ou usar o Alert do RN no iOS (mesmo visual do iOS 26, com a fila nova).
- Regra de imports × proteção do @expo/ui: o alerta carrega o @expo/ui com `require` protegido, mas o glass-button já importa no topo desde a 1.5.1 (binário sem o ExpoUI cai no boot). Seguir a regra (import no topo) ou proteger os dois.
- Cor do alerta no Android: hoje segue o papel de parede (Material You); a proposta é a cor de cada app (`seedColor` no Host, vinda do app).
- Tag `v1.5.1` e push só depois do OK do Bruno.

## 2026-10-27 — 1.5.2: regras do R8 no plugin (o Release Android do SDK 58 fechava ao abrir)

### Pedido
No Eleições 1.6.0 (SDK 58) o APK Release fechava ao abrir. O Bruno pediu para resolver o R8 de verdade ("tem que funcionar"), sem desligá-lo, e para atualizar a expo-utils junto, não só o app.

### Causa
- O SDK 58 liga o R8 no Release, e o AGP 9 (9.2.1 no RN 0.88) liga o `android.r8.strictFullModeForKeepRules`: `-keep class A` não mantém mais o construtor vazio.
- O play-services-ads traz o WorkManager (2.7+; 2.9.1 no Eleições) com o Room 2.5.0, cujas regras ainda não têm `{ void <init>(); }`. O R8 tirou o `WorkDatabase_Impl.<init>()` (crash no InitializationProvider: "Failed to create an instance of class androidx.work.impl.WorkDatabase.canonicalName") e os construtores dos dois InputMerger (todo job do WorkManager falharia).
- O Glance (widgets do voltra) cria os ActionCallback por reflexão (`RunCallbackAction`), e a regra dele também não tem o construtor (androidx main, mar/2026).
- O androidx corrigiu Room e WorkManager em jun/2024 (commits e4765e38e e 973b8b339).

### Como foi achado
Dois builds Release com R8 no Eleições, com `-Pandroid.r8.strictFullModeForKeepRules=false` e sem ele (nada editado em `android/`), e a diferença do `usage.txt` (o que o R8 removeu só no modo estrito). Só esses construtores eram usados por reflexão; o resto eram construtores que ninguém chama (marcadores do Facebook SDK, utilitários estáticos do Fresco/SoLoader/Hermes, construtores sem uso do OkHttp e do expo-modules-core).

### O que foi feito
- `app.plugin.js`: opção `androidR8KeepRules` (ligada por padrão). No prebuild acrescenta ao `android/app/proguard-rules.pro` o bloco `expo-utils-r8-keep-rules` com as 3 regras; idempotente (hash no cabeçalho).
- `tests/plugin-r8-keep-rules.test.ts`: 5 testes com o `generateCode` real.
- Docs: AGENTS.md (seção "Android R8 keep rules" e a "combinação testada" corrigida: com a 1.5.1 o Release Android compilava e fechava ao abrir), README (opção), playbook do upgrade (seção 0.1 aponta a 1.5.2, linha "R8" na tabela, armadilha 43) e comentário do instalador. Versão 1.5.2.

### Validação
- `tests/run.sh`: 436 pass, 0 fail.
- Eleições (SDK 58, AGP 9.2.1) com o plugin novo no prebuild: o APK Release com R8 abre no emulador; o WorkManager inicia; Início, Resultados, Notícias e Candidatos funcionam; o widget do voltra entra na tela inicial (SessionWorker do Glance rodando no WorkManager); o DiagnosticsWorker terminou em SUCCESS; nenhum "Trouble instantiating" no logcat.

### Versão
A tag `v1.5.1` não foi movida (o commit 2b5692e do Eleições a usa); a correção sai na `v1.5.2`.

## 2026-10-27 — 1.5.3: o build confere o SDK de cada rede da mediação

### Pedido
O Bruno lembrou o problema de antes: o adapter entrava sem o SDK da rede e a mediação/waterfall não funcionava (a Unity com 0% de match em 06/10/2026). "O Expo Utils, toda vez que ele instalar nos projetos, ele já tem que funcionar também, já tem que colocar SDK junto lá."

### O que foi feito
- Catálogo (`data/mediation_adapters.json`): `android.sdk` (group:module) e `ios.sdkPod` em todas as 9 redes; Pangle aceita `Ads-Global` (8.3) e `Ads-Global-Beta` (8.2 do compat, apps no RNGMA 16.x).
- Plugin: com a mediação ligada (`mediationSdkCheck`, padrão ligado) o build confere o SDK de cada rede. Android: task `expoUtilsConferirSdksDaMediacao<Variante>` antes do `pre<Variante>Build` (só release), lendo o grafo resolvido do RuntimeClasspath. iOS: trecho no começo do `post_install` do Podfile, olhando `installer.pod_targets`. Faltou SDK = erro "[expo-utils] Mediação sem o SDK da rede: …". Os blocos saem quando a mediação/conferência é desligada.
- `scripts/check-mediation-poms.js` agora falha se `android.sdk`/`ios.sdkPod` não baterem com o POM/extraArtifacts e com o podspec de cada linha do RNGMA (testado com valores errados).
- Testes: `plugin-mediation-sdk-check.test.ts` (6, o trecho do Podfile roda num Ruby de verdade) e 2 novos em `mediation-catalog.test.ts` (tabela `POD_SDK`). `tests/run.sh`: 444 pass.
- Docs: AGENTS.md (item 4 da mediação), README (opção `mediationSdkCheck`), playbook (armadilha 44).

### Validação no Eleições 1.6.0 (6 redes: AppLovin, Pangle, Liftoff, Mintegral, Unity, Meta)
- Android: a task roda antes do `preReleaseBuild` e passa; com `android.sdk` errado o build para com a mensagem.
- iOS: o `pod install` passa; com `ios.sdkPod` errado ele para com a mensagem (o `npx expo prebuild` local só avisa e sai com 0; no EAS para).
- Binários: as 6 SDKs e os 6 adapters dentro do APK Release com R8 (mapping.txt) e do app do iOS (frameworks AppLovinSDK/FBAudienceNetwork e classes PAGSdk, MTGSDK, UADSMetaData e VungleAdsSDK no executável). O modo estrito do R8 não remove nada dos SDKs nem dos adapters (diferença do usage.txt contra o modo antigo).


## 2026-10-28 — 1.5.4: trava de anúncios por versão da loja ligada por padrão

### Pedido
No Eleições 1.6.0 os anúncios apareciam num build mais novo que a loja: a trava da lib era opt-in e o app.json não tinha a opção. O Bruno: "Então coloca isso e default eu pedi isso".

### O que foi feito
- `getExpoUtilsDisableAdsIfBuildIsNewerThanStore` agora devolve `true` por padrão: sem `appConfig`, sem plugins ou sem a opção. Só `"disableAdsIfBuildIsNewerThanStore": false` desliga. Até a 1.5.3 era opt-in (`true`), desde 02/07 (2690ebf).
- O gate (`runStoreGate`) não mudou: fail-closed, iTunes lookup e página da Play com timeout de 5 s, `ios_store_version`/`android_store_version` do Remote Config como válvula, aguardado dentro do `prepare()`.
- Docs: comentários do `Utils.ts`, README ("Ligada por padrão (desde a 1.5.4)"), AGENTS.md e o guia de upgrade.
- Testes: `tests/run.sh` com 444 pass, com as dependências do Eleições ligadas no worktree. Sem `node_modules`, os dois testes de plugin falham por falta do `@expo/config-plugins`, igual na main.
- Consultas da loja conferidas em 28/10: o iTunes lookup do `br.eleicoes2024.eleicao` dá 1.5.0, com e sem `country`; a página da Play do `br.eleicoes2026.resultado` dá 1.3.0, com o UA do okhttp e com o do Chrome.

### Efeito nos apps
- Todo app que subir para a 1.5.4 espera a consulta da loja no boot (até 5 s) e fica sem anúncio enquanto a versão instalada for maior que a da loja, inclusive na revisão da Apple e do Google.
- Depois de publicar, libera sozinho quando a consulta mostrar a versão nova. O lookup da Apple pode levar algumas horas para mudar; a válvula do Remote Config resolve na hora.
- App que não pode ter a trava põe `false` no app.json.

### Versão
1.5.4 (tag `v1.5.4`).
