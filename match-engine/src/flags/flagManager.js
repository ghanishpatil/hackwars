/**
 * Flag Manager
 *
 * Secure flag generation and validation. Flags are HMAC-based and time-bound.
 * No plaintext flag storage; validation is stateless (recompute and compare).
 */

import crypto from 'crypto';
import { getServiceIdsFromInfrastructure } from '../state/stateStore.js';

const FLAG_PREFIX = 'FLAG{';
const FLAG_SUFFIX = '}';

/**
 * Get the engine-only secret for flag HMAC.
 * Must be set via FLAG_SECRET env var.
 *
 * @returns {string}
 */
function getFlagSecret() {
  const secret = process.env.FLAG_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('FLAG_SECRET must be set and at least 16 characters');
  }
  return secret;
}

/**
 * Build the HMAC payload: matchId|serviceId|tick (no plaintext identifiers
 * appear inside the flag body; they are bound by the HMAC).
 *
 * @param {string} matchId
 * @param {string} serviceId
 * @param {number} tick
 * @returns {string}
 */
function buildPayload(matchId, serviceId, tick) {
  return `${matchId}|${serviceId}|${tick}`;
}

/**
 * Generate flag for (matchId, serviceId, tick).
 *
 * Format: FLAG{base64(hmac_sha256(secret, matchId|serviceId|tick))}
 *
 * @param {string} matchId
 * @param {string} serviceId
 * @param {number} tick
 * @returns {string}
 */
export function generateFlag(matchId, serviceId, tick) {
  const secret = getFlagSecret();
  const payload = buildPayload(matchId, serviceId, tick);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = hmac.digest('base64');
  return `${FLAG_PREFIX}${digest}${FLAG_SUFFIX}`;
}

/**
 * Constant-time comparison to avoid timing leaks.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Parse flag string and return the inner base64 body, or null if format invalid.
 *
 * @param {string} flag
 * @returns {string | null}
 */
function parseFlagFormat(flag) {
  if (typeof flag !== 'string' || flag.length < FLAG_PREFIX.length + FLAG_SUFFIX.length) {
    return null;
  }
  if (!flag.startsWith(FLAG_PREFIX) || !flag.endsWith(FLAG_SUFFIX)) {
    return null;
  }
  const body = flag.slice(FLAG_PREFIX.length, -FLAG_SUFFIX.length);
  if (!body || !/^[A-Za-z0-9+/=]+$/.test(body)) {
    return null;
  }
  return body;
}

/**
 * Get service IDs for a match (canonical list used for validation).
 * Uses infrastructure when available (provisioned matches); else legacy 2-service ids.
 *
 * @param {string} matchId
 * @returns {string[]}
 */
export function getServiceIdsForMatch(matchId) {
  const fromInfra = getServiceIdsFromInfrastructure(matchId);
  if (fromInfra && fromInfra.length > 0) return fromInfra;
  return [`teamA_${matchId}`, `teamB_${matchId}`];
}

/**
 * Validate submitted flag against match and current tick.
 *
 * Checks: format valid, HMAC valid, tick within allowed window (current, previous).
 * Returns which (serviceId, tick) matched, or { valid: false }.
 *
 * @param {string} matchId
 * @param {string} flag
 * @param {number} currentTick
 * @returns {{ valid: true; serviceId: string; tick: number } | { valid: false }}
 */
export function validateFlag(matchId, flag, currentTick) {
  const body = parseFlagFormat(flag);
  if (body === null) {
    return { valid: false };
  }

  const secret = getFlagSecret();
  const serviceIds = getServiceIdsForMatch(matchId);

  // Allowed ticks: current and previous (grace window)
  const allowedTicks = [currentTick, currentTick - 1].filter((t) => t >= 0);

  for (const serviceId of serviceIds) {
    for (const tick of allowedTicks) {
      const expected = generateFlag(matchId, serviceId, tick);
      const expectedBody = expected.slice(FLAG_PREFIX.length, -FLAG_SUFFIX.length);
      if (secureCompare(body, expectedBody)) {
        return { valid: true, serviceId, tick };
      }
    }
  }

  return { valid: false };
}
