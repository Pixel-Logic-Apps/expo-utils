const { withPlugins, createRunOncePlugin } = require('@expo/config-plugins');

const pkg = require('./package.json');

// O plugin agora aceita 'props' que podem ser passadas a partir do app.json do projeto final.
function withRequiredPlugins(config, props = {}) {
  const firebaseProps = props.firebase || {};
  const googleMobileAdsProps = props.googleMobileAds || {};
  const facebookProps = props.facebook || {};

  // Lista de todos os plugins do Firebase que seu módulo suporta.
  const firebasePlugins = [
    // O plugin principal do app, que recebe a configuração dos arquivos.
    ['@react-native-firebase/app', firebaseProps],
    // Os outros módulos do Firebase. Eles não precisam de configuração
    // individual, apenas precisam ser listados para o autolinking nativo.
    '@react-native-firebase/analytics',
    '@react-native-firebase/auth',
    '@react-native-firebase/firestore',
    '@react-native-firebase/messaging',
    '@react-native-firebase/remote-config',
  ];

  // Adicionamos também os outros plugins que já estavam aqui.
  // Usamos 'withPlugins' para encadear tudo de forma segura.
  return withPlugins(config, [
    // Plugin do Google Mobile Ads (AdMob), agora recebendo as propriedades.
    ['react-native-google-mobile-ads', googleMobileAdsProps],

    // Plugin do Facebook SDK, agora recebendo as propriedades.
    ['react-native-fbsdk-next', facebookProps],
    
    // Todos os plugins do Firebase
    ...firebasePlugins,
  ]);
}

module.exports = createRunOncePlugin(withRequiredPlugins, pkg.name, pkg.version); 