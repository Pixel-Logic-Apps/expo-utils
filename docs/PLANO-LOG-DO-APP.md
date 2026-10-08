# Plano do log do app como padrão do expo-utils

Data: 06/10/2026. Status: **proposta**, sem ok para codar. Nada foi implementado nem testado no aparelho. O que foi conferido e o que não foi está na [seção 12](#12-o-que-foi-verificado-e-o-que-não-foi).

## Em português simples

- **Coletor:** código que copia para uma lista tudo o que o app escreve no `console`, os erros, as chamadas de rede e os eventos do Analytics.
- **Anel:** essa lista guarda as últimas 4.000 linhas. Quando enche, as mais velhas saem.
- **Painel:** a tela que mostra a lista, com filtros e um botão de compartilhar, protegida por senha.
- **OTA:** atualização só do JS pelo Hot Updater, sem passar pela loja.
- **Camada nativa:** código Swift/Kotlin dentro da própria lib. Só chega ao app com build nova na loja.
- **Sem linha no app:** o app só troca a versão do expo-utils no `package.json`. Nenhum arquivo de código do app muda.

## 1. O que foi pedido

- Levar para o expo-utils o log que existe hoje nos apps eleitorais, **ligado por padrão** em todo app que usa a lib.
- **Nenhuma linha nova** no código do app.
- Pegar também os logs do AdMob.
- Guardar a senha do painel como MD5.

Para valer num app, basta ele estar na versão da lib que trouxer isso. Hoje nenhum app local está na 1.4.0:

| App | expo-utils instalado |
| --- | --- |
| expo-divulgacand | 1.0.9 |
| expo-urna | 1.0.20 |
| expo-eleicoes-v2 | 1.1.14 |
| expo-titulo-eleitor | 1.2.5 |
| expo-eleicao, expo-urna-v2, expo-resultado | 1.3.0 |

## 2. O que existe hoje nos apps eleitorais

Arquivos do `expo-divulgacand`. O `expo-eleicao` tem a versão anterior, sem a parte de OTA.

- `src/services/app-logger.ts`: o coletor. Instala-se no import.
- `src/components/log-viewer-modal.tsx`: o painel.
- `src/components/version-label.tsx`: rótulo de versão da Home, com a mensagem do pacote OTA.
- `src/services/ota-info.ts` e `src/services/ota-mensagens.ts`: qual pacote OTA está rodando, a mensagem do `-m` do deploy e se o servidor oferece um mais novo.

O coletor pega:

- `console.log/info/warn/error/debug`;
- erro JS (pelo `ErrorUtils`) e promise sem catch (rastreador do Hermes; no divulgacand, só fora do dev);
- `fetch`: método, URL, status e tempo;
- `logEvent` do Analytics, por um tap na instância. Pega também os eventos do expo-utils;
- mudanças de AppState;
- rotas, por uma linha no layout do app.

Ele mascara chave do Google, chave do RevenueCat, token FCM, `Bearer` e `key=`/`token=` em URL. Cada linha guarda no máximo 1.500 caracteres.

O painel pede a senha a cada abertura e tem os filtros Tudo, Erros e avisos, Eventos, Rede e App e rotas. Compartilha só os últimos 200 mil caracteres, porque o compartilhamento do Android passa pelo Binder, que aguenta ~1 MB.

Hoje cada app precisa destas linhas:

| | expo-eleicao | expo-divulgacand |
| --- | --- | --- |
| Instalar o coletor | 1º import do `_layout.tsx` | import no `Strings.ts`, que o `_layout` importa |
| Tap do Analytics depois do boot | `attachAnalyticsTap()` no `_layout` | só a tentativa do import |
| Rotas | `appLog("rota")` no `_layout` | `appLog("rota")` no `(tabs)/_layout` |
| Montar o painel | `<LogViewerModal />` no `_layout` | `<LogViewerModal />` no `(tabs)/_layout` |
| Abrir | 2 toques no texto da versão na Home | 3 toques no `VersionLabel` da Home |

O que ele não pega: log nativo (logcat, linhas `<Google>` do iOS) e eventos automáticos do Firebase. E tudo fica só na memória, então some quando o app fecha ou morre.

## 3. Onde a lib já entra em todo app

| Ponto de entrada | Por que roda sem linha nova | Serve para |
| --- | --- | --- |
| Import do expo-utils no `_layout.tsx` | todo app importa a lib antes do boot (no divulgacand é a linha 2) | instalar o coletor |
| `Utils.prepare()` | todo app chama no boot | religar o tap do Analytics e registrar as fases do boot |
| Componentes da lib já na tela: banner, `CrossPromoCard`, `PromotionalContent`, `AskForReviewOverlay`, `ExpoUtilsLayout` | todo app mostra pelo menos um | montar o painel |
| Config plugin `["expo-utils", {...}]` no `app.json` | já está em todo app | chave para desligar; camada nativa |

## 4. Captura (só JS, vai por OTA)

- O `app-logger.ts` vira `utils/app-logger.ts` e entra como **primeiro import** do `utils/Utils.ts` e do `index.ts`. É um import de efeito no topo, como pede a regra de imports do AGENTS.md. Fica módulo-folha: não importa nada da lib.
- Pega o mesmo da seção 2, com o mesmo mascaramento.
- Ganhos de estar dentro da lib:
  - `expoUtilsLog` e `expoUtilsWarn` escrevem direto no anel. A linha entra mesmo com `disableLogs`/`disableWarnings`, que hoje impedem o texto de chegar ao `console`.
  - O `prepare()` chama `attachAnalyticsTap()` de novo depois que o Firebase sobe. Hoje o expo-eleicao faz isso à mão.
  - Cada fase do boot (Remote Config, RevenueCat, UMP, ATT, atribuição) entra com o tempo que levou.
  - A mensagem do pacote OTA vem junto: o tap do `fetch` reconhece o `/api/check-update/` do Hot Updater, e a lib sabe a URL pelo `initHotUpdater(url)`.
- Nada pode lançar exceção: todo tap fica em try/catch, como no original.

## 5. Rotas

- Hoje a rota vem de um `usePathname` com `appLog("rota")` no layout do app.
- Sem linha no app: a lib escuta o evento `state` do `store.navigationRef` do expo-router. Ele existe na 57.0.22, e o próprio expo-router usa. Como é interno, fica em try/catch, desliga em silêncio se sumir e precisa de teste a cada versão do expo-router.
- De brinde, isso alimenta o `AdPlacementTracker.setCurrentRoute`. Hoje ele só recebe rota pelo `<RouteTracker />`, e nenhum app local monta esse componente.

## 6. Painel

- O `log-viewer-modal.tsx` vira `utils/log-viewer.tsx`.
- É montado pelos componentes da lib que o app já mostra, e só existe um: o primeiro componente que montar fica com o painel; se ele desmontar, o próximo assume. Preferir os de raiz (`ExpoUtilsLayout`, `PromotionalContent`, `AskForReviewOverlay`) aos de tela (banner, `CrossPromoCard`).
- Como é um `Modal`, abre em janela própria, e a posição na árvore não importa.
- Se nenhum estiver montado: `Alert` com um resumo e `Share` com o texto. Os dois são nativos e não precisam de árvore.
- O topo do painel pode mostrar o que a lib já sabe: versão, pacote OTA e mensagem, App User ID do RevenueCat, premium, `is_ads_enabled`/`isAdsEnabled` e `rc_status`.

## 7. Como abrir

É a única parte que não fecha só com JS. O toque no rótulo de versão acontece numa tela do app. A lib só enxerga toque na tela inteira quando ela envolve as telas, e isso só acontece no `ExpoUtilsLayout`, que só o expo-resultado e o lab usam. No template padrão, os componentes da lib ficam ao lado do `<Stack>`, não em volta dele.

| Caminho | Vale em | Chega por | Observação |
| --- | --- | --- | --- |
| Gesto em JS num `View` em volta das telas, dentro do `ExpoUtilsLayout` (`onTouchStart`, que não rouba toque) | só apps com `ExpoUtilsLayout` | OTA | hoje o `ExpoUtilsLayout` devolve um fragment; precisa do `View` |
| Push com `data` (ex. `expo_utils: "log"`) | todos | OTA | a lib já trata a abertura de push (`onNotificationOpenedApp` e `getInitialNotification`) |
| Deep link | não serve como regra | — | o expo-divulgacand nem tem `expo.scheme` |
| Gesto de 3 dedos nativo | todos | build de loja | a lib vira módulo Expo, que o autolinking pega pelo `expo-module.config.json`; a mesma camada traz os logs nativos (seção 9) |
| Rótulo de versão dos apps eleitorais | expo-eleicao, expo-divulgacand | OTA | passa a chamar o `openLogViewer` da lib |

Nos dois apps eleitorais, o `app-logger` local tem que ser apagado. Senão cada linha é capturada duas vezes.

## 8. Senha em MD5

- Pode, e fica melhor que só o Remote Config, porque funciona em todo app sem configurar nada.
- O código guarda só o hash, e o painel compara com o MD5 do que foi digitado. A lib já tem o `utils/md5.ts` (TS puro, acento tratado em UTF-8), então não entra dependência.
- **A senha em texto nunca entra no repo, nem neste documento**, porque o repo é público.
- O MD5 só esconde a senha de quem lê o código. Quem quiser descobrir faz força bruta, e MD5 é muito rápido: uma placa de vídeo atual testa ~160 bilhões por segundo.
  - A senha atual dos apps eleitorais (8 caracteres, minúsculas e números) sai em ~18 s. Por ser palavra + número, um dicionário acha antes. **Não reaproveitar.**
  - O que segura é o tamanho, não o algoritmo. Com 14 caracteres aleatórios de minúsculas e números (fácil de digitar no celular), a mesma placa leva ~1.200 anos.
- Prefixo fixo antes do hash: `md5("expo-utils:" + senha)`. Assim o hash não bate com as tabelas públicas de MD5.
- O Remote Config pode sobrescrever o hash (ex. `log_viewer_password_md5`), para trocar a senha sem soltar versão.

## 9. AdMob

### Nível 1: o que passa pelo JS (OTA, sem linha no app)

Todo anúncio já passa pelo código da lib: banner, intersticial, premiado e app-open. Cada carga, falha (com o motivo, ex. `no-fill`, `network-error`), abertura, fechamento, clique e receita vira uma linha com formato e placement. Entram também o status de cada rede de mediação no `mobileAds().initialize()`, que a lib já registra, e o resultado do UMP.

Isso fecha dois buracos de hoje:

- `banner-ad.tsx` e `safe-banner-ad.tsx` só têm `onPaid`, então banner que falha não deixa rastro.
- `appopen-ads.tsx` escuta `AdEventType.ERROR` sem ler o erro.

O intersticial e o premiado já mandam `AdERROR` para o Analytics, e o tap pega.

### Nível 2: qual rede serviu (`react-native-google-mobile-ads` 17)

A partir da 17, o pacote entrega o `ResponseInfo`:

- na falha (`responseInfo` no erro) e no banner carregado (`onAdLoaded`): a rede vencedora e a cascata inteira, cada adaptador com `adSourceName`, `latencyMillis`, `outcome` e `adError`;
- na receita (`onPaid`): só a rede vencedora.

Versões instaladas:

| App | react-native-google-mobile-ads |
| --- | --- |
| expo-divulgacand | 15.8.1 |
| expo-urna | 16.0.3 |
| expo-eleicoes-v2 | 16.3.4 |
| expo-titulo-eleitor | 16.4.0 |
| expo-eleicao, expo-urna-v2, expo-resultado | 16.5.0 |
| expo-utils-lab | 17.0.0 |

Só o lab já está na 17. Subir para ela obriga a revalidar o catálogo de mediação, que foi fixado contra a 16.4 (regra do CLAUDE.md). De quebra, o `ad_revenue` passaria a levar a rede. O CLAUDE.md diz que o payload não traz a rede, e isso só vale até a 16.

### Nível 3: log nativo do SDK

Tag `Ads` no logcat e linhas `<Google>` no iOS. Só com a camada nativa da seção 7. No Android é o logcat do próprio app (`logcat -d --pid`, sem permissão). No iOS falta conferir se o SDK do Google escreve no log unificado que o `OSLogStore(scope: .currentProcessIdentifier)` lê.

### Ad Inspector

Um botão no painel chama `mobileAds().openAdInspector()`, que existe na 15.8.1, na 16.5.0 e na 17.0.0. É a tela do próprio Google, com cada requisição, a cascata por rede e os erros. Só abre em aparelho cadastrado como dispositivo de teste no console da AdMob. Como o cadastro é feito no console, continua sem linha no app.

## 10. Padrão, desligar e gravar em disco

- Ligado por padrão. `["expo-utils", {"appLog": false}]` desliga, lido em runtime como o `disableLogs`.
- Extra que vale a pena: gravar o anel em disco. Na 57.0.7 do `expo-file-system`, o `File.write` é síncrono e aceita `append`, então dá para gravar até dentro do handler de erro fatal. O painel passa a mostrar a sessão anterior depois de um crash ou de um splash travado.
- O coletor do [`PLANO-COLETOR-DE-DADOS.md`](PLANO-COLETOR-DE-DADOS.md) leria dessa mesma fila.

## 11. Ordem sugerida e decisões em aberto

Ordem:

1. Captura (seção 4). Já vai por OTA.
2. Painel e senha (seções 6 e 8).
3. Rotas (seção 5).
4. Abrir por push (seção 7), AdMob nível 1 e botão do Ad Inspector (seção 9).
5. Camada nativa (gesto de 3 dedos e logs nativos), quando for subir build.
6. `react-native-google-mobile-ads` 17, junto com a revalidação do catálogo de mediação.

Em aberto:

- Como abrir nos apps sem `ExpoUtilsLayout`: push, camada nativa ou os dois.
- A senha nova (só o hash entra no código) e se terá override no Remote Config.
- Gravar em disco ou ficar só na memória.
- Quando subir o `react-native-google-mobile-ads` para a 17.
- Ok para começar.

## 12. O que foi verificado e o que não foi

Conferido no código em 06/10/2026:

- O coletor, o painel e o rótulo de versão do expo-divulgacand (commit `db62650`) e a versão do expo-eleicao.
- Os `_layout.tsx` dos apps locais: só o expo-resultado e o lab usam `ExpoUtilsLayout`, e nenhum app monta `<RouteTracker />`. O layout raiz do expo-divulgacand não tem nenhum overlay da lib; ele usa banner e `CrossPromoCard` nas telas.
- O repo `Pixel-Logic-Apps/expo-utils` é público (`gh repo view`).
- O expo-divulgacand não tem `expo.scheme` no `app.json`.
- A lib não tem código nativo (nem `expo-module.config.json`).
- `store.navigationRef` existe no expo-router 57.0.22, usado pelo próprio `router.js` e pelo `getNavigationAction.js`.
- `utils/md5.ts` converte para UTF-8 antes do hash.
- Os tipos do `ResponseInfo` e do `openAdInspector` nas versões citadas na seção 9.
- `File.write` síncrono, com `append`, no `expo-file-system` 57.0.7.

Não verificado:

- Nada rodou em aparelho.
- O listener `state` no `store.navigationRef`.
- Se o `onTouchStart` num `View` em volta das telas recebe os toques das telas nativas.
- A exigência de aparelho de teste para o Ad Inspector. Vem da documentação do Google; não testei.
- Se o SDK do Google no iOS escreve no log unificado.
- Os tempos de força bruta são estimativa, com ~160 bilhões de MD5 por segundo numa placa de vídeo atual.

## 13. Ao implementar

- Regras do AGENTS.md na mesma tarefa: README, playbook `docs/UPGRADE-EXPO57-EXPO-UTILS.md`, `index.ts`/`index.d.ts` (`openLogViewer` e `appLog` ficam públicos), `docs/ANALYTICS-EVENTS.md` se mexer em evento, e o CLAUDE.md (opção `appLog` do plugin).
- Testes em `tests/` (bun): mascaramento, anel, formatação e o dono único do painel.
- Aceite no `expo-utils-lab` com build real, Android e iOS: linhas de boot, rota, anúncio e push aparecendo no painel.
- Nos dois apps eleitorais: apagar o `app-logger` local e apontar o rótulo de versão para o `openLogViewer` da lib.
