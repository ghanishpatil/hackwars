/**
 * Match Engine HTTP Server
 *
 * Data plane: Docker lifecycle, health checks, flag validation, scoring.
 * All admin/control flows go Backend → Engine. Engine never exposes ports to public (nginx).
 * FLAG_SECRET and flags are never logged.
 * 
 * SECURITY: All endpoints (except /health) require authentication via shared secret.
 */

import dotenv from 'dotenv';
import express from 'express';
import { authenticateEngine } from './middleware/engineAuth.js';
import logger from './utils/logger.js';
import { MatchState, transitionToInitializing, transitionToEnded, getMatchResult } from './lifecycle/matchLifecycle.js';
import { runRecovery } from './lifecycle/recovery.js';
import { startSafetyCron } from './lifecycle/safetyCron.js';
import {
  createMatch,
  getMatch,
  getCurrentTick,
  recordFlagCapture,
  isFlagCaptured,
  getAllMatches,
  getMatchInfrastructure,
} from './state/stateStore.js';
import { validateFlag } from './flags/flagManager.js';
import { onFlagCaptured } from './scoring/scorer.js';
import { provisionMatch } from './services/matchProvisioner.js';
import { cleanupMatch, cleanupStaleMatches } from './services/matchCleanup.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 7000;
const MAX_CONCURRENT_MATCHES = Number(process.env.MAX_CONCURRENT_MATCHES) || 50;

// In-memory flag submission rate limit: key = matchId:teamId, strict per minute
const FLAG_RATE_WINDOW_MS = 60 * 1000;
const FLAG_RATE_MAX = Number(process.env.FLAG_SUBMIT_RATE_MAX) || 30;
const flagRateStore = new Map();

function flagRateLimit(req, res, next) {
  const { matchId, teamId } = req.body || {};
  if (!matchId || !teamId) return next();
  const key = `${matchId}:${teamId}`;
  const now = Date.now();
  let entry = flagRateStore.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + FLAG_RATE_WINDOW_MS };
    flagRateStore.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > FLAG_RATE_MAX) {
    console.warn(`[ENGINE] Flag rate limit exceeded matchId=${matchId} teamId=${teamId}`);
    return res.status(429).json({ status: 'rejected', reason: 'rate limit exceeded' });
  }
  next();
}

// Cleanup old rate limit keys periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of flagRateStore.entries()) {
    if (v.resetAt < now) flagRateStore.delete(k);
  }
}, FLAG_RATE_WINDOW_MS).unref();

const app = express();
app.use(express.json({ limit: '50kb' }));

// Health endpoint (no auth; used by backend/admin)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'match-engine' });
});

// Apply authentication to all other endpoints
app.use(authenticateEngine);

/**
 * POST /engine/match/provision
 *
 * Body: { matchId, difficulty, teamA: { teamId, players }, teamB: { teamId, players } }
 * Fetches default collection from backend, creates network + containers, injects flags.
 */
app.post('/engine/match/provision', async (req, res) => {
  try {
    const infrastructure = await provisionMatch(req.body || {});
    res.json({ success: true, infrastructure });
  } catch (err) {
    logger.error('[ENGINE] Provision failed:', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'Provisioning failed',
      // Don't expose internal details to client
    });
  }
});

/**
 * POST /engine/match/:matchId/cleanup
 */
app.post('/engine/match/:matchId/cleanup', async (req, res) => {
  try {
    const { matchId } = req.params;
    await cleanupMatch(matchId);
    res.json({ success: true });
  } catch (err) {
    logger.error('[ENGINE] Cleanup failed:', { matchId, error: err.message });
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

/**
 * GET /engine/match/:matchId/infrastructure
 */
app.get('/engine/match/:matchId/infrastructure', (req, res) => {
  const { matchId } = req.params;
  const infrastructure = getMatchInfrastructure(matchId);
  if (!infrastructure) {
    return res.status(404).json({ error: 'Infrastructure not found' });
  }
  res.json({ success: true, infrastructure });
});

/**
 * POST /engine/match/start
 *
 * Resource cap: reject if max concurrent matches exceeded.
 */
app.post('/engine/match/start', (req, res) => {
  const { matchId, difficulty, teamSize, teamA, teamB } = req.body || {};

  if (!matchId || typeof matchId !== 'string') {
    return res.status(400).json({ error: 'matchId is required' });
  }

  if (!difficulty || typeof difficulty !== 'string') {
    return res.status(400).json({ error: 'difficulty is required' });
  }

  if (!Number.isInteger(teamSize) || teamSize <= 0) {
    return res.status(400).json({ error: 'teamSize must be a positive integer' });
  }

  if (!Array.isArray(teamA) || !Array.isArray(teamB)) {
    return res.status(400).json({ error: 'teamA and teamB must be arrays' });
  }

  // Resource cap: max concurrent matches (non-ENDED)
  let activeCount = 0;
  for (const [, m] of getAllMatches()) {
    if (m.state !== MatchState.ENDED) activeCount += 1;
  }
  if (activeCount >= MAX_CONCURRENT_MATCHES) {
    console.warn(`[ENGINE] Rejected match start: max concurrent matches (${MAX_CONCURRENT_MATCHES}) reached`);
    return res.status(503).json({ error: 'Max concurrent matches reached' });
  }

  createMatch(matchId, {
    state: MatchState.CREATED,
    metadata: {
      difficulty,
      teamSize,
      teamA,
      teamB,
    },
  });

  transitionToInitializing(matchId).catch((error) => {
    console.error(`[ENGINE] Failed to initialize match ${matchId}:`, error.message);
  });

  return res.status(200).json({ status: 'accepted' });
});

/**
 * GET /engine/match/:matchId/status
 *
 * Returns:
 * {
 *   matchId,
 *   state: "CREATED" | "INITIALIZING" | "RUNNING" | "ENDING" | "ENDED"
 * }
 *
 * For this step, state will be whatever is stored in memory.
 */
app.get('/engine/match/:matchId/status', (req, res) => {
  const { matchId } = req.params;
  const match = getMatch(matchId);

  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  return res.status(200).json({
    matchId: match.matchId,
    state: match.state,
  });
});

/**
 * POST /engine/match/:matchId/stop
 *
 * Behavior:
 * - Triggers cleanup: stops containers, removes network.
 * - Updates the in-memory state to ENDED.
 * - Returns { status: "stopped" }.
 */
app.post('/engine/match/:matchId/stop', async (req, res) => {
  const { matchId } = req.params;
  const match = getMatch(matchId);

  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  // Trigger cleanup asynchronously
  transitionToEnded(matchId).catch((error) => {
    console.error(`Error stopping match ${matchId}:`, error);
  });

  return res.status(200).json({ status: 'stopped' });
});

/**
 * POST /engine/flag/submit
 *
 * Rate limited. Flag value is never logged.
 */
app.post('/engine/flag/submit', flagRateLimit, (req, res) => {
  const { matchId, teamId, flag } = req.body || {};

  if (!matchId || typeof matchId !== 'string') {
    return res.status(400).json({ status: 'rejected', reason: 'matchId is required' });
  }
  if (!teamId || typeof teamId !== 'string') {
    return res.status(400).json({ status: 'rejected', reason: 'teamId is required' });
  }
  if (!flag || typeof flag !== 'string') {
    return res.status(400).json({ status: 'rejected', reason: 'flag is required' });
  }

  // 1. Match exists and is RUNNING
  const match = getMatch(matchId);
  if (!match) {
    return res.status(200).json({ status: 'rejected', reason: 'match not found' });
  }
  if (match.state !== MatchState.RUNNING) {
    return res.status(200).json({ status: 'rejected', reason: 'match is not running' });
  }

  // 2 & 3. Flag format valid and HMAC valid, tick within allowed window
  let validation;
  try {
    const currentTick = getCurrentTick(matchId);
    validation = validateFlag(matchId, flag.trim(), currentTick);
  } catch (err) {
    return res.status(200).json({ status: 'rejected', reason: 'flag validation failed' });
  }

  if (!validation.valid) {
    return res.status(200).json({ status: 'rejected', reason: 'invalid or expired flag' });
  }

  const { serviceId, tick } = validation;

  // 4. Flag not already captured this tick
  if (isFlagCaptured(matchId, serviceId, tick)) {
    return res.status(200).json({ status: 'rejected', reason: 'flag already captured for this tick' });
  }

  // 5. Team is NOT submitting its own service flag
  const serviceOwner = serviceId.startsWith('teamA_') ? 'teamA' : serviceId.startsWith('teamB_') ? 'teamB' : null;
  if (serviceOwner !== null && serviceOwner === teamId) {
    return res.status(200).json({ status: 'rejected', reason: 'cannot submit own team flag' });
  }

  recordFlagCapture(matchId, serviceId, tick, teamId);
  onFlagCaptured(matchId, teamId, serviceId, tick).catch((err) => {
    console.error('onFlagCaptured error:', err);
  });

  return res.status(200).json({ status: 'accepted' });
});

/**
 * GET /engine/match/:matchId/result
 *
 * Returns full match result for backend (scores, stats, winner).
 * Only available when match state is ENDED. No persistence on engine side.
 */
app.get('/engine/match/:matchId/result', (req, res) => {
  const { matchId } = req.params;
  const result = getMatchResult(matchId);

  if (!result) {
    return res.status(404).json({ error: 'Match not found or not ended' });
  }

  return res.status(200).json(result);
});

// Stale match cleanup: every 30 minutes
const STALE_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
let staleCleanupInterval = null;

function startStaleCleanupCron() {
  if (staleCleanupInterval) return;
  staleCleanupInterval = setInterval(() => {
    cleanupStaleMatches().catch((err) => {
      console.error('[ENGINE] Stale cleanup failed:', err.message);
    });
  }, STALE_CLEANUP_INTERVAL_MS);
  console.log('[ENGINE] Stale cleanup cron started (every 30 min)');
}

// Run recovery on boot, then start safety cron, then listen
async function start() {
  try {
    await runRecovery();
  } catch (err) {
    console.error('[ENGINE] Recovery failed:', err.message);
    process.exitCode = 1;
  }
  startSafetyCron();
  startStaleCleanupCron();
  app.listen(PORT, () => {
    console.log(`Match Engine listening on port ${PORT}`);
  });
}

start();

