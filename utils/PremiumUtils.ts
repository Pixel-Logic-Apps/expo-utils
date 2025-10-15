import AsyncStorage from "@react-native-async-storage/async-storage";
import {Platform} from "react-native";
import Purchases from "react-native-purchases";

/**
 * Classe utilitária para gerenciar funcionalidades relacionadas ao status premium
 */
export class PremiumUtils {
    private static revenueCatKeys?: {androidApiKey: string; iosApiKey: string};

    /**
     * Cria uma classe configurada com as keys do RevenueCat
     * @param revenueCatKeys - Chaves de API do RevenueCat para iOS e Android
     * @returns A própria classe PremiumUtils (para passar ao Utils.prepare)
     */
    static withKeys(revenueCatKeys: {androidApiKey: string; iosApiKey: string}) {
        PremiumUtils.revenueCatKeys = revenueCatKeys;
        return PremiumUtils;
    }

    /**
     * Configura o RevenueCat com attribution
     * Este método é chamado internamente pelo Utils.prepare() se a classe for passada
     * @param facebookAnonymousId - ID anônimo do Facebook (opcional)
     * @returns O App User ID do RevenueCat (para usar no Clarity)
     */
    static async setup(facebookAnonymousId?: string): Promise<string | null> {
        try {

            if (!PremiumUtils.revenueCatKeys) {
                console.warn("RevenueCat keys not configured. Call PremiumUtils.withKeys() first.");
                return null;
            }

            // 1. Configura o RevenueCat
            const apiKey =
                Platform.OS === "android"
                    ? PremiumUtils.revenueCatKeys.androidApiKey
                    : PremiumUtils.revenueCatKeys.iosApiKey;

            if (!apiKey) {
                console.warn("RevenueCat API key not found for platform:", Platform.OS);
                return null;
            }

            Purchases.configure({apiKey});

            // 2. Configura as attributions
            await Purchases.enableAdServicesAttributionTokenCollection();
            await Purchases.collectDeviceIdentifiers();
            if (facebookAnonymousId) {
                await Purchases.setFBAnonymousID(facebookAnonymousId);
            }

            // 3. Retorna o App User ID do RevenueCat
            return await Purchases.getAppUserID() || null;
        } catch (error) {
            console.error("Error setting up RevenueCat:", error);
            return null;
        }
    }
    /**
     * Define o status premium do usuário
     * @param isPremium - true se o usuário é premium, false caso contrário
     */
    static async setIsPremiumStatus(isPremium: boolean): Promise<void> {
        await AsyncStorage.setItem("@isPremium", JSON.stringify(isPremium));
    }

    /**
     * Verifica se o usuário possui status premium
     * Retorna true apenas se o usuário tem assinatura/trial ativo E não cancelado (willRenew = true)
     *
     * IMPORTANTE: Usuários que cancelaram (opted-out) não terão acesso premium,
     * mesmo que ainda estejam dentro do período pago/trial
     *
     * @param Purchases - O módulo react-native-purchases (opcional, passe se instalado)
     * @returns Promise<boolean> - true se o usuário é premium, false caso contrário
     */
    static async getIsPremiumStatus(Purchases?: any): Promise<boolean> {
        try {
            if (__DEV__) {
                return (await AsyncStorage.getItem("@isPremium")) === "true";
            }

            if (!Purchases) {
                return false;
            }

            const customerInfo = await Purchases.getCustomerInfo();

            // Se o trial opted out estiver habilitado, retorna true se o usuário
            // tem uma assinatura ativa mesmo que cancelado logo em seguida.
            if (global?.remoteConfigs?.is_opted_out_trial_enabled === true) {
                return customerInfo.activeSubscriptions.length > 0;
            }

            // Verifica entitlements ativos
            const activeEntitlements = customerInfo.entitlements.active;

            // Verifica se há algum entitlement ativo que NÃO foi cancelado
            for (const entitlementId in activeEntitlements) {
                const entitlement = activeEntitlements[entitlementId];

                // Retorna true apenas se:
                // 1. Entitlement está ativo (isActive = true)
                // 2. NÃO foi cancelado/opted-out (willRenew = true)
                // 3. NÃO foi detectado unsubscribe (unsubscribeDetectedAt = null)
                if (entitlement.isActive && entitlement.willRenew && !entitlement.unsubscribeDetectedAt) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error("Erro ao verificar status premium:", error);
            return false;
        }
    }
}
