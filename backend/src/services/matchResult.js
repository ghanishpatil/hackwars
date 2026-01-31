/**
 * Match result orchestration: fetch engine result, compute MMR/rank/RP, persist.
 * Backend is the authority for MMR and rank persistence. No Firestore writes from engine.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import { getMatchResult as fetchEngineResult, getMatchStatus } from '../services/engineClient.js';
import { calculateMMRDelta, updateRankAndRP } from './elo.js';

const USERS_COLLECTION = 'users';
const MATCHES_COLLECTION = 'matches';

/**
 * Load user records by UIDs (mmr, rank, rp, lossesSincePromotion).
 *
 * @param {import('firebase-admin').firestore.Firestore} firestore
 * @param {string[]} uids
 * @returns {Promise<Map<string, { uid: string; mmr: number; rank: string; rp: number; lossesSincePromotion: number }>>}
 */
async function loadUsers(firestore, uids) {
  const map = new Map();
  if (!uids.length) return map;

  const refs = uids.map((uid) => firestore.collection(USERS_COLLECTION).doc(uid));
  const snapshots = await firestore.getAll(...refs);

  for (let i = 0; i < uids.length; i++) {
    const snap = snapshots[i];
    const uid = uids[i];
    const data = snap.exists ? snap.data() : {};
    map.set(uid, {
      uid,
      mmr: typeof data.mmr === 'number' ? data.mmr : 1000,
      rank: typeof data.rank === 'string' ? data.rank : 'Initiate',
      rp: typeof data.rp === 'number' ? data.rp : 0,
      lossesSincePromotion: typeof data.lossesSincePromotion === 'number' ? data.lossesSincePromotion : 0,
    });
  }
  return map;
}

/**
 * Per-player stats for performance modifier (split team stats evenly).
 *
 * @param {{ flagsCaptured: number; uptimeTicks: number; downtimeTicks: number }} teamStats
 * @param {number} teamSize
 * @returns {{ flagsCaptured: number; uptimeTicks: number; downtimeTicks: number }}
 */
function perPlayerStats(teamStats, teamSize) {
  const n = Math.max(1, teamSize);
  return {
    flagsCaptured: (teamStats.flagsCaptured || 0) / n,
    uptimeTicks: (teamStats.uptimeTicks || 0) / n,
    downtimeTicks: (teamStats.downtimeTicks || 0) / n,
  };
}

/**
 * Process match end: fetch engine result, compute deltas, persist in Firestore (transaction).
 *
 * @param {string} matchId
 * @returns {Promise<{ playerDeltas: Map<string, { mmrDelta: number; oldRank: string; newRank: string; rpDelta: number }> }>}
 */
export async function processMatchEnd(matchId) {
  const firestore = getFirestore();
  if (!firestore) {
    throw new Error('Firestore is not initialized');
  }

  const status = await getMatchStatus(matchId);
  if (!status || status.state !== 'ENDED') {
    throw new Error('Match is not ended');
  }

  const result = await fetchEngineResult(matchId);
  if (!result) {
    throw new Error('Match result not available');
  }

  const matchRef = firestore.collection(MATCHES_COLLECTION).doc(matchId);
  const matchSnap = await matchRef.get();
  if (matchSnap.exists && matchSnap.data().invalid === true) {
    return { playerDeltas: new Map() };
  }

  const { difficulty, teamA, teamB, winner } = result;
  const allUids = [...(teamA.players || []), ...(teamB.players || [])];
  const users = await loadUsers(firestore, allUids);

  const teamASize = Math.max(1, (teamA.players || []).length);
  const teamBSize = Math.max(1, (teamB.players || []).length);

  let teamAMMR = 0;
  let teamBMMR = 0;
  for (const uid of teamA.players || []) {
    const u = users.get(uid);
    teamAMMR += u ? u.mmr : 1000;
  }
  for (const uid of teamB.players || []) {
    const u = users.get(uid);
    teamBMMR += u ? u.mmr : 1000;
  }
  teamAMMR /= teamASize;
  teamBMMR /= teamBSize;

  const resultA = winner === 'teamA' ? 1 : winner === 'teamB' ? 0 : 0.5;
  const resultB = winner === 'teamB' ? 1 : winner === 'teamA' ? 0 : 0.5;

  const playerStatsA = perPlayerStats(teamA.stats || {}, teamASize);
  const playerStatsB = perPlayerStats(teamB.stats || {}, teamBSize);

  const teamAForElo = {
    players: teamA.players || [],
    mmr: teamAMMR,
    stats: teamA.stats || { flagsCaptured: 0, uptimeTicks: 0, downtimeTicks: 0 },
  };
  const teamBForElo = {
    players: teamB.players || [],
    mmr: teamBMMR,
    stats: teamB.stats || { flagsCaptured: 0, uptimeTicks: 0, downtimeTicks: 0 },
  };

  const updates = [];
  const playerDeltas = new Map();

  for (const uid of teamA.players || []) {
    const player = users.get(uid);
    if (!player) continue;
    const delta = calculateMMRDelta(
      player,
      teamAForElo,
      { mmr: teamBMMR },
      { result: resultA, difficulty },
      playerStatsA
    );
    const newMMR = Math.round((player.mmr + delta) * 10) / 10;
    const rankResult = updateRankAndRP(player, newMMR, resultA === 1);
    updates.push({
      uid,
      mmr: newMMR,
      rank: rankResult.rank,
      rp: rankResult.rp,
      lossesSincePromotion: rankResult.lossesSincePromotion,
      oldRank: player.rank,
      oldRp: player.rp,
      mmrDelta: delta,
      rankResult,
    });
  }

  for (const uid of teamB.players || []) {
    const player = users.get(uid);
    if (!player) continue;
    const delta = calculateMMRDelta(
      player,
      teamBForElo,
      { mmr: teamAMMR },
      { result: resultB, difficulty },
      playerStatsB
    );
    const newMMR = Math.round((player.mmr + delta) * 10) / 10;
    const rankResult = updateRankAndRP(player, newMMR, resultB === 1);
    updates.push({
      uid,
      mmr: newMMR,
      rank: rankResult.rank,
      rp: rankResult.rp,
      lossesSincePromotion: rankResult.lossesSincePromotion,
      oldRank: player.rank,
      oldRp: player.rp,
      mmrDelta: delta,
      rankResult,
    });
  }

  const summary = {
    matchId,
    difficulty,
    winner,
    teamA: { score: teamA.score, players: teamA.players },
    teamB: { score: teamB.score, players: teamB.players },
    playerDeltas: updates.map((u) => ({
      uid: u.uid,
      mmrDelta: u.mmrDelta,
      oldRank: u.oldRank,
      newRank: u.rank,
      rpDelta: u.rp - u.oldRp,
    })),
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await firestore.runTransaction(async (tx) => {
    for (const u of updates) {
      const userRef = firestore.collection(USERS_COLLECTION).doc(u.uid);
      tx.update(userRef, {
        mmr: u.mmr,
        rank: u.rank,
        rp: u.rp,
        lossesSincePromotion: u.lossesSincePromotion,
      });
    }
    const matchRef = firestore.collection(MATCHES_COLLECTION).doc(matchId);
    tx.set(matchRef.collection('results').doc('summary'), summary);
  });

  for (const u of updates) {
    playerDeltas.set(u.uid, {
      mmrDelta: u.mmrDelta,
      oldRank: u.oldRank,
      newRank: u.rank,
      rpDelta: u.rp - u.oldRp,
    });
  }

  return { playerDeltas };
}
