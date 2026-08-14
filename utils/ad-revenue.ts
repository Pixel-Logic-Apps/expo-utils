import {getAnalytics, logEvent} from "@react-native-firebase/analytics";
import {getApp} from "@react-native-firebase/app";
import {expoUtilsLog} from "./Utils";

/**
 * Payload do evento `paid` do Google Mobile Ads (ILRD — impression-level ad revenue).
 * O SDK não expõe em JS qual REDE serviu o ad: `value/currency/precision` é tudo que chega.
 *
 * `currencyCode` existe porque o RNGMA é inconsistente: banner/full-screen mandam `currency`,
 * native ad manda `currencyCode`.
 */
type PaidEvent = {
    currency?: string;
    currencyCode?: string;
    precision?: number | string;
    value?: number;
};

/**
 * Manda 1 evento `ad_revenue` por impressão paga (formato + placement + valor).
 *
 * Serve para medir receita POR PLACEMENT (qual tela/gatilho paga melhor) — que é o dado que
 * o console do AdMob não dá. A atribuição POR REDE de mediation NÃO vem daqui: ligue o
 * Impression-level ad revenue no console do AdMob e o link AdMob↔Firebase, que o próprio
 * AdMob passa a enviar o evento automático `ad_impression` com `ad_source` (a rede),
 * `ad_format`, `ad_unit_name` e `value`. Os dois juntos fecham a conta: rede × placement.
 *
 * Best-effort: nunca lança, nunca espera (o show do ad não pode depender de telemetria).
 */
export const logAdRevenue = (format: string, placementId: string, event?: PaidEvent): void => {
    try {
        expoUtilsLog(
            `[expo-utils] ad_revenue ${format} ${placementId}:`,
            event?.value,
            event?.currency ?? event?.currencyCode,
        );
        // Promise.resolve: as typings do RNFB declaram logEvent como void, mas em runtime é
        // promise — sem o wrapper a rejeição viraria unhandled rejection.
        Promise.resolve(
            logEvent(getAnalytics(getApp()), "ad_revenue", {
                format,
                placementId,
                value: typeof event?.value === "number" ? event.value : 0,
                currency: event?.currency ?? event?.currencyCode ?? "USD",
                precision: String(event?.precision ?? "UNKNOWN"),
            }),
        ).catch(() => {});
    } catch {}
};
