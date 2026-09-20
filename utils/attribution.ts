import {Platform} from "react-native";
import Purchases from "react-native-purchases";
import * as Application from "expo-application";
import * as Device from "expo-device";
import {getCalendars, getLocales} from "expo-localization";
import {AppEventsLogger} from "react-native-fbsdk-next";
import {getApp} from "@react-native-firebase/app";
import {getAnalytics, getAppInstanceId} from "@react-native-firebase/analytics";
import {getAPNSToken, getMessaging, getToken} from "@react-native-firebase/messaging";
import pkg from "../package.json";
import Utils, {expoUtilsLog, expoUtilsWarn} from "./Utils";
import {logUtilsEvent, setUtilsUserId} from "./analytics";
import {lookupGeo, toGeoAttributes} from "./geo";

// Atribuição do RevenueCat em DUAS fases + envio forçado + telemetria.
//
// Por que existe (diagnóstico de 2026-09-20): a atribuição era o ÚLTIMO passo de uma fila
// serial (timers do splash → UMP → ATT → prompt de push → FB → TikTok → ...), sem timeout nos
// getters, e o SDK do RC só ENVIA atributos em compra, background/foreground e login. Quem
// comprava no 1º minuto e não voltava (paywall de onboarding) ficava com o customer vazio.
//
//   Fase 1 — sem consentimento, sem prompt, sem timer: roda logo após o Purchases.configure.
//            O 1º recibo já sai com atributos.
//   Fase 2 — logo após o ATT/UMP, fora da fila de push/FB/TikTok: device identifiers, FB anon
//            id, push token e geo.
//
// Cada etapa tem timeout próprio (try/catch não pega promise nativa que nunca resolve) e cada
// fase termina com um sync forçado e um evento `rc_attribution` — a prova, em produção, de que
// os atributos saíram do aparelho.

type StepState = "ok" | "fail" | "timeout" | "skip";

const STEP_TIMEOUT_MS = 3000;
const SYNC_DEBOUNCE_MS = 2000;
const SYNC_TIMEOUT_MS = 10000;
// O SDK limita syncAttributesAndOfferingsIfNeeded a 5 chamadas por minuto
// (RateLimiter(maxCalls: 5, period: 60)) e, estourado o limite, devolve o cache SEM enviar.
// Ficamos em 4 por janela de 60s; o que passar disso ESPERA a janela abrir (não é descartado).
const MAX_SYNCS_PER_WINDOW = 4;
const SYNC_WINDOW_MS = 60000;

const startedAt = Date.now();
const steps: Record<string, StepState> = {};

const TIMEOUT = Symbol("timeout");
const raceTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> => {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([promise, new Promise<typeof TIMEOUT>((resolve) => (timer = setTimeout(() => resolve(TIMEOUT), ms)))]).finally(() =>
        clearTimeout(timer),
    );
};

// Uma etapa nunca lança e nunca pendura. `fn` pode devolver "skip" quando não se aplica
// (ex.: push em simulador). A etapa que estourou o timeout continua rodando ao fundo — se o
// SDK responder depois, o atributo ainda é gravado e sai no próximo sync.
const runStep = async (id: string, fn: () => Promise<StepState | void | unknown>, timeoutMs = STEP_TIMEOUT_MS): Promise<void> => {
    try {
        const result = await raceTimeout(Promise.resolve().then(fn), timeoutMs);
        if (result === TIMEOUT) {
            steps[id] = "timeout";
            expoUtilsWarn(`attribution/${id}: timeout de ${timeoutMs}ms`);
        } else {
            steps[id] = result === "skip" ? "skip" : "ok";
        }
    } catch (e) {
        steps[id] = "fail";
        expoUtilsWarn(`attribution/${id}:`, e);
    }
};

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimes: number[] = [];
let syncWaiters: Array<(result: number) => void> = [];

const runSync = async () => {
    syncTimer = null;
    // Janela cheia: re-arma para quando o envio mais antigo sair dela, mantendo quem espera.
    syncTimes = syncTimes.filter((at) => Date.now() - at < SYNC_WINDOW_MS);
    if (syncTimes.length >= MAX_SYNCS_PER_WINDOW) {
        syncTimer = setTimeout(runSync, syncTimes[0] + SYNC_WINDOW_MS - Date.now() + 100);
        return;
    }
    const waiters = syncWaiters;
    syncWaiters = [];
    let result = -1;
    try {
        if (typeof Purchases.syncAttributesAndOfferingsIfNeeded === "function") {
            syncTimes.push(Date.now());
            result = (await raceTimeout(Purchases.syncAttributesAndOfferingsIfNeeded(), SYNC_TIMEOUT_MS)) === TIMEOUT ? 0 : 1;
        }
    } catch (e) {
        result = 0;
        expoUtilsWarn("attribution/sync:", e);
    }
    waiters.forEach((waiter) => waiter(result));
};

/**
 * Força o envio dos atributos pendentes ao RevenueCat. Sem isto eles só saem na próxima compra
 * ou no próximo background do app.
 * Resolve 1 = enviado, 0 = falhou/timeout, -1 = SDK sem o método (react-native-purchases antigo).
 *
 * `immediate` (usado ao fim de cada fase): envia JÁ, sem o debounce de 2s que junta sets
 * avulsos. Motivo MEDIDO no emulador: o Android SUSPENDE os timers do JS enquanto a Activity
 * está pausada por um diálogo do sistema (permissão de push, UMP, compra) — com debounce o
 * envio só saía quando o usuário respondia o diálogo (150s no teste). A chamada nativa do
 * sync não depende de timer e sai mesmo com o diálogo na frente.
 */
export const scheduleRcSync = (immediate: boolean = false): Promise<number> =>
    new Promise((resolve) => {
        syncWaiters.push(resolve);
        if (syncTimer) clearTimeout(syncTimer);
        if (immediate) {
            runSync();
        } else {
            syncTimer = setTimeout(runSync, SYNC_DEBOUNCE_MS);
        }
    });

const report = (phase: 1 | 2, ids: string[], synced: number, att?: string) => {
    logUtilsEvent("rc_attribution", {
        phase,
        steps_ok: ids.filter((id) => steps[id] === "ok").join(","),
        steps_fail: ids
            .filter((id) => steps[id] === "fail" || steps[id] === "timeout")
            .map((id) => `${id}:${steps[id]}`)
            .join(","),
        ms: Date.now() - startedAt,
        synced,
        att,
    });
};

const safe = <T>(fn: () => T): T | undefined => {
    try {
        return fn();
    } catch {
        return undefined;
    }
};

/**
 * Atributos de contexto que não precisam de rede, permissão nem consentimento. Chaves custom
 * do RC: ≤ 40 chars, sem `$`. O SDK só regrava quando o valor muda, então repetir a cada
 * sessão não custa rede.
 *   device_region = região CONFIGURADA no aparelho (≠ país da conta da loja ≠ localização).
 */
export const getContextAttributes = async (): Promise<Record<string, string>> => {
    const locale = safe(() => getLocales()[0]);
    const calendar = safe(() => getCalendars()[0]);
    // Corrida própria de 1,5s: uma promise nativa pendurada aqui não pode custar a etapa inteira.
    let installDate: string | undefined;
    try {
        const installedAt = await raceTimeout(Application.getInstallationTimeAsync(), 1500);
        if (installedAt !== TIMEOUT) installDate = installedAt.toISOString().slice(0, 10);
    } catch {}

    const raw: Record<string, string | null | undefined> = {
        language: locale?.languageCode,
        locale: locale?.languageTag,
        device_region: locale?.regionCode,
        currency: locale?.currencyCode,
        timezone: calendar?.timeZone,
        os_version: safe(() => Device.osVersion) ?? String(Platform.Version),
        device_model: safe(() => Device.modelName),
        app_version: Application.nativeApplicationVersion,
        build_number: Application.nativeBuildVersion,
        expo_utils_version: pkg.version,
        install_date: installDate,
    };
    const attributes: Record<string, string> = {};
    for (const key of Object.keys(raw)) {
        const value = raw[key];
        if (value) attributes[key] = String(value);
    }
    return attributes;
};

let phase1Promise: Promise<void> | null = null;
let phase2Promise: Promise<void> | null = null;

/**
 * Fase 1 — roda no boot, logo após o Purchases.configure. Nada aqui depende de ATT/UMP:
 * o token do AdServices a Apple libera sem ATT (e vale 24h — cedo importa), o app instance id
 * do Firebase é identificador first-party, e o resto é contexto do aparelho/app.
 * Memoizada: 1x por sessão.
 */
export const runAttributionPhase1 = (rckey?: string): Promise<void> => {
    if (!rckey) return Promise.resolve();
    if (phase1Promise) return phase1Promise;
    phase1Promise = (async () => {
        if (Platform.OS === "ios") {
            await runStep("adsvc", () => Purchases.enableAdServicesAttributionTokenCollection());
        }
        await runStep("fid", async () => Purchases.setFirebaseAppInstanceID(await getAppInstanceId(getAnalytics(getApp()))));
        await runStep("ctx", async () => Purchases.setAttributes(await getContextAttributes()));
        // País da CONTA da loja (o que define preço/moeda). Apple devolve ISO alpha-3 ("GBR"),
        // Google Play alpha-2 ("GB") — gravado cru.
        await runStep("store", async () => {
            const storefront = await Purchases.getStorefront();
            if (!storefront?.countryCode) return "skip";
            await Purchases.setAttributes({store_country: storefront.countryCode});
        });
        // Liga GA4 → RC: user_id do Analytics = App User ID do RevenueCat. É também o que a
        // integração RevenueCat → Firebase usa para amarrar os eventos server-side ao usuário.
        await runStep("uid", async () => {
            const appUserId = await Purchases.getAppUserID();
            setUtilsUserId(appUserId);
            // typeof: fora do runtime do RN (headless, testes) o global __DEV__ não existe.
            if (typeof __DEV__ !== "undefined" && __DEV__) expoUtilsLog("[expo-utils] RC appUserID (busque por ele no dashboard):", appUserId);
        });
        const ids = ["adsvc", "fid", "ctx", "store", "uid"];
        scheduleRcSync(true).then((synced) => report(1, ids, synced));
    })();
    return phase1Promise;
};

// iOS: o setPushToken do RC grava em `$apnsTokens` e espera o token APNS (hex) — passar o
// token FCM deixava o campo com valor errado. O FCM do iOS vai na chave custom `fcm_token`
// (`$fcmTokens` é a reservada do Android). Android: setPushToken grava o FCM em `$fcmTokens`.
const setPushTokens = async (): Promise<StepState | void> => {
    if (!(await Utils.ensureApnsReady())) return "skip"; // simulador / APNS que não chegou
    const messaging = getMessaging(getApp());
    const fcmToken = await getToken(messaging);
    if (Platform.OS === "ios") {
        const apnsToken = await getAPNSToken(messaging);
        if (apnsToken) await Purchases.setPushToken(apnsToken);
        if (fcmToken) await Purchases.setAttributes({fcm_token: fcmToken});
    } else if (fcmToken) {
        await Purchases.setPushToken(fcmToken);
    }
};

// País / estado / cidade por IP (utils/geo.ts): ligado por padrão, com cache de 7 dias.
const setGeoAttributes = async (): Promise<StepState | void> => {
    const geo = await lookupGeo();
    if (!geo) return "skip"; // desligado, ou a cadeia inteira de provedores falhou
    await Purchases.setAttributes(toGeoAttributes(geo));
};

/**
 * Fase 2 — roda logo depois do ATT (e do UMP), sem esperar push/FB/TikTok.
 * collectDeviceIdentifiers roda SEMPRE: o próprio SDK já o chama dentro do setFBAnonymousID
 * (automaticDeviceIdentifierCollectionEnabled = true), então condicionar ao ATT não protegia
 * nada — sem ATT o iOS zera o IDFA, e IDFV/IP não são escopo do ATT.
 * Memoizada: 1x por sessão. Garante a fase 1 antes (app que chama só setupAttribution).
 */
export const runAttributionPhase2 = (rckey?: string, att?: string): Promise<void> => {
    if (!rckey) return Promise.resolve();
    if (phase2Promise) return phase2Promise;
    phase2Promise = (async () => {
        await runAttributionPhase1(rckey);
        await runStep("ids", () => Purchases.collectDeviceIdentifiers());
        await runStep("fb", async () => Purchases.setFBAnonymousID(await AppEventsLogger.getAnonymousID()));
        // Push e geo em paralelo. O push pode esperar o APNS por até 10s (12s = folga sobre o
        // teto do portão, que é memoizado); a geo tenta até 3 provedores de 3s cada.
        const pushStep = runStep("push", setPushTokens, 12000);
        await runStep("geo", setGeoAttributes, 10000);
        // 1º envio: ids + fb + geo (+ push, se já terminou — o normal no Android, sem APNS).
        const pushWasDone = steps.push !== undefined;
        const early = scheduleRcSync(true);
        await pushStep;
        // Push gravado DEPOIS do 1º envio pede um 2º; senão não há nada novo para mandar.
        const late = !pushWasDone && steps.push === "ok" ? scheduleRcSync(true) : early;
        const synced = Math.max(await early, await late);
        report(2, ["ids", "fb", "push", "geo"], synced, att);
    })();
    return phase2Promise;
};

/**
 * Atributo que depende de um SDK que sobe tarde (TikTok, link-in-bio): grava e agenda o envio.
 * No-op silencioso sem RevenueCat configurado.
 */
export const setRcAttributesLate = async (stepId: string, apply: () => Promise<unknown>): Promise<void> => {
    try {
        if (!(await Purchases.isConfigured())) return;
    } catch {
        return;
    }
    await runStep(stepId, apply);
    if (steps[stepId] === "ok") scheduleRcSync();
};

/**
 * API pública para o app gravar atributos próprios no customer do RevenueCat já com envio
 * forçado (sem isto o atributo só sai na próxima compra ou no próximo background).
 * Resolve true quando os atributos foram aceitos localmente pelo SDK. Nunca lança.
 */
export const setRevenueCatAttributes = async (attributes: Record<string, string | null>): Promise<boolean> => {
    try {
        if (!(await Purchases.isConfigured())) return false;
        await Purchases.setAttributes(attributes);
        scheduleRcSync();
        return true;
    } catch (e) {
        expoUtilsWarn("setRevenueCatAttributes:", e);
        return false;
    }
};
