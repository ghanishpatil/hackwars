/**
 * Match Lifecycle State Machine
 *
 * Defines the canonical states and transitions for a match.
 *
 * This file handles Docker infrastructure lifecycle:
 * - CREATED -> INITIALIZING: Create network, start containers
 * - ENDING -> ENDED: Stop containers, remove network
 *
 * No gameplay logic, no scoring logic, no timers.
 */

import { getDockerClient } from '../docker/dockerClient.js';
import { createMatchNetwork, removeMatchNetwork } from '../docker/networkManager.js';
import {
  updateState,
  updateMetadata,
  getMatch,
  getScores,
  getUptimeStats,
  getFinalResult,
  initializeServiceHealth,
  initializeScoring,
  setCurrentTick,
  setFinalResult,
} from '../state/stateStore.js';
import { checkMatchHealth } from '../health/gamebot.js';
import { recordTick } from '../scoring/scorer.js';

// Track active tick intervals per match: matchId -> interval reference
const tickIntervals = new Map();

const SLA_TICK_INTERVAL_MS = 30000; // 30 seconds

// High-level states for a match lifecycle.
export const MatchState = {
  /**
   * Match has been created by the control plane and registered
   * in the match engine, but no infrastructure work has started.
   */
  CREATED: 'CREATED',

  /**
   * Match engine is preparing the environment.
   * In this step:
   * - Creates Docker network
   * - Starts teamA and teamB containers
   */
  INITIALIZING: 'INITIALIZING',

  /**
   * Match is live and accepting player traffic.
   * Gameplay and scoring would occur during this phase,
   * but are explicitly out of scope for this step.
   */
  RUNNING: 'RUNNING',

  /**
   * Match is in the process of shutting down.
   * In this step:
   * - Stops containers
   * - Removes containers
   * - Removes network
   */
  ENDING: 'ENDING',

  /**
   * Match is fully terminated.
   * No further actions should be performed for this match.
   */
  ENDED: 'ENDED',
};

/**
 * Documented state transitions:
 *
 * - CREATED      -> INITIALIZING
 *   When the engine accepts a `start` request for a new match.
 *   Triggers: create network, start containers
 *
 * - INITIALIZING -> RUNNING
 *   When all required environment setup has completed successfully.
 *
 * - RUNNING      -> ENDING
 *   When the control plane requests the match to stop, or when the
 *   match naturally reaches its end condition.
 *
 * - ENDING       -> ENDED
 *   When all shutdown/cleanup tasks are complete.
 */

/**
 * Validate whether a transition between two states is allowed.
 * This helper is intentionally simple and synchronous.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isValidTransition(from, to) {
  const allowed = {
    [MatchState.CREATED]: [MatchState.INITIALIZING],
    [MatchState.INITIALIZING]: [MatchState.RUNNING, MatchState.ENDED],
    [MatchState.RUNNING]: [MatchState.ENDING, MatchState.ENDED],
    [MatchState.ENDING]: [MatchState.ENDED],
    [MatchState.ENDED]: [],
  };

  return (allowed[from] || []).includes(to);
}

/**
 * Start Docker containers for a match.
 *
 * Creates:
 * - teamA_<matchId> container
 * - teamB_<matchId> container
 *
 * Both containers:
 * - Use nginx:alpine image
 * - Connected to match_<matchId> network
 * - Expose /health endpoint (via custom nginx config)
 *
 * @param {string} matchId
 * @param {string} networkId
 * @returns {Promise<{ teamA: string; teamB: string }>} Container IDs
 */
async function startMatchContainers(matchId, networkId) {
  const docker = getDockerClient();
  const networkName = `match_${matchId}`;

  // Nginx config that responds with HTTP 200 on /health
  // Using heredoc-style approach for reliability
  const nginxConfigScript = `cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;

    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }

    location / {
        return 404;
    }
}
EOF
nginx -g 'daemon off;'`;

  const containerConfig = {
    Image: 'nginx:alpine',
    name: `teamA_${matchId}`,
    HostConfig: {
      NetworkMode: networkName,
    },
    Cmd: ['sh', '-c', nginxConfigScript],
    AttachStdout: false,
    AttachStderr: false,
  };

  try {
    // Create and start teamA container
    const teamAContainer = await docker.createContainer(containerConfig);
    await teamAContainer.start();
    const teamAId = teamAContainer.id;

    // Create and start teamB container
    containerConfig.name = `teamB_${matchId}`;
    const teamBContainer = await docker.createContainer(containerConfig);
    await teamBContainer.start();
    const teamBId = teamBContainer.id;

    console.log(
      `Started containers for match ${matchId}: teamA=${teamAId}, teamB=${teamBId}`
    );

    return { teamA: teamAId, teamB: teamBId };
  } catch (error) {
    console.error(`Failed to start containers for match ${matchId}:`, error);
    throw error;
  }
}

/**
 * Stop and remove containers for a match.
 *
 * @param {string} matchId
 * @param {{ teamA: string; teamB: string }} containerIds
 * @returns {Promise<void>}
 */
async function stopMatchContainers(matchId, containerIds) {
  const docker = getDockerClient();

  const containerNames = [`teamA_${matchId}`, `teamB_${matchId}`];

  for (const containerName of containerNames) {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: JSON.stringify({ name: [containerName] }),
      });

      if (containers.length === 0) {
        console.log(`Container ${containerName} not found, skipping`);
        continue;
      }

      const container = docker.getContainer(containers[0].Id);

      // Stop if running
      try {
        await container.stop();
        console.log(`Stopped container: ${containerName}`);
      } catch (err) {
        // Container might already be stopped
        if (err.statusCode !== 304) {
          console.warn(`Failed to stop container ${containerName}:`, err.message);
        }
      }

      // Remove container
      try {
        await container.remove();
        console.log(`Removed container: ${containerName}`);
      } catch (err) {
        console.warn(`Failed to remove container ${containerName}:`, err.message);
      }
    } catch (error) {
      console.error(`Error cleaning up container ${containerName}:`, error);
      // Continue with cleanup - best effort
    }
  }
}

/**
 * Clean up Docker infra for a match by matchId only (no state required).
 * Used by recovery to clean orphans. Stops containers by name, removes network.
 *
 * @param {string} matchId
 * @returns {Promise<void>}
 */
export async function cleanupMatchInfraByMatchId(matchId) {
  await stopMatchContainers(matchId, {});
  await removeMatchNetwork(matchId);
  console.log(`[RECOVERY] Cleaned up orphan infra for match ${matchId}`);
}

/**
 * Transition match from CREATED to INITIALIZING.
 *
 * Creates Docker network and starts containers.
 *
 * @param {string} matchId
 * @returns {Promise<void>}
 */
export async function transitionToInitializing(matchId) {
  const match = getMatch(matchId);
  if (!match || match.state !== MatchState.CREATED) {
    throw new Error(`Cannot transition to INITIALIZING: match not in CREATED state`);
  }

  try {
    updateState(matchId, MatchState.INITIALIZING);

    // Create Docker network
    const networkId = await createMatchNetwork(matchId);

    // Start containers
    const containerIds = await startMatchContainers(matchId, networkId);

    // Store container IDs and network ID in metadata
    updateMetadata(matchId, {
      networkId,
      containerIds,
    });

    // Initialize service health tracking
    const serviceIds = [`teamA_${matchId}`, `teamB_${matchId}`];
    initializeServiceHealth(matchId, serviceIds);

    // Initialize scoring (scores and uptime stats)
    initializeScoring(matchId, serviceIds);

    // Initialize SLA tick counter (flags valid for current and previous tick)
    setCurrentTick(matchId, 0);

    // Transition to RUNNING after successful initialization (scoring active)
    updateState(matchId, MatchState.RUNNING);
    updateMetadata(matchId, { createdAt: Date.now() }); // For max match duration / safety cron
    console.log(`Match ${matchId} initialized and running`);

    // Start SLA tick loop
    startSLATickLoop(matchId);
  } catch (error) {
    console.error(`Failed to initialize match ${matchId}:`, error);
    // Transition to ENDED on failure
    updateState(matchId, MatchState.ENDED);
    throw error;
  }
}

/**
 * Transition match from RUNNING/ENDING to ENDED.
 *
 * Stops containers and removes network.
 *
 * @param {string} matchId
 * @returns {Promise<void>}
 */
export async function transitionToEnded(matchId) {
  const match = getMatch(matchId);
  if (!match) {
    console.warn(`Match ${matchId} not found, skipping cleanup`);
    return;
  }

  if (match.state === MatchState.ENDED) {
    return; // Already ended
  }

  try {
    updateState(matchId, MatchState.ENDING);

    // Stop SLA tick loop (no further score changes)
    stopSLATickLoop(matchId);

    // Freeze scores and set final result for backend pull
    const scores = getScores(matchId);
    if (scores) {
      const { teamA, teamB } = scores;
      if (teamA > teamB) {
        setFinalResult(matchId, { winner: 'teamA', loser: 'teamB' });
      } else if (teamB > teamA) {
        setFinalResult(matchId, { winner: 'teamB', loser: 'teamA' });
      } else {
        setFinalResult(matchId, { draw: true });
      }
    }

    const metadata = match.metadata || {};
    const containerIds = metadata.containerIds;

    // Stop and remove containers
    if (containerIds) {
      await stopMatchContainers(matchId, containerIds);
    }

    // Remove network
    await removeMatchNetwork(matchId);

    // Transition to ENDED
    updateState(matchId, MatchState.ENDED);
    console.log(`Match ${matchId} ended and cleaned up`);
  } catch (error) {
    console.error(`Error during cleanup for match ${matchId}:`, error);
    // Still mark as ENDED even if cleanup partially failed
    updateState(matchId, MatchState.ENDED);
  }
}

/**
 * Start SLA tick loop for a match.
 *
 * Performs health checks every 30 seconds and records results.
 * Loop runs only while match is in RUNNING state.
 *
 * @param {string} matchId
 */
function startSLATickLoop(matchId) {
  if (tickIntervals.has(matchId)) {
    console.warn(`SLA tick loop already running for match ${matchId}`);
    return;
  }

  const interval = setInterval(async () => {
    const match = getMatch(matchId);
    if (!match) {
      stopSLATickLoop(matchId);
      return;
    }

    // Only run ticks while match is RUNNING
    if (match.state !== MatchState.RUNNING) {
      if (match.state === MatchState.ENDING || match.state === MatchState.ENDED) {
        stopSLATickLoop(matchId);
      }
      return;
    }

    try {
      // Perform health checks on all services
      const healthResults = await checkMatchHealth(matchId);

      // Record tick results (updates service health state)
      await recordTick(matchId, healthResults);
    } catch (error) {
      // One failing service should not break the loop
      console.error(`Error in SLA tick for match ${matchId}:`, error);
    }
  }, SLA_TICK_INTERVAL_MS);

  tickIntervals.set(matchId, interval);
  console.log(`Started SLA tick loop for match ${matchId} (30s interval)`);
}

/**
 * Stop SLA tick loop for a match.
 *
 * @param {string} matchId
 */
function stopSLATickLoop(matchId) {
  const interval = tickIntervals.get(matchId);
  if (!interval) {
    return;
  }

  clearInterval(interval);
  tickIntervals.delete(matchId);
  console.log(`Stopped SLA tick loop for match ${matchId}`);
}

/**
 * Build match result payload for backend pull (GET /engine/match/:matchId/result).
 * No persistence; reads from in-memory state only.
 *
 * @param {string} matchId
 * @returns {{
 *   matchId: string;
 *   difficulty: string;
 *   teamA: { players: string[]; score: number; stats: { flagsCaptured: number; uptimeTicks: number; downtimeTicks: number } };
 *   teamB: { players: string[]; score: number; stats: { flagsCaptured: number; uptimeTicks: number; downtimeTicks: number } };
 *   winner: "teamA" | "teamB" | "draw";
 * } | null}
 */
export function getMatchResult(matchId) {
  const match = getMatch(matchId);
  if (!match || match.state !== MatchState.ENDED) {
    return null;
  }

  const metadata = match.metadata || {};
  const scores = getScores(matchId) || { teamA: 0, teamB: 0 };
  const uptimeStats = getUptimeStats(matchId) || { teamA: {}, teamB: {} };
  const finalResult = getFinalResult(matchId) || {};

  const teamAPlayers = Array.isArray(metadata.teamA) ? metadata.teamA : [];
  const teamBPlayers = Array.isArray(metadata.teamB) ? metadata.teamB : [];

  let flagsTeamA = 0;
  let flagsTeamB = 0;
  const flagsCaptured = metadata.flagsCaptured || {};
  for (const serviceId of Object.keys(flagsCaptured)) {
    const ticks = flagsCaptured[serviceId] || {};
    for (const tickKey of Object.keys(ticks)) {
      const entry = ticks[tickKey];
      if (entry && entry.capturedBy === 'teamA') flagsTeamA += 1;
      if (entry && entry.capturedBy === 'teamB') flagsTeamB += 1;
    }
  }

  function sumUptime(teamId) {
    const team = uptimeStats[teamId] || {};
    let up = 0;
    let down = 0;
    for (const serviceId of Object.keys(team)) {
      const s = team[serviceId] || {};
      up += typeof s.upTicks === 'number' ? s.upTicks : 0;
      down += typeof s.downTicks === 'number' ? s.downTicks : 0;
    }
    return { uptimeTicks: up, downtimeTicks: down };
  }

  const statsA = sumUptime('teamA');
  const statsB = sumUptime('teamB');

  const winner = finalResult.draw ? 'draw' : (finalResult.winner === 'teamA' || finalResult.winner === 'teamB' ? finalResult.winner : 'draw');

  return {
    matchId,
    difficulty: typeof metadata.difficulty === 'string' ? metadata.difficulty : 'easy',
    teamA: {
      players: teamAPlayers,
      score: typeof scores.teamA === 'number' ? scores.teamA : 0,
      stats: {
        flagsCaptured: flagsTeamA,
        uptimeTicks: statsA.uptimeTicks,
        downtimeTicks: statsA.downtimeTicks,
      },
    },
    teamB: {
      players: teamBPlayers,
      score: typeof scores.teamB === 'number' ? scores.teamB : 0,
      stats: {
        flagsCaptured: flagsTeamB,
        uptimeTicks: statsB.uptimeTicks,
        downtimeTicks: statsB.downtimeTicks,
      },
    },
    winner,
  };
}

