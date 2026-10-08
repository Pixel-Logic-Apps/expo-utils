# Plano do modal de retenção para trial cancelado

Data: 06/10/2026. Status: **proposta**, sem ok para codar. Nada foi implementado nem testado no aparelho. O que foi conferido e o que não foi está na [seção 15](#15-o-que-foi-verificado-e-o-que-não-foi).

Atualização 07/10/2026: a parte de UI (seções 6, 7 e 8) foi implementada — `utils/retention-modal.tsx`, `utils/retention-events.ts`, `utils/retention-texts.ts`, textos no `utils/i18n.ts`, chave `retention` no `RemoteConfigUtilsType`, `showRetentionPreview()` e o item "Simular trial cancelado" do menu de dev. Testes no bun: textos, limites da Apple nas 12 línguas e data por idioma. Nada rodou em aparelho. Continuam por fazer: detecção (seção 4), regra de exibição (seção 5) e eventos (seção 9).

## Em português simples

- **Trial cancelado:** o usuário está no teste grátis e desligou a renovação automática na loja. O teste continua até a data de fim, mas não vira assinatura.
- **Reativar:** religar a renovação. Só a loja faz isso; o app abre a tela de assinaturas da loja.
- **Retention Messaging (Apple):** mensagem que a App Store mostra quando o usuário toca em "Cancelar assinatura", antes de ele confirmar. Tem título, texto e imagem, e pode trazer uma oferta.
- **Modal de retenção:** a tela que a lib mostra dentro do app depois de detectar o trial cancelado, no mesmo formato da mensagem da Apple.
- **Notificações de servidor:** aviso que a Apple e a Google mandam para o RevenueCat quando a assinatura muda. Sem elas, o RevenueCat leva horas para saber do cancelamento.

## 1. O que foi pedido

- Detectar quando o usuário cancela o trial.
- Abrir um modal pedindo para ele voltar atrás, no estilo da Retention Messaging API da App Store.
- Textos em todas as línguas.

"Voltar atrás" aqui é reativar a renovação, para o teste virar assinatura.

## 2. O que a lib já tem

- **A regra de detecção:** `utils/rc-status.ts` já classifica `trial_cancelled` (entitlement ativo com `periodType: "TRIAL"`, `willRenew: false` e `unsubscribeDetectedAt` preenchido). Tem teste em `tests/rc-status.test.ts`.
- Ela roda no boot e a cada `customerInfo` novo: listener `addCustomerInfoUpdateListener` do `prepare()` → `updateRCStatusMessagingTopic` → `syncRcStatus`.
- Com esse estado a lib já grava `rc_status = trial_cancelled` (user property do GA4) e põe o aparelho no tópico FCM `{slug}-purchase-trial_cancelled`. O tópico só muda quando o app abre.
- O RevenueCat já manda `rc_cancellation` para o GA4 pela integração Firebase, do servidor.
- O customer do RevenueCat já guarda o token do push: `fcm_token` no iOS, `$fcmTokens` no Android.
- `PremiumUtils.getIsPremiumStatus()`: em produção, quem cancelou o trial **perde o Premium na hora** (os anúncios voltam), a menos que o Remote Config tenha `is_opted_out_trial_enabled: true`.
- `utils/i18n.ts` tem 12 línguas: pt, en, es, fr, de, it, ja, ko, zh, ru, ar, nl, com fallback para en.
- Peças prontas para reaproveitar: o portão do ATT (`waitAttFlowDone`), o overlay aberto por evento (`AskForReviewEvents`, via `DeviceEventEmitter`), o menu de dev (`registerDevMenuItems`) e o ícone do app em data URI (`extra.expoUtilsAppIcon`, gerado pelo plugin).

## 3. O que a Apple e a Google oferecem hoje

Lido nas fontes oficiais em 06/10/2026 (lista no fim).

### Apple: Retention Messaging

| Modo | Precisa de servidor | Quem pode usar | Ofertas |
| --- | --- | --- | --- |
| App Store Connect (WWDC26) | não | todos ("Now available") | "retention offers" ligadas à mensagem; a App Store escolhe a melhor para quem é elegível |
| API em tempo real | sim, com resposta em até 700 ms (ou o servidor da RevenueCat) | pré-release, por pedido do Account Holder | troca de plano ou oferta promocional, escolhida por usuário |

- **Onde aparece:** depois que o usuário toca em "Cancel Subscription" na tela de assinaturas do sistema, numa tela de confirmação onde ele pode cancelar, manter, resgatar a oferta ou trocar de plano. iOS 15.1 ou superior. O app não é avisado.
- **Formato:**
  - título até 66 caracteres e texto até 144;
  - imagem opcional, com texto alternativo até 150: PNG sem transparência, 3840 px de largura e de 160 a 2160 px de altura;
  - bullets opcionais: texto até 66 e ícone de 1024×1024;
  - o título pode ir acima do texto ou acima da imagem;
  - mensagem com troca de plano ou oferta não leva imagem nem bullets.
- **Revisão:** a Apple revisa cada mensagem e cada imagem (`PENDING` → `APPROVED` ou `REJECTED`), e só aparece o que foi aprovado. O texto não muda por usuário: a revisão é por idioma.
- **Idiomas:** na API, a mensagem padrão é configurada por produto × idioma da App Store, e idioma sem mensagem não mostra nada.
- **Efeito medido pela Apple (WWDC26):** +1,4 ponto na taxa de retenção, em média; +5,5 pontos com oferta promocional.
- **RevenueCat:** hospeda o modo em tempo real (Lifecycle → Retention), com público "Is in free trial" e tradução automática. Experimento A/B só nos planos Pro e Enterprise.

### Google Play

- Oferta de retenção no fluxo de cancelamento da Play Store: só no Early Access Program (anúncio de 29/09/2026), com acesso pelo partner manager.
- Disponível para todos hoje:
  - "Resubscribe" na Play desfaz o cancelamento antes de vencer (RTDN `SUBSCRIPTION_RESTARTED`);
  - ofertas "developer determined", em que o app decide quem é elegível, compradas só dentro dele;
  - o motivo do cancelamento, pelo servidor (`cancelSurveyResult`).
- Pausa não vale para trial.

### O que isso muda no plano

- A mensagem da Apple age **antes** do cancelamento; o modal da lib age **depois**. Um não substitui o outro: a parte A (modal, código na lib) e a parte B (mensagem da Apple, só configuração) somam.
- O modal usa os mesmos campos e limites da Apple, então o mesmo texto e a mesma imagem servem para os dois.
- No Android não há parte B fora do Early Access: o modal é o único caminho.

## 4. Detecção

- **Regra:** reaproveitar `getRevenueCatStatus(customerInfo) === "trial_cancelled"`. Nada de regra nova.
- **Quando o RevenueCat fica sabendo:** pelo `DID_CHANGE_RENEWAL_STATUS` / `AUTO_RENEW_DISABLED` da Apple e pelo RTDN `SUBSCRIPTION_CANCELED` da Google. Sem as notificações de servidor configuradas no projeto do RevenueCat, `unsubscribeDetectedAt` e `willRenew` podem atrasar "várias horas" (doc do RevenueCat). Por isso isso é pré-requisito (seção 13).
- **Quando o app fica sabendo:** só quando o SDK busca o CustomerInfo. O cache vale 5 minutos com o app aberto; no iOS a volta ao app só busca de novo se o cache venceu, e o listener só dispara quando o CustomerInfo mudou.
- **O que entra de novo:** a cada volta do app para o primeiro plano, se o último estado era `trial` ou `trial_cancelled`, a lib chama `invalidateCustomerInfoCache()` e `getCustomerInfo()`, no máximo uma vez a cada 60 s. Assim pega o cancelamento que o usuário acabou de fazer nos Ajustes ou na Play, e quem não está em trial não paga essa chamada.
- **Deduplicação:** a chave é `productIdentifier + unsubscribeDetectedAt`. O mesmo cancelamento respeita o limite de exibições; um cancelamento novo, depois de reativar, abre o modal de novo.
- A decisão fica numa função pura em `utils/retention.ts`, testável no bun.

## 5. Quando mostrar

| Regra | Padrão |
| --- | --- |
| 1ª vez | assim que detectar, depois do `waitAttFlowDone()` |
| Lembrete | 1 vez nas últimas 24 h do teste (`expirationDate`), se não reativou |
| Máximo por cancelamento | 2 (`max_shows`) |
| Intervalo mínimo | 12 h |
| Depois que o teste acabou | nunca: vira `trial_expired` (win-back na fase 3) |

- A conferência acontece quando o app abre e quando ele volta para o primeiro plano, sem timer: o Android pausa os timers do JS com diálogo do sistema na frente (regra do AGENTS.md).
- O modal tem prioridade sobre os outros overlays da lib. Naquela sessão o promo não aparece. Naquela volta ao app o app-open também não aparece: o usuário, que já perdeu o Premium, veria o anúncio justo quando o modal abre.
- Risco a testar: app que abre o próprio paywall no início disputa a tela com o modal.

## 6. O modal

### Formato

- Os mesmos campos da Apple: imagem opcional, título, texto e bullets opcionais (ícone + texto).
- Uma linha que só existe no app, com a data de fim: "Seu teste vai até 12 de outubro". A Apple não personaliza; o app pode.
- iOS: `Modal` com `presentationStyle="pageSheet"`, a folha nativa do sistema, com a mesma cara da tela de assinaturas. Android: bottom sheet, como o do review e o do promo.
- Sem imagem no Remote Config, usa o ícone do app (`extra.expoUtilsAppIcon`).
- Árabe da direita para a esquerda.

### Botões

- **"Reativar"** (principal):
  - iOS: `Purchases.showManageSubscriptions()`, que abre a folha de assinaturas da App Store dentro do app.
  - Android: `Linking.openURL(customerInfo.managementURL)`. O `showManageSubscriptions` do SDK lança erro no Android (conferido no fonte da 10.10.1: `throwIfAndroidPlatform`).
- **"Agora não"** (secundário).
- Botão de oferta: fase 2 (seção 11).

### Depois do toque em "Reativar"

- Android: a Play abre e o app vai para segundo plano. Na volta, a atualização da seção 4 vê `willRenew: true` e a lib registra `retention_recovered`.
- iOS: a promise do RevenueCat resolve quando a folha **abre**, não quando fecha, e a folha provavelmente não manda o app para segundo plano (não medido). Por isso o modal fica em "conferindo", com um botão "Já reativei" (invalida o cache e busca de novo), e a lib confere outra vez na próxima volta ou abertura.

### Onde é montado

- Sem linha no app: no mesmo dono único do painel descrito no [`PLANO-LOG-DO-APP.md`](PLANO-LOG-DO-APP.md), ou seja, nos componentes da lib que o app já mostra; o `ExpoUtilsLayout` monta direto. O plano que sair primeiro cria esse dono.
  - Feito em 07/10/2026: `RetentionModalSlot`, montado pelo `ExpoUtilsLayout` (prioridade 0), pelo `AskForReviewOverlay` (1) e pelo `PromotionalContent` (2); só o de menor prioridade desenha. Conferido no código: o `_layout` do lab e o `templates/RootLayout.tsx` NÃO usam o `ExpoUtilsLayout` (ao contrário do que diz a seção 12 do plano do log), então montar só nele não mostrava nada nesses apps.
- Abre por evento no `DeviceEventEmitter`, como o `AskForReviewEvents`: `RetentionEvents.show({variant, productIdentifier, expirationDate, managementURL})`.

## 7. Textos e traduções

### Texto-base (pt)

| Uso | Título (até 66) | Texto (até 144) |
| --- | --- | --- |
| Modal, Premium já saiu (padrão da lib) | Seu teste grátis foi cancelado | Os anúncios voltaram. Reative a assinatura para continuar usando o {app} sem anúncios. |
| Modal, Premium até o fim (`is_opted_out_trial_enabled: true`) | Seu teste grátis foi cancelado | Você ainda tem o Premium até o fim do teste. Reative para não perder o acesso sem anúncios. |
| Mensagem da Apple (antes de confirmar) | Fique com o {app} Premium | Mantenha a assinatura e continue usando o {app} sem anúncios. |

- Botões: "Reativar" e "Agora não". Linha só do app: "Seu teste vai até {data}."
- `{app}`: no modal, o nome do app; na mensagem da Apple, trocado à mão por app na hora de configurar, porque a Apple não aceita variável.
- `{data}`: `Intl.DateTimeFormat` no idioma do usuário. Sem "{dias}": o plural muda de língua para língua.

### As 12 línguas

- Os textos padrão entram no `utils/i18n.ts` (interface `Translations`) em pt, en, es, fr, de, it, ja, ko, zh, ru, ar e nl, com fallback para en.
- O Remote Config pode trocar o texto por língua (mapa `texts`). Língua que falta no mapa usa o texto padrão da lib naquela língua; se a lib também não tiver, usa en.
- Um teste do bun falha se algum título ou bullet passar de 66 caracteres, ou algum texto passar de 144, em qualquer língua. Assim o texto sempre serve também para a Apple.
- Revisão visual das 12 línguas no emulador e no simulador antes de publicar (harness isolado).

### Idiomas da App Store (para a mensagem da Apple)

Na Apple, cada língua vira um ou mais idiomas da App Store, por produto. A doc da API aponta para a lista de localizações da App Store; os códigos abaixo ainda precisam ser conferidos nela.

| Língua da lib | Idiomas da App Store |
| --- | --- |
| pt | pt-BR, pt-PT |
| en | en-US, en-GB, en-AU, en-CA |
| es | es-MX, es-ES |
| fr | fr-FR, fr-CA |
| de | de-DE |
| it | it |
| ja | ja |
| ko | ko |
| zh | zh-Hans, zh-Hant |
| ru | ru |
| ar | ar-SA |
| nl | nl-NL |

Idiomas da App Store fora das 12 línguas (turco, polonês, sueco, indonésio, tailandês, vietnamita, hindi e outros) ficam sem texto. Na mensagem da Apple eles não mostram nada; no modal caem no en.

## 8. Remote Config

Chave nova `retention` dentro do parâmetro `utils`:

```json
"retention": {
  "enabled": true,
  "style": "sheet",
  "max_shows": 2,
  "reminder_hours": 24,
  "image_url": "https://…/retencao.png",
  "texts": {
    "pt": {"header": "…", "body": "…", "bullets": ["…"], "cta": "…", "dismiss": "…"},
    "en": {"header": "…", "body": "…"}
  }
}
```

- Entra como campo opcional no `RemoteConfigUtilsType`, então não quebra o typecheck dos apps.
- Sem a chave, vale o padrão que for decidido (seção 12), com os textos da lib.
- A imagem pode ser a mesma enviada à Apple (PNG de 3840 px de largura).
- Para gerar esse JSON pelo `docs/index.html`, ele entra na lista `FIELDS`.

## 9. Eventos do Analytics

| Evento | Parâmetros | Quando |
| --- | --- | --- |
| `retention_impression` | `style`, `product_id`, `hours_left`, `show_n` | modal exibido |
| `retention_click` | `action` (`reactivate` · `offer`), `show_n` | toque no botão principal ou na oferta |
| `retention_close` | `close_method` (`dismiss` · `swipe` · `back`), `show_n` | fechou sem reativar |
| `retention_recovered` | `hours_since_impression`, `via` | estado saiu de `trial_cancelled` para `trial` ou `active` depois de uma exibição |

- Tudo pelo `logUtilsEvent`, documentado no `docs/ANALYTICS-EVENTS.md`, com os parâmetros registrados como dimensão no GA4.
- No servidor, o `rc_cancellation` já chega pela integração do RevenueCat, e o webhook `UNCANCELLATION` confirma a reativação.
- Para medir o efeito: Firebase A/B Testing no parâmetro `retention` (metade vê o modal, metade não), olhando `retention_recovered` e a conversão do trial.

## 10. Mensagem da Apple no fluxo de cancelamento (sem código na lib)

1. **App Store Connect (recomendado para começar):** aberto a todos e sem servidor. Em cada app com trial: criar a mensagem (título, texto, imagem), ligar retention offers se quiser e configurar cada idioma.
2. **Tempo real pela RevenueCat (Lifecycle → Retention):** precisa do acesso pré-release da Apple, pedido pelo Account Holder. Tem o público "Is in free trial" e tradução automática; experimento A/B só nos planos Pro e Enterprise.
3. **Servidor próprio (Worker):** resposta em até 700 ms, e o payload da Apple não diz se o usuário está em trial. Com a RevenueCat disponível, não compensa.

O texto é a linha "Mensagem da Apple" da seção 7, com os mesmos limites e a mesma imagem. No Google, só pelo Early Access Program.

## 11. Fases

1. **Fase 1 (só JS, vai por OTA):**
   - detecção (seção 4) e regra de exibição (seção 5);
   - modal com "Reativar" (seção 6) nas 12 línguas (seção 7);
   - Remote Config (seção 8) e eventos (seção 9);
   - item "Simular trial cancelado" no menu de dev e testes.
2. **Em paralelo, sem código:** mensagem da Apple no App Store Connect (seção 10), em cada app com trial.
3. **Fase 2 (oferta dentro do modal):**
   - **iOS:** promotional offer pelo RevenueCat (`getPromotionalOffer` + `purchaseDiscountedPackage`). Segundo a Apple, todo cliente com assinatura atual ou vencida é elegível, e o período da oferta começa no próximo evento de cobrança, ou seja, depois do teste.
   - **Android:** oferta "developer determined". Recomprar o mesmo base plan antes de vencer gera um pedido de US$ 0,00 e mantém a data de cobrança original. Falta testar se o SDK do RevenueCat aceita isso sem `GoogleProductChangeInfo`.
   - **Opcional:** "por que cancelou?" com 4 ou 5 motivos, no evento `retention_reason`.
4. **Fase 3:**
   - **Push na hora do cancelamento:** webhook `CANCELLATION` do RevenueCat (`period_type: TRIAL`, `cancel_reason: UNSUBSCRIBE`) → Worker → FCM pelo token do customer (`fcm_token` / `$fcmTokens`). Alcança quem não abre mais o app; o tópico `-trial_cancelled` só muda com o app aberto.
   - **Win-back depois que o teste vence (`trial_expired`):** iOS 18+ (`getEligibleWinBackOffersForPackage`); no Android a função não retorna nada.

## 12. Decisões em aberto

- Ligado por padrão em todo app (texto genérico) ou só onde o Remote Config ligar.
- `is_opted_out_trial_enabled`: tirar o Premium na hora do cancelamento (como é hoje) ou manter até o fim do teste. Muda o texto (seção 7).
- Desconto e plano da oferta da fase 2, por app.
- Perguntar ou não o motivo do cancelamento.
- Mensagem da Apple pelo App Store Connect (sem servidor) ou pela RevenueCat em tempo real (com pedido de acesso).
- Línguas além das 12.
- Teste A/B para medir o efeito.
- Ok para começar.

## 13. Pré-requisitos por app (conferir no dashboard)

- No projeto do RevenueCat: notificações de servidor da Apple e RTDN da Google configuradas. Sem elas, a detecção leva horas.
- Produto com teste grátis.
- SDK do RevenueCat no mínimo na versão que a lib pede (`>=10.4.2`): o expo-divulgacand (9.5.4) e o expo-urna (9.10.1) estão abaixo.
- Para a mensagem da Apple: acesso ao App Store Connect de cada app.

## 14. Aceite (medido no destino)

- Lab com produto de trial de verdade no sandbox (sandbox da App Store e testador de licença da Play). Não verifiquei se a Test Store do RevenueCat, que o lab usa hoje, simula cancelamento de trial.
- Fluxo: iniciar o trial → cancelar no sistema → voltar ao app → modal → "Reativar" → reativar → `retention_recovered`.
- No destino:
  - customer no RevenueCat com `unsubscribe_detected_at` e os eventos de webhook `CANCELLATION` e `UNCANCELLATION`;
  - os 4 eventos no DebugView do GA4;
  - o tempo entre o cancelamento e o modal, medido.
- Print das 12 línguas no iOS e no Android, árabe incluído.
- Mensagem da Apple aparecendo no sandbox ou no TestFlight. A RevenueCat avisa que, no TestFlight, a tela de confirmação só aparece pelo botão de gerenciar assinatura dentro do app.

## 15. O que foi verificado e o que não foi

Conferido no código em 06/10/2026:

- A regra `trial_cancelled` em `utils/rc-status.ts`, o arquivo `tests/rc-status.test.ts` e o caminho boot/listener até o `syncRcStatus`.
- `PremiumUtils.getIsPremiumStatus()` tirando o Premium de quem cancelou, exceto com `is_opted_out_trial_enabled`.
- As 12 línguas do `utils/i18n.ts`.
- `fcm_token` e `$fcmTokens` gravados no customer (`utils/attribution.ts`).
- No `react-native-purchases` 10.10.1 do lab:
  - `showManageSubscriptions` lança erro no Android;
  - `invalidateCustomerInfoCache`, `managementURL`, `getPromotionalOffer`, `purchaseDiscountedPackage` e as funções de win-back existem.
- Versões do `react-native-purchases` nos apps locais: de 9.5.4 a 10.10.2.

Lido nas docs oficiais em 06/10/2026 (fontes abaixo): os dois modos da Apple e os limites da mensagem; o atraso do RevenueCat sem notificações de servidor; o cache de 5 minutos; o Early Access da Google; o "Resubscribe"; a elegibilidade de promotional offer; os eventos de webhook.

Não verificado:

- Nada rodou em aparelho.
- Quanto tempo o `unsubscribeDetectedAt` leva com as notificações de servidor ligadas.
- Se a folha de assinaturas aberta pelo app muda o AppState no iOS.
- Se a folha aberta pelo app mostra a mensagem da Apple (a RevenueCat diz que sim no TestFlight; a Apple não diz).
- Versão mínima de iOS do modo App Store Connect.
- Se o SDK do RevenueCat aceita recomprar o mesmo base plan no Android.
- Prazo de revisão das mensagens pela Apple.
- Os códigos de idioma da tabela da seção 7.

## 16. Ao implementar

- Regras do AGENTS.md na mesma tarefa:
  - README;
  - playbook `docs/UPGRADE-EXPO57-EXPO-UTILS.md` (chave nova `retention` e eventos novos);
  - `docs/ANALYTICS-EVENTS.md`;
  - `utils/types.ts`;
  - `index.ts` e `index.d.ts`, se algo virar público;
  - `docs/index.html`, se o gerador ganhar o `retention`;
  - CLAUDE.md.
- Testes em `tests/` (bun): decisão de exibir (estado, deduplicação, lembrete, limite, teste vencido), escolha do texto (Remote Config → padrão da língua → en), `{data}` por idioma e os limites de 66 e 144 nas 12 línguas.
- Todo evento pelo `logUtilsEvent`; imports no topo; nada no caminho crítico dependendo de `setTimeout`.

## Fontes

Apple:
- Retention Messaging API: https://developer.apple.com/documentation/retentionmessaging
- Setting up retention messages: https://developer.apple.com/documentation/retentionmessaging/setting-up-retention-messages
- Upload Message: https://developer.apple.com/documentation/retentionmessaging/upload-message
- Upload Image: https://developer.apple.com/documentation/retentionmessaging/upload-image
- Configure Default Message: https://developer.apple.com/documentation/retentionmessaging/configure-default-message
- Endpoint em tempo real: https://developer.apple.com/documentation/retentionmessaging/setting-up-retention-messaging-endpoint
- WWDC26, sessão 309: https://developer.apple.com/videos/play/wwdc2026/309/
- What's New (App Store): https://developer.apple.com/app-store/whats-new/
- notificationType (App Store Server Notifications): https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
- Promotional offers: https://developer.apple.com/documentation/storekit/implementing-promotional-offers-in-your-app
- showManageSubscriptions(in:): https://developer.apple.com/documentation/storekit/appstore/showmanagesubscriptions(in:)

RevenueCat:
- Apple Retention Messaging API: https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-retention-messaging-api
- Customer info (`unsubscribeDetectedAt`, cache): https://www.revenuecat.com/docs/customers/customer-info
- Notificações de servidor da Apple: https://www.revenuecat.com/docs/platform-resources/server-notifications/apple-server-notifications
- Notificações de servidor da Google: https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications
- Webhooks: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
- Customer Center: https://www.revenuecat.com/docs/tools/customer-center

Google:
- Blog de 29/09/2026 (Retention Offers no Early Access): https://android-developers.googleblog.com/2026/09/unlocking-Google-play-subscription-growth.html
- Subscription lifecycle (restore, recompra): https://developer.android.com/google/play/billing/lifecycle/subscriptions
- RTDN: https://developer.android.com/google/play/billing/rtdn-reference
- purchases.subscriptionsv2: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
