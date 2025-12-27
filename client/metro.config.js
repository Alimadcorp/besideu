const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    '@unimodules/core': path.dirname(require.resolve('expo-modules-core/package.json')),
    '@unimodules/react-native-adapter': path.dirname(require.resolve('expo-modules-core/package.json')),
};

module.exports = config;
