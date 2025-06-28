# Exemplo: Projeto Usando expo-utils

Este é um exemplo completo de como configurar um projeto Expo para usar a biblioteca expo-utils.

## 1. Instalação

```bash
# Instalar a biblioteca expo-utils
npm install expo-utils

# Instalar peer dependencies obrigatórias
npm install react-native

# Instalar peer dependencies opcionais (recomendadas)
npm install expo-application expo-splash-screen

# Instalar outras dependências já incluídas no expo-utils
npm install @react-native-firebase/app @react-native-firebase/messaging
# ... outras conforme necessário
```

## 2. Configuração do app.config.js

```javascript
// app.config.js
export default {
  expo: {
    name: "Meu App Incrível",
    slug: "meu-app-incrivel",
    version: "1.0.0",
    
    plugins: [
      // Facebook SDK
      [
        "react-native-fbsdk-next",
        {
          "appID": "1234567890123456",
          "clientToken": "abc123def456",
          "displayName": "Meu App"
        }
      ],
      
      // RevenueCat
      [
        "react-native-purchases",
        {
          "androidApiKey": "goog_YOUR_ANDROID_KEY_HERE",
          "iosApiKey": "appl_YOUR_IOS_KEY_HERE"
        }
      ],
      
      // Outras configurações...
      "expo-router",
      "@react-native-firebase/app"
    ]
  }
};
```

## 3. Configuração do _layout.tsx

```typescript
// app/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import Utils from 'expo-utils';
import appConfig from '../app.config';

// ✅ Declarações globais obrigatórias
declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
}

// ✅ Inicialização das variáveis globais
global.isAdsEnabled = true; // ou false em desenvolvimento

// ✅ Prevenir auto-hide da splash screen
SplashScreen.preventAutoHideAsync().then();

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        // ✅ Chamada principal - passa toda a configuração do app
        Utils.prepare(setAppIsReady, appConfig);
    }, []);

    // ✅ Aguarda inicialização completa
    if (!appIsReady) {
        return null; // Ou componente de loading customizado
    }

    return (
        <>
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: '#007AFF',
                    headerShown: false,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons 
                                name={focused ? 'home' : 'home-outline'} 
                                color={color} 
                                size={24} 
                            />
                        ),
                    }}
                />
                {/* Mais screens... */}
            </Tabs>
            <StatusBar style="auto" />
        </>
    );
}
```

## 4. Usando Configurações Remotas

```typescript
// components/AdBanner.tsx
import React from 'react';
import { View } from 'react-native';

export default function AdBanner() {
    // ✅ Acessando variáveis globais configuradas pelo expo-utils
    if (!global.isAdsEnabled || !global.remoteConfigs?.is_ads_enabled) {
        return null;
    }

    return (
        <View>
            {/* Seu componente de anúncio */}
        </View>
    );
}
```

## 5. Configuração Firebase (opcional)

```typescript
// firebase.config.ts
import { initializeApp } from '@react-native-firebase/app';

// O expo-utils já faz a configuração básica,
// mas você pode adicionar configurações específicas aqui
```

## 6. Package.json Resultante

```json
{
  "name": "meu-projeto",
  "dependencies": {
    "expo": "~50.0.0",
    "expo-utils": "^1.0.0",
    
    // Peer dependencies obrigatórias
    "react-native": "0.76.6",
    
    // Peer dependencies opcionais (recomendadas)
    "expo-application": "^6.0.2",
    "expo-splash-screen": "^0.29.14",
    
    // Dependências principais já incluídas no expo-utils
    "@react-native-firebase/app": "^22.2.1",
    "@react-native-firebase/messaging": "^22.2.1",
    "react-native-fbsdk-next": "^13.4.1",
    // ... etc
  }
}
```

## 7. O que acontece automaticamente

Quando você chama `Utils.prepare(setAppIsReady, appConfig)`:

✅ **RevenueCat configurado** com chaves do `app.config`  
✅ **Firebase Remote Config carregado**  
✅ **Variáveis globais populadas**  
✅ **Verificação de atualizações OTA**  
✅ **Facebook SDK inicializado** com appID do `app.config`  
✅ **Push notifications configuradas** com slug do `app.config`  
✅ **Splash screen ocultada** quando tudo estiver pronto  
✅ **Permissões solicitadas** (tracking, notifications)  

## 8. Troubleshooting

**Erro TypeScript: "Cannot find module 'react-native'" ou "Cannot find module 'expo-splash-screen'"**

Este erro acontece durante o desenvolvimento quando o TypeScript tenta resolver os tipos das peer dependencies.

**Solução 1 (Recomendada):**
```bash
# Obrigatórias
npm install react-native

# Opcionais
npm install expo-application expo-splash-screen
```

**Solução 2 - Adicionar ao tsconfig.json:**
```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./node_modules/expo-utils/types"],
    "skipLibCheck": true
  }
}
```

**Solução 3 - Criar types/modules.d.ts:**
```typescript
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

**Erro: "expo-application não encontrado" (Runtime)**
```bash
npm install expo-application
```

**Erro: "expo-splash-screen não encontrado" (Runtime)**
```bash
npm install expo-splash-screen
```

**App não inicializa:**
- Verifique se as declarações globais estão no `_layout.tsx`
- Confirme que `SplashScreen.preventAutoHideAsync()` foi chamado
- Verifique se `appConfig` está sendo passado corretamente

**Avisos sobre chaves não encontradas:**
- **RevenueCat**: Configure o plugin `react-native-purchases` no `app.config`
- **Facebook**: Configure o plugin `react-native-fbsdk-next` no `app.config`
- As funcionalidades continuam funcionando mesmo sem essas configurações

**Push notifications não funcionam:**
- Confirme que `appConfig.expo.slug` está correto
- Verifique configuração do Firebase
- Teste em device físico (não funciona no simulador) 