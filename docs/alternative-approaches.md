# Abordagens Alternativas para Dependências

Este documento explica outras soluções possíveis para o problema de dependências em bibliotecas reutilizáveis.

## Solução 1: Peer Dependencies + Dynamic Imports (✅ Implementada)

**Prós:**
- Não duplica dependências
- Fallbacks seguros
- Bundle otimizado
- Compatível com diferentes versões

**Contras:**
- Warnings do TypeScript durante desenvolvimento
- Slightly mais complexo

```typescript
// utils/Utils.ts
const getApplication = async () => {
    try {
        return await import('expo-application');
    } catch (error) {
        return null;
    }
};
```

## Solução 2: Injeção de Dependência

**Como seria:**
```typescript
// utils/Utils.ts
interface Dependencies {
    Application?: any;
    SplashScreen?: any;
}

const Utils = {
    prepare: async (setAppIsReady: Function, appConfig: any, deps: Dependencies) => {
        if (deps.SplashScreen) {
            await deps.SplashScreen.hideAsync();
        }
    }
};

// _layout.tsx
import * as Application from 'expo-application';
import * as SplashScreen from 'expo-splash-screen';

Utils.prepare(setAppIsReady, appConfig, { Application, SplashScreen });
```

**Prós:**
- Controle total sobre dependências
- TypeScript limpo

**Contras:**
- API mais verbosa
- Usuário precisa passar dependências manualmente

## Solução 3: Separate Packages

**Como seria:**
```
expo-utils-core/     # Funções básicas
expo-utils-expo/     # Integrações com Expo
expo-utils-full/     # Bundle completo
```

**Prós:**
- Modular
- Usuário escolhe o que importar

**Contras:**
- Manutenção de múltiplos packages
- Mais complexo para distribuir

## Solução 4: Conditional Requires

**Como seria:**
```typescript
let Application: any;
let SplashScreen: any;

try {
    Application = require('expo-application');
} catch {}

try {
    SplashScreen = require('expo-splash-screen');
} catch {}
```

**Prós:**
- Simples
- Funciona em runtime

**Contras:**
- Não funciona bem com bundlers modernos
- Metro bundler pode incluir mesmo assim

## Por que escolhemos Peer Dependencies + Dynamic Imports

1. **Melhor DX**: Funciona out-of-the-box
2. **Performance**: Bundle otimizado
3. **Flexibilidade**: Fallbacks automáticos
4. **Padrão da indústria**: Usado por React, Styled-components, etc.
5. **Compatibilidade**: Funciona com qualquer bundler moderno

## Critérios para Peer Dependencies vs Dependencies

### Movemos para Peer Dependencies:
✅ **react-native** - Framework base, sempre presente  
✅ **react** - Biblioteca base, sempre presente  
✅ **expo-application** - Funcionalidade opcional, pode não estar presente  
✅ **expo-splash-screen** - Funcionalidade opcional, pode não estar presente  

### Mantivemos como Dependencies normais:
❌ **@react-native-firebase/*** - SDKs específicos para funcionalidades core  
❌ **react-native-purchases** - SDK especializado  
❌ **react-native-fbsdk-next** - SDK especializado  

### Por que não movemos todas?

**Complexidade vs Benefício:**
- Firebase: Muitos subpacotes, configuração complexa
- Purchases: Versões específicas podem quebrar funcionalidade
- Facebook SDK: Configuração específica necessária

**Regra prática:**
- **Peer Dependency**: Se o usuário provavelmente já tem instalado
- **Normal Dependency**: Se é específico desta biblioteca ou requer configuração especial 