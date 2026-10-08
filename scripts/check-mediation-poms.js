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
        const row = {key, android: "—", pomSdk: "—", extra: "—", ios: "—", podSdk: "—", result: "ok"};
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
        }
        rows.push(row);
    }

    console.log("| rede | adapter Android | SDK no POM do adapter | extraArtifacts do catálogo | pod iOS | SDK no podspec | resultado |");
    console.log("|---|---|---|---|---|---|---|");
    for (const r of rows) console.log(`| ${r.key} | ${r.android} | ${r.pomSdk} | ${r.extra} | ${r.ios} | ${r.podSdk} | ${r.result} |`);
    console.log(failed ? "\nHOUVE FALHA" : "\nTODAS AS REDES LEVAM O SDK");
    process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
