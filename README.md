# Expo Utils

Biblioteca de utilitários e dependências padronizadas para projetos mobile com React Native e Expo.

## Sobre o Projeto

Este projeto centraliza todas as dependências e utilitários essenciais que você usa constantemente em seus projetos mobile, facilitando a configuração inicial e mantendo consistência entre aplicações.

## Dependências Incluídas

### 🔥 Firebase Services
- **Analytics**: Métricas e análise de uso
- **Authentication**: Sistema de autenticação
- **Firestore**: Banco de dados NoSQL
- **Messaging**: Push notifications
- **Remote Config**: Configurações remotas

### 📱 Expo Utilities  
- **Insights**: Monitoramento de crashes
- **Store Review**: Solicitação de avaliações
- **Tracking Transparency**: Controle de rastreamento iOS
- **Updates**: Atualizações OTA

### 💰 Monetização
- **Google Mobile Ads**: Sistema de anúncios
- **Purchases**: Compras in-app e assinaturas

### 🔧 Utilitários
- **AsyncStorage**: Armazenamento local
- **Facebook SDK**: Integração com Facebook

## Como Usar

### 1. Instalação das Dependências

```bash
npm install
```

**💡 Peer Dependencies**: Este projeto usa `peerDependencies` para `react-native`, `expo-application` e `expo-splash-screen`. Em projetos Expo/React Native, você provavelmente já tem essas dependências:

```bash
# React Native (obrigatório)
npm install react-native

# Expo modules (opcionais, mas recomendados)
npm install expo-application expo-splash-screen
```

### 2. Configuração no _layout.tsx

```typescript
import Utils from '../utils/Utils';
import appConfig from '../app.config'; // ou onde estiver sua config

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
}

global.isAdsEnabled = true;

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        Utils.prepare(setAppIsReady, appConfig);
    }, []);

    if (!appIsReady) {
        return null; // ou uma tela de loading
    }

    // Resto do seu layout
}
```

### 3. Função Prepare

A função `Utils.prepare(setAppIsReady, appConfig?)` realiza automaticamente:

- ✅ Configuração do RevenueCat
- ✅ Carregamento das configurações remotas do Firebase
- ✅ Verificação de atualizações disponíveis
- ✅ Verificação de versão mínima obrigatória
- ✅ Inicialização do Facebook SDK
- ✅ Configuração de atribuições de compras
- ✅ Solicitação de permissões de rastreamento
- ✅ Configuração de push notifications
- ✅ Inscrição no tópico de notificações específico do app
- ✅ Ocultação da splash screen

### 4. Parâmetros da Função Prepare

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `setAppIsReady` | `(ready: boolean) => void` | ✅ | Callback para indicar quando o app está pronto |
| `appConfig` | `object` | ❌ | Configuração completa do app (app.config) |

**💡 Nota**: Se `appConfig` não for fornecido, serão usados valores padrão como fallback.

O `appConfig` deve conter:
- `expo.slug` - Para inscrição em tópicos de push notifications
- `expo.plugins` com configuração do `react-native-fbsdk-next` - Para o appID do Facebook
- `expo.plugins` com configuração do `react-native-purchases` - Para as chaves do RevenueCat

**Exemplo de estrutura do appConfig:**
```javascript
const appConfig = {
  expo: {
    slug: "meu-app-slug",
    plugins: [
      [
        "react-native-fbsdk-next",
        {
          "appID": "1015642437283153",
          "clientToken": "...",
          "displayName": "Meu App"
        }
      ],
      [
        "react-native-purchases",
        {
          "androidApiKey": "goog_your_android_key",
          "iosApiKey": "appl_your_ios_key"
        }
      ]
    ]
  }
}
```

## Usando Apenas as Traduções

Se você quiser usar apenas o sistema de internacionalização:

```typescript
import { getLocalizedMessages } from 'expo-utils';

const messages = getLocalizedMessages();
Alert.alert(messages.updateRequired, messages.updateMessage);
```

[📖 **Guia completo de traduções**](./examples/usando-traducoes.md)

### 5. Declarações Globais

As variáveis globais devem ser declaradas no `_layout.tsx` de cada app, não na classe Utils:

```typescript
declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
}

global.isAdsEnabled = true; // ou false se for desenvolvimento
```

Isso permite que cada app configure suas próprias variáveis globais conforme necessário.

### 6. Tipos TypeScript

O projeto inclui interfaces TypeScript para melhor tipagem:

```typescript
import type { AppConfig, RemoteConfigSettings, FacebookConfig } from 'expo-utils';

const myAppConfig: AppConfig = {
  expo: {
    slug: "meu-app",
    plugins: [
      ["react-native-fbsdk-next", { appID: "123456789" }]
    ]
  }
};
```

## Dependências Peer

Este projeto usa **peer dependencies** para `react-native`, `expo-application` e `expo-splash-screen`, significando que:

✅ **Não duplica dependências**: Usa as mesmas versões já instaladas no seu app  
✅ **Imports dinâmicos**: Carrega as dependências apenas quando necessário  
✅ **Fallbacks seguros**: Continua funcionando mesmo se as dependências não estiverem disponíveis  
✅ **Menor bundle**: Não adiciona peso extra ao seu projeto  

**Se as dependências não estiverem instaladas**, você verá avisos no console, mas o app continuará funcionando com funcionalidades limitadas.

### Resolvendo Erros de TypeScript

Se você vir erros como `Cannot find module 'react-native'` ou `Cannot find module 'expo-splash-screen'`, use uma das soluções:

**Opção 1: Instalar as peer dependencies (Recomendado)**
```bash
# Obrigatórias
npm install react-native

# Opcionais (para funcionalidades específicas)
npm install expo-application expo-splash-screen
```

**Opção 2: Incluir os tipos mock no seu tsconfig.json**
```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./node_modules/expo-utils/types"]
  }
}
```

**Opção 3: Criar arquivo de declaração local**
```typescript
// types/modules.d.ts
declare module 'react-native' {
    export class Alert {
        static alert(title: string, message?: string): void;
    }
    export class Platform {
        static OS: 'ios' | 'android';
    }
}

declare module 'expo-application' {
    export const nativeApplicationVersion: string;
    export const applicationId: string;
}

declare module 'expo-splash-screen' {
    export function hideAsync(): Promise<void>;
}
```

### Como Funciona o Sistema de Imports Dinâmicos

```typescript
// Em vez de imports estáticos que causariam erros:
// import * as Application from 'expo-application';

// Usamos imports dinâmicos seguros:
const getApplication = async () => {
    try {
        return await import('expo-application');
    } catch (error) {
        console.warn('expo-application não encontrado...');
        return null;
    }
};

// Uso na função:
const Application = await getApplication();
if (!Application) return; // Para se não estiver disponível
```

## Configurações Remotas

O projeto utiliza Firebase Remote Config com as seguintes configurações:

```typescript
interface RemoteConfigSettings {
    is_ads_enabled: boolean;           // Controla exibição de anúncios
    min_version: number;               // Versão mínima obrigatória
    review_mode: number;               // Modo de avaliação
    repeat_ads_count: number;          // Frequência de anúncios
    delay_close_paywall_button: number; // Delay do botão paywall
    ios_app_id: string;               // ID do app na App Store
    is_paywall_disabled: boolean;     // Controla paywall
}
```

## Estrutura do Projeto

```
expo-utils/
├── utils/
│   ├── Utils.ts               # Utilitários principais (com imports dinâmicos)
│   ├── i18n.ts                # Sistema de traduções (12 idiomas)
│   └── types.ts               # Interfaces TypeScript
├── types/
│   └── peer-deps.d.ts         # Tipos mock para peer dependencies
├── examples/
│   ├── _layout.tsx            # Exemplo de uso
│   ├── projeto-usando-expo-utils.md # Guia completo
│   ├── usando-traducoes.md    # Guia de traduções
│   └── app.config.exemplo.js  # Configuração de exemplo
├── docs/
│   └── alternative-approaches.md # Abordagens alternativas
├── package.json               # Dependências + peerDependencies
├── index.ts                  # Exports principais
└── README.md                 # Documentação
```

## Exemplo Completo

Veja o arquivo `examples/_layout.tsx` para um exemplo completo de implementação.

## Por que estas dependências são Peer Dependencies?

| Dependência | Tipo | Motivo |
|-------------|------|--------|
| `react-native` | **Obrigatória** | Framework base - evita conflitos de versão |
| `react` | **Obrigatória** | Biblioteca base - evita duplicação |
| `expo-application` | **Opcional** | Módulo Expo - funcionalidade específica |
| `expo-splash-screen` | **Opcional** | Módulo Expo - funcionalidade específica |

**Dependências normais** (incluídas automaticamente):
- `@react-native-firebase/*` - SDKs específicos para funcionalidades core
- `react-native-purchases` - SDK para compras in-app
- `react-native-fbsdk-next` - SDK do Facebook

**Resultado**: Biblioteca otimizada que não duplica as dependências principais do seu projeto! 🎉

## Licença

ISC 