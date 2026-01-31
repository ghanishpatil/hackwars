/**
 * Docker Network Manager
 *
 * Handles Docker network lifecycle for matches.
 *
 * Responsibilities:
 * - Create isolated bridge networks per match
 * - Remove networks on cleanup
 * - Handle network already exists scenarios
 */

import { getDockerClient } from './dockerClient.js';

/**
 * Create a Docker network for a match.
 *
 * Network name: match_<matchId>
 * Driver: bridge
 * Internal: true (isolated from host)
 *
 * @param {string} matchId
 * @returns {Promise<string>} Network ID
 */
export async function createMatchNetwork(matchId) {
  const docker = getDockerClient();
  const networkName = `match_${matchId}`;

  try {
    // Check if network already exists
    const existingNetworks = await docker.listNetworks({
      filters: JSON.stringify({ name: [networkName] }),
    });

    if (existingNetworks.length > 0) {
      const existing = existingNetworks[0];
      console.log(`Network ${networkName} already exists: ${existing.Id}`);
      return existing.Id;
    }

    // Create new network
    const network = await docker.createNetwork({
      Name: networkName,
      Driver: 'bridge',
      Internal: true,
      CheckDuplicate: true,
    });

    console.log(`Created Docker network: ${networkName} (${network.Id})`);
    return network.Id;
  } catch (error) {
    console.error(`Failed to create network ${networkName}:`, error);
    throw error;
  }
}

/**
 * Remove a Docker network for a match.
 *
 * @param {string} matchId
 * @returns {Promise<void>}
 */
export async function removeMatchNetwork(matchId) {
  const docker = getDockerClient();
  const networkName = `match_${matchId}`;

  try {
    const networks = await docker.listNetworks({
      filters: JSON.stringify({ name: [networkName] }),
    });

    if (networks.length === 0) {
      console.log(`Network ${networkName} does not exist, skipping removal`);
      return;
    }

    const network = docker.getNetwork(networks[0].Id);
    await network.remove();
    console.log(`Removed Docker network: ${networkName}`);
  } catch (error) {
    // Network might be in use or already removed
    console.error(`Failed to remove network ${networkName}:`, error);
    // Don't throw - cleanup should be best-effort
  }
}
