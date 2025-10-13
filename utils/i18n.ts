// Sistema de internacionalização para expo-utils
export interface Translations {
    updateRequired: string;
    updateMessage: string;
    updateNow: string;
    newMessage: string;
}

// Traduções disponíveis
export const translations: Record<string, Translations> = {
    // Português (Brasil)
    pt: {
        updateRequired: "Atualização Necessária",
        updateMessage: "Uma nova versão está disponível. Por favor, atualize para continuar usando o aplicativo.",
        updateNow: "Atualizar Agora",
        newMessage: "Nova Mensagem",
    },

    // English (Default)
    en: {
        updateRequired: "Update Required",
        updateMessage: "A new version is available. Please update to continue using the app.",
        updateNow: "Update Now",
        newMessage: "New Message",
    },

    // Español
    es: {
        updateRequired: "Actualización Requerida",
        updateMessage: "Una nueva versión está disponible. Por favor, actualiza para continuar usando la aplicación.",
        updateNow: "Actualizar Ahora",
        newMessage: "Nuevo Mensaje",
    },

    // Français
    fr: {
        updateRequired: "Mise à jour requise",
        updateMessage:
            "Une nouvelle version est disponible. Veuillez mettre à jour pour continuer à utiliser l'application.",
        updateNow: "Mettre à jour maintenant",
        newMessage: "Nouveau Message",
    },

    // Deutsch
    de: {
        updateRequired: "Update erforderlich",
        updateMessage: "Eine neue Version ist verfügbar. Bitte aktualisieren Sie, um die App weiter zu nutzen.",
        updateNow: "Jetzt aktualisieren",
        newMessage: "Neue Nachricht",
    },

    // Italiano
    it: {
        updateRequired: "Aggiornamento richiesto",
        updateMessage: "È disponibile una nuova versione. Aggiorna per continuare a utilizzare l'app.",
        updateNow: "Aggiorna ora",
        newMessage: "Nuovo Messaggio",
    },

    // 日本語 (Japanese)
    ja: {
        updateRequired: "アップデートが必要です",
        updateMessage: "新しいバージョンが利用可能です。アプリを継続してご利用いただくためにアップデートしてください。",
        updateNow: "今すぐアップデート",
        newMessage: "新しいメッセージ",
    },

    // 한국어 (Korean)
    ko: {
        updateRequired: "업데이트 필요",
        updateMessage: "새 버전이 사용 가능합니다. 앱을 계속 사용하려면 업데이트하세요.",
        updateNow: "지금 업데이트",
        newMessage: "새 메시지",
    },

    // 中文 (Chinese Simplified)
    zh: {
        updateRequired: "需要更新",
        updateMessage: "有新版本可用。请更新以继续使用应用程序。",
        updateNow: "立即更新",
        newMessage: "新消息",
    },

    // Русский (Russian)
    ru: {
        updateRequired: "Требуется обновление",
        updateMessage: "Доступна новая версия. Пожалуйста, обновите приложение для продолжения использования.",
        updateNow: "Обновить сейчас",
        newMessage: "Новое сообщение",
    },

    // العربية (Arabic)
    ar: {
        updateRequired: "مطلوب تحديث",
        updateMessage: "يتوفر إصدار جديد. يرجى التحديث للمتابعة في استخدام التطبيق.",
        updateNow: "تحديث الآن",
        newMessage: "رسالة جديدة",
    },

    // Nederlands
    nl: {
        updateRequired: "Update vereist",
        updateMessage: "Er is een nieuwe versie beschikbaar. Update om de app te blijven gebruiken.",
        updateNow: "Nu updaten",
        newMessage: "Nieuw Bericht",
    },
};

// Função para detectar idioma do sistema
export const getSystemLanguage = (): string => {
    try {
        // Web/Metro
        if (typeof navigator !== "undefined" && navigator.language) {
            return navigator.language;
        }

        // React Native iOS/Android
        const NativeModules = require("react-native")?.NativeModules;

        // iOS
        if (NativeModules?.SettingsManager?.settings?.AppleLanguages) {
            return NativeModules.SettingsManager.settings.AppleLanguages[0];
        }

        // Android
        if (NativeModules?.I18nManager?.localeIdentifier) {
            return NativeModules.I18nManager.localeIdentifier;
        }

        // Fallback adicional para React Native
        if (NativeModules?.I18nManager?.localeIdentifier) {
            return NativeModules.I18nManager.localeIdentifier;
        }
    } catch (error) {
        // Ignora erros de detecção
    }

    return "en-US"; // fallback padrão
};

// Função para obter traduções baseadas no idioma
export const getLocalizedMessages = (language?: string): Translations => {
    const resolvedLanguage = (language || getSystemLanguage() || "en").toString();
    const languageCode = resolvedLanguage.split("-")[0].toLowerCase();
    return translations[languageCode] || translations["en"];
};
