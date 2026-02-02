/**
 * Match Engine Authentication Middleware
 * 
 * Validates requests from backend using shared secret and optional IP whitelist.
 * Protects match-engine endpoints from unauthorized access.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const MATCH_ENGINE_SECRET = process.env.MATCH_ENGINE_SECRET || '';
const ALLOWED_IPS = (process.env.ALLOWED_BACKEND_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);

/**
 * Authenticate request using shared secret in Authorization header.
 * 
 * Expected header format: Authorization: Bearer <secret>
 * Or HMAC-based: Authorization: HMAC <timestamp>:<signature>
 */
export function authenticateEngine(req, res, next) {
    // Skip auth for health check
    if (req.path === '/health') {
        return next();
    }

    // Check IP whitelist if configured
    if (ALLOWED_IPS.length > 0) {
        const clientIp = req.ip || req.socket?.remoteAddress || '';
        const isAllowed = ALLOWED_IPS.some(allowedIp => {
            // Handle IPv6-mapped IPv4 addresses
            const normalizedClientIp = clientIp.replace('::ffff:', '');
            return normalizedClientIp === allowedIp || clientIp === allowedIp;
        });

        if (!isAllowed) {
            console.warn(`[ENGINE AUTH] Rejected request from unauthorized IP: ${clientIp}`);
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    // Check shared secret
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
        console.warn('[ENGINE AUTH] Missing Authorization header');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme === 'Bearer') {
        // Simple bearer token authentication
        if (!token || !MATCH_ENGINE_SECRET) {
            console.warn('[ENGINE AUTH] Invalid bearer token');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Timing-safe comparison to prevent timing attacks
        try {
            const tokenBuffer = Buffer.from(token);
            const secretBuffer = Buffer.from(MATCH_ENGINE_SECRET);

            if (tokenBuffer.length !== secretBuffer.length) {
                console.warn('[ENGINE AUTH] Token length mismatch');
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!timingSafeEqual(tokenBuffer, secretBuffer)) {
                console.warn('[ENGINE AUTH] Token mismatch');
                return res.status(401).json({ error: 'Unauthorized' });
            }
        } catch (err) {
            console.warn('[ENGINE AUTH] Token comparison failed:', err.message);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Authentication successful
        return next();
    }

    if (scheme === 'HMAC') {
        // HMAC-based authentication (more secure, prevents replay attacks)
        if (!token || !MATCH_ENGINE_SECRET) {
            console.warn('[ENGINE AUTH] Invalid HMAC token');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const [timestamp, signature] = token.split(':');

        if (!timestamp || !signature) {
            console.warn('[ENGINE AUTH] Invalid HMAC format');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check timestamp to prevent replay attacks (5 minute window)
        const now = Date.now();
        const requestTime = parseInt(timestamp, 10);
        const timeDiff = Math.abs(now - requestTime);

        if (timeDiff > 5 * 60 * 1000) {
            console.warn('[ENGINE AUTH] Request timestamp too old or in future');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify HMAC signature
        const expectedSignature = createHmac('sha256', MATCH_ENGINE_SECRET)
            .update(`${timestamp}:${req.method}:${req.path}`)
            .digest('hex');

        try {
            const sigBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expectedSignature);

            if (sigBuffer.length !== expectedBuffer.length) {
                console.warn('[ENGINE AUTH] Signature length mismatch');
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
                console.warn('[ENGINE AUTH] Signature mismatch');
                return res.status(401).json({ error: 'Unauthorized' });
            }
        } catch (err) {
            console.warn('[ENGINE AUTH] Signature comparison failed:', err.message);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Authentication successful
        return next();
    }

    console.warn(`[ENGINE AUTH] Unsupported auth scheme: ${scheme}`);
    return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Generate HMAC signature for backend to use.
 * This is a helper function for the backend client.
 */
export function generateHmacAuth(method, path, secret) {
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', secret)
        .update(`${timestamp}:${method}:${path}`)
        .digest('hex');

    return `HMAC ${timestamp}:${signature}`;
}
