# Tutorial de avaliação

`html.ts` gera a animação usada pela WebView. O launcher, o logo da Play Store, os
controles e os textos são HTML/SVG. As texturas laterais e a decoração do banner ficam
embutidas em `art.ts`; não há download durante o loop. A fonte **não** é embutida: o
tutorial é Android-only e o Android já usa Roboto como fonte de sistema, com todos os
pesos reais — `font-family: Roboto, 'Helvetica Neue', Arial, sans-serif`.

Os rótulos da Play Store (`labels.ts`) cobrem os 31 idiomas de `ask-for-review.tsx` e são
**extraídos do APK da Play Store**, não traduzidos — o procedimento está no topo do arquivo.

## Ajustar as animações

Abra `editor.html` no navegador. Cada transição tem uma duração em segundos e um
botão **Ver trecho**, que repete a transição com um pequeno intervalo antes e depois.
**Slide down · recuar a tela** controla o movimento após tocar em “Notas e avaliações”
(0,25 s no preset atual; 0,4 s na referência).
**Ir para Gerenciar apps** controla a transição após tocar nesse item no menu da conta.

- Arraste o slider ou digite a duração. Os eventos seguintes se deslocam juntos,
  incluindo setas, estrelas, digitação e contador.
- Use **Tutorial inteiro** para conferir o ritmo completo, ou pause e avance em passos
  de 0,1 s. A barra de progresso permite ir a qualquer instante.
- **Copiar JSON** / **Baixar JSON** exportam `timings` para as props do componente.
  **Baixar HTML** gera o tutorial com os ajustes, pronto para `review_tutorial_html`.
- As escolhas ficam salvas neste navegador, por nome de app e preset. **Restaurar padrão**
  recupera as durações de `timings.ts`. O editor é uma ferramenta local; seus controles
  não aparecem na WebView do app.

```tsx
<ReviewTutorial
    appName="Meu App"
    locale="pt"
    timings={{slideDown: 1.0, accountOpen: 0.6, composerOpen: 0.7}}
/>
// No overlay: tutorial={{timings: {slideDown: 1.0}}}
```

Os campos disponíveis estão em `timings.ts`. Valores são limitados a 0,05–30 s;
campos omitidos usam `defaultDuration`. O preset atual tem **21,85 s**:

```json
{"timings":{"storeOpen":0.7,"homeEnter":1.35,"accountOpen":1.05,"manageOpen":1.35,"slideDown":0.25,"reviewsOpen":0.5,"composerOpen":0.65,"typing":3.9}}
```

Ajustar uma transição aumenta ou diminui a duração
total, sem comprimir o tempo de leitura das outras telas.

## Gerar para outro app

```sh
bun utils/review-tutorial/preview.ts --project ../meu-app --locale pt --output /tmp/meu-app.html
```

Lê `expo.name` e `expo.android.icon` / `expo.icon` do `app.json` do projeto e embute
o ícone local como data URI. Para projetos com configuração dinâmica, passe os
valores explicitamente:

```sh
bun utils/review-tutorial/preview.ts --app-name "Meu App" --icon ../meu-app/assets/icon.png --locale es
```

`--params params.json` aceita os campos de `ReviewTutorialParams`, incluindo
`userName`, `userEmail`, `reviewText` e `labels`. Precedência: projeto → JSON → flags.
Sem `--output`, atualiza `result.html` e `editor.html`. Com `--output /tmp/meu-app.html`,
também gera `/tmp/meu-app-editor.html`. O primeiro arquivo reproduz o tutorial; o segundo
permite ajustar os tempos. Ambos são independentes e abrem diretamente no navegador.

Para conferir em inglês, abra `result-en.html`, ou gere outra versão com `--locale en`:

```sh
bun utils/review-tutorial/preview.ts --project ../meu-app --locale en --output /tmp/result-en.html
```

No componente, use `locale="en"`. O idioma altera os rótulos e o comentário de exemplo;
nome do app e textos fornecidos explicitamente continuam usando os valores das props.

No app, continue usando `<ReviewTutorial appName="Meu App" appIcon={...} locale="pt" />`
ou `appIconUrl`. A descoberta pelo `app.json` é feita pelo script de preview; a
WebView recebe o ícone pelas props.

## Conferência por frame

A referência `ob_04.gif` tem 190 frames de 100 ms (19 s; o preset atual dura 21,85 s). Os tempos dos keyframes
são escritos em segundos, e as animações CSS, a digitação, o contador e o cursor
usam o mesmo relógio. `result.html#t=5.6` abre congelado em 5,6 s.

Para exportadores ou inspeção no console do navegador:

```js
await window.reviewTutorialReady;
window.reviewTutorial.seek(15.05); // primeiro caractere no preset atual
window.reviewTutorial.play();
window.reviewTutorial.pause();
window.reviewTutorial.setTimings({slideDown: 1.2});
window.reviewTutorial.getState(); // time, sourceTime, duration, playing, timings, segments
```

`seek()` também pausa e usa o tempo ajustado; `duration` retorna ao frame inicial.
`sourceTime` indica o instante correspondente na gravação original. `setTimings()`
preserva o frame atual e o estado de reprodução. Aguarde um
`requestAnimationFrame` após o seek antes de capturar a imagem. A API altera apenas
a simulação, sem abrir a loja nem publicar avaliações.

Trechos medidos: abertura 1,5–2,6 s; conta 3,8–4,0 s; gerenciar 5,5–5,8 s;
avaliações 7,9–8,4 s; editor 9,8–10,0 s; foco 10,9 s; digitação 12,2–16,1 s.
As pausas da gravação se adaptam ao comprimento do texto traduzido, preservando
graphemes e limitando o conteúdo a 500 caracteres.
