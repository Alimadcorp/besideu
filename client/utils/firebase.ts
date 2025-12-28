import './polyfills'; // MUST BE FIRST
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App
let app;
try {
    app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
} catch (e) {
    app = firebase.app();
}

// Initialize Auth
const auth = firebase.auth();

// Set persistence to 'none' for React Native to avoid browser-api crashes.
if (Platform.OS !== 'web') {
    try {
        // auth.setPersistence returns a Promise
        auth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(err => {
            console.warn('Firebase setPersistence(NONE) failed silently:', err);
        });
    } catch (e) {
        console.warn('Firebase setPersistence error:', e);
    }
}

// Export compat PhoneAuthProvider for screens
const PhoneAuthProvider = firebase.auth.PhoneAuthProvider;

export { auth, app, PhoneAuthProvider, firebase };
