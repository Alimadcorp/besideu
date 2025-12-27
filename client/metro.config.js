const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

console.warn('--- Metro config is being loaded with Firebase aliases ---');

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    '@unimodules/core': path.dirname(require.resolve('expo-modules-core/package.json')),
    '@unimodules/react-native-adapter': path.dirname(require.resolve('expo-modules-core/package.json')),
    'firebase': path.resolve(__dirname, 'node_modules/firebase/compat/app'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'firebase' || moduleName === 'firebase/index') {
        const firebasePath = require.resolve('firebase/compat/app');
        return {
            filePath: firebasePath,
            type: 'sourceFile',
        };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
