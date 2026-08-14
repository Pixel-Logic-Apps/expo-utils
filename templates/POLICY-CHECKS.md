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

## Como adicionar uma regra nova (no repo `expo-utils`)

1. Edite `templates/POLICY-CHECKS.md` — nunca a cópia dentro do app.
2. Próximo ID livre (`P-002`, …), e adicione a linha no **Índice**.
3. Seções do item: **carta da loja (citação literal)** → **a regra** → **exemplo certo** →
   **exemplo errado** → **como checar**.
4. Sempre com app, versão e data da rejeição — é o que separa regra real de achismo.
5. Atualize também o índice em `templates/AGENTS.md` (REGRA 6).
