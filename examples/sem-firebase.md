# Usando expo-utils SEM Firebase

Se você não quiser usar Firebase ou não tiver configurado, o `expo-utils` ainda funciona perfeitamente!

## ✅ Funcionalidades que Funcionam SEM Firebase:

- **RevenueCat** - Compras in-app
- **Facebook SDK** - Analytics e login
- **Expo Updates** - Atualizações OTA
- **Push Notifications** (se configurado no Expo)
- **Splash Screen** - Controle de exibição
- **Tracking Transparency** - Permissões iOS
- **Traduções** - Sistema de i18n
- **Store Review** - Avaliações

## ❌ Funcionalidades que Precisam do Firebase:

- **Remote Config** - Configurações remotas
- **Analytics** - Eventos de uso
- **Push Notifications** com tópicos

## 📦 Uso Básico SEM Firebase

### 1. Instalação
```bash
npm install https://github.com/Pixel-Logic-Apps/expo-utils.git
```

### 2. Importação Correta
```typescript
// ✅ Correto
import Utils from 'expo-utils';

// ❌ Incorreto  
import Utils from "expo-utils/utils/Utils";
```

### 3. Uso no _layout.tsx
```typescript
import { useEffect, useState } from 'react';
import Utils from 'expo-utils';
import appConfig from '../app.config';

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
}

// Configurações padrão (sem Firebase)
global.isAdsEnabled = true;
global.remoteConfigs = {
    is_ads_enabled: true,
    min_version: "1.0.0",
    ios_app_id: "123456789"
};

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        // Funciona mesmo sem Firebase!
        Utils.prepare(setAppIsReady, appConfig);
    }, []);

    if (!appIsReady) {
        return null; // Loading...
    }

    return (
        // Seu layout aqui
    );
}
```

## 🔧 Configurações Mínimas

### app.config.js (Mínimo)
```javascript
export default {
  expo: {
    name: "Meu App",
    slug: "meu-app", // ✅ Obrigatório para push notifications
    version: "1.0.0",
    
    plugins: [
      // RevenueCat (opcional)
      [
        "react-native-purchases",
        {
          "androidApiKey": "goog_your_key",
          "iosApiKey": "appl_your_key"
        }
      ],
      
      // Facebook (opcional)
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

## 📋 Checklist de Funcionamento

Mesmo sem Firebase, você terá:

✅ **App inicializa** normalmente  
✅ **RevenueCat configurado** (se tiver as chaves)  
✅ **Facebook SDK funcionando** (se configurado)  
✅ **Splash screen** controlada  
✅ **Traduções** em 12 idiomas  
✅ **Verificação de updates** OTA  
✅ **Permissões** solicitadas corretamente  

⚠️ **Configurações remotas** usarão valores padrão  
⚠️ **Analytics** não será enviado  
⚠️ **Push notifications** limitadas (apenas Expo)  

## 🚨 Mensagens de Aviso Esperadas

Você verá esses avisos no console (é normal):

```
WARN Firebase app not configured. Some features will be disabled.
WARN Firebase remote config not configured.
WARN Firebase analytics not configured.
WARN Firebase messaging not configured.
```

**Isso é esperado e não afeta o funcionamento do app!**

## 🔄 Adicionando Firebase Depois

Se quiser adicionar Firebase mais tarde:

### 1. Instale as dependências
```bash
npm install @react-native-firebase/app @react-native-firebase/remote-config
```

### 2. Configure no app.config.js
```javascript
plugins: [
  "@react-native-firebase/app",
  // outros plugins...
]
```

### 3. Reinicie o app
```bash
npx expo run:ios
# ou
npx expo run:android
```

O `expo-utils` detectará automaticamente e ativará todas as funcionalidades Firebase!

## 💡 Dicas

- **Desenvolvimento**: Use sem Firebase para prototipagem rápida
- **Produção**: Adicione Firebase para analytics e configurações remotas
- **Híbrido**: Firebase opcional em algumas versões do app
- **Fallbacks**: Sempre tem valores padrão funcionais 