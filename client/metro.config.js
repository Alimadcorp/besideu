const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

console.warn('--- Metro config is being loaded with Firebase aliases ---');

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    '@unimodules/core': path.dirname(require.resolve('expo-modules-core/package.json')),
    '@unimodules/react-native-adapter': path.dirname(require.resolve('expo-modules-core/package.json')),
    'firebase': path.resolve(__dirname, 'utils/firebase-compat.ts'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'firebase' || moduleName === 'firebase/index' || moduleName === 'firebase/app') {
        return {
            filePath: path.resolve(__dirname, 'utils/firebase-compat.ts'),
            type: 'sourceFile',
        };
    }
    if (moduleName === 'firebase/auth') {
        return {
            filePath: require.resolve('firebase/compat/auth'),
            type: 'sourceFile',
        };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
