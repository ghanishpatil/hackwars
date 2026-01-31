/**
 * Authentication Routes
 *
 * Handles authentication-related endpoints.
 *
 * Scope for this step:
 * - Implement `/auth/me` only.
 */

import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { getOrCreateUser, updateUserProfile } from '../services/userService.js';

const router = express.Router();

/**
 * GET /auth/me
 *
 * Returns the authenticated user's profile.
 *
 * Flow:
 * 1. `authenticateUser` verifies Firebase ID token and populates `req.user`.
 * 2. `getOrCreateUser` ensures a Firestore user document exists and updates `lastLogin`.
 * 3. Respond with core competitive profile fields.
 */
router.get('/me', authenticateUser, async (req, res, next) => {
  try {
    const decodedToken = req.user;

    if (!decodedToken) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const userProfile = await getOrCreateUser(decodedToken);

    return res.json({
      uid: userProfile.uid,
      email: userProfile.email,
      username: userProfile.username,
      displayName: userProfile.displayName ?? '',
      phone: userProfile.phone ?? '',
      institute: userProfile.institute ?? '',
      track: userProfile.track ?? '',
      role: userProfile.role ?? 'user',
      mmr: userProfile.mmr,
      rank: userProfile.rank,
      rp: userProfile.rp,
      currentTeamId: userProfile.currentTeamId ?? null,
      onlineStatus: userProfile.onlineStatus ?? { isOnline: false, lastHeartbeat: null, currentPage: 'offline' },
    });
  } catch (error) {
    if (error.code === 'BANNED') {
      return res.status(403).json({ error: 'Your account has been banned.', code: 'banned' });
    }
    return next(error);
  }
});

/**
 * PATCH /auth/profile
 *
 * Update authenticated user's profile (displayName, phone, institute, track).
 * Used after signup to save extended profile; also for profile edits.
 */
router.patch('/profile', authenticateUser, async (req, res, next) => {
  try {
    const decodedToken = req.user;
    if (!decodedToken) return res.status(401).json({ error: 'Unauthenticated' });

    const { displayName, phone, institute, track } = req.body || {};
    await updateUserProfile(decodedToken, {
      displayName,
      phone,
      institute,
      track,
    });
    return res.json({ status: 'ok' });
  } catch (error) {
    return next(error);
  }
});

export default router;
