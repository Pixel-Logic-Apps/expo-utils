# Uso Simples do expo-utils

## Instalação
```bash
npm install https://github.com/Pixel-Logic-Apps/expo-utils.git
```

## Uso Básico (Sem RevenueCat)

```typescript
import { useEffect, useState } from 'react';
import Utils from 'expo-utils';
import appConfig from '../app.config';

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
}

global.isAdsEnabled = true;

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        // Uso simples sem RevenueCat
        Utils.prepare(setAppIsReady, appConfig);
    }, []);

    if (!appIsReady) return null;
    
    return (
        // Seu layout aqui
    );
}
```

## Uso COM RevenueCat

```typescript
import { useEffect, useState } from 'react';
import Utils from 'expo-utils';
import appConfig from '../app.config';

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
}

global.isAdsEnabled = true;

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        // Suas chaves do RevenueCat
        const revenueCatKeys = {
            androidApiKey: "goog_sua_chave_android_aqui",
            iosApiKey: "appl_sua_chave_ios_aqui"
        };

        // Passa as chaves como terceiro parâmetro
        Utils.prepare(setAppIsReady, appConfig, revenueCatKeys);
    }, []);

    if (!appIsReady) return null;
    
    return (
        // Seu layout aqui
    );
}
```

## App Config Mínimo

```javascript
// app.config.js
export default {
  expo: {
    name: "Meu App",
    slug: "meu-app",
    version: "1.0.0",
    
    plugins: [
      "expo-router",
      
      // Apenas se usar Facebook
      [
        "react-native-fbsdk-next",
        {
          "appID": "1234567890"
        }
      ]
    ]
  }
};
```

## Parâmetros da Função `prepare()`

```typescript
Utils.prepare(
    setAppIsReady,        // Callback obrigatório
    appConfig,            // Configuração do app (opcional)
    revenueCatKeys        // Chaves do RevenueCat (opcional)
);
```

### Parâmetros:

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `setAppIsReady` | `(ready: boolean) => void` | ✅ | Callback quando app está pronto |
| `appConfig` | `object` | ❌ | Configuração do app.config |
| `revenueCatKeys` | `{ androidApiKey: string, iosApiKey: string }` | ❌ | Chaves do RevenueCat |

## Funcionalidades Incluídas

✅ **Firebase Remote Config** (se configurado)  
✅ **Splash Screen** controlada  
✅ **Facebook SDK** (se configurado)  
✅ **Push Notifications**  
✅ **Expo Updates** (OTA)  
✅ **Tracking Transparency**  
✅ **RevenueCat** (se chaves fornecidas)  
✅ **Traduções** automáticas (12 idiomas)  