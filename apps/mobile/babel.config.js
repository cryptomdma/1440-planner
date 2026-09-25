module.exports = function (api) {
  api.cache(true);
  return {
    // No explicit plugins list: since SDK 57, babel-preset-expo resolves and
    // appends `react-native-worklets/plugin` itself whenever the package is
    // installed (Reanimated 4 moved the transform there), and it must stay
    // last. Listing it by hand would apply the transform twice.
    presets: ['babel-preset-expo'],
  };
};
