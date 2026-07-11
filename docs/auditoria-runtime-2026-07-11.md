# Auditoria de runtime — 2026-07-11

Origem: crash em produção no listener de app-open (`Purchases.getCustomerInfo()` chamado antes do
`Purchases.configure()` → "There is no singleton instance"), corrigido em `5942dc4`. Esta auditoria
varreu a lib inteira atrás da mesma classe de problema (SDK usado antes de estar pronto / sem guard)
e de outros riscos de runtime. **Todos os 21 itens foram aplicados**, mais 4 decisões novas (abaixo).

## Decisões novas (pedidas na revisão)

1. **`isRevenueCatActive()`** (`utils/Utils.ts`, exportada no index): `isConfigured()` sozinho "não
   serve" — retorna true até com key inválida (401 silencioso) e não garante que `getCustomerInfo`
   funcione. A função exige **configure feito + uma chamada real bem-sucedida** (`getCustomerInfo`,
   barata após o 1º sucesso pelo cache do SDK). Memoiza sucesso; falha limpa o memo (retry na
   próxima chamada). Substituiu os guards de `isConfigured()` espalhados.
2. **Premium unificado**: `PremiumUtils.getIsPremiumStatus()` é a fonte única. `__DEV__` → toggle
   local `@isPremium`; **produção → SEMPRE RevenueCat** (storage não é mais lido em produção; RC
   indisponível = não-premium). Divergências eliminadas: app-open ("qualquer entitlement ativo"),
   PremiumUtils ("ativo E willRenew E sem unsubscribe"), Paywall ("ativo ou entitlementIds"),
   banners/interstitial ("@isPremium storage") — agora todos delegam pra mesma função (a regra
   willRenew + override `is_opted_out_trial_enabled`). `@isPremium` continua sendo **escrito** nas
   compras; só a leitura em produção mudou.
3. **`expoUtilsWarn` com telemetria**: cada warn vira 1 evento `expo_utils_warn` no Firebase
   Analytics (param `message` truncado em 100 chars; dedup por mensagem única/sessão, cap 50;
   roda mesmo com `disableWarnings`). Best-effort, nunca lança nem recursa.
4. **Push em foreground / Promo × ATT** (mínimo de alteração):
   - `queueAlert(title, message)` serializa alerts (iOS descarta `UIAlertController` sobreposto);
     o handler de push em foreground usa a fila — 2 pushes seguidos mostram os 2 alerts.
   - `usePromotional.show()` espera `waitAttFlowDone()` (resolvida pelo `requestTrackingWhenActive`
     logo após o prompt do ATT; fallback de 15s; só arma quando `prepare()` roda) antes de agendar
     o modal — a Modal do RN não disputa a janela do prompt do sistema.

## Itens da auditoria (todos aplicados)

| # | Sev. | Onde | Problema | Correção aplicada |
|---|------|------|----------|-------------------|
| 1 | 🔴 | `appopen-ads.tsx` | `getCustomerInfo()` rejeita mesmo configurado (1º launch offline etc.); sem try/catch o listener morria em unhandled rejection antes de atualizar `appState.current` → tracking bg→active corrompido, app-open sumia. | Listener inteiro em try/catch com `finally { appState.current = nextAppState }`; premium consultado só no branch bg→active; `canShowAppOpenAgain = false` ANTES dos awaits (fecha janela de double-show); premium via fonte única. |
| 2 | 🔴 | `PaywallUtils.load()` | Mesma classe do bug original: `ensureRevenueCat` desistia sem key e `load()` chamava `getOfferings()` → crash "no singleton instance". | `ensureRevenueCat` retorna boolean; `load()` devolve resultado vazio (`items: []`) quando RC não configurado; `purchaseItem`/`restore` retornam `{ok:false, error}` limpo. |
| 3 | 🔴 | `PaywallUtils` (usePaywall) | `void reload()` no effect + `reload()` re-lança → unhandled rejection em toda falha de load. | `reload().catch(() => {})` (o estado `error` já captura). |
| 4 | 🔴 | `LoadAdsManager.ts` | `new Promise(async ...)` engolia exceções (`createForAdRequest(undefined)`, `logEvent` aguardado antes do `show()`) → `await showInterstitial()` pendurava PRA SEMPRE. | Reescrito: métodos `async` com try/catch (nunca lançam/penduram), guard de unitId ausente (resolve true = segue sem ad), `logEvent` fire-and-forget com catch fora do caminho crítico. |
| 5 | 🟡 | `PremiumUtils.getIsPremiumStatus` | Sem guard de RC pronto; catch devolvia false pra premium real com RC fora do ar. | Guard `isRevenueCatActive()`; produção 100% RevenueCat (decisão nova nº 2 — substituiu o fallback de storage proposto na auditoria); `console.error` → `expoUtilsWarn`. |
| 6 | 🟡 | `Utils.getIOSAppId` | `fetch` sem timeout e sem storefront (`country=`): app publicado só fora dos EUA → lookup vazio → botão de review morto; lookup pendurado travava o botão. | Padrão do `getStoreVersion`: storefront do usuário (`regionCode`) → global, com `fetchWithTimeout` (5s). |
| 7 | 🟡 | `Utils.checkForRequiredUpdateDialog` | `parseFloat` pra comparar versões ("1.10"→1.1 < "1.9"→1.9; "1.2.3"→1.2). | `compareVersions` (helper já existente). Bônus: `openStore` aguardado + try/catch no onPress (openURL rejeitando não some mais com o alert obrigatório). |
| 8 | 🟡 | `banner-ad` / `safe-banner-ad` | Cada mount refazia `setDefaults`+`fetchAndActivate` (rede por tela, risco de throttle). | `Utils.getRemoteConfigUtils()` agora é memoizado (1 fetch/sessão, compartilhado com o prepare). |
| 9 | 🟡 | `banner-ad` / `safe-banner-ad` | `<BannerAd unitId={undefined}>` lança no render (validação do react-native-google-mobile-ads) → crash sem error boundary. | `if (!bannerUnitId) return null` (safe-banner só em produção — DEV usa TestIds). |
| 10 | 🟡 | `Utils.initTikTokSDK` | `getAppUserID()` sem guard: configure falho abortava o init inteiro → eventos launch/install do TikTok perdidos. | `if (rckey && await isRevenueCatActive())` + try/catch isolado no identify. |
| 11 | 🟡 | `modal-promotional-content` (processText) | Promo remota sem `name`/`description` + `t` fornecido → `undefined.replace` → crash do render. | Guard `if (!text) return ""`. |
| 12 | 🟡 | `modal-promotional-content` (5 handlers) | `Linking.openURL` sem catch em onPress async: URL inválida → unhandled rejection e modal preso aberto. | try/catch em todos (baixar/press), `handleClose()` sempre roda; `AsyncStorage.setItem` dos "não mostrar" também guardado. |
| 13 | 🟢 | `ExpoUtilsLayout` + `templates/RootLayout` | IIFE de boot sem try/catch: qualquer throw (ex.: appStrings inválido em app JS) → splash infinito silencioso. | try/catch com `setAppIsReady(true)` no catch + warn; `appStrings?.hotUpdaterUrl` no layout. |
| 14 | 🟢 | `prepare` / `setupAppOpenListener` / listener RC | StrictMode/remount duplicava boot e listeners (configure 2x, customerInfoUpdate 2x, app-open 2x). | `prepare` memoizado (`preparePromise`, roda 1x; chamadas seguintes só aguardam e re-liberam a UI); `setupAppOpenListener` com flag de registro único; janela async fechada antes dos awaits (item 1). |
| 15 | 🟢 | `setupGlobalConfigs` | `global.remoteConfigs` nunca era populado (docs/PaywallUtils/store gate esperam o nome). | Alias `global.remoteConfigs = remoteConfigs` + declaração em `types.ts`. |
| 16 | 🟢 | `getRemoteConfigUtils` | Teto de 60s podia segurar o splash 1 minuto com RC nativo pendurado. | Reduzido pra 10s (e `getApp()` protegido em try/catch — antes lançava síncrono sem Firebase). |
| 17 | 🟢 | vários | `console.error/log` diretos ignoravam `disableWarnings`/`disableLogs`; sucesso de subscribe logado como warn. | Tudo padronizado em `expoUtilsWarn`/`expoUtilsLog` (Utils, PremiumUtils). |
| 18 | 🟢 | vários | Fire-and-forget sem catch (`logEvent` nos `.then` de subscribe e no update de tópicos; `.then` sem `.catch` no banner promo) → unhandled rejections esparsas. | `.catch(() => {})` em todos. |
| 19 | 🟢 | `usePromotional.show()` | Timer agendado depois de awaits: unmount no meio → timer órfão disparava `setVisible` pós-unmount. | `mountedRef` (rearmado no effect p/ StrictMode) + guard antes e dentro do timer + try/catch no show. |
| 20 | 🟢 | `ask-for-review` | `getLocales()` sem guard no render do overlay. | try/catch com fallback `en`. |
| 21 | 🟢 | `modal-promotional-content` | Import estático de `expo-video`: app que atualiza a lib sem rodar o CLI quebrava o bundle inteiro. | `require` lazy memoizado com try/catch dentro do `PromoVideo` (sem o módulo, só o vídeo não renderiza). |

## Notas de comportamento (pós-mudanças)

- `LoadAdsManager.showInterstitial/showRewarded`: **nunca penduram nem lançam**. `true` = fluxo do
  app segue (fechou o ad, premium, ads off, placement bloqueado ou sem unitId); `false` = erro de ad.
- Os apps que tinham patch local no estilo `if (await Purchases.isConfigured()) { try { ... } catch
  { alert(JSON.stringify(e)) } }` podem **remover o patch** — a lib cobre (e lembrando:
  `JSON.stringify(Error)` imprime `{}`; use `String(e)`).
- Exports novos no index: `PremiumUtils`, `isRevenueCatActive`, `queueAlert`, `expoUtilsWarn`,
  `expoUtilsLog`.
- Verificação: `npx tsc --noEmit` sem erros novos (os 5 TS2307 de peer deps não instalados no repo
  da lib — expo-router/store-review/linear-gradient/linking — já existiam no HEAD).
