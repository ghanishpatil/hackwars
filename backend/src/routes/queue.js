/**
 * Queue Routes
 *
 * REST-only endpoints for queue management.
 *
 * All routes:
 * - Require Firebase authentication (via `authenticateUser`).
 * - Use `req.user.uid` as the player identifier.
 */

import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import {
  joinQueue,
  leaveQueue,
  getQueueStatus,
} from '../services/queueService.js';
import { isMaintenanceEnabled } from '../services/maintenance.js';

const router = express.Router();

/**
 * POST /queue/join
 *
 * Body:
 * {
 *   difficulty: string,
 *   teamSize: number
 * }
 *
 * Behavior:
 * - Rejected when maintenance mode is enabled.
 * - Ensures the user is not already queued.
 * - Adds user to the appropriate queue.
 * - Triggers a matchmaking attempt.
 */
router.post('/join', authenticateUser, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    if (await isMaintenanceEnabled()) {
      return res.status(503).json({ error: 'Maintenance mode enabled. Queue joins are disabled.' });
    }

    const { difficulty, teamSize, mode } = req.body || {};

    if (!difficulty || teamSize === undefined) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: difficulty, teamSize' });
    }

    const queueInfo = await joinQueue(uid, { difficulty, teamSize, mode: mode === 'team' ? 'team' : 'solo' });

    return res.status(200).json({
      queued: true,
      queue: queueInfo,
    });
  } catch (error) {
    console.error('Error joining queue:', error);

    if (
      typeof error.message === 'string' &&
      error.message.startsWith('User is already queued')
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (
      typeof error.message === 'string' &&
      error.message.startsWith('Queue is full')
    ) {
      return res.status(503).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to join queue' });
  }
});

/**
 * POST /queue/leave
 *
 * Behavior:
 * - Removes user from any waiting queue.
 * - Deletes the queue if it becomes empty.
 */
router.post('/leave', authenticateUser, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const result = await leaveQueue(uid);

    return res.status(200).json({
      left: result.left,
    });
  } catch (error) {
    console.error('Error leaving queue:', error);
    return res.status(500).json({ error: 'Failed to leave queue' });
  }
});

/**
 * GET /queue/status
 *
 * Behavior:
 * - Returns whether the user is queued.
 * - If queued, returns queue difficulty and teamSize.
 */
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const status = await getQueueStatus(uid);
    return res.status(200).json(status);
  } catch (error) {
    console.error('Error getting queue status:', error);
    return res.status(500).json({ error: 'Failed to get queue status' });
  }
});

export default router;
