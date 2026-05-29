// Declarações ambiente p/ assets de imagem importados pelos componentes do expo-utils.
// Fica em utils/ (que está no "files" do package) e é referenciado via triple-slash
// pelos componentes que importam imagens — assim quem faz deep-import desses .tsx
// consegue type-check sem o erro "Cannot find module '*.jpg'".
declare module "*.jpg" {
    const content: number;
    export default content;
}
declare module "*.png" {
    const content: number;
    export default content;
}
