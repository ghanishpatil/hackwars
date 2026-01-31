/**
 * User Service
 *
 * Responsible for user persistence in Firestore.
 *
 * Responsibilities:
 * - Read/write from the `users` collection only.
 * - Create user document on first login.
 * - Update `lastLogin` on every successful authentication.
 * - No matchmaking, ELO, or game logic.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';

const USERS_COLLECTION = 'users';

/**
 * Derive a deterministic username from decoded token.
 *
 * Priority:
 * 1. Use `displayName` (or `name`) if available.
 * 2. Fallback to email prefix (before '@').
 *
 * The transformation is deterministic:
 * - Lowercase
 * - Non-alphanumeric characters replaced with '_'
 *
 * @param {Object} decodedToken
 * @returns {string}
 */
function deriveUsername(decodedToken) {
  const displayName = decodedToken.displayName || decodedToken.name || '';
  const email = decodedToken.email || '';

  let base = '';

  if (displayName && typeof displayName === 'string') {
    base = displayName;
  } else if (email && typeof email === 'string') {
    base = email.split('@')[0];
  } else if (decodedToken.uid) {
    base = decodedToken.uid;
  } else {
    base = 'player';
  }

  return String(base)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Get or create user in Firestore.
 *
 * Collection: `users`
 * Document ID: `uid`
 *
 * Schema:
 * users/{uid} {
 *   uid: string
 *   email: string
 *   username: string
 *   displayName: string  // full name (signup)
 *   phone: string        // optional (signup)
 *   institute: string    // optional (signup)
 *   track: string        // e.g. "Cyber Security" (signup)
 *   role: string         // default: "user"
 *   mmr: number          // default: 1000
 *   rank: string         // default: "Initiate"
 *   rp: number           // default: 0
 *   createdAt: timestamp
 *   lastLogin: timestamp
 * }
 *
 * @param {import('firebase-admin').auth.DecodedIdToken} decodedToken
 * @returns {Promise<{
 *   uid: string;
 *   email: string;
 *   username: string;
 *   role: string;
 *   mmr: number;
 *   rank: string;
 *   rp: number;
 * }>}
 */
export async function getOrCreateUser(decodedToken) {
  const { uid, email } = decodedToken;

  if (!uid || !email) {
    throw new Error('Decoded token is missing required fields (uid/email).');
  }

  const firestore = getFirestore();

  if (!firestore) {
    throw new Error('Firestore is not initialized.');
  }

  const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
  const snapshot = await userRef.get();

  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!snapshot.exists) {
    const username = deriveUsername(decodedToken);

    const newUser = {
      uid,
      email,
      username,
      displayName: decodedToken.displayName ?? '',
      phone: '',
      institute: '',
      track: '',
      role: 'user',
      mmr: 1000,
      rank: 'Initiate',
      rp: 0,
      currentTeamId: null,
      onlineStatus: { isOnline: false, lastHeartbeat: null, currentPage: 'offline' },
      createdAt: now,
      lastLogin: now,
      lastActive: now,
    };

    // Create user document on first login (normal user by default)
    await userRef.set(newUser);

    // Return profile fields (without timestamps)
    return {
      uid,
      email,
      username,
      displayName: newUser.displayName,
      phone: newUser.phone,
      institute: newUser.institute,
      track: newUser.track,
      role: newUser.role,
      mmr: newUser.mmr,
      rank: newUser.rank,
      rp: newUser.rp,
    };
  }

  const existing = snapshot.data() || {};

  if (existing.banned === true) {
    const err = new Error('Account banned');
    err.code = 'BANNED';
    throw err;
  }

  // Update lastLogin, lastActive, and append to loginHistory (keep last 20)
  const loginHistory = (existing.loginHistory && Array.isArray(existing.loginHistory) ? existing.loginHistory : []).slice(-19);
  loginHistory.push(Date.now());
  await userRef.update({
    lastLogin: now,
    lastActive: now,
    loginHistory,
  });

  const role = typeof existing.role === 'string' ? existing.role : 'user';

  return {
    uid: existing.uid || uid,
    email: existing.email || email,
    username: existing.username || deriveUsername(decodedToken),
    displayName: typeof existing.displayName === 'string' ? existing.displayName : '',
    phone: typeof existing.phone === 'string' ? existing.phone : '',
    institute: typeof existing.institute === 'string' ? existing.institute : '',
    track: typeof existing.track === 'string' ? existing.track : '',
    role,
    mmr: typeof existing.mmr === 'number' ? existing.mmr : 1000,
    rank: typeof existing.rank === 'string' ? existing.rank : 'Initiate',
    rp: typeof existing.rp === 'number' ? existing.rp : 0,
    currentTeamId: existing.currentTeamId ?? null,
    onlineStatus: existing.onlineStatus ?? { isOnline: false, lastHeartbeat: null, currentPage: 'offline' },
  };
}

/**
 * Update authenticated user's profile (displayName, phone, institute, track).
 * Creates user doc if it doesn't exist (e.g. right after signup).
 *
 * @param {import('firebase-admin').auth.DecodedIdToken} decodedToken
 * @param {{ displayName?: string; phone?: string; institute?: string; track?: string }} body
 */
export async function updateUserProfile(decodedToken, body) {
  const { uid, email } = decodedToken;
  if (!uid || !email) throw new Error('Decoded token is missing required fields (uid/email).');

  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore is not initialized.');

  const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
  const snapshot = await userRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const updates = {
    lastLogin: now,
    ...(body.displayName !== undefined && { displayName: String(body.displayName).trim() }),
    ...(body.phone !== undefined && { phone: String(body.phone).trim() }),
    ...(body.institute !== undefined && { institute: String(body.institute).trim() }),
    ...(body.track !== undefined && { track: String(body.track).trim() }),
  };

  if (!snapshot.exists) {
    const username = deriveUsername(decodedToken);
    await userRef.set({
      uid,
      email,
      username,
      displayName: (body.displayName != null ? String(body.displayName).trim() : '') || '',
      phone: (body.phone != null ? String(body.phone).trim() : '') || '',
      institute: (body.institute != null ? String(body.institute).trim() : '') || '',
      track: (body.track != null ? String(body.track).trim() : '') || '',
      role: 'user',
      mmr: 1000,
      rank: 'Initiate',
      rp: 0,
      createdAt: now,
      lastLogin: now,
    });
    return;
  }

  await userRef.update(updates);
}

/**
 * Get user role from Firestore (source of truth for admin).
 * Used by adminGuard — no token claims; role comes from DB only.
 *
 * @param {string} uid
 * @returns {Promise<'user'|'admin'>}
 */
export async function getUserRole(uid) {
  if (!uid) return 'user';

  const firestore = getFirestore();
  if (!firestore) return 'user';

  const snap = await firestore.collection(USERS_COLLECTION).doc(uid).get();
  const data = snap.exists ? snap.data() : {};
  const role = data?.role === 'admin' ? 'admin' : 'user';
  return role;
}

