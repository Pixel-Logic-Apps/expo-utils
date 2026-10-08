import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, {type PurchasesEntitlementInfo} from "react-native-purchases";
import {expoUtilsWarn, isRevenueCatActive} from "./Utils";

type EntitlementLike = Pick<PurchasesEntitlementInfo, "isActive" | "willRenew" | "periodType" | "store" | "expirationDate" | "unsubscribeDetectedAt" | "billingIssueDetectedAt">;

/**
 * Entitlement ativo que dá Premium. Intenção de sempre: quem DESLIGOU a renovação (assinatura ou trial
 * cancelado) perde o Premium na hora, e falha de cobrança também tira.
 *
 * `willRenew` sozinho não separa isso: os SDKs do RevenueCat o zeram em CINCO casos (iOS
 * `EntitlementInfo.willRenewWithExpirationDate`, Android `EntitlementInfoHelper.getWillRenew`, lidos no
 * fonte): promocional, vitalício (sem `expirationDate`), cancelado, falha de cobrança e PREPAID do Play.
 * Só cancelado e falha de cobrança são perda de acesso — a compra vitalícia "remover anúncios", o plano
 * pré-pago e a concessão promocional seguem Premium, como no `rc_status` (`active`, utils/rc-status.ts).
 */
export const isPremiumEntitlement = (entitlement: EntitlementLike | null | undefined): boolean => {
    if (!entitlement?.isActive || entitlement.unsubscribeDetectedAt) return false;
    if (entitlement.willRenew) return true;
    if (entitlement.billingIssueDetectedAt) return false;
    return !entitlement.expirationDate || entitlement.periodType === "PREPAID" || entitlement.store === "PROMOTIONAL";
};

/**
 * Classe utilitária para gerenciar funcionalidades relacionadas ao status premium.
 *
 * FONTE ÚNICA de "é premium?" da lib (app-open, interstitial/rewarded, banners e paywall
 * delegam pra cá): em __DEV__ lê o toggle local @isPremium; em PRODUÇÃO consulta SEMPRE o
 * RevenueCat (decisão 2026-07-11 — o storage não é mais lido em produção; o cache offline
 * fica por conta do próprio SDK do RevenueCat).
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
     * Retorna true se algum entitlement ativo dá Premium (`isPremiumEntitlement`): assinatura/trial
     * renovando, compra vitalícia, plano pré-pago (Play) ou concessão promocional.
     *
     * IMPORTANTE: Usuários que cancelaram (opted-out) não terão acesso premium,
     * mesmo que ainda estejam dentro do período pago/trial (idem falha de cobrança)
     *
     * @returns Promise<boolean> - true se o usuário é premium, false caso contrário
     */
    static async getIsPremiumStatus(): Promise<boolean> {
        try {
            // DEV: @isPremium é apenas o toggle de desenvolvimento (dev menu).
            if (__DEV__) {
                return (await AsyncStorage.getItem("@isPremium")) === "true";
            }

            // PRODUÇÃO: RevenueCat é a fonte única. isRevenueCatActive() exige configure feito
            // + chamada real funcionando (isConfigured() sozinho mente com key inválida).
            // RC indisponível → trata como não-premium.
            if (!(await isRevenueCatActive())) return false;

            const customerInfo = await Purchases.getCustomerInfo();

            // Se o trial opted out estiver habilitado, retorna true se o usuário
            // tem uma assinatura ativa mesmo que cancelado logo em seguida.
            // `activeSubscriptions` só lista assinaturas: compra vitalícia (e concessão
            // promocional) entra pelo entitlement ativo.
            if (global?.remoteConfigUtils?.is_opted_out_trial_enabled === true) {
                return customerInfo.activeSubscriptions.length > 0 || Object.keys(customerInfo.entitlements.active).length > 0;
            }

            // Verifica entitlements ativos
            const activeEntitlements = customerInfo.entitlements.active;

            // Algum entitlement ativo que NÃO foi cancelado nem está com falha de cobrança.
            for (const entitlementId in activeEntitlements) {
                if (isPremiumEntitlement(activeEntitlements[entitlementId])) return true;
            }

            return false;
        } catch (error) {
            expoUtilsWarn("Erro ao verificar status premium:", error);
            return false;
        }
    }
}
