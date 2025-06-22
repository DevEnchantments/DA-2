// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = null; // Ensure custom resolvers don't break Expo
config.resolver.unstable_enablePackageExports = false; // THIS is the key fix for SDK 53 issues

module.exports = config;
