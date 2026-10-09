// Sistema de internacionalização para expo-utils
import {NativeModules} from "react-native";
import type {RetentionPeriodUnit} from "./types";

/**
 * Forma por plural (regras do CLDR, escolhidas em `utils/retention-offers.ts`). `one` é "exatamente 1"
 * e pode não ter o número ("/mês", "no primeiro mês"), como o `two` do árabe (o dual); as outras levam
 * `{n}`. `two`/`few`/`many` só nas línguas que têm (russo, árabe); o que faltar cai no `other`.
 */
export interface RetentionPluralForms {
    one: string;
    two?: string;
    few?: string;
    many?: string;
    other: string;
}

/** Título e texto dos segmentos além do `trial_cancelled` (que usa os campos da fase 1). */
export interface RetentionSegmentTranslations {
    /** Assinatura paga com a renovação desligada. `date` leva `{date}` (fim do período pago). */
    cancelled: {lostHeader: string; lostBody: string; keptHeader: string; keptBody: string; date: string};
    /** Falha de pagamento; `confirm`/`checking`/`notYet` são do estado depois do "Atualizar pagamento". */
    billing_issue: {header: string; body: string; confirm: string; checking: string; notYet: string};
    expired: {header: string; body: string};
    trial_expired: {header: string; body: string};
    /** `lifetimeHeader` quando a 1ª oferta é o vitalício. */
    free: {header: string; lifetimeHeader: string; body: string};
}

/** Botão de cada tipo de oferta. O "Reativar" (`resubscribe` no trial/assinatura cancelados) é o `cta`. */
export interface RetentionCtaTranslations {
    updatePayment: string;
    subscribeAgain: string;
    subscribe: string;
    discount: string;
    winback: string;
    lifetime: string;
    code: string;
}

/** Cartões de oferta. `badge` leva `{discount}`; `terms` leva `{original_price}{per}` (regra das lojas). */
export interface RetentionCardTranslations {
    resubscribe: string;
    subscription: string;
    lifetime: string;
    code: string;
    codeHint: string;
    badge: string;
    terms: string;
}

/**
 * Modal de retenção (`utils/retention-modal.tsx`). Título e bullets cabem em 66 caracteres e o texto
 * em 144, com `{app}` trocado por um nome de 20 e preços reais — os limites da Retention Messaging da
 * Apple, para o mesmo texto servir nos dois (conferido em `tests/retention-texts.test.ts` e
 * `tests/retention-offers.test.ts`).
 *  - `lost*`: Premium já saiu (padrão da lib); `kept*`: `is_opted_out_trial_enabled: true`.
 *  - `trialEnds` leva `{date}`, formatada com `Intl.DateTimeFormat` na língua do texto.
 *  - `checking` aparece depois do "Reativar"; `notYet` quando o "Já reativei" não confirma.
 *  - `purchaseError`/`purchasePending`: linha acima do botão quando a compra falha ou fica pendente (o modal
 *    continua aberto). Remote Config: `purchase.error` / `purchase.pending`.
 */
export interface RetentionTranslations {
    lostHeader: string;
    lostBody: string;
    keptHeader: string;
    keptBody: string;
    bullets: string[];
    cta: string;
    dismiss: string;
    confirm: string;
    checking: string;
    notYet: string;
    purchaseError: string;
    purchasePending: string;
    trialEnds: string;
    segments: RetentionSegmentTranslations;
    ctas: RetentionCtaTranslations;
    cards: RetentionCardTranslations;
    /** Depois do vitalício comprado com falha de pagamento (a assinatura antiga continua cobrando). */
    notice: {header: string; body: string; cta: string};
    /** `per`: sufixo do preço ("/mês"); `first`: duração do desconto ("nos 3 primeiros meses"). */
    units: {per: Record<RetentionPeriodUnit, RetentionPluralForms>; first: Record<RetentionPeriodUnit, RetentionPluralForms>};
}

export interface Translations {
    updateRequired: string;
    updateMessage: string;
    updateNow: string;
    newMessage: string;
    retention: RetentionTranslations;
}

// Traduções disponíveis
export const translations: Record<string, Translations> = {
    // Português (Brasil)
    pt: {
        updateRequired: "Atualização Necessária",
        updateMessage: "Uma nova versão está disponível. Por favor, atualize para continuar usando o aplicativo.",
        updateNow: "Atualizar Agora",
        newMessage: "Nova Mensagem",
        retention: {
            lostHeader: "Seu teste grátis foi cancelado",
            lostBody: "Os anúncios voltaram. Reative a assinatura para continuar usando o {app} sem anúncios.",
            keptHeader: "Seu teste grátis foi cancelado",
            keptBody: "Você ainda tem o Premium até o fim do teste. Reative para não perder o acesso sem anúncios.",
            bullets: ["Sem anúncios", "Todos os recursos Premium", "Cancele quando quiser"],
            cta: "Reativar",
            dismiss: "Agora não",
            confirm: "Já reativei",
            checking: "Depois de reativar na loja, toque em “Já reativei”.",
            notYet: "Ainda não vimos a reativação. Pode levar alguns minutos.",
            purchaseError: "Não deu para concluir a compra. Tente de novo.",
            purchasePending: "Pagamento pendente. O Premium libera assim que a loja confirmar.",
            trialEnds: "Seu teste vai até {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Sua assinatura foi cancelada",
                    lostBody: "Os anúncios voltaram. Reative a assinatura para continuar usando o {app} sem anúncios.",
                    keptHeader: "Sua assinatura foi cancelada",
                    keptBody: "Você ainda tem o Premium até o fim do período pago. Reative para não perder o acesso sem anúncios.",
                    date: "Sua assinatura termina em {date}.",
                },
                billing_issue: {
                    header: "Seu pagamento não passou",
                    body: "Atualize a forma de pagamento para não perder o Premium.",
                    confirm: "Já atualizei",
                    checking: "Depois de atualizar o pagamento na loja, toque em “Já atualizei”.",
                    notYet: "Ainda não vimos o pagamento. Pode levar alguns minutos.",
                },
                expired: {header: "Sentimos sua falta", body: "Volte para o Premium e use o {app} sem anúncios de novo."},
                trial_expired: {header: "Seu teste grátis acabou", body: "Fique com o Premium para continuar usando o {app} sem anúncios."},
                free: {header: "Que tal o Premium?", lifetimeHeader: "Que tal o Premium para sempre?", body: "Use o {app} sem anúncios e com todos os recursos Premium."},
            },
            ctas: {
                updatePayment: "Atualizar pagamento",
                subscribeAgain: "Assinar de novo",
                subscribe: "Assinar",
                discount: "Quero o desconto",
                winback: "Voltar com desconto",
                lifetime: "Comprar vitalício",
                code: "Usar código",
            },
            cards: {
                resubscribe: "Seu plano",
                subscription: "Assinatura Premium",
                lifetime: "Pague uma vez, use para sempre",
                code: "Código promocional",
                codeHint: "válido na loja",
                badge: "−{discount}",
                terms: "depois {original_price}{per}",
            },
            notice: {
                header: "Seu Premium vitalício está ativo",
                body: "Cancele a assinatura antiga para não ser cobrado de novo.",
                cta: "Gerenciar assinaturas",
            },
            units: {
                per: {
                    day: {one: "/dia", other: "/{n} dias"},
                    week: {one: "/semana", other: "/{n} semanas"},
                    month: {one: "/mês", other: "/{n} meses"},
                    year: {one: "/ano", other: "/{n} anos"},
                },
                first: {
                    day: {one: "no primeiro dia", other: "nos {n} primeiros dias"},
                    week: {one: "na primeira semana", other: "nas {n} primeiras semanas"},
                    month: {one: "no primeiro mês", other: "nos {n} primeiros meses"},
                    year: {one: "no primeiro ano", other: "nos {n} primeiros anos"},
                },
            },
        },
    },

    // English (Default)
    en: {
        updateRequired: "Update Required",
        updateMessage: "A new version is available. Please update to continue using the app.",
        updateNow: "Update Now",
        newMessage: "New Message",
        retention: {
            lostHeader: "Your free trial was canceled",
            lostBody: "Ads are back. Reactivate your subscription to keep using {app} without ads.",
            keptHeader: "Your free trial was canceled",
            keptBody: "You still have Premium until your trial ends. Reactivate to keep your ad-free access.",
            bullets: ["No ads", "All Premium features", "Cancel anytime"],
            cta: "Reactivate",
            dismiss: "Not now",
            confirm: "I've reactivated",
            checking: "After reactivating in the store, tap “I've reactivated”.",
            notYet: "We can't see the reactivation yet. It may take a few minutes.",
            purchaseError: "We couldn't complete the purchase. Please try again.",
            purchasePending: "Payment pending. Premium unlocks as soon as the store confirms it.",
            trialEnds: "Your trial lasts until {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Your subscription was canceled",
                    lostBody: "Ads are back. Reactivate your subscription to keep using {app} without ads.",
                    keptHeader: "Your subscription was canceled",
                    keptBody: "You still have Premium until the end of your billing period. Reactivate to keep your ad-free access.",
                    date: "Your subscription ends on {date}.",
                },
                billing_issue: {
                    header: "Your payment didn't go through",
                    body: "Update your payment method so you don't lose Premium.",
                    confirm: "I've updated it",
                    checking: "After updating your payment in the store, tap “I've updated it”.",
                    notYet: "We can't see the payment yet. It may take a few minutes.",
                },
                expired: {header: "We miss you", body: "Come back to Premium and use {app} without ads again."},
                trial_expired: {header: "Your free trial has ended", body: "Get Premium to keep using {app} without ads."},
                free: {header: "How about Premium?", lifetimeHeader: "How about Premium forever?", body: "Use {app} without ads and with all Premium features."},
            },
            ctas: {
                updatePayment: "Update payment",
                subscribeAgain: "Subscribe again",
                subscribe: "Subscribe",
                discount: "Get the discount",
                winback: "Come back with a discount",
                lifetime: "Buy lifetime",
                code: "Use code",
            },
            cards: {
                resubscribe: "Your plan",
                subscription: "Premium subscription",
                lifetime: "Pay once, use forever",
                code: "Promo code",
                codeHint: "valid in the store",
                badge: "−{discount}",
                terms: "then {original_price}{per}",
            },
            notice: {
                header: "Your lifetime Premium is active",
                body: "Cancel your old subscription so you aren't charged again.",
                cta: "Manage subscriptions",
            },
            units: {
                per: {
                    day: {one: "/day", other: "/{n} days"},
                    week: {one: "/week", other: "/{n} weeks"},
                    month: {one: "/month", other: "/{n} months"},
                    year: {one: "/year", other: "/{n} years"},
                },
                first: {
                    day: {one: "for the first day", other: "for the first {n} days"},
                    week: {one: "for the first week", other: "for the first {n} weeks"},
                    month: {one: "for the first month", other: "for the first {n} months"},
                    year: {one: "for the first year", other: "for the first {n} years"},
                },
            },
        },
    },

    // Español
    es: {
        updateRequired: "Actualización Requerida",
        updateMessage: "Una nueva versión está disponible. Por favor, actualiza para continuar usando la aplicación.",
        updateNow: "Actualizar Ahora",
        newMessage: "Nuevo Mensaje",
        retention: {
            lostHeader: "Tu prueba gratuita se canceló",
            lostBody: "Los anuncios volvieron. Reactiva la suscripción para seguir usando {app} sin anuncios.",
            keptHeader: "Tu prueba gratuita se canceló",
            keptBody: "Sigues teniendo Premium hasta que termine la prueba. Reactiva la suscripción para no perder el acceso sin anuncios.",
            bullets: ["Sin anuncios", "Todas las funciones Premium", "Cancela cuando quieras"],
            cta: "Reactivar",
            dismiss: "Ahora no",
            confirm: "Ya la reactivé",
            checking: "Cuando la reactives en la tienda, toca “Ya la reactivé”.",
            notYet: "Aún no vemos la reactivación. Puede tardar unos minutos.",
            purchaseError: "No se pudo completar la compra. Inténtalo de nuevo.",
            purchasePending: "Pago pendiente. Premium se activará en cuanto la tienda lo confirme.",
            trialEnds: "Tu prueba dura hasta el {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Tu suscripción se canceló",
                    lostBody: "Los anuncios volvieron. Reactiva la suscripción para seguir usando {app} sin anuncios.",
                    keptHeader: "Tu suscripción se canceló",
                    keptBody: "Sigues teniendo Premium hasta el final del período pagado. Reactiva la suscripción para no perder el acceso sin anuncios.",
                    date: "Tu suscripción termina el {date}.",
                },
                billing_issue: {
                    header: "No pudimos procesar tu pago",
                    body: "Actualiza tu método de pago para no perder Premium.",
                    confirm: "Ya lo actualicé",
                    checking: "Cuando actualices el pago en la tienda, toca “Ya lo actualicé”.",
                    notYet: "Aún no vemos el pago. Puede tardar unos minutos.",
                },
                expired: {header: "Te extrañamos", body: "Vuelve a Premium y usa {app} sin anuncios otra vez."},
                trial_expired: {header: "Tu prueba gratuita terminó", body: "Hazte Premium para seguir usando {app} sin anuncios."},
                free: {header: "¿Qué tal Premium?", lifetimeHeader: "¿Qué tal Premium para siempre?", body: "Usa {app} sin anuncios y con todas las funciones Premium."},
            },
            ctas: {
                updatePayment: "Actualizar pago",
                subscribeAgain: "Volver a suscribirme",
                subscribe: "Suscribirme",
                discount: "Quiero el descuento",
                winback: "Volver con descuento",
                lifetime: "Comprar de por vida",
                code: "Usar código",
            },
            cards: {
                resubscribe: "Tu plan",
                subscription: "Suscripción Premium",
                lifetime: "Paga una vez y úsalo para siempre",
                code: "Código promocional",
                codeHint: "válido en la tienda",
                badge: "−{discount}",
                terms: "después {original_price}{per}",
            },
            notice: {
                header: "Tu Premium de por vida está activo",
                body: "Cancela la suscripción anterior para que no te vuelvan a cobrar.",
                cta: "Gestionar suscripciones",
            },
            units: {
                per: {
                    day: {one: "/día", other: "/{n} días"},
                    week: {one: "/semana", other: "/{n} semanas"},
                    month: {one: "/mes", other: "/{n} meses"},
                    year: {one: "/año", other: "/{n} años"},
                },
                first: {
                    day: {one: "el primer día", other: "los primeros {n} días"},
                    week: {one: "la primera semana", other: "las primeras {n} semanas"},
                    month: {one: "el primer mes", other: "los primeros {n} meses"},
                    year: {one: "el primer año", other: "los primeros {n} años"},
                },
            },
        },
    },

    // Français
    fr: {
        updateRequired: "Mise à jour requise",
        updateMessage:
            "Une nouvelle version est disponible. Veuillez mettre à jour pour continuer à utiliser l'application.",
        updateNow: "Mettre à jour maintenant",
        newMessage: "Nouveau Message",
        retention: {
            lostHeader: "Votre essai gratuit a été annulé",
            lostBody: "Les publicités sont de retour. Réactivez l'abonnement pour continuer à utiliser {app} sans publicité.",
            keptHeader: "Votre essai gratuit a été annulé",
            keptBody: "Vous gardez Premium jusqu'à la fin de l'essai. Réactivez l'abonnement pour ne pas perdre l'accès sans publicité.",
            bullets: ["Sans publicité", "Toutes les fonctions Premium", "Résiliable à tout moment"],
            cta: "Réactiver",
            dismiss: "Plus tard",
            confirm: "J'ai réactivé",
            checking: "Après la réactivation dans le store, touchez «\u00A0J'ai réactivé\u00A0».",
            notYet: "Nous ne voyons pas encore la réactivation. Cela peut prendre quelques minutes.",
            purchaseError: "Impossible de finaliser l'achat. Veuillez réessayer.",
            purchasePending: "Paiement en attente. Premium sera activé dès que le store l'aura confirmé.",
            trialEnds: "Votre essai dure jusqu'au {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Votre abonnement a été annulé",
                    lostBody: "Les publicités sont de retour. Réactivez l'abonnement pour continuer à utiliser {app} sans publicité.",
                    keptHeader: "Votre abonnement a été annulé",
                    keptBody: "Vous gardez Premium jusqu'à la fin de la période payée. Réactivez l'abonnement pour ne pas perdre l'accès sans publicité.",
                    date: "Votre abonnement prend fin le {date}.",
                },
                billing_issue: {
                    header: "Votre paiement n'a pas abouti",
                    body: "Mettez à jour votre moyen de paiement pour ne pas perdre Premium.",
                    confirm: "C'est fait",
                    checking: "Après la mise à jour du paiement dans le store, touchez «\u00A0C'est fait\u00A0».",
                    notYet: "Nous ne voyons pas encore le paiement. Cela peut prendre quelques minutes.",
                },
                expired: {header: "Vous nous manquez", body: "Revenez à Premium et utilisez à nouveau {app} sans publicité."},
                trial_expired: {header: "Votre essai gratuit est terminé", body: "Passez à Premium pour continuer à utiliser {app} sans publicité."},
                free: {header: "Envie de Premium\u00A0?", lifetimeHeader: "Envie de Premium pour toujours\u00A0?", body: "Utilisez {app} sans publicité, avec toutes les fonctions Premium."},
            },
            ctas: {
                updatePayment: "Mettre à jour le paiement",
                subscribeAgain: "Se réabonner",
                subscribe: "S'abonner",
                discount: "Profiter de la remise",
                winback: "Revenir avec une remise",
                lifetime: "Acheter à vie",
                code: "Utiliser le code",
            },
            cards: {
                resubscribe: "Votre formule",
                subscription: "Abonnement Premium",
                lifetime: "Payez une fois, profitez-en pour toujours",
                code: "Code promo",
                codeHint: "valable dans le store",
                badge: "−{discount}",
                terms: "puis {original_price}{per}",
            },
            notice: {
                header: "Votre Premium à vie est actif",
                body: "Annulez l'ancien abonnement pour ne pas être débité à nouveau.",
                cta: "Gérer les abonnements",
            },
            units: {
                per: {
                    day: {one: "/jour", other: "/{n} jours"},
                    week: {one: "/semaine", other: "/{n} semaines"},
                    month: {one: "/mois", other: "/{n} mois"},
                    year: {one: "/an", other: "/{n} ans"},
                },
                first: {
                    day: {one: "le premier jour", other: "les {n} premiers jours"},
                    week: {one: "la première semaine", other: "les {n} premières semaines"},
                    month: {one: "le premier mois", other: "les {n} premiers mois"},
                    year: {one: "la première année", other: "les {n} premières années"},
                },
            },
        },
    },

    // Deutsch
    de: {
        updateRequired: "Update erforderlich",
        updateMessage: "Eine neue Version ist verfügbar. Bitte aktualisieren Sie, um die App weiter zu nutzen.",
        updateNow: "Jetzt aktualisieren",
        newMessage: "Neue Nachricht",
        retention: {
            lostHeader: "Deine kostenlose Testphase wurde gekündigt",
            lostBody: "Die Werbung ist zurück. Aktiviere dein Abo wieder, um {app} weiter ohne Werbung zu nutzen.",
            keptHeader: "Deine kostenlose Testphase wurde gekündigt",
            keptBody: "Du hast Premium noch bis zum Ende der Testphase. Aktiviere dein Abo wieder, damit du werbefrei bleibst.",
            bullets: ["Keine Werbung", "Alle Premium-Funktionen", "Jederzeit kündbar"],
            cta: "Wieder aktivieren",
            dismiss: "Nicht jetzt",
            confirm: "Schon erledigt",
            checking: "Tippe nach dem Reaktivieren im Store auf „Schon erledigt“.",
            notYet: "Wir sehen die Reaktivierung noch nicht. Das kann ein paar Minuten dauern.",
            purchaseError: "Der Kauf konnte nicht abgeschlossen werden. Versuch es noch einmal.",
            purchasePending: "Zahlung ausstehend. Premium wird freigeschaltet, sobald der Store sie bestätigt.",
            trialEnds: "Deine Testphase läuft bis zum {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Dein Abo wurde gekündigt",
                    lostBody: "Die Werbung ist zurück. Aktiviere dein Abo wieder, um {app} weiter ohne Werbung zu nutzen.",
                    keptHeader: "Dein Abo wurde gekündigt",
                    keptBody: "Du hast Premium noch bis zum Ende des bezahlten Zeitraums. Aktiviere dein Abo wieder, damit du werbefrei bleibst.",
                    date: "Dein Abo endet am {date}.",
                },
                billing_issue: {
                    header: "Deine Zahlung ist fehlgeschlagen",
                    body: "Aktualisiere deine Zahlungsmethode, damit du Premium nicht verlierst.",
                    confirm: "Schon aktualisiert",
                    checking: "Tippe nach dem Aktualisieren der Zahlung im Store auf „Schon aktualisiert“.",
                    notYet: "Wir sehen die Zahlung noch nicht. Das kann ein paar Minuten dauern.",
                },
                expired: {header: "Wir vermissen dich", body: "Hol dir Premium zurück und nutze {app} wieder ohne Werbung."},
                trial_expired: {header: "Deine kostenlose Testphase ist vorbei", body: "Hol dir Premium, um {app} weiter ohne Werbung zu nutzen."},
                free: {header: "Wie wäre es mit Premium?", lifetimeHeader: "Wie wäre es mit Premium für immer?", body: "Nutze {app} ohne Werbung und mit allen Premium-Funktionen."},
            },
            ctas: {
                updatePayment: "Zahlung aktualisieren",
                subscribeAgain: "Erneut abonnieren",
                subscribe: "Abonnieren",
                discount: "Rabatt sichern",
                winback: "Mit Rabatt zurückkehren",
                lifetime: "Einmalig kaufen",
                code: "Code einlösen",
            },
            cards: {
                resubscribe: "Dein Tarif",
                subscription: "Premium-Abo",
                lifetime: "Einmal zahlen, für immer nutzen",
                code: "Aktionscode",
                codeHint: "gültig im Store",
                badge: "−{discount}",
                terms: "danach {original_price}{per}",
            },
            notice: {
                header: "Dein lebenslanges Premium ist aktiv",
                body: "Kündige dein altes Abo, damit dir nichts mehr abgebucht wird.",
                cta: "Abos verwalten",
            },
            units: {
                per: {
                    day: {one: "/Tag", other: "/{n} Tage"},
                    week: {one: "/Woche", other: "/{n} Wochen"},
                    month: {one: "/Monat", other: "/{n} Monate"},
                    year: {one: "/Jahr", other: "/{n} Jahre"},
                },
                first: {
                    day: {one: "am ersten Tag", other: "in den ersten {n} Tagen"},
                    week: {one: "in der ersten Woche", other: "in den ersten {n} Wochen"},
                    month: {one: "im ersten Monat", other: "in den ersten {n} Monaten"},
                    year: {one: "im ersten Jahr", other: "in den ersten {n} Jahren"},
                },
            },
        },
    },

    // Italiano
    it: {
        updateRequired: "Aggiornamento richiesto",
        updateMessage: "È disponibile una nuova versione. Aggiorna per continuare a utilizzare l'app.",
        updateNow: "Aggiorna ora",
        newMessage: "Nuovo Messaggio",
        retention: {
            lostHeader: "La tua prova gratuita è stata annullata",
            lostBody: "La pubblicità è tornata. Riattiva l'abbonamento per continuare a usare {app} senza pubblicità.",
            keptHeader: "La tua prova gratuita è stata annullata",
            keptBody: "Hai ancora Premium fino alla fine della prova. Riattiva l'abbonamento per non perdere l'accesso senza pubblicità.",
            bullets: ["Niente pubblicità", "Tutte le funzioni Premium", "Disdici quando vuoi"],
            cta: "Riattiva",
            dismiss: "Non ora",
            confirm: "L'ho riattivato",
            checking: "Dopo averlo riattivato nello store, tocca “L'ho riattivato”.",
            notYet: "Non vediamo ancora la riattivazione. Potrebbe volerci qualche minuto.",
            purchaseError: "Non è stato possibile completare l'acquisto. Riprova.",
            purchasePending: "Pagamento in sospeso. Premium si attiverà appena lo store lo confermerà.",
            trialEnds: "La tua prova dura fino al {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Il tuo abbonamento è stato annullato",
                    lostBody: "La pubblicità è tornata. Riattiva l'abbonamento per continuare a usare {app} senza pubblicità.",
                    keptHeader: "Il tuo abbonamento è stato annullato",
                    keptBody: "Hai ancora Premium fino alla fine del periodo pagato. Riattiva l'abbonamento per non perdere l'accesso senza pubblicità.",
                    date: "Il tuo abbonamento termina il {date}.",
                },
                billing_issue: {
                    header: "Il pagamento non è andato a buon fine",
                    body: "Aggiorna il metodo di pagamento per non perdere Premium.",
                    confirm: "L'ho aggiornato",
                    checking: "Dopo aver aggiornato il pagamento nello store, tocca “L'ho aggiornato”.",
                    notYet: "Non vediamo ancora il pagamento. Potrebbe volerci qualche minuto.",
                },
                expired: {header: "Ci manchi", body: "Torna a Premium e usa di nuovo {app} senza pubblicità."},
                trial_expired: {header: "La tua prova gratuita è terminata", body: "Passa a Premium per continuare a usare {app} senza pubblicità."},
                free: {header: "Che ne dici di Premium?", lifetimeHeader: "Che ne dici di Premium per sempre?", body: "Usa {app} senza pubblicità e con tutte le funzioni Premium."},
            },
            ctas: {
                updatePayment: "Aggiorna il pagamento",
                subscribeAgain: "Abbonati di nuovo",
                subscribe: "Abbonati",
                discount: "Voglio lo sconto",
                winback: "Torna con lo sconto",
                lifetime: "Acquista a vita",
                code: "Usa il codice",
            },
            cards: {
                resubscribe: "Il tuo piano",
                subscription: "Abbonamento Premium",
                lifetime: "Paghi una volta, usi per sempre",
                code: "Codice promozionale",
                codeHint: "valido nello store",
                badge: "−{discount}",
                terms: "poi {original_price}{per}",
            },
            notice: {
                header: "Il tuo Premium a vita è attivo",
                body: "Annulla il vecchio abbonamento per non ricevere altri addebiti.",
                cta: "Gestisci abbonamenti",
            },
            units: {
                per: {
                    day: {one: "/giorno", other: "/{n} giorni"},
                    week: {one: "/settimana", other: "/{n} settimane"},
                    month: {one: "/mese", other: "/{n} mesi"},
                    year: {one: "/anno", other: "/{n} anni"},
                },
                first: {
                    day: {one: "per il primo giorno", other: "per i primi {n} giorni"},
                    week: {one: "per la prima settimana", other: "per le prime {n} settimane"},
                    month: {one: "per il primo mese", other: "per i primi {n} mesi"},
                    year: {one: "per il primo anno", other: "per i primi {n} anni"},
                },
            },
        },
    },

    // 日本語 (Japanese)
    ja: {
        updateRequired: "アップデートが必要です",
        updateMessage: "新しいバージョンが利用可能です。アプリを継続してご利用いただくためにアップデートしてください。",
        updateNow: "今すぐアップデート",
        newMessage: "新しいメッセージ",
        retention: {
            lostHeader: "無料トライアルがキャンセルされました",
            lostBody: "広告が再び表示されるようになりました。サブスクリプションを再開すると、{app}を広告なしで引き続きご利用いただけます。",
            keptHeader: "無料トライアルがキャンセルされました",
            keptBody: "トライアル終了まではプレミアムをご利用いただけます。サブスクリプションを再開すると、広告なしのまま使い続けられます。",
            bullets: ["広告なし", "すべてのプレミアム機能", "いつでも解約可能"],
            cta: "再開する",
            dismiss: "今はしない",
            confirm: "再開しました",
            checking: "ストアで再開したら「再開しました」をタップしてください。",
            notYet: "まだ再開を確認できません。反映まで数分かかる場合があります。",
            purchaseError: "購入を完了できませんでした。もう一度お試しください。",
            purchasePending: "お支払いが保留中です。ストアで確認され次第、プレミアムが有効になります。",
            trialEnds: "トライアルは{date}までです。",
            segments: {
                cancelled: {
                    lostHeader: "サブスクリプションがキャンセルされました",
                    lostBody: "広告が再び表示されるようになりました。サブスクリプションを再開すると、{app}を広告なしで引き続きご利用いただけます。",
                    keptHeader: "サブスクリプションがキャンセルされました",
                    keptBody: "お支払い済みの期間が終わるまではプレミアムをご利用いただけます。再開すると、広告なしのまま使い続けられます。",
                    date: "サブスクリプションは{date}に終了します。",
                },
                billing_issue: {
                    header: "お支払いを完了できませんでした",
                    body: "プレミアムを引き続きご利用いただくには、お支払い方法を更新してください。",
                    confirm: "更新しました",
                    checking: "ストアでお支払い方法を更新したら「更新しました」をタップしてください。",
                    notYet: "まだお支払いを確認できません。反映まで数分かかる場合があります。",
                },
                expired: {header: "またお待ちしています", body: "プレミアムに戻って、{app}を再び広告なしでお楽しみください。"},
                trial_expired: {header: "無料トライアルが終了しました", body: "プレミアムに登録して、{app}を広告なしで使い続けましょう。"},
                free: {header: "プレミアムはいかがですか？", lifetimeHeader: "ずっと使えるプレミアムはいかがですか？", body: "{app}を広告なしで、すべてのプレミアム機能とともにお使いいただけます。"},
            },
            ctas: {
                updatePayment: "お支払い方法を更新",
                subscribeAgain: "もう一度登録する",
                subscribe: "登録する",
                discount: "割引を受ける",
                winback: "割引価格で再開する",
                lifetime: "買い切りで購入",
                code: "コードを使う",
            },
            cards: {
                resubscribe: "ご利用のプラン",
                subscription: "プレミアムプラン",
                lifetime: "一度のお支払いでずっと使えます",
                code: "プロモーションコード",
                codeHint: "ストアで利用できます",
                badge: "{discount}オフ",
                terms: "以降は{original_price}{per}",
            },
            notice: {
                header: "買い切りのプレミアムが有効になりました",
                body: "再度請求されないよう、以前のサブスクリプションを解約してください。",
                cta: "サブスクリプションを管理",
            },
            units: {
                per: {
                    day: {one: "/日", other: "/{n}日"},
                    week: {one: "/週", other: "/{n}週"},
                    month: {one: "/月", other: "/{n}か月"},
                    year: {one: "/年", other: "/{n}年"},
                },
                first: {
                    day: {one: "最初の1日間", other: "最初の{n}日間"},
                    week: {one: "最初の1週間", other: "最初の{n}週間"},
                    month: {one: "最初の1か月間", other: "最初の{n}か月間"},
                    year: {one: "最初の1年間", other: "最初の{n}年間"},
                },
            },
        },
    },

    // 한국어 (Korean)
    ko: {
        updateRequired: "업데이트 필요",
        updateMessage: "새 버전이 사용 가능합니다. 앱을 계속 사용하려면 업데이트하세요.",
        updateNow: "지금 업데이트",
        newMessage: "새 메시지",
        retention: {
            lostHeader: "무료 체험이 취소되었습니다",
            lostBody: "광고가 다시 표시됩니다. 광고 없이 계속 이용하려면 구독을 다시 활성화하세요.",
            keptHeader: "무료 체험이 취소되었습니다",
            keptBody: "체험이 끝날 때까지 프리미엄을 계속 이용할 수 있습니다. 광고 없는 이용을 유지하려면 구독을 다시 활성화하세요.",
            bullets: ["광고 없음", "모든 프리미엄 기능", "언제든지 해지 가능"],
            cta: "다시 활성화",
            dismiss: "나중에",
            confirm: "다시 활성화했어요",
            checking: "스토어에서 다시 활성화한 후 ‘다시 활성화했어요’를 눌러 주세요.",
            notYet: "아직 다시 활성화가 확인되지 않았습니다. 몇 분 정도 걸릴 수 있습니다.",
            purchaseError: "구매를 완료하지 못했습니다. 다시 시도해 주세요.",
            purchasePending: "결제 대기 중입니다. 스토어에서 확인되면 바로 프리미엄이 활성화됩니다.",
            trialEnds: "체험 기간은 {date}까지입니다.",
            // {app} fica de fora de propósito: a partícula (을/를) depende da última letra do nome.
            segments: {
                cancelled: {
                    lostHeader: "구독이 취소되었습니다",
                    lostBody: "광고가 다시 표시됩니다. 광고 없이 계속 이용하려면 구독을 다시 활성화하세요.",
                    keptHeader: "구독이 취소되었습니다",
                    keptBody: "결제한 기간이 끝날 때까지 프리미엄을 계속 이용할 수 있습니다. 광고 없는 이용을 유지하려면 구독을 다시 활성화하세요.",
                    date: "구독은 {date}에 종료됩니다.",
                },
                billing_issue: {
                    header: "결제가 완료되지 않았습니다",
                    body: "프리미엄을 잃지 않도록 결제 수단을 업데이트하세요.",
                    confirm: "업데이트했어요",
                    checking: "스토어에서 결제 수단을 업데이트한 후 ‘업데이트했어요’를 눌러 주세요.",
                    notYet: "아직 결제가 확인되지 않았습니다. 몇 분 정도 걸릴 수 있습니다.",
                },
                expired: {header: "보고 싶었어요", body: "프리미엄으로 돌아와 다시 광고 없이 이용하세요."},
                trial_expired: {header: "무료 체험이 종료되었습니다", body: "프리미엄을 구독하고 계속 광고 없이 이용하세요."},
                free: {header: "프리미엄은 어떠세요?", lifetimeHeader: "평생 이용하는 프리미엄은 어떠세요?", body: "광고 없이 모든 프리미엄 기능을 이용하세요."},
            },
            ctas: {
                updatePayment: "결제 수단 업데이트",
                subscribeAgain: "다시 구독하기",
                subscribe: "구독하기",
                discount: "할인 받기",
                winback: "할인가로 돌아가기",
                lifetime: "평생 이용권 구매",
                code: "코드 사용하기",
            },
            cards: {
                resubscribe: "이용하던 플랜",
                subscription: "프리미엄 구독",
                lifetime: "한 번 결제로 평생 이용",
                code: "프로모션 코드",
                codeHint: "스토어에서 사용 가능",
                badge: "{discount} 할인",
                terms: "이후 {original_price}{per}",
            },
            notice: {
                header: "평생 프리미엄이 활성화되었습니다",
                body: "다시 청구되지 않도록 기존 구독을 해지하세요.",
                cta: "구독 관리",
            },
            units: {
                per: {
                    day: {one: "/일", other: "/{n}일"},
                    week: {one: "/주", other: "/{n}주"},
                    month: {one: "/월", other: "/{n}개월"},
                    year: {one: "/년", other: "/{n}년"},
                },
                first: {
                    day: {one: "첫 1일 동안", other: "첫 {n}일 동안"},
                    week: {one: "첫 1주 동안", other: "첫 {n}주 동안"},
                    month: {one: "첫 1개월 동안", other: "첫 {n}개월 동안"},
                    year: {one: "첫 1년 동안", other: "첫 {n}년 동안"},
                },
            },
        },
    },

    // 中文 (Chinese Simplified)
    zh: {
        updateRequired: "需要更新",
        updateMessage: "有新版本可用。请更新以继续使用应用程序。",
        updateNow: "立即更新",
        newMessage: "新消息",
        retention: {
            lostHeader: "你的免费试用已取消",
            lostBody: "广告已恢复显示。重新开启订阅，即可继续无广告使用 {app}。",
            keptHeader: "你的免费试用已取消",
            keptBody: "试用结束前，你仍可使用高级版。重新开启订阅，即可继续享受无广告体验。",
            bullets: ["无广告", "全部高级功能", "随时可取消"],
            cta: "重新开启",
            dismiss: "以后再说",
            confirm: "我已重新开启",
            checking: "在商店重新开启后，请点按“我已重新开启”。",
            notYet: "暂未检测到重新开启，可能需要几分钟。",
            purchaseError: "无法完成购买，请重试。",
            purchasePending: "付款待处理。商店确认后将立即开通高级版。",
            trialEnds: "你的试用将于{date}结束。",
            segments: {
                cancelled: {
                    lostHeader: "你的订阅已取消",
                    lostBody: "广告已恢复显示。重新开启订阅，即可继续无广告使用 {app}。",
                    keptHeader: "你的订阅已取消",
                    keptBody: "在已付费的周期结束前，你仍可使用高级版。重新开启订阅，即可继续享受无广告体验。",
                    date: "你的订阅将于{date}结束。",
                },
                billing_issue: {
                    header: "你的付款未成功",
                    body: "请更新付款方式，以免失去高级版。",
                    confirm: "我已更新",
                    checking: "在商店更新付款方式后，请点按“我已更新”。",
                    notYet: "暂未检测到付款，可能需要几分钟。",
                },
                expired: {header: "我们想你了", body: "回到高级版，再次无广告使用 {app}。"},
                trial_expired: {header: "你的免费试用已结束", body: "开通高级版，继续无广告使用 {app}。"},
                free: {header: "试试高级版？", lifetimeHeader: "试试永久高级版？", body: "无广告使用 {app}，畅享全部高级功能。"},
            },
            ctas: {
                updatePayment: "更新付款方式",
                subscribeAgain: "重新订阅",
                subscribe: "订阅",
                discount: "领取优惠",
                winback: "优惠回归",
                lifetime: "购买永久版",
                code: "使用兑换码",
            },
            cards: {
                resubscribe: "你的方案",
                subscription: "高级版订阅",
                lifetime: "一次付费，永久使用",
                code: "优惠码",
                codeHint: "可在商店兑换",
                badge: "省{discount}",
                terms: "之后{original_price}{per}",
            },
            notice: {
                header: "你的永久高级版已开通",
                body: "请取消旧订阅，以免再次扣费。",
                cta: "管理订阅",
            },
            units: {
                per: {
                    day: {one: "/天", other: "/{n}天"},
                    week: {one: "/周", other: "/{n}周"},
                    month: {one: "/月", other: "/{n}个月"},
                    year: {one: "/年", other: "/{n}年"},
                },
                first: {
                    day: {one: "首日", other: "前{n}天"},
                    week: {one: "首周", other: "前{n}周"},
                    month: {one: "首月", other: "前{n}个月"},
                    year: {one: "首年", other: "前{n}年"},
                },
            },
        },
    },

    // Русский (Russian)
    ru: {
        updateRequired: "Требуется обновление",
        updateMessage: "Доступна новая версия. Пожалуйста, обновите приложение для продолжения использования.",
        updateNow: "Обновить сейчас",
        newMessage: "Новое сообщение",
        retention: {
            lostHeader: "Ваш бесплатный пробный период отменён",
            lostBody: "Реклама вернулась. Возобновите подписку, чтобы пользоваться приложением {app} без рекламы.",
            keptHeader: "Ваш бесплатный пробный период отменён",
            keptBody: "Premium останется у вас до конца пробного периода. Возобновите подписку, чтобы не потерять доступ без рекламы.",
            bullets: ["Без рекламы", "Все функции Premium", "Отмена в любой момент"],
            cta: "Возобновить",
            dismiss: "Не сейчас",
            confirm: "Подписка возобновлена",
            checking: "После возобновления в магазине нажмите «Подписка возобновлена».",
            notYet: "Мы пока не видим возобновления. Это может занять несколько минут.",
            purchaseError: "Не удалось завершить покупку. Попробуйте ещё раз.",
            purchasePending: "Оплата в обработке. Premium откроется, как только магазин её подтвердит.",
            trialEnds: "Пробный период действует до {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Ваша подписка отменена",
                    lostBody: "Реклама вернулась. Возобновите подписку, чтобы пользоваться приложением {app} без рекламы.",
                    keptHeader: "Ваша подписка отменена",
                    keptBody: "Premium останется у вас до конца оплаченного периода. Возобновите подписку, чтобы не потерять доступ без рекламы.",
                    date: "Подписка действует до {date}.",
                },
                billing_issue: {
                    header: "Не удалось провести оплату",
                    body: "Обновите способ оплаты, чтобы не потерять Premium.",
                    confirm: "Способ оплаты обновлён",
                    checking: "После обновления способа оплаты в магазине нажмите «Способ оплаты обновлён».",
                    notYet: "Мы пока не видим оплату. Это может занять несколько минут.",
                },
                expired: {header: "Мы скучаем по вам", body: "Вернитесь к Premium и снова пользуйтесь приложением {app} без рекламы."},
                trial_expired: {header: "Бесплатный пробный период закончился", body: "Оформите Premium, чтобы и дальше пользоваться приложением {app} без рекламы."},
                free: {header: "Как насчёт Premium?", lifetimeHeader: "Как насчёт Premium навсегда?", body: "Пользуйтесь приложением {app} без рекламы и со всеми функциями Premium."},
            },
            ctas: {
                updatePayment: "Обновить способ оплаты",
                subscribeAgain: "Подписаться снова",
                subscribe: "Подписаться",
                discount: "Получить скидку",
                winback: "Вернуться со скидкой",
                lifetime: "Купить навсегда",
                code: "Использовать код",
            },
            cards: {
                resubscribe: "Ваш тариф",
                subscription: "Подписка Premium",
                lifetime: "Платите один раз — пользуйтесь всегда",
                code: "Промокод",
                codeHint: "действует в магазине",
                badge: "−{discount}",
                terms: "далее {original_price}{per}",
            },
            notice: {
                header: "Premium навсегда активирован",
                body: "Отмените старую подписку, чтобы с вас не списали деньги снова.",
                cta: "Управление подписками",
            },
            units: {
                per: {
                    day: {one: "/день", few: "/{n} дня", many: "/{n} дней", other: "/{n} дня"},
                    week: {one: "/нед.", other: "/{n} нед."},
                    month: {one: "/мес.", other: "/{n} мес."},
                    year: {one: "/год", few: "/{n} года", many: "/{n} лет", other: "/{n} года"},
                },
                first: {
                    day: {one: "в первый день", few: "в первые {n} дня", many: "в первые {n} дней", other: "в первые {n} дня"},
                    week: {one: "в первую неделю", few: "в первые {n} недели", many: "в первые {n} недель", other: "в первые {n} недели"},
                    month: {one: "в первый месяц", few: "в первые {n} месяца", many: "в первые {n} месяцев", other: "в первые {n} месяца"},
                    year: {one: "в первый год", few: "в первые {n} года", many: "в первые {n} лет", other: "в первые {n} года"},
                },
            },
        },
    },

    // العربية (Arabic)
    ar: {
        updateRequired: "مطلوب تحديث",
        updateMessage: "يتوفر إصدار جديد. يرجى التحديث للمتابعة في استخدام التطبيق.",
        updateNow: "تحديث الآن",
        newMessage: "رسالة جديدة",
        retention: {
            lostHeader: "تم إلغاء الفترة التجريبية المجانية",
            lostBody: "عادت الإعلانات. أعِد تفعيل الاشتراك لمواصلة استخدام {app} بدون إعلانات.",
            keptHeader: "تم إلغاء الفترة التجريبية المجانية",
            keptBody: "ما زالت المزايا المميزة متاحة لك حتى نهاية الفترة التجريبية. أعِد تفعيل الاشتراك لتواصل الاستخدام بدون إعلانات.",
            bullets: ["بدون إعلانات", "جميع المزايا المميزة", "إلغاء في أي وقت"],
            cta: "إعادة التفعيل",
            dismiss: "ليس الآن",
            confirm: "أعدتُ التفعيل",
            checking: "بعد إعادة التفعيل في المتجر، اضغط على «أعدتُ التفعيل».",
            notYet: "لم نرصد إعادة التفعيل بعد. قد يستغرق ذلك بضع دقائق.",
            purchaseError: "تعذّر إتمام الشراء. حاول مرة أخرى.",
            purchasePending: "الدفع قيد الانتظار. ستُفعَّل المزايا المميزة فور تأكيد المتجر.",
            trialEnds: "تستمر الفترة التجريبية حتى {date}.",
            segments: {
                cancelled: {
                    lostHeader: "تم إلغاء اشتراكك",
                    lostBody: "عادت الإعلانات. أعِد تفعيل الاشتراك لمواصلة استخدام {app} بدون إعلانات.",
                    keptHeader: "تم إلغاء اشتراكك",
                    keptBody: "ما زالت المزايا المميزة متاحة لك حتى نهاية الفترة المدفوعة. أعِد تفعيل الاشتراك لتواصل الاستخدام بدون إعلانات.",
                    date: "ينتهي اشتراكك في {date}.",
                },
                billing_issue: {
                    header: "لم تتم عملية الدفع",
                    body: "حدِّث طريقة الدفع حتى لا تفقد المزايا المميزة.",
                    confirm: "حدّثتُ طريقة الدفع",
                    checking: "بعد تحديث طريقة الدفع في المتجر، اضغط على «حدّثتُ طريقة الدفع».",
                    notYet: "لم نرصد الدفع بعد. قد يستغرق ذلك بضع دقائق.",
                },
                expired: {header: "اشتقنا إليك", body: "عُد إلى المزايا المميزة واستخدم {app} بدون إعلانات من جديد."},
                trial_expired: {header: "انتهت الفترة التجريبية المجانية", body: "اشترك في المزايا المميزة لمواصلة استخدام {app} بدون إعلانات."},
                free: {header: "ما رأيك في المزايا المميزة؟", lifetimeHeader: "ما رأيك في المزايا المميزة مدى الحياة؟", body: "استخدم {app} بدون إعلانات ومع جميع المزايا المميزة."},
            },
            ctas: {
                updatePayment: "تحديث طريقة الدفع",
                subscribeAgain: "الاشتراك من جديد",
                subscribe: "اشترك الآن",
                discount: "أريد الخصم",
                winback: "عُد بخصم",
                lifetime: "شراء مدى الحياة",
                code: "استخدام الرمز",
            },
            cards: {
                resubscribe: "خطتك",
                subscription: "اشتراك المزايا المميزة",
                lifetime: "ادفع مرة واحدة واستخدمه للأبد",
                code: "رمز ترويجي",
                codeHint: "صالح في المتجر",
                badge: "−{discount}",
                terms: "ثم {original_price}{per}",
            },
            notice: {
                header: "المزايا المميزة مدى الحياة مفعّلة",
                body: "ألغِ الاشتراك القديم حتى لا يتم تحصيل رسوم منك مرة أخرى.",
                cta: "إدارة الاشتراكات",
            },
            units: {
                per: {
                    day: {one: "/يوم", two: "/يومين", few: "/{n} أيام", many: "/{n} يومًا", other: "/{n} يوم"},
                    week: {one: "/أسبوع", two: "/أسبوعين", few: "/{n} أسابيع", many: "/{n} أسبوعًا", other: "/{n} أسبوع"},
                    month: {one: "/شهر", two: "/شهرين", few: "/{n} أشهر", many: "/{n} شهرًا", other: "/{n} شهر"},
                    year: {one: "/سنة", two: "/سنتين", few: "/{n} سنوات", many: "/{n} سنة", other: "/{n} سنة"},
                },
                first: {
                    day: {one: "خلال اليوم الأول", two: "خلال اليومين الأولين", few: "خلال أول {n} أيام", many: "خلال أول {n} يومًا", other: "خلال أول {n} يوم"},
                    week: {one: "خلال الأسبوع الأول", two: "خلال الأسبوعين الأولين", few: "خلال أول {n} أسابيع", many: "خلال أول {n} أسبوعًا", other: "خلال أول {n} أسبوع"},
                    month: {one: "خلال الشهر الأول", two: "خلال الشهرين الأولين", few: "خلال أول {n} أشهر", many: "خلال أول {n} شهرًا", other: "خلال أول {n} شهر"},
                    year: {one: "خلال السنة الأولى", two: "خلال السنتين الأوليين", few: "خلال أول {n} سنوات", many: "خلال أول {n} سنة", other: "خلال أول {n} سنة"},
                },
            },
        },
    },

    // Nederlands
    nl: {
        updateRequired: "Update vereist",
        updateMessage: "Er is een nieuwe versie beschikbaar. Update om de app te blijven gebruiken.",
        updateNow: "Nu updaten",
        newMessage: "Nieuw Bericht",
        retention: {
            lostHeader: "Je gratis proefperiode is opgezegd",
            lostBody: "De advertenties zijn terug. Activeer je abonnement opnieuw om {app} zonder advertenties te blijven gebruiken.",
            keptHeader: "Je gratis proefperiode is opgezegd",
            keptBody: "Je hebt Premium nog tot het einde van de proefperiode. Activeer je abonnement opnieuw om advertentievrij te blijven.",
            bullets: ["Geen advertenties", "Alle Premium-functies", "Altijd opzegbaar"],
            cta: "Opnieuw activeren",
            dismiss: "Niet nu",
            confirm: "Al geactiveerd",
            checking: "Tik na het activeren in de store op ‘Al geactiveerd’.",
            notYet: "We zien de heractivering nog niet. Dit kan een paar minuten duren.",
            purchaseError: "De aankoop is niet gelukt. Probeer het opnieuw.",
            purchasePending: "Betaling in behandeling. Premium wordt actief zodra de store die bevestigt.",
            trialEnds: "Je proefperiode loopt tot {date}.",
            segments: {
                cancelled: {
                    lostHeader: "Je abonnement is opgezegd",
                    lostBody: "De advertenties zijn terug. Activeer je abonnement opnieuw om {app} zonder advertenties te blijven gebruiken.",
                    keptHeader: "Je abonnement is opgezegd",
                    keptBody: "Je hebt Premium nog tot het einde van de betaalde periode. Activeer je abonnement opnieuw om advertentievrij te blijven.",
                    date: "Je abonnement eindigt op {date}.",
                },
                billing_issue: {
                    header: "Je betaling is mislukt",
                    body: "Werk je betaalmethode bij zodat je Premium niet kwijtraakt.",
                    confirm: "Al bijgewerkt",
                    checking: "Tik na het bijwerken van je betaling in de store op ‘Al bijgewerkt’.",
                    notYet: "We zien de betaling nog niet. Dit kan een paar minuten duren.",
                },
                expired: {header: "We missen je", body: "Kom terug naar Premium en gebruik {app} weer zonder advertenties."},
                trial_expired: {header: "Je gratis proefperiode is afgelopen", body: "Neem Premium om {app} zonder advertenties te blijven gebruiken."},
                free: {header: "Zin in Premium?", lifetimeHeader: "Zin in Premium voor altijd?", body: "Gebruik {app} zonder advertenties en met alle Premium-functies."},
            },
            ctas: {
                updatePayment: "Betaling bijwerken",
                subscribeAgain: "Opnieuw abonneren",
                subscribe: "Abonneren",
                discount: "Korting pakken",
                winback: "Terugkomen met korting",
                lifetime: "Eenmalig kopen",
                code: "Code gebruiken",
            },
            cards: {
                resubscribe: "Je abonnement",
                subscription: "Premium-abonnement",
                lifetime: "Eén keer betalen, altijd gebruiken",
                code: "Promotiecode",
                codeHint: "geldig in de store",
                badge: "−{discount}",
                terms: "daarna {original_price}{per}",
            },
            notice: {
                header: "Je levenslange Premium is actief",
                body: "Zeg je oude abonnement op zodat je niet opnieuw betaalt.",
                cta: "Abonnementen beheren",
            },
            units: {
                per: {
                    day: {one: "/dag", other: "/{n} dagen"},
                    week: {one: "/week", other: "/{n} weken"},
                    month: {one: "/maand", other: "/{n} maanden"},
                    year: {one: "/jaar", other: "/{n} jaar"},
                },
                first: {
                    day: {one: "de eerste dag", other: "de eerste {n} dagen"},
                    week: {one: "de eerste week", other: "de eerste {n} weken"},
                    month: {one: "de eerste maand", other: "de eerste {n} maanden"},
                    year: {one: "het eerste jaar", other: "de eerste {n} jaar"},
                },
            },
        },
    },
};

// Função para detectar idioma do sistema
export const getSystemLanguage = (): string => {
    try {
        // Web/Metro
        if (typeof navigator !== "undefined" && navigator.language) {
            return navigator.language;
        }

        // React Native iOS/Android (NativeModules importado estaticamente no topo)
        // iOS
        if (NativeModules?.SettingsManager?.settings?.AppleLanguages) {
            return NativeModules.SettingsManager.settings.AppleLanguages[0];
        }

        // Android
        if (NativeModules?.I18nManager?.localeIdentifier) {
            return NativeModules.I18nManager.localeIdentifier;
        }

        // Fallback adicional para React Native
        if (NativeModules?.I18nManager?.localeIdentifier) {
            return NativeModules.I18nManager.localeIdentifier;
        }
    } catch (error) {
        // Ignora erros de detecção
    }

    return "en-US"; // fallback padrão
};

// Função para obter traduções baseadas no idioma
export const getLocalizedMessages = (language?: string): Translations => {
    const resolvedLanguage = (language || getSystemLanguage() || "en").toString();
    const languageCode = resolvedLanguage.split("-")[0].toLowerCase();
    return translations[languageCode] || translations["en"];
};
