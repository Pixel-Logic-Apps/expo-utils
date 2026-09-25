import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, {type CustomerInfo, type PurchasesEntitlementInfo} from "react-native-purchases";
import {getApp} from "@react-native-firebase/app";
import {getMessaging, subscribeToTopic, unsubscribeFromTopic} from "@react-native-firebase/messaging";
import Utils, {expoUtilsLog, expoUtilsWarn} from "./Utils";
import {logUtilsEvent, setUtilsUserId, setUtilsUserProperty} from "./analytics";

// Estado do assinante no RevenueCat → user property `rc_status` + tópicos FCM para push segmentada.
//
//   Estado (exclusivo)   {slug}-purchase-{status}         1 por aparelho, trocado a cada mudança
//   Marcos (acumulam)    {slug}-purchase-trial_started    viu um trial — o aparelho nunca sai
//                        {slug}-purchase-converted        trial → período pago ativo — nunca sai
//
// Roda no boot e a cada customerInfo novo (listener do RC): o tópico só muda quando o app abre.
// Os eventos de transição (rc_trial_start, purchase, rc_cancellation, rc_billing_issue) quem manda
// é a integração Firebase do RevenueCat, pelo servidor — a lib não duplica.

export type RcStatus =
    | "free"
    | "trial"
    | "trial_cancelled"
    | "intro"
    | "active"
    | "cancelled"
    | "billing_issue"
    | "trial_expired"
    | "expired"
    | "refunded";

export type RcMilestone = "trial_started" | "converted";

type EntitlementLike = Pick<PurchasesEntitlementInfo, "willRenew" | "periodType" | "expirationDate" | "unsubscribeDetectedAt" | "billingIssueDetectedAt"> & {
    expirationDateMillis?: number | null;
};

// Chave LEGADA, sem "@" de propósito: aparelhos da versão anterior já têm o tópico atual gravado
// nela — renomear faria a lib esquecer esse tópico e o aparelho ficaria inscrito nele para sempre.
const STATE_TOPIC_KEY = "FCM_CURRENT_TOPIC";
const MILESTONES_KEY = "@expo_utils_rc_milestones";

// A loja segue tentando cobrar depois que o acesso cai (App Store: billing retry de até 60 dias;
// Play: account hold). Nessa janela quem troca o cartão recupera a assinatura — ainda é
// "falha na renovação", não "expirou".
const BILLING_RETRY_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;
const PAID_PERIOD_TYPES = ["NORMAL", "INTRO", "PREPAID"];

const expirationMs = (entitlement: EntitlementLike): number => {
    if (typeof entitlement.expirationDateMillis === "number") return entitlement.expirationDateMillis;
    const parsed = entitlement.expirationDate ? Date.parse(entitlement.expirationDate) : NaN;
    return Number.isFinite(parsed) ? parsed : Infinity; // sem vencimento = vitalício
};

// O entitlement que manda no ciclo de vida é a ASSINATURA que vence por último. Vitalício só
// decide quando não há assinatura: "remove ads" vitalício + trial do premium = trial.
const pickLifecycleEntitlement = (entitlements: EntitlementLike[]): EntitlementLike | undefined => {
    const subscriptions = entitlements.filter((entitlement) => expirationMs(entitlement) !== Infinity);
    const pool = subscriptions.length > 0 ? subscriptions : entitlements;
    return pool.reduce<EntitlementLike | undefined>((best, entitlement) => (!best || expirationMs(entitlement) > expirationMs(best) ? entitlement : best), undefined);
};

/**
 * Estado atual do assinante. Ordem importa: falha de cobrança vence tudo (inclusive a 1ª cobrança
 * do fim do trial), depois renovação desligada, depois o tipo de período. "Cancelado" exige
 * `unsubscribeDetectedAt` — PREPAID e promocional têm `willRenew: false` sem terem cancelado.
 */
export const getRevenueCatStatus = (customerInfo: CustomerInfo | null | undefined, now: number = Date.now()): RcStatus => {
    const current = pickLifecycleEntitlement(Object.values(customerInfo?.entitlements?.active ?? {}));
    if (current) {
        if (current.billingIssueDetectedAt) return "billing_issue";
        const cancelled = !current.willRenew && !!current.unsubscribeDetectedAt;
        if (current.periodType === "TRIAL") return cancelled ? "trial_cancelled" : "trial";
        if (cancelled) return "cancelled";
        return current.periodType === "INTRO" ? "intro" : "active";
    }

    const last = pickLifecycleEntitlement(Object.values(customerInfo?.entitlements?.all ?? {}));
    if (last) {
        if (Object.values(customerInfo?.subscriptionsByProductIdentifier ?? {}).some((subscription) => subscription?.refundedAt)) return "refunded";
        if (last.billingIssueDetectedAt && now - expirationMs(last) < BILLING_RETRY_WINDOW_MS) return "billing_issue";
        return last.periodType === "TRIAL" ? "trial_expired" : "expired";
    }

    // Compra fora de entitlement (ex.: consumível avulso) conta como ex-cliente, não como free.
    if ((customerInfo?.allPurchasedProductIdentifiers?.length ?? 0) > 0) return "expired";
    return "free";
};

const hasTrialEvidence = (customerInfo: CustomerInfo | null | undefined): boolean =>
    [...Object.values(customerInfo?.entitlements?.all ?? {}), ...Object.values(customerInfo?.subscriptionsByProductIdentifier ?? {})].some(
        (period) => period?.periodType === "TRIAL",
    );

// Pago de verdade = período pago ATIVO e sem falha de cobrança. Carência e período expirado ficam
// de fora: a cobrança do fim do trial que falhou nunca pode contar como conversão.
const hasPaidPeriod = (customerInfo: CustomerInfo | null | undefined): boolean =>
    Object.values(customerInfo?.entitlements?.active ?? {}).some(
        (entitlement) => PAID_PERIOD_TYPES.includes(entitlement.periodType) && !entitlement.billingIssueDetectedAt,
    );

/**
 * Marcos alcançados = os já gravados + o que o customerInfo prova agora. A prova do trial SOME do
 * customerInfo depois da conversão (o período vira NORMAL), por isso `known` vem do aparelho.
 */
export const getReachedMilestones = (customerInfo: CustomerInfo | null | undefined, known: readonly RcMilestone[] = []): RcMilestone[] => {
    const trialStarted = known.includes("trial_started") || hasTrialEvidence(customerInfo);
    const converted = known.includes("converted") || (trialStarted && hasPaidPeriod(customerInfo));
    const reached: RcMilestone[] = [];
    if (trialStarted) reached.push("trial_started");
    if (converted) reached.push("converted");
    return reached;
};

const parseMilestones = (raw: string | null): RcMilestone[] => {
    try {
        const parsed = JSON.parse(raw ?? "[]");
        return Array.isArray(parsed) ? parsed.filter((item): item is RcMilestone => item === "trial_started" || item === "converted") : [];
    } catch {
        return [];
    }
};

// Tópicos que já receberam subscribe NESTA sessão. Todo o resto é reafirmado 1x por sessão:
// backup restaurado traz o AsyncStorage para um token FCM novo, que não está em tópico nenhum.
const assertedThisSession = new Set<string>();

// Fila serial: o boot e o listener rodam juntos na abertura do app e, em paralelo, os dois liam o
// mesmo tópico anterior — o aparelho podia terminar em 2 tópicos de estado.
let queue: Promise<void> = Promise.resolve();

const syncTopics = async (slug: string, status: RcStatus, customerInfo: CustomerInfo | null | undefined): Promise<void> => {
    // O FATO do marco é gravado antes do portão do APNS e sem depender do subscribe: um subscribe
    // que falhou hoje não pode apagar um trial que o customerInfo não vai mostrar amanhã.
    let milestones: RcMilestone[] = [];
    let newMilestones: RcMilestone[] = [];
    try {
        const known = parseMilestones(await AsyncStorage.getItem(MILESTONES_KEY));
        milestones = getReachedMilestones(customerInfo, known);
        newMilestones = milestones.filter((milestone) => !known.includes(milestone));
        if (newMilestones.length > 0) await AsyncStorage.setItem(MILESTONES_KEY, JSON.stringify(milestones));
    } catch (e) {
        expoUtilsWarn("rc-status milestones:", e);
    }

    // subscribe/unsubscribe exigem APNS token no iOS — pula se indisponível (ex.: simulador)
    if (!(await Utils.ensureApnsReady())) return;
    const messaging = getMessaging(getApp());

    try {
        const topic = `${slug}-purchase-${status}`;
        const previousTopic = await AsyncStorage.getItem(STATE_TOPIC_KEY);
        if (previousTopic !== topic) {
            // Unsubscribe falhou → não inscreve nem grava: a próxima execução tenta de novo.
            if (previousTopic) {
                await unsubscribeFromTopic(messaging, previousTopic);
                assertedThisSession.delete(previousTopic);
                logUtilsEvent("fcm_topic_unsubscribe", {fcm_topic: previousTopic});
                expoUtilsLog("Unsubscribed from topic:", previousTopic);
            }
            await subscribeToTopic(messaging, topic);
            assertedThisSession.add(topic);
            await AsyncStorage.setItem(STATE_TOPIC_KEY, topic);
            logUtilsEvent("fcm_topic_subscribe", {fcm_topic: topic, status});
            expoUtilsLog("Subscribed to topic:", topic);
        } else if (!assertedThisSession.has(topic)) {
            await subscribeToTopic(messaging, topic);
            assertedThisSession.add(topic);
        }
    } catch (error) {
        expoUtilsWarn("Failed to update messaging topic:", error);
    }

    // Marco não tem unsubscribe: quem iniciou um trial continua em trial_started para sempre.
    for (const milestone of milestones) {
        const topic = `${slug}-purchase-${milestone}`;
        if (assertedThisSession.has(topic)) continue;
        try {
            await subscribeToTopic(messaging, topic);
            assertedThisSession.add(topic);
            if (newMilestones.includes(milestone)) {
                logUtilsEvent("fcm_topic_subscribe", {fcm_topic: topic, milestone});
                expoUtilsLog("Subscribed to topic:", topic);
            }
        } catch (error) {
            expoUtilsWarn("Failed to subscribe to milestone topic:", topic, error);
        }
    }
};

/**
 * `rc_status` e `user_id` do GA4 na hora (antes do portão do APNS: em simulador o tópico é pulado,
 * a property não; o user_id é reafirmado porque um logIn/restore troca o App User ID); tópicos pela
 * fila serial. A promise nunca rejeita e resolve quando ESTA atualização terminou.
 */
export const syncRcStatus = (slug: string, customerInfo: CustomerInfo | null | undefined): Promise<void> => {
    const status = getRevenueCatStatus(customerInfo);
    setUtilsUserProperty("rc_status", status);
    (async () => {
        try {
            setUtilsUserId(await Purchases.getAppUserID());
        } catch {}
    })();
    const run = queue.then(() => syncTopics(slug, status, customerInfo)).catch((error) => expoUtilsWarn("rc-status:", error));
    queue = run;
    return run;
};
