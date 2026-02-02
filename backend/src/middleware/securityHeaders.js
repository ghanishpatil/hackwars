/**
 * Security Headers Middleware
 * 
 * Adds security headers to all responses to protect against common attacks.
 */

/**
 * Security headers middleware.
 * Adds HSTS, CSP, X-Frame-Options, and other security headers.
 */
export function securityHeaders(req, res, next) {
    // HTTP Strict Transport Security (HSTS)
    // Forces HTTPS for 1 year, including subdomains
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Content Security Policy (CSP)
    // Restricts resource loading to prevent XSS
    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for now
        "style-src 'self' 'unsafe-inline'", // Allow inline styles
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' wss: ws:", // Allow WebSocket connections
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ];
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    // X-Frame-Options: Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options: Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-XSS-Protection: Enable browser XSS filter (legacy, but doesn't hurt)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy: Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy: Disable unnecessary browser features
    const permissionsPolicy = [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
    ];
    res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));

    // Remove X-Powered-By header (don't advertise Express)
    res.removeHeader('X-Powered-By');

    next();
}
