// Declarações de módulos opcionais apenas para evitar erros de tipagem quando
// usados como peerDependencies. NÃO declarar 'react-native'.

declare module 'expo-application' {
    export const nativeApplicationVersion: string | undefined;
    export const applicationId: string | undefined;
    export const applicationName: string | undefined;
}

declare module 'expo-splash-screen' {
    export function hideAsync(): Promise<void>;
    export function preventAutoHideAsync(): Promise<void>;
}

declare module 'expo-localization' {
    export interface Locale { languageCode?: string; regionCode?: string }
    export function getLocales(): Locale[];
}

declare module 'expo-tracking-transparency' {
    export function requestTrackingPermissionsAsync(): Promise<{ status: string }>;
}

declare module 'expo-modules-core' {
    export function requireOptionalNativeModule<T = any>(moduleName: string): T;
}

declare module 'react-native-fbsdk-next' {
    export const AppEventsLogger: { getAnonymousID(): Promise<string | null> };
    export const Settings: {
        initializeSDK(): void;
        setAppID(appID: string): void;
        setAdvertiserTrackingEnabled(enabled: boolean): Promise<void>;
    };
}

declare module 'react-native-purchases' {
    interface ConfigureOptions { apiKey: string }
    const Purchases: { configure(opts: ConfigureOptions): void; enableAdServicesAttributionTokenCollection(): Promise<void>; collectDeviceIdentifiers(): Promise<void>; setFBAnonymousID(id: string): Promise<void>; };
    export default Purchases;
}

declare module '@react-native-firebase/analytics' {
    export function getAnalytics(app?: any): any;
    export function logEvent(analytics: any, name: string, params?: any): Promise<void>;
}

declare module '@react-native-firebase/remote-config' {
    export function getRemoteConfig(app?: any): any;
    export function setConfigSettings(rc: any, settings: any): Promise<void>;
    export function setDefaults(rc: any, defaults: any): Promise<void>;
    export function fetchAndActivate(rc: any): Promise<boolean>;
    export function getValue(rc: any, key: string): { asString(): string };
}

declare module '@react-native-firebase/messaging' {
    export function getMessaging(app?: any): any;
    export function requestPermission(messaging: any): Promise<any>;
    export function onMessage(messaging: any, handler: (msg: any) => void): void;
    export function subscribeToTopic(messaging: any, topic: string): Promise<void>;
}

declare module '@microsoft/react-native-clarity' {
    export enum LogLevel { None }
    export function initialize(projectId: string, options?: { logLevel?: LogLevel }): void;
    export function setCustomUserId(id: string): void;
}
 