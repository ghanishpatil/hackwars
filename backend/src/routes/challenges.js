/**
 * Challenge routes: send, respond, received, sent.
 */

import express from 'express';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { getTeam } from '../services/teamService.js';
import {
  sendChallenge,
  respondToChallenge,
  getReceivedChallenges,
  getSentChallenges,
} from '../services/challengeService.js';

const router = express.Router();

router.use(authenticateUser);

/** POST /challenges/send — Body: { targetId, targetType, difficulty, teamSize } */
router.post('/send', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const firestore = getFirestore();
    const userSnap = firestore ? await firestore.collection('users').doc(uid).get() : null;
    const userData = userSnap?.exists ? userSnap.data() : {};
    const fromType = userData?.currentTeamId ? 'team' : 'solo';
    const result = await sendChallenge(uid, fromType, req.body || {});
    const io = req.app.get('io');
    if (io && result.notificationPayload) {
      const nm = io.of('/matchmaking');
      const targetId = req.body?.targetId;
      const targetType = req.body?.targetType === 'team' ? 'team' : 'solo';
      const payload = result.notificationPayload;
      if (targetType === 'solo') {
        nm.to(`user:${targetId}`).emit('challenge:received', payload);
      } else {
        const team = await getTeam(targetId);
        if (team && Array.isArray(team.members)) {
          team.members.forEach((m) => nm.to(`user:${m.uid}`).emit('challenge:received', payload));
        }
      }
    }
    return res.json({ success: result.success, challengeId: result.challengeId });
  } catch (err) {
    const msg = err.message || 'Failed to send challenge';
    const status = msg.includes('online') || msg.includes('unavailable') || msg.includes('Maximum') || msg.includes('wait') || msg.includes('leader') ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
});

/** POST /challenges/:challengeId/respond — Body: { action: 'accept' | 'decline' } */
router.post('/:challengeId/respond', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const { action } = req.body || {};
    const result = await respondToChallenge(uid, req.params.challengeId, action);
    const firestore = getFirestore();
    const challengeSnap = firestore ? await firestore.collection('challenges').doc(req.params.challengeId).get() : null;
    const challengeData = challengeSnap?.exists ? challengeSnap.data() : null;
    const io = req.app.get('io');
    if (io && challengeData) {
      const nm = io.of('/matchmaking');
      const payload = action === 'accept'
        ? { challengeId: req.params.challengeId, matchId: result.matchId }
        : { challengeId: req.params.challengeId, reason: 'declined' };
      const event = action === 'accept' ? 'challenge:accepted' : 'challenge:declined';
      const fromId = challengeData.fromId;
      const fromType = challengeData.fromType || 'solo';
      if (fromType === 'solo') {
        nm.to(`user:${fromId}`).emit(event, payload);
      } else {
        const team = await getTeam(fromId);
        if (team && Array.isArray(team.members)) {
          team.members.forEach((m) => nm.to(`user:${m.uid}`).emit(event, payload));
        }
      }
    }
    return res.json(result);
  } catch (err) {
    const msg = err.message || 'Failed to respond';
    const status = msg.includes('expired') || msg.includes('not found') || msg.includes('not the recipient') ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
});

/** GET /challenges/received */
router.get('/received', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const list = await getReceivedChallenges(uid);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to get challenges' });
  }
});

/** GET /challenges/sent */
router.get('/sent', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const list = await getSentChallenges(uid);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to get challenges' });
  }
});

export default router;
