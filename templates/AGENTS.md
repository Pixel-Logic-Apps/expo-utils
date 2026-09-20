# ASSISTENTE AUTÔNOMO DE ALTO PADRÃO

## REGRA 0 — Simulador iOS (sempre o mesmo)

**Sempre** usar o mesmo simulador em todos os apps de `/projetos`:

| Campo | Valor |
| ----- | ----- |
| Device | **iPhone 17 Pro Max** |
| Runtime | iOS 26.x |
| UDID | `4043E9CD-8311-4AA2-8D3C-FB3E2AFB2DC4` |

```bash
# preferir se já estiver booted
xcrun simctl list devices booted
# run / Maestro / screenshots
npx expo run:ios --device 4043E9CD-8311-4AA2-8D3C-FB3E2AFB2DC4
# ou por nome
npx expo run:ios --device "iPhone 17 Pro Max"
```

**Regras:**

1. Se já houver um simulador **Booted**, use esse — **não** abra outro (salvo pedido explícito).
2. Default ao bootar: iPhone 17 Pro Max (`4043E9CD-…`).
3. Só trocar de device quando o usuário pedir **iPad** ou **iPhone SE (3ª gen)**.
4. Maestro / screenshots / store: mesmo UDID (não misturar devices no meio da sessão).

────────────────────────

## REGRA 1 — CHATHISTORY: ler e escrever (token-efficient)

Arquivo: **`.claude/CHATHISTORY.md`**. **Append-only, newest first.**

### Quando escrever

Ao **fechar** tarefa com mudança de código/config (ou decisão importante sem code). Não escreva a cada micro-edit.

### Formato (obrigatório)

```markdown
## YYYY-MM-DD — <título ≤8 palavras>  `#tag1 #tag2`

**P:** <1–2 linhas — pedido do usuário>
**C:**
- <bullet denso: o quê + path; sem narrativa>
**V:** <tsc | grep | build | runtime | não validado>
**E:** <commitado? pendências? 1 armadilha se houver>
```

### Limites (economia de tokens)

| Regra            | Valor                                                      |
| ---------------- | ---------------------------------------------------------- |
| Linhas / entrada | ≤15 (incidente grave ≤30)                                  |
| Proibido colar   | logs longos, diffs, JSON RC, secrets, ad unit IDs           |
| Fatos estáveis   | só em AGENTS.md — **não** repetir stack em cada entry       |
| Tags             | `#upgrade #rc #ads #ota #ios #premium #build` p/ grep       |

### Como ler (início de sessão)

1. `git log --oneline -15`
2. **Só** as 1–3 entradas mais recentes do CHATHISTORY (pare no 3º `## `)
3. Tópico antigo: `grep -n "#tag\|termo" .claude/CHATHISTORY.md`
4. **Nunca** carregar o arquivo inteiro no contexto

### Manutenção

Se `.claude/CHATHISTORY.md` > ~50KB: compactar entradas >30 dias em `## YYYY-MM archive` (1 bullet/dia) ou mover para `.claude/docs/chathistory-archive/YYYY.md`.

**Histórico + docs de apoio sempre em `.claude/`** — não deixar `CHATHISTORY.md` nem `docs/` na raiz.

────────────────────────

## REGRA 2 — Onde colocar arquivos que não são do app

**NÃO crie arquivo novo na raiz do projeto.** Tudo que não é código/config do app (flows Maestro, relatórios, briefs, scripts avulsos, evidências, backups, fontes de arte, docs de apoio) vai em `resources/` — ex.: flows em `resources/.maestro/`. O que já está lá mostra o padrão.

`resources/` também é o contexto do projeto: leia `resources/PROJECT.md` e `resources/ORIGINAL_REQUEST.md` quando precisar entender o produto.

────────────────────────

## REGRA 3 — Navegação nativa iOS 26 (expo-router 57)

O app tem que ter **cara de iOS 26 nativo**: tab bar de vidro que encolhe ao rolar, large title que colapsa, nav bar que desfoca o conteúdo por baixo. Isso é `UIScrollEdgeEffect` + Liquid Glass **do sistema** — já vem de graça no `expo-router@57` + `react-native-screens@4.26`. Quase toda a regra abaixo é sobre **não estragar o default**.

**Nunca** simular esse chrome com `BlurView`, `expo-glass-effect` ou View com `backgroundColor`.

> **Nota de versão:** não existe "expo-router v7". O pacote pulou de `6.0.x` (SDK 54) para versionamento alinhado ao SDK — o SDK 57 usa `expo-router@57.x`. O import das native tabs continua `expo-router/unstable-native-tabs`.

### Tabs — sempre `NativeTabs`

**Proibido `<Tabs>` (JS) do expo-router e proibido tab bar custom.** Sempre `NativeTabs` de `expo-router/unstable-native-tabs` + SF Symbols.

```tsx
<NativeTabs minimizeBehavior="onScrollDown" tintColor={DynamicColorIOS({ light, dark })}>
  <NativeTabs.Trigger name="index">
    <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
    <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
  </NativeTabs.Trigger>
</NativeTabs>
```

- **Não configurar aparência de barra.** `backgroundColor`, `blurEffect` e `shadowColor` são **no-op no iOS 26** — o tipo do `react-native-screens` diz literalmente *"This property does not affect the tab bar starting from iOS 26"* / `@supported iOS 18 or lower`. O default já é o Liquid Glass. Só `tintColor`/`iconColor` valem (mexem no glow), e pedem `DynamicColorIOS` porque o vidro inverte a cor conforme o fundo.
- **Nunca `disableTransparentOnScrollEdge`.** Ela faz o oposto do que se quer: impede a barra de ficar transparente no scroll edge. É workaround de iOS ≤18 e é o erro nº 1 que mata o efeito.
- Ícones na forma **composta** — `<NativeTabs.Trigger.Icon>`, `<NativeTabs.Trigger.Label>`. Os exports soltos `Icon`/`Label`/`Badge`/`VectorIcon` foram **removidos** no SDK 55+.
- Android: `<NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="home" />} />`.
- `minimizeBehavior` pode ficar inerte com stack aninhado dentro da aba ([rn-screens#4145](https://github.com/software-mansion/react-native-screens/issues/4145)). Se não engatar, `minimizeBehavior="never"` — intermitente é pior que nenhum. O scroll edge effect é independente e continua funcionando.

### Header e large title

- Cada aba = pasta com **`Stack` próprio**; a config vale sempre do container **mais interno** (stack dentro de tabs → manda o Stack da aba).
- `headerLargeTitleEnabled: true` — **`headerLargeTitle` está deprecated**. Ou o componente `<Stack.Title large>`.
- **Não setar `headerBlurEffect`.** Conflita com `scrollEdgeEffects` — o próprio tipo avisa que os efeitos se sobrepõem. O `scrollEdgeEffects` já vem `automatic` em cada borda e é ele que faz o blur ao rolar.
- Só tocar em `scrollEdgeEffects` para desligar (`hidden`) ou trocar o estilo (`hard` | `soft`) de uma borda específica.

### Toolbar — `Stack.Toolbar`, e **sem background**

Ações de header usam `<Stack.Toolbar>`, **nunca** `headerLeft`/`headerRight` com componente custom.

```tsx
<Stack.Toolbar placement="right">
  <Stack.Toolbar.Button icon="square.and.arrow.up" onPress={share} />
</Stack.Toolbar>
```

- **NUNCA dar background/cor de fundo à toolbar.** O fundo é o vidro do sistema. `backgroundColor` e `tintColor` no `Stack.Toolbar` são **`@platform android`** — no iOS não fazem nada, e no Android só use se o design pedir. Botão com fundo sólido no header = errado.
- Exceções pontuais nos **itens** (iOS 26+, nunca default): `hidesSharedBackground`, `separateBackground`, `variant="prominent" | "done"` (default `plain`).
- `placement="left" | "right"` liga `headerShown` sozinho. `placement="bottom"` (o default) **só funciona em componente de página** — nunca num `_layout`.
- Não aninhar Toolbars. `Badge` só em `left`/`right` (limitação do UIKit). Android: `Label` é descartado e `Spacer` exige `width` explícito.

### Scroll — a regra que quebra tudo de uma vez

O `react-native-screens` acha a content ScrollView andando por **`subviews[0]`, recursivamente**. Se em qualquer nível o scrollável não for o primeiro filho, a busca falha **em silêncio** e você perde de uma vez: scroll edge effect, large title colapsando, search bar e content inset.

- A `ScrollView`/`FlatList` é o **primeiro filho renderizado** da tela. Padding vai em `contentContainerStyle`, **nunca** num `<View>` wrapper.
- Se precisar mesmo de wrapper: `<View collapsable={false}>`. Escape hatch oficial: `ScrollViewMarker` de `react-native-screens/experimental`.
- `contentInsetAdjustmentBehavior="automatic"` explícito — exigido por large title e search bar.
- Se a área rolável não encher a tela, o large title não colapsa. É comportamento da Apple, não bug.

### Build

- `ios.deploymentTarget: "16.4"` no `app.json` (o campo do `expo-build-properties` está deprecated desde o SDK 56), New Architecture, `react-native-screens ^4.26`. Nenhum config plugin é necessário.
- **`UIDesignRequiresCompatibility` fica FORA do app.json** — é exatamente o que desligaria o Liquid Glass (e a Apple remove no iOS 27).
- Envolver a árvore no `ThemeProvider` do expo-router com `DarkTheme`/`DefaultTheme` conforme `useColorScheme()` — fix oficial do flash branco entre telas e dos botões de vidro piscando em dark mode.

────────────────────────

## REGRA 4 — Cross-promo (lugares estratégicos)

**Cross-promo entra em ponto estratégico e visível. Não em toda tela, e nunca escondido.**
**O componente JÁ EXISTE no `expo-utils` (`CrossPromoCard`, desde a 1.1.21). Não crie o seu.**

### O teste de placement (as duas condições, juntas)

1. **Visível sem rolar.** Se o bloco só aparece depois de dar scroll, o placement está errado.
2. **Não polui.** Não empurra para baixo nem disputa espaço com o conteúdo que o usuário abriu o app para ver.

**Referência:** home, logo abaixo do bloco principal, ainda acima da dobra. Outros pontos são decisão sua **desde que passem nos dois testes** — a referência é guia, não gaiola. Um ponto bom vale mais que cinco espalhados.

### Placement PROIBIDO

| Proibido                               | Por quê                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fim de scroll, rodapé, fim de lista    | **Nunca.** Quase ninguém rola até lá. Parece o lugar seguro justamente porque não atrapalha nada — e é exatamente por isso que não rende nada. É o instinto errado padrão; não caia nele. |
| Qualquer coisa abaixo da dobra         | Mesmo motivo: se precisa rolar para ver, não conta.                                                                                                                                    |
| Tela de baixo tráfego como único ponto | "Sobre", "aviso legal" e afins. Se for o único lugar, na prática o app não tem cross-promo.                                                                                             |

### Como usar

`screen` é **string literal INLINE** no JSX — pode repetir a mesma string em telas diferentes. `colors` exige 6 chaves; mapeie os tokens do app **inline**, sem const no topo do arquivo (aceita também um mapa `{light, dark}` completo).

```tsx
import {CrossPromoCard} from "expo-utils";

<CrossPromoCard
  screen="inicio"
  colors={{
    backgroundElement: colors.surfaceContainer,
    backgroundSelected: colors.surfaceContainerHigh,
    accent: colors.accent,
    onAccent: colors.onAccent,
    text: colors.text,
    textSecondary: colors.textSecondary,
  }}
/>
```

O componente lê `global.remoteConfigScreens?.cross_promo` e retorna `null` sozinho se `!enabled || !url || !screens.includes(screen)`. Sem RC configurado não aparece e não quebra nada — mas isso **não** é licença para espalhar bloco por toda tela.

### PROIBIDO

| Proibido                                   | Exemplos de cheiro                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Criar componente próprio de cross-promo    | `components/cross-promo.tsx`, `PromoCard` caseiro                                               |
| Constante / mapa de `screen`               | `const PROMO_SCREEN = "inicio"`, `CROSS_PROMO_SCREENS`, enum — escreva `screen="inicio"` no JSX |
| Hook/service que embrulha o card           | `useCrossPromo()`, `services/promo.ts`, `<PromoSlot />` que resolve screen por dentro           |
| Freio inventado                            | "1x por sessão", `jaViuCrossPromo` no AsyncStorage, cooldown, dismiss persistido, cap diário    |
| Gate próprio duplicando o do componente    | `if (cfg.enabled)` na tela, `useState` de visibilidade — o componente **já** faz isso           |
| Cortar o cross-promo alegando "polui a UI" | Poluição decide **onde**, não **se**. Não achou ponto visível e limpo? Procure outro.           |

### Remote Config (parâmetro `screens`, chave `cross_promo`)

Quem preenche é o **dono**, no Firebase:

```json
{
  "cross_promo": {
    "enabled": true,
    "title": "Conheça também",
    "app_name": "...",
    "subtitle": "...",
    "icon_url": "...",
    "cta": "Ver",
    "url": "...",
    "ios_url": "...",
    "android_url": "...",
    "screens": ["inicio", "guias"]
  }
}
```

`ios_url`/`android_url` resolvem por plataforma, com fallback pro `url`. O array `screens` casa com a prop `screen` de cada call site.

**Default: um ponto estratégico e visível.** Na dúvida de onde → acima da dobra na home. Se a resposta for "no rodapé" → não é lugar.
- Validar em **device físico / simulador iOS 26**: rolar deve minimizar a tab bar numa pílula, colapsar o large title e desfocar o conteúdo sob a nav bar.
## REGRA 5 — Ads: mediation, consentimento e o que NÃO fazer no app

O expo-utils já entrega o AdMob com **mediation ligada** (AppLovin, Meta, Unity e Pangle por
padrão) e cuida do consentimento. O app **não** implementa nada disso. Outras redes do catálogo
(liftoff, mintegral, bidmachine, moloco, bigo) entram só se listadas explicitamente.

**PROIBIDO no app:**

- Editar `ios/Podfile`, `android/app/build.gradle` ou criar `plugins/with-*` para adicionar
  adapter/repositório de rede — o prebuild do expo-utils faz isso e sobrescreve.
- Chamar `mobileAds().initialize()` ou `AdsConsent.*` no boot: `Utils.prepare()` já roda o
  UMP **antes** do ATT e inicializa o SDK quando o consentimento permite.
- Disparar evento próprio de receita por impressão — banner/interstitial/rewarded/app-open já
  mandam `ad_revenue` (e o `ad_impression` com a rede vem do próprio AdMob, via console).

**Permitido/esperado no app:**

- `["expo-utils", { "mediation": false }]` (ou `["applovin", "meta"]`) só quando houver motivo
  real — peso de build, rede não aprovada na conta.
- Botão **"Privacidade dos anúncios"** nos ajustes chamando `Utils.showPrivacyOptionsForm()`
  (obrigatório para usuário da EEA reabrir o formulário do UMP). **Renderize o botão só quando
  `await Utils.isPrivacyOptionsRequired()` for true** — fora da EEA não existe formulário e o
  botão fica "sem fazer nada". O retorno é `{shown, reason}`; `reason: "not-required"` significa
  exatamente isso. O form leva 1–3s carregando: mostre estado de loading.
- QA do formulário fora da Europa: `"umpDebugGeography": "EEA"` + `"umpTestDeviceIds"` no
  app.json — **fora** antes de publicar.

**Lembrete:** adapter no build não serve ad sozinho. Cada rede precisa de conta própria, app
cadastrado, `app-ads.txt` publicado e grupo de mediação configurado na UI do AdMob.

────────────────────────

## REGRA 6 — POLICY CHECKS: ler `.claude/POLICY-CHECKS.md`

Arquivo **`.claude/POLICY-CHECKS.md`** — lista de regras de review que **já derrubaram build de
verdade** (Apple/Google), cada uma com app, versão e data da rejeição. Vem do `expo-utils` e
**cresce com o tempo**: releia sempre, o que você lembra dele está desatualizado por definição.

### Quando ler (não é opcional)

| Momento                                                                                    | O quê                                                       |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Antes de todo build de submissão** (`eas build --profile production`, `fastlane`, bump de versão) | Ler o arquivo **inteiro** e conferir item por item no app     |
| **Antes de escrever/alterar** um fluxo coberto por um item (permissão, paywall, ads…)       | Ler o item **antes** do código, não depois da rejeição        |
| Rejeição nova chegou                                                                        | Corrigir o app **e** adicionar a regra no repo `expo-utils`   |

**Nunca** marque uma etapa de build/submissão como concluída sem ter lido o arquivo **nesta
sessão.** Não edite a cópia local: ela é sobrescrita pelo `expo-utils-install` — regra nova vai
em `templates/POLICY-CHECKS.md` no repo do `expo-utils`.

### Índice atual (o texto completo, com exemplos e greps, está no arquivo)

| ID    | Regra                                                                     | Loja            |
| ----- | ------------------------------------------------------------------------- | --------------- |
| P-001 | Pre-prompt de permissão: sem botão "Permitir", sem saída que adie o pedido | Apple 5.1.1(iv) |

Resumo do P-001, porque é o mais fácil de violar sem perceber: tela custom antes do diálogo do
sistema pode **explicar**, nunca **decidir**. Botão de avanço neutro (`Continuar` / `Próximo` —
nunca `Permitir acesso`) e **nenhuma** saída que pule o pedido (sem `Cancelar`, sem X, sem swipe,
sem overlay clicável). Na dúvida, **não faça pre-prompt**: chame a permissão direto no gesto.

────────────────────────

## REGRA 7 — Atribuição, analytics e push: já vêm do expo-utils (≥ 1.4.0)

O boot da lib já grava os atributos no customer do RevenueCat (em duas fases, com envio forçado),
liga GA4 ↔ RevenueCat e mede paywall, review, cross-promo, consentimento e push. O app **não**
reimplementa nada disso.

**PROIBIDO no app:**

- Chamar `Purchases.collectDeviceIdentifiers`, `setFirebaseAppInstanceID`, `setFBAnonymousID`,
  `setPushToken` ou gravar atributo de contexto (idioma, país, versão…) — a lib já faz e duplicar
  só gasta o limite de envios do SDK (5/min).
- Trocar o `ExpoUtilsLayout` por um `_layout` que só chama `Utils.prepare()`: sem o
  `Utils.handleReady` não rodam UMP, ATT, push, Facebook, TikTok nem a fase 2 da atribuição — e
  o customer fica **vazio** no RevenueCat. (A lib avisa em `expo_utils_warn` depois de 30s.)
- `logEvent(...).catch()` direto do Firebase: use `logUtilsEvent(nome, params)` do `expo-utils`
  (nunca lança, nunca vira unhandled rejection, compila em qualquer versão do RNFB).
- Evento chamado `purchase` ou params `value` + `currency` em evento próprio de paywall — o GA4
  conta como receita e duplica o `in_app_purchase` automático.
- Instalar `expo-notifications` sem testar no iOS: ele toma o delegate de notificações e pode
  calar o `push_opened`.

**Esperado no app:**

- `usePaywall({placement: "onboarding"})` — sempre dizer DE ONDE o paywall abriu; é o que segmenta
  o funil `paywall_*`.
- Atributo próprio no RevenueCat: `await setRevenueCatAttributes({chave: "valor"})` (já força o envio).
- **Geo por IP vem ligada** (país/estado/cidade no customer). Antes de submeter: declarar
  "Coarse Location" (App Store) e "Approximate location" (Play Data Safety) **ou** desligar com
  `["expo-utils", {"geoAttributes": false}]` / Remote Config `geo_lookup_enabled: false`.
- Conferir no Metro, em dev: `[expo-utils] event rc_attribution {"phase":1…}` **e** `{"phase":2…}`.
  Só a fase 1 = layout sem `handleReady`. `synced:1` = o RevenueCat aceitou. A prova final é o
  customer no dashboard (o ID sai no log `RC appUserID`), não o log local.
- Sender de push: mandar `data: {push_id: "<id>"}` junto da notificação — é o que permite calcular
  a taxa de abertura por notificação (`push_opened` ÷ `push_received`).
