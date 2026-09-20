/**
 * Replays the supplied 426 × 240, 190-frame recording with live, localized UI.
 * CSS scene keyframes and typing share one document.timeline clock. Camera moves
 * belong to each scene, so opening a screen never transforms the outgoing one.
 * Static decoration is embedded; app/account text and icons remain parameters.
 */

import {getPlayLabels, PlayLabels} from "./labels";
import {COMPOSER_BACKDROP, REVIEWS_BACKDROP, SHEET_BACKDROP, STORE_BANNER} from "./art";
import {REVIEW_TUTORIAL_TRANSITIONS, ReviewTutorialTimings} from "./timings";

export interface ReviewTutorialParams {
    /** Nome do app, como aparece na lista e no header do composer.
     *  Omitido no componente: cai em `Application.applicationName`. */
    appName?: string;
    /** URL https do ícone do app. Sem isso, cai num círculo com a inicial. */
    appIconUrl?: string;
    /** Nome exibido do usuário no composer e no avatar. Default: `defaultUserName` do locale
     *  ("Você" em pt). Passar um nome real troca em todos os lugares e volta a cor a ser o
     *  hash do nome. */
    userName?: string;
    /** E-mail mostrado no bottom sheet da conta. */
    userEmail?: string;
    /** Inicial do avatar. Default: primeira letra de userName. */
    userInitial?: string;
    /** Cor do círculo do avatar. Default: hash determinístico do nome. */
    avatarColor?: string;
    /** Relógio da status bar. Default: hora local do aparelho. */
    clock?: string;
    /** Cor de destaque (estrelas, links, aba ativa). Default: Material You azul. */
    accent?: string;
    /** Locale para os rótulos da Play Store. */
    locale?: string;
    /** Sobrescreve os rótulos resolvidos pelo locale. */
    labels?: Partial<PlayLabels>;
    /** Texto de exemplo digitado no campo. Default: o do locale. */
    reviewText?: string;
    /** Direção do texto. Default: ltr (ar/he/fa/ur viram rtl automaticamente). */
    dir?: "ltr" | "rtl";
    /** Duração das transições em segundos. Eventos posteriores acompanham o ajuste. */
    timings?: ReviewTutorialTimings;
}

const RTL_LOCALES = ["ar", "he", "fa", "ur", "iw"];

/**
 * Cor do avatar quando o app nao passa `userName`. Fixa de proposito: hashear o nome padrao
 * traduzido daria uma cor diferente por idioma (o mesmo usuario ficaria vermelho em pt e roxo
 * em en). Com nome real passado, volta a valer o hash.
 */
const DEFAULT_AVATAR_COLOR = "#E37400";

const AVATAR_COLORS = [
    "#B154BE", "#1A73E8", "#D93025", "#188038", "#E37400", "#9334E6", "#007B83",
];

/** Escapa texto para interpolação segura em HTML. */
function esc(value: string): string {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Escapa string para literal JS dentro de <script>. */
function escJs(value: string): string {
    return JSON.stringify(String(value)).slice(1, -1).replace(/</g, "\\u003c");
}

function hashColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function firstGrapheme(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "?";
    return Array.from(trimmed)[0].toUpperCase();
}

function localClock(): string {
    const d = new Date();
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

/** Estrela Material: preenchida ou contornada. */
function star(filled: boolean, size: number): string {
    const path =
        "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
    return filled
        ? '<svg class="st" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path d="' + path + '" fill="var(--accent)"/></svg>'
        : '<svg class="st" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path d="' + path + '" fill="none" stroke="#808482" stroke-width="1.6"/></svg>';
}

function starRow(count: number, size: number, gap: number): string {
    let out = '<div class="stars" style="gap:' + gap + 'px">';
    for (let i = 0; i < 5; i++) out += star(i < count, size);
    return out + "</div>";
}

/** Ícone Material outline, monocromático, recolorido por currentColor. */
function icon(name: string, size: number): string {
    const outline: Record<string, string> = {
        stars: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="m12 5.5 1.8 4 4.4.4-3.3 2.9 1 4.3-3.9-2.2-3.9 2.2 1-4.3-3.3-2.9 4.4-.4z"/>',
        storage: '<g fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 3h18v7H3zM3 14h18v7H3z"/><path d="M5 6.5h3M5 17.5h3"/></g>',
        devices: '<g fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17V3h18v14h-4M6 6h12"/><rect x="4" y="11" width="5" height="10" rx="1"/><rect x="14" y="9" width="6" height="10" rx="1"/></g>',
        apps: '<g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M7 7h2m2 0h2m2 0h2M7 11h2m2 0h2m2 0h2M7 15h2m2 0h2m2 0h2"/></g>',
    };
    if (outline[name]) return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor">' + outline[name] + '</svg>';
    const paths: Record<string, string> = {
        apps: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
        back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
        battery: "M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z",
        bell: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z",
        card: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z",
        chevron: "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
        close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        devices: "M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z",
        folder: "M9.17 6l2 2H20v10H4V6h5.17M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
        shield: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm7 10c0 4.52-2.98 8.69-7 9.93-4.02-1.24-7-5.41-7-9.93V6.3l7-3.11 7 3.11V11zm-11.59.59L6 13l4 4 8-8-1.41-1.42L10 14.17z",
        signal: "M0 0h24v24H0z",
        star: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
        starBorder: "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z",
        stars: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z",
        storage: "M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z",
        wifi: "M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z",
    };
    return (
        '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="' + (paths[name] || "") + '"/></svg>'
    );
}

/** Triângulo de 4 cunhas da Play Store (marca registrada — geometria fiel). */
function playLogo(size: number, className = ""): string {
    return (
        '<svg class="' + className + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<path fill="#4285F4" d="M3.6 1.8c-.4.3-.6.8-.6 1.4v17.6c0 .6.2 1.1.6 1.4l.1.1L13.8 12v-.2L3.7 1.8z"/>' +
        '<path fill="#FBBC04" d="M17.2 15.4l-3.4-3.4v-.2l3.4-3.4.1.1 4 2.3c1.2.7 1.2 1.8 0 2.4l-4.1 2.2z"/>' +
        '<path fill="#EA4335" d="M17.3 15.3 13.8 12 3.6 22.2c.4.4 1 .5 1.7.1l12-6.9z"/>' +
        '<path fill="#34A853" d="M17.3 8.7 5.3 1.8c-.7-.4-1.3-.3-1.7.1L13.8 12z"/>' +
        "</svg>"
    );
}

/** Ícone do app: imagem se houver URL, senão placeholder com a inicial. */
function appIcon(url: string | undefined, name: string, size: number, radius: number): string {
    const style = "width:" + size + "px;height:" + size + "px;border-radius:" + radius + "px";
    const fallback =
        '<div class="appicon ph" style="' + style + ";background:" + hashColor(name) +
        ";font-size:" + Math.round(size * 0.5) + 'px' + (url ? ";display:none" : "") + '">' +
        esc(firstGrapheme(name)) + "</div>";
    if (!url) return fallback;
    /* URL quebrada nao pode virar caixa vazia: cai no placeholder com a inicial */
    return (
        '<img class="appicon" src="' + esc(url) + '" style="' + style + '" alt="" ' +
        "onerror=\"this.style.display='none';" +
        "this.nextElementSibling.style.display='flex'\">" + fallback
    );
}

/** Linha de menu do bottom sheet da conta. */
function menuRow(iconName: string, label: string, badge?: string, k?: string): string {
    return (
        '<div class="mrow"' + (k ? ' data-k="' + k + '"' : "") + '>' + icon(iconName, 14) +
        '<span class="mlabel">' + esc(label) + "</span>" +
        (badge ? '<span class="mbadge">' + esc(badge) + "</span>" : "") +
        "</div>"
    );
}

function statusBar(clock: string): string {
    return (
        '<div class="sbar"><span class="clock">' + esc(clock) + ' <span class="s-warning">▲</span></span>' +
        '<span class="sicons">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21 1 8c6.2-5.3 15.8-5.3 22 0z"/></svg>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 22h20V2z"/></svg>' +
        '<svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.7 4H14V2h-4v2H8.3C7.6 4 7 4.6 7 5.3v15.4c0 .7.6 1.3 1.3 1.3h7.4c.7 0 1.3-.6 1.3-1.3V5.3c0-.7-.6-1.3-1.3-1.3z"/></svg>' +
        "</span></div>"
    );
}

export function buildTutorialHtml(params: ReviewTutorialParams): string {
    const base = getPlayLabels(params.locale);
    const L: PlayLabels = {...base, ...(params.labels || {})};

    const appName = params.appName || "";
    const userName = params.userName || L.defaultUserName;
    const initial = params.userInitial || firstGrapheme(userName);
    const avatar = params.avatarColor || (params.userName ? hashColor(params.userName) : DEFAULT_AVATAR_COLOR);
    const clock = params.clock || localClock();
    const email = params.userEmail || "";
    const accent = params.accent || "#0B57D0";
    const review = params.reviewText ?? L.sampleReview;
    const lang = (params.locale || "en").split("-")[0].toLowerCase();
    const dir = params.dir || (RTL_LOCALES.indexOf(lang) >= 0 ? "rtl" : "ltr");

    const subtitle = L.privateFeedback + " • " + L.fromYourLibrary;

    return (
        "<!DOCTYPE html><html lang=\"" + esc(lang) + "\" dir=\"" + dir + "\"><head>" +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">' +
        "<style>" + CSS.replace(/__ACCENT__/g, accent)
            .replace("__ANNOT_RULES__", annotRules(dir === "rtl")) + "</style></head><body>" +
        '<div class="fit"><div class="canvas">' +

        /* ---------- camada 1 + 2: telas dentro da camera ---------- */
        '<div class="camera"><div class="phone">' +

        /* A - launcher */
        '<section class="scr launcher">' + launcherGrid(L, lang) + "</section>" +

        /* B - splash da Play */
        '<section class="scr splash"><div class="splash-window"></div>' + playLogo(68, 'splash-logo') + '<i class="spinner"></i></section>' +

        /* C - home da Play Store */
        '<section class="scr playhome">' + statusBar(clock) +
        '<div class="ph-top"><div class="ph-search">' +
        '<span class="ph-bell">' + icon("bell", 30) + '<i class="dot">1</i></span>' +
        '<span data-k="avatar" class="ph-avatar" style="background:' + avatar + '">' +
        esc(initial) + "</span>" +
        "</div>" +
        '<div class="ph-tabs"><span class="on">' + esc(L.tabForYou) + "</span><span>" +
        esc(L.tabTrending) + "</span><span>" + esc(L.tabWorkApps) + "</span><span>" +
        esc(L.tabKids) + "</span></div></div>" +
        '<div class="ph-banner"><i></i><i></i><i></i><i></i></div></section>' +

        /* D - bottom sheet da conta */
        '<section class="scr sheet">' +
        '<div class="sh-card">' +
        '<div class="sh-word"><b style="color:#4285F4">G</b><b style="color:#EA4335">o</b>' +
        '<b style="color:#FBBC04">o</b><b style="color:#4285F4">g</b>' +
        '<b style="color:#34A853">l</b><b style="color:#EA4335">e</b></div>' +
        '<div class="sh-acct"><span class="sh-avatar" style="background:' + avatar + '">' +
        esc(initial) + '</span><span class="sh-mail">' + esc(email || userName) + "</span>" +
        '<span class="sh-caret">' + icon("chevron", 16) + "</span></div>" +
        '<div class="sh-pill">' + esc(L.manageAccount) + "</div>" +
        '<div class="sh-menu">' +
        menuRow("apps", L.manageAppsDevices, undefined, "manage") +
        menuRow("bell", L.notificationsOffers, "1") +
        menuRow("card", L.paymentsSubscriptions) +
        menuRow("shield", L.playProtect) +
        menuRow("folder", L.library) +
        menuRow("stars", L.playPoints) +
        "</div></div></section>" +

        /* E - gerenciar apps e dispositivos */
        '<section class="scr manage"><div class="mg-content">' +
        '<div class="mg-actions"><span>' + esc(L.updateAll) + "</span><span>" +
        esc(L.seeDetails) + "</span></div>" +
        '<div class="mg-row">' + icon("storage", 22) +
        '<div class="mg-body"><div class="mg-title">' + esc(L.storageUsed) + "</div>" +
        '<div class="mg-bar"><i></i></div></div></div>' +
        '<div class="mg-row">' + icon("devices", 22) +
        '<div class="mg-body"><div class="mg-title one">' + esc(L.syncApps) + "</div>" +
        '<div class="mg-sub">' + esc(L.noDeviceSynced) + "</div></div></div>" +
        '<div class="mg-row tap" data-k="ratings">' + icon("stars", 22) +
        '<div class="mg-body"><div class="mg-title">' + esc(L.ratingsReviews) + "</div></div></div>" +
        "</div></section>" +

        /* F - tela Avaliacoes */
        '<section class="scr reviews"><div class="rv-card">' + statusBar(clock) +
        '<div class="rv-top">' + icon("back", 22) + "<h1>" + esc(L.reviewsTitle) + "</h1></div>" +
        '<div class="rv-tabs"><span class="on">' + esc(L.tabNotRated) + "</span><span>" +
        esc(L.tabPosted) + "</span></div>" +
        '<div class="rv-item">' + appIcon(params.appIconUrl, appName, 38, 8) +
        '<div class="rv-body"><div class="rv-name">' + esc(appName) + "</div>" +
        '<div class="rv-sub">' + esc(subtitle) + "</div></div></div>" +
        '<div class="rv-stars" data-k="rvstars">' + starRow(0, 24, 42) + starRow(5, 24, 42) + "</div>" +
        '<div class="rv-feedback">' + esc(L.sendFeedback) + "</div></div></section>" +

        /* G - composer de avaliacao */
        '<section class="scr composer"><div class="cp-card">' + statusBar(clock) +
        '<div class="cp-head">' + icon("close", 20) +
        appIcon(params.appIconUrl, appName, 20, 5) +
        '<div class="cp-headbody"><div class="cp-name">' + esc(appName) + "</div>" +
        '<div class="cp-sub">' + esc(subtitle) + "</div></div>" +
        '<span class="cp-post" data-k="post">' + esc(L.post) + "</span></div>" +
        '<div class="cp-user"><span class="cp-avatar" style="background:' + avatar + '">' +
        esc(initial) + '</span><span class="cp-uname">' + esc(userName) + "</span></div>" +
        '<p class="cp-notice">' + esc(L.privacyNotice) +
        ' <span class="cp-more">' + esc(L.learnMore) + "</span></p>" +
        '<div class="cp-stars">' + starRow(5, 22, 20) + "</div>" +
        '<div class="cp-field" data-k="field"><span class="cp-ph">' + esc(L.describeExperience) + "</span>" +
        '<span class="cp-input"><span class="cp-typed"></span><i class="caret"></i></span></div>' +
        '<div class="cp-count"><span class="cp-n">0</span>/500</div>' +
        "</div></section>" +

        "</div></div>" +
        '<div class="flash"></div>' +

        /* ---------- camada 3: anotacoes, FORA da camera ---------- */
        annotations() +

        "</div></div>" +
        '<script id="tutorial-timings" type="application/json">' + JSON.stringify(params.timings || {}).replace(/</g, "\\u003c") + '</script>' +
        "<script>" + JS.replace(/__REVIEW__/g, () => escJs(review))
            .replace("__TRANSITIONS__", () => JSON.stringify(REVIEW_TUTORIAL_TRANSITIONS)) + "</script>" +
        "</body></html>"
    );
}

/** Ícones do launcher: aproximações simples, só o alvo (Play Store) carrega significado. */
const LAUNCHER_ART: Record<string, string> = {
    phone:
        '<svg viewBox="0 0 24 24" width="31" height="31"><path fill="#1A73E8" d="M6.6 10.8c1.4 2.8 3.6 5 6.4 6.4l2.1-2.1c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.2 1.1z"/></svg>',
    files:
        '<svg viewBox="0 0 24 24" width="31" height="31"><path fill="#DADCE0" d="M5 2h9l5 5v15H5z"/><path fill="#F1F3F4" d="M14 2v6h5z"/><path fill="#FBBC04" d="M10 10h12v11H10z"/><path fill="#4285F4" d="M2 16h8v6H2z"/></svg>',
    youtube:
        '<svg viewBox="0 0 24 24" width="31" height="31"><rect x="1" y="5" width="22" height="15" rx="4" fill="#F00"/><path fill="#FFF" d="m10 9 6 3.5-6 3.5z"/></svg>',
    ytmusic:
        '<svg viewBox="0 0 24 24" width="33" height="33"><circle cx="12" cy="12" r="11" fill="#FF0033"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#FFF"/><path fill="#FFF" d="m10 8 6 4-6 4z"/></svg>',
    photos:
        '<svg viewBox="0 0 24 24" width="32" height="32">' +
        '<path fill="#F9AB00" d="M12 3c2.2 0 4 1.8 4 4v4h-4a4 4 0 0 1-4-4 4 4 0 0 1 4-4z" opacity=".9"/>' +
        '<path fill="#E94235" d="M21 12c0 2.2-1.8 4-4 4h-4v-4a4 4 0 0 1 4-4 4 4 0 0 1 4 4z"/>' +
        '<path fill="#4285F4" d="M12 21c-2.2 0-4-1.8-4-4v-4h4a4 4 0 0 1 4 4 4 4 0 0 1-4 4z"/>' +
        '<path fill="#34A853" d="M3 12c0-2.2 1.8-4 4-4h4v4a4 4 0 0 1-4 4 4 4 0 0 1-4-4z"/></svg>',
    gmail:
        '<svg viewBox="0 0 24 18" width="31" height="23">' +
        '<path fill="#EA4335" d="M2 2.5 12 10 22 2.5V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z"/>' +
        '<path fill="#C5221F" d="M2 2.5V16a1 1 0 0 0 1 1h2.5V6.2z"/>' +
        '<path fill="#FBBC04" d="M22 2.5V16a1 1 0 0 1-1 1h-2.5V6.2z"/>' +
        '<path fill="#4285F4" d="M5.5 17V6.2L12 11l6.5-4.8V17z" opacity=".15"/></svg>',
    google:
        '<svg viewBox="0 0 24 24" width="31" height="31">' +
        '<path fill="#4285F4" d="M21.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.5h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z"/>' +
        '<path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/>' +
        '<path fill="#FBBC04" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z"/>' +
        '<path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"/></svg>',
    maps:
        '<svg viewBox="0 0 24 24" width="30" height="30">' +
        '<path fill="#34A853" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z"/>' +
        '<circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>',
    messages:
        '<svg viewBox="0 0 24 24" width="31" height="31">' +
        '<path fill="#1A73E8" d="M12 3c5 0 9 3.2 9 7.2s-4 7.2-9 7.2c-.9 0-1.7-.1-2.5-.3L5 19l1-3.2A6.9 6.9 0 0 1 3 10.2C3 6.2 7 3 12 3z"/></svg>',
    clock:
        '<svg viewBox="0 0 24 24" width="32" height="32">' +
        '<circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#5F6368" stroke-width="1.4"/>' +
        '<path d="M12 6.5V12l4 2.2" stroke="#1A73E8" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    security:
        '<svg viewBox="0 0 24 24" width="31" height="31">' +
        '<path fill="#4285F4" d="M12 2 4 5.2v5.4c0 4.7 3.4 9.1 8 10.3 4.6-1.2 8-5.6 8-10.3V5.2z"/>' +
        '<path d="m8.6 12.2 2.3 2.3 4.5-4.6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
};

function launcherGrid(L: PlayLabels, lang: string): string {
    const names: Record<string, string[]> = {
        pt: ["Fotos", "Mensagens", "Relógio", "Segurança", "Telefone", "Arquivos"],
        en: ["Photos", "Messages", "Clock", "Safety", "Phone", "Files"],
        es: ["Fotos", "Mensajes", "Reloj", "Seguridad", "Teléfono", "Archivos"],
    };
    const [photos, messages, clock, security, phone, files] = names[lang] || names.en;
    const cells: Array<[string, string]> = [
        ["photos", photos],
        ["gmail", "Gmail"],
        ["google", "Google"],
        ["maps", "Maps"],
        ["messages", messages],
        ["play", L.playStore],
        ["clock", clock],
        ["security", security],
        ["phone", phone],
        ["files", files],
        ["youtube", "YouTube"],
        ["ytmusic", "YT Music"],
    ];
    let out = '<div class="lg">';
    for (const [art, label] of cells) {
        const target = art === "play";
        out +=
            '<div data-k="' + (target ? "play" : "") + '" class="lg-cell' +
            (target ? " target" : "") + '"><div class="lg-icon">' +
            (target ? playLogo(32) : LAUNCHER_ART[art] || "") +
            '</div><span class="lg-label">' + esc(label) + "</span></div>";
    }
    return out + "</div>";
}

/**
 * Geometria das 7 anotacoes, medida nos frames de referencia (canvas 426x240).
 * [x, y, largura, altura]
 */
const ANNOTATIONS: Array<[number, number, number, number, number, number, number, number]> = [
    /* x, y, largura, altura, setaW, setaH, aparece(s), some(s) */
    [126, 112, 106, 44, 17, 30, 0.0, 1.5],   /* A1 icone da Play Store no launcher */
    [302, 45, 112, 45, 18, 30, 2.8, 3.6],    /* A2 avatar do perfil */
    [102, 58, 118, 50, 21, 34, 4.0, 5.5],    /* A3 "Gerenciar apps e dispositivos" */
    [24, 52, 148, 62, 26, 42, 5.8, 7.6],     /* A4 "Notas e avaliacoes" */
    [230, 138, 148, 62, 25, 41, 8.7, 9.6],   /* A5 estrelas 4 e 5 da lista */
    [74, 175, 148, 62, 25, 42, 10.8, 12.3],  /* A6 campo de texto */
    [290, 24, 61, 26, 18, 30, 16.3, 18.1],   /* A7 botao "Postar" */
];

/** Distancia da ponta da seta ate o topo do retangulo, no repouso (medida). */
const ARROW_GAP = 9;
/** Periodo do pulso, medido: 1,0 s. Cada anotacao REINICIA o seu ao aparecer. */
const PULSE = 1.0;
const TOTAL = 19;

const pct = (t: number) => ((t / TOTAL) * 100).toFixed(6);

/**
 * Regras de posicao e de pulso das anotacoes.
 *
 * O pulso nao e um relogio global: medindo os frames, o retangulo de cada anotacao esta no
 * tamanho maximo exatamente no frame em que ela aparece (A3 em 4,0 s, A5 em 8,7 s,
 * A6 em 10,8 s) e encolhe para 0,90 meio segundo depois. Por isso o ciclo e gerado dentro da
 * animacao mestre de 19 s, com origem no instante de entrada de cada uma — e nao com
 * `animation-delay`, que a visualizacao congelada do QA sobrescreveria.
 *
 * Em RTL o eixo x espelha junto com o layout.
 */
function annotRules(rtl: boolean): string {
    const out: string[] = [];
    ANNOTATIONS.forEach(([x, y, w, h, aw, ah, appear, vanish], i) => {
        const n = i + 1;
        const left = rtl ? 426 - (x + w) : x;
        out.push(
            ".a" + n + "{left:" + left + "px;top:" + y + "px;width:" + w + "px;height:" + h +
            "px;animation:an" + n + " 19s infinite step-end}\n" +
            ".a" + n + " .achev{width:" + aw + "px;height:" + ah + "px;margin-left:" +
            -aw / 2 + "px;bottom:calc(100% + " + ARROW_GAP + "px);" +
            "animation:arw" + n + " 19s infinite ease-in-out}\n" +
            ".a" + n + " .arect{animation:rct" + n + " 19s infinite ease-in-out}"
        );

        const rect: string[] = ["0%{transform:scale(1)}"];
        const arrow: string[] = ["0%{transform:translateY(0)}"];
        for (let t = appear; t <= vanish + 0.001; t += PULSE / 2) {
            const half = Math.round((t - appear) / (PULSE / 2)) % 2 === 1;
            rect.push(pct(t) + "%{transform:scale(" + (half ? ".9" : "1") + ")}");
            arrow.push(pct(t) + "%{transform:translateY(" + (half ? "-20px" : "0") + ")}");
        }
        rect.push("100%{transform:scale(1)}");
        arrow.push("100%{transform:translateY(0)}");
        out.push(timeline("an" + n, [[0, "opacity:" + (appear === 0 ? "1" : "0")],
            [appear, "opacity:1"], [vanish, "opacity:0"], [TOTAL, "opacity:0"]]));
        out.push("@keyframes rct" + n + "{" + rect.join("") + "}");
        out.push("@keyframes arw" + n + "{" + arrow.join("") + "}");
    });
    return out.join("\n");
}

/** Sete anotacoes estaticas; cada uma acende no seu intervalo com corte seco (step-end). */
function annotations(): string {
    let out = "";
    for (let i = 1; i <= 7; i++) {
        out +=
            '<div class="annot a' + i + '"><div class="arect"></div>' +
            '<svg class="achev" viewBox="0 0 25 41" preserveAspectRatio="none">' +
            '<path d="M12.5 0V33M3 26L12.5 40L22 26" fill="none" stroke="#FF0000" ' +
            'stroke-width="6" stroke-linecap="butt" stroke-linejoin="miter"/></svg>' +
            "</div>";
    }
    return out;
}

/** Seconds, rather than rounded percentages, are the source of truth. */
function timeline(name: string, frames: Array<[number, string]>): string {
    return "@keyframes " + name + "{" + frames.map(([t, style]) => pct(t) + "%{" + style + "}").join("") + "}";
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
html,body{width:100%;height:100%;overflow:hidden;background:#FDFDFD}
body{font-family:Roboto,'Helvetica Neue',Arial,sans-serif;color:#202124}
:root{--accent:__ACCENT__;--surface:#FDFDFD;--text:#202124;--text2:#5F6368;--red:#FF0000;--direction:1}
html[dir=rtl]{--direction:-1}
.fit{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.canvas{position:relative;width:426px;height:240px;overflow:hidden;background:var(--surface);
  transform:scale(var(--s,1));transform-origin:center;flex:none}
.camera,.phone{position:absolute;inset:0}
.scr{position:absolute;inset:0;opacity:0;background:var(--surface);overflow:hidden}
.launcher{animation:sA 19s infinite linear;transform-origin:177px 134px;background:#D8D7DE}
.splash{animation:sB 19s infinite linear;background:transparent}
.playhome{animation:sC 19s infinite linear;transform-origin:0 0}
.sheet{animation:sD 19s infinite linear;background:var(--surface) url('${SHEET_BACKDROP}') calc(50% - 11px) center/cover no-repeat}
.manage{animation:sE 19s infinite linear}
.reviews{animation:sF 19s infinite linear;background:url('${REVIEWS_BACKDROP}') center/cover}
.composer{animation:sG 19s infinite linear;background:url('${COMPOSER_BACKDROP}') center/cover}
.flash{position:absolute;inset:0;background:var(--surface);opacity:0;pointer-events:none;animation:flash 19s infinite step-end}
.ic,.st{flex:none;display:block}
.appicon{display:block;object-fit:cover;flex:none}
.ph{display:flex;align-items:center;justify-content:center;color:#fff}
.sbar{display:flex;align-items:center;justify-content:space-between;height:26px;
  padding:0 12px 8px;color:#5F6368;font-size:11px;line-height:14px}
.s-warning{font-size:10px}
.sicons{display:flex;align-items:center;gap:2px}
.sicons svg{width:12px;height:12px}
.sicons svg:last-child{width:8px}

/* Launcher: 46px icons on the original 72 × 95px grid. */
.lg{display:grid;grid-template-columns:repeat(4,46px);padding:17px 82px 0;column-gap:26px;row-gap:28px}
.lg-cell{display:flex;flex-direction:column;align-items:center;gap:9px}
.lg-icon{width:46px;height:46px;flex:none;border-radius:50%;background:#FFF;display:flex;
  align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,.16)}
.lg-icon svg{display:block}
.lg-label{font-size:10px;line-height:12px;color:#1F1F1F;white-space:nowrap}

/* The window and its logo have separate, measured trajectories. */
.splash-window{position:absolute;background:var(--surface);animation:splashWindow 19s infinite linear}
.splash-logo{position:absolute;width:68px;height:68px;inset-inline-start:179px;top:90px;
  animation:splashLogo 19s infinite linear}
.spinner{position:absolute;left:212px;top:223px;width:3px;height:7px;border-left:1px solid #1d7198;
  border-radius:50%;opacity:0;animation:spinner 19s infinite step-end}

.playhome .sbar{justify-content:flex-end;padding-inline-end:36px}
.playhome .sicons svg{width:18px;height:18px}
.playhome .sicons svg:last-child{width:13px}
.playhome .clock{display:none}
.ph-top{padding:22px 46px 0 14px}
.ph-search{display:flex;align-items:center;gap:20px;height:40px;justify-content:flex-end}
.ph-bell{position:relative;color:var(--text2);display:flex}
.dot{position:absolute;top:-2px;right:-3px;background:#B83A28;color:#FFF;font-size:10px;
  font-style:normal;width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.ph-avatar{width:40px;height:40px;border-radius:50%;color:#FFF;font-size:19px;flex:none;
  display:flex;align-items:center;justify-content:center;line-height:1}
.ph-tabs{display:flex;gap:60px;padding:36px 0 0;margin-inline-start:-102px;font-size:18px;
  line-height:22px;color:var(--text2);white-space:nowrap}
.ph-tabs .on{color:var(--accent)}
.ph-banner{position:absolute;inset-inline:0;top:168px;height:72px;
  background:url('${STORE_BANNER}') center/cover;animation:bannerIn 19s infinite step-end}

.sh-card{position:absolute;inset-inline:69px;top:-92px;bottom:-100px;
  background:#F8F7FC;border-radius:24px 24px 0 0;padding-top:16px;
  transform-origin:center top;animation:sheetUp 19s infinite linear}
.sh-word{text-align:center;font-size:22px;line-height:26px;letter-spacing:-.5px;margin-bottom:14px}
.sh-word b{font-weight:400}
.sh-acct{display:flex;align-items:center;gap:12px;height:56px;padding:0 20px 16px}
.sh-avatar{width:28px;height:28px;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;flex:none}
.sh-mail{flex:1;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-caret{color:var(--text2);display:flex;transform:rotate(90deg)}
.sh-pill{margin:0 auto 16px;width:max-content;max-width:92%;border:1px solid #B6B5B4;
  border-radius:5px;padding:5px 10px;font-size:10px;line-height:14px;white-space:nowrap}
.sh-menu{border-top:1px solid #eeedf0}
.mrow{display:flex;align-items:center;gap:18px;height:38px;padding:0 18px 0 28px;color:var(--text2)}
.mlabel{flex:1;font-size:10px;line-height:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mbadge{font-size:9px}

/* Author at the unzoomed f078 geometry; pan only this screen's content. */
.mg-content{position:absolute;inset:0;transform-origin:0 0;animation:manageView 19s infinite linear}
[dir=rtl] .mg-content{transform-origin:100% 0}
.mg-actions{position:absolute;inset-inline-start:97px;top:18px;display:flex;gap:26px;
  font-size:13px;line-height:16px;color:var(--accent)}
.mg-row{position:absolute;inset-inline:50px 0;top:83px;display:flex;gap:25px;color:var(--text2)}
.mg-row:nth-child(3){top:157px}
.mg-row.tap{top:209px;padding-block:8px;animation:tapRipple 19s infinite step-end}
.mg-body{flex:1;min-width:0}
.mg-title{font-size:15px;line-height:19px;color:var(--text);white-space:nowrap}
.mg-sub{font-size:13px;line-height:17px;color:var(--text2);margin-top:4px}
.mg-bar{margin-top:15px;height:4px;background:#DADCE0;overflow:hidden}
.mg-bar i{display:block;height:100%;width:47%;background:var(--accent)}

.rv-card{position:absolute;inset-block:0;inset-inline:50px 48px;background:var(--surface)}
.rv-top{display:flex;align-items:center;gap:20px;padding:5px 14px 0;color:var(--text)}
.rv-top h1{font-size:18px;line-height:24px;font-weight:400}
.rv-tabs{position:absolute;inset-inline:0;top:70px;height:33px;display:flex;gap:26px;padding-inline-start:15px;
  font-size:11px;line-height:26px;color:var(--text2);border-bottom:1px solid #d1d1d1;white-space:nowrap}
.rv-tabs .on{color:#14648b;border-bottom:2px solid #14648b}
.rv-item{position:absolute;inset-inline:18px 8px;top:113px;display:flex;align-items:flex-start;gap:13px}
.rv-body{flex:1;min-width:0}
.rv-name{font-size:12px;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv-sub{font-size:10px;line-height:13px;color:#808080;white-space:nowrap;overflow:hidden;text-overflow:clip}
.rv-stars{position:absolute;inset-inline-start:18px;top:157px;height:28px;width:288px}
.rv-stars .stars{position:absolute;inset:0}
.rv-stars .stars:nth-child(1){animation:starEmpty 19s infinite step-end}
.rv-stars .stars:nth-child(2){opacity:0;animation:starFull 19s infinite step-end}
.rv-feedback{position:absolute;inset-inline-start:18px;top:205px;font-size:11px;line-height:14px;color:#14648b}
.rv-item,.rv-stars,.rv-feedback{animation:reviewContent 19s infinite linear}

.cp-card{position:absolute;inset-block:0;inset-inline:71px;background:var(--surface)}
.composer .sbar{height:16px;padding:0 12px;font-size:9px;line-height:12px}
.composer .sicons svg{width:11px;height:11px}
.cp-head{position:absolute;inset-inline:0;top:16px;height:40px;display:flex;align-items:center;gap:10px;
  padding:0 10px;border-bottom:1px solid #bfc0c1;color:var(--text2)}
.cp-headbody{flex:1;min-width:0;margin-inline-end:66px}
.cp-name{font-size:11px;line-height:15px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-sub{font-size:10px;line-height:13px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-post{position:absolute;inset-inline-end:20px;top:16px;font-size:10px;line-height:12px;color:#A7A7A7}
.cp-user{position:absolute;top:73px;inset-inline:11px 10px;display:flex;align-items:flex-start;gap:11px}
.cp-avatar{width:29px;height:29px;border-radius:50%;color:#FFF;font-size:17px;
  display:flex;align-items:center;justify-content:center;flex:none}
.cp-uname{font-size:9px;line-height:12px;padding-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-notice{position:absolute;inset-inline:51px 13px;top:92px;height:52px;font-size:10px;line-height:14px;color:#3C4043}
.cp-more{text-decoration:underline;color:var(--text2)}
.cp-stars{position:absolute;inset-inline-start:47px;top:150px}
.cp-field{position:absolute;inset-inline:17px;top:189px;height:39px;border:1px solid #929292;
  border-radius:2px;font-size:11px;line-height:14px;color:var(--text)}
.cp-field.focused{border-color:#14648b;box-shadow:inset 0 0 0 .3px #14648b}
.cp-ph{position:absolute;inset-inline:10px;top:10px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-input{position:absolute;inset-inline:10px;top:10px;height:17px;overflow:hidden;white-space:pre;unicode-bidi:plaintext}
.cp-typed{white-space:pre}
.caret{display:inline-block;width:1px;height:15px;background:#14648b;vertical-align:-3px}
.cp-count{position:absolute;inset-inline-end:17px;top:232px;font-size:8px;line-height:8px;color:var(--text2)}
.stars{display:flex;align-items:center}

.annot{position:absolute;opacity:0;pointer-events:none}
.arect{position:absolute;inset:0;border:2px solid var(--red);transform-origin:center}
.achev{position:absolute;left:50%}
__ANNOT_RULES__

${timeline("sA", [[0,"opacity:1;transform:scale(1)"],[1.4,"opacity:1;transform:scale(1)"],[1.5,"opacity:1;transform:scale(.94)"],[1.6,"opacity:0;transform:scale(.94)"],[19,"opacity:0"]])}
${timeline("sB", [[0,"opacity:0"],[1.499,"opacity:0"],[1.5,"opacity:1"],[2.599,"opacity:1"],[2.6,"opacity:0"],[19,"opacity:0"]])}
${timeline("splashWindow", [[0,"left:154px;top:111px;width:46px;height:46px;border-radius:23px"],
  [1.4,"left:154px;top:111px;width:46px;height:46px;border-radius:23px"],
  [1.5,"left:139px;top:23px;width:103px;height:154px;border-radius:30px"],
  [1.6,"left:95px;top:-240px;width:232px;height:720px;border-radius:0;box-shadow:0 0 0 18px #d8d7de"],
  [1.7,"left:113px;top:-240px;width:200px;height:720px;border-radius:0;box-shadow:0 0 0 2px #d8d7de,0 0 0 200px #fdfdfd"],
  [1.8,"left:123px;top:-240px;width:181px;height:720px;border-radius:0;box-shadow:0 0 0 1px #eee,0 0 0 200px #fdfdfd"],
  [1.9,"left:0;top:-240px;width:426px;height:720px;border-radius:0;box-shadow:none"],
  [19,"left:0;top:-240px;width:426px;height:720px;border-radius:0;box-shadow:none"]])}
${timeline("splashLogo", [[0,"opacity:1;transform:translate(-36px,10px) scale(.5)"],
  [1.4,"opacity:1;transform:translate(-36px,10px) scale(.5)"],
  [1.5,"opacity:1;transform:translate(-23px,-25px) scale(1.2)"],
  [1.6,"opacity:1;transform:translate(0,-80px) scale(1.43)"],
  [1.7,"opacity:1;transform:translate(0,-23px) scale(1.12)"],
  [1.8,"opacity:1;transform:translate(0,0) scale(1)"],[2.1,"opacity:1;transform:translate(0,0) scale(1)"],
  [2.2,"opacity:.35;transform:translate(0,0) scale(1)"],[2.3,"opacity:0;transform:translate(0,0) scale(1)"],[19,"opacity:0"]])}
${timeline("spinner", [[0,"opacity:0"],[2.4,"opacity:.65"],[2.6,"opacity:0"],[19,"opacity:0"]])}
${timeline("sC", [[0,"opacity:0;transform:scale(.72)"],[2.599,"opacity:0;transform:scale(.72)"],
  [2.6,"opacity:1;transform:scale(.85)"],[2.7,"opacity:1;transform:scale(1)"],[3.8,"opacity:1"],[3.9,"opacity:0"],[19,"opacity:0"]])}
${timeline("bannerIn", [[0,"filter:none;opacity:0"],[2.7,"filter:grayscale(1);opacity:.25"],[2.8,"filter:none;opacity:1"],[3,"filter:none;opacity:1"],[19,"filter:none;opacity:1"]])}
${timeline("sD", [[0,"opacity:0"],[3.7,"opacity:0"],[3.8,"opacity:1"],[5.5,"opacity:1"],[5.7,"opacity:0"],[19,"opacity:0"]])}
/* The account menu opens vertically at its final width and horizontal position. */
${timeline("sheetUp", [[0,"transform:translateY(332px)"],[3.7,"transform:translateY(332px)"],
  [3.8,"transform:translateY(180px)"],[3.9,"transform:translateY(65px)"],
  [4,"transform:none"],[5.5,"transform:none"],
  [5.6,"transform:translate(-14px,-97px) scale(1.12)"],[5.7,"transform:translate(-25px,-215px) scale(1.3)"],[19,"transform:translate(-25px,-215px) scale(1.3)"]])}
${timeline("sE", [[0,"opacity:0"],[5.4,"opacity:0"],[5.5,"opacity:.12"],[5.6,"opacity:.72"],[5.7,"opacity:1"],[7.8,"opacity:1"],[7.9,"opacity:0"],[19,"opacity:0"]])}
${timeline("manageView", [[0,"transform:none"],[5.5,"transform:none"],
  [5.6,"transform:translate(calc(-3px * var(--direction)),-48px) scale(1.07)"],
  [5.7,"transform:translate(calc(-26px * var(--direction)),-186px) scale(1.25)"],
  [5.8,"transform:translate(calc(-35px * var(--direction)),-212px) scale(1.3)"],
  [7.5,"transform:translate(calc(-35px * var(--direction)),-212px) scale(1.3)"],
  [7.6,"transform:translate(calc(-24px * var(--direction)),-196px) scale(1.23)"],
  [7.7,"transform:translate(calc(-10px * var(--direction)),-142px) scale(1.14)"],[7.8,"transform:none"],[19,"transform:none"]])}
${timeline("tapRipple", [[0,"background:transparent"],[7.7,"background:#EDEDED"],[7.9,"background:transparent"],[19,"background:transparent"]])}
${timeline("flash", [[0,"opacity:0"],[7.9,"opacity:1"],[8,"opacity:0"],[19,"opacity:0"]])}
${timeline("sF", [[0,"opacity:0;transform:scale(1)"],[7.999,"opacity:0;transform:scale(1)"],[8,"opacity:1;transform:scale(1)"],
  [9.7,"opacity:1;transform:scale(1)"],[9.8,"opacity:.5;transform:scale(.98)"],[9.9,"opacity:0;transform:scale(.97)"],[19,"opacity:0"]])}
${timeline("reviewContent", [[0,"opacity:0"],[8.2,"opacity:0"],[8.3,"opacity:.55"],[8.4,"opacity:1"],[19,"opacity:1"]])}
${timeline("sG", [[0,"opacity:0;transform:scale(1.05)"],[9.7,"opacity:0;transform:scale(1.05)"],[9.8,"opacity:.25;transform:scale(1.05)"],
  [9.9,"opacity:1;transform:scale(1.03)"],[10,"opacity:1;transform:scale(1)"],[19,"opacity:1;transform:scale(1)"]])}
${timeline("starEmpty", [[0,"opacity:1"],[9.6,"opacity:0"],[9.7,"opacity:1"],[19,"opacity:1"]])}
${timeline("starFull", [[0,"opacity:0"],[9.6,"opacity:1"],[9.7,"opacity:0"],[19,"opacity:0"]])}
`;

const JS = `
(function(){
  var TEXT="__REVIEW__",DUR=19;
  var TRANSITIONS=__TRANSITIONS__,timings={},segments=[],sourceFrames=[];
  function remap(t,inverse){
    var shift=0;
    for(var i=0;i<segments.length;i++){
      var s=segments[i];
      var start=inverse?s.at:s.start,end=inverse?s.until:s.end;
      var targetStart=inverse?s.start:s.at,targetEnd=inverse?s.end:s.until;
      if(t<start)return t+shift;
      if(t<=end)return targetStart+(t-start)/(end-start)*(targetEnd-targetStart);
      shift=targetEnd-end;
    }
    return t+shift;
  }
  function setTimings(values){
    var wasPlaying=!paused;
    var at=remap(paused?position:normalize((document.timeline.currentTime-epoch)/1000),true);
    timings={};var shift=0;
    segments=TRANSITIONS.map(function(s){
      var value=values&&values[s.key];
      var duration=typeof value==='number'&&Number.isFinite(value)?Math.min(30,Math.max(.05,value)):s.defaultDuration;
      timings[s.key]=Math.round(duration*1000000)/1000000;
      var segment={key:s.key,start:s.start,end:s.end,at:s.start+shift,until:s.start+shift+duration};
      shift+=duration-(s.end-s.start);return segment;
    });
    DUR=19+shift;
    animations.forEach(function(a,i){
      a.effect.setKeyframes(sourceFrames[i].map(function(frame){
        var copy=Object.assign({},frame);delete copy.computedOffset;
        copy.offset=Math.max(0,Math.min(1,remap(frame.computedOffset*19,false)/DUR));
        return copy;
      }));
      a.effect.updateTiming({duration:DUR*1000});
    });
    seek(remap(at,false));if(wasPlaying)play();
  }
  var units=typeof Intl.Segmenter==='function'
    ? Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(TEXT),function(s){return s.segment;})
    : Array.from(TEXT);
  var lengths=[0],clipped=[];
  for(var j=0;j<units.length;j++){
    var length=lengths[lengths.length-1]+Array.from(units[j]).length;
    if(length>500)break;
    clipped.push(units[j]);lengths.push(length);
  }
  units=clipped;
  /* First visible frame of each of the 20 characters in the recording. Pauses are real. */
  var KEYS=[12.2,12.4,12.6,12.9,13.0,13.2,13.3,13.4,13.5,13.6,13.7,14.0,14.2,14.3,14.4,14.5,14.8,15.6,15.8,16.1];
  var typed=document.querySelector('.cp-typed'),input=document.querySelector('.cp-input');
  var caret=document.querySelector('.caret'),count=document.querySelector('.cp-n');
  var field=document.querySelector('.cp-field'),ph=document.querySelector('.cp-ph'),post=document.querySelector('.cp-post');
  var animations=[],epoch=0,paused=true,position=0,raf=0;
  function fit(){document.documentElement.style.setProperty('--s',Math.min(innerWidth/426,innerHeight/240));}
  fit();addEventListener('resize',fit);
  function normalize(t){return ((t%DUR)+DUR)%DUR;}
  function draw(t){
    var progress=-1;
    for(var i=0;i<KEYS.length;i++){
      if(t+1e-6>=KEYS[i]){
        progress=i;
        if(i<KEYS.length-1)progress+=Math.min(1,(t-KEYS[i])/(KEYS[i+1]-KEYS[i]));
      }
    }
    var n=progress<0?0:Math.min(units.length,1+Math.floor(progress*(units.length-1)/(KEYS.length-1)+1e-6));
    var text=units.slice(0,n).join('');
    if(typed.textContent!==text){
      typed.textContent=text;count.textContent=String(lengths[n]);
      input.scrollLeft=document.documentElement.dir==='rtl'?-input.scrollWidth:input.scrollWidth;
    }
    var focused=t+1e-7>=10.9;
    field.classList.toggle('focused',focused);
    ph.style.visibility=text?'hidden':'visible';
    caret.style.visibility=focused&&(Math.floor((t-10.9+1e-7)*2)%2===0)?'visible':'hidden';
    post.style.color=text&&t<17.4?'var(--accent)':'#A7A7A7';
  }
  function tick(){
    if(paused)return;
    position=normalize((document.timeline.currentTime-epoch)/1000);draw(remap(position,true));
    raf=requestAnimationFrame(tick);
  }
  function seek(t){
    if(!Number.isFinite(t))return;
    paused=true;cancelAnimationFrame(raf);position=normalize(t);
    animations.forEach(function(a){a.pause();a.currentTime=position*1000;});draw(remap(position,true));
  }
  function play(){
    if(!paused)return;
    paused=false;epoch=document.timeline.currentTime-position*1000;
    animations.forEach(function(a){a.play();a.startTime=epoch;});tick();
  }
  function pause(){seek(paused?position:(document.timeline.currentTime-epoch)/1000);}
  /* Capture/export tools use this exact renderer, including caret, text and CSS. */
  function getState(){
    var time=paused?position:normalize((document.timeline.currentTime-epoch)/1000);
    return {time:time,sourceTime:remap(time,true),duration:DUR,playing:!paused,
      timings:Object.assign({},timings),segments:segments.map(function(s){return Object.assign({},s);})};
  }
  window.reviewTutorial={get duration(){return DUR;},seek:seek,play:play,pause:pause,setTimings:setTimings,getState:getState};
  var initial=/[#&]t=([0-9.]+)/.exec(location.hash||'');
  window.reviewTutorialReady=Promise.all([
    document.fonts.ready,
    Promise.all(Array.from(document.images).filter(function(im){return im.src.indexOf('data:')===0;}).map(function(im){return im.decode().catch(function(){});})),
  ]).then(function(){
    animations=document.getAnimations();
    sourceFrames=animations.map(function(a){return a.effect.getKeyframes();});
    /* Keep longer translations inside the measured notice area. */
    var notice=document.querySelector('.cp-notice'),size=10;
    while(notice.scrollHeight>notice.clientHeight&&size>8){size-=.25;notice.style.fontSize=size+'px';notice.style.lineHeight=(size*1.4)+'px';}
    setTimings(JSON.parse(document.getElementById('tutorial-timings').textContent));
    seek(initial?parseFloat(initial[1]):0);
    if(!initial)play();
  });
})();
`;
