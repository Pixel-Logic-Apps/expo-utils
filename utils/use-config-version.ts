import {useEffect, useState} from "react";
import Utils, {getConfigVersion, onConfigApplied} from "./Utils";

/**
 * Versão da config da sessão, para o `key` do navegador do layout: sobe quando o Remote Config novo é aplicado com o app
 * fora de vista (`resume_config: "on_leave"`; regra em utils/resume-config.ts), e as telas remontam já com ele. Usar
 * este hook é o que liga o `on_leave` no app: sem ele a lib não troca a config na volta. O ExpoUtilsLayout já usa.
 *
 * Remontar perde a rolagem e o estado das telas e roda de novo os efeitos de montagem (intersticial ao focar, contagens,
 * pedidos de permissão): confira o app antes de ligar o `on_leave` no Remote Config dele.
 *
 * @example const configVersion = useConfigVersion(); return <Stack key={configVersion} />;
 */
export const useConfigVersion = (): number => {
    const [version, setVersion] = useState(getConfigVersion);
    useEffect(() => {
        Utils.setupResumeConfig();
        return onConfigApplied(() => setVersion(getConfigVersion()));
    }, []);
    return version;
};
