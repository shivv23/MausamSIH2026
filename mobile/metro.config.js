// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite ships a wasm worker for web support; Metro must treat the
// .wasm file as a static asset or web bundling fails to resolve it.
config.resolver.assetExts.push('wasm');

module.exports = config;