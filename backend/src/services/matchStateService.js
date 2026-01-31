/**
 * Match State Service
 *
 * Periodically polls the match engine for match status and
 * broadcasts state changes to connected clients via Socket.IO.
 *
 * Responsibilities:
 * - One polling loop per match (no per-user timers).
 * - Cache last known state per match.
 * - Emit `match_state` only when the state changes.
 */

import { getMatchStatus } from './engineClient.js';

// Socket.IO server reference, configured at startup.
let io = null;

// Per-match trackers: matchId -> { interval, lastState }
const trackers = new Map();

// Map engine-level states to client-facing states.
// Engine states: CREATED | INITIALIZING | RUNNING | ENDING | ENDED
// Client-facing: "initializing" | "running" | "ended"
function toClientState(engineState) {
  switch (engineState) {
    case 'CREATED':
    case 'INITIALIZING':
      return 'initializing';
    case 'RUNNING':
      return 'running';
    case 'ENDING':
    case 'ENDED':
      return 'ended';
    default:
      return null;
  }
}

function emitMatchState(matchId, state) {
  if (!io || !state) return;

  const room = `match:${matchId}`;
  io.of('/match').to(room).emit('match_state', {
    matchId,
    state,
  });
}

/**
 * Register the Socket.IO server instance.
 *
 * Called once from the socket initialization layer.
 *
 * @param {import('socket.io').Server} socketServer
 */
export function registerSocketServer(socketServer) {
  io = socketServer;
}

/**
 * Start polling the match engine for a specific match.
 *
 * Idempotent: calling multiple times for the same matchId is a no-op.
 *
 * @param {string} matchId
 * @param {'initializing' | 'running' | 'ended'} [initialState]
 */
export function startMatchStateTracking(matchId, initialState) {
  if (!io) {
    console.warn(
      'Socket.IO server not registered; cannot start match state tracking.'
    );
    return;
  }

  if (trackers.has(matchId)) {
    return;
  }

  const tracker = {
    lastState: initialState || null,
    interval: null,
  };

  // Optionally emit initial state immediately.
  if (initialState) {
    emitMatchState(matchId, initialState);
  }

  const intervalMs = 3000;

  tracker.interval = setInterval(async () => {
    try {
      const status = await getMatchStatus(matchId);
      if (!status || !status.state) {
        return;
      }

      const clientState = toClientState(status.state);
      if (!clientState || clientState === tracker.lastState) {
        return;
      }

      tracker.lastState = clientState;
      emitMatchState(matchId, clientState);

      if (clientState === 'ended') {
        stopMatchStateTracking(matchId);
      }
    } catch (error) {
      // Engine downtime should not crash the backend.
      console.error('Failed to poll match engine status:', error);
    }
  }, intervalMs);

  trackers.set(matchId, tracker);
}

/**
 * Stop polling for a specific match.
 *
 * @param {string} matchId
 */
export function stopMatchStateTracking(matchId) {
  const tracker = trackers.get(matchId);
  if (!tracker) {
    return;
  }

  if (tracker.interval) {
    clearInterval(tracker.interval);
  }

  trackers.delete(matchId);
}

