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
- Validar em **device físico / simulador iOS 26**: rolar deve minimizar a tab bar numa pílula, colapsar o large title e desfocar o conteúdo sob a nav bar.