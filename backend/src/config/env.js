/**
 * Environment Configuration
 * 
 * Loads and validates environment variables.
 * Provides centralized access to configuration.
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Request body limit (bytes) — prevent large payloads
  bodyLimit: Number(process.env.BODY_LIMIT) || 100 * 1024, // 100KB default

  // Resource caps (graceful rejection when exceeded)
  maxConcurrentMatches: Number(process.env.MAX_CONCURRENT_MATCHES) || 50,
  maxQueueSizePerDifficulty: Number(process.env.MAX_QUEUE_SIZE_PER_DIFFICULTY) || 200,

  // Firebase Admin SDK Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },
  
  // CORS: single frontend (player + admin share same app; role decides dashboard)
  cors: {
    origin:
      process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
        : [process.env.CORS_ORIGIN || 'http://localhost:5173'],
    credentials: true,
  },

  // Socket.IO (same origin as frontend)
  socket: {
    cors: {
      origin:
        process.env.CORS_ORIGINS
          ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
          : [process.env.CORS_ORIGIN || 'http://localhost:5173'],
      credentials: true,
    },
  },
};

export default config;
