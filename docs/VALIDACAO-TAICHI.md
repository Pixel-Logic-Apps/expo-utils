# Taichi — validação no emulador e no destino

Em **23/09/2026**, os **60 eventos Taichi chegaram ao DebugView**, cada um com contagem **1**.
Conferência feita no Google Analytics da propriedade Firebase `local-desenv` (421450515),
após repetir um callback, encerrar o processo do app e gerar outra impressão na reabertura.

## Ambiente e evidência

- App: `expo-utils-lab`, pacote `com.pixellogic.expoutilslab`, build Android de desenvolvimento.
- Emulador: `Pixel_10a`; Expo 57, RNFirebase Analytics 26.4.0, Google Mobile Ads 17.0.0.
- Biblioteca instalada via `npm pack`; `Utils.ts` e `ad-revenue.ts` instalados comparados byte a byte com o repositório.
- Identificador do teste: `2026-09-23T15:55:14.177Z` (UTC).
- [Contagens dos 60 nomes no destino](evidencias/taichi-2026-09-23/debugview-counts.tsv).
- [Linhas da tabela lidas pela acessibilidade da interface do DebugView](evidencias/taichi-2026-09-23/debugview-table-ax.txt).
- [Captura do DebugView](evidencias/taichi-2026-09-23/debugview-confirmed.png).

As contagens foram extraídas da tabela **Principais eventos** no painel, não do Metro,
do logcat ou do estado local. A captura mostra parte da tabela; o TSV contém os 60 nomes.

## Casos executados

| Etapa | Resultado observado |
| --- | --- |
| Instalação antiga com `@first_open_logged` | `firstOpen: 0`; excluída dos marcos de primeiro uso. |
| Limpar apenas as duas chaves do acumulador/primeiro uso e reiniciar | Novo `firstOpen: 1790178915763`, saldo zero. |
| Somar US$ 0,000075 sintéticos | Saldo preservado, nenhum marco. |
| Somar US$ 0,000025 sintéticos | Três marcos de US$ 0,0001: 24h, 72h e 7d. |
| Somar US$ 0,2499 e repetir o mesmo callback | Saldo US$ 0,25, 60 marcos; receita não duplicada. |
| Abrir interstitial com `TestIds.INTERSTITIAL` via `LoadAdsManager` | Anúncio exibido; callback nativo `PAID` → `ad_revenue`, `format: interstitial`, `currency: USD`, `value: 0`. |
| `adb shell am force-stop` e reabrir o app | Mesmo primeiro uso, US$ 0,25 e 60 marcos persistidos. |
| Somar US$ 0,000025 após reabrir | US$ 0,250025; continuam 60 marcos. |
| Conferir DebugView após essas etapas | 60 nomes distintos, contagem 1 em cada um; 5 `ad_revenue` e 4 `taichi_qa_step`. |

[Primeiro limite no emulador](evidencias/taichi-2026-09-23/emulator-first-threshold.png) ·
[Estado após encerrar/reabrir e somar novamente](evidencias/taichi-2026-09-23/emulator-after-restart.png).

## Reproduzir

1. No app dedicado `~/Documents/projetos/expo-utils-lab`, instalar o pacote atual conforme o roteiro do `AGENTS.md`.
2. Habilitar debug antes de abrir o app: `adb shell setprop debug.firebase.analytics.app com.pixellogic.expoutilslab`.
3. Iniciar Metro com `bunx expo start --dev-client --port 8082 --clear`, abrir o dev client e entrar em **abrir-taichi-qa** (`src/app/taichi.tsx`).
4. Executar os botões na ordem, conferindo saldo e marcos. O reset simula instalação nova **só no lab**; o código da biblioteca permanece intacto.
5. Encerrar e reabrir o processo; somar novamente para conferir persistência e ausência de repetição.
6. Abrir o DebugView da propriedade `local-desenv`, comparar os 60 nomes com o [catálogo](ANALYTICS-EVENTS.md#taichi) e conferir as contagens.

O DebugView embutido no Firebase ficou vazio e houve uma falha de renderização do Chrome.
A conferência foi concluída diretamente no [DebugView do GA4 da mesma propriedade](https://analytics.google.com/analytics/web/#/a169093288p421450515/admin/debugview/overview), após recarregar.

## Escopo da conclusão

Este teste mede o transporte até o destino e a execução do acumulador no build Android.
Os valores positivos são **sintéticos**; o SDK de anúncio de teste retornou zero. Não mede
receita positiva de anúncios de produção, iOS, importação de conversões no Google Ads ou
melhoria de receita/CPA. Expiração de 24h/72h/168h e falhas de storage seguem cobertas pelos
testes automatizados, não por uma espera de sete dias no emulador.

O typecheck e o lint da nova tela de QA passaram. As verificações completas do lab ainda
apontam problemas anteriores, fora do trecho adicionado para QA: rota `/explore`
removida referenciada por `app-tabs.web.tsx`, regras de hooks em `index.tsx` e
`use-color-scheme.web.ts`, e dependência de efeito em `_layout.tsx`.
