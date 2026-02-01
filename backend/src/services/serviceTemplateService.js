/**
 * Service Template CRUD and Docker build.
 * Firestore: service_templates. Builds custom images via dockerode when dockerfile provided.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const COLLECTION = 'service_templates';
const TYPES = ['web', 'ssh', 'database', 'api', 'other'];
const DIFFICULTIES = ['beginner', 'advanced', 'expert'];

/**
 * Write dockerfile to temp dir, build image with dockerode, then clean up.
 * @param {string} dockerfileContent - Decoded Dockerfile text
 * @param {string} imageName - e.g. ctf-custom/1234567890
 */
export async function buildDockerImage(dockerfileContent, imageName) {
  const dir = path.join(os.tmpdir(), 'ctf-dockerfiles', imageName.replace(/\//g, '_'));
  await fs.mkdir(dir, { recursive: true });
  const dockerfilePath = path.join(dir, 'Dockerfile');
  try {
    await fs.writeFile(dockerfilePath, dockerfileContent, 'utf8');
    const docker = new Docker();
    const stream = await docker.buildImage(
      { context: dir, src: ['Dockerfile'] },
      { t: imageName }
    );
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * @param {string} adminUid
 * @param {object} data - name, type, difficulty, port, flagPath, vulnerabilities, healthCheck; dockerImage OR dockerfile (base64)
 */
export async function createServiceTemplate(adminUid, data) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');

  const name = String(data?.name ?? '').trim();
  const type = String(data?.type ?? '').toLowerCase();
  const difficulty = String(data?.difficulty ?? '').toLowerCase();
  const port = Number(data?.port);
  const flagPath = String(data?.flagPath ?? '').trim();
  const dockerImage = data?.dockerImage ? String(data.dockerImage).trim() : '';
  const dockerfile = data?.dockerfile ? String(data.dockerfile) : '';

  if (!name || !type || !flagPath) throw new Error('INVALID_INPUT');
  if (!TYPES.includes(type) || !DIFFICULTIES.includes(difficulty)) throw new Error('INVALID_INPUT');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_INPUT');
  const hasImage = !!dockerImage;
  const hasDockerfile = !!dockerfile;
  if (hasImage && hasDockerfile) throw new Error('INVALID_INPUT');
  if (!hasImage && !hasDockerfile) throw new Error('INVALID_INPUT');

  const nameSnap = await firestore.collection(COLLECTION).where('name', '==', name).where('isActive', '==', true).limit(1).get();
  if (!nameSnap.empty) throw new Error('DUPLICATE_NAME');

  let finalImage = dockerImage;
  if (hasDockerfile) {
    const content = Buffer.from(dockerfile, 'base64').toString('utf8');
    finalImage = `ctf-custom/${Date.now()}`;
    try {
      await buildDockerImage(content, finalImage);
    } catch (err) {
      throw new Error('DOCKER_BUILD_FAILED');
    }
  }

  const envVars = data.environmentVars && typeof data.environmentVars === 'object' ? data.environmentVars : {};
  const vulnerabilities = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : [];
  const healthCheck = data.healthCheck && typeof data.healthCheck === 'object' ? data.healthCheck : { type: 'http', endpoint: '/', expectedStatus: 200, interval: 30 };

  const now = admin.firestore.FieldValue.serverTimestamp();
  const docRef = firestore.collection(COLLECTION).doc();
  const payload = {
    templateId: docRef.id,
    name,
    type,
    difficulty,
    dockerImage: finalImage,
    dockerfile: hasDockerfile ? dockerfile : null,
    port,
    environmentVars: envVars,
    flagPath,
    vulnerabilities,
    healthCheck,
    createdBy: adminUid,
    createdAt: now,
    updatedAt: now,
    isActive: true,
    usageCount: 0,
  };
  await docRef.set(payload);
  const snap = await docRef.get();
  return { id: docRef.id, ...snap.data() };
}

/**
 * @param {string} templateId
 */
export async function getServiceTemplate(templateId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');
  const snap = await firestore.collection(COLLECTION).doc(templateId).get();
  if (!snap.exists) throw new Error('NOT_FOUND');
  const d = snap.data();
  return { id: snap.id, templateId: snap.id, ...d };
}

/**
 * @param {string} templateId
 * @param {object} updates - Partial template; if dockerfile provided, build new image
 */
export async function updateServiceTemplate(templateId, updates) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');
  const ref = firestore.collection(COLLECTION).doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('NOT_FOUND');
  const existing = snap.data();

  const merged = { ...existing, ...updates };
  if (updates.dockerfile) {
    const content = Buffer.from(updates.dockerfile, 'base64').toString('utf8');
    const imageName = `ctf-custom/${Date.now()}`;
    try {
      await buildDockerImage(content, imageName);
    } catch (err) {
      throw new Error('DOCKER_BUILD_FAILED');
    }
    merged.dockerImage = imageName;
  }
  merged.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  delete merged.createdAt;
  const updateData = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));
  await ref.update(updateData);
  const updatedSnap = await ref.get();
  return { id: ref.id, ...updatedSnap.data() };
}

/**
 * Soft delete. Throws IN_USE if template is in any active service_collections.
 */
export async function deleteServiceTemplate(templateId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Database not available');
  const collectionsSnap = await firestore
    .collection('service_collections')
    .where('isActive', '==', true)
    .get();
  for (const doc of collectionsSnap.docs) {
    const ids = doc.data().serviceTemplateIds || [];
    if (ids.includes(templateId)) throw new Error('IN_USE');
  }
  await firestore.collection(COLLECTION).doc(templateId).update({
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * @param {{ type?: string, difficulty?: string, isActive?: boolean }} filters
 */
export async function listServiceTemplates(filters = {}) {
  const firestore = getFirestore();
  if (!firestore) return [];
  let q = firestore.collection(COLLECTION).orderBy('createdAt', 'desc');
  if (filters.type) q = q.where('type', '==', filters.type);
  if (filters.difficulty) q = q.where('difficulty', '==', filters.difficulty);
  if (filters.isActive !== undefined) q = q.where('isActive', '==', !!filters.isActive);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, templateId: d.id, ...d.data() }));
}
