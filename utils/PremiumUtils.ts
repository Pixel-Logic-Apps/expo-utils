import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";

/**
 * Classe utilitária para gerenciar funcionalidades relacionadas ao status premium
 */
export class PremiumUtils {

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
     * @returns Promise<boolean> - true se o usuário é premium, false caso contrário
     */
    static async getIsPremiumStatus(): Promise<boolean> {
        try {
            if (__DEV__) {
                return await AsyncStorage.getItem("@isPremium") === "true";
            }

            const customerInfo = await Purchases.getCustomerInfo();

            // Se o trial opted out estiver habilitado, retorna true se o usuário 
            // tem uma assinatura ativa mesmo que cancelado logo em seguida.
            if(global?.remoteConfigs?.is_opted_out_trial_enabled === true) {
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
