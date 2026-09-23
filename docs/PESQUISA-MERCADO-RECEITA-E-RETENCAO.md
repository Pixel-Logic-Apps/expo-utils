**Pesquisa de mercado: receita, recuperação e componentes para o expo-utils**

Pesquisa realizada em 23/09/2026. Base local: expo-utils 1.4.0.

Esta pesquisa substitui a priorização do [plano anterior](PLANO-RECEITA-E-DADOS.md). Os componentes e contratos abaixo são propostas, exceto a instrumentação das 60 faixas Taichi da seção D, implementada posteriormente em `utils/ad-revenue.ts`. O contrato atual está no [catálogo de analytics](ANALYTICS-EVENTS.md#taichi). Os 60 nomes foram vistos no DebugView a partir de um build Android do laboratório, com receitas sintéticas; [evidências e limites da validação](VALIDACAO-TAICHI.md). A importação no Google Ads não foi medida.

**Recomendação**

Evoluir o expo-utils para executar ações comerciais a partir de intenção, benefício recebido, estado da assinatura e valor econômico do usuário. O app host informa qual tarefa a pessoa queria fazer; a biblioteca oferece os componentes e aplica regras consistentes; um backend acompanha o que acontece quando o app está fechado.

As primeiras apostas seriam: recuperação da tarefa interrompida, ativação durante o trial, recuperação de pagamento e decisão entre monetizar com anúncios ou assinatura. Recuperação por desconto e quick actions entram como experimentos específicos. A pesquisa não permite prometer um percentual de aumento para o portfólio.

**Como a evidência foi avaliada**

- **Experimento acadêmico:** comparação com controle; mais forte para causalidade no contexto estudado. A transferência para estes apps continua sendo hipótese.
- **Caso comercial com teste:** empresa ou fornecedor relata uma comparação; geralmente faltam dados brutos, intervalos de confiança e protocolo completo.
- **Benchmark observacional:** descreve o mercado; seleção de clientes, categoria e audiência podem explicar diferenças.
- **Relato de operador:** útil para formular mecanismos e testes; faturamento atribuído não comprova receita adicional.
- **Documentação técnica:** comprova capacidades e restrições da plataforma, não eficácia comercial.

Vídeos e podcasts foram analisados por suas transcrições publicadas, incluindo demonstrações e entrevistas. Não houve inspeção audiovisual integral nem acesso aos dados privados dos operadores. Conteúdos antigos foram usados para mecanismos de negócio; capacidades atuais foram conferidas em documentação oficial.

**1. O que os resultados publicados realmente sustentam**

| Fonte | Evidência encontrada | Limite e consequência para o plano |
| --- | --- | --- |
| [Li, Luo, Lu e Moriguchi — retargeting, Journal of Marketing, 2021](https://journals.sagepub.com/doi/abs/10.1177/0022242920959043), com [texto integral consultado](https://ximarketing.github.io/class/papers/retargeting.pdf) | Experimentos com mais de 40.500 clientes no estudo 1 e 23.900 no estudo 2. Lembretes em 30–60 minutos prejudicaram compras em condições estudadas; contatos em 1–3 dias tiveram efeitos positivos. | Não significa que 24 horas seja o melhor horário para qualquer app. No estudo 1, a comparação causal é tratamento versus controle dentro de cada horário. A lição é testar timing contra ausência de contato. |
| [Moriguchi, Xiong e Luo — ICIS 2022](https://aisel.aisnet.org/icis2022/digital_commerce/digital_commerce/4/) | Experimentos de recuperação de carrinho: mensagens explicando devolução superaram lembretes de produto; o resumo reporta receita líquida 49,7% maior que a alternativa com informação de produto. | O resultado é de varejo físico online. A hipótese transferível é resolver a objeção de risco; não prometer reembolso que a loja de apps não garante. Texto integral indisponível na consulta; avaliação limitada ao resumo dos autores. |
| [Zhang e coautores — experimento no Alibaba, Management Science, 2020](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.2019.3316) | Mais de 100 milhões de clientes e 11 mil lojistas. Promoções aumentaram vendas imediatas, mas também alteraram comportamento posterior: mais adições ao carrinho e preços pagos menores. | Não autoriza concluir que descontos sempre destroem lucro. Justifica medir efeitos posteriores e evitar tornar fechar o paywall um caminho previsível para pagar menos. |
| [Yoganarasimhan, Barzegary e Pani — trials personalizados, preprint de 2020](https://arxiv.org/abs/2006.13420) | Usuários de um SaaS foram sorteados para 7, 14 ou 30 dias. Sete dias foi a melhor política uniforme naquele contexto. Políticas personalizadas foram avaliadas com estimadores sobre o experimento. | Contraponto a copiar benchmarks de trials longos. Ganho estimado de uma política por modelo não equivale a um novo experimento em produção. |
| [Baek e coautores — frequência de contato, working paper de 2026](https://www.columbia.edu/~wm2428/papers/customer_engagement.pdf) | Reduzir emails diários para dias alternados diminuiu descadastros em 59%, com queda de 5–8% em receita/compras de curto prazo no experimento. | Descadastro de email é uma aproximação de churn, não cancelamento de assinatura. Ganhos de valor futuro no artigo vêm de modelagem combinada com dados históricos. Sustenta testar frequência e observar efeitos posteriores. |
| [Wyze / Braze — onboarding do Cam Plus](https://www.braze.com/customers/wyze-case-study) | Caso comercial relata 56% mais conversões versus controle usando jornadas baseadas em uso, dispositivo e estado de assinatura. | Há controle declarado, mas não protocolo estatístico completo. Evidência relevante para orientação durante o trial; não é previsão de 56% para expo-utils. |
| [Splice / Braze — Content Cards](https://www.braze.com/customers/splice-adds-new-channels-to-lift-conversions-by-64x) | Teste de duas variantes de card durante uma semana: a educativa venceu, com aumento relatado de 11% em trial → pago. | O chamativo “64x” do título compara outra iniciativa à média histórica de campanhas por email. Não é aumento de receita causado por adicionar um card. |
| [Mojo — relato de Michal Parizek](https://www.revenuecat.com/blog/growth/guide-to-mobile-paywalls-subscription-apps) | Ofertas para gratuitos antigos funcionaram melhor que descontos de saída e win-back no relato. Em um teste de Black Friday nos EUA, não oferecer promoção venceu. | Evidência contra tratar desconto imediato como receita garantida. Resultados do operador, sem base experimental pública completa. |
| [MySwimPro / RevenueCat](https://www.revenuecat.com/customers/myswimpro) | A migração para Customer Center manteve os resultados de recuperação relatados, reduziu solicitações de suporte e substituiu código próprio. | Apoia reaproveitar uma solução existente. Não demonstra aumento incremental de retenção causado pelo novo componente. |
| [Klaviyo — benchmarks 2026](https://www.klaviyo.com/products/email-marketing/benchmarks) | Base com mais de 183 mil clientes: fluxos automáticos respondem por aproximadamente 41% da receita atribuída ao email, com 5,3% dos envios. | São públicos com intenção diferente e receita atribuída pela plataforma. Não significa que automatizar gere 41% de receita adicional. |
| [RevenueCat — State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps) | Mais de 115 mil apps, métricas principalmente de 2025. O recorte detalhado atribui aproximadamente um terço dos cancelamentos no Google Play a falhas de cobrança. A reativação anual reportada é de cerca de 5% em até 12 meses. | São apps que usam RevenueCat e atendem aos filtros do relatório. Esses dados priorizam investigação; não revelam a composição deste portfólio. Cinco por cento em um ano não significa “95% nunca voltarão”. |
| [Rocket Game Studio / TikTok e Pangle](https://ads.tiktok.com/business/en/inspiration/rocketgamestudio-pangle-IAA-VBO-case-study) | Caso de aquisição otimizada pelo valor de anúncios e compras em D7, incluindo Brasil. | O “+60% ROAS” é versus o KPI do cliente, não um experimento aleatório nem necessariamente melhora sobre a campanha anterior. Apoia explorar sinal de valor; não usar o número como promessa. |

**2. Pessoas de e-commerce e dropshipping: o que aproveitar**

| Conteúdo analisado | Ideia aproveitável | O que não copiar automaticamente |
| --- | --- | --- |
| [Drew Sanocki — Nerd Marketing, episódio 25](https://www.nerdmarketing.com/25-make-money-win-back-campaign/), transcrição da demonstração; 01:30 sequência, 03:15 testes | Ofertas progressivas baseadas no ciclo de recompra, com saída da sequência quando a pessoa compra. | Os intervalos 30/60/90 dias e descontos do exemplo não são parâmetros validados para utilitários móveis. Testar duas ofertas também não mede, sozinho, o ganho sobre não enviar nenhuma. |
| [Drew Sanocki e Zak Cassady-Dorion — 27/05/2025](https://www.postpilot.com/podcast-episode/retention-profitable-channel), [vídeo](https://www.youtube.com/watch?v=BgVCwtZk3Hw) e transcrição | Recuperação conforme sazonalidade/produto e uso de grupo sem campanha para medir incremento. | A entrevista promove serviços dos participantes. Relatos de retorno comercial não são garantia. Não transportar a frequência de dezenas de emails mensais para pushes do app. |
| [Ezra Firestone e Kurt Elster — 13/10/2020](https://unofficialshopifypodcast.com/episodes/ezra-firestone-bfcm2020-LrEw0L3o/transcript), transcrição consultada nos trechos de ofertas e segmentação | Segunda compra, complementos do produto já adquirido, relançamento de produto melhorado e comunicação consistente entre canais. | Estoque, entrega e recompra de cosméticos diferem de software. Não simular escassez de produto digital nem cobrar um upsell sem confirmação da loja. |
| [Anton Kraly — Drop Ship Lifestyle](https://www.dropshiplifestyle.com/email-marketing-for-high-ticket-ecommerce/), artigo de 2025 | Recuperar esclarecendo garantia, adequação e dúvidas; separar quem pesquisa de quem está perto de comprar. | A recomendação de primeiro contato em uma hora entra em tensão com o estudo de retargeting. É uma hipótese do operador, não um prazo universal. |
| [Bruno de Oliveira — Ecommerce na Prática](https://ecommercenapratica.com/blog/estrategia-aumentou-vendas-loja-virtual/?p=809), atualização de 10/08/2022 | Atuar no abandono com intenção de compra e oferecer continuidade do relacionamento antes do cadastro. | O caso não publica controle. Movimento do mouse rumo à saída do navegador não equivale a intenção de desinstalar um app. |
| [Anmol Tiwari — Duolingo / Sub Club, 2026](https://subclub.com/episode/how-clarity-and-personalization-help-drive-duolingos-growth-anmol-tiwari-duolingo), transcrição da entrevista | Relata testes de lembrete escolhido pelo usuário, amostras de funcionalidades e personalização da proporção entre anúncio externo e promoção da assinatura. | Sem percentuais ou protocolo público para essas mudanças. A capacidade de repetir ofertas precisa ser validada por loja; não se pode simplesmente reiniciar a elegibilidade do trial. |

Os operadores ajudam a descobrir mecanismos. Os estudos e controles ajudam a decidir quais mecanismos merecem investimento. As propostas a seguir são adaptações próprias ao expo-utils, não componentes cuja eficácia já foi demonstrada nesses estudos.

**3. Componentes e jornadas que eu proporia**

**A. Recuperar a tarefa que ficou parada**

Proposta: `ResumeTaskCard` + `PurchaseRecoveryFlow`.

Guardar a intenção concreta: recurso desejado, plano considerado e referência ao trabalho salvo. Exemplo: a pessoa preparou um arquivo, chegou à exportação premium e saiu. No retorno, mostrar “Seu arquivo está pronto. Continuar exportação”, levando ao ponto certo. A oferta pode explicar a limitação ou apresentar uma opção de uso pontual.

Separar abandono do resultado, fechamento do paywall, cancelamento da folha de compra, erro técnico e compra pendente. Cada um pede uma ação diferente. A referência acadêmica é recuperação conforme estágio e objeção; salvar/retomar a tarefa é a adaptação proposta.

Teste: continuidade contextual versus experiência atual, sem desconto inicial. Medir tarefas concluídas e receita líquida D30 por usuário elegível. Contato fora do app exige canal disponível, horário testado e checagem de compra antes do envio.

**B. Mostrar o próximo benefício durante o trial**

Proposta: `TrialCoachCard` + `ValueReceipt`.

Dividir trial iniciado sem resultado, trial com primeiro resultado e trial com uso repetido. O primeiro recebe ajuda para concluir a tarefa; o segundo, um próximo uso relevante; o terceiro, um resumo verificável do que já recebeu. Exemplo: “Você exportou 4 arquivos; seu plano inclui exportação em lote”. Não inventar tempo economizado.

Os casos Wyze e Splice sustentam testar orientação contextual. Esta implementação precisa do app host para informar o que conta como benefício; abrir tela não basta.

Teste: conversão paga e primeira renovação por entrada na jornada. Observar reembolsos e receita D60, evitando declarar vitória apenas porque houve mais trials.

**C. Reduzir o medo de iniciar o trial**

Proposta: `TrialTimeline` + `TrialReminderPicker`.

Explicar duração, próxima cobrança, preço real e caminho de gerenciamento. Permitir escolher quando receber lembrete e manter o estado visível dentro do app. Se a renovação estiver desligada, mostrar a data de fim do acesso e deixar claro que aquele trial não está programado para converter enquanto permanecer cancelado.

O [caso Blinkist](https://www.purchasely.com/blog/blinkist-paywall-transformation-revolutionizes-app-user-engagement) reporta +23% na entrada no trial; não +23% de receita. A [publicação original de Jaycee Day](https://uxplanet.org/how-solving-our-biggest-customer-complaint-at-blinkist-led-to-a-23-increase-in-conversion-b60ad514134b) foi localizada, mas o texto integral exige assinatura; os resultados detalhados foram consultados no relato público da Purchasely. A escolha do lembrete também aparece na entrevista do Duolingo.

Teste: pagantes D35 por usuário exposto ao paywall, além da entrada no trial, cancelamentos e reembolsos. Prometer lembrete exige confirmar o agendamento e explicar a disponibilidade do canal.

**D. Decidir entre anúncio, amostra e assinatura**

Proposta: `MonetizationDecision` + `FeaturePreview` + `MonetizationChoiceSheet`.

O sinal Taichi trazido pelo usuário deve ser combinado com receita observada, dias ativos e intenção de compra. Começar com regras legíveis, sem depender de um modelo de IA:

| Sinal observado | Variante a testar |
| --- | --- |
| Receita alta de ads, uso recorrente e pouca intenção de pagar | Preservar o fluxo de anúncios; reduzir pressão comercial |
| Tentativas recorrentes de uma função premium | Demonstração dessa função e oferta contextual |
| Uso intenso, fechamento repetido do paywall e interesse declarado em uso pontual | Opção por tarefa/créditos, quando o catálogo permitir |
| Trial ativo sem benefício recebido | Orientação para uso, antes de nova promoção |
| Falha de cobrança confirmada | Recuperação do pagamento |

Uma amostra libera um uso real ou um período explicitamente gratuito, sem iniciar uma assinatura. Para funções caras, a quantidade precisa respeitar custo e controle no servidor. Para apps sem valor recorrente suficiente, a amostra pode atender toda a necessidade e reduzir compras: testar esse efeito.

O objetivo é aumentar a soma de ads e compras, descontando custos. O exemplo do Duolingo inspira a escolha entre superfícies; estas regras e seus limiares são hipóteses próprias. Contagem alta de anúncios não garante receita alta.

**Faixas Taichi de receita acumulada — instrumentação para ARPU baixo**

O usuário informou que o ARPU no Brasil é baixo. Sem dados dos apps e sem a janela desse ARPU, não há base para usar US$ 0,05 como primeiro corte. A grade implementada começa em frações de centavo e concentra 12 dos 20 limites abaixo de US$ 0,01. Os valores abaixo são candidatos para testes de aquisição; não são benchmarks brasileiros nem limites com eficácia de aquisição comprovada.

Cada combinação de valor e prazo gera um evento próprio no app, via `logUtilsEvent`. Parâmetros podem registrar contexto, mas a conversão não depende de um filtro de parâmetro no Google Ads. O nome fixa moeda, limite e janela; alterar algum deles exige outro nome.

| Receita acumulada de anúncios (USD) | Evento para atingir o limite nas primeiras 24h |
| --- | --- |
| 0,0001 | `taichi_rev_0_0001usd_24h` |
| 0,0002 | `taichi_rev_0_0002usd_24h` |
| 0,0003 | `taichi_rev_0_0003usd_24h` |
| 0,0005 | `taichi_rev_0_0005usd_24h` |
| 0,00075 | `taichi_rev_0_00075usd_24h` |
| 0,001 | `taichi_rev_0_001usd_24h` |
| 0,0015 | `taichi_rev_0_0015usd_24h` |
| 0,002 | `taichi_rev_0_002usd_24h` |
| 0,003 | `taichi_rev_0_003usd_24h` |
| 0,004 | `taichi_rev_0_004usd_24h` |
| 0,005 | `taichi_rev_0_005usd_24h` |
| 0,0075 | `taichi_rev_0_0075usd_24h` |
| 0,01 | `taichi_rev_0_01usd_24h` |
| 0,015 | `taichi_rev_0_015usd_24h` |
| 0,02 | `taichi_rev_0_02usd_24h` |
| 0,03 | `taichi_rev_0_03usd_24h` |
| 0,05 | `taichi_rev_0_05usd_24h` |
| 0,075 | `taichi_rev_0_075usd_24h` |
| 0,10 | `taichi_rev_0_10usd_24h` |
| 0,25 | `taichi_rev_0_25usd_24h` |

As mesmas faixas existem para `_72h` e `_7d`: 60 nomes nesta família. `utils.taichi_events` ausente habilita todos, `[]` desliga as emissões e uma lista seleciona os nomes; isso não significa importar 60 metas primárias ou testar 60 campanhas. As três janelas começam no primeiro uso da instalação rastreada; `_7d` significa 168 horas. Usuários com `@first_open_logged` já presente e sem estado Taichi são excluídos. Apps antigos sem esse marcador precisam identificar sua base existente antes do boot, conforme o [playbook de migração](UPGRADE-EXPO57-EXPO-UTILS.md#taichi).

O acumulador usa os valores válidos de `PAID`/`onPaid`, com moeda USD confirmada, guardados entre sessões. O SDK pode informar receita estimada: preservar a precisão e não tratar ausência de valor/moeda como receita conhecida. No SDK React Native local inspecionado, `value` já está em unidades da moeda, inclusive no Android; não dividir por um milhão novamente. O acumulador e o envio dos marcos ficam em `utils/ad-revenue.ts`, iniciado por `Utils.prepare`. [Receita por impressão no AdMob](https://developers.google.com/admob/android/impression-level-ad-revenue).

Cada marco habilitado é emitido uma vez por instalação ao cruzar o limite dentro do prazo. Persistir os marcos emitidos e o acumulado, processar atualizações em sequência e evitar duplicações de callbacks sem eliminar impressões reais de refresh de banner. Se uma impressão atravessar vários limites, emitir os marcos habilitados ainda não emitidos. Esses eventos são qualificações para contagem/tCPA: não copiar a receita acumulada para o valor de cada marco e depois somar tudo. A medição monetária mantém uma fonte canônica sem duplicação; o caminho nativo de tROAS para receita de publicidade usa `ad_impression`. [Google Ads: tROAS para receita de publicidade](https://support.google.com/google-ads/answer/13799577?hl=pt-BR).

Selecionar o objetivo com a distribuição observada, não apenas com o ARPU médio. Para cada app, plataforma e mercado, medir a porcentagem de instalações que cruza cada corte, o número de usuários distintos por dia, o tempo até cruzar e a receita posterior D7/D30. Incluir instalações com zero receita observada no denominador e separar falhas conhecidas de coleta de zeros válidos. Comparações entre faixas são descritivas; testar a campanha é que permite avaliar a mudança de aquisição.

Um limite muito baixo pode ser atingido por quase todos na primeira impressão, oferecendo pouca distinção de valor; um limite alto pode produzir poucos sinais. O Google orienta escolher uma ação concluída por pelo menos dez usuários distintos por dia na campanha — referência de volume, não garantia de resultado. [Configuração conforme a meta](https://support.google.com/google-ads/answer/6167156?hl=pt-BR). O [exemplo de percentis do Firebase](https://firebase.google.com/codelabs/ios_skancv), publicado para SKAdNetwork, fundamenta calcular faixas a partir da distribuição, mas não valida os valores nem estes eventos Taichi.

Instrumentação implementada com testes locais e documentação de analytics/migração. Em 23/09/2026, os 60 eventos chegaram ao DebugView de `local-desenv` a partir do build Android do laboratório, cada um com contagem 1 após repetição de callback e reabertura. Os limites foram exercitados com receitas sintéticas; o anúncio com ID de teste retornou USD/zero. [Evidências](VALIDACAO-TAICHI.md). Receita positiva de produção, iOS, importação no Google Ads e impacto nas campanhas não foram medidos. Os eventos de percentis, recorrência e contagem de anúncios discutidos separadamente não fazem parte desta implementação das faixas de receita.

**E. Vender uma solução pontual para quem rejeita recorrência**

Proposta: `UsagePassOffer`.

Depois de intenção real e recusa do compromisso recorrente, experimentar pacote de tarefas, compra de uma função ou outro produto de uso pontual. Exemplo: “Preciso só destas 3 exportações” não é necessariamente objeção ao preço anual: pode ser objeção ao modelo de cobrança.

É uma tradução do downsell de e-commerce. Não há nesta pesquisa um resultado causal que valide essa oferta para o portfólio. Produtos, validade, saldo e restauração precisam existir de verdade; um botão com outro preço não cria um produto válido na loja.

Teste: receita líquida D60 de todos os elegíveis, incluindo eventual redução de assinaturas e ads. Não oferecer indiscriminadamente aos usuários com alta propensão a assinar.

**F. Recuperar conforme o motivo do cancelamento**

Proposta: `SubscriptionCenter` + `CancellationReasonSheet`.

| Motivo declarado ou evento confirmado | Alternativa proposta |
| --- | --- |
| Preço | Plano menor, uso pontual ou oferta elegível |
| Não conseguiu usar | Retomar configuração/tarefa e oferecer ajuda |
| Só precisava uma vez | Encerrar com clareza; opção futura por tarefa |
| Recurso ausente | Registrar interesse e avisar quando existir |
| Erro técnico | Suporte com contexto e convite após a correção |
| Medo da cobrança | Explicar datas e controles; sem religar renovação automaticamente |
| Pagamento recusado | Corrigir pagamento, sem classificar como rejeição do produto |

Pergunta opcional, com continuação direta para gerenciar/cancelar. O relato MySwimPro favorece avaliar uma integração com RevenueCat Customer Center antes de reconstruir toda a interface. Uma oferta de retenção só pode usar produtos e elegibilidade reais.

Teste: receita líquida e permanência depois de um ciclo de cobrança. Aceitar uma oferta ou fechar a tela de cancelamento não comprova assinatura recuperada.

**G. Recuperar falha de cobrança**

Proposta: `BillingRecoveryBanner`.

Separar cancelamento voluntário de cartão recusado, período de carência e suspensão. Mostrar uma ação para resolver o pagamento na loja e retirar o banner quando a situação se normalizar. Não oferecer cupom a quem já queria continuar pagando.

O [Google Play documenta](https://developer.android.com/google/play/billing/lifecycle/subscriptions) mensagens e link para correção do método de pagamento. O wrapper e a versão nativa do app host precisam ser conferidos antes da implementação. Manter o acesso conforme o entitlement, inclusive durante carência quando aplicável.

Teste: receita recuperada acima das tentativas automáticas e mensagens padrão da loja, com grupo que mantém o tratamento atual. O sinal de sucesso é renovação confirmada, não clique no banner.

**H. Avisar quando o motivo da saída deixou de existir**

Proposta: `FeatureInterestCapture` + `ReturnForFeatureCard`.

O equivalente móvel do aviso de reposição de estoque: “Avise quando tiver exportação em lote”. Registrar recurso, motivo e canal permitido. Quando o recurso realmente chegar, convidar a pessoa para experimentá-lo com link direto. Para falha técnica, usar a versão que corrigiu o problema.

É uma adaptação dos relatos de relançamento e educação do produto. Tem um motivo de retorno mais concreto que um cupom genérico, mas o ganho ainda precisa ser demonstrado.

Teste: retorno, uso da função e receita entre todos os interessados elegíveis. Não atribuir todo retorno natural ao aviso.

**I. Recuperar quando a necessidade reaparecer**

Proposta: `NextUseReminder` + `ResumeContext`.

Para utilitários sazonais, pedir uma data ou ocasião útil: “Quando vai precisar preparar outro arquivo?” ou “Lembrar antes do próximo evento?”. Preservar preferências e trabalho permitido para facilitar a volta.

A entrevista de Zak e Drew inspira vincular a recuperação ao ciclo do produto. Os intervalos dependem do app e podem ser declarados pelo usuário; ausência de uso diário não significa insatisfação em um utilitário ocasional.

Teste: retorno e receita na janela da próxima necessidade. Não usar retenção diária como única métrica de sucesso desse fluxo.

**J. Oferecer o próximo produto depois do resultado**

Proposta: `NextUsefulActionCard`, reaproveitando `CrossPromoCard` quando houver outro app adequado.

Depois de concluir a tarefa, oferecer o complemento concreto. Exemplo: quem acabou de digitalizar pode precisar organizar/assinar, e quem produziu um resultado pode querer processamento em lote. A proposta adapta segunda compra e cross-sell dos operadores de e-commerce.

O critério é utilidade complementar, com continuidade do contexto quando possível. Um upsell dentro do app usa a confirmação normal da loja. Cross-promo entre apps só conta como resultado comercial quando houver atribuição adequada no destino; clique é uma etapa intermediária.

Teste: receita total dos usuários sorteados, incluindo efeitos no app de origem. Sem identidade comum, usar atribuição por campanha/coorte e explicitar a cobertura.

**K. Quick actions de recuperação**

Proposta do usuário, a experimentar: `RecoveryQuickActions`.

Atalhos como “Continuar tarefa”, “Resolver um problema” e “Minha assinatura”, definidos conforme o último estado conhecido. Ofertas só quando elegíveis. O texto deve descrever a ação real e abrir a tela correspondente.

A [API da Apple](https://developer.apple.com/documentation/uikit/add-home-screen-quick-actions) oferece atalhos no menu do ícone. Isso não é um callback de intenção de desinstalar. No Android, o pacote removido [não recebe o próprio evento de remoção](https://developer.android.com/reference/android/content/Intent#ACTION_PACKAGE_REMOVED). Não encontrei, no material revisado, evidência controlada convincente de redução de desinstalação por esse recurso.

Teste de prioridade secundária: retorno e receita por todos os usuários sorteados para receber os atalhos. Não criar uma métrica “desinstalações evitadas” contando apenas quem clicou.

**L. Manter ofertas úteis acessíveis e controlar a pressão**

Proposta: `LifecycleCard` + `OfferInbox` + histórico de ofertas.

Um espaço persistente para orientação, tarefa pendente ou oferta válida pode ser mais adequado que várias interrupções. O caso Splice justifica testar cards educativos. Cada card tem motivo, validade e ação; some quando deixa de fazer sentido.

Um coordenador impede que promoção, avaliação, cross-promo e paywall apareçam juntos. Guarda ofertas vistas, rejeitadas e aceitas, limites de contato e período sem reapresentação. Ofertas não devem reiniciar um prazo fictício a cada abertura. O estudo de frequência sustenta medir a troca entre receita imediata e fadiga.

Teste: receita D30/D60, uso e desativação dos canais de comunicação. Testar diferentes limites; não declarar uma frequência universal.

**4. Os dados necessários para essas ações**

Um rótulo único como `trial` ou `cancelled` não descreve a situação completa. O modelo proposto separa:

| Dimensão | Exemplos de estado |
| --- | --- |
| Acesso | Ativo, expirado, desconhecido; data de validade e fonte |
| Fase comercial | Gratuito, trial, introdutório, pago, compra avulsa |
| Renovação | Ligada, desligada, não aplicável, desconhecida |
| Cobrança | Normal, carência, suspensão, problema, reembolso confirmado |
| Ativação | Sem resultado, primeiro resultado, repetição da tarefa |
| Intenção | Recurso desejado, plano considerado, compra pendente, motivo declarado |
| Valor observado | Receita de ads e compras por janela, moeda, precisão e custo variável disponível |
| Comunicação | Canais disponíveis, última exposição, recusas, próxima ação e motivo |

Segmentos derivados: trial ativo sem ativação; trial ativo com renovação desligada; trial encerrado sem pagamento; pagante com renovação desligada; cobrança em recuperação; gratuito recorrente de alto valor em ads. Esses segmentos podem se sobrepor em dimensões diferentes e não devem alterar o direito de acesso por si mesmos.

Cancelamento da folha de compra não é cancelamento do trial. Desligar renovação não implica expiração imediata. Uma compra pendente também não deve cair em recuperação por desconto.

No código atual, [Utils.getRevenueCatStatus](../utils/Utils.ts) retorna `trial` antes de examinar renovação/cancelamento. Portanto, esse rótulo sozinho não separa o trial ativo que renovará daquele que já teve renovação desligada. [PremiumUtils](../utils/PremiumUtils.ts) também condiciona o acesso a `willRenew`, salvo a exceção por flag. São regras existentes identificadas por leitura; a mudança exige decisão de contrato e migração, sem presumir resultados financeiros.

O [RevenueCat documenta os eventos de ciclo da assinatura](https://www.revenuecat.com/docs/integrations/webhooks/event-flows). A proposta usa confirmação do serviço para acompanhar cancelamentos/renovações fora do app; cliques e callbacks locais registram intenção e experiência.

**Controle operacional proposto: `LifecycleInspector`**

Uma tela administrativa deve permitir abrir um usuário e entender:

- Qual tarefa tentou, qual resultado recebeu e onde parou.
- Qual estado veio da loja e quando foi atualizado.
- Em quais segmentos entrou e por qual regra.
- Qual card, oferta ou mensagem recebeu; qual foi suprimida e por quê.
- Qual variante experimental recebeu, mantendo a atribuição estável.
- Quanto gerou em cada fonte e quais valores ainda são estimativas.
- Qual é a próxima ação e como suspender a jornada.

Isso exige histórico exportável de decisões e estados, não apenas um painel de totais. Manter IDs de app, usuário, jornada, regra, oferta e variante relacionados. IDs anônimos de apps diferentes não identificam automaticamente a mesma pessoa.

**5. Onde cada parte deve rodar**

| Parte | Responsabilidade |
| --- | --- |
| expo-utils | Componentes, hooks, avaliação local de regras, prioridade de superfícies, registro de exposições, integração com compras/ads, navegação por ação |
| App host | Definir benefício, tarefa, conteúdo, referência salva, custos e catálogo comercial |
| Backend/automação | Webhooks, histórico durável, ofertas elegíveis, agendamento, supressão após compra, envio por canal e grupos de controle |
| Lojas e serviços existentes | Cobrança, entitlements, elegibilidade, meios de pagamento e entrega nos canais |

Já existem pontos de apoio em [PaywallUtils](../utils/PaywallUtils.ts), [ad-revenue](../utils/ad-revenue.ts), [push-analytics](../utils/push-analytics.ts), atribuição e Remote Config. O que falta para a proposta é ligá-los às decisões e aos resultados do usuário.

Amostras gratuitas não devem fingir uma transação da loja. Uma oferta nativa de win-back da Apple possui [critérios de período pago e tempo desde a assinatura](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-win-back-offers); não serve automaticamente para alguém que acabou de cancelar seu primeiro trial sem pagar.

Mensagens que dependem de estado futuro não podem depender de um timer JS nem de o usuário reabrir o app. Após receber a mensagem ou tocar num atalho, revalidar acesso e oferta; o estado pode ter mudado.

Para aquisição, o [Google documenta tROAS por receita de anúncios e monetização híbrida](https://support.google.com/google-ads/answer/13799577?hl=en). O sinal econômico precisa chegar ao destino aceito pela campanha; gravar um evento com nome “Taichi” não ativa essa capacidade. A [coleta de ad_impression pode ser automática na integração AdMob/Firebase](https://firebase.google.com/docs/analytics/measure-ad-revenue): evitar somá-la novamente como outra receita junto ao evento próprio `ad_revenue`.

Não foi verificada entrega real em dashboards, compatibilidade dos wrappers para novas integrações ou desempenho de builds. Esses itens são critérios do piloto, não conclusões desta pesquisa.

**6. Ordem recomendada de investimento**

| Ordem | Entrega concreta | Condição que justifica prioridade |
| --- | --- | --- |
| 1 | Estado de assinatura separado por dimensões + histórico mínimo de intenção/benefício | Necessário para não enviar recuperação errada; acompanhar um usuário real de ponta a ponta |
| 2A — apps com receita principalmente de ads | Sinal de valor por usuário + teste de anúncio versus oferta contextual | A base já monetiza sem comprar; medir a troca econômica |
| 2B — apps com receita principalmente de assinatura | TrialCoach/Timeline + recuperação de cobrança | Trial sem benefício e falha de pagamento oferecem mecanismos claros de intervenção |
| 3 | Recuperação da tarefa e objeção, sem desconto automático | Há intenções de compra/tarefas interrompidas em volume relevante |
| 4 | Motivos de cancelamento + Customer Center/alternativas; oferta por uso | Há motivos observados que essas alternativas resolvem |
| 5 | Retorno por recurso lançado, próxima necessidade e cross-sell contextual | Há gatilho real e produtos complementares |
| 6 | Quick actions e incentivos progressivos | Experimentos pequenos, após medir elegibilidade e evitar conflito com os demais fluxos |

Não é necessário construir todo o catálogo antes de medir. Um piloto usa um app, uma jornada, um controle e os componentes estritamente necessários. Escolher a trilha com o tamanho de oportunidade medido no próprio portfólio. A pesquisa não traz volume, receita ou custo dos seus apps para estimar um ROI responsável.

**7. Como uma ideia passa de plausível para boa**

Antes do teste, definir quem é elegível, resultado primário, janela, efeito mínimo relevante e tamanho de amostra compatível. Sortear por usuário antes da intervenção e preservar a variante. Com pouco tráfego, testar uma pergunta por vez; ausência de significância não prova ausência de efeito.

Comparar todos os elegíveis, incluindo quem ignorou a mensagem. Um grupo fica com a experiência atual; outro recebe a intervenção. Para medir se vale fazer a recuperação, o controle não pode receber outra recuperação equivalente por um canal paralelo. Para medir só uma peça, manter as demais exposições comparáveis.

O resultado principal proposto é a diferença de receita ajustada ou margem por usuário elegível entre variantes, na mesma janela. Incluir ads, compras, descontos, taxas, reembolsos e custos variáveis sem deduzir itens duas vezes. Observar renovação depois do desconto e distinguir receita antecipada de aumento do valor total.

| Teste inicial | Comparação | Resultado principal |
| --- | --- | --- |
| Recuperar tarefa | Card contextual versus fluxo atual | Receita D30 e tarefas concluídas |
| Ativar trial | Próxima ação relevante versus orientação atual | Conversão paga e primeira renovação |
| Orientar cobrança | Banner adicional versus recuperação padrão da loja | Receita paga recuperada |
| Ads versus promoção própria | Regra de escolha versus política atual | Ads + compras ajustados D30/D60 |
| Oferta de uso pontual | Alternativa elegível versus catálogo atual | Receita D60, contando possível perda de assinaturas |
| Quick action | Atalhos de recuperação versus atalhos atuais/ausência | Retorno e receita por todos os sorteados |

Interromper jornadas quando perderem elegibilidade, após compra confirmada ou conforme a preferência de contato. Registrar também “nenhuma ação” e o motivo. Nenhum percentual de fornecedor deve virar meta contratada para este código.

Esta tarefa produziu pesquisa e propostas. Uma futura implementação que altere API, eventos, Remote Config, boot ou premium deverá atualizar `index.d.ts`, o catálogo de analytics e o playbook de upgrade conforme as regras do repositório.
