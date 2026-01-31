/**
 * Report route: authenticated users can report another user.
 */

import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { createReport } from '../services/adminFeaturesService.js';

const router = express.Router();

/** POST /report — submit a report (targetUid, reason) */
router.post('/', authenticateUser, async (req, res, next) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthenticated' });
    const { targetUid, reason } = req.body || {};
    if (!targetUid) return res.status(400).json({ error: 'targetUid required' });
    const data = await createReport(uid, { targetUid, reason });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

export default router;
