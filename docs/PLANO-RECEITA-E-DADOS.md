**Plano de receita e controle de dados do expo-utils**

**Revisão de 23/09/2026:** a priorização deste rascunho foi substituída pela [pesquisa de mercado e propostas de receita/recuperação](PESQUISA-MERCADO-RECEITA-E-RETENCAO.md), com casos, entrevistas, estudos controlados e limites da evidência. Este arquivo conserva o diagnóstico técnico anterior; não deve ser usado isoladamente como roteiro de investimento.

Data: 22/09/2026. Base: código da versão 1.4.0 e documentação oficial dos serviços consultada nesta tarefa.

Objetivo: aumentar a receita sustentável do portfólio e permitir explicar quanto cada mudança, canal e app contribui para o resultado.

Este é um plano de evolução. As APIs, eventos e campos propostos abaixo ainda não foram implementados. A análise foi estática: não houve execução de builds, acesso aos dashboards, conferência de clientes no RevenueCat ou medição de receita real.

Como ainda não temos distribuição de receita, volume e retenção dos apps, a prioridade inicial considera monetização mista, com atenção aos anúncios pela arquitetura atual da biblioteca. Os prazos são estimativas de implementação para um desenvolvedor; tempo de coleta e maturação dos resultados é adicional.

**1. O que já existe e deve ser aproveitado**

| Base encontrada | Onde | Próximo ganho |
| --- | --- | --- |
| Receita de anúncios por impressão e placement | [ad-revenue.ts](../utils/ad-revenue.ts) | Relacionar receita com oportunidades, espera e retenção |
| Identificação e bloqueio de placements | [AdPlacementTracker.ts](../utils/AdPlacementTracker.ts) | Usar nomes explícitos nos pontos importantes e regras de frequência |
| Paywall configurável e funil de compra | [PaywallUtils.ts](../utils/PaywallUtils.ts) | Medir falhas antes da exibição, isolar ofertas e testar o momento de abertura |
| Atribuição, status e identidade RevenueCat → GA4 | [attribution.ts](../utils/attribution.ts) e [Utils.ts](../utils/Utils.ts) | Cruzar comportamento com renovações, expirações e reembolsos |
| Eventos de push e tópicos por status | [push-analytics.ts](../utils/push-analytics.ts) | Medir retorno e receita incremental das campanhas |
| Cross-promo obrigatório e eventos de interação | [cross-promo-card.tsx](../utils/cross-promo-card.tsx) | Medir instalações e valor gerado no app de destino |
| Remote Config, catálogo de eventos e alertas de runtime | [types.ts](../utils/types.ts), [ANALYTICS-EVENTS.md](ANALYTICS-EVENTS.md) | Histórico de configurações, qualidade dos dados e alertas acionáveis |

Encontrar chamadas no código não comprova entrega no serviço. O primeiro piloto precisa estabelecer essa evidência.

**2. Prioridade zero: resolver perdas e distorções antes de otimizar**

| Achado concreto | Consequência possível | Trabalho proposto |
| --- | --- | --- |
| PremiumUtils exige entitlement ativo, willRenew e ausência de unsubscribeDetectedAt; existe uma exceção por flag | Quem desativa a renovação pode perder premium durante o período ainda ativo | Separar direito de acesso de intenção de renovar; testar cancelamento, expiração, trial, reembolso, acesso vitalício e indisponibilidade |
| PaywallUtils.getOfferingPackages combina a offering atual com pacotes de todas as offerings | Sem filtro explícito de produtos, uma variante pode exibir produtos de outras ofertas | Resolver uma offering de forma explícita, preservar a seleção atribuída e registrar a oferta realmente exibida |
| LoadAdsManager cria, carrega e exibe o anúncio na própria chamada | A espera pode afetar conclusão da tarefa e retorno ao app | Medir a espera; separar pré-carregamento de exibição e definir saída imediata quando não houver anúncio pronto |
| Há chamadas diretas a logEvent em ads e config-integrity, fora de logUtilsEvent | A sanitização e o contexto não seguem uma única regra | Centralizar mantendo o contrato não bloqueante e os nomes já utilizados |
| CrossPromoCard registra impressão no efeito de montagem quando a configuração permite exibição | Um card abaixo da área visível pode entrar no denominador sem ter sido visto | Distinguir montagem de visibilidade real e deduplicar por exposição |
| O placement automático depende da rota e de informações da stack | Mudanças no bundle podem dificultar comparação entre versões | Adotar tags explícitas e estáveis nos placements relevantes; manter compatibilidade com a blocklist |

O RevenueCat distingue acesso ativo de renovação futura. A proposta para premium é mudar uma regra deliberada do projeto, com migração documentada. Isso pode reduzir anúncios exibidos a quem ainda tem acesso válido; a hipótese de negócio é melhorar confiança, retenção e recuperação de assinantes. Não há ganho financeiro medido nesta tarefa. [Referência: CustomerInfo](https://www.revenuecat.com/docs/customers/customer-info).

Antes de testar trials, revisar também a elegibilidade e a apresentação da oferta: getTrialDaysFromProduct deriva dias de introPrice e getButtonText usa esse resultado para oferecer período gratuito, sem verificar nessa função o preço da oferta ou a elegibilidade do comprador. Validar os casos reais nas duas lojas.

Entrega: conjunto pequeno de correções, reproduções no expo-utils-lab e evidências anexadas aos casos de teste. Esse trabalho antecede A/B de offerings e novas modalidades de compra.

**3. Dados sob seu controle: uma base consultável do portfólio**

Começar com exportação dos dados que já existem, aproveitando a infraestrutura usada pelo portfólio. O caminho recomendado é GA4/Firebase → BigQuery, recebimento de eventos do RevenueCat no backend e importação de relatórios de anúncios, lojas e gastos de aquisição. O Firebase oferece exportações de Analytics, Cloud Messaging, Crashlytics e outros produtos; armazenamento e consultas precisam de orçamento próprio. [Exportação oficial](https://firebase.google.com/docs/projects/bigquery-export).

O expo-utils fica responsável por produzir eventos consistentes e contexto. O backend guarda o histórico financeiro, reconcilia fontes e dispara automações. O painel permite comparar apps. Essa separação mantém consultas e segredos fora dos aparelhos.

| Conjunto de dados | Conteúdo proposto | Pergunta que responde |
| --- | --- | --- |
| Eventos e exposições | App, plataforma, versão, lib, origem do dado, horário, placement, configuração e variante | O que o usuário recebeu e fez? |
| Histórico de compras | Transação, produto, ambiente, moeda, renovação, expiração e ajustes | Quanto foi comprado e depois cancelado ou reembolsado? |
| Receita de anúncios | Valor, moeda, precisão, formato e placement quando disponível | Onde os anúncios geram receita? |
| Aquisição e campanhas | Canal, campanha, gasto, método de atribuição e informação desconhecida | Qual aquisição traz retorno? |
| Configurações e releases | Revisão, snapshot, compatibilidade, público, data e responsável | O que mudou antes de um resultado subir ou cair? |

Usar o vínculo GA4 user_id ↔ RevenueCat já existente. Tratar eventos anteriores à configuração do RevenueCat, aliases, reinstalações e transferências explicitamente. Não supor que o ID anônimo identifica a mesma pessoa em apps ou aparelhos diferentes. Preservar app/projeto/ambiente em todas as chaves.

Os webhooks do RevenueCat permitem acompanhar o ciclo de assinatura fora do app. O consumidor deve autenticar a chamada, persistir antes de confirmar, deduplicar pelo ID do evento e lidar com reenvios e eventos fora de ordem. Conferir a disponibilidade no plano da conta; a documentação consultada indica Pro. [Webhooks](https://www.revenuecat.com/docs/integrations/webhooks).

Definir três visões distintas: receita operacional estimada, receita ajustada pelas fontes e repasse financeiro. Não somar ad_revenue com ad_impression como duas receitas, nem paywall_purchase_success com a transação correspondente. Não deduzir comissão ou reembolso duas vezes de um relatório que já venha líquido.

O ad_impression do AdMob pode ser coletado automaticamente após a vinculação com Firebase/Analytics. O ad_revenue atual serve à análise por placement; escolher uma fonte canônica por indicador e reconciliar a outra. Sem identificador comum comprovado, não prometer um join exato de rede × placement por impressão. [Medição de anúncios](https://firebase.google.com/docs/analytics/measure-ad-revenue).

Conservar moeda e precisão originais. Uma impressão pode ter valor estimado; conferir também a unidade entregue pela versão real do SDK antes de converter. Comparar valores finalizados com relatórios do serviço, considerando cobertura, fuso e atrasos. [Precisão da receita por impressão](https://developers.google.com/admob/android/impression-level-ad-revenue).

Controle operacional: acesso por função, exportação própria, retenção definida, exclusão quando aplicável, separação de teste e produção, tabelas particionadas e limites de consulta. Evitar que cada visita ao painel faça uma leitura integral do histórico.

Um coletor próprio de eventos no aparelho só entra em uma etapa posterior, se a exportação não atender à latência ou cobertura necessária. Nesse caso, adicionar um destino opcional ao logger existente, com fila limitada, IDs para deduplicação e descarte controlado. Manter o envio fora do boot e das interações críticas.

Aceite: acompanhar um fluxo conhecido do aparelho até o GA4, uma compra até o RevenueCat e o backend, e os respectivos registros no conjunto analítico. Mostrar cobertura e divergências no painel.

**4. Um painel que indique a próxima decisão**

| Indicador | Definição de trabalho | Decisão |
| --- | --- | --- |
| Receita acumulada D7/D30 por instalação | Receita de ads + compras ajustadas, em moeda comum, dividida pela coorte de instalações elegíveis | Qual versão, experiência ou campanha gera mais valor? |
| Margem de contribuição por coorte | Receita ajustada menos aquisição e custos variáveis atribuíveis | Qual app ou canal merece mais investimento? |
| Retenção D1/D7/D30 | Parcela da mesma coorte que retorna no dia ou janela definidos | A mudança está expulsando usuários? |
| Ativação | Parcela que conclui a primeira tarefa útil definida pelo app | O usuário chega ao benefício? |
| Funil de ads | Oportunidade → elegibilidade → request → carregamento → exibição → receita | Onde a monetização se perde? |
| Funil de assinatura | Paywall elegível → exibido → compra/trial → conversão paga → renovação | Falta intenção, oferta, pagamento ou retenção? |
| Qualidade dos dados | Atraso, ausência, duplicidade, proporção sem identidade e sem atribuição | Dá para confiar na comparação? |

D7/D30 são janelas observadas, não uma previsão de todo o valor de vida do usuário. Comparar apenas coortes maduras ou marcar resultados parciais. Novos, recorrentes e assinantes precisam de recortes próprios.

Não usar apenas eCPM como objetivo: ele descreve o rendimento por mil impressões, mas não incorpora quantas pessoas continuam usando o app. A receita por usuário ativo também precisa ser acompanhada pela receita por instalação, porque uma experiência pode perder usuários e melhorar artificialmente a média dos que restaram.

Primeiro painel: app, plataforma, país, versão, origem e variante. Começar com recortes grandes o suficiente para ter volume; evitar dezenas de pequenos segmentos sem leitura confiável.

**5. Anúncios: aumentar valor sem sacrificar o uso**

Propor um módulo de regras compartilhado com avaliação local por placement. Ele decide se a oportunidade é elegível e registra o motivo, usando estado já disponível; o usuário não espera uma consulta ao backend.

| Experimento | Hipótese | Métrica principal e acompanhamento |
| --- | --- | --- |
| Primeiro anúncio depois da primeira tarefa útil | Mais pessoas percebem valor e voltam | Receita por instalação D7/D30; ativação e retenção |
| Intervalo e limite por sessão | Reduzir saturação pode aumentar receita acumulada | Receita por instalação; frequência e abandono |
| Rewarded opcional para benefício concreto | Parte dos usuários prefere trocar atenção por uso | Receita total; uso do benefício e conversão premium |
| Pré-carregamento em oportunidade anterior | Menos espera aumenta conclusão e próximas sessões | Espera até continuar; receita e tarefa concluída |
| Ajustes de mediation por mercado | Uma rede adicional pode melhorar preenchimento | Receita total, latência, estabilidade e tamanho do app |

A lib já oferece mediation: instalar mais adapters, isoladamente, não comprova que uma rede está servindo ou pagando. Conferir configuração no AdMob, diagnóstico do SDK e dados reais da rede antes de expandir.

Registrar razões como premium, ads desativados, bloqueio do placement, consentimento, ausência de unitId, limite de frequência e anúncio indisponível. Preservar os eventos existentes e acrescentar apenas os estágios ausentes.

O campo repeat_ads_count aparece no tipo e na integridade; não foi encontrado controle dele no LoadAdsManager. Mapear usos nos apps host antes de assumir que há um limite global de frequência.

Usar timestamps para avaliar intervalos. Nenhuma decisão essencial deve depender de um timer disparar durante permissão ou compra. Reavaliar banners quando o acesso premium mudar: o comportamento atual lê parte do estado na montagem.

Criar coordenação entre interstitial, app-open, paywall, review e promo. Um retorno de compra ou de diálogo de sistema não deve ser tratado automaticamente como uma nova oportunidade comercial. O app informa quando está em uma tarefa que não pode ser interrompida.

Aceite: cada tentativa relevante tem decisão explicável; anúncio indisponível não impede a tarefa; novos limites são configuráveis e testados nos ciclos de foreground/background.

**6. Paywall e assinaturas: vender no contexto certo e recuperar receita**

O app host precisa informar seu momento de valor: resultado gerado, documento salvo, rotina concluída ou uso recorrente. O expo-utils pode padronizar a sinalização e medir o percurso, mas não deve adivinhar sucesso pelo nome de uma tela.

Primeiro teste: o paywall atual contra uma oferta depois de uma entrega útil. Em testes separados, comparar seleção de plano, combinação mensal/anual, benefício oferecido e preço por mercado. Preços e elegibilidade vêm das lojas; o texto da interface precisa representar o que será cobrado.

Para apps de uso episódico, avaliar compra única para remover anúncios ou liberar uma função. Para apps com uso frequente e custo contínuo, avaliar assinatura. Um produto vitalício depende primeiro da correção e validação do acesso premium e de uma estimativa de custo futuro.

Adicionar recuperação de pagamento e de assinantes expirados: orientação dentro do app, gerenciamento da assinatura e comunicação pelos canais permitidos. Medir receita recuperada comparada a um grupo de controle. Separar cancelamento da renovação, falha de pagamento, expiração e reembolso. [Semântica dos eventos do RevenueCat](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).

Avaliar o Customer Center antes de desenvolver toda a interface de gerenciamento: ele oferece restauração, suporte, feedback de saída e ofertas de retenção. É uma opção com dependência de plano e integração, não uma funcionalidade já presente no pacote. [Customer Center](https://www.revenuecat.com/docs/tools/customer-center).

Critério econômico: a receita adicional de compras precisa compensar descontos, reembolsos, custos e anúncios que deixam de ser exibidos. Teste que aumenta trial sem aumentar conversão paga e receita madura continua inconclusivo.

**7. Cross-promo e push como canais mensuráveis**

Cross-promo permanece presente em todo app, conforme a regra do repositório. A evolução é escolher melhor qual app promover, em que contexto e com qual mensagem. O controle inicial é o card atual; a variante pode mudar destino ou posição.

Adicionar campanha, app de origem, app de destino e variante. No Android, explorar a atribuição pelo Install Referrer já integrada, com validação do percurso na Play. [Install Referrer](https://developer.android.com/google/play/installreferrer).

No iOS, usar links de campanha do App Store Connect e resultados agregados, respeitando os limites de volume e privacidade do relatório. Esses links não fornecem automaticamente uma identidade individual que possa ser ligada ao RevenueCat. [Campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links).

Acompanhar clique, instalação atribuível, ativação e receita no destino. Quando não houver ligação confiável, mostrar resultado agregado ou desconhecido. O matching por IP do TrendingsTracker não deve ser promovido a atribuição determinística.

Para push, começar por uma situação concreta: usuário que interrompeu uma tarefa ou deixou de retornar depois de experimentar o app. O sender registra campanha, população elegível e tentativas; o app registra abertura e resultado útil. Incluir janela de horário, limite de frequência e grupo de controle.

Eventos de recebimento têm lacunas conhecidas por plataforma. A razão entre aberturas e recebimentos observados não representa necessariamente a taxa real de entrega ou abertura. A decisão principal deve vir de retorno e receita incremental sobre a população definida para o teste.

Aceite: uma campanha rastreada do começo ao resultado disponível, com as lacunas declaradas. Cliques e instalações atribuídas não provam, sozinhos, ganho incremental do portfólio.

**8. Experimentos e configuração com histórico**

Adotar primeiro Firebase A/B Testing, aproveitando Remote Config e Analytics. Ele já oferece atribuição persistente e análise de resultados; decidir previamente a métrica e o efeito mínimo que justificaria o trabalho. O Firebase recomenda pelo menos duas semanas para um experimento típico, além de volume suficiente. Testes de renovação e D30 exigem observação mais longa. [Conceitos de A/B](https://firebase.google.com/docs/ab-testing/ab-concepts).

Há uma adaptação necessária no pacote: hoje os leitores concentram a configuração nos JSONs utils e screens. Criar um parâmetro novo no console não faz o código consumi-lo. Para o piloto, manter esses contratos e versionar variantes completas, evitando experimentos concorrentes no mesmo JSON. Depois, avaliar uma superfície específica para parâmetros independentes.

Registrar atribuição e exposição efetiva separadamente. Comparar grupos a partir da elegibilidade definida antes do tratamento; analisar apenas quem abriu o paywall pode favorecer artificialmente a variante que mudou o momento de abertura.

Cada experimento terá hipótese, controle, variante, público, métrica, critérios de interrupção, duração mínima e resultado. Começar com um teste por área de monetização em cada app. Pouco tráfego exige menos variantes e diferenças maiores entre elas.

O console pode acompanhar receita e retenção; a análise consolidada deve usar a definição financeira acordada. A existência de ad_revenue customizado não garante que a métrica nativa de receita do Firebase esteja recebendo o valor esperado. [Configuração de experimentos](https://firebase.google.com/docs/ab-testing/abtest-config).

Para configurações, propor validação de schema, revisão identificável, histórico, valor anterior utilizável e rollback. A configuração efetivamente aplicada precisa acompanhar os eventos. O fetch atual é memoizado por sessão: desligamento remoto só deve ser anunciado com a latência real de aplicação, não como interrupção instantânea.

**9. Oportunidades menos óbvias**

| Ideia | Por que pode valer dinheiro | Quando fazer |
| --- | --- | --- |
| Alerta de produtos vazios no paywall | Uma falha de configuração pode parecer baixa conversão | Primeiro piloto |
| Alerta de receita/atividade e de ausência de dados | Diferencia queda comercial de falha de coleta | Após baseline e exportação |
| Correlacionar queda com revisão, versão e OTA | Encurta a investigação de regressões que afetam muitos apps | Junto do contexto comum |
| Mostrar valor entregue antes da renovação | Torna o benefício recorrente visível para quem já assinou | Depois de medir ativação |
| Testar compra única em utilitários episódicos | Pode monetizar pessoas que recusam recorrência | Após validar entitlements |
| Priorizar país e idioma pela margem observada | Direciona tradução, oferta e aquisição para oportunidades reais | Com coortes suficientes |
| Comparar contribuição dos apps ao portfólio | Um app pequeno pode ser um bom canal de entrada para outro | Com cross-promo mensurável |
| Diagnóstico por app no CLI/lab | Detecta diferenças de setup antes de contaminar métricas ou perder vendas | Após definir invariantes |
| Relatório curto com decisões candidatas | Converte dados em uma rotina semanal de trabalho | Após consolidar o painel |

Alertas precisam de volume mínimo, histórico e consideração do atraso da fonte. Export diário não serve para prometer detecção em minutos. Toda sugestão do relatório deve trazer a evidência e a incerteza; publicação de configuração e mudança de preço continuam ações explícitas.

**10. Execução sugerida**

| Etapa | Entrega | Local | Estimativa |
| --- | --- | --- | --- |
| 1 | Auditoria de premium, offerings, trial e medição; escolher um app piloto e estabelecer baseline | Lib + app + dashboards | 3–5 dias úteis |
| 2 | Exportação, histórico de compras, reconciliação e primeiro painel | Infraestrutura + backend | 5–10 dias úteis |
| 3 | Eventos ausentes de ads/paywall, contexto e placements estáveis; primeiro controle de frequência | Lib + piloto | 5–8 dias úteis |
| 4 | Primeiro A/B de ads ou paywall, com exposição validada | Lib + app + Firebase | 2–4 dias de preparação, mais coleta |
| 5 | Uma campanha de recuperação e uma melhoria de cross-promo | App + backend + lojas | 5–8 dias úteis |
| 6 | Revisar coortes maduras e levar as melhorias aos demais apps | Portfólio | Após evidência suficiente |

Para começar de forma enxuta, concentrar as duas primeiras semanas em um único app: baseline, achados críticos e dados consultáveis. Nas semanas seguintes, instrumentar as decisões e rodar um único experimento principal. A expansão depende do volume e da qualidade dos resultados.

Se anúncios dominarem a receita, antecipar frequência e pré-carregamento. Se assinaturas dominarem, antecipar integridade do acesso, oferta e recuperação. Se o tráfego for baixo, priorizar falhas técnicas, ativação e evidência qualitativa de uso antes de distribuir usuários entre muitas variantes.

Os números necessários para refinar a ordem são: receita mensal de ads/compras por app, instalações e ativos, plataformas/países, retenção D7, conversão paga, cancelamentos, gasto de aquisição e custo variável. O plano não assume um percentual de aumento sem esses dados.

**11. Regras de implementação e aceite**

Novos eventos continuam passando por logUtilsEvent, sem bloquear a UI. Nomes e parâmetros são propostas até a implementação; nessa etapa, atualizar o catálogo de analytics. Não inserir PII, tokens ou conteúdo sensível em payload genérico.

Todo novo contrato de boot, campo de Remote Config, regra premium ou mudança que afete o host deve atualizar [o playbook de upgrade](UPGRADE-EXPO57-EXPO-UTILS.md) na mesma tarefa. API pública nova exige index.ts e index.d.ts em conjunto. Mudança de PromotionalConfig/CrossPromoConfig exige atualizar também o gerador em docs/index.html.

Usar expo-utils-lab para reproduzir os fluxos. Ao implementar mudanças de SDK, conferir o fonte das versões reais nos Pods/AARs e no wrapper instalado. Testes devem cobrir estado, duplicidade, ausência de rede, compra/restauração, cancelamento e retorno de diálogos, conforme o módulo alterado.

Integração concluída exige dado observado no destino. Se houver somente teste de que o fluxo não quebra, registrar literalmente: "verifiquei que nao quebra; NAO verifiquei que chega". Evidência de teste/sandbox não comprova valores de produção nem efeito financeiro.

Este documento registra o plano; não altera a API, o runtime, as configurações dos serviços ou o contrato de migração atual.
