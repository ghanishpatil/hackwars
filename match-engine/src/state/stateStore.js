/**
 * State Store
 *
 * In-memory store for match state and metadata inside the match engine.
 *
 * Responsibilities:
 * - Track match lifecycle state for each `matchId`.
 * - Store opaque metadata passed from the control plane.
 * - Provide simple CRUD-style helpers for other modules.
 *
 * No persistence and no external side effects.
 */

// In-memory map: matchId -> { matchId, state, metadata }
const matchStates = new Map();

/**
 * Create a new match entry in the state store.
 *
 * @param {string} matchId
 * @param {{ state: string; metadata: any }} options
 */
export function createMatch(matchId, { state, metadata }) {
  matchStates.set(matchId, {
    matchId,
    state,
    metadata: metadata || {},
  });
}

/**
 * Update the lifecycle state for a match.
 *
 * @param {string} matchId
 * @param {string} state
 */
export function updateState(matchId, state) {
  const current = matchStates.get(matchId);
  if (!current) {
    return;
  }

  matchStates.set(matchId, {
    ...current,
    state,
  });
}

/**
 * Update metadata for a match.
 *
 * @param {string} matchId
 * @param {any} metadataUpdates - Object to merge into existing metadata
 */
export function updateMetadata(matchId, metadataUpdates) {
  const current = matchStates.get(matchId);
  if (!current) {
    return;
  }

  matchStates.set(matchId, {
    ...current,
    metadata: {
      ...current.metadata,
      ...metadataUpdates,
    },
  });
}

/**
 * Initialize service health tracking for a match.
 *
 * Creates services object in metadata to track:
 * - status: "UP" | "DOWN"
 * - lastCheckedAt: timestamp
 * - consecutiveFailures: number
 *
 * @param {string} matchId
 * @param {string[]} serviceIds - Array of service IDs (e.g., ["teamA_<matchId>", "teamB_<matchId>"])
 */
export function initializeServiceHealth(matchId, serviceIds) {
  const current = matchStates.get(matchId);
  if (!current) {
    return;
  }

  const services = {};
  for (const serviceId of serviceIds) {
    services[serviceId] = {
      status: 'UP',
      lastCheckedAt: null,
      consecutiveFailures: 0,
    };
  }

  updateMetadata(matchId, { services });
}

/**
 * Update service health status for a match.
 *
 * @param {string} matchId
 * @param {string} serviceId
 * @param {"UP" | "DOWN"} status
 */
export function updateServiceHealth(matchId, serviceId, status) {
  const current = matchStates.get(matchId);
  if (!current) {
    return;
  }

  const metadata = current.metadata || {};
  const services = metadata.services || {};

  if (!services[serviceId]) {
    services[serviceId] = {
      status: 'UP',
      lastCheckedAt: null,
      consecutiveFailures: 0,
    };
  }

  const previousStatus = services[serviceId].status;
  services[serviceId].status = status;
  services[serviceId].lastCheckedAt = Date.now();

  if (status === 'DOWN') {
    services[serviceId].consecutiveFailures =
      previousStatus === 'DOWN'
        ? services[serviceId].consecutiveFailures + 1
        : 1;
  } else {
    services[serviceId].consecutiveFailures = 0;
  }

  updateMetadata(matchId, { services });
}

/**
 * Get service health state for a match.
 *
 * @param {string} matchId
 * @returns {Object<string, { status: string; lastCheckedAt: number | null; consecutiveFailures: number }> | null}
 */
export function getServiceHealth(matchId) {
  const match = matchStates.get(matchId);
  if (!match) {
    return null;
  }

  return match.metadata?.services || null;
}

/**
 * Get current SLA tick number for a match.
 *
 * @param {string} matchId
 * @returns {number}
 */
export function getCurrentTick(matchId) {
  const match = matchStates.get(matchId);
  if (!match) {
    return 0;
  }
  const tick = match.metadata?.currentTick;
  return typeof tick === 'number' && tick >= 0 ? tick : 0;
}

/**
 * Set current SLA tick number for a match.
 *
 * @param {string} matchId
 * @param {number} tick
 */
export function setCurrentTick(matchId, tick) {
  updateMetadata(matchId, { currentTick: tick });
}

/**
 * Increment SLA tick for a match (called after each tick).
 *
 * @param {string} matchId
 * @returns {number} New tick value
 */
export function incrementTick(matchId) {
  const current = getCurrentTick(matchId);
  const next = current + 1;
  setCurrentTick(matchId, next);
  return next;
}

/**
 * Record a flag capture for (serviceId, tick).
 * Prevents duplicate scoring; one capture per tick per service.
 *
 * @param {string} matchId
 * @param {string} serviceId
 * @param {number} tick
 * @param {string} teamId
 */
export function recordFlagCapture(matchId, serviceId, tick, teamId) {
  const current = matchStates.get(matchId);
  if (!current) {
    return;
  }

  const metadata = current.metadata || {};
  const flagsCaptured = metadata.flagsCaptured || {};

  if (!flagsCaptured[serviceId]) {
    flagsCaptured[serviceId] = {};
  }
  flagsCaptured[serviceId][String(tick)] = { capturedBy: teamId, tick };

  updateMetadata(matchId, { flagsCaptured });
}

/**
 * Check if a flag for (serviceId, tick) has already been captured.
 *
 * @param {string} matchId
 * @param {string} serviceId
 * @param {number} tick
 * @returns {boolean}
 */
export function isFlagCaptured(matchId, serviceId, tick) {
  const match = matchStates.get(matchId);
  if (!match) {
    return false;
  }
  const flagsCaptured = match.metadata?.flagsCaptured || {};
  const serviceCaptures = flagsCaptured[serviceId] || {};
  return serviceCaptures[String(tick)] != null;
}

/** Score bounds to prevent overflow / negative infinity */
const SCORE_MIN = -1_000_000;
const SCORE_MAX = 1_000_000;

/**
 * Initialize scoring state for a match (scores and uptime stats).
 * Called when match enters RUNNING.
 *
 * @param {string} matchId
 * @param {string[]} serviceIds - e.g. ["teamA_<matchId>", "teamB_<matchId>"]
 */
export function initializeScoring(matchId, serviceIds) {
  const current = matchStates.get(matchId);
  if (!current) {
    return;
  }

  const scores = { teamA: 0, teamB: 0 };

  const uptimeStats = {
    teamA: {},
    teamB: {},
  };
  for (const serviceId of serviceIds) {
    const teamId = serviceId.startsWith('teamA_') ? 'teamA' : 'teamB';
    uptimeStats[teamId][serviceId] = { upTicks: 0, downTicks: 0 };
  }

  updateMetadata(matchId, { scores, uptimeStats });
}

/**
 * Add points to a team's score (deterministic, bounded).
 *
 * @param {string} matchId
 * @param {"teamA" | "teamB"} teamId
 * @param {number} delta
 */
export function addScore(matchId, teamId, delta) {
  const current = matchStates.get(matchId);
  if (!current) {
    return;
  }

  const metadata = current.metadata || {};
  const scores = metadata.scores || { teamA: 0, teamB: 0 };

  if (teamId !== 'teamA' && teamId !== 'teamB') {
    return;
  }

  const next = Math.max(SCORE_MIN, Math.min(SCORE_MAX, (scores[teamId] || 0) + delta));
  scores[teamId] = next;
  updateMetadata(matchId, { scores });
}

/**
 * Update uptime/downtime stats for a service and return current stats.
 *
 * @param {string} matchId
 * @param {string} serviceId
 * @param {"UP" | "DOWN"} status
 * @returns {{ upTicks: number; downTicks: number } | null}
 */
export function updateUptimeStats(matchId, serviceId, status) {
  const current = matchStates.get(matchId);
  if (!current) {
    return null;
  }

  const metadata = current.metadata || {};
  const uptimeStats = metadata.uptimeStats || { teamA: {}, teamB: {} };
  const teamId = serviceId.startsWith('teamA_') ? 'teamA' : 'teamB';
  const teamStats = uptimeStats[teamId] || {};
  const serviceStats = teamStats[serviceId] || { upTicks: 0, downTicks: 0 };

  if (status === 'UP') {
    serviceStats.upTicks = (serviceStats.upTicks || 0) + 1;
  } else {
    serviceStats.downTicks = (serviceStats.downTicks || 0) + 1;
  }

  teamStats[serviceId] = serviceStats;
  uptimeStats[teamId] = teamStats;
  updateMetadata(matchId, { uptimeStats });

  return serviceStats;
}

/**
 * Get current scores for a match.
 *
 * @param {string} matchId
 * @returns {{ teamA: number; teamB: number } | null}
 */
export function getScores(matchId) {
  const match = matchStates.get(matchId);
  if (!match) {
    return null;
  }
  const scores = match.metadata?.scores;
  if (!scores) {
    return { teamA: 0, teamB: 0 };
  }
  return {
    teamA: typeof scores.teamA === 'number' ? scores.teamA : 0,
    teamB: typeof scores.teamB === 'number' ? scores.teamB : 0,
  };
}

/**
 * Get uptime stats for a match.
 *
 * @param {string} matchId
 * @returns {Object<string, Object<string, { upTicks: number; downTicks: number }>> | null}
 */
export function getUptimeStats(matchId) {
  const match = matchStates.get(matchId);
  if (!match) {
    return null;
  }
  return match.metadata?.uptimeStats || null;
}

/**
 * Store final match result (winner, loser, draw).
 * Called when match enters ENDING; scores are frozen.
 *
 * @param {string} matchId
 * @param {{ winner?: string; loser?: string; draw?: boolean }} result
 */
export function setFinalResult(matchId, result) {
  updateMetadata(matchId, { finalResult: result });
}

/**
 * Get final result for a match (if set).
 *
 * @param {string} matchId
 * @returns {{ winner?: string; loser?: string; draw?: boolean } | null}
 */
export function getFinalResult(matchId) {
  const match = matchStates.get(matchId);
  if (!match) {
    return null;
  }
  return match.metadata?.finalResult ?? null;
}

/**
 * Get a match entry.
 *
 * @param {string} matchId
 * @returns {{ matchId: string; state: string; metadata: any } | null}
 */
export function getMatch(matchId) {
  return matchStates.get(matchId) || null;
}

/**
 * Remove a match entry from the store.
 *
 * @param {string} matchId
 */
export function deleteMatch(matchId) {
  matchStates.delete(matchId);
}

/**
 * Get all matches.
 *
 * @returns {Map<string, { matchId: string; state: string; metadata: any }>}
 */
export function getAllMatches() {
  return matchStates;
}

// ——— Match infrastructure (Phase 2: provisioned containers + network) ———
const matchInfrastructure = new Map();

/**
 * Store infrastructure for a match (network + team containers).
 *
 * @param {string} matchId
 * @param {object} infrastructure — { matchId, networkId, subnet, teamA: { teamId, containers }, teamB: { teamId, containers }, provisionedAt }
 */
export function setMatchInfrastructure(matchId, infrastructure) {
  matchInfrastructure.set(matchId, infrastructure);
}

/**
 * Get infrastructure for a match.
 *
 * @param {string} matchId
 * @returns {object | null}
 */
export function getMatchInfrastructure(matchId) {
  return matchInfrastructure.get(matchId) || null;
}

/**
 * Remove infrastructure from store (after cleanup).
 *
 * @param {string} matchId
 */
export function deleteMatchInfrastructure(matchId) {
  matchInfrastructure.delete(matchId);
}

/**
 * Get list of service IDs for a match (from infrastructure). Used by flag validation.
 *
 * @param {string} matchId
 * @returns {string[] | null} Array of serviceIds or null if no infrastructure
 */
export function getServiceIdsFromInfrastructure(matchId) {
  const infra = matchInfrastructure.get(matchId);
  if (!infra) return null;
  const ids = [];
  for (const c of infra.teamA?.containers || []) {
    if (c.serviceId) ids.push(c.serviceId);
  }
  for (const c of infra.teamB?.containers || []) {
    if (c.serviceId) ids.push(c.serviceId);
  }
  return ids.length ? ids : null;
}

