/**
 * Landing missions: Mission Exploit & Mission Exploit 2.0.
 * Stored in Firestore; read by public API, updated by admin.
 * Image uploads go to Firebase Storage (landing-missions/{missionId}/...).
 */

import { getFirestore, getStorage } from '../firebase/firebaseAdmin.js';
import config from '../config/env.js';
import { randomUUID } from 'crypto';

const COLLECTION = 'landing_missions';
const MISSION_IDS = ['mission-exploit', 'mission-exploit-2'];

const defaults = {
  'mission-exploit': { title: 'Mission Exploit', tag: 'Coming soon', description: '', images: [] },
  'mission-exploit-2': { title: 'Mission Exploit 2.0', tag: 'Coming soon', description: '', images: [] },
};

/**
 * Get all landing missions (public).
 * @returns {Promise<Array<{ id: string, title: string, tag: string, description: string, images: Array<{ url: string, alt?: string, order?: number }> }>>}
 */
export async function getLandingMissions() {
  const firestore = getFirestore();
  if (!firestore) {
    return MISSION_IDS.map((id) => ({ id, ...defaults[id] }));
  }
  const out = [];
  for (const id of MISSION_IDS) {
    const snap = await firestore.collection(COLLECTION).doc(id).get();
    const data = snap.exists ? snap.data() : defaults[id];
    const images = Array.isArray(data.images) ? data.images : [];
    out.push({
      id,
      title: data.title ?? defaults[id].title,
      tag: data.tag ?? defaults[id].tag,
      description: data.description ?? defaults[id].description,
      images: images.map((img, i) => ({
        url: img.url ?? '',
        alt: img.alt ?? '',
        order: typeof img.order === 'number' ? img.order : i,
      })),
    });
  }
  return out;
}

/**
 * Update one landing mission (admin).
 * @param {string} missionId - mission-exploit | mission-exploit-2
 * @param {{ title?: string, tag?: string, description?: string, images?: Array<{ url: string, alt?: string, order?: number }> }} body
 */
export async function updateLandingMission(missionId, body) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');
  if (!MISSION_IDS.includes(missionId)) throw new Error('Invalid mission id');
  const ref = firestore.collection(COLLECTION).doc(missionId);
  const updates = {};
  if (body.title !== undefined) updates.title = String(body.title);
  if (body.tag !== undefined) updates.tag = String(body.tag);
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.images !== undefined) {
    updates.images = Array.isArray(body.images)
      ? body.images.map((img, i) => ({
          url: String(img?.url ?? ''),
          alt: img?.alt != null ? String(img.alt) : '',
          order: typeof img?.order === 'number' ? img.order : i,
        }))
      : [];
  }
  if (Object.keys(updates).length === 0) return (await ref.get()).data() ?? defaults[missionId];
  await ref.set(updates, { merge: true });
  const snap = await ref.get();
  const data = snap.data() ?? defaults[missionId];
  return {
    id: missionId,
    title: data.title,
    tag: data.tag,
    description: data.description,
    images: Array.isArray(data.images) ? data.images : [],
  };
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Upload an image for a landing mission to Firebase Storage. Returns public URL.
 * @param {string} missionId - mission-exploit | mission-exploit-2
 * @param {Buffer} buffer - file buffer
 * @param {string} mimeType - e.g. image/png
 * @param {string} originalName - original filename
 * @returns {Promise<{ url: string }>}
 */
export async function uploadLandingMissionImage(missionId, buffer, mimeType, originalName) {
  if (!MISSION_IDS.includes(missionId)) throw new Error('Invalid mission id');
  if (!ALLOWED_MIME.has(mimeType)) throw new Error('Invalid image type. Use JPEG, PNG, GIF, or WebP.');
  if (buffer.length > MAX_SIZE_BYTES) throw new Error('Image too large. Max 5MB.');
  const storage = getStorage();
  if (!storage) throw new Error('Storage not available');
  const bucketName = config.firebase.storageBucket || (config.firebase.projectId ? `${config.firebase.projectId}.appspot.com` : '');
  if (!bucketName) throw new Error('FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID must be set in backend .env');
  const bucket = storage.bucket(bucketName);
  const ext = (originalName && originalName.includes('.')) ? originalName.replace(/^.*\./, '') : (mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'webp');
  const safeName = (originalName || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'image';
  const fileName = `landing-missions/${missionId}/${randomUUID()}-${safeName}.${ext}`;
  const file = bucket.file(fileName);
  try {
    await file.save(buffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
  } catch (err) {
    const msg = err?.message || '';
    const code = err?.code ?? err?.response?.statusCode;
    if (code === 404 || msg.includes('does not exist') || msg.includes('not exist')) {
      const hint = config.firebase.projectId
        ? `${config.firebase.projectId}.firebasestorage.app or ${config.firebase.projectId}.appspot.com`
        : 'your-project.firebasestorage.app';
      throw new Error(
        'Storage bucket not found. Set FIREBASE_STORAGE_BUCKET in backend/.env to the bucket name from Firebase Console (Storage). New projects often use ' + hint + '.'
      );
    }
    throw err;
  }
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  return { url: publicUrl };
}
