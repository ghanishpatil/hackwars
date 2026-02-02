/**
 * Structured Logger for Match Engine
 * 
 * Provides structured logging with request tracing.
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, requestId, matchId, ...meta }) => {
    let log = `${timestamp} [${level}]`;

    if (requestId) {
        log += ` [req:${requestId}]`;
    }

    if (matchId) {
        log += ` [match:${matchId}]`;
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
    defaultMeta: { service: 'match-engine' },
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
}

export default logger;
