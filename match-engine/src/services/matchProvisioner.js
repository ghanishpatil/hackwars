/**
 * Match Provisioner
 *
 * Fetches default service collection from backend, creates network,
 * provisions team containers, injects initial flags, stores infrastructure.
 */

import fetch from 'node-fetch';
import { createMatchNetwork, removeMatchNetwork } from '../docker/networkManager.js';
import {
  provisionTeamServices,
  stopAndRemoveContainer,
  injectFlagIntoContainer,
} from '../docker/containerManager.js';
import { setMatchInfrastructure, getMatchInfrastructure, deleteMatchInfrastructure } from '../state/stateStore.js';
import { generateFlag } from '../flags/flagManager.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * Fetch default collection with templates for a difficulty.
 *
 * @param {string} difficulty
 * @returns {Promise<{ services: object[] }>}
 */
async function getDefaultCollectionWithTemplates(difficulty) {
  const res = await fetch(`${BACKEND_URL}/api/match/default-collection?difficulty=${encodeURIComponent(difficulty)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get default collection: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Notify backend of infrastructure (store in match doc).
 *
 * @param {string} matchId
 * @param {object} infrastructure
 */
async function notifyBackendInfrastructure(matchId, infrastructure) {
  const res = await fetch(`${BACKEND_URL}/api/match/infrastructure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, infrastructure }),
  });
  if (!res.ok) {
    console.warn(`[PROVISION] Failed to push infrastructure to backend: ${res.status}`);
  }
}

/**
 * Provision a match: network + team A/B containers + inject tick-0 flags.
 *
 * @param {object} matchData — { matchId, difficulty, teamA: { teamId, players }, teamB: { teamId, players } }
 * @returns {Promise<object>} infrastructure
 */
export async function provisionMatch(matchData) {
  const { matchId, difficulty, teamA, teamB } = matchData || {};
  if (!matchId || !difficulty || !teamA?.teamId || !teamB?.teamId) {
    throw new Error('matchId, difficulty, teamA.teamId, teamB.teamId required');
  }

  let network = null;
  let teamAContainers = [];
  let teamBContainers = [];

  try {
    const collection = await getDefaultCollectionWithTemplates(difficulty);
    const services = collection.services || [];
    if (services.length === 0) {
      throw new Error('No services in default collection for difficulty');
    }

    network = await createMatchNetwork(matchId);
    const networkNameOrId = network.networkName;

    teamAContainers = await provisionTeamServices(
      matchId,
      teamA.teamId,
      networkNameOrId,
      services
    );
    teamBContainers = await provisionTeamServices(
      matchId,
      teamB.teamId,
      networkNameOrId,
      services
    );

    const allContainers = [...teamAContainers, ...teamBContainers];
    for (const c of allContainers) {
      const flag = generateFlag(matchId, c.serviceId, 0);
      await injectFlagIntoContainer(c.containerId, c.flagPath, flag);
    }

    const infrastructure = {
      matchId,
      networkId: network.networkId,
      networkName: network.networkName,
      subnet: network.subnet,
      teamA: { teamId: teamA.teamId, containers: teamAContainers },
      teamB: { teamId: teamB.teamId, containers: teamBContainers },
      provisionedAt: Date.now(),
    };

    setMatchInfrastructure(matchId, infrastructure);
    await notifyBackendInfrastructure(matchId, infrastructure);

    return infrastructure;
  } catch (err) {
    for (const c of teamBContainers) {
      try {
        await stopAndRemoveContainer(c.containerId);
      } catch (e) {
        console.warn('Rollback container', c.containerId, e.message);
      }
    }
    for (const c of teamAContainers) {
      try {
        await stopAndRemoveContainer(c.containerId);
      } catch (e) {
        console.warn('Rollback container', c.containerId, e.message);
      }
    }
    if (network?.networkId) {
      try {
        await removeMatchNetwork(matchId);
      } catch (e) {
        console.warn('Rollback network', e.message);
      }
    }
    throw err;
  }
}
