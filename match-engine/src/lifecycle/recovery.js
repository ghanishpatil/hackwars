/**
 * Match Engine crash recovery (minimum viable).
 *
 * On startup: scan Docker containers and networks, reconcile with in-memory state.
 * - If match exists in Docker but engine has no state → orphan: cleanup (stop containers, remove network).
 * - If match exists in state but not ENDED → engine lost state: mark ENDED and cleanup.
 *
 * Runs once on engine boot. Logs every action loudly. No silent failures.
 */

import { getDockerClient } from '../docker/dockerClient.js';
import { getMatch } from '../state/stateStore.js';
import { transitionToEnded, cleanupMatchInfraByMatchId } from './matchLifecycle.js';

const CONTAINER_PREFIX_TEAMA = 'teamA_';
const CONTAINER_PREFIX_TEAMB = 'teamB_';
const NETWORK_PREFIX = 'match_';

function extractMatchIdFromContainerName(name) {
  // Docker adds leading slash to name in listContainers
  const n = name.startsWith('/') ? name.slice(1) : name;
  if (n.startsWith(CONTAINER_PREFIX_TEAMA)) return n.slice(CONTAINER_PREFIX_TEAMA.length);
  if (n.startsWith(CONTAINER_PREFIX_TEAMB)) return n.slice(CONTAINER_PREFIX_TEAMB.length);
  return null;
}

function extractMatchIdFromNetworkName(name) {
  if (name.startsWith(NETWORK_PREFIX)) return name.slice(NETWORK_PREFIX.length);
  return null;
}

/**
 * Run recovery once on engine boot.
 * Scans Docker, groups by matchId, cleans orphans and aborts lost-state matches.
 */
export async function runRecovery() {
  const docker = getDockerClient();
  const matchIdsFromDocker = new Set();

  console.log('[RECOVERY] Starting crash recovery scan...');

  try {
    // List all containers (including stopped)
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
      const name = c.Names?.[0] || '';
      const matchId = extractMatchIdFromContainerName(name);
      if (matchId) {
        matchIdsFromDocker.add(matchId);
        console.log(`[RECOVERY] Found container for match: ${matchId} (${name})`);
      }
    }

    // List networks match_*
    const networks = await docker.listNetworks();
    for (const n of networks) {
      const name = n.Name || '';
      const matchId = extractMatchIdFromNetworkName(name);
      if (matchId) {
        matchIdsFromDocker.add(matchId);
        console.log(`[RECOVERY] Found network for match: ${matchId} (${name})`);
      }
    }
  } catch (err) {
    console.error('[RECOVERY] Failed to list Docker resources:', err);
    throw err;
  }

  if (matchIdsFromDocker.size === 0) {
    console.log('[RECOVERY] No match-related containers or networks found. Recovery complete.');
    return;
  }

  for (const matchId of matchIdsFromDocker) {
    const match = getMatch(matchId);
    if (!match) {
      console.log(`[RECOVERY] Orphan match ${matchId}: no state in engine. Cleaning up.`);
      try {
        await cleanupMatchInfraByMatchId(matchId);
      } catch (err) {
        console.error(`[RECOVERY] Failed to cleanup orphan match ${matchId}:`, err);
        // Continue with other matches
      }
      continue;
    }
    if (match.state !== 'ENDED') {
      console.log(`[RECOVERY] Lost-state match ${matchId}: state=${match.state}. Aborting and cleaning up.`);
      try {
        await transitionToEnded(matchId);
      } catch (err) {
        console.error(`[RECOVERY] Failed to end match ${matchId}:`, err);
        try {
          await cleanupMatchInfraByMatchId(matchId);
        } catch (e2) {
          console.error(`[RECOVERY] Fallback cleanup failed for ${matchId}:`, e2);
        }
      }
    }
  }

  console.log('[RECOVERY] Recovery complete.');
}
