// Tipos de assets para o type-check interno da lib (Metro resolve estes imports em runtime).
// NÃO é publicado no pacote (não está em package.json "files") — então não conflita com as
// declarações de asset do app que instala o expo-utils.
declare module "*.jpg" {
    const content: number;
    export default content;
}
declare module "*.png" {
    const content: number;
    export default content;
}
