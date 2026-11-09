// ExpoUtilsLayout repassa ao Utils.prepare as opções dos diálogos da abertura (umpDialogOnOpen, attDialogOnOpen,
// pushDialogOnOpen ou o nome antigo fcmTrackingAllowed, dialogOrder e appDialogsAfterOpen). Os hooks do React rodam na hora
// (o efeito do boot sai no 1º render) e, com o app ainda não pronto, o componente devolve null: nada é desenhado.
import {expect, mock, test} from "bun:test";

const stub = () => () => {};
const resolved = (value?: any) => () => Promise.resolve(value);
const prepared: any[] = [];

mock.module("react", () => ({
    default: {Fragment: "Fragment"},
    Fragment: "Fragment",
    useEffect: (effect: () => void) => {
        effect();
    },
    useState: (initial: any) => [initial, stub()],
    useRef: (initial: any) => ({current: initial}),
}));
mock.module("react/jsx-runtime", () => ({jsx: () => null, jsxs: () => null, Fragment: "Fragment"}));
mock.module("react-native", () => ({View: "View"}));
mock.module("expo-router", () => ({usePathname: () => "/"}));
mock.module("expo-splash-screen", () => ({setOptions: stub(), preventAutoHideAsync: resolved()}));
mock.module("../utils/Utils", () => ({
    default: {
        startBootRequests: stub(),
        prepare: (_setAppIsReady: any, _appConfig: any, _appStrings: any, options: any) => {
            prepared.push(options);
            return Promise.resolve();
        },
        handleReady: stub(),
    },
    initHotUpdater: resolved(),
    expoUtilsWarn: stub(),
}));
mock.module("../utils/appopen-ads", () => ({setupAppOpenListener: stub()}));
mock.module("../utils/ask-for-review", () => ({default: () => null, AskForReviewEvents: {onShowPopup: () => stub()}}));
mock.module("../utils/modal-promotional-content", () => ({
    default: () => null,
    usePromotional: () => ({visible: false, show: stub(), hide: stub()}),
}));
mock.module("../utils/retention-modal", () => ({RetentionModalSlot: () => null}));
mock.module("../utils/use-config-version", () => ({useConfigVersion: () => 0}));

const {ExpoUtilsLayout} = await import("../utils/ExpoUtilsLayout");

const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};
const boot = async (props: Record<string, any>) => {
    expect(ExpoUtilsLayout({appConfig: {}, appStrings: {}, children: null, ...props} as any)).toBeNull();
    await flush();
    return prepared.at(-1);
};

test("repassa dialogOrder e appDialogsAfterOpen ao prepare", async () => {
    expect(await boot({dialogOrder: ["att", "push", "ump"], appDialogsAfterOpen: true})).toEqual({
        umpDialogOnOpen: undefined,
        attDialogOnOpen: undefined,
        pushDialogOnOpen: undefined,
        dialogOrder: ["att", "push", "ump"],
        appDialogsAfterOpen: true,
    });
});

test("sem as props novas: nada muda (o prepare usa os padrões)", async () => {
    expect(await boot({attDialogOnOpen: false, fcmTrackingAllowed: false})).toEqual({
        umpDialogOnOpen: undefined,
        attDialogOnOpen: false,
        pushDialogOnOpen: false, // o nome antigo continua valendo
        dialogOrder: undefined,
        appDialogsAfterOpen: undefined,
    });
});
