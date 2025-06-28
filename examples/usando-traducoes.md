# Usando o Sistema de Traduções

Se você quiser usar apenas o sistema de traduções do `expo-utils` sem o `Utils.prepare()`:

## Importação

```typescript
import { getLocalizedMessages, translations } from 'expo-utils';
```

## Uso Básico

```typescript
import { getLocalizedMessages } from 'expo-utils';
import { Alert } from 'react-native';

// Detecta automaticamente o idioma do sistema
const messages = getLocalizedMessages();

// Usa as traduções
Alert.alert(
    messages.updateRequired,
    messages.updateMessage,
    [{ text: messages.updateNow, onPress: () => {} }]
);
```

## Idiomas Disponíveis

```typescript
import { translations } from 'expo-utils';

// Acesso direto às traduções
console.log(translations.pt.updateRequired); // "Atualização Necessária"
console.log(translations.en.updateRequired); // "Update Required"
console.log(translations.es.updateRequired); // "Actualización Requerida"
console.log(translations.fr.updateRequired); // "Mise à jour requise"
```

## Exemplo Personalizado

```typescript
import { getLocalizedMessages } from 'expo-utils';

const MyComponent = () => {
    const messages = getLocalizedMessages();
    
    const showUpdateAlert = () => {
        Alert.alert(
            messages.updateRequired,
            messages.updateMessage,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: messages.updateNow, onPress: handleUpdate }
            ]
        );
    };

    return (
        <Button 
            title={messages.updateNow}
            onPress={showUpdateAlert}
        />
    );
};
```

## Detecção de Idioma

O sistema detecta automaticamente:

1. **Web**: `navigator.language`
2. **iOS**: `SettingsManager.settings.AppleLanguages[0]`
3. **Android**: `I18nManager.localeIdentifier`
4. **Fallback**: Inglês (`en`)

Exemplos de detecção:
- `pt-BR` → Usa traduções em português
- `en-US` → Usa traduções em inglês  
- `es-ES` → Usa traduções em espanhol
- `unknown` → Fallback para inglês

## Adicionando Novos Idiomas

Para contribuir com novos idiomas, edite o arquivo `utils/i18n.ts`:

```typescript
export const translations: Record<string, Translations> = {
    // Novo idioma
    'sv': {
        updateRequired: 'Uppdatering krävs',
        updateMessage: 'En ny version är tillgänglig...',
        updateNow: 'Uppdatera nu',
        newMessage: 'Nytt meddelande'
    }
};
``` 