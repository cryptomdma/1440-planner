const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve @1440/core from the workspace package
const corePackage = path.resolve(__dirname, '../../packages/core');
config.watchFolders = [...(config.watchFolders || []), corePackage];

// Prioritize workspace-local node_modules so Expo SDK 51's pinned versions
// win over any newer versions hoisted to the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

// Block the root-level copies of RN packages that must be at Expo SDK 51 versions.
// Without this, packages like expo-router resolve them relative to root via Node
// algorithm and land on incompatible 4.x / 5.x versions regardless of nodeModulesPaths.
const rootScreens = path.resolve(__dirname, '../../node_modules/react-native-screens');
const rootSafeArea = path.resolve(__dirname, '../../node_modules/react-native-safe-area-context');
const esc = (p) => p.replace(/[/\\]/g, '[/\\\\]').replace(/\./g, '\\.');
config.resolver.blockList = [
  new RegExp(`^${esc(rootScreens)}[/\\\\].*`),
  new RegExp(`^${esc(rootSafeArea)}[/\\\\].*`),
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@1440/core': corePackage,
};

// resolveRequest intercepts ALL module resolutions globally (unlike extraNodeModules
// which is only a fallback for modules Metro can't find normally).
// Redirect expo-linking to workspace-local @6.3.1 — pure JS, no ExpoLinking native
// module call — because expo-router@3.5.24 at root pulls in expo-linking@55 which
// calls requireNativeModule('ExpoLinking') and the native side is excluded from the
// Android build to avoid an expo-module-gradle-plugin incompatibility.
const localLinking = path.resolve(__dirname, 'node_modules/expo-linking');
const linkingMain = require(path.join(localLinking, 'package.json')).main || 'index.js';
const linkingEntry = path.join(localLinking, linkingMain);

const repoRoot = path.resolve(__dirname, '../..');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect expo-linking to workspace-local @6.3.1 (pure JS, no ExpoLinking native module).
  if (moduleName === 'expo-linking') {
    return { type: 'sourceFile', filePath: linkingEntry };
  }

  // HMR sends entry paths as `./node_modules/<pkg>/...` relative to the Metro project
  // root (apps/mobile), but packages hoisted to the repo root aren't in
  // apps/mobile/node_modules. Re-resolve them as bare package names from the repo root.
  if (moduleName.startsWith('./node_modules/')) {
    const subpath = moduleName.slice('./node_modules/'.length);
    return (defaultResolveRequest || context.resolveRequest)(
      { ...context, originModulePath: path.join(repoRoot, '_hmr_shim_.js') },
      subpath,
      platform
    );
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
