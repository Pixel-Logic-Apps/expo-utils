#!/usr/bin/env node
/**
 * Confere, na fonte, se cada rede do catálogo de mediação (data/mediation_adapters.json) leva o SDK
 * da rede para o app — não só o adapter:
 *
 *   Android  POM do adapter no Google Maven. Sem dependência de SDK no POM (caso da Unity: "This
 *            build does not contain the UnityAds SDK"), o catálogo PRECISA acrescentar o SDK em
 *            `android.extraArtifacts` — e o script confere que esse artefato existe no Maven Central,
 *            no Google Maven ou no repositório da rede (`mavenRepo`).
 *   iOS      podspec do pod no CocoaPods trunk (CDN): o SDK tem que vir como dependência do pod.
 *   GMA      para cada linha do RNGMA (RNGMA_LINES), a versão do pod que o plugin escolhe para ela (a do
 *            `compat` do catálogo, se houver, senão a principal) tem que aceitar o Google-Mobile-Ads-SDK que
 *            aquele RNGMA pina — senão o `pod install` do app quebra (caso do Pangle 8.2.0.7+ com o 13.5.0).
 *            O play-services-ads do POM sai só como informação: o Gradle sobe para o maior sem falhar.
 *
 * Uso (precisa de rede; NÃO roda no tests/run.sh):
 *   node scripts/check-mediation-poms.js
 * Sai com código 1 se alguma rede ficar sem SDK. Rodar ao subir versão de adapter/pod ou ao adicionar
 * rede, e copiar o resultado para a tabela SDK_IN_ADAPTER_POM de tests/mediation-catalog.test.ts.
 */
const crypto = require("crypto");
const path = require("path");

const CATALOG = require(path.join(__dirname, "..", "data", "mediation_adapters.json"));
const GOOGLE_MAVEN = "https://dl.google.com/dl/android/maven2";
const MAVEN_CENTRAL = "https://repo1.maven.org/maven2";
// Dependências de infraestrutura que todo adapter declara — o que sobra é o SDK da rede.
const NOT_A_NETWORK_SDK = /^(androidx\.|com\.google\.android\.gms$|com\.google\.ads\.mediation$|org\.jetbrains\.kotlinx?$|com\.google\.android\.material$)/;
// GMA que cada linha do RNGMA pina (`sdkVersions` do react-native-google-mobile-ads no npm). As versões
// principais do catálogo são as do RNGMA 17.4.0; o `compat` cobre as linhas mais antigas.
const RNGMA_LINES = [
    {label: "RNGMA 17.4", major: 17, ios: "13.10.0", android: "25.5.0"},
    {label: "RNGMA 16.x", major: 16, ios: "13.5.0", android: "25.4.0"},
];

const compareVersions = (a, b) => {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff) return diff;
    }
    return 0;
};

// Restrição do CocoaPods ("~> 13.3", ">= 13.0", "13.5.0"…); várias = todas valem.
const satisfiesPodRequirement = (version, requirement) =>
    [].concat(requirement || []).every((req) => {
        const match = String(req).trim().match(/^(~>|>=|<=|>|<|=)?\s*([\d.]+)$/);
        if (!match) return true;
        const [, op = "=", target] = match;
        const c = compareVersions(version, target);
        if (op === "~>") {
            const parts = target.split(".");
            const upper = parts.length > 1 ? [...parts.slice(0, -2), Number(parts[parts.length - 2]) + 1].join(".") : String(Number(parts[0]) + 1);
            return c >= 0 && compareVersions(version, upper) < 0;
        }
        return {">=": c >= 0, "<=": c <= 0, ">": c > 0, "<": c < 0, "=": c === 0}[op];
    });

// Versões que o plugin escolhe para um app daquela major do RNGMA (mesma regra do resolveMediationNetworks).
const versionsFor = (network, rngmaMajor) => {
    const compat = (network.compat || []).find((entry) => rngmaMajor <= entry.maxRngmaMajor);
    return {
        android: (compat && compat.android) || network.android?.version,
        ios: (compat && compat.ios) || network.ios?.version,
    };
};

const get = async (url) => {
    const response = await fetch(url, {signal: AbortSignal.timeout(20000), redirect: "follow"});
    return {status: response.status, body: response.ok ? await response.text() : ""};
};

const artifactPath = (coordinate, version, extension) => {
    const [group, name] = coordinate.split(":");
    return `${group.replace(/\./g, "/")}/${name}/${version}/${name}-${version}.${extension}`;
};

const pomDependencies = (pom) =>
    [...pom.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)].map(([, block]) => {
        const tag = (name) => (block.match(new RegExp(`<${name}>([^<]*)</${name}>`)) || [])[1];
        return {group: tag("groupId"), name: tag("artifactId"), version: tag("version"), scope: tag("scope")};
    });

// Onde o artefato extra existe (Maven Central, Google Maven ou o repositório da rede).
const findArtifact = async (coordinate, version, mavenRepo) => {
    for (const [label, base] of [["Maven Central", MAVEN_CENTRAL], ["Google Maven", GOOGLE_MAVEN], ...(mavenRepo ? [["mavenRepo", mavenRepo]] : [])]) {
        const {status} = await get(`${base.replace(/\/$/, "")}/${artifactPath(coordinate, version, "pom")}`).catch(() => ({status: 0}));
        if (status === 200) return label;
    }
    return null;
};

const podspec = async (pod, version) => {
    const hash = crypto.createHash("md5").update(pod).digest("hex");
    const {status, body} = await get(`https://cdn.cocoapods.org/Specs/${hash[0]}/${hash[1]}/${hash[2]}/${pod}/${version}/${pod}.podspec.json`);
    if (status !== 200) return {status};
    const spec = JSON.parse(body);
    const deps = {...(spec.dependencies || {})};
    for (const sub of spec.subspecs || []) Object.assign(deps, sub.dependencies || {});
    return {status, deps};
};

async function main() {
    const rows = [];
    let failed = false;
    for (const [key, network] of Object.entries(CATALOG.networks)) {
        const row = {key, android: "—", pomSdk: "—", extra: "—", ios: "—", podSdk: "—", gma: "—", result: "ok"};
        const fail = (why) => {
            row.result = `FALHA: ${why}`;
            failed = true;
        };

        const android = network.android;
        if (android) {
            row.android = `${android.artifact}:${android.version}`;
            const {status, body} = await get(`${GOOGLE_MAVEN}/${artifactPath(android.artifact, android.version, "pom")}`).catch((e) => ({status: String(e)}));
            if (status !== 200) {
                fail(`POM do adapter não baixou (HTTP ${status})`);
            } else {
                const sdks = pomDependencies(body).filter((d) => d.group && !NOT_A_NETWORK_SDK.test(d.group));
                const extras = android.extraArtifacts || [];
                row.pomSdk = sdks.length ? sdks.map((d) => `${d.group}:${d.name}:${d.version}${d.scope ? ` (${d.scope})` : ""}`).join(", ") : "NÃO declara";
                row.extra = extras.length ? extras.map((e) => `${e.artifact}:${e.version}`).join(", ") : "—";
                if (!sdks.length && !extras.length) fail("o POM não traz o SDK e o catálogo não tem extraArtifacts");
                // android.sdk é o que a task do Gradle confere no app: tem que ser o SDK que o POM ou o extraArtifacts traz
                const esperado = [].concat(android.sdk || []);
                const trazidos = [...sdks.map((d) => `${d.group}:${d.name}`), ...extras.map((e) => e.artifact)];
                if (!esperado.length) fail("sem android.sdk no catálogo (o build do app não confere o SDK)");
                else if (!esperado.some((coord) => trazidos.includes(coord))) {
                    fail(`android.sdk (${esperado.join(" ou ")}) não é o que o POM/extraArtifacts traz (${trazidos.join(", ")})`);
                }
                for (const extra of extras) {
                    if (sdks.some((d) => `${d.group}:${d.name}` === extra.artifact)) {
                        fail(`${extra.artifact} já vem no POM — tirar de extraArtifacts (duas fontes da versão)`);
                    }
                    const where = await findArtifact(extra.artifact, extra.version, android.mavenRepo);
                    if (!where) fail(`${extra.artifact}:${extra.version} não existe no Maven Central/Google Maven/mavenRepo`);
                    else row.extra += ` [${where}]`;
                }
            }
        }

        const ios = network.ios;
        if (ios) {
            row.ios = `${ios.pod} ${ios.version || "(sem versão)"}`;
            const spec = ios.version ? await podspec(ios.pod, ios.version).catch((e) => ({status: String(e)})) : {status: "sem versão pinada"};
            if (!spec.deps) {
                fail(`podspec não baixou (${spec.status})`);
            } else {
                const sdks = Object.entries(spec.deps).filter(([name]) => name !== "Google-Mobile-Ads-SDK");
                row.podSdk = sdks.length ? sdks.map(([name, req]) => `${name} ${[].concat(req).join(" ")}`.trim()).join(", ") : "NÃO declara";
                if (!sdks.length) fail("o podspec não traz o SDK da rede");
            }
            const gma = [];
            for (const line of RNGMA_LINES) {
                const version = versionsFor(network, line.major).ios;
                const lineSpec = version === ios.version ? spec : await podspec(ios.pod, version).catch((e) => ({status: String(e)}));
                if (!lineSpec.deps) {
                    fail(`podspec ${version} não baixou (${lineSpec.status})`);
                    continue;
                }
                // ios.sdkPod é o que o post_install do app confere: tem que cobrir o SDK do pod escolhido para esta linha
                const sdkPods = [].concat(ios.sdkPod || []);
                const sdkDaLinha = Object.keys(lineSpec.deps).filter((name) => name !== "Google-Mobile-Ads-SDK").map((name) => name.split("/")[0]);
                if (!sdkPods.length) fail("sem ios.sdkPod no catálogo (o pod install do app não confere o SDK)");
                else if (!sdkDaLinha.some((name) => sdkPods.includes(name))) {
                    fail(`${line.label}: ios.sdkPod (${sdkPods.join(" ou ")}) não cobre o SDK do pod ${version} (${sdkDaLinha.join(", ")})`);
                }
                const requirement = lineSpec.deps["Google-Mobile-Ads-SDK"];
                const ok = satisfiesPodRequirement(line.ios, requirement);
                gma.push(`${line.label}: ${version} (GMA ${[].concat(requirement || "?").join(" ")}) ${ok ? "ok" : "NÃO aceita o " + line.ios}`);
                if (!ok) fail(`${line.label} pina o GMA iOS ${line.ios} e o pod ${version} pede ${requirement} — ponha um compat`);
            }
            if (android) {
                for (const line of RNGMA_LINES) {
                    const version = versionsFor(network, line.major).android;
                    const pom = await get(`${GOOGLE_MAVEN}/${artifactPath(android.artifact, version, "pom")}`).catch(() => ({status: 0, body: ""}));
                    const ads = pomDependencies(pom.body).find((d) => d.name === "play-services-ads");
                    gma.push(`${line.label} Android ${version}: play-services-ads ${ads ? ads.version : "?"}${ads && compareVersions(ads.version, line.android) > 0 ? ` (sobe o ${line.android})` : ""}`);
                }
            }
            row.gma = gma.join("; ");
        }
        rows.push(row);
    }

    console.log("| rede | adapter Android | SDK no POM do adapter | extraArtifacts do catálogo | pod iOS | SDK no podspec | GMA por linha do RNGMA | resultado |");
    console.log("|---|---|---|---|---|---|---|---|");
    for (const r of rows) console.log(`| ${r.key} | ${r.android} | ${r.pomSdk} | ${r.extra} | ${r.ios} | ${r.podSdk} | ${r.gma} | ${r.result} |`);
    console.log(failed ? "\nHOUVE FALHA" : "\nTODAS AS REDES LEVAM O SDK");
    process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
