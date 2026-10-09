# Store-Ready Playbook (pldev + Fastlane + AI)

Playbook operacional para deixar um app Expo **pronto para envio** (iOS e/ou Android) numa conta alvo. Escrito para outra IA executar sem redescobrir o fluxo.

**Conta de referência deste run:** `brunovercosa487@gmail.com` (Bruno / bruno487)  
**Projeto de referência:** `expo-eleicao-1` (Eleição) — iOS only neste run.

---

## 0. Regras mandatórias

### 0.1 Gate humano — um passo por vez

Antes de **cada** etapa:

1. Dizer o que vai fazer, por quê, e o que muda (arquivos / serviços remotos).
2. Perguntar confirmação (e dados em falta).
3. **Só executar depois do OK explícito** do usuário.
4. Reportar resultado e só então propor a próxima etapa.

**Proibido** rodar o pipeline inteiro no automático.

### 0.2 Credenciais — criar só se faltarem

| Recurso | Já existe no cache pldev / conta | Não existe |
|---------|----------------------------------|------------|
| ASC (p8, issuer, team, Apple ID) | `pldev fastlane auth apply` → selecionar a conta | `pldev fastlane auth save` e/ou `pldev automation appstore` |
| RevenueCat (project, apps, sk_/public keys) | `pldev rc status` / `pull` + apply | `pldev revenuecat create` (ver §0.3 manual) |
| AdMob OAuth | Só `pldev admob create` / `pull` no app | `pldev admob auth` |
| Firebase OAuth | Só `pldev firebase create` | `pldev firebase auth` |
| Blogger OAuth | Só `pldev blogger pp` | `pldev blogger auth` |
| EAS session/conta | Usar conta certa se já logada | `pldev eas login` **só se a sessão não for a conta alvo** |

**Nunca** recriar keys ASC, secret RC ou reautorizar Google “por precaução” se o status já mostra OK.

Comando canônico para **reutilizar** credenciais de store no projeto:

```bash
pldev fastlane auth apply
# (seleciona a conta interativamente)
# alias: pldev fastlane auth a
```

Opcional “tudo da conta de uma vez” (store + shared keys + RC salvo):

```bash
pldev fastlane use brunovercosa487@gmail.com
# ou: pldev fastlane use --select
```

### 0.3 RevenueCat — passo manual do script

`pldev revenuecat create` / fluxos RC podem exigir que o **usuário cole um script** (ou finalize config) **na conta** (dashboard RC e/ou ASC).

Fluxo da IA:

1. Rodar o comando RC (após OK).
2. Se o CLI pedir script / ação no painel: **mostrar o script/instruções**, parar e pedir ao usuário para colar/executar.
3. Só continuar depois do usuário **avisar que deu certo**.

### 0.4 EAS projectId

Placeholder legado do **expo-utils** (apagar se for **exatamente** este):

```text
df0dc510-fafe-4076-9ea7-6926d54cb2ab
```

| Situação | Ação |
|----------|------|
| Projeto **novo** com placeholder acima | Apagar `extra.eas.projectId` → `pldev eas create` |
| Projeto **novo** sem projectId | `pldev eas create` |
| Projeto **novo** com projectId **real** já da conta certa | Não apagar |
| **Rehome / migração de conta** (ex.: Diego → Bruno) | Apagar projectId atual (mesmo real) → garantir conta EAS alvo → **`pldev eas create`** |

Comando correto de projeto (não é “só login”):

```bash
pldev eas create          # cria ou vincula (eas init)
pldev eas create --id <projectId>   # vincula id existente
pldev eas status          # valida conta / slug / projectId / versão
pldev eas pull            # escolhe projeto da conta e grava projectId
```

`pldev eas login` só para trocar/cadastrar sessão de conta EAS quando a ativa não for a alvo.

### 0.5 Bundle ID e product IDs

Quando o pedido for **bundle 100% novo**:

- Gerar reverse-DNS com **todos os segmentos novos** (não reaproveitar segmentos da conta/app antigo, ex. não derivar de `br.eleicaopresidencial.app`).
- Apresentar ao usuário e **só gravar após OK**.

App Group / widgets:

```text
group.<bundleId>
```

Product IDs **sempre** com prefixo do bundle:

```text
<bundleId>.weekly
<bundleId>.monthly
<bundleId>.annual
<bundleId>.pass2026
<bundleId>.removeads
```

Atualizar em lockstep:

- `app.json` (`ios.bundleIdentifier`, entitlements groups, plugin `voltra.groupIdentifier`, `extra.accounts`)
- `src/components/paywalls/defaults.ts` → `PRODUCTS`
- `fastlane/ios/fastlane/iap/**` (`product_id.txt` + pastas se o kit amarra path ao id)
- Android package / IAP se o escopo incluir Android

### 0.6 CNG

- **Nunca** editar `ios/` ou `android/` gerados à mão.
- Identidade nativa só via `app.json` / plugins / prebuild no EAS.

### 0.7 Facebook

Só criar/reconfigurar Facebook se o usuário **pedir explicitamente**. Default: não criar app FB novo.

### 0.8 Policy checks — ler ANTES do build de submissão

Antes de qualquer build que vá para a loja (etapa de build/submit), **ler o arquivo inteiro**
`.claude/POLICY-CHECKS.md` do app e conferir item por item contra o código. É a lista de regras
que **já derrubaram build de verdade** (Apple/Google), com app, versão e data da rejeição.

```bash
# se o app ainda não tem o arquivo (ou está desatualizado — ele é gerado pelo expo-utils):
npx expo-utils-install --policy-checks
```

Regras: não confiar na memória (a lista cresce a cada rejeição); não editar a cópia do app (é
sobrescrita — regra nova vai em `templates/POLICY-CHECKS.md` no repo `expo-utils`); rejeição nova
que chegar vira item novo lá, na mesma tarefa em que o app é corrigido.

Hoje o item mais fácil de violar sem perceber é o **P-001** (Apple 5.1.1(iv)): tela custom antes
de um pedido de permissão só pode **explicar**, nunca **decidir** — botão de avanço neutro
(`Continuar`, nunca `Permitir acesso`) e **nenhuma** saída que adie o pedido (`Cancelar`, X, swipe,
overlay). Caso real: *Escanear Documentos* 1.0 (6), 14/08/2026.

---

## 1. Inputs a coletar no início

Perguntar (ou ler do pedido) antes da etapa 1:

| Input | Exemplo |
|-------|---------|
| Conta pldev alvo | `brunovercosa487@gmail.com` |
| Plataformas | `ios` / `android` / ambos |
| Bundle ID | manter / **gerar 100% novo** |
| Facebook | sim / **não** |
| Build + submit binário | sim / não |
| Hot Updater + Remote Config | sim / não |
| Onde está o kit fastlane | `./fastlane` (este repo) |

---

## 2. Pré-flight (somente leitura; ainda assim confirmar se for rodar comandos de status)

```bash
pldev admob list
pldev blogger list
pldev firebase list
pldev eas login --list
pldev eas login --whoami
pldev automation status   # selecionar conta, ou passar a conta se o CLI aceitar
pldev fastlane auth status
pldev rc status
```

Ler no projeto:

- `app.json` → bundle, projectId, plugins ads/FB, `extra.accounts`
- `src/constants/Strings.ts` → rckey, adUnits, hotUpdaterUrl
- `src/components/paywalls/defaults.ts` → PRODUCTS, LEGAL_URLS
- `fastlane/.env` keys (sem vazar secrets no chat)
- `fastlane/ios/fastlane/metadata/**`, screenshots, iap
- Placeholder EAS vs projectId real

Anotar leftovers da conta antiga (email, pub-id AdMob, blogspot, rckey, product ids, Firebase project).

---

## 2.1 Gate de credenciais (bloqueante — **não** é read-only)

**Se iOS está no escopo, isto roda antes da Etapa A.** Falhou aqui, o job não começa.

Android-only, ou iOS fora do escopo e sem credencial preenchida: pular a seção inteira.

**Por que existe**

`pldev fastlane auth status` é uma checagem de **presença**, campo a campo, toda offline:

```js
// eas-login-cli/commands/fastlane.js
printStatusLine('Senha Apple ID', present(apple.password), 'salva');
```

“salva” **não** quer dizer “correta”. E a única etapa que usa a senha é a **M.1**, lá no
fim. Uma senha errada ou vencida no cache só aparece depois de metadata, IAP, screenshots,
RevenueCat e build prontos — quando corrigir custa uma ida ao usuário e o job trava.

**1. Presença**

```bash
pldev fastlane auth status
```

Com iOS no escopo, **todas** as linhas Apple têm de estar `ok`: Apple ID, Senha, Team ID,
ASC Key ID, ASC Issuer ID, AuthKey .p8, IAP Key ID, IAP .p8, Vendor number, Shared secret.
Qualquer `faltando` → resolver antes (`pldev fastlane auth apply` / `save`,
`pldev automation appstore`).

**2. Onde a senha mora**

`eas-accounts.json` → `accounts[].fastlane.apple.password`.

> **Cuidado:** o mesmo objeto tem `fastlane.revenuecat.password`, que é **outra** senha e
> costuma ser parecida — num caso real as duas diferiam por **um único caractere no fim**.
> Pegar a errada gasta tentativa de login à toa. Conferir a chave, não a semelhança.

Nunca imprimir a senha no chat nem no log.

**3. Validar de verdade**

```bash
export FASTLANE_USER="<apple id da conta>"
export FASTLANE_PASSWORD="<do cache — nunca imprimir>"
export SPACESHIP_2FA_SMS_DEFAULT_PHONE_NUMBER="+55DDDNUMERO"   # número confiável, completo
bundle exec fastlane spaceship spaceauth -u "$FASTLANE_USER"
```

`spaceauth` faz `Spaceship::Tunes.login` e mais nada: valida usuário + senha + 2FA **sem**
depender do app existir no ASC. Sucesso = `Successfully logged in to App Store Connect`.

Efeito colateral que vale ouro: grava `~/.fastlane/spaceship/<user>/cookie`, válido ~30
dias. Com o gate feito, **a Etapa M.1 depois não pede 2FA**.

**4. O 2FA**

- `pldev sms code` espera o próximo código (`--last` pega o mais recente);
  `pldev sms watch` fica observando ao lado do fastlane.
- Pool: <https://theblueboxapps.com/sms/> · API `…/sms/index.php?api=sms`.
- `SPACESHIP_2FA_SMS_DEFAULT_PHONE_NUMBER` **dispensa o menu de escolha de telefone** —
  é justamente ali que se queima tentativa por casar regex na linha de ajuda
  (`select a trusted phone number to send the code as a text message`) em vez do prompt real.
- Se cair no prompt de dispositivo confiável (`Please enter the 6 digit code:`), responder
  `sms` é **escape**, não tentativa — não gasta código.

**5. Teto de tentativas**

**No máximo 2 tentativas de senha.** Errar mais bloqueia o Apple ID e derruba todos os apps
da conta. Duas falhas: parar e perguntar ao usuário. Nunca inventar código, nunca mandar
2FA vazio em loop.

**Sucesso:** `auth status` sem `faltando` no bloco da plataforma em escopo + `spaceauth`
logado. Só então seguir para a Etapa A.

---

## 3. Ordem canônica (1 etapa = 1 OK)

### 3.0 Ordem preferida no fechamento (ads-only / app novo sem IAP)

Depois do prepare local (identidade, EAS project, Firebase **apps/plist**, AdMob,
privacy, credenciais ASC/Play, metadata, screenshots), a cauda **obrigatória** é:

| # | Etapa | Por quê |
|---|--------|---------|
| 1 | **Firebase Remote Config** (utils + screens) — O.1 | Config de runtime antes do binário de produção |
| 2 | **Hot Updater** — O | OTA na conta alvo; `hotUpdaterUrl` no binário |
| 3 | **Validar o OTA** — O.2 | Provisionar não é testar; exige um build **release** (local ou EAS) |
| 4 | **Build + submit** — P | Cria app record no ASC se faltar; sobe binário iOS/Android |
| 5 | **Push store** — M (+ M.1 privacy se precisar) | Listing só depois do app existir; **`skip_iap:true`** se sem IAP |
| 6 | **Checklist + CHATHISTORY** — Q | Grep leftovers e fechar o job |

O.2 pode vir **antes** do P quando já houver build release local
(`npx expo run:ios --configuration Release`); o que ele não aceita é rodar sem binário
release nenhum, porque em dev o OTA nem é baixado.

**Com IAP no escopo**, entram ainda: **H.1** (limpar localizações herdadas) logo após o app
record existir, **I.2** (copy × catálogo) junto do catálogo, **L.1** (vídeo de review) junto
dos screenshots, e **P.1** (anexar IAPs à revisão) entre P e Q.

**Não** intercalar push listing antes do primeiro build em app **novo** na conta
alvo (sem app record no ASC o push costuma falhar).

**Pular por padrão** quando o pedido for só AdMob: I, I.1, J, N (IAP + RevenueCat).

Prepare ainda segue A→G e K/L (metadata/screenshots) em paralelo ao cauda acima;
D (Firebase **create** apps) fica no prepare, **antes** da cauda. O.1 é o RC
(utils/screens), não recriar o projeto Firebase.

---

### Etapa A — Playbook / contexto

- Garantir que este arquivo existe e foi lido.
- Registrar conta alvo e decisões no CHATHISTORY ao final do job.

### Etapa B — Identidade (bundle + product IDs)

1. Propor bundle ID (se “gerar novo”) + mapa de product IDs.
2. Após OK: gravar `app.json`, groups, voltra, paywall `PRODUCTS`, árvore IAP.
3. Atualizar `extra.accounts` para a conta alvo (eas/fastlane/firebase/ios/rc labels).

**Sucesso:** grep não acha o bundle/product IDs antigos nos paths de identidade/IAP/paywall.

### Etapa C — EAS project

1. Se rehome/placeholder: remover `extra.eas.projectId`.
2. Conta EAS = alvo (`whoami`; login só se errado).
3. `pldev eas create`
4. `pldev eas status`

**Sucesso:** `projectId` novo, owner/conta alvo.

### Etapa D — Firebase (plist / google-services)

```bash
pldev firebase create -p ios -a <conta>
# ou -p all se Android no escopo
```

**Sucesso:** `GoogleService-Info.plist` (e json Android se aplicável) com PROJECT_ID da conta alvo; `app.json` aponta para os arquivos.

### Etapa E — AdMob

```bash
pldev admob create    # wizard: conta + app + units
pldev admob pull      # Strings.ts adUnits + app.json iosAppId/androidAppId
```

**Sucesso:** `ca-app-pub-<pub-da-conta-alvo>~…` e units no `Strings.ts`.

### Etapa E.1 — Mediation (contas das redes + grupos no AdMob)

O build já sai com os adapters das 4 redes padrão — AppLovin, Meta, Unity e Pangle (expo-utils,
opção `mediation`, ligada por padrão). Liftoff, Mintegral, BidMachine, Moloco e BIGO existem no
catálogo e entram se listadas: `"mediation": ["applovin","meta","unity","pangle","moloco"]`.
**Adapter no build não serve ad**: sem conta na rede e grupo de mediação no AdMob, é só peso.

Pré-requisitos (uma vez por app):

1. App publicado (ou com store URL) — a maioria das redes recusa aprovação sem listing.
2. **`app-ads.txt`** no blog da conta (o mesmo domínio da política de privacidade) com a linha
   do AdMob **e a de cada rede**. Sem isso o bidder derruba ou zera o lance — é o item que mais
   custa receita silenciosamente. Validar no AdMob → Apps → app-ads.txt.
3. Dados fiscais/bancários preenchidos em **cada** rede (conta "pending" não serve ads).
4. `bundleIdentifier` / `package` idênticos aos das lojas.

Fluxo por rede (sempre o mesmo): criar conta → cadastrar o app (iOS e Android são apps
separados) → criar placements por formato → copiar IDs + chave de reporting → no AdMob:
**Mediation → Create mediation group → Add ad source** → colar os campos → mapear o ad unit.

| rede | portal | o que criar lá | o que o AdMob pede | modo |
| --- | --- | --- | --- | --- |
| AppLovin | dash.applovin.com | app + zones (só p/ waterfall) | SDK Key, Report Key, Zone ID (waterfall) | bidding + waterfall |
| Meta Audience Network | business.facebook.com → Monetization Manager | propriedade + placements; ligar o AdMob como parceiro de bidding | App ID, Placement ID | **bidding only** |
| Unity Ads | dashboard.unity.com → Unity Ads Monetization | projeto/app + placements | Game ID (por plataforma), Placement ID, Organization Core ID + API Key | bidding + waterfall |
| Liftoff Monetize | publisher.vungle.com | app + placements | App ID, Placement Reference ID, Reporting API Key | bidding + waterfall |
| Mintegral | portal do publisher Mintegral | app + placement + ad unit | App ID, App Key, Placement ID, Unit ID, Skey/Secret | bidding + waterfall |
| Pangle | partner.pangleglobal.com | app + ad slots | App ID, Slot ID, chave de reporting | bidding + waterfall |

Os nomes dos campos mudam com o tempo — **o wizard "Add ad source" do AdMob é a fonte da
verdade**. A chave de reporting é o que liga o *ad source optimization* (eCPM automático por
país); sem ela a rede fica com eCPM manual.

Montagem recomendada: **1 grupo por formato** (app open / banner / interstitial / rewarded),
todas as fontes do build em **bidding**, waterfall só como complemento com floor. Ligar também o
*Impression-level ad revenue* + link AdMob↔Firebase (é o que traz `ad_impression` com
`ad_source` para o Firebase — sem isso não dá para comparar rede por rede depois).

Nenhuma credencial de rede entra no app: o binário só tem o AdMob app id (`app.json`) e os ad
units (`Strings.ts`).

**Sucesso:** Ad Inspector no dev build listando as fontes configuradas e servindo ad de teste em cada uma.

### Etapa F — Política de privacidade (Blogger)

**Antes de rodar:** `app.json` → `extra.accounts.blogger` tem de existir e apontar para a
conta alvo. É de lá que o `pldev blogger pp` decide em qual blog publicar; **sem a chave ele
abre na primeira conta da lista** e um Enter às cegas publica a política no blog de outro
app. Já aconteceu — dois posts em blogs errados, que tiveram de ser apagados pela API.

Corolário: em prompt interativo do pldev, **ler o que está selecionado antes de confirmar**.
Nunca mandar Enter sem ver a linha do `❯`.

```bash
pldev blogger pp      # conta alvo
```

Aplicar URL HTTPS em:

- `LEGAL_URLS.privacy` (paywall)
- `fastlane/ios/fastlane/metadata/<locale>/privacy_url.txt`
- support/marketing se a política do app usar a mesma base

**Sucesso:** nenhuma URL da conta antiga (ex. blogspot Diego) no app/metadata.

### Etapa G — Credenciais ASC no projeto

```bash
pldev fastlane auth apply   # selecionar conta alvo
# se faltar credencial: pldev fastlane auth save  OU  pldev automation appstore
```

**Sucesso:** `fastlane/.env` com APPLE_ID/team/key da conta alvo; `AuthKey_KEY_ID.p8` presente; não é a conta antiga.

### Etapa H — App record ASC

- Neste fluxo Pixel Logic, o **registro do app no ASC costuma ser criado pelo `pldev eas build`** (credenciais Apple / EAS Submit), não por um `produce` separado.
- Se o app ainda não existir no ASC, **não bloqueie** o prepare local (metadata, IAP tree, RC); rode o **build** quando o binário for a etapa, e só então `fastlane ios push all` se o ASC ainda não aceitar uploads sem app.
- Se o app **já** existir (bundle já no ASC), pode fazer `push all` antes do build.

### Etapa H.1 — Limpar localizações herdadas do app record

Assim que o app existir no ASC. O registro nasce com um **idioma default** (normalmente
`en-US`) e um **nome placeholder** — tipo `Escanear Documentos (e14704)`, com o sufixo que o
criador inventou para escapar de nome já reservado.

Se o projeto mantém só um locale (ex.: `metadata/pt-BR/` e mais nada), essa localização
órfã fica **vazia** e bloqueia a submissão com quatro erros de uma vez:

```
You must provide a value for the attribute 'description'
You must provide a value for the attribute 'keywords'
You must provide a value for the attribute 'supportUrl'
You must provide a value for the attribute 'privacyPolicyUrl'
```

Procedimento:

1. Conferir o `primaryLocale` do app (`GET /v1/apps/{id}`). A primária **não** se apaga.
2. Listar `appInfoLocalizations` e `appStoreVersionLocalizations`.
3. Para cada locale que não é a primária **e** não existe em `metadata/`: apagar o
   `appInfoLocalization`. A deleção **cascateia** para o `appStoreVersionLocalization`
   correspondente — não precisa apagar os dois.

**Sucesso:** os locales no ASC são exatamente os que existem em `metadata/`.

### Etapa I — Catálogo IAP local

- Product IDs = `<bundleId>.<sku>` (ver §0.5).
- Subscription group + localizations + pricing coerentes com o kit.

> ### ⚠️ Todo `iap_push` pode apagar arquivos do catálogo
>
> A lane `iap_push` chama o `export_iap_catalog` logo depois do push, e o export começa com
> `FileUtils.rm_rf(output_dir)` — regenera a árvore inteira e só preserva `README.md` e
> `.gitkeep`. O que ele não sabe reconstruir, **some**:
>
> - **metadata do RevenueCat** (`entitlement_id`, `offering_id`, `package_id`,
>   `revenuecat_*`) quando `IAP_PULL_INCLUDE_INTERNAL_METADATA=false` — sem eles o
>   `revenuecat sync iap` aborta;
> - **`pricing/` dos IAPs não-consumíveis**, porque o export lista `inAppPurchasesV2` sem
>   `include=iapPriceSchedule`; a API então omite o relacionamento, `price_schedule_id` sai
>   `nil` e a chave `pricing` é descartada **sem nenhum warning**.
>
> Regra: **`git diff` no catálogo depois de todo `iap_push`** e restaurar o que sumiu
> (`git checkout <commit> -- <path>`). O preço no ASC não é afetado — some só o arquivo
> local, o que faz o próximo push parecer correto enquanto o catálogo já mente.

### Etapa I.1 — Review screenshots IAP (**OBRIGATÓRIO antes do primeiro IAP push**)

Sem `review/screenshot.{png,jpg,jpeg}` em **cada** produto, o ASC fica em **Missing Metadata** e o RevenueCat costuma espelhar o mesmo status.  
**Nunca** rodar `fastlane ios push iap` / `push all` (com IAP) se algum product ativo estiver sem foto **ou** se a foto tiver **alert de sistema** (ex.: “Abrir com…?”).

#### Checklist pré-push IAP

```bash
# Listar products e se têm screenshot de review
find fastlane/ios/fastlane/iap/products -name product_id.txt | while read f; do
  dir=$(dirname "$f")
  id=$(cat "$f")
  if ls "$dir"/review/screenshot.* >/dev/null 2>&1; then echo "HAS  $id"; else echo "MISS $id"; fi
done
```

Se **qualquer** `MISS`: **parar** e abrir o gate abaixo.

#### Gate humano — como obter as fotos

Perguntar ao usuário **o que prefere** (sempre):

1. **Usuário fornece** — um link/path por product, ou **uma única** foto para copiar em todos.
2. **IA tira as fotos com Maestro** — flow do paywall/compra (preferido).

#### Opção 2 — Maestro (obrigatório se a IA for capturar)

**Não** usar só `simctl io screenshot` + deep link solto: o iOS costuma mostrar alert “Abrir com…?” e **suja o print**. Use **Maestro**.

1. Priorizar simulador **já booted** (`xcrun simctl list devices booted`). Não bootar outro se já houver um (salvo pedido).
2. Device preferido do repo: iPhone 17 Pro Max (`AGENTS.md` / UDID do projeto).
3. Flow de referência neste app: `.maestro/iap-review-paywall.yaml`
   - `launchApp` + permissões
   - `openLink` para rota do paywall (ex. `expoeleicao://paywall-premium`)
   - se aparecer **Abrir** / **Open**, **tap** (sumir o alert **antes** do print)
   - `extendedWaitUntil` no copy do paywall (regex se o a11y tiver ícone, ex. `.*Assinar agora.*`)
   - `assertNotVisible` de `.*Abrir com.*`
   - `takeScreenshot: iap-review-paywall`
4. Rodar (exemplo):

```bash
UDID=$(xcrun simctl list devices booted | awk -F '[()]' '/Booted/{print $2; exit}')
maestro --device "$UDID" test .maestro/iap-review-paywall.yaml
# artefato em ~/.maestro/tests/<timestamp>/
```

5. Converter/copiar o PNG limpo para **todos** os products ativos:

```bash
# screenshot.jpg em cada review/
# subscriptions/<id>/review/ e non_consumables/<id>/review/
```

6. Validar visualmente (abrir a imagem): **proibido** enviar se houver dialog do sistema no meio da tela.
7. **Só** gravar dentro do contrato do kit:  
   `fastlane/ios/fastlane/iap/products/**/review/screenshot.{jpg,png}`  
   **Nunca** criar pastas/arquivos soltos em `fastlane/ios/fastlane/iap/` (ex.: `maestro-out/`, `_preview_*.jpg`) — o Fastlane/kit **não** os entende. Preview/debug: `/tmp` ou `~/.maestro/tests/`.

Uma captura boa do paywall serve para **todos** os SKUs do mesmo app (Apple aceita a mesma review image).

#### Depois de ter as fotos

```bash
bundle exec fastlane ios push iap force_all:true skip_policy:true
```

**Sucesso:** zero `MISS`; foto limpa; no ASC/RC some Missing Metadata após processamento (minutos).

**Proibido:**
- print com alert “Abrir com…?”, ATT, permissão, etc.
- placeholder 1×1
- pular o gate
- `simctl screenshot` sem dismiss de alert (use Maestro)

### Etapa I.2 — Copy do app × catálogo (consistência)

O paywall e a descrição da loja prometem coisas que **têm de existir no App Store Connect**.
Um app já foi para a fila anunciando “3 dias grátis” em três lugares do código e na
descrição, com **zero** introductory offer configurada: quem assinasse era cobrado na hora.
Isso é termo enganoso — rejeição provável, e prejuízo real se passar.

```bash
# promessas na copy
grep -rn "grátis\|gratis\|trial\|dias\|R\$" src/constants/Texts.ts
grep -rn "grátis\|gratis\|trial" fastlane/ios/fastlane/metadata/*/description.txt
```

Cruzar cada promessa com o catálogo:

| Promessa na copy | Tem de existir |
|------------------|----------------|
| “X dias grátis” / “trial” | introductory offer `FREE_TRIAL` no produto |
| preço citado em texto fixo | o mesmo preço no `pricing/` **e** no ASC |
| “sem anúncios”, “ilimitado” | o entitlement realmente destravando isso |

Se divergir: ou cria a oferta, ou tira a promessa. Não enviar torto.

O kit **não** cobre introductory offers, e a API tem duas armadilhas: o relacionamento
`territory` é **obrigatório** (não existe oferta “para todos” — é um recurso por território,
`ALL` se resolve lendo a disponibilidade real do produto), e trocar `offerMode`/`duration`
exige apagar e recriar. Referência com as duas actions prontas:
`expo-docscanner/resources/fastlane-kit/introductory-offers.md`.

### Etapa J — RevenueCat projeto/apps/keys

```bash
pldev rc status
# se incompleto para este app:
pldev revenuecat create --ios [conta]
```

- Se pedir script no painel: **usuário cola e avisa OK**.
- Confirmar `rckey` (`appl_…`) em `Strings.ts` e `REVENUECAT_*` no `.env`.

### Etapa K — Metadados anti-spam

Seguir `fastlane/PROMPT_STORE_METADATA.md` + READMEs de metadata.

Reescrever (não copiar listing de outra conta):

- name, subtitle, description, keywords, promotional_text, release_notes
- privacy_url, support_url, marketing_url, copyright
- categories, review_information
- `app_privacy_details.json`, `app_rating_config.json` se aplicável

**Sucesso:** checklist de limites/caracteres dos READMEs; textos distintos da conta anterior.

### Etapa L — Screenshots

#### Os slots que a Apple realmente exige

| Slot | Resoluções aceitas | Quando |
|------|--------------------|--------|
| `APP_IPHONE_65` | 1242×2688 ou 1284×2778 | sempre |
| `APP_IPAD_PRO_3GEN_129` | 2048×2732 | `ios.supportsTablet: true` |

**`APP_IPHONE_67` (1290×2796) não é exigido — e é o único que o gerador do kit produz.**
Confiar no gerador e parar por aí é enviar sem nada do que a Apple pede; o erro só aparece
na submissão:

```
App screenshot missing (APP_IPHONE_65)
App screenshot missing (APP_IPAD_PRO_3GEN_129)
```

O slot é decidido pela **dimensão do arquivo**, não pelo nome — a tabela é
`DEVICE_RESOLUTIONS` em `deliver/lib/deliver/app_screenshot.rb`. O prefixo
`0_APP_IPHONE_65_` serve só para ordenar.

#### Como cobrir o que falta

- **6.5"**: derivar do 6.7" com resize para **1284×2778**. A proporção muda 0,18%
  (0,4614 → 0,4622), imperceptível numa composição de fundo + aparelho.
- **iPad 12.9"**: compor em 2048×2732 com a mesma direção de arte. Referência pronta:
  `expo-docscanner/resources/review/compose_ipad.py`.

#### Enviar e **conferir**

```bash
bundle exec fastlane push screenshots      # namespace push — ver o aviso da Etapa M
```

O deliver sobe em paralelo e **cria duplicatas**: um set de 4 pode virar 6 ou 7 imagens, com
o mesmo `fileName` repetido. Depois de todo push, listar `appScreenshotSets` →
`appScreenshots` por locale e conferir a contagem; havendo repetido, apagar
(`DELETE /v1/appScreenshots/{id}`) e reordenar
(`PATCH /v1/appScreenshotSets/{id}/relationships/appScreenshots`).

**Sucesso:** cada slot exigido com exatamente o número de imagens do set local, na ordem.

### Etapa L.1 — Vídeo de demonstração para a App Review (**obrigatório**)

Todo app enviado leva um vídeo anexado nas review notes: uma gravação de tela do build
**release** percorrendo o fluxo inteiro. Ajuda a revisão e é a evidência que os gates de
política de ATT pedem.

#### Requisitos do vídeo

1. **O primeiro frame é a splash.** Nunca pode aparecer a springboard — cortar exatamente
   onde a splash começa e **conferir o frame inicial** antes de anexar.
2. **O prompt de ATT tem de aparecer**, e a escolha é “Pedir ao App para Não Rastrear”: o
   resto do vídeo então prova que recusar não trava nada.
3. Esperas maiores que num flow de teste — o vídeo precisa ser legível por um humano.
4. Comprimir (poucos MB) e citar o vídeo nas `metadata/review_information/notes.txt`.

#### As armadilhas (todas custaram regravação)

- **O status do ATT vive no TCC e sobrevive a `clearState` e à reinstalação.** Uma vez
  concedido, o prompt nunca mais aparece. Só `xcrun simctl erase <UDID>` devolve
  `notDetermined` — conferir `trackingAuthorizationStatus - 0` **antes** de gravar.
- **Nunca `permissions: all: allow` no flow da demo.** Concede o ATT em silêncio; foi o que
  fez o prompt sumir das primeiras gravações. E `simctl privacy` não tem serviço `tracking`,
  então não dá para desfazer sem apagar o simulador.
- O `simctl erase` **reseta o idioma** para inglês e quebra todo seletor em português —
  regravar `AppleLanguages`/`AppleLocale` e reiniciar antes do flow.
- **O iOS mostra um alerta de sistema por vez.** Notificações e ATT competem pela mesma
  janela e não saem os dois na mesma tomada; priorizar o ATT.
- **Não escrever timestamp que você não conferiu frame a frame.** Descrever a ordem das
  telas é mais seguro que citar segundos — uma linha do tempo inventada já foi parar nas
  notes e teve de ser refeita.

#### Anexar

O kit não expõe `app_review_attachment_file`. Vai por um `Deliverfile` (**não** gerenciado
pelo kit, então sobrevive ao `pldev fastlane update`):

```ruby
# fastlane/ios/fastlane/Deliverfile
app_review_attachment_file "/caminho/ABSOLUTO/para/app-demo.mp4"
```

Caminho **absoluto e literal**, de propósito: relativo quebra porque o fastlane troca de
diretório durante o upload, e `__FILE__` não serve porque o FastlaneCore avalia o arquivo
com `eval` — o caminho vira `(eval at fastlane_core/...)`.

**Sucesso:** log com `Uploading review attachment file to App Store Connect`; primeiro frame
verificado; ATT visível.

### Etapa M — Push store (obrigatório)

**Antes:** se o push incluir IAP, a **Etapa I.1** tem de estar verde (todas as review screenshots).

```bash
# na raiz do kit / conforme README do projeto:
fastlane ios push all
# ou: bundle exec fastlane push all
# opções comuns: skip_iap:true | skip_policy:true | force_all:true
```

> **Rodando de dentro de `fastlane/ios`, use a forma do namespace.** Lá o
> `platform :ios` tem uma lane `push` que é **metadata sem screenshots nem
> binário** — `fastlane ios push all` vira essa lane com um argumento solto,
> termina com exit 0 e **nenhum screenshot sobe**. O erro só aparece na
> submissão, como `App screenshot missing (APP_IPHONE_65)`. Confira com
> `bundle exec fastlane lanes`: o que existe ali é `ios push`, `ios push_all` e
> o namespace `push` (`push all`, `push screenshots`, …).

- Se IAP ainda sem fotos: `skip_iap:true` no push de listing, **depois** I.1 + `push iap`.
- Inclui metadata + screenshots + privacy + IAP (quando catálogo ativo), conforme kit.
- **App Privacy Details** pode ser **pulado** pelo kit se o JSON declara tracking e o ASC já tem privacy — ver **Etapa M.1**.
- **Obrigatório para “Adicionar para revisão”** (fora do `deliver` puro — lanes próprias):
  - `app_information.json` → direitos de conteúdo (`DOES_NOT_USE_THIRD_PARTY_CONTENT` ou `USES_THIRD_PARTY_CONTENT`)
  - `app_pricing.json` → faixa de preço (`free: true` ou `price_point_id`)
  - Enviar com:
    ```bash
    bundle exec fastlane ios push information
    bundle exec fastlane ios push pricing
    ```
    (ou `push all` **sem** `skip_information` / `skip_pricing`)
  - Sem isso a Apple bloqueia review: *“É necessário configurar as informações de direitos de conteúdo…”* e *“escolher uma faixa de preço em Preços”*.

#### `push all` iOS: o kit **envia** information/pricing — mas a ordem atual é frágil

Código (`ios/fastlane/Fastfile` → `push_ios_all_components`), **ordem atual (até kit corrigir)**:

1. policy gate  
2. deliver (metadata + screenshots)  
3. privacy  
4. **IAP**  
5. **app_information**  
6. **pricing**

**Sim, o `push all` inclui information e pricing.** Não é feature ausente.

**Porém:** a sequência é **all-or-nothing** (sem `begin/rescue` por componente). Se o **IAP** levanta (ex. `SSL_read: unexpected eof` no `export_iap_catalog` **depois** do upload), o lane **aborta** e **information + pricing nunca rodam**.

Evidência típica:

- log para no IAP com erro SSL  
- `.push-state/push-all.json` só com `metadata` / `screenshots` / `privacy` (sem `app_information` / `pricing`)  
- ASC bloqueia review por direitos de conteúdo + preço  

**Workaround obrigatório da IA (até o kit reordenar + isolar):**

1. Depois de **qualquer** `push all` que falhou ou mesmo “meio ok”, **sempre** verificar/forçar:

```bash
bundle exec fastlane ios push information force_all:true
bundle exec fastlane ios push pricing force_all:true
```

2. Ou, se IAP for o risco:  
   `push all skip_iap:true` (sobe metadata/privacy/**information/pricing** se o lane atual ainda rodar IAP no meio — **com a ordem atual, skip_iap ainda deixa information/pricing depois**; se IAP for skipado e não falhar, information+pricing rodam).  
   Preferir: `skip_iap:true` no all + `push iap` à parte + **sempre** conferir information/pricing no final.

3. Checklist pós-`push all` (gate humano ou grep no log):

- [ ] log ou state: `App Information` / `contentRights`  
- [ ] log ou state: preços / `gratuito` / availability  
- [ ] se IAP falhou: **não** declarar “listing completo” sem reenviar information+pricing  

**Fix de kit (recomendado — plano plapps-fastlane-kit):**

- IAP **por último** (como Android)  
- cada componente isolado (`rescue` → status `:failed` / `:pushed` / `:skipped`)  
- resumo final + re-run só do que falta (baseline `.push-state`)  
- opcional `fail_fast:true`  
- bônus: `export_iap_catalog` pós-upload **não-fatal** (SSL no re-export não deve derrubar o lane se o push IAP já subiu)

Isso **ajuda e ataca a causa raiz** da review bloqueada nesta sessão. Enquanto não estiver no kit consumido pelo projeto, a IA **não** confia só no `push all` feliz — aplica o workaround.

**Sucesso:** ASC da conta alvo atualizado; IAP com product IDs novos **e** review screenshot (sem Missing Metadata por falta de foto); **information + pricing** setados (app grátis ou pago).

### Etapa M.1 — App Privacy Details (force + senha Apple + SMS 2FA)

O `privacy_url` (Blogger) **não** é isso. Aqui é o questionário **App Privacy** no ASC (`app_privacy_details.json`).

#### Por que o push “normal” falha / é pulado

1. Kit **não envia** privacy se o JSON tem `DATA_USED_TO_TRACK_YOU` e o remoto ASC **já** tem declarações (evita apagar/recriar). Forçar: `force_privacy_upload:true`.
2. A action `upload_app_privacy_details_to_app_store` do Fastlane **não usa a API key `.p8`**. Usa **login de sessão** (Apple ID + senha + **2FA SMS**). A API key **não** expõe `appDataUsages` (`resource v1/appDataUsages does not exist`).

#### Antes de tudo: o gate §2.1 já resolveu isto

Com o **gate de credenciais** feito no início do job, a senha já foi validada por
`spaceauth` e `~/.fastlane/spaceship/<user>/cookie` está quente (~30 dias) —
**a M.1 roda sem pedir 2FA**. Se o gate não foi feito, faça agora antes de seguir.

Três correções sobre o que vem abaixo, aprendidas na marra:

- A senha está em `eas-accounts.json` → `accounts[].fastlane.apple.password`. O **mesmo
  objeto** tem `fastlane.revenuecat.password`, que é outra senha e costuma ser parecida.
  Pegar a errada gasta tentativa de login: num caso real as duas diferiam por um único
  caractere no fim.
- **Ler esta etapa antes de executá-la.** Trabalhar de resumo de sessão é como se pede ao
  usuário uma senha que está no disco — foi exatamente o que aconteceu.
- O 2FA tem comando pronto: **`pldev sms code`** (espera o próximo) / `pldev sms watch`.
  Não reimplemente polling do pool.
- **`SPACESHIP_2FA_SMS_DEFAULT_PHONE_NUMBER=+55DDDNUMERO`** faz o spaceship pedir o SMS
  sozinho e **elimina o menu de escolha de telefone**, que é onde se queima tentativa. Com
  ele o único prompt é `Please enter the 6 digit code you received at …:` — string única,
  que não colide com a linha de ajuda `select a trusted phone number to send the code as a
  text message`. Casar regex nessa linha de ajuda já mandou `1` como se fosse código.
- Responder `sms` ao prompt `Please enter the 6 digit code:` é **escape**, não tentativa.
- **Teto de 2 tentativas de senha.** Mais que isso bloqueia o Apple ID e derruba a conta
  inteira.

#### O que a IA **deve** fazer (não deixar o usuário sozinho)

1. **Senha Apple**  
   - Preferir cache pldev: `eas-accounts.json` → `account.fastlane.apple.password` (ou `account.password`).  
   - Exportar `FASTLANE_USER` + `FASTLANE_PASSWORD` **sem** imprimir a senha no chat.  
   - Se login falhar (“credentials seem wrong”): **perguntar a senha correta** ao usuário e re-tentar (não desistir no primeiro 401).

2. **Código SMS 2FA**  
   - Fonte automática: pool SMS  
     - UI: https://theblueboxapps.com/sms/  
     - API: `https://theblueboxapps.com/sms/index.php?api=sms` → JSON `{ messages: [...] }`  
   - Já implementado no pldevtools: `lib/dolphin/sms.mjs` → `waitForCode({ match: /apple/i, ... })`  
     - Snapshot das mensagens **antes** do login; só aceita SMS **novo**.  
     - Extrai 6 dígitos (padrão Apple).  
     - Opcional: filtrar `receiver` pelo final do número mostrado no prompt (`+55 (••) •••••-••40`).  
   - Se a API não devolver a tempo: **perguntar o código** ao usuário (ou ele cola do site).  
   - **Nunca** inventar código; **nunca** enviar 2FA vazio em loop (isso queima tentativas e dá 503).

3. **Comando**

```bash
cd fastlane
export FASTLANE_USER="<apple id da conta>"
export FASTLANE_PASSWORD="<senha — do cache ou pedida>"
# Ideal: orquestrar com expect/script que:
#  - sobe o push
#  - ao ver "6 digit code", chama waitForCode no SMS pool
#  - envia o código ao stdin do fastlane
bundle exec fastlane ios push privacy force_privacy_upload:true skip_policy:true
```

4. **Sucesso no log**

- `Login successful`
- várias linhas `Setting CATEGORY and PURPOSE to DATA_…`
- `App data usage is now published`
- `fastlane.tools finished successfully`

5. **Se Apple bloquear delete de tracking** mesmo com force: manter remoto + preencher manual no ASC; documentar no CHATHISTORY.

**Proibido:** dizer “rode você no terminal” **sem** antes tentar senha do cache + SMS do theblueboxapps; omitir M.1 do playbook.

### Etapa N — Sync RevenueCat IAP

```bash
fastlane revenuecat sync iap
# alias: fastlane revenuecat iap
```

**Sucesso:** products/entitlements/offerings/packages alinhados aos IDs locais e ASC.

### Etapa O — Hot Updater (se no escopo)

```bash
pldev project hotupdater status -a <conta>
# se token sem Workers: pldev project hotupdater create-token <conta>
pldev project hotupdater -a <conta>
# confere Strings.hotUpdaterUrl (não deve apontar conta antiga)
```

Controles do script: R2/D1 com o **mesmo nome** na conta → reutiliza `(ja existia)`; se faltam → cria.  
`.env.hotupdater` + `hotUpdaterUrl` no `Strings.ts` são **reescritos**. `hot-updater.config.ts` se já existe é **preservado**. Não apaga o stack da conta antiga.

**Provisionar não é testar.** O stack pode subir inteiro e o OTA nunca chegar no app — URL errada, canal errado, `updateStrategy` divergente. Faça a Etapa O.2 antes de submeter.

### Etapa O.2 — Validar o OTA ponta a ponta (obrigatória)

**Onde testar.** Se o app ainda está `PREPARE_FOR_SUBMISSION`, pode usar o canal `production`: não há revisor nem usuário para receber o bundle. Depois de submetido, **não** — o revisor baixa o que estiver no canal. Aí use outro canal (o canal é assado no binário: `HOT_UPDATER_CHANNEL` no `Info.plist`).

**1. O endpoint responde?** O SDK monta a URL assim (`DefaultResolver.ts`):

```
{hotUpdaterUrl}/app-version/{platform}/{appVersion}/{channel}/{minBundleId}/{bundleId}/{cohort}
```

```bash
NIL=00000000-0000-0000-0000-000000000000
curl -s "<hotUpdaterUrl>/app-version/ios/1.0.0/production/$NIL/$NIL/50"
```

`null` = nada a fazer. `200` com `null` já prova que a rota existe — 404 aqui significa `hotUpdaterUrl` errada no `Strings.ts`.

> **Cohort é 1–1000** (ou slug minúsculo). Mandar `0` devolve `null` **silenciosamente**, e você perde tempo achando que o bundle não subiu. Um `null` é ambíguo: pode ser sem bundle, já atualizado, ou cohort inválido.

**2. Publica um bundle com marcador visível.** OTA só roda em **release** (`initHotUpdater` sai cedo em `__DEV__`), então precisa do build release instalado — o mesmo binário do teste, sem reinstalar.

```bash
# marque algo inequívoco no app (ex.: Texts.ts → title: "Documentos OTA ✅")
bunx hot-updater deploy -p ios -t 1.0.0 -c production -f -m "teste de OTA (temporario)"
```

`-f` (force update) faz o app recarregar na hora — o marcador aparece num único launch, sem precisar abrir duas vezes.

**3. Confirma no app.** Encerre e abra: o marcador tem que estar lá, **com o binário intocado**. Se aparecer, o caminho todo funciona: Worker → D1 → R2 → download → reload.

**4. Testa o rollback** — é a alavanca de emergência, e ninguém descobre que ela está quebrada numa hora boa:

```bash
bunx hot-updater bundle disable <bundle-id> -y   # em shell não-TTY o -y é obrigatório
```

O endpoint passa a devolver `{"status":"ROLLBACK","id":"<NIL>","shouldForceUpdate":true}` para quem está no bundle, e o app volta ao embutido no próximo launch. `bundle delete` devolve `ROLLBACK` igual — deletar não deixa ninguém preso no bundle removido.

**5. Limpa antes de submeter:**

```bash
bunx hot-updater bundle delete <bundle-id> -y
bunx hot-updater bundle list          # tem que dizer "(no bundles)"
```

E reverta o marcador no código. O `deploy` também acrescenta `.hot-updater/output` ao `.gitignore` — isso é para ficar.

**Sucesso:** marcador apareceu sem reinstalar o app, rollback voltou ao embutido, `bundle list` vazio e canal limpo.

### Etapa O.1 — Firebase Remote Config: utils + screens (**rehome / conta alvo**)

Arquivos locais (contrato do app), em `.pldev/.firebaserc/`, um por plataforma com os dois blocos `{utils, screens}`:

- `rc-config-ios.json`
- (Android se no escopo: `rc-config-android.json`)

Os 4 arquivos antigos (`rc-config-{utils,screens}-{ios,android}.json`) o pldev junta nesses 2 sozinho. O que ele
publica depende da versão **instalada** do expo-utils: antes da 1.5.0, os parâmetros `utils` e `screens`; da 1.5.0 em
diante, o parâmetro `settings` (condição `app.id` + `app.version >= V`) e, enquanto houver build antigo, as cópias em
`utils`/`screens`. Ver `docs/PLANO-SETTINGS.md`.

**Antes do push:**

1. Conta Firebase = alvo (`pldev firebase list` / `app.json` → `extra.accounts.firebase`).
2. App iOS/Android **já criados** no projeto Firebase (`pldev firebase create`) — precisa do `appId` (`1:…:ios:…`).
3. Product IDs no `screens` alinhados ao bundle novo (grep do bundle antigo deve dar zero).
4. OAuth Firebase da conta válido (`pldev firebase auth` se `unauthorized_client`).

**Fluxo pldev (interativo):**

```bash
# 1) Criar condições do APP ATUAL se ainda não existirem (lib 1.5.0+: só `settings`; antes: utils + screens)
pldev firebase rc create -a brunovercosa487@gmail.com
# plataforma iOS (ou all), selecionar app com o bundle deste projeto
# nomes default tipo "iOS <displayName> Utils" / "… Screens"

# 2) Enviar JSON local para as condições da plataforma
pldev firebase rc push -a brunovercosa487@gmail.com
# checkbox: marcar só o grupo do app atual (ex. "iOS Eleicao"), NÃO outros apps do mesmo projeto (ex. Consulta PIS)
```

**Regras:**

- Um projeto Firebase (ex. `principal-cb260`) pode ter **vários apps**. Condições são por `app.id`.  
  **Nunca** sobrescrever condições de outro app sem OK.
- `rc create` em condições que já existem: **pula** criação e não apaga o resto do template.
- `rc push` só atualiza as condições **selecionadas** com o arquivo `rc-config-{ios|android}.json` da plataforma.
- `rc push --dry-run` mostra o que seria publicado (e a condição de versão que seria criada) sem publicar.
- Backup do template: preferir `/tmp` (não soltar `firebase-rc-backup-*.json` na raiz do repo).
- Gate humano: confirmar conta + appId + “não mexer em condições alheias” antes do push.

**Sucesso:** no console Firebase Remote Config, condições do bundle atual com `settings` (lib 1.5.0+) ou `utils` e `screens` populados; app em runtime lê RC da conta alvo (`cfg_integrity.cfg_source` no DebugView).

**Se `pldev firebase rc push` só listar condições de outro produto** (ex. “iOS Consulta PIS”): o app deste projeto **ainda não tem** condições → rodar `rc create` primeiro (ou criar condições + setar valores via API com o mesmo contrato: `app.id == '<appId>'`, params `utils`/`screens`).

### Etapa P — Build + submit (se no escopo)

```bash
pldev eas build     # production iOS; auto-submit se o fluxo pldev oferecer
# ou eas build --platform ios --profile production && eas submit
```

Só **depois** do push all quando o objetivo for review com listing completo.

### Etapa P.1 — Anexar IAPs (e o grupo) à review submission

**Sem isto, numa primeira submissão a Apple não revisa os produtos** e o app estreia com o
paywall vendendo IAP que não existe. Só um novo ciclo de revisão conserta — dias depois,
com o app já no ar.

O `add_build` e o `submit` do kit **não tocam nos IAPs**. O fluxo correto é:

- `add_build` anexa o build **e** todo produto em `READY_TO_SUBMIT` à mesma review
  submission;
- `submit` manda o pacote inteiro.

#### O que a API impõe

- O item aponta para a **versão** do produto, não para o produto:
  `inAppPurchaseVersion`, `subscriptionVersion` e `subscriptionGroupVersion`. Mandar
  `inAppPurchaseV2` devolve `409 'inAppPurchaseV2' is not a relationship`.
- **O grupo de assinatura é item separado, e é o mais fácil de esquecer.** O display name
  que o usuário vê na tela de assinatura sai da localização do **grupo**, com ciclo de
  revisão próprio. O gatilho é diferente: grupo não tem `READY_TO_SUBMIT` — é a versão dele
  em `PREPARE_FOR_SUBMISSION`. Ao entrar na submission ela vira `READY_FOR_REVIEW` sozinha.
- O `deliver` **recusa** submission que tenha itens que não foi ele que criou
  (`user_error!` incondicional em `submit_for_review.rb`), então o submit passa pela API.
- `reviewSubmissions` não aceita DELETE: para desfazer, remova os itens
  (`DELETE /v1/reviewSubmissionItems/{id}`) ou cancele com `PATCH { canceled: true }`.

Implementação pronta (2 actions + patch das lanes):
`plapps-fastlane-kit/docs/iap-review-submission.md`.

**Sucesso:** a submission tem a versão + N itens, **todos** `READY_FOR_REVIEW`, e depois do
submit tudo fica `WAITING_FOR_REVIEW` — app, IAPs e grupo juntos.

### Etapa Q — Checklist final + CHATHISTORY

Grep leftovers da conta antiga:

- AdMob pub, rckey, privacy URL, projectId EAS, Firebase PROJECT_ID, APPLE_ID, product IDs, hotUpdater host, blogspot antigo

Atualizar `.Codex/CHATHISTORY.MD` (e `.claude/CHATHISTORY.MD` se o repo exigir) com data, pedido, ações, arquivos, resultado.

---

## 4. Tabela rápida de comandos pldev

| Ação | Comando |
|------|---------|
| Auth store apply | `pldev fastlane auth apply` |
| Auth store save | `pldev fastlane auth save` |
| Conta completa no projeto | `pldev fastlane use [conta]` |
| EAS create project | `pldev eas create` |
| EAS status | `pldev eas status` |
| EAS login (só se preciso) | `pldev eas login` |
| EAS build | `pldev eas build` |
| Firebase apps/plist | `pldev firebase create -p ios -a <conta>` |
| Remote Config create condições | `pldev firebase rc create -a <conta>` |
| Remote Config push utils/screens | `pldev firebase rc push -a <conta>` (só app atual) |
| AdMob | `pldev admob create` / `pull` |
| Privacy Blogger | `pldev blogger pp` |
| RevenueCat | `pldev rc create --ios` / `status` / `pull` |
| Hot Updater | `pldev project hotupdater` |
| Automation ASC cache | `pldev automation appstore` / `status` |
| Push ASC | `fastlane ios push all` |
| App Privacy force (session+2FA) | `fastlane ios push privacy force_privacy_upload:true` + senha cache + SMS `theblueboxapps.com/sms` |
| SMS OTP (código 2FA) | **`pldev sms code`** (espera o próximo) · `pldev sms watch` · `--last` para o mais recente |
| SMS OTP pool (fonte) | `https://theblueboxapps.com/sms/` · API `…/sms/index.php?api=sms` · lib `lib/dolphin/sms.mjs` |
| Validar senha Apple + aquecer sessão | `bundle exec fastlane spaceship spaceauth -u <apple id>` |
| Sync RC IAP | `fastlane revenuecat sync iap` |

---

## 5. O que é pldev vs Fastlane vs AI

| Camada | Responsável |
|--------|-------------|
| Contas, AdMob, Firebase, Blogger, EAS project/build, RC projeto/keys, Hot Updater | **pldev** |
| Metadata push, screenshots push, privacy details, IAP push, RC product sync | **Fastlane kit** |
| Textos ASO únicos, revisão anti-spam, compose de screenshots, orquestração com gates | **AI** |

Não dá para “subir a loja” só com pldev: o **`fastlane ios push all`** é etapa obrigatória do store surface.

---

## 6. Arquivos que costumam mudar

- `app.json`
- `GoogleService-Info.plist` / `google-services.json`
- `src/constants/Strings.ts`
- `src/components/paywalls/defaults.ts` (e qualquer LEGAL_URLS)
- `fastlane/.env` (local; secrets)
- `fastlane/ios/fastlane/AuthKey_KEY_ID.p8`
- `fastlane/ios/fastlane/metadata/**`
- `fastlane/ios/fastlane/iap/**`
- `fastlane/ios/fastlane/screenshots/**`
- `.env.hotupdater` / `hot-updater.config.ts`
- Remote config JSON + push Firebase
- `.Codex/CHATHISTORY.MD`

---

## 7. Critérios de sucesso (Definition of Done)

- [ ] **Gate §2.1 verde antes de começar**: `auth status` sem `faltando` na plataforma em escopo + senha validada por `spaceauth`
- [ ] Bundle/product IDs novos (se pedido) consistentes em app + IAP + paywall
- [ ] EAS projectId da **conta alvo** (não da conta antiga; não placeholder)
- [ ] Firebase plist da conta alvo
- [ ] AdMob app/units da conta alvo em `Strings.ts` + `app.json`
- [ ] Privacy URL nova no app + metadata
- [ ] `pldev fastlane auth apply` (ou use) com conta alvo; `.env` sem APPLE_ID da conta antiga
- [ ] Metadados reescritos (anti-spam)
- [ ] Screenshots nos slots **exigidos** (6.5" + iPad 12.9 se `supportsTablet`), sem duplicatas no ASC
- [ ] **Vídeo de review** anexado (Etapa L.1): primeiro frame = splash, ATT visível, citado nas notes
- [ ] Localizações herdadas do app record limpas (Etapa H.1) — só os locales de `metadata/`
- [ ] Copy do app coerente com o catálogo: trial prometido = oferta existente (Etapa I.2)
- [ ] **IAP review screenshots** em todos os products ativos (Etapa I.1)
- [ ] **`fastlane ios push all`** (ou metadata + `push iap`) concluído sem Missing Metadata por falta de foto
- [ ] **App Privacy Details** publicados no ASC (force + senha + SMS se preciso — Etapa M.1)
- [ ] RevenueCat com keys + **`fastlane revenuecat sync iap`**
- [ ] Hot Updater na conta alvo (`hotUpdaterUrl` sem conta antiga)
- [ ] Hot Updater **validado ponta a ponta** (Etapa O.2): update aplicou no binário instalado, rollback voltou, `bundle list` vazio
- [ ] Remote Config **utils + screens** no Firebase da conta alvo (condições do app atual)
- [ ] Build+submit se no escopo
- [ ] **IAPs e o grupo da assinatura na review submission** (Etapa P.1), todos `READY_FOR_REVIEW` antes do submit
- [ ] Sem leftovers óbvios da conta antiga (grep)
- [ ] CHATHISTORY atualizado

---

## 8. Template de pergunta por etapa

```text
Etapa X — <nome>
Vou: <ação>
Comando(s): <cmd>
Afeta: <arquivos / serviços remotos>
Risco: <baixo|médio|alto> — <motivo>
Preciso do seu OK para executar. Pode confirmar? (e responder: <dados se houver>)
```

---

## 9. Fora de escopo (default)

- Editar `ios/` / `android/` nativo
- Criar Facebook sem pedido
- Recriar credenciais que já existem
- Android se o pedido for iOS only
- Commit/push de secrets

---

## 10. Referências no repo

- `.claude/POLICY-CHECKS.md` (no app) / `templates/POLICY-CHECKS.md` (no expo-utils) — regras de review que já derrubaram build (§0.8)
- `fastlane/README.md` — mapa do kit
- `fastlane/ios/README.md` — push/pull privacy/IAP/screenshots
- `fastlane/PROMPT_STORE_METADATA.md` — metadados
- `fastlane/PROMPT_SCREENSHOTS_*.md` — screenshots
- expo-utils: placeholder EAS `df0dc510-fafe-4076-9ea7-6926d54cb2ab`
- pldevtools: `pldev fastlane auth apply`, `pldev eas create`
- `plapps-fastlane-kit/docs/iap-review-submission.md` — IAPs e grupo na revisão (Etapa P.1)
- `expo-docscanner/resources/fastlane-kit/introductory-offers.md` — trial grátis no catálogo (Etapa I.2)

---

## 11. Custos conhecidos (armadilhas fora do fluxo)

Coisas que não são etapa, mas já comeram horas:

- **Log de build do EAS vem em Brotli**, não gzip. `gunzip`/`zlib` silenciosamente
  produzem lixo e você fica lendo bytes tortos achando que o erro é outro. Descomprimir com
  `zlib.brotliDecompressSync`. (O erro real embaixo era um `Cannot find module 'dotenv'` —
  dependência usada por `hot-updater.config.ts` que passava localmente por transitividade e
  quebrava o prebuild no EAS. Dependência que um plugin carrega tem de estar declarada.)
- **`experiments.buildCacheProvider: "eas"` no `app.json`** faz `npx expo run:ios` **baixar
  um dev-client cacheado** em vez de compilar o que você acabou de mudar. Quando precisar de
  build local de verdade, remover a chave temporariamente e restaurar depois.
- **Plist do Firebase errado** (de outro bundle) se resolve com `npx expo prebuild --platform
  ios`. Nunca editando `ios/` à mão — ver §0.6.
- **Navegação por posição em prompt interativo do pldev é frágil**: a ordem da lista muda
  entre execuções. Se automatizar com `expect`, descer procurando o **conteúdo** do item
  (regex no `❯`) e abortar se não achar — nunca contar “desce 3 e Enter”.
