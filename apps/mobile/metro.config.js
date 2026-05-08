const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve @1440/core from the workspace package
const corePackage = path.resolve(__dirname, '../../packages/core');
config.watchFolders = [...(config.watchFolders || []), corePackage];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@1440/core': corePackage,
};

module.exports = config;
