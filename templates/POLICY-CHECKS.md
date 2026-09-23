# POLICY-CHECKS — regras de review que já derrubaram build

> Arquivo **gerado pelo `expo-utils`** (fonte: `templates/POLICY-CHECKS.md`). Ele é
> **sobrescrito** a cada `expo-utils-install --policy-checks` / `--new`. Regra nova ou correção:
> edite no repo `expo-utils`, **não** aqui — senão a próxima instalação apaga.

Cada item abaixo é uma **rejeição real**, com data e versão. Não é teoria, não é "boa prática":
é o que já fez a Apple/Google devolver um app do portfólio. A lista cresce a cada rejeição nova.

## Quando ler (obrigatório)

| Momento                                                                                   | O que fazer                                                    |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Antes de qualquer build de submissão** (`eas build --profile production`, `fastlane`, bump de versão) | Ler a lista **inteira** e conferir item por item contra o app   |
| **Antes de escrever/alterar** um fluxo coberto por um item (ex.: permissão → P-001)        | Ler o item **antes** de escrever o código, não depois           |
| Ao receber uma rejeição nova                                                               | Corrigir o app **e** adicionar a regra no repo `expo-utils`      |

**Nunca** dê uma etapa de build/submissão como concluída sem ter lido este arquivo **nesta
sessão**. Ele muda com o tempo — o que você "lembra" dele está desatualizado por definição.

## Índice

| ID    | Regra                                                                     | Loja             | Dispara quando                                        |
| ----- | ------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| P-001 | Pre-prompt de permissão: sem botão "Permitir", sem saída que adie o pedido | Apple 5.1.1(iv)  | qualquer `request*PermissionsAsync` / `requestPermission` |
| P-002 | Info de governo: disclaimer no topo + lista FECHADA de todas as fontes na descrição | Google Play — Misleading Claims | app exibe dado de órgão público; qualquer edição da full description |

---

## P-001 — Pre-prompt de permissão: sem "Permitir", sem "Cancelar"

**Apple — Guideline 5.1.1(iv) — Legal · Privacy · Data Collection and Storage**
Rejeição real: **Escanear Documentos**, versão 1.0 (6), review em **14/08/2026**, iPad Air 11" (M3).

> The app encourages or directs users to allow the app to access the camera. Specifically, the app directs the user to grant permission in the following way(s):
>
> - A custom message appears before the permission request, and to proceed users press a "Permitir accesso" button. **Use words like "Continue" or "Next" on the button instead.**
> - A custom message appears before the permission request, and the user can close the message and delay the permission request with the Cancelar button. **The user should always proceed to the permission request after the message.**

### A regra

Tela custom (priming / explicação) **antes** do diálogo do sistema é permitida — mas ela só pode
**explicar**, nunca **decidir**. Quem decide é o diálogo da Apple. Logo:

1. **Botão de avanço com texto neutro:** `Continuar`, `Próximo`, `Avançar`, `Entendi`, `OK`.
   **PROIBIDO** qualquer verbo de concessão: `Permitir`, `Permitir acesso`, `Allow`,
   `Ativar câmera`, `Liberar galeria`, `Autorizar`, `Dar acesso`.
2. **Zero saída que pule ou adie o pedido.** Sem `Cancelar`, `Agora não`, `Depois`, `Pular`,
   sem `X`, sem fechar por swipe, sem fechar tocando no overlay, sem botão de voltar.
   **Toda** saída da tela custom termina no diálogo do sistema.

Falhar em **um** dos dois já é rejeição — a carta acima cita os dois separadamente.

### O jeito seguro (default): não faça pre-prompt

Chame a permissão **direto** no gesto do usuário. Sem tela intermediária não há o que a Apple
reclamar, e o botão da funcionalidade (`Escanear documento`) já é a explicação do porquê.

```tsx
// ✅ direto no gesto — sem tela intermediária
const [permission, requestPermission] = useCameraPermissions();

async function abrirScanner() {
    const res = permission?.granted ? permission : await requestPermission();
    if (!res.granted) return setMostrarAvisoSemCamera(true); // não re-pede, ver abaixo
    router.push("/scanner");
}
```

### Se o pre-prompt for mesmo necessário

Só quando houver ganho real (a permissão é one-shot: negou, só volta pelos Ajustes) — e então:

```tsx
// ✅ explica e SEMPRE cai no diálogo do sistema
<Modal visible={mostrarExplicacao} onRequestClose={continuar}>
    <Text>Precisamos da câmera para fotografar e digitalizar seus documentos.</Text>
    <Button title="Continuar" onPress={continuar} />
    {/* sem "Cancelar", sem X, sem overlay clicável */}
</Modal>;

async function continuar() {
    setMostrarExplicacao(false);
    await requestPermission(); // acontece SEMPRE, qualquer que seja a saída da modal
}
```

```tsx
// ❌ os dois erros da rejeição, no mesmo componente
<Button title="Permitir acesso" onPress={pedir} />   {/* erro 1: verbo de concessão */}
<Button title="Cancelar" onPress={fechar} />          {/* erro 2: saída sem pedir */}
```

Detalhe do RN: `onRequestClose` (back do Android) e o toque no overlay contam como saída — eles
também têm que levar ao `request*`. Se não der para garantir isso, tire a modal.

### Depois da negativa: Ajustes, não insistência

Negou? **Não** re-exiba o diálogo nem uma nova modal pedindo de novo — isso é o mesmo 5.1.1(iv)
por outro caminho. Mostre um aviso inline explicando que a função precisa da câmera e ofereça um
caminho explícito:

```tsx
// canAskAgain === false → o diálogo do sistema não aparece mais
<Text>Ative a câmera nos Ajustes para digitalizar documentos.</Text>
<Button title="Abrir Ajustes" onPress={() => Linking.openSettings()} />
```

Aqui `Abrir Ajustes` é permitido: não é um pré-diálogo, é a única rota que restou.

### Vale para toda permissão

Câmera, fotos/galeria, microfone, localização, contatos, notificações, Bluetooth, saúde —
mesma regra, mesma guideline. **ATT (rastreamento) é do `expo-utils`**: `Utils.prepare()` já
roda UMP + ATT na ordem certa; **não** crie tela custom de ATT no app.

Android não rejeita por isso, mas o código é o mesmo — escreva uma vez, no formato acima.

### Checagem antes de submeter

```bash
# 1) todo call site de permissão
grep -rniE "request(Camera|MediaLibrary|Microphone|Foreground|Background|Notifications|Tracking)?Permission" src/
# 2) botão com verbo de concessão perto de permissão
grep -rniE "\"(Permitir|Permitir acesso|Allow|Autorizar|Ativar (a )?(c[âa]mera|microfone|galeria))" src/
# 3) saída que adia o pedido
grep -rniE "\"(Cancelar|Agora n[ãa]o|Depois|Pular|Mais tarde)\"" src/
```

Para cada hit de (2)/(3): confirmar que **não** está numa tela que antecede um `request*`.

---

## P-002 — Informação de governo: disclaimer + lista FECHADA de fontes na descrição

**Google Play — Misleading Claims policy (informação governamental)**
Rejeição real: **Resultado Eleições 2026** (`br.resultadoeleicoes.app`), app 1.1.0, área apontada:
**Full description**, rejeição reportada em **21/09/2026**.

> Issue found: Violation of Misleading Claims policy
>
> **Insufficient Sources Provided** — Your app's description statement makes it seem like there are
> more than one source of information used without listing all of them.
>
> - Identify and provide in your description a clear, official, valid and functional source(s) for
>   all of the government information(s) shared in your app.
> - Include in the description of your app an easy-to-see disclaimer stating that the app doesn't
>   represent a government entity.

A ficha rejeitada **já tinha** disclaimer e **já tinha** link do TSE — não bastou. O motivo não é
"falta fonte", é "parece haver mais fontes do que as listadas". A carta não aponta a frase. O que
se sabe: o bloco de disclaimer enviado listava 2 URLs com "exclusivamente", e a versão publicada
da mesma ficha citava uma 3ª URL (`www.tse.jus.br/eleicoes`) em outros dois trechos do texto.

> **Status:** correção enviada, aprovação **ainda não confirmada**. Quando o Google responder,
> atualize este item (aprovou → tire este aviso; rejeitou de novo → cole a carta nova aqui).

### A regra

1. **Disclaimer no topo** da full description ("easy-to-see"), com a frase que a carta pede, literal:
   **"não representa nenhuma entidade governamental"**.
2. **Lista fechada de fontes.** Cada tipo de dado de governo que o app mostra → órgão + URL oficial,
   uma URL por linha, sem pontuação colada. Termine fechando a lista:
   *"Nenhuma outra fonte de informação governamental é utilizada."*
3. **Uma lista só.** Toda URL ou "fonte" citada em **qualquer** outro trecho da descrição tem que
   estar nessa lista. Dois blocos de fonte com URLs diferentes = "parece haver mais fontes".
4. **Sem linguagem aberta:** `fontes oficiais`, `dados públicos`, `como`, `entre outros`, `such as`
   sem URL ao lado.
5. **A URL é o serviço que o app realmente consome** (o host que está no `fetch`), não o portal
   institucional genérico do órgão.
6. **Toda localização** da ficha leva o mesmo bloco.
7. **Fonte nova = descrição primeiro.** Feature ligada por Remote Config que traz outra fonte
   (ex.: aba de notícias) só liga **depois** de a descrição listar essa fonte.

### Exemplo certo

```txt
AVISO IMPORTANTE (DISCLAIMER)
Este aplicativo é independente e NÃO representa nenhuma entidade governamental. Ele NÃO é um app
oficial e não tem vínculo, afiliação ou endosso do Governo, da Justiça Eleitoral ou do TSE.

FONTES OFICIAIS DAS INFORMAÇÕES
Todas as informações eleitorais exibidas no app têm uma única origem: o Tribunal Superior
Eleitoral (TSE). São exatamente duas fontes, ambas públicas e oficiais:

1) Resultados e apuração (votos, percentuais, eleitos, 2º turno, abstenções, brancos e nulos):
https://resultados.tse.jus.br

2) Candidatos (lista de candidatos, partidos, fotos, bens declarados e contas de campanha):
https://divulgacandcontas.tse.jus.br

Nenhuma outra fonte de informação governamental é utilizada.
```

### Exemplo errado

```txt
DISCLAIMER
... não possui vínculo com o governo federal, estadual, municipal ou o TSE.
Fonte oficial dos dados eleitorais: https://www.tse.jus.br/eleicoes        ← portal genérico, 1 link

(… 8 seções falando de apuração, candidatos, urna, estatísticas, "dados oficiais do TSE" …)

FONTE DE DADOS
Todos os dados são provenientes do TSE. Fonte oficial: https://www.tse.jus.br/eleicoes
```

Vários tipos de dado, vários órgãos citados, um link genérico repetido em dois blocos — e nada
dizendo que a lista acabou. Pior ainda se o disclaimer novo citar URLs que o bloco antigo não cita.

### Checagem antes de submeter

```bash
D="fastlane/android/fastlane/metadata/android/*/full_description.txt"
# 1) toda URL da descrição, em todas as localizações — cada uma tem que estar no bloco de fontes
grep -noE "https?://[^ )]+" $D | sort | uniq -c
# 2) linguagem aberta
grep -niE "entre outr|fontes oficiais|dados p[úu]blicos|such as|among other" $D
# 3) hosts que o app REALMENTE chama — comparar com a lista da descrição
grep -rhoE "https?://[A-Za-z0-9.-]+" src | sort -u
```

- **Abra cada URL num navegador de verdade.** Site de governo costuma ficar atrás de WAF que
  devolve `403` a `curl` (o TSE faz isso, mesmo com User-Agent de Chrome) — `curl` não prova nada.
- `fastlane/android` não aparece no git? Versões antigas do `expo-utils-install --gitignore`
  gravavam `ios/` e `android/` **sem âncora** (removido em `45b3211`; o `/ios` e `/android` do Expo
  são ancorados e não têm esse efeito). Sem âncora, a regra engole `fastlane/android/**` e
  `fastlane/ios/**`: a metadata da loja nunca é versionada e some no próximo clone. Foi o que
  aconteceu neste app. Conferir: `git check-ignore -v fastlane/android/fastlane/metadata`.

---

## Como adicionar uma regra nova (no repo `expo-utils`)

1. Edite `templates/POLICY-CHECKS.md` — nunca a cópia dentro do app.
2. Próximo ID livre (`P-003`, …), e adicione a linha no **Índice**.
3. Seções do item: **carta da loja (citação literal)** → **a regra** → **exemplo certo** →
   **exemplo errado** → **como checar**.
4. Sempre com app, versão e data da rejeição — é o que separa regra real de achismo.
5. Atualize também o índice em `templates/AGENTS.md` (REGRA 6).
