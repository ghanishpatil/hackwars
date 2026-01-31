/**
 * Scoring Service
 *
 * Single source of truth for A&D match scoring.
 * Rewards offense (flags), rewards defense (uptime), penalizes downtime.
 * Deterministic; no Firestore, no ELO, no admin overrides.
 */

import {
  updateServiceHealth,
  getMatch,
  incrementTick,
  initializeScoring,
  addScore,
  updateUptimeStats,
  getScores as getScoresFromStore,
} from '../state/stateStore.js';

/** Flag capture points by difficulty (one flag per service per tick; opponent only) */
const FLAG_POINTS = {
  easy: 10,
  medium: 15,
  hard: 25,
  insane: 40,
};

/** Uptime points per SLA tick, per service (pass health check, within timeout) */
const UPTIME_POINTS = {
  easy: 1,
  medium: 2,
  hard: 3,
  insane: 4,
};

/** Downtime penalty per SLA tick, per service (DoS does NOT give attacker bonus) */
const DOWNTIME_PENALTY = {
  easy: -1,
  medium: -2,
  hard: -4,
  insane: -6,
};

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'];

/**
 * Derive normalized difficulty from match metadata.
 *
 * @param {{ metadata?: { difficulty?: string } }} match
 * @returns {keyof typeof FLAG_POINTS}
 */
function getDifficulty(match) {
  const raw = (match?.metadata?.difficulty || 'easy').toString().trim().toLowerCase();
  return VALID_DIFFICULTIES.includes(raw) ? raw : 'easy';
}

/**
 * Get owner team for a service (teamA_<matchId> => teamA, teamB_<matchId> => teamB).
 *
 * @param {string} serviceId
 * @returns {"teamA" | "teamB" | null}
 */
function getServiceOwner(serviceId) {
  if (serviceId.startsWith('teamA_')) return 'teamA';
  if (serviceId.startsWith('teamB_')) return 'teamB';
  return null;
}

/**
 * Record a tick of health check results.
 * Updates service health, uptime/downtime stats, and applies tick-based score changes.
 *
 * @param {string} matchId
 * @param {Array<{ serviceId: string; status: "UP" | "DOWN"; responseTimeMs: number }>} healthResults
 * @returns {Promise<void>}
 */
export async function recordTick(matchId, healthResults) {
  const match = getMatch(matchId);
  if (!match) {
    console.warn(`Cannot record tick for non-existent match: ${matchId}`);
    return;
  }

  const difficulty = getDifficulty(match);

  // 1. Update service health state
  for (const result of healthResults) {
    updateServiceHealth(matchId, result.serviceId, result.status);
  }

  // 2. Update uptime/downtime stats and apply tick-based score
  for (const result of healthResults) {
    updateUptimeStats(matchId, result.serviceId, result.status);
    const owner = getServiceOwner(result.serviceId);
    if (owner) {
      if (result.status === 'UP') {
        addScore(matchId, owner, UPTIME_POINTS[difficulty]);
      } else {
        addScore(matchId, owner, DOWNTIME_PENALTY[difficulty]);
      }
    }
  }

  // 3. Advance SLA tick (flags rotate every tick)
  incrementTick(matchId);
}

/**
 * Hook called when a flag is successfully validated and recorded.
 * Applies flag score immediately (one flag per service per tick; opponent only).
 *
 * @param {string} matchId
 * @param {string} teamId
 * @param {string} serviceId
 * @param {number} tick
 * @returns {Promise<void>}
 */
export async function onFlagCaptured(matchId, teamId, serviceId, tick) {
  const match = getMatch(matchId);
  if (!match) {
    return;
  }

  const difficulty = getDifficulty(match);
  const points = FLAG_POINTS[difficulty] ?? FLAG_POINTS.easy;

  if (teamId === 'teamA' || teamId === 'teamB') {
    addScore(matchId, teamId, points);
  }
}

/**
 * Return current scores for a match.
 *
 * @param {string} matchId
 * @returns {{ teamA: number; teamB: number } | null}
 */
export function getScores(matchId) {
  return getScoresFromStore(matchId);
}
