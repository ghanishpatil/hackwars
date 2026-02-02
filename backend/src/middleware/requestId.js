/**
 * Request ID Middleware
 * 
 * Generates a unique ID for each request for distributed tracing.
 * Adds the ID to request object and response headers.
 */

import { randomUUID } from 'crypto';

/**
 * Request ID middleware.
 * Generates or uses existing X-Request-ID header.
 */
export function requestId(req, res, next) {
    // Use existing request ID if provided, otherwise generate new one
    const id = req.headers['x-request-id'] || randomUUID();

    // Attach to request object for use in handlers
    req.id = id;

    // Add to response headers for client debugging
    res.setHeader('X-Request-ID', id);

    next();
}
