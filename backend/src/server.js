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
import { initializeSockets } from './sockets/index.js';

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
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
