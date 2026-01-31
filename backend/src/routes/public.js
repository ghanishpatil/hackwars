/**
 * Public routes: no auth required. Used by frontend for announcement banner, feature flags, leaderboard.
 */

import express from 'express';
import { getAnnouncement, getFeatureFlags, getPublicLeaderboard } from '../services/adminFeaturesService.js';

const router = express.Router();

/** GET /announcement — current global announcement (for banner) */
router.get('/announcement', async (req, res) => {
  try {
    const data = await getAnnouncement();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ text: '', enabled: false });
  }
});

/** GET /feature-flags — public feature flags (queue, rankings, signup enabled) */
router.get('/feature-flags', async (req, res) => {
  try {
    const data = await getFeatureFlags();
    return res.json(data);
  } catch (err) {
    return res.json({ queueEnabled: true, rankingsVisible: true, signupEnabled: true });
  }
});

/** GET /leaderboard — public leaderboard (respects rankingsVisible). Returns [] when disabled. */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const data = await getPublicLeaderboard(limit);
    return res.json(data);
  } catch (err) {
    return res.status(500).json([]);
  }
});

export default router;
