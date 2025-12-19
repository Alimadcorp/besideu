import admin from 'firebase-admin';

let app;

export function getFirebaseAdmin() {
  if (app) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[firebaseAdmin] Firebase credentials are not fully configured');
    return null;
  }

  // Handle escaped newlines if coming from .env
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (err) {
    // Ignore "already exists" errors in dev / hot-reload
    if (!/already exists/u.test(String(err))) {
      console.error('[firebaseAdmin] Failed to initialize Firebase Admin', err);
      throw err;
    }
  }

  return admin;
}


