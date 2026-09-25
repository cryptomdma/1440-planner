const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve @1440/core from the workspace package. Both lines are
// about the monorepo layout, not about any version skew: watchFolders puts
// core's source under Metro's watcher (it lives outside the app root, so Fast
// Refresh would not see edits otherwise), and extraNodeModules maps the bare
// specifier onto it.
const corePackage = path.resolve(__dirname, '../../packages/core');
config.watchFolders = [...(config.watchFolders || []), corePackage];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@1440/core': corePackage,
};

module.exports = config;
