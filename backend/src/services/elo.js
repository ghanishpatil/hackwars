/**
 * Cyber-ELO: MMR and rank progression.
 * Backend is the authority; logic is deterministic and reproducible.
 * No Firestore inside pure calculation functions.
 */

import { RANKS, RP_MIN, RP_MAX } from '../config/ranks.js';

const K = 30;

const DIFFICULTY_MULTIPLIER = {
  easy: 0.6,
  medium: 1.0,
  hard: 1.35,
  insane: 1.7,
};

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'];

/**
 * Get difficulty multiplier (bounded).
 *
 * @param {string} difficulty
 * @returns {number}
 */
function getDifficultyMultiplier(difficulty) {
  const d = (difficulty || 'medium').toString().trim().toLowerCase();
  return VALID_DIFFICULTIES.includes(d) ? DIFFICULTY_MULTIPLIER[d] : 1.0;
}

/**
 * Expected outcome (Elo-style): 1 / (1 + 10^((EnemyMMR - TeamMMR) / 400))
 *
 * @param {number} teamMMR
 * @param {number} enemyMMR
 * @returns {number}
 */
function expectedOutcome(teamMMR, enemyMMR) {
  return 1 / (1 + Math.pow(10, (enemyMMR - teamMMR) / 400));
}

/**
 * Performance modifier 0.8–1.2 from flags share, uptime share, low downtime.
 * Simple and bounded.
 *
 * @param {{ flagsCaptured: number; uptimeTicks: number; downtimeTicks: number }} playerStats
 * @param {{ flagsCaptured: number; uptimeTicks: number; downtimeTicks: number }} teamStats
 * @returns {number}
 */
function performanceModifier(playerStats, teamStats) {
  let factor = 1.0;

  const teamFlags = Math.max(1, teamStats.flagsCaptured || 0);
  const playerFlags = Math.max(0, playerStats.flagsCaptured || 0);
  const flagShare = playerFlags / teamFlags;
  factor += (flagShare - 0.5) * 0.2;

  const teamUp = Math.max(1, teamStats.uptimeTicks || 0);
  const playerUp = Math.max(0, playerStats.uptimeTicks || 0);
  const uptimeShare = playerUp / teamUp;
  factor += (uptimeShare - 0.5) * 0.15;

  const teamDown = teamStats.downtimeTicks || 0;
  const playerDown = playerStats.downtimeTicks || 0;
  if (teamDown > 0 && playerDown > 0) {
    const downtimeShare = playerDown / teamDown;
    factor -= downtimeShare * 0.1;
  }

  return Math.max(0.8, Math.min(1.2, factor));
}

/**
 * Calculate MMR delta for one player (pure; no Firestore).
 *
 * @param {Object} player - { uid, mmr, rank, rp } (current)
 * @param {Object} team - { players: string[], mmr: number, stats: { flagsCaptured, uptimeTicks, downtimeTicks } }
 * @param {Object} enemyTeam - { mmr: number }
 * @param {Object} matchData - { result: 1 | 0 | 0.5, difficulty: string }
 * @param {Object} playerStats - { flagsCaptured, uptimeTicks, downtimeTicks } for this player's contribution
 * @returns {number} MMR delta (signed)
 */
export function calculateMMRDelta(player, team, enemyTeam, matchData, playerStats) {
  const teamMMR = team.mmr;
  const enemyMMR = enemyTeam.mmr;
  const expected = expectedOutcome(teamMMR, enemyMMR);
  const result = matchData.result;
  const diffMult = getDifficultyMultiplier(matchData.difficulty);
  const perf = performanceModifier(playerStats, team.stats);

  const delta = K * diffMult * perf * (result - expected);
  return Math.round(delta * 10) / 10;
}

/**
 * Get rank name from MMR (deterministic).
 *
 * @param {number} mmr
 * @returns {string}
 */
export function getRankFromMMR(mmr) {
  const m = typeof mmr === 'number' ? mmr : 1000;
  let chosen = RANKS[0];
  for (const r of RANKS) {
    if (m >= r.min) chosen = r;
  }
  return chosen.name;
}

/**
 * Get RP bounds for current rank (0–100).
 *
 * @param {number} mmr
 * @returns {{ min: number; max: number }}
 */
export function getRPBoundsForMMR(mmr) {
  return { min: RP_MIN, max: RP_MAX };
}

const RANK_PROTECTION_LOSSES = 3;

/**
 * Update rank and RP from new MMR (pure; no Firestore).
 * Handles promotion, demotion, RP overflow/underflow, rank protection (first 3 losses after promotion).
 *
 * @param {Object} player - { mmr, rank, rp, lossesSincePromotion? }
 * @param {number} newMMR
 * @param {boolean} won - whether the player won this match (for rank protection)
 * @returns {{ rank: string; rp: number; promoted: boolean; demoted: boolean }}
 */
export function updateRankAndRP(player, newMMR, won) {
  const oldMMR = typeof player.mmr === 'number' ? player.mmr : 1000;
  const oldRank = getRankFromMMR(oldMMR);
  const newRank = getRankFromMMR(newMMR);
  let rp = typeof player.rp === 'number' ? player.rp : 0;
  rp = Math.max(RP_MIN, Math.min(RP_MAX, rp));

  const oldRankIndex = RANKS.findIndex((r) => r.name === oldRank);
  const newRankIndex = RANKS.findIndex((r) => r.name === newRank);

  let promoted = false;
  let demoted = false;
  let lossesSincePromotion = typeof player.lossesSincePromotion === 'number' ? player.lossesSincePromotion : 0;

  let finalRank = newRank;

  if (newRankIndex > oldRankIndex) {
    promoted = true;
    finalRank = newRank;
    rp = 0;
    lossesSincePromotion = 0;
  } else if (newRankIndex < oldRankIndex) {
    if (won) {
      demoted = true;
      finalRank = newRank;
      rp = RP_MAX;
      lossesSincePromotion = 0;
    } else {
      lossesSincePromotion += 1;
      if (lossesSincePromotion >= RANK_PROTECTION_LOSSES) {
        demoted = true;
        finalRank = newRank;
        rp = RP_MAX;
        lossesSincePromotion = 0;
      } else {
        finalRank = oldRank;
        rp = Math.max(RP_MIN, rp - 25);
      }
    }
  } else {
    if (won) {
      rp = Math.min(RP_MAX, rp + 15);
    } else {
      lossesSincePromotion += 1;
      if (lossesSincePromotion >= RANK_PROTECTION_LOSSES) {
        rp = Math.max(RP_MIN, rp - 30);
      } else {
        rp = Math.max(RP_MIN, rp - 15);
      }
    }
  }

  rp = Math.max(RP_MIN, Math.min(RP_MAX, rp));

  return {
    rank: finalRank,
    rp,
    promoted,
    demoted,
    lossesSincePromotion: demoted ? 0 : lossesSincePromotion,
  };
}
