/**
 * Engine-facing API. Called by match engine (internal).
 * GET /api/match/default-collection?difficulty=X
 * POST /api/match/infrastructure { matchId, infrastructure }
 */

import express from 'express';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import { getDefaultCollectionWithTemplates } from '../services/serviceCollectionService.js';

const router = express.Router();
const MATCHES_COLLECTION = 'matches';

/** GET /api/match/default-collection?difficulty=beginner|advanced|expert — used by engine when provisioning */
router.get('/default-collection', async (req, res) => {
  try {
    const difficulty = req.query.difficulty;
    if (!difficulty || typeof difficulty !== 'string') {
      return res.status(400).json({ error: 'difficulty query is required' });
    }
    const collection = await getDefaultCollectionWithTemplates(difficulty);
    return res.json(collection);
  } catch (err) {
    if (err.message === 'NO_COLLECTION_FOUND') {
      return res.status(404).json({ error: 'No default collection for this difficulty' });
    }
    return res.status(500).json({ error: 'Failed to get default collection' });
  }
});

/** POST /api/match/infrastructure — engine pushes infrastructure after provision (body parsed by app) */
router.post('/infrastructure', async (req, res) => {
  try {
    const { matchId, infrastructure } = req.body || {};
    if (!matchId || typeof matchId !== 'string') {
      return res.status(400).json({ error: 'matchId is required' });
    }
    if (!infrastructure || typeof infrastructure !== 'object') {
      return res.status(400).json({ error: 'infrastructure is required' });
    }
    const firestore = getFirestore();
    if (!firestore) return res.status(500).json({ error: 'Database not available' });
    const ref = firestore.collection(MATCHES_COLLECTION).doc(matchId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Match not found' });
    }
    await ref.update({ infrastructure, infrastructureUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to store infrastructure' });
  }
});

export default router;
