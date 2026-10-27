import {mock} from "bun:test";

// chalk de mentira para os testes do bin/install.js: o repo não traz node_modules (chalk é dependência do
// pacote, instalada só no app). Qualquer cadeia (chalk.green.bold(...)) devolve o texto como veio.
export function mockChalk() {
    const paint: any = new Proxy((text: unknown) => String(text), {get: () => paint});
    const colors = ["bold", "dim", "cyan", "green", "yellow", "red", "blue", "gray", "grey", "magenta", "white"];
    mock.module("chalk", () => Object.fromEntries([["default", paint], ...colors.map((name) => [name, paint])]));
}
