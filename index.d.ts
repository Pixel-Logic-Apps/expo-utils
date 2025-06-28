export { default as Utils } from './utils/Utils';
export { default } from './utils/Utils';
export type { AppConfig, RemoteConfigSettings, FacebookConfig, RevenueCatKeys } from './utils/types';
export type { Translations } from './utils/i18n';
export { getLocalizedMessages, translations, getSystemLanguage } from './utils/i18n';

// Re-export tipos mock se necessário
/// <reference path="./types/peer-deps.d.ts" /> 