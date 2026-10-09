# Plano do parâmetro `settings` no Remote Config

Data: 09/10/2026. Status: **implementado na lib (1.5.0) e no pldev, sem commit**. Nenhum app foi migrado e nada foi publicado no Firebase. O que foi conferido e o que não foi está na [seção 10](#10-o-que-foi-verificado-e-o-que-não-foi).

## Em português simples

- **Parâmetro:** cada chave do Remote Config (`utils`, `screens`, `settings`). Cada app tem um valor por condição.
- **Condição:** a regra que escolhe qual valor um aparelho recebe (`app.id`, `app.version`…). Vale a primeira condição verdadeira, na ordem do template.
- **Build antigo:** versão do app já instalada nos aparelhos. Ela lê o formato que tinha quando foi publicada, para sempre.
- **Legado:** os parâmetros `utils` e `screens`, que continuam sendo publicados enquanto houver build antigo.

## 1. O que foi pedido

- Juntar `utils` e `screens` num parâmetro só, `settings`, sem quebrar o app nem os builds antigos.
- Continuar com `remoteConfigUtils` e `remoteConfigScreens` separados e também ter os dois juntos.
- Usar o próprio Remote Config para separar as versões: condição por `app.version`.
- Atualizar o pldev. Depois, um editor online simples, com histórico, que funcione no celular.

## 2. Como é hoje

- Até 19/02/2026 a lib lia uma chave `settings` com tudo no mesmo nível, em `global.remoteConfigs`. O commit `e8812b9` dividiu em `utils` (lib, tipado) e `screens` (app, livre) e não registra o motivo.
- Builds antigos ainda leem o `settings` plano: o expo-urna (lib 1.0.20) e o expo-divulgacand (lib 1.0.9), pelos clones locais. O expo-urna e o expo-urna-v2 são o **mesmo app Android** no Firebase.
- Os apps misturam as chaves. O expo-resultado lê chave do app em `remoteConfigUtils` (`show_noticias`, `show_gov_plan`, `is_api_local_enabled`) e em `remoteConfigScreens` (`workerApiUrl`), e no `_layout` sobrescreve `global.remoteConfigs` com os dois juntos. O expo-eleicao lê `app_open_enabled` no `utils`.
- Cada projeto Firebase tem vários apps, e o iOS e o Android do mesmo app podem estar em projetos (contas) diferentes.
- O pldev guarda 4 arquivos por app (`rc-config-{utils,screens}-{ios,android}.json`) e cria uma condição por parâmetro. Nos arquivos locais do expo-eleicao, o `id` da eleição de 2026 é diferente entre iOS e Android.
- **Bug do pldev**, conferido rodando o gerador (`generateDefaultJson`, usado por `rc create` e `rc json`) contra o `types.ts` atual:
  - grava `geo_lookup_enabled: false`, que desliga o geo (o padrão é ligado);
  - perde `review_show_delay`, `review_style`, `geo_lookup_url` e `retention` (o parser por regex se perde em comentário com `:` e em tipo que não conhece);
  - a lista do formulário do editor local (`lib/firebase-rc-editor/schema-utils.js`) é feita à mão e está desatualizada.

## 3. Formato novo

```json
{
  "utils":   { "is_ads_enabled": true, "review_show_delay": 35000 },
  "screens": { "is_api_local_enabled": true, "cross_promo": { "enabled": true } }
}
```

- Um valor por plataforma. Cada plataforma é um app no Firebase, com a sua condição.
- Os blocos guardam exatamente o que `utils` e `screens` guardam hoje. Migrar é embrulhar os dois valores; nada é convertido.
- O formato se reconhece pelos blocos: um `settings` sem os objetos `utils` e `screens` (o plano antigo) é ignorado pela lib.

## 4. Condição por versão

- Cada app, em cada plataforma, ganha no parâmetro `settings` uma condição com `app.id` **e** `app.version >= V`. V é a primeira versão daquele app que sai com a lib nova (cada app tem a sua numeração). A expressão é `app.id == '<app>' && app.version.>=(['<V>'])` — conferida na API com `validateOnly`; `app.version >= '1.2.3'` é recusado.
- A condição nova fica **acima** das antigas do mesmo app. Com ela embaixo, a publicação não faz efeito e não dá erro.
- O Firebase compara `app.version` como número (1.10 > 1.9). A expressão junta regras com `&&` e não tem "ou".
- Builds abaixo de V continuam recebendo o que recebem hoje: `utils` + `screens` (lib 1.0.26 a 1.4) ou o `settings` plano antigo (lib anterior a fevereiro). É isso que protege o expo-urna antigo no Android.
- O hot-updater pode levar a lib nova a um binário abaixo de V. Esse build não recebe o `settings` novo, e a lib cai no `utils` + `screens`.
- O mesmo mecanismo serve para uma mudança de formato no futuro (outro valor para builds ≥ outra versão).

## 5. Na lib (expo-utils)

- **Leitura** (`utils/settings.ts`, chamado pelo `getRemoteConfigUtils`, com o mesmo memo e o mesmo teto de 10 s): default `settings: "{}"`. Se o `settings` tem os dois blocos, usa. Senão, lê `utils` + `screens` como hoje. Um fetch só para os dois blocos (hoje o `getRemoteConfigScreens` lê à parte).
- **Globals** (nenhum app precisa mudar):

  | Global | Conteúdo |
  |---|---|
  | `remoteConfigUtils` | bloco `utils`, com o padrão de hoje (`is_ads_enabled` ligado em produção) |
  | `remoteConfigScreens` | bloco `screens` |
  | `remoteConfigs` | os dois juntos, `{...screens, ...utils}`: em conflito vale o `utils`, que é o que a lib lê |

  Hoje `remoteConfigs` é apelido do `utils`. Vira a visão junta, como era antes de fevereiro, e o merge feito à mão no expo-resultado fica redundante. O gate da loja continua gravando `is_ads_enabled: false` em `remoteConfigUtils` e em `remoteConfigs`. `getRemoteConfigScreens()` continua existindo e devolve o bloco.
- **Tipos:** `RemoteConfigSettingsType = { utils: RemoteConfigUtilsType; screens: RemoteConfigScreensType }`, exportado em `index.ts` e `index.d.ts`. O `cross_promo` continua obrigatório no `RemoteConfigScreensType`.
- **Telemetria:** o evento `cfg_integrity` ganha `cfg_source` (`settings` ou `legacy`), para ver no DebugView qual caminho cada build usou. O `cfg_hash` sai dos mesmos campos do bloco `utils`: build antigo e build novo da mesma plataforma com o mesmo hash provam que o legado gerado está certo. Atualizar `docs/ANALYTICS-EVENTS.md`.
- **`utils/types.ts` é a única fonte dos campos** (sem arquivo de schema à parte). O pldev e o editor leem o `RemoteConfigUtilsType` com o parser do próprio TypeScript, não com regex:
  - tipo e opções saem do tipo (`review_style: ReviewStyle`; o `review_type` deixa de ser `string` com comentário e vira `"store-review" | "popup" | "dialog"`);
  - a dica sai do comentário `/** … */` que o campo já tem;
  - o resto vira tag no mesmo comentário: `@section Anúncios`, `@label Anúncios ligados`, `@default ligado em produção` e `@platform android` (em `android_store_version` e `meta_install_referrer_key`; `ios_app_id` e `ios_store_version` levam `@platform ios`).
  Campo novo na lib = tipo + comentário com as tags, no mesmo lugar onde o tipo já é escrito.
- **Testes** (bun): `settings` com os blocos; `settings` plano antigo ignorado; sem `settings`; JSON inválido; os três globals; precedência no `remoteConfigs`; padrão dos anúncios.
- **Docs na mesma tarefa:** playbook de upgrade (Remote Config), README, AGENTS.md/CLAUDE.md (globals), `docs/ANALYTICS-EVENTS.md` e o texto do gerador em `docs/index.html` ("cole no bloco `utils`/`screens` do `settings`").
- Versão 1.5.0: compatível com quem não migrou.

## 6. No pldev

- **Arquivos:** `.pldev/.firebaserc/rc-config-ios.json` e `rc-config-android.json`, cada um com `{utils, screens}`, no lugar dos 4 `rc-config-{utils,screens}-{plataforma}.json`. O formato é o mesmo nos dois modelos (abaixo); só muda o que o pldev publica. Na primeira execução o pldev junta os 4 arquivos antigos nos 2 novos, como já faz ao organizar a pasta; se houver conflito, avisa e não sobrescreve. Backups e histórico continuam.
- **Modelo pela versão da lib:** o pldev lê a versão instalada em `node_modules/expo-utils/package.json` (o `package.json` do app pode apontar para um `.tgz` ou link, como no lab).
  - Abaixo da 1.5.0 (modelo antigo): publica só `utils` e `screens`. No Firebase nada muda.
  - Da 1.5.0 em diante (modelo novo): o primeiro `rc push` cria o parâmetro `settings` e a condição `app.id` + `app.version >= V`, com V sugerido a partir do `version` do `app.json` e confirmação antes de publicar. Dali em diante publica `settings` e, para os builds abaixo de V, as cópias em `utils` e `screens`.
  - Se o template já tem `settings` para o app, o pldev continua publicando os dois, mesmo que a lib local seja antiga (outra branch, por exemplo).
- **Campos:** lidos de `node_modules/expo-utils/utils/types.ts` do app (a versão da lib que aquele app usa; reserva: o repo local do expo-utils), com o `typescript` do próprio app (`require.resolve` a partir da pasta do app; todo app Expo tem, os locais estão na 6.0.3). Saem o parser por regex do `generateDefaultJson` e a lista `KNOWN_UTILS_FIELDS`, e com eles o bug do geo e os campos perdidos.
- **Sem comando de migração à parte:** a troca de modelo acontece no `rc push`, pela versão da lib. Na primeira vez ele mostra o `settings` que vai sair, a condição que vai criar (`<App> Settings`, acima das condições do mesmo app) e avisa se já existe `settings` antigo para aquele app. `--dry-run` só mostra.
- **`rc pull`:** baixa para o `rc-config-{plataforma}.json`: do `settings`, se o app já tem; senão, de `utils` e `screens`.
- **`rc push`:** publica conforme o modelo. Antes de publicar, mede o template (teto de 1.000.000 de caracteres somando o projeto) e recusa se passar. Mantém o ETag e o backup.
- **`rc create`:** app novo nasce só com `settings` (`{"utils": {"is_ads_enabled": false}, "screens": {}}`: continua nascendo sem anúncio, como hoje) e condição só por `app.id`. Sem campos vazios de enfeite.
- **`rc json`:** esqueleto mínimo `{"utils": {}, "screens": {}}`. Com `--full`, lista as chaves do `types.ts` com o padrão.
- **`rc legacy off` (novo), a migração de vez:** remove `utils`, `screens` e as condições antigas daquele app e plataforma. Só quando o GA4 mostrar que as versões abaixo de V sumiram.
- **Editor local (`rc edit`):** mostra o modelo em uso (versão da lib e V); um documento por plataforma, escolhido no topo (sem juntar); abas `utils` e `screens`; chave Formulário/JSON no canto superior direito. O formulário sai do próprio JSON, com o tipo deduzido do valor: booleano vira chave liga/desliga, e há campo para número, texto, texto longo, url, cor, data, lista de valores, lista de objetos e objeto. No `utils`, o `types.ts` acrescenta seção, rótulo, dica, opções e as chaves que faltam ("Definir"). As duas visões editam o mesmo dado.

## 7. Transição, app por app

1. Publicar a lib 1.5.0. Enquanto um app não atualizar, o pldev segue no modelo antigo para ele.
2. Atualizar a lib no app e rodar `pldev firebase rc push`: ele vê a 1.5.0, confirma V e cria o `settings` e a condição. Os builds que já estão nas lojas ficam abaixo de V e seguem com `utils` + `screens`.
3. Lançar o app na versão V.
4. Conferir no DebugView: `cfg_integrity` com `cfg_source = settings` no build novo e o mesmo `cfg_hash` num build antigo.
5. Quando o GA4 não mostrar mais versões abaixo de V: `rc legacy off`.

Ordem sugerida: o expo-utils-lab primeiro (projeto `local-desenv`), depois um app pequeno, e os de eleição por último, longe do 2º turno (25/10).

## 8. Editor online (depois)

- A entrega continua no Firebase. O editor só lê e grava pela API REST do Remote Config.
- Um item por plataforma na lista, porque os projetos podem ser diferentes. Mesmas abas, mesma chave Formulário/JSON e o mesmo formulário do editor local.
- Histórico próprio por app e plataforma. O do Firebase não serve: guarda 300 versões por projeto (somando todos os apps), apaga as antigas depois de 90 dias, e o rollback volta o template inteiro.
- Cloudflare Pages + Worker + D1, atrás do Cloudflare Access. Uma service account por projeto Firebase, guardada como secret do Worker.
- A mesma página no desktop e no celular.
- O `pldev rc push` passa a publicar pela API do editor, para o histórico ficar completo.
- Mockup (privado): https://claude.ai/artifact/1vSwBmXLzw2CaXRgFfDjnK
- O `pixel-config` (30/09) é outra coisa: substitui o Remote Config com entrega própria. Não é a base deste editor.

## 9. Perguntas em aberto

- Quem usa o editor online: só o dono ou mais gente (lista do Access e autor no histórico).
- Aposentar o `rc edit` local quando o editor online existir.
- Ordem dos apps na migração.

## 10. O que foi verificado e o que não foi

Verificado em 09/10/2026:

- Onde a lib e os apps locais leem `utils`, `screens` e `remoteConfigs` (busca no código), a versão da lib e a chave lida em cada
  clone local, e o app Android compartilhado entre expo-urna e expo-urna-v2 (`google-services.json`).
- O bug do gerador antigo do pldev, rodando o código contra o `types.ts`: o regex lia 19 dos 23 campos e gravava
  `geo_lookup_enabled: false`. O parser do TypeScript lê os 25 campos de hoje, com tipo, comentário e tags.
- Sintaxe da condição na API real com `PUT ?validateOnly=true` (a versão do template não mudou): `app.version.>=(['1.0.3'])`.
- Lib: `tests/settings.test.ts` (15 testes: formato novo, settings plano antigo ignorado, reserva em utils + screens, junção
  dos blocos, tags em todo campo) e o resto do `./tests/run.sh` passando; `tsc` limpo contra apps com RNFB 24, 25 e 26 (o
  código do expo-resultado e do expo-eleicao também; os 3 erros do expo-eleicao já existiam com a lib 1.4.0).
- pldev: `npm test` passando (`firebase-rc-model-smoke.js` novo e o `firebase-rc-dir-smoke.js` com a junção dos arquivos e o
  editor no modelo novo); editor dirigido no Chrome (Playwright) em 1280 e 390 px; e `pldev firebase rc push --dry-run` de
  verdade, numa cópia dos arquivos do Resultados com a lib marcando 1.5.0: juntou os arquivos, perguntou o V, montou a condição
  e o Firebase validou o template. Releitura do template depois: nada publicado.

Não verificado:

- Nenhum app leu o `settings` de verdade: nada foi publicado e nada foi medido no destino (`cfg_source` no DebugView). O
  projeto do lab (`local-desenv`) não está nas contas autorizadas do pldev.
- O template real dos outros projetos: se o `settings` antigo do expo-urna ainda existe e quanto cada projeto ocupa.
- Os arquivos locais do `.pldev` podem estar velhos (o do Resultados é de 02/10; o Firebase mudou pelo console em 03/10): rodar
  `rc pull` antes do primeiro `rc push`.

Fontes: [Remote Config — quotas and limits](https://firebase.google.com/docs/remote-config/quotas-limits), [Remote Config — templates and versioning](https://firebase.google.com/docs/remote-config/templates), [Remote Config — conditional expression reference](https://firebase.google.com/docs/remote-config/condition-reference).
