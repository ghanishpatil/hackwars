/**
 * Structured Logger
 * 
 * Provides structured logging with security event support.
 * Uses Winston for production-grade logging.
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, requestId, ...meta }) => {
    let log = `${timestamp} [${level}]`;

    if (requestId) {
        log += ` [${requestId}]`;
    }

    log += `: ${message}`;

    // Add metadata if present
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }

    return log;
});

// Create Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
    ),
    defaultMeta: { service: 'backend' },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: combine(
                colorize(),
                consoleFormat
            ),
        }),
    ],
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.json(),
    }));

    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.json(),
    }));

    logger.add(new winston.transports.File({
        filename: 'logs/security.log',
        level: 'warn',
        format: winston.format.json(),
    }));
}

/**
 * Log security event.
 * Always logged at 'warn' level for visibility.
 */
export function logSecurityEvent(event, details = {}) {
    logger.warn('SECURITY_EVENT', {
        event,
        ...details,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Log authentication failure.
 */
export function logAuthFailure(reason, details = {}) {
    logSecurityEvent('AUTH_FAILURE', {
        reason,
        ...details,
    });
}

/**
 * Log authorization failure.
 */
export function logAuthzFailure(userId, resource, action, details = {}) {
    logSecurityEvent('AUTHZ_FAILURE', {
        userId,
        resource,
        action,
        ...details,
    });
}

/**
 * Log admin action.
 */
export function logAdminAction(adminId, action, target, details = {}) {
    logSecurityEvent('ADMIN_ACTION', {
        adminId,
        action,
        target,
        ...details,
    });
}

/**
 * Log rate limit violation.
 */
export function logRateLimitViolation(identifier, endpoint, details = {}) {
    logSecurityEvent('RATE_LIMIT_VIOLATION', {
        identifier,
        endpoint,
        ...details,
    });
}

/**
 * Log suspicious activity.
 */
export function logSuspiciousActivity(type, details = {}) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', {
        type,
        ...details,
    });
}

export default logger;
