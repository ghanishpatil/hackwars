/**
 * Presence routes: heartbeat, online players/teams.
 */

import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { heartbeat, getOnlinePlayersAndTeams } from '../services/presenceService.js';

const router = express.Router();

/** POST /presence/heartbeat — Body: { currentPage } */
router.post('/heartbeat', authenticateUser, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const { currentPage } = req.body || {};
    const result = await heartbeat(uid, currentPage);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Heartbeat failed' });
  }
});

/** GET /presence/online — Query: mode (solo|team), minMMR, maxMMR */
router.get('/online', authenticateUser, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const mode = req.query.mode === 'team' ? 'team' : 'solo';
    const minMMR = req.query.minMMR != null ? Number(req.query.minMMR) : undefined;
    const maxMMR = req.query.maxMMR != null ? Number(req.query.maxMMR) : undefined;
    const result = await getOnlinePlayersAndTeams(uid, { mode, minMMR, maxMMR });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to get online list' });
  }
});

export default router;
