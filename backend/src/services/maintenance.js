/**
 * Global maintenance mode (kill switch).
 * Controlled only via admin routes. When enabled:
 * - New queue joins rejected
 * - Match start rejected
 * - Admin routes always allowed
 * Existing matches continue until admin stops them.
 */

import firebaseAdmin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';

const SYSTEM_CONFIG_COLLECTION = 'system_config';
const MAINTENANCE_DOC_ID = 'maintenance';

/**
 * Check if maintenance mode is enabled.
 *
 * @returns {Promise<boolean>}
 */
export async function isMaintenanceEnabled() {
  const firestore = getFirestore();
  if (!firestore) return false;

  const doc = await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc(MAINTENANCE_DOC_ID).get();
  if (!doc.exists) return false;

  const data = doc.data() || {};
  return data.enabled === true;
}

/**
 * Set maintenance mode. Admin only (caller must enforce adminGuard).
 *
 * @param {boolean} enabled
 */
export async function setMaintenanceEnabled(enabled) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc(MAINTENANCE_DOC_ID).set(
    {
      enabled: !!enabled,
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
