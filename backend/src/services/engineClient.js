/**
 * Match Engine Client
 *
 * Thin wrapper around HTTP calls to the match engine.
 *
 * Responsibilities:
 * - Provide a stable API for the control plane (backend) to:
 *   - startMatch(matchData)
 *   - stopMatch(matchId)
 *   - getMatchStatus(matchId)
 * - Handle basic timeouts and engine unavailability.
 *
 * No gameplay, scoring, or Docker logic here.
 */

import fetch from 'node-fetch';

const DEFAULT_BASE_URL = 'http://localhost:7000';
const REQUEST_TIMEOUT_MS = 5_000;
const PROVISION_TIMEOUT_MS = 5 * 60 * 1000; // 5 min for provision (pull + start)

function getBaseUrl() {
  return process.env.MATCH_ENGINE_URL || DEFAULT_BASE_URL;
}

async function request(method, path, body, options = {}) {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const error = new Error(
        `Match engine responded with ${res.status}: ${res.statusText}`
      );
      error.status = res.status;
      error.body = json;
      throw error;
    }

    return json;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutError = new Error('Match engine request timed out');
      timeoutError.code = 'ENGINE_TIMEOUT';
      throw timeoutError;
    }

    const networkError = new Error('Match engine is unavailable');
    networkError.code = 'ENGINE_UNAVAILABLE';
    networkError.cause = err;
    throw networkError;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Start a match on the match engine.
 *
 * @param {{
 *   matchId: string;
 *   difficulty: string;
 *   teamSize: number;
 *   teamA: string[];
 *   teamB: string[];
 * }} matchData
 * @returns {Promise<any>}
 */
export async function startMatch(matchData) {
  return request('POST', '/engine/match/start', matchData);
}

/**
 * Stop a running match.
 *
 * @param {string} matchId
 * @returns {Promise<any>}
 */
export async function stopMatch(matchId) {
  return request('POST', `/engine/match/${encodeURIComponent(matchId)}/stop`);
}

/**
 * Get status for a match.
 *
 * @param {string} matchId
 * @returns {Promise<any>}
 */
export async function getMatchStatus(matchId) {
  return request(
    'GET',
    `/engine/match/${encodeURIComponent(matchId)}/status`
  );
}

/**
 * Get match result (scores, stats, winner). Only valid when match is ENDED.
 *
 * @param {string} matchId
 * @returns {Promise<any>}
 */
export async function getMatchResult(matchId) {
  return request(
    'GET',
    `/engine/match/${encodeURIComponent(matchId)}/result`
  );
}

/**
 * Provision a match (Phase 2): network + containers from service templates, inject flags.
 *
 * @param {{ matchId: string; difficulty: string; teamA: { teamId: string; players?: any[] }; teamB: { teamId: string; players?: any[] } }} matchData
 * @returns {Promise<{ success: boolean; infrastructure: object }>}
 */
export async function provisionMatch(matchData) {
  return request('POST', '/engine/match/provision', matchData, { timeoutMs: PROVISION_TIMEOUT_MS });
}

/**
 * Clean up a match (containers + network).
 *
 * @param {string} matchId
 * @returns {Promise<{ success: boolean }>}
 */
export async function cleanupMatch(matchId) {
  return request('POST', `/engine/match/${encodeURIComponent(matchId)}/cleanup`);
}

/**
 * Get match infrastructure (containers, network). Phase 2.
 *
 * @param {string} matchId
 * @returns {Promise<{ success: boolean; infrastructure: object }>}
 */
export async function getMatchInfrastructure(matchId) {
  return request('GET', `/engine/match/${encodeURIComponent(matchId)}/infrastructure`);
}

/**
 * Get match engine health (for admin overview).
 *
 * @returns {Promise<{ status?: string; service?: string } | null>}
 */
export async function getEngineHealth() {
  try {
    return await request('GET', '/health');
  } catch {
    return null;
  }
}

