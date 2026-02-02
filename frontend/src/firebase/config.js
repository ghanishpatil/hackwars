/**
 * Firebase client init from env. Used for Auth only.
 * Validates environment variables before initialization.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { validateEnvironment, getConfig } from '../utils/validateEnv.js';

// Validate environment variables
try {
  validateEnvironment();
} catch (err) {
  console.error('Firebase configuration error:');
  console.error(err.message);
  throw err;
}

// Get validated config
const config = getConfig();

const firebaseConfig = {
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  projectId: config.firebase.projectId,
  storageBucket: config.firebase.storageBucket,
  messagingSenderId: config.firebase.messagingSenderId,
  appId: config.firebase.appId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
