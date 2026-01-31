/**
 * In-memory rate limiting. No Redis. Fail fast with 429.
 *
 * Rules:
 * - /auth/* → strict (brute force prevention)
 * - /queue/* → moderate (spam prevention)
 * - Admin routes are not rate-limited here (adminGuard handles auth).
 */

const WINDOW_MS = 60 * 1000; // 1 minute

// key -> { count, resetAt }
const store = new Map();

function getKey(prefix, identifier) {
  return `${prefix}:${identifier || 'anon'}`;
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.resetAt < now) store.delete(k);
  }
}
setInterval(cleanup, WINDOW_MS).unref();

/**
 * Create rate limit middleware.
 *
 * @param {object} options
 * @param {number} options.maxRequests - Max requests per window
 * @param {number} options.windowMs - Window in ms (default 60000)
 * @param {function(req): string} [options.keyFn] - Key from request (default: IP + optional uid)
 */
function createRateLimiter({ maxRequests, windowMs = WINDOW_MS, keyFn }) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : getKey('default', req.ip || req.socket?.remoteAddress || 'unknown');
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((entry.resetAt - now) / 1000) });
      return;
    }

    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    next();
  };
}

// Auth: strict — per IP (no uid before auth). 10 req/min per IP.
const authLimit = createRateLimiter({
  maxRequests: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || WINDOW_MS,
  keyFn: (req) => getKey('auth', req.ip || req.socket?.remoteAddress || 'unknown'),
});

// Queue: per user after auth, fallback IP. 30 req/min.
const queueLimit = createRateLimiter({
  maxRequests: Number(process.env.RATE_LIMIT_QUEUE_MAX) || 30,
  windowMs: Number(process.env.RATE_LIMIT_QUEUE_WINDOW_MS) || WINDOW_MS,
  keyFn: (req) => getKey('queue', req.user?.uid || req.ip || req.socket?.remoteAddress || 'unknown'),
});

export { authLimit, queueLimit, createRateLimiter };
