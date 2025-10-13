# INSTRUÇÕES DE TESTE DO APLICATIVO

## TESTES AUTOMATIZADOS

### TESTE 1 - VERIFICAR BOTÕES SEM FUNCIONALIDADE

**Objetivo**: Identificar botões visíveis que não executam nenhuma ação

**Verificações**:

- Procurar por todos os componentes `<Button>`, `<TouchableOpacity>`, `<Pressable>`, `<TouchableHighlight>`
- Verificar se possuem props `onPress`, `onPressIn`, `onPressOut` ou similar
- Verificar se a função atribuída está vazia ou não implementada
- Verificar se o botão está visível na tela (não está com `display: 'none'` ou `opacity: 0`)

**Critério de Falha**:

- Botão visível sem função onClick/onPress
- Botão com função vazia: `onPress={() => {}}` ou `onPress={undefined}`

---

### TESTE 2 - VERIFICAR BOTÕES DE TERMOS E POLÍTICAS

**Objetivo**: Verificar se botões de "Termos de Uso" e "Política de Privacidade" abrem links válidos

**Verificações**:

- Procurar por textos/botões contendo: "termos", "terms", "política", "privacy", "privacidade"
- Verificar se executam `Linking.openURL()` ou navegação válida
- Verificar se o link/URL está definido e não está vazio
- Testar se o link abre corretamente

**Critério de Falha**:

- Botão de termos/política sem ação
- Link vazio ou inválido
- Função não implementada

---

### TESTE 3 - VERIFICAR BOTÃO RESTORE PURCHASE EM ANDROID

**Objetivo**: Verificar se existe lógica para esconder botão "Restore Purchase" em Android

**Verificações**:

- Verificar se o projeto tem pasta `android` (é projeto Android)
- Procurar por botões com texto "restore", "restaurar", "restore purchase"
- Verificar se existe condição `Platform.OS === 'android'` para esconder o botão
- Verificar se o botão fica visível apenas no iOS (`Platform.OS === 'ios'`)

**Critério de Falha**:

- Projeto Android com botão "Restore Purchase" visível
- Ausência da condição `Platform.OS` para controlar visibilidade
- Botão aparece em Android quando deveria aparecer apenas no iOS

---

## COMO EXECUTAR OS TESTES

1. Ler todos os arquivos do projeto
2. Executar cada teste na ordem listada
3. Reportar resultados no formato:
    - ✅ PASSOU: Teste concluído com sucesso
    - ❌ FALHOU: [Descrever o problema encontrado]
    - ⚠️ AVISO: [Descrever possível problema]

## RESULTADO ESPERADO

```
TESTE 1 - BOTÕES SEM FUNCIONALIDADE: ✅ PASSOU
TESTE 2 - TERMOS E POLÍTICAS: ✅ PASSOU
TESTE 3 - RESTORE PURCHASE ANDROID: ✅ PASSOU
```
