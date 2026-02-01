/**
 * Match Cleanup
 *
 * Stops and removes containers, deletes network, clears state.
 * cleanupStaleMatches runs as cron to reclaim orphan resources.
 */

import { getDockerClient } from '../docker/dockerClient.js';
import { removeMatchNetwork } from '../docker/networkManager.js';
import { stopAndRemoveContainer } from '../docker/containerManager.js';
import { getMatchInfrastructure, deleteMatchInfrastructure } from '../state/stateStore.js';

const CONTAINER_STOP_TIMEOUT_MS = 30_000;
const STALE_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Clean up a match: stop/remove all containers, delete network, remove from state.
 *
 * @param {string} matchId
 */
export async function cleanupMatch(matchId) {
  const infrastructure = getMatchInfrastructure(matchId);
  if (!infrastructure) {
    await removeMatchNetwork(matchId);
    deleteMatchInfrastructure(matchId);
    return;
  }

  const allContainers = [
    ...(infrastructure.teamA?.containers || []),
    ...(infrastructure.teamB?.containers || []),
  ];

  await Promise.all(
    allContainers.map((c) =>
      Promise.race([
        stopAndRemoveContainer(c.containerId),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('Container stop timeout')), CONTAINER_STOP_TIMEOUT_MS)
        ),
      ]).catch((err) => {
        console.warn(`[CLEANUP] Failed to remove container ${c.containerId}:`, err.message);
      })
    )
  );

  await removeMatchNetwork(matchId);
  deleteMatchInfrastructure(matchId);
  console.log(`[CLEANUP] Match ${matchId} cleaned up`);
}

/**
 * Clean up stale containers and networks (no longer in state or > 2h old).
 * Run as cron every 30 minutes.
 */
export async function cleanupStaleMatches() {
  const docker = getDockerClient();
  const now = Date.now();

  const containers = await docker.listContainers({
    all: true,
    filters: JSON.stringify({ label: ['ctf.match.id'] }),
  });

  for (const c of containers) {
    const labels = c.Labels || {};
    const matchId = labels['ctf.match.id'];
    if (!matchId) continue;

    const infra = getMatchInfrastructure(matchId);
    const created = c.Created ? new Date(c.Created).getTime() : 0;
    const age = now - created;

    if (!infra || age > STALE_AGE_MS) {
      try {
        const container = docker.getContainer(c.Id);
        await container.stop({ t: 10 }).catch(() => {});
        await container.remove({ force: true });
        console.log(`[CLEANUP] Removed stale container ${c.Id} (match ${matchId})`);
      } catch (err) {
        console.warn(`[CLEANUP] Failed to remove stale container ${c.Id}:`, err.message);
      }
    }
  }

  const networks = await docker.listNetworks({
    filters: JSON.stringify({ label: ['ctf.match.id'] }),
  });

  for (const n of networks) {
    const labels = n.Labels || {};
    const matchId = labels['ctf.match.id'];
    if (!matchId) continue;

    const infra = getMatchInfrastructure(matchId);
    if (!infra) {
      try {
        const network = docker.getNetwork(n.Id);
        await network.remove();
        console.log(`[CLEANUP] Removed orphan network ${n.Name} (match ${matchId})`);
      } catch (err) {
        console.warn(`[CLEANUP] Failed to remove network ${n.Id}:`, err.message);
      }
    }
  }
}
