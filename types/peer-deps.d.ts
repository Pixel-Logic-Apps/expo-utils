// Mock types for peer dependencies
// Estes tipos são usados apenas para desenvolvimento quando as peer dependencies não estão instaladas

declare module 'expo-application' {
    export const nativeApplicationVersion: string;
    export const applicationId: string;
    export const applicationName: string;
}

declare module 'expo-splash-screen' {
    export function hideAsync(): Promise<void>;
    export function preventAutoHideAsync(): Promise<void>;
}

declare module 'react-native' {
    export interface AlertButton {
        text?: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }

    export interface AlertOptions {
        cancelable?: boolean;
        onDismiss?: () => void;
    }

    export class Alert {
        static alert(
            title: string,
            message?: string,
            buttons?: AlertButton[],
            options?: AlertOptions,
        ): void;
    }

    export class Platform {
        static OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    }
} 