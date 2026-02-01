/**
 * Firebase Admin SDK Initialization
 *
 * Initializes Firebase Admin SDK for server-side operations.
 * Used for authentication verification and Firestore access.
 *
 * Credentials are provided via environment variables loaded in `config/env.js`.
 * No credentials are hardcoded in this file.
 */

import admin from 'firebase-admin';
import config from '../config/env.js';

let firebaseAdmin = null;

/**
 * Initialize Firebase Admin SDK
 *
 * @returns {admin.app.App | null} Firebase Admin app instance
 */
function initializeFirebaseAdmin() {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  // Check if credentials are provided
  if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
    console.warn('Firebase Admin credentials not provided. Firebase features will be disabled.');
    return null;
  }

  try {
    const appOptions = {
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    };
    if (config.firebase.storageBucket) {
      appOptions.storageBucket = config.firebase.storageBucket;
    }
    firebaseAdmin = admin.initializeApp(appOptions);

    console.log('Firebase Admin SDK initialized successfully');
    return firebaseAdmin;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
}

/**
 * Get Firebase Admin instance
 *
 * @returns {admin.app.App | null} Firebase Admin app instance or null
 */
export function getFirebaseAdmin() {
  if (!firebaseAdmin) {
    return initializeFirebaseAdmin();
  }
  return firebaseAdmin;
}

/**
 * Get Firestore instance
 *
 * @returns {admin.firestore.Firestore | null} Firestore instance or null
 */
export function getFirestore() {
  const app = getFirebaseAdmin();
  return app ? app.firestore() : null;
}

/**
 * Get Auth instance
 *
 * @returns {admin.auth.Auth | null} Auth instance or null
 */
export function getAuth() {
  const app = getFirebaseAdmin();
  return app ? app.auth() : null;
}

/**
 * Get Storage instance (for landing mission image uploads, etc.)
 *
 * @returns {admin.storage.Storage | null} Storage instance or null
 */
export function getStorage() {
  const app = getFirebaseAdmin();
  return app ? app.storage() : null;
}

// Convenience exports (as required):
// - `auth`: Firebase Auth instance (or null)
// - `firestore`: Firestore instance (or null)
export const auth = getAuth();
export const firestore = getFirestore();
