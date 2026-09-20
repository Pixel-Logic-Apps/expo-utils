/**
 * Tutorial "como avaliar o app na Play Store", em HTML/CSS/JS.
 *
 * Substitui o GIF gravado de tela (426x240, 19 s, 10 fps). Toda a animação é CSS: uma única
 * animação mestre de 19 s compartilhada por todos os elementos, então nada sai de sincronia.
 * O JS cuida apenas dos dois textos que mudam de valor (texto digitado e contador n/500) e
 * do fator de escala do canvas.
 *
 * Arquitetura em 3 camadas (a gravação original prova que é assim):
 *   1. .phone   - as 7 telas, em fluxo normal, autoradas a 426px de largura (~426dp)
 *   2. .camera  - um transform por cena. TODO movimento "grande" do original e camera;
 *                 nao existe scroll em nenhum momento dos 19 s
 *   3. .annot   - seta e retangulo vermelhos, FORA da camera, em coordenadas do canvas
 *
 * Autorado no mesmo sistema de coordenadas da fonte: canvas de 426x240.
 */

import {getPlayLabels, PlayLabels} from "./labels";

export interface ReviewTutorialParams {
    /** Nome do app, como aparece na lista e no header do composer. */
    appName: string;
    /** URL https do ícone do app. Sem isso, cai num círculo com a inicial. */
    appIconUrl?: string;
    /** Nome exibido do usuário no composer. */
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
}

const RTL_LOCALES = ["ar", "he", "fa", "ur", "iw"];

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
        : '<svg class="st" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path d="' + path + '" fill="none" stroke="#9AA0A6" stroke-width="1.6"/></svg>';
}

function starRow(count: number, size: number, gap: number): string {
    let out = '<div class="stars" style="gap:' + gap + 'px">';
    for (let i = 0; i < 5; i++) out += star(i < count, size);
    return out + "</div>";
}

/** Ícone Material outline, monocromático, recolorido por currentColor. */
function icon(name: string, size: number): string {
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
function playLogo(size: number): string {
    return (
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<path fill="#00D0FF" d="M3.6 1.8c-.4.3-.6.8-.6 1.4v17.6c0 .6.2 1.1.6 1.4l.1.1L13.8 12v-.2L3.7 1.8z"/>' +
        '<path fill="#FFCE00" d="M17.2 15.4l-3.4-3.4v-.2l3.4-3.4.1.1 4 2.3c1.2.7 1.2 1.8 0 2.4l-4.1 2.2z"/>' +
        '<path fill="#FF3A44" d="M17.3 15.3 13.8 12 3.6 22.2c.4.4 1 .5 1.7.1l12-6.9z"/>' +
        '<path fill="#00E676" d="M17.3 8.7 5.3 1.8c-.7-.4-1.3-.3-1.7.1L13.8 12z"/>' +
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
        '<div class="mrow"' + (k ? ' data-k="' + k + '"' : "") + '>' + icon(iconName, 22) +
        '<span class="mlabel">' + esc(label) + "</span>" +
        (badge ? '<span class="mbadge">' + esc(badge) + "</span>" : "") +
        "</div>"
    );
}

function statusBar(clock: string): string {
    return (
        '<div class="sbar"><span class="clock">' + esc(clock) + "</span>" +
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
    const userName = params.userName || "";
    const initial = params.userInitial || firstGrapheme(userName || appName);
    const avatar = params.avatarColor || hashColor(userName || appName);
    const clock = params.clock || localClock();
    const email = params.userEmail || "";
    const accent = params.accent || "#0B57D0";
    const review = params.reviewText || L.sampleReview;
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
        '<section class="scr launcher">' + launcherGrid(L) + "</section>" +

        /* B - splash da Play */
        '<section class="scr splash">' + playLogo(58) + "</section>" +

        /* C - home da Play Store */
        '<section class="scr playhome">' + statusBar(clock) +
        '<div class="ph-top"><div class="ph-search">' +
        '<span class="ph-bell">' + icon("bell", 30) + '<i class="dot">1</i></span>' +
        '<span data-k="avatar" class="ph-avatar"></span>' +
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
        esc(initial) + '</span><span class="sh-mail">' + esc(email) + "</span>" +
        '<span class="sh-caret">' + icon("chevron", 16) + "</span></div>" +
        '<div class="sh-pill">' + esc(L.manageAccount) + "</div>" +
        '<div class="sh-menu">' +
        menuRow("apps", L.manageAppsDevices, undefined, "manage") +
        menuRow("bell", L.notificationsOffers, "1") +
        menuRow("card", L.paymentsSubscriptions) +
        menuRow("shield", L.playProtect) +
        menuRow("stars", L.playPoints) +
        menuRow("folder", L.library) +
        "</div></div></section>" +

        /* E - gerenciar apps e dispositivos */
        '<section class="scr manage">' + statusBar(clock) +
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
        "</section>" +

        /* F - tela Avaliacoes */
        '<section class="scr reviews">' + statusBar(clock) +
        '<div class="rv-top">' + icon("back", 22) + "<h1>" + esc(L.reviewsTitle) + "</h1></div>" +
        '<div class="rv-tabs"><span class="on">' + esc(L.tabNotRated) + "</span><span>" +
        esc(L.tabPosted) + "</span></div>" +
        '<div class="rv-item">' + appIcon(params.appIconUrl, appName, 44, 10) +
        '<div class="rv-body"><div class="rv-name">' + esc(appName) + "</div>" +
        '<div class="rv-sub">' + esc(subtitle) + "</div></div></div>" +
        '<div class="rv-stars" data-k="rvstars">' + starRow(0, 19, 47) + starRow(5, 19, 47) + "</div>" +
        '<div class="rv-feedback">' + esc(L.sendFeedback) + "</div></section>" +

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
        '<div class="cp-stars">' + starRow(5, 17, 25) + "</div>" +
        '<div class="cp-field" data-k="field"><span class="cp-ph">' + esc(L.describeExperience) + "</span>" +
        '<span class="cp-typed"></span><i class="caret"></i></div>' +
        '<div class="cp-count"><span class="cp-n">0</span>/500</div>' +
        "</div></section>" +

        "</div></div>" +
        '<div class="flash"></div>' +

        /* ---------- camada 3: anotacoes, FORA da camera ---------- */
        annotations() +

        "</div></div>" +
        "<script>" + JS.replace(/__REVIEW__/g, escJs(review)) + "</script>" +
        "</body></html>"
    );
}

/** Ícones do launcher: aproximações simples, só o alvo (Play Store) carrega significado. */
const LAUNCHER_ART: Record<string, string> = {
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

function launcherGrid(L: PlayLabels): string {
    const cells: Array<[string, string]> = [
        ["photos", "Fotos"],
        ["gmail", "Gmail"],
        ["google", "Google"],
        ["maps", "Maps"],
        ["messages", "Mensagens"],
        ["play", L.playStore],
        ["clock", "Relógio"],
        ["security", "Segurança"],
        ["phone", "Telefone"],
        ["files", "Arquivos"],
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
    [302, 45, 112, 45, 18, 30, 2.6, 3.8],    /* A2 avatar do perfil */
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

const pct = (t: number) => ((t / TOTAL) * 100).toFixed(3);

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
        out.push("@keyframes rct" + n + "{" + rect.join("") + "}");
        out.push("@keyframes arw" + n + "{" + arrow.join("") + "}");
    });
    return out.join("\n");
}

/** Sete anotacoes estaticas/** Sete anotacoes estaticas; cada uma acende no seu intervalo com corte seco (step-end). */
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

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
html,body{width:100%;height:100%;overflow:hidden;background:#FDFDFD}
body{font-family:Roboto,'Google Sans','Helvetica Neue',system-ui,sans-serif;color:#202124}
:root{--accent:__ACCENT__;--surface:#FDFDFD;--tonal:#F8F7FC;--text:#202124;
  --text2:#5F6368;--divider:#C6C6C6;--red:#FF0000}
.fit{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.canvas{position:relative;width:426px;height:240px;overflow:hidden;background:var(--surface);
  transform:scale(var(--s,1));transform-origin:center;flex:none}
.camera{position:absolute;inset:0;transform-origin:0 0;animation:camera 19s infinite step-end}
.phone{position:absolute;inset:0}
/* telas autoradas direto no espaco do canvas (426x240) */
.scr{position:absolute;inset:0;opacity:0;background:var(--surface);overflow:hidden}
.launcher{animation:sA 19s infinite linear;transform-origin:177px 134px}
.splash{animation:sB 19s infinite linear;transform-origin:177px 134px}
.playhome{animation:sC 19s infinite linear}
.sheet{animation:sD 19s infinite linear}
.manage{animation:sE 19s infinite linear}
.reviews{animation:sF 19s infinite linear}
.composer{animation:sG 19s infinite linear}
.splash svg{animation:splashLogo 19s infinite linear}
/* clarao branco do corte em 7,9 s (frame f079 e branco puro) */
.flash{position:absolute;inset:0;background:#FFF;opacity:0;pointer-events:none;
  animation:flash 19s infinite step-end}

.sbar{display:flex;align-items:center;justify-content:space-between;height:24px;
  padding:0 12px;color:var(--text);font-size:11px}
.clock{font-weight:500}
.sicons{display:flex;align-items:center;gap:3px}

/* ---------- A launcher (ref f005) ---------- */
.launcher{background:#D8D7DE}
.lg{display:grid;grid-template-columns:repeat(4,1fr);padding:19px 62px 0;row-gap:31px}
.lg-cell{display:flex;flex-direction:column;align-items:center;gap:14px}
.lg-icon{width:40px;height:40px;border-radius:50%;background:#FFF;display:flex;
  align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,.16)}
.lg-label{font-size:10px;color:#1F1F1F;letter-spacing:.1px;line-height:10px}

/* ---------- B splash (ref f020) ---------- */
.splash{display:flex;align-items:center;justify-content:center;background:#FFF}

/* ---------- C play home (ref f032) ---------- */
.playhome .sbar{justify-content:flex-end}
.playhome .clock{display:none}
.ph-top{padding:24px 46px 0 14px}
.ph-search{display:flex;align-items:center;gap:20px;height:40px;justify-content:flex-end}
.ph-hint{display:none}
.ph-bell{position:relative;color:var(--text2);display:flex}
.dot{position:absolute;top:-2px;right:-3px;background:#D93025;color:#FFF;font-size:9px;
  font-style:normal;width:15px;height:15px;border-radius:50%;display:flex;
  align-items:center;justify-content:center}
.ph-avatar{width:40px;height:40px;border-radius:50%;background:#E4E4E6;flex:none}
.ph-tabs{display:flex;gap:60px;padding:39px 0 0;margin-left:-106px;font-size:18px;
  color:var(--text2);white-space:nowrap}
.ph-tabs .on{color:var(--accent);font-weight:500}
.ph-banner{position:absolute;left:0;right:0;top:168px;bottom:0;overflow:hidden;
  background:#6AABDB}
.ph-banner i{position:absolute;left:-6%;width:112%;height:19px;display:block;filter:blur(7px)}
.ph-banner i:nth-child(1){top:-2px;background:linear-gradient(90deg,#5EA9DC,#60A9DC,#65AADA,#67AADA,#68ABDB,#6CACDC,#6CACDC,#6AACDC)}
.ph-banner i:nth-child(2){top:16px;background:linear-gradient(90deg,#5AA8DC,#67A6D5,#5D9ECD,#6FA7CF,#689997,#69ACDD,#8385A6,#769BCA)}
.ph-banner i:nth-child(3){top:34px;background:linear-gradient(90deg,#6AA0B8,#A6A3C0,#7B9AC0,#A5918C,#6E7F37,#7391B3,#987F89,#8D86AE)}
.ph-banner i:nth-child(4){top:52px;height:26px;background:linear-gradient(90deg,#AD9A5D,#BB97A4,#8D8090,#A88945,#848448,#80838A,#9B7F95,#957B97)}

/* ---------- D bottom sheet (ref f045) ---------- */
.sheet{background:linear-gradient(90deg,rgba(0,0,0,.62) 0,rgba(0,0,0,.05) 62px,
  rgba(0,0,0,.05) calc(100% - 62px),rgba(0,0,0,.62) 100%)}
.sh-card{position:absolute;left:82px;right:58px;top:-72px;bottom:-40px;
  box-shadow:0 0 9px 4px rgba(0,0,0,.82);
  background:#F8F4FC;border-radius:26px 26px 0 0;padding-top:16px;
  animation:sheetUp 19s infinite}
.sh-word{text-align:center;font-size:22px;font-weight:500;letter-spacing:-.5px;
  margin-bottom:14px}
.sh-word b{font-weight:500}
.sh-acct{display:flex;align-items:center;gap:12px;padding:0 20px 16px}
.sh-mail{flex:1;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.sh-caret{color:var(--text2);display:flex;transform:rotate(90deg)}
.sh-pill{margin:0 auto 16px;width:max-content;max-width:88%;border:1px solid #B6B5B4;
  border-radius:16px;padding:6px 14px;font-size:12px;color:var(--text)}
.sh-menu{background:transparent;padding:0}
.mrow{display:flex;align-items:center;gap:13px;height:38px;padding:0 20px 0 23px;
  color:var(--text2)}
.mlabel{flex:1;font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.mbadge{font-size:11px;color:var(--text2)}

/* ---------- E gerenciar apps (ref f078; a camera aproxima em 5,8-7,5 s) ---------- */
.manage .sbar{display:none}
.mg-actions{display:flex;gap:30px;padding:18px 0 0 100px;font-size:13px;
  color:var(--accent);font-weight:500}
.mg-row{display:flex;align-items:flex-start;gap:18px;padding:22px 24px 0 46px;
  color:var(--text2)}
.mg-row.tap{padding-top:14px;padding-bottom:14px;margin-top:8px;
  animation:tapRipple 19s infinite step-end}
@keyframes tapRipple{0%{background:transparent}40%{background:#EDEDED}
  41.579%{background:transparent}100%{background:transparent}}
.mg-body{flex:1;min-width:0}
.mg-title{font-size:15px;color:var(--text)}
.mg-title.one{white-space:nowrap;overflow:hidden;text-overflow:clip}
.mg-sub{font-size:12px;color:var(--text2);margin-top:3px}
.mg-bar{margin-top:9px;height:4px;border-radius:2px;background:#DADCE0;overflow:hidden;
  margin-right:30px}
.mg-bar i{display:block;height:100%;width:45%;background:var(--accent)}

/* ---------- F avaliacoes (ref f090) ---------- */
.rv-top{display:flex;align-items:center;gap:18px;padding:10px 18px 0 25px;color:var(--text)}
.rv-top h1{font-size:19px;font-weight:400}
.rv-tabs{display:flex;gap:26px;padding:15px 18px 0 66px;font-size:12px;color:var(--text2);
  border-bottom:1px solid #E8EAED}
.rv-tabs .on{color:var(--accent);font-weight:500;box-shadow:inset 0 -3px 0 var(--accent);
  padding-bottom:8px}
.rv-item{display:flex;align-items:center;gap:12px;padding:28px 18px 0 60px}
.rv-body{flex:1;min-width:0}
.rv-name{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv-sub{font-size:10px;color:var(--text2);margin-top:3px;white-space:nowrap;overflow:hidden;
  text-overflow:clip}
.rv-stars{position:relative;height:42px;margin-top:3px}
.rv-stars .stars{position:absolute;left:71px;top:0}
.rv-stars .stars:nth-child(1){animation:starEmpty 19s infinite step-end}
.rv-stars .stars:nth-child(2){opacity:0;animation:starFull 19s infinite step-end}
.rv-feedback{padding:24px 18px 0 69px;font-size:11px;color:var(--accent)}

/* ---------- G composer (ref f110) — grade vertical medida no frame ---------- */
.composer{background:#FAFAFA}
.cp-card{position:absolute;left:78px;right:78px;top:0;bottom:0;background:#FFF}
.composer .sbar{height:14px;font-size:9px;padding:0 8px}
.cp-head{display:flex;align-items:center;gap:8px;padding:10px 6px 5px;
  border-bottom:1px solid var(--divider);color:var(--text2)}
.cp-headbody{flex:1;min-width:0;margin-right:22px}
.cp-name{font-size:11px;line-height:11px;color:var(--text);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.cp-sub{font-size:9px;line-height:9px;color:var(--text2);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;margin-top:3px}
.cp-post{font-size:10px;font-weight:500;color:#A7A7A7;padding-right:2px;
  animation:postOn 19s infinite step-end}
.cp-user{display:flex;align-items:center;gap:12px;padding:12px 10px 0 4px}
.cp-avatar{width:29px;height:29px;border-radius:50%;color:#FFF;font-size:14px;
  display:flex;align-items:center;justify-content:center;flex:none}
.cp-uname{font-size:9px;line-height:9px}
.cp-notice{margin-top:2px;padding:0 36px 0 45px;font-size:11px;line-height:14px;
  color:#3C4043}
.cp-more{text-decoration:underline;color:var(--text2)}
.cp-stars{padding:4px 10px 0 42px}
.cp-field{position:relative;margin:0 10px;border:1px solid var(--accent);
  border-radius:4px;padding:9px 10px;height:60px;font-size:10px;color:var(--text)}
.cp-ph{color:var(--text2);animation:phOff 19s infinite step-end}
.cp-typed{position:absolute;left:10px;top:9px}
.caret{position:absolute;width:1.5px;height:12px;background:var(--accent);left:10px;top:9px;
  animation:caretOn 19s infinite step-end,blink 1s infinite step-end}
.cp-count{text-align:right;padding:4px 12px 0;font-size:8px;color:var(--text2)}
.stars{display:flex;align-items:center}

/* ---------- camada 3: anotacoes (fora da camera) ---------- */
.annot{position:absolute;opacity:0;pointer-events:none}
.arect{position:absolute;inset:0;border:2px solid var(--red);border-radius:2px;
  transform-origin:center}
.achev{position:absolute;left:50%}

__ANNOT_RULES__

/* ---------- timeline mestre: 19 s, % = t/19 ---------- */
/* telas ja estao em coordenadas do canvas: a camera so atua nos zooms reais */
@keyframes camera{
  0%      {transform:none}
  7.895%  {transform:translate(-125px,-94px) scale(1.6)}
  10%     {transform:none}
  30.526% {transform:translate(-24px,-102px) scale(1.09)}
  41.053% {transform:none}
  100%    {transform:none}
}
/* A launcher -> o app "abre": zoom no icone e fade (1,5-1,9 s) */
@keyframes sA{
  0%{opacity:1;transform:scale(1)}
  7.632%{opacity:1;transform:scale(1);animation-timing-function:cubic-bezier(.4,0,.8,.3)}
  10%{opacity:0;transform:scale(2.6)}
  10.01%{opacity:0;transform:scale(1)}
  100%{opacity:0;transform:scale(1)}
}
/* B splash: a janela branca cresce a partir do icone e o logo assenta */
@keyframes sB{
  0%{opacity:0;clip-path:circle(0% at 177px 134px)}
  7.894%{opacity:0;clip-path:circle(0% at 177px 134px)}
  7.895%{opacity:1;clip-path:circle(0% at 177px 134px);
    animation-timing-function:cubic-bezier(.05,.7,.1,1)}
  9.474%{opacity:1;clip-path:circle(130% at 177px 134px)}
  12.632%{opacity:1;clip-path:circle(130% at 177px 134px)}
  13.684%{opacity:0;clip-path:circle(130% at 177px 134px)}
  100%{opacity:0;clip-path:circle(0% at 177px 134px)}
}
@keyframes splashLogo{
  0%,7.895%{opacity:1;transform:scale(2) translateY(-42px);
    animation-timing-function:cubic-bezier(.2,.7,.3,1)}
  9.474%{opacity:1;transform:scale(.62) translateY(0)}
  10.526%{opacity:1;transform:scale(1) translateY(0)}
  11.053%{opacity:1;transform:scale(1) translateY(0)}
  12.632%{opacity:0;transform:scale(1) translateY(0)}
  100%{opacity:0;transform:scale(1) translateY(0)}
}
/* C home da Play: fade de entrada; fica por baixo da sheet ate o cross-dissolve */
@keyframes sC{
  0%{opacity:0}
  13.158%{opacity:0}
  13.684%{opacity:1}
  28.947%{opacity:1}
  30.526%{opacity:0}
  100%{opacity:0}
}
/* D bottom sheet: scrim em fade e card deslizando de baixo (3,7-4,0 s) */
@keyframes sD{
  0%{opacity:0}
  19.473%{opacity:0}
  19.474%{opacity:1}
  28.947%{opacity:1}
  30.526%{opacity:0}
  100%{opacity:0}
}
@keyframes sheetUp{
  0%{transform:translateY(300px)}
  19.474%{transform:translateY(300px);animation-timing-function:cubic-bezier(.25,.5,.35,1)}
  21.316%{transform:translateY(0)}
  100%{transform:translateY(0)}
}
/* E gerenciar apps: cross-dissolve com a sheet (5,5-5,8 s) — f056 mostra as duas */
@keyframes sE{
  0%{opacity:0}
  28.947%{opacity:0}
  30.526%{opacity:1}
  41.316%{opacity:1}
  41.842%{opacity:0}
  100%{opacity:0}
}
/* clarao branco do corte (7,85-8,0 s) */
@keyframes flash{
  0%{opacity:0}
  41.316%{opacity:1}
  42.105%{opacity:0}
  100%{opacity:0}
}
/* F avaliacoes: entra com escala 0,93 -> 1 */
@keyframes sF{
  0%{opacity:0;transform:scale(.93)}
  41.841%{opacity:0;transform:scale(.93)}
  43.158%{opacity:1;transform:scale(1)}
  50.526%{opacity:1;transform:scale(1)}
  51.579%{opacity:0;transform:scale(1)}
  100%{opacity:0;transform:scale(.93)}
}
/* G composer: cross-dissolve com assentamento de escala (9,8-10,1 s) */
@keyframes sG{
  0%{opacity:0;transform:scale(.97)}
  50.526%{opacity:0;transform:scale(.97)}
  51.579%{opacity:1;transform:scale(.985)}
  53.158%{opacity:1;transform:scale(1)}
  100%{opacity:1;transform:scale(1)}
}

/* estrelas da lista: as 5 preenchem num unico frame (9,6 s) e revertem no seguinte */
@keyframes starEmpty{0%{opacity:1}50.526%{opacity:0}51.053%{opacity:1}100%{opacity:1}}
@keyframes starFull{0%{opacity:0}50.526%{opacity:1}51.053%{opacity:0}100%{opacity:0}}

/* caret pisca desde f109 (10,9 s); Postar habilita em f122 (12,2 s) */
@keyframes caretOn{0%{opacity:0}57.368%{opacity:1}100%{opacity:1}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
/* medido nos frames: cinza ate 12,2 s, azul de 12,2 a 17,4 s, cinza de novo
   a partir de 17,4 s (o botao desabilita depois do envio) */
@keyframes postOn{
  0%{color:#A7A7A7}
  64.211%{color:var(--accent)}
  91.316%{color:var(--accent)}
  91.579%{color:#A7A7A7}
  100%{color:#A7A7A7}
}
@keyframes phOff{0%{opacity:1}64.211%{opacity:0}100%{opacity:0}}

/* anotacoes: corte seco na entrada e na saida */
@keyframes an1{0%{opacity:1}7.895%{opacity:0}100%{opacity:0}}
@keyframes an2{0%{opacity:0}13.684%{opacity:1}20%{opacity:0}100%{opacity:0}}
@keyframes an3{0%{opacity:0}21.053%{opacity:1}28.947%{opacity:0}100%{opacity:0}}
@keyframes an4{0%{opacity:0}30.526%{opacity:1}40%{opacity:0}100%{opacity:0}}
@keyframes an5{0%{opacity:0}45.789%{opacity:1}50.526%{opacity:0}100%{opacity:0}}
@keyframes an6{0%{opacity:0}56.842%{opacity:1}64.737%{opacity:0}100%{opacity:0}}
@keyframes an7{0%{opacity:0}85.789%{opacity:1}95.263%{opacity:0}100%{opacity:0}}
`;

/* JS mínimo: escala do canvas + os dois textos que mudam de valor. */
const JS = `
(function(){
  var TEXT="__REVIEW__";
  var START=12.2,END=16.2,DUR=19;
  function fit(){
    var s=Math.min(window.innerWidth/426,window.innerHeight/240);
    document.documentElement.style.setProperty('--s',s);
  }
  fit();window.addEventListener('resize',fit);
  var typed=document.querySelector('.cp-typed');
  var caret=document.querySelector('.caret');
  var count=document.querySelector('.cp-n');
  var t0=performance.now();
  /* QA: #t=12.5 congela a pagina nesse instante (comparacao frame a frame) */
  var FREEZE=null;
  var m=/[#&]t=([0-9.]+)/.exec(location.hash||'');
  if(m){
    FREEZE=parseFloat(m[1]);
    var st=document.createElement('style');
    st.textContent='*{animation-delay:-'+FREEZE+'s !important;animation-play-state:paused !important}';
    document.head.appendChild(st);
  }
  /* pausas medidas na fonte: a digitacao nao e uniforme */
  var HOLD=[[13.8,14.0],[14.8,15.4]];
  function held(t){
    var extra=0;
    for(var i=0;i<HOLD.length;i++){
      if(t>HOLD[i][1])extra+=HOLD[i][1]-HOLD[i][0];
      else if(t>HOLD[i][0])extra+=t-HOLD[i][0];
    }
    return extra;
  }
  function tick(){
    var t=FREEZE!==null?FREEZE:((performance.now()-t0)/1000)%DUR;
    var n=0;
    if(t>=START){
      var tc=Math.min(t,END);
      var eff=tc-START-held(tc);
      n=Math.max(0,Math.min(TEXT.length,Math.round(eff/((END-START-held(END))/TEXT.length))));
    }
    var s=TEXT.slice(0,n);
    if(typed.textContent!==s){
      typed.textContent=s;
      count.textContent=String(n);
      caret.style.left=(12+typed.offsetWidth)+'px';
    }
  }
  setInterval(tick,100);tick();
})();
`;
