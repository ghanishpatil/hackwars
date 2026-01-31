/**
 * Admin Guard Middleware
 *
 * Role is decided from the DB (Firestore user document), not from token claims.
 * Normal users have role "user"; only users with role "admin" in Firestore get access.
 */

import { authenticateUser } from './authMiddleware.js';
import { getUserRole } from '../services/userService.js';

/**
 * Require admin: authenticate then assert role === 'admin' from Firestore.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function adminGuard(req, res, next) {
  authenticateUser(req, res, async () => {
    const decoded = req.user;
    if (!decoded?.uid) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const role = await getUserRole(decoded.uid);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return next();
  });
}
