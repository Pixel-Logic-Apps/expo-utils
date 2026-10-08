import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import {TrendingsTracker, type TrackResponse} from "./TrendingsTracker";
import {logUtilsEvent} from "./analytics";
import {setRcAttributesLate} from "./attribution";
import {expoUtilsWarn} from "./Utils";

// Match do link-in-bio (`trends_tracking_url`): o backend casa o install com a impressão web por IP e
// devolve a campanha.
//
// A flag de "feito" só é gravada quando o SERVIDOR respondeu. Até a 1.4.0 ela era gravada ANTES do
// `trackInstall()`, que nunca lança (offline/timeout devolve `{success: false}`): o install que falhou na
// 1ª abertura nunca era reenviado, e o `install_attribution` saía com `matched: 0`, igual a um "sem
// match" de verdade — poluindo a taxa de match. Agora: falha de rede/servidor vira
// `install_attribution_error` e tenta de novo na próxima abertura do app; `install_attribution` sai 1x
// por install, só com resposta.

// Chave LEGADA (sem "@"): installs que já resolveram numa versão anterior não reenviam.
const DONE_KEY = "tr_is_first_launch_tracking";

// Resposta do servidor = `success: true` (casou ou não). `matched: true` sem `success` também conta:
// um match nunca pode ser descartado nem reenviado. (`?.`: o corpo é o JSON cru do servidor.)
const serverAnswered = (result: TrackResponse | null | undefined): boolean => result?.success === true || result?.matched === true;

let sessionRun: Promise<void> | null = null;

/** 1x por sessão (abertura do app). Não lança; quem chama não precisa aguardar. */
export const trackLinkInBioInstall = (apiUrl: string, appId: string): Promise<void> => {
    if (sessionRun) return sessionRun;
    sessionRun = (async () => {
        TrendingsTracker.init({apiUrl, appId});
        if ((await AsyncStorage.getItem(DONE_KEY)) === "true") return;
        const result = await TrendingsTracker.trackInstall();
        if (!serverAnswered(result)) {
            logUtilsEvent("install_attribution_error", {source: "link_in_bio", error: result?.error ?? "unknown"});
            return;
        }
        await AsyncStorage.setItem(DONE_KEY, "true");
        const matched = result.matched === true;
        logUtilsEvent("install_attribution", {source: "link_in_bio", matched, campaign: result.campaign_id});
        if (!matched) return;
        await setRcAttributesLate("lib", async () => {
            await Purchases.setMediaSource("link_in_bio");
            if (result.campaign_id) await Purchases.setCampaign(String(result.campaign_id));
        });
    })().catch((e) => expoUtilsWarn("initLinkInBioTracking/trackInstall:", e));
    return sessionRun;
};
