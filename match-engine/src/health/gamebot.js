/**
 * Game Bot / Health Checker
 *
 * Monitors game infrastructure health via HTTP health checks.
 *
 * Responsibilities:
 * - Perform HTTP health checks on containers
 * - Return status (UP/DOWN) and response time
 * - Handle timeouts and network errors gracefully
 *
 * No flag validation, no scoring logic, no retries.
 */

import fetch from 'node-fetch';
import { getDockerClient } from '../docker/dockerClient.js';
import { getMatch } from '../state/stateStore.js';

const HEALTH_CHECK_TIMEOUT_MS = 2000;
const HEALTH_ENDPOINT = '/health';

/**
 * Get container IP address within the match network.
 *
 * @param {string} containerId
 * @param {string} networkName
 * @returns {Promise<string | null>}
 */
async function getContainerIP(containerId, networkName) {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerId);
    const inspect = await container.inspect();

    const networks = inspect.NetworkSettings?.Networks || {};
    const networkInfo = networks[networkName];

    return networkInfo?.IPAddress || null;
  } catch (error) {
    console.error(`Failed to get IP for container ${containerId}:`, error);
    return null;
  }
}

/**
 * Perform HTTP health check on a single service.
 *
 * @param {string} serviceId - Service identifier (e.g., "teamA_<matchId>")
 * @param {string} containerId - Docker container ID
 * @param {string} networkName - Docker network name
 * @returns {Promise<{ serviceId: string; status: "UP" | "DOWN"; responseTimeMs: number }>}
 */
async function checkServiceHealth(serviceId, containerId, networkName) {
  const startTime = Date.now();

  try {
    const ip = await getContainerIP(containerId, networkName);
    if (!ip) {
      return {
        serviceId,
        status: 'DOWN',
        responseTimeMs: Date.now() - startTime,
      };
    }

    const url = `http://${ip}${HEALTH_ENDPOINT}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const responseTimeMs = Date.now() - startTime;

      if (response.ok && response.status === 200) {
        return {
          serviceId,
          status: 'UP',
          responseTimeMs,
        };
      } else {
        return {
          serviceId,
          status: 'DOWN',
          responseTimeMs,
        };
      }
    } catch (fetchError) {
      clearTimeout(timeout);
      const responseTimeMs = Date.now() - startTime;

      if (fetchError.name === 'AbortError') {
        // Timeout
        return {
          serviceId,
          status: 'DOWN',
          responseTimeMs,
        };
      }

      // Network error or other failure
      return {
        serviceId,
        status: 'DOWN',
        responseTimeMs,
      };
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error(`Health check failed for ${serviceId}:`, error);
    return {
      serviceId,
      status: 'DOWN',
      responseTimeMs,
    };
  }
}

/**
 * Check health of all services in a match.
 *
 * Iterates over containers defined in match metadata and performs
 * HTTP health checks on each.
 *
 * @param {string} matchId
 * @returns {Promise<Array<{ serviceId: string; status: "UP" | "DOWN"; responseTimeMs: number }>>}
 */
export async function checkMatchHealth(matchId) {
  const match = getMatch(matchId);
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const metadata = match.metadata || {};
  const containerIds = metadata.containerIds;
  const networkName = `match_${matchId}`;

  if (!containerIds || !containerIds.teamA || !containerIds.teamB) {
    console.warn(`Match ${matchId} missing container IDs`);
    return [];
  }

  // Check both services in parallel
  const [teamAResult, teamBResult] = await Promise.all([
    checkServiceHealth(`teamA_${matchId}`, containerIds.teamA, networkName),
    checkServiceHealth(`teamB_${matchId}`, containerIds.teamB, networkName),
  ]);

  return [teamAResult, teamBResult];
}
