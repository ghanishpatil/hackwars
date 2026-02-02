/**
 * Express Application Setup
 *
 * Configures Express app with middleware and routes.
 * This is the control plane application.
 */

import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import { authLimit, queueLimit } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requestId } from './middleware/requestId.js';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.js';
import queueRoutes from './routes/queue.js';
import matchRoutes from './routes/match.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import reportRoutes from './routes/report.js';
import teamsRoutes from './routes/teams.js';
import presenceRoutes from './routes/presence.js';
import challengesRoutes from './routes/challenges.js';
import serviceTemplatesRoutes from './routes/serviceTemplates.js';
import engineApiRoutes from './routes/engineApi.js';
import { adminGuard } from './middleware/adminGuard.js';

const app = express();

// Security middleware (first)
app.use(securityHeaders);
app.use(requestId);

// Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

// Request logging (matchId in route handlers when applicable)
app.use(requestLogger);

// Health check route (no rate limit)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'backend' });
});

// Root route — so visiting the deployed URL shows OK (Render and browsers)
app.get('/', (req, res) => {
  res.json({ service: 'backend', status: 'ok', health: '/health' });
});

// API Routes — rate limits: auth strict, queue moderate; admin not limited
app.use('/auth', authLimit, authRoutes);
app.use('/queue', queueLimit, queueRoutes);
app.use('/match', matchRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/service-templates', adminGuard, serviceTemplatesRoutes); // Moved under /admin for consistency
app.use('/api', publicRoutes); // GET /api/announcement, GET /api/feature-flags
app.use('/report', authLimit, reportRoutes); // POST /report (authenticated)
app.use('/teams', authLimit, teamsRoutes);   // POST /teams/create, /join, /leave, DELETE /:id/disband, GET /:id
app.use('/presence', queueLimit, presenceRoutes); // POST /presence/heartbeat, GET /presence/online
app.use('/challenges', authLimit, challengesRoutes); // POST /challenges/send, POST /:id/respond, GET /received, /sent
app.use('/api/match', engineApiRoutes); // Engine: default-collection, infrastructure (internal)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  // Log error with request ID
  logger.error('Request error:', {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't expose internal error details in production
  const message = config.isProduction ? 'Internal server error' : err.message;
  res.status(err.status || 500).json({ error: message });
});

export default app;
