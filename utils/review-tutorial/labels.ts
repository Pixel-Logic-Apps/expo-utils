/**
 * Rótulos da interface da Play Store usados pelo tutorial de avaliação.
 *
 * IMPORTANTE: estas strings NÃO são do app — são rótulos de propriedade do Google que o
 * usuário vai procurar na tela dele. Traduzir por conta própria faz o tutorial mandar o
 * usuário procurar um rótulo que não existe.
 *
 * Fonte oficial, na ordem de preferência:
 *
 *   1. APK da Play Store (exato). A Play Store é entregue em split APKs, um por idioma:
 *        adb shell pm path com.android.vending      # base.apk + split_config.<locale>.apk
 *        adb pull <path> .
 *        apktool d base.apk -o out                  # ou: aapt2 dump resources
 *      As strings ficam em out/res/values-<locale>/strings.xml.
 *
 *   2. Central de Ajuda localizada (bom o bastante para os itens de menu):
 *        https://support.google.com/googleplay/answer/...?hl=<locale>
 *
 * Locales sem entrada caem em `en` via getPlayLabels(). O conjunto de locales alvo é o mesmo
 * da tabela TRANSLATIONS de utils/ask-for-review.tsx (31 idiomas).
 */

export interface PlayLabels {
    /** Nome do app da loja no launcher. */
    playStore: string;
    /** Abas da home da Play Store. */
    tabForYou: string;
    tabTrending: string;
    tabWorkApps: string;
    tabKids: string;
    /** Bottom sheet da conta. */
    manageAccount: string;
    manageAppsDevices: string;
    notificationsOffers: string;
    paymentsSubscriptions: string;
    playProtect: string;
    playPoints: string;
    library: string;
    /** Tela "Gerenciar apps e dispositivos". */
    updateAll: string;
    seeDetails: string;
    storageUsed: string;
    syncApps: string;
    noDeviceSynced: string;
    ratingsReviews: string;
    /** Tela "Avaliações". */
    reviewsTitle: string;
    tabNotRated: string;
    tabPosted: string;
    sendFeedback: string;
    privateFeedback: string;
    fromYourLibrary: string;
    /** Composer de avaliação. */
    post: string;
    privacyNotice: string;
    learnMore: string;
    describeExperience: string;
    /** Texto de exemplo digitado no campo. */
    sampleReview: string;
}

const en: PlayLabels = {
    playStore: "Play Store",
    tabForYou: "For you",
    tabTrending: "Top charts",
    tabWorkApps: "Work apps",
    tabKids: "Kids",
    manageAccount: "Manage your Google Account",
    manageAppsDevices: "Manage apps and device",
    notificationsOffers: "Notifications and offers",
    paymentsSubscriptions: "Payments and subscriptions",
    playProtect: "Play Protect",
    playPoints: "Play Points",
    library: "Library",
    updateAll: "Update all",
    seeDetails: "See details",
    storageUsed: "2.8 GB of 6.2 GB used",
    syncApps: "Sync apps to devices",
    noDeviceSynced: "No device synced",
    ratingsReviews: "Ratings and reviews",
    reviewsTitle: "Reviews",
    tabNotRated: "Not rated",
    tabPosted: "Posted",
    sendFeedback: "Send feedback",
    privateFeedback: "Private feedback to the developer",
    fromYourLibrary: "From your library",
    post: "Post",
    privacyNotice:
        "Reviews are public and include your account and device info. Others can see your review.",
    learnMore: "Learn more",
    describeExperience: "Describe your experience (required)",
    sampleReview: "Love this app!",
};

const pt: PlayLabels = {
    playStore: "Play Store",
    tabForYou: "Para você",
    tabTrending: "Em alta",
    tabWorkApps: "Apps de trabalho",
    tabKids: "Crianças",
    manageAccount: "Gerenciar sua Conta do Google",
    manageAppsDevices: "Gerenciar apps e dispositivos",
    notificationsOffers: "Notificações e ofertas",
    paymentsSubscriptions: "Pagamentos e assinaturas",
    playProtect: "Play Protect",
    playPoints: "Play Points",
    library: "Biblioteca",
    updateAll: "Atualizar tudo",
    seeDetails: "Conferir detalhes",
    storageUsed: "2,8 GB de 6,2 GB em uso",
    syncApps: "Sincronizar apps com os dispositivos",
    noDeviceSynced: "Nenhum dispositivo sincronizado",
    ratingsReviews: "Notas e avaliações",
    reviewsTitle: "Avaliações",
    tabNotRated: "Sem avaliação",
    tabPosted: "Postado",
    sendFeedback: "Envie feedback",
    privateFeedback: "Feedback privado para o desenvolvedor",
    fromYourLibrary: "Da sua biblioteca",
    post: "Postar",
    privacyNotice:
        "As avaliações são visíveis apenas aos desenvolvedores e incluem informações sobre sua conta e seu dispositivo.",
    learnMore: "Saiba mais",
    describeExperience: "Descreva sua experiência (obrigatório)",
    sampleReview: "Adorei o aplicativo!",
};

const es: PlayLabels = {
    playStore: "Play Store",
    tabForYou: "Para ti",
    tabTrending: "Top",
    tabWorkApps: "Apps de trabajo",
    tabKids: "Niños",
    manageAccount: "Gestionar tu Cuenta de Google",
    manageAppsDevices: "Gestionar aplicaciones y dispositivo",
    notificationsOffers: "Notificaciones y ofertas",
    paymentsSubscriptions: "Pagos y suscripciones",
    playProtect: "Play Protect",
    playPoints: "Play Points",
    library: "Biblioteca",
    updateAll: "Actualizar todo",
    seeDetails: "Ver detalles",
    storageUsed: "2,8 GB de 6,2 GB usados",
    syncApps: "Sincronizar aplicaciones con dispositivos",
    noDeviceSynced: "Ningún dispositivo sincronizado",
    ratingsReviews: "Valoraciones y reseñas",
    reviewsTitle: "Reseñas",
    tabNotRated: "Sin valorar",
    tabPosted: "Publicadas",
    sendFeedback: "Enviar comentarios",
    privateFeedback: "Comentarios privados para el desarrollador",
    fromYourLibrary: "De tu biblioteca",
    post: "Publicar",
    privacyNotice:
        "Las reseñas son públicas e incluyen información sobre tu cuenta y tu dispositivo.",
    learnMore: "Más información",
    describeExperience: "Describe tu experiencia (obligatorio)",
    sampleReview: "¡Me encanta esta app!",
};

/**
 * Locales já preenchidos. Os demais (dos 31 de ask-for-review.tsx) caem em `en` até serem
 * extraídos do APK da Play Store — ver instruções no topo deste arquivo.
 */
const LABELS: Record<string, PlayLabels> = {en, pt, es};

export function getPlayLabels(locale?: string): PlayLabels {
    if (!locale) return en;
    const lower = locale.toLowerCase();
    return LABELS[lower] || LABELS[lower.split("-")[0]] || en;
}

/** Locales cujos rótulos já foram preenchidos (os outros usam o fallback em inglês). */
export const SUPPORTED_LABEL_LOCALES = Object.keys(LABELS);
