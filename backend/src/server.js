/**
 * Server Entry Point
 * 
 * Starts the Express server and Socket.IO server.
 * This is the control plane server.
 */

import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import config from './config/env.js';
import { validateEnvironment } from './middleware/validateEnv.js';
import { initializeSockets } from './sockets/index.js';
import logger from './utils/logger.js';

// Validate environment before starting
try {
  validateEnvironment();
} catch (err) {
  console.error('Environment validation failed:');
  console.error(err.message);
  process.exit(1);
}

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, config.socket);
app.set('io', io);

// Initialize socket event handlers
initializeSockets(io);

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});
