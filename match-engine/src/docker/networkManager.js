/**
 * Docker Network Manager
 *
 * Handles Docker network lifecycle for matches.
 * Creates isolated bridge networks per match with unique subnets (172.20.X.0/24).
 */

import { getDockerClient } from './dockerClient.js';

const SUBNET_PREFIX = '172.20';
const USED_OCTETS = new Set();

function nextOctet() {
  for (let i = 1; i <= 254; i++) {
    if (!USED_OCTETS.has(i)) {
      USED_OCTETS.add(i);
      return i;
    }
  }
  throw new Error('No available subnet octet (172.20.1-254 exhausted)');
}

function releaseOctet(octet) {
  USED_OCTETS.delete(octet);
}

/**
 * Create a Docker network for a match.
 *
 * @param {string} matchId
 * @returns {Promise<{ networkId: string; networkName: string; subnet: string }>}
 */
export async function createMatchNetwork(matchId) {
  const docker = getDockerClient();
  const networkName = `match_${matchId}`;

  const existingNetworks = await docker.listNetworks({
    filters: JSON.stringify({ name: [networkName] }),
  });

  if (existingNetworks.length > 0) {
    const existing = existingNetworks[0];
    return {
      networkId: existing.Id,
      networkName: existing.Name || networkName,
      subnet: '172.20.0.0/24',
    };
  }

  const octet = nextOctet();
  const subnet = `${SUBNET_PREFIX}.${octet}.0/24`;
  const gateway = `${SUBNET_PREFIX}.${octet}.1`;

  try {
    const network = await docker.createNetwork({
      Name: networkName,
      Driver: 'bridge',
      IPAM: {
        Driver: 'default',
        Config: [{ Subnet: subnet, Gateway: gateway }],
      },
      Internal: false,
      Labels: {
        'ctf.match.id': matchId,
        'ctf.created': Date.now().toString(),
      },
    });

    return {
      networkId: network.id,
      networkName,
      subnet,
    };
  } catch (err) {
    releaseOctet(octet);
    throw err;
  }
}

/**
 * Remove a Docker network by matchId (lookup by name).
 *
 * @param {string} matchId
 * @returns {Promise<void>}
 */
export async function removeMatchNetwork(matchId) {
  const docker = getDockerClient();
  const networkName = `match_${matchId}`;

  const networks = await docker.listNetworks({
    filters: JSON.stringify({ name: [networkName] }),
  });

  if (networks.length === 0) {
    return;
  }

  const network = docker.getNetwork(networks[0].Id);
  let subnet = null;
  try {
    const inspect = await network.inspect();
    subnet = inspect.IPAM?.Config?.[0]?.Subnet;
  } catch (_) {}
  try {
    await network.remove();
  } catch (err) {
    console.error(`Failed to remove network ${networkName}:`, err.message);
  }
  if (subnet) {
    const m = subnet.match(/^172\.20\.(\d+)\.0\/24$/);
    if (m) releaseOctet(parseInt(m[1], 10));
  }
}

/**
 * Remove a Docker network by network ID. Releases subnet from registry if we track it.
 *
 * @param {string} networkId
 * @returns {Promise<void>}
 */
export async function deleteMatchNetwork(networkId) {
  const docker = getDockerClient();
  try {
    const network = docker.getNetwork(networkId);
    const inspect = await network.inspect();
    const labels = inspect.Labels || {};
    const matchId = labels['ctf.match.id'];
    await network.remove();
    if (matchId) {
      const name = inspect.Name || '';
      const octetMatch = name.startsWith('match_') ? name : null;
      if (octetMatch != null && inspect.IPAM?.Config?.[0]?.Subnet) {
        const m = inspect.IPAM.Config[0].Subnet.match(/^172\.20\.(\d+)\.0\/24$/);
        const octet = m ? parseInt(m[1], 10) : NaN;
        if (!isNaN(octet)) releaseOctet(octet);
      }
    }
  } catch (err) {
    console.error(`Failed to remove network ${networkId}:`, err.message);
  }
}
