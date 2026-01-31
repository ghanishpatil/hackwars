/**
 * Match Routes
 *
 * Control-plane entrypoints for interacting with the match engine.
 */

import express from 'express';
import config from '../config/env.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import { startMatch as engineStartMatch } from '../services/engineClient.js';
import { startMatchStateTracking } from '../services/matchStateService.js';
import { processMatchEnd } from '../services/matchResult.js';
import { isMaintenanceEnabled } from '../services/maintenance.js';

const router = express.Router();
const MATCHES_COLLECTION = 'matches';

/**
 * GET /match/history — recent matches for the authenticated user (real data).
 */
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

    const firestore = getFirestore();
    if (!firestore) return res.status(500).json({ error: 'Database not available' });

    const [teamASnap, teamBSnap] = await Promise.all([
      firestore.collection(MATCHES_COLLECTION).where('teamA', 'array-contains', uid).orderBy('createdAt', 'desc').limit(30).get(),
      firestore.collection(MATCHES_COLLECTION).where('teamB', 'array-contains', uid).orderBy('createdAt', 'desc').limit(30).get(),
    ]);
    const byId = new Map();
    teamASnap.docs.forEach((doc) => {
      const d = doc.data();
      byId.set(doc.id, { matchId: doc.id, status: d.status, difficulty: d.difficulty, createdAt: d.createdAt?.toMillis?.() ?? d.createdAt ?? null });
    });
    teamBSnap.docs.forEach((doc) => {
      if (!byId.has(doc.id)) {
        const d = doc.data();
        byId.set(doc.id, { matchId: doc.id, status: d.status, difficulty: d.difficulty, createdAt: d.createdAt?.toMillis?.() ?? d.createdAt ?? null });
      }
    });
    const list = Array.from(byId.values()).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 20);
    return res.json(list);
  } catch (err) {
    console.error('Match history error:', err);
    return res.status(500).json({ error: 'Failed to load match history' });
  }
});

/**
 * POST /match/start
 *
 * Body:
 * {
 *   matchId: string
 * }
 *
 * Behavior:
 * - Rejected when maintenance mode is enabled.
 * - Protected by Firebase auth.
 * - Reads match metadata from Firestore `matches/{matchId}`.
 * - Calls engineClient.startMatch(...) with required payload.
 * - Updates match status -> "starting" on successful engine ACK.
 */
router.post('/start', authenticateUser, async (req, res) => {
  try {
    const { matchId } = req.body || {};

    if (await isMaintenanceEnabled()) {
      return res.status(503).json({ error: 'Maintenance mode enabled. Match start is disabled.' });
    }

    if (!matchId || typeof matchId !== 'string') {
      return res.status(400).json({ error: 'matchId is required' });
    }

    const firestore = getFirestore();
    if (!firestore) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Resource cap: max concurrent matches
    const activeSnap = await firestore
      .collection('matches')
      .where('status', 'in', ['pending', 'starting', 'running'])
      .limit(config.maxConcurrentMatches + 1)
      .get();
    if (activeSnap.size >= config.maxConcurrentMatches) {
      console.warn(`[matchId=${matchId}] Rejected: max concurrent matches (${config.maxConcurrentMatches}) reached`);
      return res.status(503).json({ error: 'Max concurrent matches reached. Try again later.' });
    }

    const matchRef = firestore.collection('matches').doc(matchId);
    const snap = await matchRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const data = snap.data() || {};

    const { difficulty, teamSize, teamA, teamB } = data;

    if (
      !difficulty ||
      typeof difficulty !== 'string' ||
      !Number.isInteger(teamSize) ||
      !Array.isArray(teamA) ||
      !Array.isArray(teamB)
    ) {
      return res.status(400).json({
        error: 'Match document is missing required fields (difficulty, teamSize, teamA, teamB)',
      });
    }

    // Call match engine
    await engineStartMatch({
      matchId,
      difficulty,
      teamSize,
      teamA,
      teamB,
    });

    // Update Firestore status -> "starting"
    await matchRef.update({
      status: 'starting',
    });

    // Begin polling for match state and emit initial state to sockets.
    startMatchStateTracking(matchId, 'initializing');

    return res.status(200).json({ status: 'starting' });
  } catch (error) {
    console.error('Error starting match:', error);

    if (error.code === 'ENGINE_UNAVAILABLE' || error.code === 'ENGINE_TIMEOUT') {
      return res.status(502).json({ error: 'Match engine is unavailable' });
    }

    return res.status(500).json({ error: 'Failed to start match' });
  }
});

/**
 * POST /match/end
 *
 * Body: { matchId: string }
 *
 * Behavior:
 * - Authenticated.
 * - Ensures match state is ENDED, fetches result from engine.
 * - Computes MMR/rank/RP deltas, persists in Firestore (transaction).
 * - Returns for the requesting user: old rank → new rank, MMR delta, RP delta.
 */
router.post('/end', authenticateUser, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { matchId } = req.body || {};
    if (!matchId || typeof matchId !== 'string') {
      return res.status(400).json({ error: 'matchId is required' });
    }

    const { playerDeltas } = await processMatchEnd(matchId);
    const delta = playerDeltas.get(uid);

    if (!delta) {
      return res.status(200).json({
        message: 'Match ended and results processed; you were not in this match',
        playerDelta: null,
      });
    }

    return res.status(200).json({
      message: 'Match ended and results processed',
      playerDelta: {
        oldRank: delta.oldRank,
        newRank: delta.newRank,
        mmrDelta: delta.mmrDelta,
        rpDelta: delta.rpDelta,
      },
    });
  } catch (error) {
    console.error('Error ending match:', error);

    if (error.message === 'Match is not ended') {
      return res.status(400).json({ error: 'Match is not ended' });
    }
    if (error.message === 'Match result not available') {
      return res.status(502).json({ error: 'Match result not available' });
    }

    return res.status(500).json({ error: 'Failed to process match end' });
  }
});

export default router;
