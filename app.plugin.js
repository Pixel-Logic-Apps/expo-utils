const {withPlugins} = require("@expo/config-plugins");

function withExpoUtils(config, options = {}) {
    return withPlugins(config, [
        // O plugin do expo-utils não precisa modificar nada por padrão
        // Ele serve apenas como placeholder para permitir configurações futuras
        (config) => {
            // Configurações futuras podem ser adicionadas aqui
            return config;
        },
    ]);
}

module.exports = withExpoUtils;
