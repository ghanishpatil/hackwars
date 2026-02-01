/**
 * Service Collections: groups of 5 service templates per difficulty.
 * Firestore: service_collections. Used by match engine to get default collection per difficulty.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';

const COLLECTION = 'service_collections';
const TEMPLATES_COLLECTION = 'service_templates';
const DIFFICULTIES = ['beginner', 'advanced', 'expert'];

/**
 * Create a service collection. Exactly 5 template IDs; all must exist and be active.
 * If isDefault: true, unsets isDefault on other collections with same difficulty.
 */
export async function createServiceCollection(adminUid, data) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');

  const name = String(data?.name ?? '').trim();
  const difficulty = String(data?.difficulty ?? '').toLowerCase();
  const description = String(data?.description ?? '').trim();
  const serviceTemplateIds = Array.isArray(data?.serviceTemplateIds) ? data.serviceTemplateIds : [];
  const isDefault = !!data?.isDefault;

  if (!name) throw new Error('INVALID_INPUT');
  if (!DIFFICULTIES.includes(difficulty)) throw new Error('INVALID_INPUT');
  if (serviceTemplateIds.length !== 5) throw new Error('INVALID_INPUT');

  for (const tid of serviceTemplateIds) {
    const snap = await firestore.collection(TEMPLATES_COLLECTION).doc(tid).get();
    if (!snap.exists) throw new Error('INVALID_INPUT');
    const d = snap.data();
    if (d?.isActive === false) throw new Error('INVALID_INPUT');
  }

  if (isDefault) {
    const existing = await firestore
      .collection(COLLECTION)
      .where('difficulty', '==', difficulty)
      .where('isActive', '==', true)
      .get();
    const batch = firestore.batch();
    existing.docs.forEach((doc) => {
      batch.update(doc.ref, { isDefault: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    if (!existing.empty) await batch.commit();
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = firestore.collection(COLLECTION).doc();
  const payload = {
    collectionId: docRef.id,
    name,
    difficulty,
    description,
    serviceTemplateIds,
    createdBy: adminUid,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    isDefault,
  };
  await docRef.set(payload);
  const snap = await docRef.get();
  return { id: docRef.id, ...snap.data() };
}

/**
 * Get the default (or any active) collection for a difficulty. Used by match engine.
 */
export async function getDefaultCollectionForDifficulty(difficulty) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');

  const d = String(difficulty).toLowerCase();
  let snap = await firestore
    .collection(COLLECTION)
    .where('difficulty', '==', d)
    .where('isDefault', '==', true)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    snap = await firestore
      .collection(COLLECTION)
      .where('difficulty', '==', d)
      .where('isActive', '==', true)
      .limit(1)
      .get();
  }

  if (snap.empty) throw new Error('NO_COLLECTION_FOUND');
  const doc = snap.docs[0];
  return { id: doc.id, collectionId: doc.id, ...doc.data() };
}

/**
 * Get default collection for difficulty with services array (full template docs).
 * Used by match engine when provisioning.
 */
export async function getDefaultCollectionWithTemplates(difficulty) {
  const collection = await getDefaultCollectionForDifficulty(difficulty);
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');

  const ids = collection.serviceTemplateIds || [];
  const services = [];
  for (const tid of ids) {
    const snap = await firestore.collection(TEMPLATES_COLLECTION).doc(tid).get();
    if (snap.exists) {
      const d = snap.data();
      if (d?.isActive !== false) {
        services.push({ templateId: snap.id, id: snap.id, ...d });
      }
    }
  }
  return { ...collection, services };
}

/**
 * List service collections (optionally by difficulty).
 *
 * @param {{ difficulty?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function listServiceCollections(filters = {}) {
  const firestore = getFirestore();
  if (!firestore) return [];
  let q = firestore.collection(COLLECTION).where('isActive', '==', true).orderBy('updatedAt', 'desc');
  if (filters.difficulty) {
    q = firestore
      .collection(COLLECTION)
      .where('isActive', '==', true)
      .where('difficulty', '==', String(filters.difficulty).toLowerCase())
      .orderBy('updatedAt', 'desc');
  }
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, collectionId: d.id, ...d.data() }));
}

/**
 * Set a collection as the default for its difficulty (unsets others).
 *
 * @param {string} collectionId
 * @returns {Promise<object>}
 */
export async function setDefaultCollection(collectionId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');
  const ref = firestore.collection(COLLECTION).doc(collectionId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('NOT_FOUND');
  const data = snap.data();
  const difficulty = data?.difficulty;
  if (!difficulty) throw new Error('INVALID_INPUT');

  const existing = await firestore
    .collection(COLLECTION)
    .where('difficulty', '==', difficulty)
    .where('isActive', '==', true)
    .get();
  const batch = firestore.batch();
  existing.docs.forEach((doc) => {
    batch.update(doc.ref, { isDefault: doc.id === collectionId, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  const updated = await ref.get();
  return { id: ref.id, ...updated.data() };
}
