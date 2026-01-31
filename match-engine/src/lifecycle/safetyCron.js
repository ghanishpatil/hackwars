/**
 * Safety cron: reclaim orphan and aged resources.
 * Every 30–60 minutes: remove containers older than X hours, remove networks with no containers.
 * No orphan infra allowed. Logs every action.
 */

import { getDockerClient } from '../docker/dockerClient.js';
import { getAllMatches } from '../state/stateStore.js';
import { cleanupMatchInfraByMatchId, transitionToEnded } from './matchLifecycle.js';

const CONTAINER_PREFIX_TEAMA = 'teamA_';
const CONTAINER_PREFIX_TEAMB = 'teamB_';
const NETWORK_PREFIX = 'match_';

const MAX_CONTAINER_AGE_HOURS = Number(process.env.MAX_CONTAINER_AGE_HOURS) || 4;
const MAX_MATCH_DURATION_HOURS = Number(process.env.MAX_MATCH_DURATION_HOURS) || 3;
const SAFETY_CRON_INTERVAL_MS = Number(process.env.SAFETY_CRON_INTERVAL_MS) || 45 * 60 * 1000; // 45 min

const MAX_AGE_SEC = MAX_CONTAINER_AGE_HOURS * 3600;
const MAX_MATCH_DURATION_MS = MAX_MATCH_DURATION_HOURS * 3600 * 1000;

function extractMatchIdFromContainerName(name) {
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
 * Run one safety cycle: age-based container removal, orphan network removal, max match duration.
 */
export async function runSafetyCron() {
  const docker = getDockerClient();
  const nowSec = Math.floor(Date.now() / 1000);
  let reclaimedContainers = 0;
  let reclaimedNetworks = 0;

  console.log('[SAFETY_CRON] Starting safety cycle...');

  try {
    // 1. List all containers (match-related), remove if older than MAX_CONTAINER_AGE_HOURS
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
      const name = c.Names?.[0] || '';
      const matchId = extractMatchIdFromContainerName(name);
      if (!matchId) continue;

      const created = c.Created || 0; // Unix seconds
      if (nowSec - created > MAX_AGE_SEC) {
        console.log(`[SAFETY_CRON] Removing aged container: ${name} (matchId=${matchId})`);
        try {
          const container = docker.getContainer(c.Id);
          try {
            await container.stop();
          } catch (e) {
            if (e.statusCode !== 304) console.warn(`[SAFETY_CRON] Stop warning:`, e.message);
          }
          await container.remove();
          reclaimedContainers += 1;
        } catch (err) {
          console.error(`[SAFETY_CRON] Failed to remove container ${name}:`, err.message);
        }
      }
    }

    // 2. List networks match_*, remove if no containers attached (or always prune empty)
    const networks = await docker.listNetworks();
    for (const n of networks) {
      const name = n.Name || '';
      const matchId = extractMatchIdFromNetworkName(name);
      if (!matchId) continue;

      try {
        const network = docker.getNetwork(n.Id);
        const inspect = await network.inspect();
        const containerCount = Object.keys(inspect.Containers || {}).length;
        if (containerCount === 0) {
          console.log(`[SAFETY_CRON] Removing empty network: ${name}`);
          await network.remove();
          reclaimedNetworks += 1;
        }
      } catch (err) {
        console.error(`[SAFETY_CRON] Failed to remove network ${name}:`, err.message);
      }
    }

    // 3. End matches that have been RUNNING longer than MAX_MATCH_DURATION_HOURS
    const matches = getAllMatches();
    const nowMs = Date.now();
    for (const [, match] of matches) {
      if (match.state !== 'RUNNING' && match.state !== 'INITIALIZING') continue;
      const createdAt = match.metadata?.createdAt;
      if (typeof createdAt !== 'number') continue;
      if (nowMs - createdAt > MAX_MATCH_DURATION_MS) {
        console.log(`[SAFETY_CRON] Ending match ${match.matchId} (max duration exceeded)`);
        try {
          await transitionToEnded(match.matchId);
        } catch (err) {
          console.error(`[SAFETY_CRON] Failed to end match ${match.matchId}:`, err.message);
        }
      }
    }

    if (reclaimedContainers > 0 || reclaimedNetworks > 0) {
      console.log(`[SAFETY_CRON] Reclaimed: ${reclaimedContainers} containers, ${reclaimedNetworks} networks`);
    }
    console.log('[SAFETY_CRON] Safety cycle complete.');
  } catch (err) {
    console.error('[SAFETY_CRON] Error during safety cycle:', err);
  }
}

let cronInterval = null;

export function startSafetyCron() {
  if (cronInterval) return;
  cronInterval = setInterval(() => {
    runSafetyCron().catch((e) => console.error('[SAFETY_CRON] Unhandled:', e));
  }, SAFETY_CRON_INTERVAL_MS);
  console.log(`[SAFETY_CRON] Started (interval ${SAFETY_CRON_INTERVAL_MS}ms)`);
}

export function stopSafetyCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[SAFETY_CRON] Stopped');
  }
}
