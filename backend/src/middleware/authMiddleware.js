/**
 * Authentication Middleware
 *
 * Verifies Firebase Authentication ID tokens and attaches the decoded
 * user to `req.user`.
 *
 * Expected client behavior:
 * - Client authenticates with Firebase Auth (email/password, OAuth, etc.)
 * - Client sends ID token in the `Authorization` header:
 *   `Authorization: Bearer <idToken>`
 */

import { getAuth } from '../firebase/firebaseAdmin.js';
import { logAuthFailure } from '../utils/logger.js';

/**
 * Authenticate user via Firebase ID token.
 *
 * Responsibilities:
 * - Read Authorization header
 * - Verify Firebase ID token
 * - Attach decoded token to req.user
 * - Reject if missing/invalid
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      logAuthFailure('missing_header', {
        requestId: req.id,
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      logAuthFailure('invalid_header_format', {
        requestId: req.id,
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({ error: 'Invalid Authorization header format' });
    }

    const auth = getAuth();

    if (!auth) {
      // Misconfiguration: Firebase Admin not initialized
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);

    // Attach decoded token to request
    req.user = decodedToken;

    return next();
  } catch (error) {
    logAuthFailure('token_verification_failed', {
      requestId: req.id,
      ip: req.ip,
      path: req.path,
      error: error.message,
      userAgent: req.headers['user-agent'],
    });

    // Treat all verification failures as 401
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require authentication middleware.
 *
 * This wrapper exists for compatibility with other routes that
 * already use `requireAuth`. It simply delegates to `authenticateUser`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, res, next) {
  return authenticateUser(req, res, next);
}
