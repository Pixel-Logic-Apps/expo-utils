/** Source intervals in seconds. Changing duration shifts every later event together. */
export const REVIEW_TUTORIAL_TRANSITIONS = [
    {key: "storeOpen", label: "Abrir a Play Store", start: 1.4, end: 1.9, defaultDuration: 0.7},
    {key: "homeEnter", label: "Entrar na loja", start: 2.1, end: 2.7, defaultDuration: 1.35},
    {key: "accountOpen", label: "Abrir o menu da conta", start: 3.7, end: 4.0, defaultDuration: 1.05},
    {key: "manageOpen", label: "Ir para Gerenciar apps", start: 5.4, end: 5.8, defaultDuration: 1.35},
    {key: "slideDown", label: "Slide down · recuar a tela", start: 7.5, end: 7.9, defaultDuration: 0.25},
    {key: "reviewsOpen", label: "Carregar as avaliações", start: 7.9, end: 8.4, defaultDuration: 0.5},
    {key: "composerOpen", label: "Abrir o comentário", start: 9.7, end: 10.0, defaultDuration: 0.65},
    {key: "typing", label: "Digitar o comentário", start: 12.2, end: 16.1, defaultDuration: 3.9},
] as const;

/** Durations in seconds, from 0.05 to 30. Omitted values use defaultDuration above. */
export type ReviewTutorialTimings = Partial<Record<(typeof REVIEW_TUTORIAL_TRANSITIONS)[number]["key"], number>>;
