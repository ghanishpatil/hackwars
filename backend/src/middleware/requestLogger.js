/**
 * Request logging. Logs method, path, status, duration.
 * Route handlers should log matchId when applicable (no silent failures).
 */

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 500) {
      console.error(`[ERROR] ${msg}`);
    } else if (res.statusCode >= 400) {
      console.warn(`[WARN] ${msg}`);
    } else {
      console.log(`[REQUEST] ${msg}`);
    }
  });
  next();
}
