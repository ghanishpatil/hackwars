/**
 * Team routes: create, join, leave, disband, get.
 */

import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { createTeam, joinTeam, leaveTeam, disbandTeam, getTeam } from '../services/teamService.js';

const router = express.Router();

router.use(authenticateUser);

/** POST /teams/create — Body: { teamName, maxSize } */
router.post('/create', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const team = await createTeam(uid, req.body || {});
    return res.json(team);
  } catch (err) {
    const msg = err.message || 'Failed to create team';
    const status = msg.includes('already taken') || msg.includes('leave your current team') ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
});

/** POST /teams/join — Body: { inviteCode } */
router.post('/join', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const team = await joinTeam(uid, req.body || {});
    return res.json(team);
  } catch (err) {
    const msg = err.message || 'Failed to join team';
    const status = msg.includes('Invalid') || msg.includes('maximum capacity') || msg.includes('leave your current team') ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
});

/** POST /teams/leave */
router.post('/leave', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    await leaveTeam(uid);
    return res.json({ left: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to leave team' });
  }
});

/** DELETE /teams/:teamId/disband */
router.delete('/:teamId/disband', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    await disbandTeam(uid, req.params.teamId);
    return res.json({ disbanded: true });
  } catch (err) {
    const status = err.message?.includes('Only the team leader') ? 403 : err.message?.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: err.message || 'Failed to disband team' });
  }
});

/** GET /teams/:teamId */
router.get('/:teamId', async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    return res.json(team);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to get team' });
  }
});

export default router;
