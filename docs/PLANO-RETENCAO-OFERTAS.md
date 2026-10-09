# Plano da retenção completa: descontos, falha de pagamento e vitalício pelo Remote Config

Data: 07/10/2026. Continua o [`PLANO-RETENCAO-TRIAL-CANCELADO.md`](PLANO-RETENCAO-TRIAL-CANCELADO.md), cuja fase 1 (o modal) já roda no expo-utils-lab. O que foi conferido e o que não foi está na [seção 13](#13-o-que-foi-verificado-e-o-que-não-foi).

**Status em 08/10/2026:** interface de todos os segmentos e ofertas + pré-visualização e, depois, a **compra de verdade** (ok do Bruno: "pode colocar o purchase pra funcionar"): `showRetention()` confere as ofertas na loja, abre o modal e compra/resgata de verdade, com os eventos `retention_*`. **Ainda não existe** a detecção automática (quando abrir sozinho, `max_shows`, intervalo, episódio, volta ao primeiro plano) nem o push (seção 6). Detalhes do que entrou e do que só dá para conferir em loja de verdade: [seção 14](#14-implementado-compra-de-verdade-08102026).

## Em português simples

- **Segmento:** a situação da pessoa na assinatura (cancelou o trial, falha no pagamento, venceu, nunca pagou…). A lib já calcula isso em `utils/rc-status.ts`.
- **Oferta:** o que o modal propõe: reativar, desconto, vitalício, atualizar o pagamento ou código promocional.
- **Elegível:** a loja deixa aquela pessoa usar aquela oferta agora.
- **Motor de decisão:** a parte da lib que junta o segmento, as regras do Remote Config e o que existe de verdade na loja, e escolhe a melhor oferta que dá para comprar, com o preço real.
- **Carência (grace period):** a loja tenta cobrar de novo e a pessoa continua com acesso. **Account hold** (Google) e **billing retry** (Apple): a loja ainda tenta cobrar, mas o acesso já foi tirado.

## 1. O que foi pedido

- Parâmetros para oferecer desconto.
- Alcançar também quem teve falha de pagamento.
- Tudo controlado pelo Remote Config.
- Oferecer o vitalício, com a lib descobrindo sozinha o produto, o preço e para quem mostrar.
- "Algo bem completo", planejado antes de codar.

## 2. A regra que manda em tudo: o desconto mora na loja

O app não consegue criar preço. Cada desconto precisa existir antes como produto ou oferta na App Store, na Play e no RevenueCat. O Remote Config escolhe **qual** oferta mostrar, **para quem** e **quando**; o preço e a cobrança vêm sempre da loja. Se a oferta pedida no Remote Config não existir na loja, a lib pula para a próxima da lista e registra o motivo (seção 9).

## 3. Segmentos

| Segmento (`rc_status`) | Situação | Tem Premium hoje |
| --- | --- | --- |
| `trial_cancelled` | no trial, renovação desligada | só com `is_opted_out_trial_enabled` |
| `cancelled` | assinatura paga, renovação desligada | só com `is_opted_out_trial_enabled` |
| `billing_issue` | a loja não conseguiu cobrar | na carência sim; no hold/retry não |
| `expired` | já pagou, a assinatura venceu | não |
| `trial_expired` | o trial acabou sem virar assinatura | não |
| `free` | nunca assinou | não |
| `trial`, `intro`, `active` | pagante ou em teste normal | sim: **nunca** recebe oferta |

**Quem decide é o Remote Config (decisão do Bruno, 08/10/2026).** A lib não tem regra própria de "quem vê o quê": cada segmento só mostra a lista de ofertas que estiver no Remote Config, na ordem dela. Segmento sem lista não vê nada. Quem já tem o vitalício é Premium por entitlement ativo e nunca recebe oferta. Todos os nomes de campo do Remote Config são em inglês.

## 4. Ofertas e o que cada loja permite

| Oferta | iOS | Android | Segmentos |
| --- | --- | --- | --- |
| **`resubscribe`** (embutida): voltar com a mesma assinatura de antes, pelo preço normal | ver a tabela abaixo | ver a tabela abaixo | todos, menos `free` |
| **Desconto na assinatura** | *promotional offer* criada no App Store Connect, assinada pelo RevenueCat (`getPromotionalOffer` + `purchaseDiscountedPackage`). Vale para quem assina ou já assinou | oferta *developer determined* no base plan, achada pela **tag** (`subscriptionOptions[].tags`) e comprada com `purchaseSubscriptionOption` | iOS: todos os que já assinaram. Android: `expired` e `trial_expired`; nos que ainda têm a assinatura ativa, **a testar** (a doc não fala de oferta na nova assinatura) |
| **Win-back da Apple** | iOS 18+: `getEligibleWinBackOffersForPackage`; a Apple decide quem é elegível | não existe (a função não retorna nada) | `expired` |
| **Código promocional** | *offer code*: link `apps.apple.com/redeem?ctx=offercodes&id={app}&code={código}` ou `presentCodeRedemptionSheet` | códigos da Play: **a conferir** | qualquer um, conforme a regra do código |
| **Vitalício** | produto cujo ID está no Remote Config, buscado com `getProducts` e comprado com `purchaseStoreProduct` | igual | qualquer segmento |

**O que o `resubscribe` faz em cada situação** (a lib escolhe sozinha; no Remote Config basta escrever `"resubscribe"`):

| Situação | iOS | Android |
| --- | --- | --- |
| `trial_cancelled`, `cancelled` (ainda ativa, renovação desligada) | abre a folha de assinaturas da Apple para religar a renovação (religar com compra dentro do app: **a testar**) | compra de novo o mesmo plano dentro do app: a Google gera um pedido de US$ 0,00 e a cobrança volta na data original (doc da Google) |
| `billing_issue` | abre a mensagem oficial da Apple para trocar a forma de pagamento (StoreKit, iOS 16+) | abre o aviso oficial da Play, com o link para trocar a forma de pagamento |
| `expired`, `trial_expired` | compra de novo a mesma assinatura que a pessoa tinha, pelo preço normal. A lib descobre qual era no histórico do RevenueCat | igual |

## 5. Como a lib descobre sozinha (motor de decisão)

Roda quando o app abre e quando volta para o primeiro plano, sem timer (o Android pausa timers com diálogo do sistema na frente).

1. **Segmento:** `getRevenueCatStatus(customerInfo)`. Para `trial_cancelled`, `cancelled` e `billing_issue`, a lib busca o `customerInfo` de novo na volta ao app (no máximo 1 vez a cada 60 s), para pegar o que a pessoa acabou de fazer na loja.
2. **Regras:** lê no Remote Config a lista de ofertas daquele segmento, na ordem que você escreveu. Sem lista, para aqui.
3. **Conferência de cada oferta na loja**, até achar uma que passe:
   - o produto existe no offering e o preço carregou (`getOfferings`);
   - desconto iOS: o desconto com aquele id está no produto (`product.discounts`) e o `getPromotionalOffer` assina sem erro;
   - desconto Android: algum `subscriptionOption` tem a tag configurada;
   - win-back: `getEligibleWinBackOffersForPackage` devolve alguma oferta;
   - vitalício: o produto cujo ID está no Remote Config, buscado direto na loja com `getProducts` (não precisa de offering). Sem ID no Remote Config, a lib procura um pacote vitalício nos offerings, como reserva;
   - código: sempre passa (a loja confere na hora do resgate);
   - `resubscribe`: passa quando a lib acha o produto que a pessoa tinha (ou, em `billing_issue`, sempre).
4. **Preço e desconto mostrados:** sempre o `priceString` da loja, na moeda da pessoa. O selo "−40%" e o preço riscado saem da comparação com o produto indicado em `compare_product_id` (ou com a assinatura do mesmo período). Sem base de comparação, mostra só o preço.
5. **Nada passou:** o modal não abre, e o evento `retention_offer_unavailable` diz por quê.

**Proteções:**
- nunca mostra oferta a pagante, a quem está em trial normal ou a quem tem o vitalício;
- **episódio:** a chave é produto + data do evento (cancelamento, falha ou vencimento). Cada episódio respeita o máximo de exibições e o intervalo mínimo; um episódio novo começa a contagem do zero;
- **vitalício comprado por quem tem falha de pagamento:** a assinatura antiga continua tentando cobrar. Depois da compra, a lib mostra "Cancele a assinatura antiga para não ser cobrado de novo", com o botão que abre a tela de assinaturas;
- a oferta abre depois do ATT e tem prioridade sobre o promo e o app-open naquela sessão (regra da fase 1).

## 6. Falha de pagamento

- **Detecção:** `billingIssueDetectedAt` no entitlement. Na Apple, a loja tenta cobrar por até 60 dias, com carência se ela estiver ligada no App Store Connect. Na Google, há carência e depois account hold.
- **Acesso:** na carência a pessoa mantém o acesso; no account hold a Google manda bloquear (doc oficial). O entitlement do RevenueCat já segue isso, e o Premium da lib também.
- **A loja já avisa sozinha:** o SDK do RevenueCat mostra por padrão a mensagem oficial de pagamento das duas lojas (`shouldShowInAppMessagesAutomatically`, padrão ligado). Se nada mudar, a pessoa vê o aviso da loja e depois o nosso modal.
- **Proposta:** a lib desliga o automático e chama `showInAppMessages([BILLING_ISSUE])` quando a pessoa toca em "Atualizar pagamento" no nosso modal. Assim é um aviso só, e o nosso vem com a alternativa do vitalício.
- **Push:** o tópico `{slug}-purchase-billing_issue` já existe. Falta o envio em PHP mandar para ele, com um dado no push que abre o modal ao tocar. Assim alcança quem não abre o app.

## 7. Remote Config

Parâmetro próprio `retention` (JSON), com `utils.retention` como reserva. Fica separado porque o A/B Testing do Firebase trabalha por parâmetro, e o `utils` é um JSON grande, com uma condição por app.

```json
{
  "enabled": true,
  "segments": {
    "trial_cancelled": {"offers": ["discount_50", "resubscribe"], "max_shows": 2, "min_interval_hours": 12, "reminder_hours_before_end": 24},
    "cancelled":       {"offers": ["resubscribe"], "max_shows": 2, "min_interval_hours": 24},
    "billing_issue":   {"offers": ["resubscribe", "lifetime_deal"], "max_shows": 3, "min_interval_hours": 24},
    "expired":         {"offers": ["winback", "discount_50", "lifetime_deal"], "max_days_after_expiration": 60},
    "trial_expired":   {"offers": ["discount_50", "lifetime_deal"], "max_days_after_expiration": 30},
    "free":            {"offers": ["lifetime_deal"], "after_paywall_dismissals": 3}
  },
  "offers": {
    "discount_50":   {"type": "discount", "ios_offer_id": "retention_50", "android_offer_tag": "retention-50"},
    "lifetime_deal": {"type": "lifetime", "product_id": "lifetime_retention", "compare_product_id": "lifetime"},
    "promo_code":    {"type": "offer_code", "ios_code": "COMEBACK50"}
  },
  "image_url": "https://…/retention.png",
  "texts": {
    "pt": {"billing_issue.title": "…", "offers.lifetime_deal.cta": "…"}
  }
}
```

O mais simples que funciona, "só voltar com a assinatura como era antes" para todo mundo:

```json
{
  "enabled": true,
  "segments": {
    "trial_cancelled": {"offers": ["resubscribe"]},
    "cancelled":       {"offers": ["resubscribe"]},
    "billing_issue":   {"offers": ["resubscribe"]},
    "expired":         {"offers": ["resubscribe"]},
    "trial_expired":   {"offers": ["resubscribe"]}
  }
}
```

- `resubscribe` e `winback` são embutidas: não precisam de declaração em `offers`. Os nomes das outras (`discount_50`, `lifetime_deal`…) você inventa; o que vale é o `type`.

- Sem a chave, ou sem lista para o segmento, nada abre.
- Os textos padrão da lib cobrem cada segmento × oferta nas 12 línguas e continuam dentro dos limites da Apple (título e bullets até 66 caracteres, texto até 144). O Remote Config troca qualquer texto por língua.
- Variáveis dos textos: `{app}`, `{price}`, `{original_price}`, `{discount}`, `{period}`, `{date}`.
- `docs/index.html` ganha o gerador desse JSON (lista `FIELDS`).

## 8. Interface

O mesmo modal da fase 1: no iOS, a folha nativa do sistema; no Android, a folha de baixo. Cores que já estão no código (`utils/retention-modal.tsx`):

| Uso | Claro | Escuro |
| --- | --- | --- |
| Botão principal | `#007AFF` | `#0A84FF` |
| Fundo | `#FFFFFF` | `#1C1C1E` |
| Caixa da data | `#F2F2F7` | `#2C2C2E` |
| Divisória | `#D1D1D6` | `#48484A` |
| Aviso | `#FFB340` | `#9A5B00` |

Fonte do sistema (SF no iOS, Roboto no Android): título 22 em negrito, texto 15, botões 16. A largura acompanha a tela e o árabe vai da direita para a esquerda.

Peças novas:
- **Cartão de oferta:** preço novo grande, preço antigo riscado, selo verde `#34C759` com "−50%", período ("nos 3 primeiros meses") e a regra depois do desconto ("depois R$ 19,90/mês"), como as lojas exigem.
- **Cartão do vitalício:** "Pague uma vez, use para sempre", preço e selo. Em `billing_issue` ele aparece abaixo do botão principal, como alternativa.
- **Falha de pagamento:** ícone de cartão com alerta na cor de aviso, título "Seu pagamento não passou" e botão "Atualizar pagamento".
- **Win-back:** "Sentimos sua falta", com a oferta.

```
 trial cancelado + desconto      falha de pagamento              venceu (win-back)
┌───────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
│      [ícone / imagem]     │   │      [cartão ⚠ ]          │   │      [ícone / imagem]     │
│ Seu teste foi cancelado   │   │ Seu pagamento não passou  │   │ Sentimos sua falta        │
│ Volte e pague menos:      │   │ Atualize o pagamento para │   │ Volte com desconto:       │
│ ┌───────────────────────┐ │   │ não perder o Premium.     │   │ ┌───────────────────────┐ │
│ │ −50%  R$ 9,90 /mês    │ │   │ [ Atualizar pagamento ]   │   │ │ −50%  R$ 9,90 /mês    │ │
│ │ ~~R$ 19,90~~ 3 meses  │ │   │ ┌───────────────────────┐ │   │ │ ~~R$ 19,90~~ 3 meses  │ │
│ └───────────────────────┘ │   │ │ Prefere pagar 1 vez?  │ │   │ └───────────────────────┘ │
│ Teste vai até 12/out      │   │ │ Vitalício R$ 59,90    │ │   │ [ Voltar com desconto ]   │
│ [ Quero o desconto ]      │   │ └───────────────────────┘ │   │      Agora não            │
│      Agora não            │   │      Agora não            │   │                           │
└───────────────────────────┘   └───────────────────────────┘   └───────────────────────────┘
```

## 9. Eventos do Analytics

| Evento | Parâmetros principais | Status (08/10/2026) |
| --- | --- | --- |
| `retention_impression` | `segment`, `offer_type`, `offer_id`, `price`, `price_currency`, `discount_pct`, `show_n` | implementado, sem `show_n` (é da detecção) |
| `retention_click` | `segment`, `offer_type`, `action` | implementado |
| `retention_close` | `segment`, `close_method`, `show_n` | implementado, sem `show_n` |
| `retention_purchase` | `segment`, `offer_type`, `offer_id`, `product_id`, `price`, `price_currency` | implementado |
| `retention_purchase_error` | `segment`, `offer_id`, `status` (`failed`/`pending`), `code` | implementado |
| `retention_recovered` | `segment`, `via`, `hours_since_impression` | não (é da detecção) |
| `retention_offer_unavailable` | `offer_id`, `reason` (produto não existe, desconto não está no produto, não elegível…) | implementado |

Tudo pelo `logUtilsEvent`, no `docs/ANALYTICS-EVENTS.md`. O último evento mostra quando o Remote Config pede uma oferta que a loja não tem. O preço vai em `price` + `price_currency`, não em `currency` (regra da lib desde o paywall: `value`/`currency` fazem o GA4 tratar o evento como receita e somar com o `in_app_purchase` automático).

## 10. O que precisa existir fora do código, por app

- **App Store Connect:** promotional offer na assinatura (ex.: `retencao_50`); carência de cobrança ligada; win-back offer e offer code se for usar.
- **RevenueCat:** ligar o produto vitalício de retenção ao entitlement do Premium (sem isso a compra não libera o Premium); chave de In-App Purchase da Apple (sem ela não dá para assinar promotional offer); notificações de servidor da Apple e da Google. **Offering não é necessário:** o Remote Config aponta direto para o ID do produto (decisão do Bruno em 08/10/2026: tudo no Remote Config).
- **Play Console:** oferta *developer determined* com tag (ex.: `retencao-50`) no base plan; produto vitalício de retenção; carência e account hold configurados.
- **Firebase:** parâmetro `retention`.

## 11. Fases

1. **Motor + segmentos + Remote Config + reativar + atualizar pagamento + vitalício.** Só JS, vai por OTA. Não depende de oferta nova na loja, só do produto vitalício.
2. **Descontos:** promotional offer no iOS e oferta com tag no Android, incluindo o teste de oferta para quem ainda tem a assinatura ativa no Android.
3. **Win-back do iOS 18+ e códigos promocionais.**
4. **Push** para `billing_issue` e `trial_cancelled` pelo envio PHP, abrindo o modal ao tocar.
5. **Segmento `free`** (opcional).

Teste em cada fase no expo-utils-lab com sandbox de verdade: arquivo StoreKit no Xcode para iOS, e testador de licença com o cartão de teste "sempre recusa" na Play para gerar a falha de pagamento. A Test Store do RevenueCat, que o lab usa hoje, não foi conferida para ofertas nem para falha de pagamento.

## 12. Decisões em aberto

1. Aviso de pagamento: deixar a loja mostrar sozinha e o nosso modal depois, ou a lib controlar o momento com um aviso só (recomendado).
2. Vitalício para quem está com falha de pagamento, com o aviso para cancelar a assinatura antiga.
3. Segmento `free` com vitalício depois de N recusas do paywall: liga ou não.
4. Quais descontos e produtos criar em cada app (configuração na loja; a lib só lê).
5. Parâmetro próprio `retention` no Remote Config (recomendado) ou dentro do `utils`.
6. Ok para começar pela fase 1.

## 13. O que foi verificado e o que não foi

Conferido em 07/10/2026:
- No `react-native-purchases` 10.10.1 do lab existem `getProducts`, `purchaseStoreProduct`, `purchaseDiscountedProduct`, `getPromotionalOffer`, `purchaseDiscountedPackage`, `getEligibleWinBackOffersForPackage`, `purchasePackageWithWinBackOffer`, `purchaseSubscriptionOption`, `checkTrialOrIntroductoryPriceEligibility`, `presentCodeRedemptionSheet`, `showManageSubscriptions`, `showInAppMessages`, `offering.lifetime` e `subscriptionOptions[].tags`.
- O SDK mostra sozinho as mensagens de pagamento das lojas, a menos que `shouldShowInAppMessagesAutomatically` seja `false`. Tipos: `BILLING_ISSUE` (as duas lojas), `PRICE_INCREASE_CONSENT`, `GENERIC` e `WIN_BACK_OFFER` (só iOS). A lib não mexe nessa opção hoje.
- `rc-status.ts` já tem os segmentos `free`, `trial`, `trial_cancelled`, `intro`, `active`, `cancelled`, `billing_issue`, `trial_expired` e `expired`.
- Doc da Google: assinar de novo o mesmo base plan antes de vencer gera um pedido de US$ 0,00 e mantém a data de cobrança; na carência a pessoa mantém o acesso e no account hold perde; o aviso oficial da Play leva a pessoa a consertar o pagamento.
- Formato do link de offer code da Apple (doc da RevenueCat e de terceiros).

Não verificado:
- Nada desta parte rodou em aparelho.
- Comprar uma oferta com desconto no Android tendo a assinatura cancelada ainda ativa.
- O comportamento da promotional offer comprada durante um trial cancelado, no sandbox.
- Se o arquivo StoreKit do Xcode simula a falha de pagamento e a carência.
- Os códigos promocionais da Play.
- Se a Test Store do RevenueCat simula ofertas e falha de pagamento.

Conferido em 08/10/2026 (compra de verdade, seção 14), sem aparelho:
- No SDK Android do RevenueCat (purchases 10.22.1, que o hybrid-common 19.2.0 do lab puxa; lido no AAR com `javap`): `getProducts(["assinatura"])` devolve um produto por base plan (`assinatura:basePlan`), e `getProducts(["assinatura:basePlan"])` só aquele; a compra por produto (`purchaseStoreProduct`) busca a assinatura e acha o produto pelo id exato. Por isso a lib pede o id do entitlement como está e escolhe o base plan da pessoa na resposta (pedir `monthly:testBasePlanId` na loja de teste não devolveria nada: o filtro por base plan só vale para produto do Google).
- No `react-native-purchases` 10.10.1: `getPromotionalOffer` e `getEligibleWinBackOffersForProduct` devolvem `undefined` no Android sem chamar o nativo; `presentCodeRedemptionSheet` não faz nada no Android; as compras marcam `userCancelled` pelo código 1.

Não verificado (08/10/2026): nada da compra rodou em aparelho nesta passada (o Bruno testa no lab). Ver a tabela da seção 14.

## 14. Implementado: compra de verdade (08/10/2026)

**Abrir:** `showRetention({segment?, offers?, productIdentifier?, variant?, locale?, imageUrl?, defaultBullets?})` (`utils/retention-show.ts`, exportado no `index.ts`). Quem chama decide o momento (a detecção automática não existe). Ordem:

1. `retention.enabled === false` desliga, mesmo com ofertas passadas pelo app.
2. `Purchases.getCustomerInfo()` (falhou: `rc_unavailable`).
3. Segmento: o forçado (`segment`) ou o `rc_status`. Fora dos 6 segmentos de retenção, não abre.
4. Premium ativo (o critério do `isPremiumEntitlement`: cancelado ou com falha de pagamento não conta) não recebe oferta, a não ser com segmento forçado.
5. Ofertas: as do app (`offers`) ou `retention.segments.<segmento>.offers`. Sem lista, não abre.
6. Conferência na loja (`resolveRetentionOffers`, `utils/retention-store.ts`), na ordem, parando em 2 válidas. As puladas saem em `skipped` com o motivo e no `retention_offer_unavailable`. Nenhuma válida: não abre.
7. `RetentionEvents.show({segment, offers, productIdentifier, expirationDate, managementURL, variant, locale, imageUrl, defaultBullets})`.

Devolve `{request, segment, skipped, reason}` e nunca lança. `reason`: `disabled`, `rc_unavailable`, `not_retention_segment`, `premium`, `no_offers`, `no_valid_offers` ou `error` (null = abriu). O catálogo de exemplo da pré-visualização (`discount_50`, `lifetime_deal`, `promo_code`) **não** vale aqui: o nome tem que estar em `retention.offers`, ser embutido (`resubscribe`, `winback`) ou ser o próprio tipo (`"lifetime"`).

**O que cada tipo vira na loja** (o preço é sempre o da loja: `priceString` ou `formatted`):

| Tipo | iOS | Android | Pula quando |
| --- | --- | --- | --- |
| `resubscribe` | trial/assinatura cancelados: reativar pela gestão; falha de pagamento: atualizar o pagamento; vencidos: compra do produto anterior | renovação desligada: compra do mesmo base plan (sem o produto, ou a loja dizendo que já é da pessoa, código 6: reativar pela gestão); falha de pagamento: atualizar; vencidos: compra | `free`; vencido sem produto anterior ou com o produto fora da loja |
| `subscription` | `product_id` pelo preço normal | idem; produto com várias opções → `purchaseSubscriptionOption` do base plan (o `defaultOption` podia escolher um trial ou desconto) | sem `product_id`; produto fora da loja |
| `lifetime` | `product_id` (NON_SUBSCRIPTION) ou, sem ele, o pacote vitalício do offering atual (depois o de qualquer offering) | idem | nenhum dos dois |
| `discount` | `product.discounts` com `identifier === ios_offer_id` + `getPromotionalOffer` assinando (pede de novo na hora da compra) + `purchaseDiscountedProduct` | `subscriptionOptions` (oferta, não o base plan) com a tag `android_offer_tag`, no base plan da pessoa e depois nos outros da assinatura; `purchaseSubscriptionOption` | sem id/tag; sem produto (nem `product_id` nem o anterior); desconto fora do produto; sem assinatura da Apple |
| `winback` | `getEligibleWinBackOffersForProduct` (iOS 18+) + `purchaseProductWithWinBackOffer` | não existe | Android; nenhuma elegível; erro |
| `offer_code` | link `https://apps.apple.com/redeem?ctx=offercodes&id={ios_app_id do Remote Config}&code={ios_code}`; sem App ID ou sem código, `presentCodeRedemptionSheet` | link `https://play.google.com/redeem?code={android_code}` | Android sem `android_code` |

- **Produto anterior:** `trial_cancelled`/`cancelled`/`billing_issue` → o entitlement que decide o `rc_status` (`getLifecycleEntitlement` em `utils/rc-status.ts`); `expired`/`trial_expired` → a assinatura vencida mais recente; `free` → nenhum. `productIdentifier` troca o produto (teste). O produto é buscado pelo `getProducts` e, sem ele, nos pacotes dos offerings.
- **Comparação (`compare_product_id`):** mesmo período (ou os dois sem período) = o preço da loja; período diferente = `pricePerWeek`/`pricePerMonth`/`pricePerYear` do produto de comparação × a quantidade, sem `formatted` (o `Intl` formata). Só entra se for mais caro que a oferta. No desconto e no win-back o riscado é sempre o preço cheio do próprio produto (a regra "depois R$ X/mês" depende disso).
- **Compra:** `purchaseRetentionOffer(oferta)` → `purchased` (com `premium`; grava `@isPremium` quando libera, como o PaywallUtils), `cancelled` (`userCancelled` ou código 1), `pending` (código 20) ou `failed` (código e mensagem). Nunca lança.
- **Modal (fora da pré-visualização):** spinner no botão tocado e todos os botões desligados enquanto compra; comprou → fecha com `purchased` (vitalício em `billing_issue` → o aviso de cancelar a assinatura antiga); cancelou → volta ao normal, sem mensagem; pendente → "Pagamento pendente. O Premium libera assim que a loja confirmar." e continua aberto; falhou → "Não deu para concluir a compra. Tente de novo." e continua aberto. Código → `redeemRetentionCode` e fecha com `redeem` (a folha da Apple espera o modal sair). A pré-visualização continua sem compra.
- **Textos novos** nas 12 línguas: `purchaseError` e `purchasePending` (Remote Config: `purchase.error`, `purchase.pending`).
- **Eventos:** seção 9 e `docs/ANALYTICS-EVENTS.md`.

**O que dá para ver na loja de teste da RevenueCat (o lab) e o que só em loja de verdade:**

| Dá para ver no expo-utils-lab (loja de teste) | Só em loja de verdade (sandbox do App Store / testador de licença do Play) |
| --- | --- |
| `resubscribe` de quem venceu (compra do `monthly`, US$ 9,99), `lifetime` pelo pacote do offering (US$ 99,99), `subscription` anual × mensal (US$ 79,99 contra US$ 119,88, selo −33%), falha de pagamento forçada → compra do vitalício → aviso pós-compra, compra cancelada, falha simulada pela loja de teste (código 42, a conferir no aparelho), `discount` pulado (`offer_not_found`) com a próxima oferta valendo, win-back pulado no Android, os eventos `retention_*` no DebugView | promotional offer do iOS (desconto + assinatura do RevenueCat, que exige a chave de In-App Purchase), oferta com tag do Play, win-back do iOS 18+, offer codes da Apple (link e folha) e códigos do Play, `resubscribe` com a renovação desligada no Android (pedido de US$ 0,00 e a mesma data de cobrança; e o código 6 caindo na gestão), pagamento pendente (código 20), `managementURL` real, falha de pagamento de verdade, a compra liberando o entitlement em produção |

Cenários do lab: `src/constants/retention-live.ts` — botões `live-…` no bloco "Retenção — compra de verdade (loja de teste)" e `expoutilslab://retencao?live=<id>`; `live-novo-cliente` (`Purchases.logIn("lab-" + Date.now())`) zera o cliente depois de comprar.
