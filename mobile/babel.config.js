// babel-preset-expo (SDK 57) configure automatiquement react-native-worklets /
// reanimated et le support Skia. Ne PAS ajouter le plugin worklets manuellement
// (il serait dupliqué). GestureHandler ne requiert pas de plugin babel.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
