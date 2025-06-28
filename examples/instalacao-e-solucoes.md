# Instalação e Resolução de Problemas

## Instalação

### Opção 1: Via GitHub (Recomendada)
```bash
npm install https://github.com/Pixel-Logic-Apps/expo-utils.git
```

### Opção 2: Com flags de compatibilidade
Se você encontrar conflitos de peer dependencies:

```bash
npm install https://github.com/Pixel-Logic-Apps/expo-utils.git --legacy-peer-deps
```

ou

```bash
npm install https://github.com/Pixel-Logic-Apps/expo-utils.git --force
```

## Problemas Comuns

### ❌ Erro: `ERESOLVE could not resolve`

**Problema:** Conflito de versões entre as peer dependencies do expo-utils e as dependências do seu projeto.

**Exemplo:**
```
npm error Could not resolve dependency:
npm error peerOptional expo-splash-screen@"^0.29.14" from expo-utils@1.0.0
npm error node_modules/expo-utils
```

**Soluções:**

#### 1. Usar `--legacy-peer-deps` (Mais Seguro)
```bash
npm install https://github.com/Pixel-Logic-Apps/expo-utils.git --legacy-peer-deps
```

#### 2. Usar `--force` (Use com Cuidado)
```bash
npm install https://github.com/Pixel-Logic-Apps/expo-utils.git --force
```

#### 3. Atualizar dependências do seu projeto
Atualize para versões compatíveis no seu `package.json`:

```json
{
  "dependencies": {
    "expo-application": "^6.1.0",
    "expo-splash-screen": "^0.29.0"
  }
}
```

### ❌ Erro: `No matching version found for expo-router`

**Problema:** Versão do expo-router não encontrada.

**Solução:** Atualize o expo-router no seu projeto:
```bash
npx expo install expo-router@latest
```

### ❌ Erro: Peer dependencies não encontradas

**Problema:** Algumas peer dependencies opcionais não estão instaladas.

**Soluções:**

#### 1. Instalar peer dependency opcional
```bash
npm install expo-splash-screen
```

#### 2. Ignorar peer dependencies opcionais
Adicione no seu `package.json`:
```json
{
  "overrides": {
    "expo-utils": {
      "expo-application": "$expo-application",
      "expo-splash-screen": "$expo-splash-screen"
    }
  }
}
```

## Verificação de Compatibilidade

### Versões Mínimas Suportadas

| Dependência | Versão | Status |
|-------------|---------|--------|
| React | >=16.8.0 | Peer Dependency |
| React Native | >=0.60.0 | Peer Dependency |
| expo-application | ^6.1.4 | ✅ Incluída |
| expo-build-properties | >=0.12.0 | ✅ Incluída |
| expo-splash-screen | >=0.29.0 | Peer Optional |

### Comando de Diagnóstico

Verifique as versões instaladas:
```bash
npm list expo-application expo-splash-screen react react-native
```

## Configuração Alternativa

### Se nada funcionar, use configuração manual:

1. **Clone o repositório:**
```bash
git clone https://github.com/Pixel-Logic-Apps/expo-utils.git
cd expo-utils
```

2. **Copie os arquivos para seu projeto:**
```bash
cp -r utils/ /seu-projeto/src/
cp types/ /seu-projeto/src/
```

3. **Use localmente:**
```typescript
import Utils from './src/utils/Utils';
import { getLocalizedMessages } from './src/utils/i18n';
```

## Configuração do TypeScript

Se você usar TypeScript, adicione ao `tsconfig.json`:

```json
{
  "compilerOptions": {
    "typeRoots": [
      "./node_modules/@types",
      "./node_modules/expo-utils/types"
    ]
  }
}
```

## Teste da Instalação

Após instalar, teste se está funcionando:

```typescript
import Utils, { getLocalizedMessages } from 'expo-utils';

console.log('expo-utils instalado com sucesso!');
console.log('Traduções disponíveis:', getLocalizedMessages());
```

## Suporte

Se você ainda encontrar problemas:

1. **Verifique as versões:** Execute `npm list` para ver conflitos
2. **Limpe o cache:** `npm cache clean --force`
3. **Delete node_modules:** `rm -rf node_modules && npm install`
4. **Use yarn:** `yarn add https://github.com/Pixel-Logic-Apps/expo-utils.git`

## Comandos Úteis

```bash
# Limpar cache npm
npm cache clean --force

# Reinstalar todas as dependências
rm -rf node_modules package-lock.json
npm install

# Verificar dependências desatualizadas
npm outdated

# Atualizar expo
npx expo upgrade
``` 