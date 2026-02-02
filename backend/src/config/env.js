/**
 * Environment Configuration
 * 
 * Loads and validates environment variables.
 * Provides centralized access to configuration.
 * Uses validateEnv for startup validation.
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

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
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '', // e.g. your-project.appspot.com
  },

  // CORS: CORS_ORIGINS = comma-separated list; CORS_ORIGIN = single origin (or comma-separated, we split both)
  cors: {
    origin: (() => {
      const list = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:5173';
      return list.split(',').map((s) => s.trim()).filter(Boolean);
    })(),
    credentials: true,
  },

  // Socket.IO (same origin as frontend)
  socket: {
    cors: {
      origin: (() => {
        const list = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:5173';
        return list.split(',').map((s) => s.trim()).filter(Boolean);
      })(),
      credentials: true,
    },
  },

  // Match Engine Configuration
  matchEngine: {
    url: process.env.MATCH_ENGINE_URL || 'http://localhost:7000',
    secret: process.env.MATCH_ENGINE_SECRET || '',
  },
};

export default config;

