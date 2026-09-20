/** Generate the same standalone HTML used by ReviewTutorial. Run with Bun. */
import {readFileSync, writeFileSync} from "node:fs";
import {dirname, extname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {buildTutorialHtml, ReviewTutorialParams} from "./html";
import {buildTutorialEditorHtml} from "./editor";

const {values} = parseArgs({
    options: {
        project: {type: "string"},
        params: {type: "string"},
        icon: {type: "string"},
        "app-name": {type: "string"},
        locale: {type: "string"},
        output: {type: "string"},
        help: {type: "boolean"},
    },
});

if (values.help) {
    console.log("bun utils/review-tutorial/preview.ts [--project ../meu-app] [--params params.json] [--icon icon.png] [--app-name 'Meu App'] [--locale pt] [--output preview.html]");
    process.exit(0);
}

function iconUri(path: string): string {
    if (/^(https?:|data:)/i.test(path)) return path;
    const mime: Record<string, string> = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".avif": "image/avif",
    };
    const type = mime[extname(path).toLowerCase()];
    if (!type) throw new Error("Formato de ícone não suportado: " + path);
    return "data:" + type + ";base64," + readFileSync(path).toString("base64");
}

// sem userName de proposito: assim o preview exercita o default do locale ("Você" em pt)
const params: ReviewTutorialParams = {appName: "Meu App", locale: "pt", clock: "07:28"};
if (values.project) {
    const project = resolve(values.project);
    const config = JSON.parse(readFileSync(resolve(project, "app.json"), "utf8")).expo;
    if (!config?.name) throw new Error("O app.json precisa de expo.name.");
    params.appName = config.name;
    const icon = config.android?.icon || config.icon;
    if (icon) params.appIconUrl = iconUri(/^(https?:|data:)/i.test(icon) ? icon : resolve(project, icon));
}
if (values.params) Object.assign(params, JSON.parse(readFileSync(resolve(values.params), "utf8")));
if (values["app-name"]) params.appName = values["app-name"];
if (values.locale) params.locale = values.locale;
if (values.icon) params.appIconUrl = iconUri(values.icon);

const output = values.output ? resolve(values.output) : resolve(dirname(fileURLToPath(import.meta.url)), "result.html");
writeFileSync(output, buildTutorialHtml(params));
console.log(output);
const editorOutput = values.output ? output.replace(/(?:\.html)?$/, "-editor.html") : resolve(dirname(output), "editor.html");
writeFileSync(editorOutput, buildTutorialEditorHtml(params));
console.log(editorOutput);
