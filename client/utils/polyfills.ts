import { Platform } from 'react-native';

/**
 * Polyfills for Firebase SDK in React Native.
 * These must be imported BEFORE any firebase modules.
 */
if (Platform.OS !== 'web') {
    const noop = () => { };

    // Polyfill window and self
    if (typeof (global as any).window === 'undefined') {
        (global as any).window = global;
    }
    if (typeof (global as any).self === 'undefined') {
        (global as any).self = global;
    }

    // Polyfill addEventListener/removeEventListener globally
    if (typeof (global as any).addEventListener === 'undefined') {
        (global as any).addEventListener = noop;
    }
    if (typeof (global as any).removeEventListener === 'undefined') {
        (global as any).removeEventListener = noop;
    }

    // Ensure window also has them for Compat SDK
    if (typeof (global as any).window.addEventListener === 'undefined') {
        (global as any).window.addEventListener = noop;
    }
    if (typeof (global as any).window.removeEventListener === 'undefined') {
        (global as any).window.removeEventListener = noop;
    }

    // Polyfill localStorage
    if (typeof (global as any).localStorage === 'undefined') {
        (global as any).localStorage = {
            getItem: () => null,
            setItem: noop,
            removeItem: noop,
            clear: noop,
            key: () => null,
            length: 0,
        };
    }

    // Polyfill document for internal Firebase event listeners
    if (typeof (global as any).document === 'undefined') {
        (global as any).document = {
            addEventListener: noop,
            removeEventListener: noop,
            createElement: () => ({}),
        };
    }
}
