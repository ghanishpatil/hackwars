/**
 * Matchmaking Service
 *
 * Contains logical matchmaking only.
 *
 * Responsibilities in this step:
 * - Given a queue, decide when a match can be formed.
 * - Create a match metadata document in Firestore.
 * - Mark the queue as matched and clear its players.
 *
 * No Docker, no match engine calls, no scoring, no sockets.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';

const MATCHES_COLLECTION = 'matches';
const QUEUES_COLLECTION = 'queues';

/**
 * Attempt to form a match from a queue.
 *
 * This function is intentionally conservative:
 * - It re-reads the queue document inside a transaction to avoid stale data.
 * - It only proceeds when there are at least `teamSize * 2` players.
 *
 * `queue` is expected to be a lightweight descriptor:
 * {
 *   id: string;          // Queue document ID
 *   difficulty: string;  // Queue difficulty
 *   teamSize: number;    // Team size
 * }
 *
 * @param {{ id: string; difficulty: string; teamSize: number }} queue
 * @returns {Promise<void>}
 */
export async function attemptMatch(queue) {
  const firestore = getFirestore();

  if (!firestore) {
    console.warn('Firestore is not initialized. Skipping matchmaking.');
    return;
  }

  const { id: queueId } = queue;
  const queueRef = firestore.collection(QUEUES_COLLECTION).doc(queueId);
  const matchesRef = firestore.collection(MATCHES_COLLECTION);

  await firestore.runTransaction(async (tx) => {
    const queueSnap = await tx.get(queueRef);

    if (!queueSnap.exists) return;

    const data = queueSnap.data() || {};
    if (data.status !== 'waiting') return;

    const teamSize = data.teamSize;
    const entries = Array.isArray(data.entries) ? data.entries.slice() : [];
    const players = Array.isArray(data.players) ? data.players.slice() : [];
    const playerMMRMap = data.playerMMR && typeof data.playerMMR === 'object' ? { ...data.playerMMR } : {};

    if (entries.length >= 2) {
      const effectiveSize = (e) => (e.type === 'solo' ? 1 : (e.memberUids || []).length);
      const getUids = (e) => (e.type === 'solo' ? [e.playerId] : (e.memberUids || []));
      let i = -1;
      let j = -1;
      for (let a = 0; a < entries.length; a++) {
        for (let b = a + 1; b < entries.length; b++) {
          if (entries[a].type !== entries[b].type) continue;
          if (effectiveSize(entries[a]) !== teamSize || effectiveSize(entries[b]) !== teamSize) continue;
          i = a;
          j = b;
          break;
        }
        if (i >= 0) break;
      }
      if (i >= 0 && j >= 0) {
        const e1 = entries[i];
        const e2 = entries[j];
        const teamAUids = getUids(e1);
        const teamBUids = getUids(e2);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const matchDocRef = matchesRef.doc();
        tx.set(matchDocRef, {
          difficulty: data.difficulty,
          teamSize,
          teamA: teamAUids,
          teamB: teamBUids,
          avgMMR_A: e1.averageMMR ?? 1000,
          avgMMR_B: e2.averageMMR ?? 1000,
          status: 'pending',
          type: 'ranked',
          createdAt: now,
        });
        entries.splice(j, 1);
        entries.splice(i, 1);
        const removedUids = [...teamAUids, ...teamBUids];
        const remainingPlayers = players.filter((p) => !removedUids.includes(p));
        removedUids.forEach((id) => delete playerMMRMap[id]);
        const avgMMR = entries.length > 0 ? entries.reduce((s, e) => s + (e.averageMMR || 1000), 0) / entries.length : 0;
        tx.update(queueRef, { entries, players: remainingPlayers, playerMMR: playerMMRMap, avgMMR });
      }
      return;
    }

    if (!teamSize || players.length < teamSize * 2) return;

    const playerEntries = players.map((uid) => ({
      uid,
      mmr: typeof playerMMRMap[uid] === 'number' ? playerMMRMap[uid] : 1000,
    }));
    playerEntries.sort((a, b) => b.mmr - a.mmr);
    const teamA = [];
    const teamB = [];
    playerEntries.forEach((entry, index) => {
      if (index % 2 === 0) teamA.push(entry);
      else teamB.push(entry);
    });
    const finalTeamA = teamA.slice(0, teamSize);
    const finalTeamB = teamB.slice(0, teamSize);
    if (finalTeamA.length < teamSize || finalTeamB.length < teamSize) return;

    const avg = (arr) => arr.reduce((sum, p) => sum + (p.mmr || 1000), 0) / arr.length;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const matchDocRef = matchesRef.doc();
    tx.set(matchDocRef, {
      difficulty: data.difficulty,
      teamSize,
      teamA: finalTeamA.map((p) => p.uid),
      teamB: finalTeamB.map((p) => p.uid),
      avgMMR_A: avg(finalTeamA),
      avgMMR_B: avg(finalTeamB),
      status: 'pending',
      type: 'ranked',
      createdAt: now,
    });
    tx.update(queueRef, {
      status: 'matched',
      players: [],
      entries: [],
      playerMMR: {},
      avgMMR: 0,
      matchedAt: now,
    });
  });
}

