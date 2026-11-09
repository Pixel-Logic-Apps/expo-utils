import React, {useEffect, useRef, useState} from "react";
import {usePathname} from "expo-router";
import {View} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Utils, {initHotUpdater, expoUtilsWarn} from "./Utils";
import {setupAppOpenListener} from "./appopen-ads";
import AskForReviewOverlay, {AskForReviewEvents} from "./ask-for-review";
import PromotionalContent, {usePromotional} from "./modal-promotional-content";
import {RetentionModalSlot} from "./retention-modal";
import type {AppStrings, OpenDialog} from "./types";
import {useConfigVersion} from "./use-config-version";

// Mantém o splash visível até o app estar pronto (roda no import, antes do mount).
SplashScreen.setOptions({duration: 150, fade: true});
SplashScreen.preventAutoHideAsync().catch(() => {});

type Props = {
    appConfig: any;
    appStrings: AppStrings;
    children: React.ReactNode;
    onReady?: () => void | Promise<void>;
    /** Consentimento do UMP na abertura (padrão true). Ver PrepareOptions em utils/types.ts. */
    umpDialogOnOpen?: boolean;
    /** Alerta do ATT na abertura (padrão true). false: o app chama Utils.requestAttPermission(). */
    attDialogOnOpen?: boolean;
    /** Pedido de permissão de notificação na abertura (padrão true). false: o app chama Utils.requestPushPermission(). */
    pushDialogOnOpen?: boolean;
    /** Nome antigo do pushDialogOnOpen (continua valendo). */
    fcmTrackingAllowed?: boolean;
    /** Ordem dos diálogos da abertura (padrão ["ump", "att", "push"]). Ver PrepareOptions em utils/types.ts. */
    dialogOrder?: readonly OpenDialog[];
    /** Os pedidos do app pela trava (Utils.withPermissionPrompt) esperam os diálogos da abertura (padrão false). */
    appDialogsAfterOpen?: boolean;
};

/**
 * Wrapper de layout do expo-utils. Encapsula TODO o boot do app:
 * hot updater, prepare (Remote Config/RevenueCat/push/etc.), ATT pós-primeiro-frame,
 * app-open ads, promo e ask-for-review — além de renderizar os overlays.
 *
 * O _layout.tsx do projeto só precisa envolver suas telas (Stack) com este componente,
 * passando appConfig (app.json) e appStrings (constants/Strings).
 *
 * `onReady` (opcional): chamado UMA vez, logo após o prepare() — Remote Config, RevenueCat e
 * globals de ads já prontos — e ANTES do setupAppOpenListener(), então o callback ainda
 * consegue influenciar o 1º app-open ad. Erro no callback não trava o boot (warn isolado).
 */
export function ExpoUtilsLayout({
    appConfig,
    appStrings,
    children,
    onReady,
    umpDialogOnOpen,
    attDialogOnOpen,
    pushDialogOnOpen,
    fcmTrackingAllowed,
    dialogOrder,
    appDialogsAfterOpen,
}: Props) {
    const [appIsReady, setAppIsReady] = useState(false);
    const [showReviewOverlay, setShowReviewOverlay] = useState(false);
    // Remote Config novo aplicado com o app fora de vista (`resume_config: "on_leave"`): as telas remontam e leem a config
    // nova. O expo-router guarda a rota fora daqui, então a pessoa volta na mesma tela.
    const configVersion = useConfigVersion();
    const pathname = usePathname();
    const {visible: showPromo, show: showPromoModal, hide: hidePromoModal} = usePromotional(pathname);
    // onReady roda 1x mesmo com StrictMode (dev) rodando o effect 2x — o ref sobrevive ao double-effect.
    const onReadyRan = useRef(false);

    useEffect(() => {
        (async () => {
            try {
                // Remote Config e versão na loja saem junto com a checagem de OTA; o prepare usa as duas já em voo.
                Utils.startBootRequests(appConfig);
                // Espera o OTA antes da 1ª tela de propósito: se houver atualização obrigatória, o app reinicia ainda no
                // splash e a pessoa não vê a tela abrir e piscar.
                await initHotUpdater(appStrings?.hotUpdaterUrl, {apiKey: appStrings?.hotUpdaterApiKey});
                await Utils.prepare(setAppIsReady, appConfig, appStrings, {
                    umpDialogOnOpen,
                    attDialogOnOpen,
                    pushDialogOnOpen: pushDialogOnOpen ?? fcmTrackingAllowed,
                    dialogOrder,
                    appDialogsAfterOpen,
                });
                if (!onReadyRan.current) {
                    onReadyRan.current = true;
                    try {
                        await onReady?.();
                    } catch (e) {
                        expoUtilsWarn("onReady:", e);
                    }
                }
                setupAppOpenListener();
                showPromoModal();
            } catch (e) {
                // Boot NUNCA pode deixar o app preso no splash: qualquer throw aqui (ex.:
                // appStrings inválido num app JS) libera a UI e vira warn em vez de
                // rejection silenciosa com appIsReady=false pra sempre.
                expoUtilsWarn("ExpoUtilsLayout boot:", e);
                setAppIsReady(true);
            }
        })();
        return AskForReviewEvents.onShowPopup(() => setShowReviewOverlay(true));
    }, []);

    if (!appIsReady) return null;

    return (
        <>
            <React.Fragment key={configVersion}>{children}</React.Fragment>
            <PromotionalContent visible={showPromo} onClose={hidePromoModal} />
            <AskForReviewOverlay
                visible={showReviewOverlay}
                onClose={() => setShowReviewOverlay(false)}
                delay={global.remoteConfigUtils?.review_type_delay || 0}
            />
            {/* Modal de retenção (trial cancelado): abre por RetentionEvents.show(). Prioridade 0 =
                este é o dono; os slots do review e do promo só desenham sem o ExpoUtilsLayout. */}
            <RetentionModalSlot priority={0} />
            <View onLayout={Utils.handleReady} />
        </>
    );
}

export default ExpoUtilsLayout;
