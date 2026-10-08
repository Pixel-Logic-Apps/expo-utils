# Plano do coletor de dados por usuário

Data: 29/09/2026. Status: **proposta**. Nada foi implementado, publicado nem testado no aparelho. Preços e limites foram lidos nas docs oficiais; o que foi verificado e o que não foi está na [seção 10](#10-o-que-foi-verificado-e-o-que-não-foi).

## Em português simples

- **Worker:** programa pequeno que roda na Cloudflare e recebe o que os apps mandam.
- **D1:** banco de dados simples da Cloudflare (tabelas, SQL). Cada banco guarda no máximo 10 GB.
- **R2:** armazenamento de arquivos da Cloudflare. Sem limite de tamanho; cobra por arquivo gravado e por GB guardado.
- **Lote:** várias ações juntas, enviadas de uma vez.
- **Fila em disco:** o aparelho guarda as ações no armazenamento local até o servidor confirmar que recebeu.
- **`seq`:** número de sequência de cada evento, por instalação. Um buraco na sequência é um evento perdido.

## 1. O que foi pedido

- Salvar automaticamente, em todo app que usar a nova versão do expo-utils, o que cada usuário faz: **IP em histórico (lista)**, navegação, tela atual, cliques, erros e os eventos que a lib já gera.
- **Um banco só**, com subárvore automática `{expo.slug}/{uuid}`. Ninguém cria banco ou coleção à mão por app.
- A coorte é acumulada no próprio aparelho e copiada para o usuário, como o Taichi já faz com a receita dos 7 primeiros dias.
- O aparelho só escreve. Não lê nem apaga.
- Custo não é problema.
- Precisa dar para guardar **sem nunca apagar**.

## 2. Decisão: Cloudflare Worker + D1 + R2

O aparelho só manda um `fetch` com um lote de ações. Não entra lib nativa nova.

```
aparelho (fila em disco) ──lote──▶ Worker "collector"
                                     ├─ D1 · ficha do usuário   tabelas users e user_ips
                                     ├─ D1 · recibos            tabela batches
                                     └─ R2 · arquivo            {slug}/{uuid}/{seq_ini}-{seq_fim}.json.gz
```

| Gaveta | Onde | O que guarda | Cresce com |
|---|---|---|---|
| Ficha | D1, `users` | Uma linha por usuário: primeira e última vez, sessões, receita de anúncio acumulada, dias ativos, assinatura, atribuição, contagens por evento, `seq_max`, `events_received`, último IP | Número de usuários (cabem ~14 milhões nos 10 GB; estimativa) |
| IPs | D1, `user_ips` | Um IP por linha: primeira vez, última vez, quantas vezes, geo | Número de IPs distintos por usuário |
| Recibos | D1, `batches` | Uma linha por lote recebido: faixa de `seq`, IP, hora, chave no R2. Garante que reenvio não duplica e mede perda | Número de lotes |
| Arquivo | R2 | Cada lote como objeto gzip com `{ip, cf, recebido_em, eventos[]}`: telas, toques, erros, eventos da lib | Volume de eventos (é o histórico grande) |

**Por que dividir:** o D1 tem teto de 10 GB por banco, e a doc diz que esse número não pode ser aumentado. O R2 não tem teto de tamanho, custa US$ 0,015/GB-mês e não cobra saída de dados. O que cresce (o histórico) vai para o R2; o que é pequeno e precisa de consulta vai para o D1.

**Rotas do Worker**

- `POST /v1/batch`: valida tamanho, `slug`, `uuid` e formato dos eventos; limita por IP e por `uuid` (binding de Rate Limiting); lê IP e `request.cf`; grava no R2 e no D1; **só responde 2xx depois de gravar**.
- `GET /geo`: devolve `{country, region, regionCode, city}` a partir de `request.cf`. A lib já consome isso pelo `geo_lookup_url` (Remote Config) e tenta esse endpoint antes da cadeia grátis.
- `GET/DELETE /admin/...` (protegidas por segredo): linha do tempo por `uuid`, ficha, buracos de `seq`, coortes e exclusão de um usuário (D1 + prefixo no R2).
- Cron diário: limpa o que tiver prazo (recibos antigos e, se houver prazo, o que mais precisar).

## 3. Envio do aparelho e perda de dados

Lote em memória se perde se o app morrer antes de enviar. A saída é uma fila em disco. Vale para qualquer destino.

- Cada evento é gravado no disco na hora (uma chave por evento, com `seq` por instalação). O lote é só uma leitura dessa fila.
- Envia ao juntar N eventos (padrão 50), ao ir para segundo plano (`AppState`), ao voltar ao app e ao voltar a rede. Nada depende de timer: o Android suspende os timers do JS quando há diálogo do sistema na frente.
- Só apaga do disco depois do 2xx. O lote tem ID fixo (faixa de `seq`) e o recibo tem chave `(slug, uuid, seq_ini)` com `INSERT OR IGNORE`, então reenviar não duplica.
- Erro e compra não esperam o lote: saem na hora, já gravados.
- Teto da fila: poucas centenas de KB. No AsyncStorage v2 do Android o app inteiro divide 6 MB. Passou do teto, ou tem mais de 7 dias: descarta o mais antigo.
- Erro de JS entra na fila pelo handler global antes de o app morrer (melhor esforço). Crash nativo fica com o Crashlytics.

| Cenário | Resultado |
|---|---|
| Home, trocar de app, arrastar da lista, sistema matando em segundo plano | Nada se perde: já estava no disco e sai na próxima abertura |
| Crash, bateria ou kill em primeiro plano | Perde só o evento que estava sendo gravado |
| Sem rede | Fica na fila até o teto |
| Desinstalar ou limpar dados com fila pendente | Perde |
| Resposta perdida e lote reenviado | Não duplica |

**Medir a perda:** `perdidos = seq_max − events_received` por usuário, e buracos de `seq` por SQL (Apêndice B). No lab: matar o processo (`adb shell am force-stop`) no meio de N eventos e comparar o que chegou com o que foi gerado. Não dá para prometer 0% nem estimar a taxa sem medir.

## 4. O que é capturado e como

| O quê | Como | Estado hoje no repo |
|---|---|---|
| IP | O Worker lê `CF-Connecting-IP` em todo lote. `user_ips` guarda cada IP com primeira vez, última vez e contagem; a lista completa fica também nos lotes do R2 | A lib não guarda IP |
| Geo | `request.cf`: país, região, cidade, fuso, ASN e operadora. `GET /geo` alimenta o `geo_lookup_url` | `geo.ts` já aceita `geo_lookup_url` e tenta antes da cadeia grátis (ipwho.is, BigDataCloud, GeoJS) |
| Telas e tela atual | `screen_view` no `RouteTracker`, com o padrão da rota (`useSegments`) e não o caminho com valores; a tela atual é o último `screen_view` | `RouteTracker` só alimenta o bloqueio de placement; a lib não loga `screen_view` |
| Cliques | View raiz captando toque: coordenada e tela, teto de 100 por sessão. Nome do botão só com `testID`/`accessibilityLabel` nos apps | Não existe |
| Erros | Handler global de JS, promise rejections e `expoUtilsWarn` | A lib não captura erro; `expoUtilsWarn` já vira `expo_utils_warn` no GA4 |
| Eventos da lib (anúncio, paywall, push, promo, review, atribuição) | Destino extra dentro de `logUtilsEvent` | Passam por `logUtilsEvent`, exceto `LoadAdsManager.ts:36` e `config-integrity.ts:148`, que chamam `logEvent` direto e precisam migrar |
| Coorte e ficha | Acumuladores no aparelho, enviados em cada lote como valor absoluto; contadores só sobem (o Worker usa `MAX`) | `@expo_utils_taichi_v1` guarda `firstOpen` e `usd` dos 7 primeiros dias. Faltam soma vitalícia, sessões, dias ativos e contagens por evento. `firstOpen: 0` é instalação antiga e fica fora das coortes |
| Clarity | Opcional: `setCurrentScreenName` e `setCustomUserId` | Integrado (`clarity_id`), mas a lib só chama `initialize`; os dados ficam nos painéis da Microsoft |

**Configuração:** ligado por padrão, com a URL do Worker embutida na lib (nenhum app precisa de configuração). `collector_url` e `collector_enabled` no Remote Config sobrescrevem; uma opção do plugin desliga; desligado em `__DEV__`. O GA4 continua como está.

## 5. Custo

**Premissas** (as mesmas em todas as linhas):

- "Usuários por dia" são as pessoas que abrem os apps num dia, somando todos os apps.
- Cada uma gera ~100 ações por dia (telas, toques, erros, eventos), enviadas em 2 lotes de 50. Dá 6 mi de requisições por mês a cada 100 mil usuários por dia.
- 250 bytes por evento, compactados 6× com gzip. **É premissa, não foi medida.**
- Guarda 30 dias (linhas A a D). Preços de tabela; Firestore na região de Iowa (outras regiões custam mais).

Custo por mês, em dólar:

| Como guardar | 10 mil usuários/dia | 50 mil | 100 mil | 500 mil |
|---|---|---|---|---|
| A. Cada ação = 1 gravação no Firestore | 34 | 172 | 345 | 1.730 |
| B. Firebase: função + Firestore, ações em lotes | 2 | 11 | 24 | 132 |
| C. Cloudflare com D1 | 5 | 6 | 6* | não cabe |
| D. Cloudflare com R2 | 5 | 14 | 28 | 145 |

\* Com 100 mil por dia o D1 só cabe guardando 14 dias. Com 30 dias passa do teto de 10 GB.

- **A é cara porque o Firestore cobra por gravação.** Juntar 50 ações numa gravação só derruba o custo umas 15 vezes. B, C e D usam essa ideia e por isso ficam parecidas: a escolha entre elas não é pelo preço.
- **Linha D com 100 mil por dia:** Workers Paid US$ 5 + gravações no R2 ~US$ 22,50 + espaço ~US$ 0 = ~US$ 28. O que custa no R2 é gravar (US$ 4,50/mi), não guardar.
- **Firebase:** o número certo é ~US$ 24 (não 19), porque inclui a atualização do documento do usuário em cada lote.

### O teto de 10 GB do D1

É uma trava, não um preço. O preço do espaço continua o mesmo (US$ 0,75/GB-mês acima de 5 GB grátis). Quando o banco enche, o D1 devolve o erro `Exceeded maximum DB size` e as gravações novas não entram até você apagar linhas ou dividir em mais bancos. Os aparelhos guardam na fila e tentam de novo; se o banco ficar cheio por dias, a fila enche e os mais antigos são descartados.

| Usuários por dia | Entra por dia | 30 dias cabem? | Dias até encher |
|---|---|---|---|
| 10 mil | 0,04 GB | sim (1,3 GB) | ~240 |
| 50 mil | 0,21 GB | sim (6,3 GB) | ~48 |
| 100 mil | 0,42 GB | não (12,5 GB) | ~24 |
| 500 mil | 2,1 GB | não (62,5 GB) | ~5 |

Três jeitos de evitar: (1) guardar menos dias, com uma rotina diária que apaga o mais antigo; (2) dividir em vários bancos D1, por exemplo um por app (a doc diz que é o uso previsto e que ter mais bancos não custa extra, mas dá mais trabalho no código); (3) usar o R2, que não tem teto. Com até ~80 mil usuários por dia o D1 aguenta 30 dias.

## 6. Guardar sem nunca apagar

É possível e barato: só o espaço cresce, e devagar.

Espaço acumulado e custo mensal só do espaço, além do que já se paga para gravar (mesmas premissas da seção 5):

| Usuários por dia | Após 1 ano | Após 3 anos | Após 5 anos |
|---|---|---|---|
| 10 mil | 15 GB · US$ 0,1 | 45 GB · US$ 0,5 | 75 GB · US$ 1 |
| 100 mil | 150 GB · US$ 2 | 450 GB · US$ 7 | 750 GB · US$ 11 |
| 500 mil | 750 GB · US$ 11 | 2,2 TB · US$ 34 | 3,7 TB · US$ 56 |

Com 100 mil por dia, a conta total vai de ~US$ 28 hoje para ~US$ 30 em 1 ano, ~US$ 39 em 5 anos e ~US$ 50 em 10 anos.

**O que muda no desenho**

1. **R2 sem regra de apagar.** A durabilidade do R2 é de "onze noves": para 10 milhões de arquivos, a expectativa é perder um a cada 10 mil anos. Isso protege de falha de disco, não de erro próprio. Para erro próprio existe o *bucket lock*, que impede apagar e sobrescrever, por um período ou para sempre; quem administra a conta pode remover a regra. O lock também impede sobrescrever, então o Worker precisa tratar "já existe" no reenvio de um lote como sucesso. Se o dado é insubstituível, mantenha uma segunda cópia fora da Cloudflare.
2. **As tabelas do D1 não podem crescer para sempre** (estimativas por 100 mil usuários por dia):
   - Recibos: encheriam os 10 GB em ~7 meses. Apagar depois de 30 dias é seguro: o dado continua no R2 e o nome do objeto já leva a faixa de `seq`.
   - IPs: encheriam em ~3 anos. A lista completa fica no R2 (cada lote leva IP e hora) e o D1 guarda só os últimos 100 por usuário.
   - Ficha: uma linha por usuário; cabem ~14 milhões.
3. **Ler depois.** Em 5 anos são 360 milhões de arquivos pequenos; ler tudo uma vez custaria ~US$ 130 (US$ 0,36 por milhão de leituras). Juntar em arquivos maiores com o tempo resolve.

**Se preferir prazo em vez de nunca apagar:** uma regra de lifecycle apaga o objeto sozinho depois de N dias (o R2 remove em até 24 horas do vencimento). Guardar 90 dias em vez de 30 quase não muda a conta, porque o custo do R2 é gravar.

## 7. Como fazer

**Você, ~10 minutos, na sua conta Cloudflare** (o `wrangler` 4.141.0 já está em `gerador-videos/node_modules`; rode dentro do projeto do Worker):

```bash
# 1. banco e bucket (uma vez)
npx wrangler d1 create coletor                       # anote o database_id no wrangler.jsonc
npx wrangler d1 execute coletor --remote --file schema.sql
npx wrangler r2 bucket create coletor-historico

# 2. retenção: escolha UMA (não combine as duas no mesmo prefixo)
npx wrangler r2 bucket lifecycle add coletor-historico expira-90d "" --expire-days 90
npx wrangler r2 bucket lock add coletor-historico nao-apagar "" --retention-indefinite

# 3. senha das rotas admin
npx wrangler secret put ADMIN_TOKEN
```

Também: escolher o endereço do Worker (ver seção 9). O Worker existente `gerador-videos` usa `workers.dev` na conta `bruno-vmartins2` e já tem R2, Durable Objects e cron; o coletor seguiria o mesmo padrão.

**Eu, no código, nesta ordem**

1. Worker `collector` + `schema.sql` + testes locais (`wrangler dev`, sem deploy).
2. Módulo da lib: fila em disco, capturas (telas, toques, erros, eventos), ficha, chaves de desligar, `__DEV__`. Migrar `LoadAdsManager.ts:36` e `config-integrity.ts:148` para `logUtilsEvent`. Testes de lógica no estilo de `./tests/run.sh`.
3. Teste no `expo-utils-lab` contra o Worker publicado: matar o processo no meio de N eventos e conferir no D1 e no R2 o que chegou. Isso exige deploy (precisa do seu ok).
4. Docs, na mesma tarefa (regra do `AGENTS.md`): README, `docs/ANALYTICS-EVENTS.md`, `docs/UPGRADE-EXPO57-EXPO-UTILS.md`, e `index.ts` + `index.d.ts` se houver API pública nova.
5. Só com o seu ok: tirar `@react-native-firebase/firestore` e `auth` da lista de peers que o CLI instala (−~5 MB no Android).

Como é só JavaScript, o módulo pode chegar aos apps por OTA (hot-updater).

**Critério de aceite** (regra do `AGENTS.md`: só vale o dado visto no destino)

- Um lote enviado pelo lab aparece no R2 (objeto) e no D1 (`batches`, `users`, `user_ips`).
- Matar o app no meio: a perda medida por `seq` aparece no D1 e bate com o que o lab gerou.
- IP e geo gravados batem com a conexão do teste.
- Se o geo passar a vir do Worker: os atributos `geo_*` chegam ao customer do RevenueCat.

## 8. Alternativas consideradas

| Opção | Custo/mês (100 mil/dia) | IP e geo | Consulta | Limite ou risco |
|---|---|---|---|---|
| Firestore direto pelo aparelho, banco central (app secundário) | ~US$ 24 com lotes; ~US$ 345 com 1 documento por evento | IP autodeclarado pelo aparelho (chamada extra) | Admin SDK + índices | A chave do projeto central vai em todo APK; App Check exige registrar cada app; as regras não validam elementos de array |
| Função Firebase + Firestore | ~US$ 24 | IP real; geo por provedor | Admin SDK + índices | Precisa de Blaze e deploy da função |
| Worker + D1 | ~US$ 5–6 (14 dias) | IP e geo prontos | SQL | 10 GB por banco |
| **Worker + R2 + D1 pequeno (escolhida)** | ~US$ 28 | IP e geo prontos | SQL na ficha; arquivos no R2 | Escrita no R2 custa US$ 4,50/mi |

Notas sobre o caminho direto pelo Firestore:

- O RNFB cria app secundário em JS: `await initializeApp(credenciais, {name})` e `getFirestore(getApp(name))`. Firestore, App Check, Auth e Functions são suportados.
- App Check: no-cost (com cotas por provedor); ~0,3 MB no Android; Play Integrity exige app distribuído no Google Play e tem cota padrão de 10 mil chamadas por dia por projeto Cloud; iOS usa App Attest ou DeviceCheck.
- Auth anônima: no-cost até 50 mil MAU (Identity Platform); num projeto central os MAU de todos os apps somam.
- Regras testadas no emulador: [Apêndice A](#apêndice-a--regras-do-firestore-plano-b).

## 9. Decisões em aberto

1. **Retenção:** por prazo (N dias, lifecycle) ou sem apagar (R2 sem lifecycle, com ou sem trava).
2. **Cliques:** coordenada basta? Nome do botão exige `testID`/`accessibilityLabel` em cada app.
3. **Endereço do Worker:** `workers.dev` (conta `bruno-vmartins2`) ou domínio próprio.
4. **Peers:** tirar `firestore` e `auth` da lista que o CLI instala (−~5 MB no Android; mexe em `package.json`, `bin/install.js`, README e playbook).
5. **Ok para começar** pelo protótipo local (`wrangler dev`, sem deploy).

## 10. O que foi verificado e o que não foi

**Lido nas docs oficiais em 29/09/2026**

| Fato | Onde |
|---|---|
| Firestore (Iowa): US$ 0,09/100 mil escritas, US$ 0,03 leituras, US$ 0,01 deletes; armazenamento ≈ US$ 0,15/GB-mês (derivado de US$ 0,000205479/GB-hora); grátis por dia: 20 mil escritas, 50 mil leituras, 1 GiB | cloud.google.com/firestore/pricing |
| Cloud Functions: 2 mi invocações/mês grátis, depois US$ 0,40/mi. App Check: no-cost, com cotas por provedor. Auth: 50 mil MAU no-cost com Identity Platform | firebase.google.com/pricing |
| Play Integrity: limite padrão de 10.000 requisições por dia, ligado ao projeto Cloud; TTL do token do App Check de 30 min a 7 dias | developer.android.com/google/play/integrity/setup; firebase.google.com/docs/app-check |
| Workers Paid: US$ 5/mês, 10 mi de requisições (+US$ 0,30/mi), 30 mi de CPU-ms (+US$ 0,02/mi) | developers.cloudflare.com/workers/platform/pricing |
| D1: 50 mi de linhas gravadas/mês (+US$ 1,00/mi), 25 bi lidas; 5 GB (+US$ 0,75/GB-mês); 10 GB por banco e "cannot be further increased"; 50 mil bancos por conta; erro `Exceeded maximum DB size` | developers.cloudflare.com/d1 (pricing, limits, reference/faq, observability/debug-d1) |
| R2: US$ 0,015/GB-mês; Class A US$ 4,50/mi; Class B US$ 0,36/mi; saída grátis; grátis 10 GB, 1 mi A, 10 mi B; lifecycle "apagar após N dias"; bucket lock (por prazo ou indefinido, removível); durabilidade de onze noves | developers.cloudflare.com/r2 |
| `request.cf`: `country`, `region`, `regionCode`, `city`, `timezone`, `asn`, `asOrganization` | developers.cloudflare.com/workers/runtime-apis/request |
| Binding de Rate Limiting: período de 10 ou 60 s, contagem **por local** do Cloudflare, contadores em cache local atualizados de forma assíncrona (limite aproximado) | developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit |
| RNFB: app secundário por `initializeApp(credenciais, {name})`; Firestore e App Check suportados | rnfirebase.io/app/usage |

**Medido ou executado**

- Android, compactado: App Check ~0,3 MB (`firebase-appcheck` 0,04 + `playintegrity` 0,01 + `play:integrity` 0,24, Google Maven); Auth 1,23 MB; Firestore ~4 MB (AAR 2,1 + gRPC/protobuf ~2, cache do Gradle, antes do R8). iOS não medido.
- AsyncStorage v2.2.0 no Android tem teto padrão de 6 MB (`ReactDatabaseSupplier.java`, `config.gradle`). No v3.1.1 do lab não confirmei.
- Regras do Firestore do Apêndice A: 30 de 30 casos no emulador (`firebase-tools@14`, Java 17, SDK web). Não testadas no SDK nativo.
- SQL do Apêndice B rodado no SQLite: recibo idempotente, upsert da ficha, IP com contagem, perda por `seq` e detecção de buraco.
- Comandos `wrangler` da seção 7 conferidos com `--help` (versão 4.141.0).

**NÃO verificado**

- Nada foi testado no aparelho e nada foi publicado. Não foi construído nenhum protótipo do Worker.
- Compressão real (6× é premissa), volume real de eventos e o número real de usuários por dia.
- Tamanho no iOS.
- Campos de geo do `request.cf` no seu plano, no destino.
- Comportamento do SDK nativo com as regras do Apêndice A e App Check na prática.

Verifiquei que os preços e limites estão nas docs; **não** verifiquei que o fluxo chega ao destino.

## Apêndice A — regras do Firestore (plano B)

Só faz sentido se o aparelho escrever direto no Firestore. Cliente só cria e atualiza; não lê nem apaga. Uma regra idêntica serve a todos os projetos (o slug é só o nome da coleção). O teto de 60 s por documento protege a conta até de bug do app (no teste usei 2 s).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function str(v, max)          { return v is string && v.size() <= max; }
    function optStr(d, k, max)    { return !(k in d) || str(d[k], max); }
    function optMatch(d, k, re)   { return !(k in d) || (d[k] is string && d[k].matches(re)); }
    function optInt(d, k)         { return !(k in d) || (d[k] is int && d[k] >= 0); }
    function optNum(d, k)         { return !(k in d) || (d[k] is number && d[k] >= 0); }
    function optBool(d, k)        { return !(k in d) || d[k] is bool; }
    function optTs(d, k)          { return !(k in d) || d[k] is timestamp; }
    function prev(k)              { return resource.data.get(k, 0); }
    function next(k)              { return request.resource.data.get(k, 0); }

    function allKeys() {
      return ['platform', 'appVersion', 'libVersion', 'osVersion', 'deviceModel', 'locale', 'timeZone',
              'installedAt', 'installDay', 'ipFirst', 'firstSeenAt',
              'lastSeenAt', 'sessions', 'activeDays', 'country', 'region', 'city',
              'adUsd7d', 'adUsdTotal', 'adImpressions', 'premium', 'rcStatus',
              'mediaSource', 'campaign', 'counts'];
    }
    // O que pode mudar depois do create. Identidade (platform, installedAt, ipFirst, firstSeenAt) é imutável.
    function mutableKeys() {
      return ['lastSeenAt', 'sessions', 'activeDays', 'country', 'region', 'city',
              'appVersion', 'libVersion', 'osVersion', 'locale', 'timeZone',
              'adUsd7d', 'adUsdTotal', 'adImpressions', 'premium', 'rcStatus',
              'mediaSource', 'campaign', 'counts'];
    }

    function valid(d) {
      return d.keys().hasOnly(allKeys())
        && d.keys().hasAll(['platform', 'appVersion', 'firstSeenAt', 'lastSeenAt'])
        && d.platform in ['ios', 'android']
        && str(d.appVersion, 32)
        && d.lastSeenAt == request.time                       // sempre carimbo do servidor
        && optStr(d, 'libVersion', 16) && optStr(d, 'osVersion', 32) && optStr(d, 'deviceModel', 64)
        && optStr(d, 'locale', 16) && optStr(d, 'timeZone', 64) && optStr(d, 'ipFirst', 45)
        && optStr(d, 'country', 2) && optStr(d, 'region', 64) && optStr(d, 'city', 64)
        && optStr(d, 'rcStatus', 32) && optStr(d, 'mediaSource', 100) && optStr(d, 'campaign', 100)
        && optMatch(d, 'installDay', '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && optMatch(d, 'activeDays', '^[01]{1,64}$')
        && optTs(d, 'installedAt')
        && optInt(d, 'sessions') && optInt(d, 'adImpressions')
        && optNum(d, 'adUsd7d') && optNum(d, 'adUsdTotal')
        && optBool(d, 'premium')
        && (!('counts' in d) || (d.counts is map && d.counts.size() <= 100));
    }

    match /{slug}/{uuid} {
      allow read, delete: if false;

      allow create: if uuid.matches('^[A-Za-z0-9_-]{16,64}$')
        && valid(request.resource.data)
        && request.resource.data.firstSeenAt == request.time;

      allow update: if valid(request.resource.data)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(mutableKeys())
        && request.time > resource.data.lastSeenAt + duration.value(60, 's')
        && next('sessions') >= prev('sessions')
        && next('adUsd7d') >= prev('adUsd7d')
        && next('adUsdTotal') >= prev('adUsdTotal')
        && next('adImpressions') >= prev('adImpressions');
    }
  }
}
```

Casos testados (30): create válido, outro `uuid` logo em seguida, mínimo sem `installedAt`, `counts` com 100 chaves, outro slug; bloqueios de campo desconhecido, `uuid` curto, `firstSeenAt` do cliente, string acima do limite, `platform` inválida, `counts` com 101 chaves, `sessions` negativo, subcoleção; leitura, listagem e exclusão negadas; update dentro do teto negado e depois do teto permitido; `sessions` diminuindo, mudança de `platform`, `ipFirst` e `firstSeenAt`, campo desconhecido e update sem renovar `lastSeenAt` negados; substituir o documento sem `merge` negado; `increment` positivo permitido e negativo negado; update com vários campos e `set` com `merge` permitidos. O script de teste ficou no scratchpad da sessão (`@firebase/rules-unit-testing` + `firebase-tools@14`) e não foi guardado no repo.

## Apêndice B — esquema do D1 (rascunho validado no SQLite)

```sql
CREATE TABLE users (
  slug TEXT NOT NULL, uuid TEXT NOT NULL,
  first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,          -- epoch ms, hora do servidor
  platform TEXT, app_version TEXT, lib_version TEXT, os_version TEXT, device_model TEXT, locale TEXT, timezone TEXT,
  country TEXT, region TEXT, city TEXT,
  install_day TEXT,                                                  -- 'YYYY-MM-DD' (coorte); NULL em instalação antiga
  sessions INTEGER NOT NULL DEFAULT 0,
  active_days TEXT,                                                  -- '1101000...' (um caractere por dia desde a instalação)
  ad_usd_7d REAL NOT NULL DEFAULT 0, ad_usd_total REAL NOT NULL DEFAULT 0, ad_impressions INTEGER NOT NULL DEFAULT 0,
  premium INTEGER NOT NULL DEFAULT 0, rc_status TEXT, media_source TEXT, campaign TEXT,
  counts TEXT,                                                       -- JSON {evento: n}
  seq_max INTEGER NOT NULL DEFAULT 0, events_received INTEGER NOT NULL DEFAULT 0,
  last_ip TEXT,
  PRIMARY KEY (slug, uuid)
) WITHOUT ROWID;

CREATE TABLE user_ips (
  slug TEXT NOT NULL, uuid TEXT NOT NULL, ip TEXT NOT NULL,
  first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 1,
  country TEXT, region TEXT, city TEXT, asn INTEGER, asn_org TEXT,
  PRIMARY KEY (slug, uuid, ip)
) WITHOUT ROWID;

CREATE TABLE batches (
  slug TEXT NOT NULL, uuid TEXT NOT NULL, seq_from INTEGER NOT NULL, seq_to INTEGER NOT NULL,
  n INTEGER NOT NULL, ip TEXT, received_at INTEGER NOT NULL, r2_key TEXT NOT NULL,
  PRIMARY KEY (slug, uuid, seq_from)
) WITHOUT ROWID;
CREATE INDEX batches_received ON batches (received_at);
```

Fluxo de um lote (o Worker faz o `put` no R2 primeiro e este bloco no D1 depois; se o D1 falhar, o aparelho reenvia e o `put` com a mesma chave é idempotente):

```sql
-- recibo: changes() = 1 se o lote é novo, 0 se é reenvio (só soma na ficha se for novo)
INSERT OR IGNORE INTO batches VALUES (:slug, :uuid, :seq_from, :seq_to, :n, :ip, :now, :r2_key);

-- ficha: contadores só sobem
INSERT INTO users (slug, uuid, first_seen, last_seen, platform, sessions, seq_max, events_received, last_ip)
VALUES (:slug, :uuid, :now, :now, :platform, :sessions, :seq_to, :n, :ip)
ON CONFLICT(slug, uuid) DO UPDATE SET
  last_seen = excluded.last_seen,
  sessions = MAX(users.sessions, excluded.sessions),
  seq_max = MAX(users.seq_max, excluded.seq_max),
  events_received = users.events_received + excluded.events_received,
  last_ip = excluded.last_ip;

-- lista de IPs: primeira vez, última vez e contagem
INSERT INTO user_ips (slug, uuid, ip, first_seen, last_seen) VALUES (:slug, :uuid, :ip, :now, :now)
ON CONFLICT(slug, uuid, ip) DO UPDATE SET last_seen = excluded.last_seen, hits = user_ips.hits + 1;
```

Consultas de medição:

```sql
-- eventos perdidos por usuário: gerados no aparelho menos recebidos
SELECT slug, uuid, seq_max - events_received AS perdidos FROM users WHERE seq_max > events_received;

-- buracos na sequência de um usuário
SELECT a.seq_to AS termina_em, MIN(b.seq_from) AS proximo_comeca_em
FROM batches a JOIN batches b
  ON b.slug = a.slug AND b.uuid = a.uuid AND b.seq_from > a.seq_to
WHERE a.slug = :slug AND a.uuid = :uuid
GROUP BY a.seq_to
HAVING MIN(b.seq_from) > a.seq_to + 1;
```

No fluxo real, a ficha só deve somar `events_received` quando o recibo for novo (`changes() = 1`); isso ainda precisa ser resolvido no Worker (por exemplo, `db.batch()` com o recibo primeiro e a soma condicionada ao resultado), porque o SQL acima, sozinho, soma também no reenvio.
