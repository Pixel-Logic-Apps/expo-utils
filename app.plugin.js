const { withPlugins, createRunOncePlugin } = require('@expo/config-plugins');

// Importe os plugins das dependências que você quer automatizar
const { withGoogleMobileAds } = require('react-native-google-mobile-ads/build/plugin');
const { withRNFBAppPlugin } = require('@react-native-firebase/app/build/android/withRNFBAppPlugin');
// Adicione outros plugins que forem necessários, por exemplo:
// const { withFacebook } = require('react-native-fbsdk-next/build/plugin');

const pkg = require('./package.json');

// O plugin agora aceita 'props' que podem ser passadas a partir do app.json do projeto final.
// Ex: "plugins": [["expo-utils", { "firebase": { ... } }]]
function withRequiredPlugins(config, props = {}) {
  const firebaseProps = props.firebase || {};

  // Lista de todos os plugins do Firebase que seu módulo suporta.
  // O Expo irá carregar e executar o plugin de cada um desses pacotes.
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
    // Plugin do Google Mobile Ads (AdMob)
    'react-native-google-mobile-ads',

    // Exemplo para o Facebook SDK (se necessário, também pode receber props)
    // ['react-native-fbsdk-next', props.facebook || {}],
    
    // Todos os plugins do Firebase
    ...firebasePlugins,
  ]);
}

module.exports = createRunOncePlugin(withRequiredPlugins, pkg.name, pkg.version); 