/**
 * Queue Service
 *
 * Firestore-only logic for managing matchmaking queues.
 *
 * Responsibilities:
 * - Add user to queue
 * - Remove user from queue
 * - Prevent duplicate queue entries
 * - Trigger matchmaking attempt after join
 *
 * No Docker, no match engine calls, no sockets.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import { getTeam } from './teamService.js';
import { attemptMatch } from './matchmaking.js';

const QUEUES_COLLECTION = 'queues';
const USERS_COLLECTION = 'users';
const TEAMS_COLLECTION = 'teams';

const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'];

const MAX_QUEUE_SIZE = Number(process.env.MAX_QUEUE_SIZE_PER_DIFFICULTY) || 200;

function normalizeDifficulty(difficulty) {
  return String(difficulty || '')
    .trim()
    .toLowerCase();
}

function buildQueueId(difficulty, teamSize) {
  const diff = normalizeDifficulty(difficulty);
  return `${diff}_${teamSize}`;
}

/**
 * Fetch a user's MMR from Firestore.
 * Falls back to 1000 if not found or invalid.
 *
 * @param {import('firebase-admin').firestore.Firestore} firestore
 * @param {string} uid
 * @returns {Promise<number>}
 */
async function getUserMMR(firestore, uid) {
  const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    return 1000;
  }

  const data = snap.data() || {};
  return typeof data.mmr === 'number' ? data.mmr : 1000;
}

/**
 * Join matchmaking queue. mode: 'solo' | 'team'. Team mode requires user in team.
 *
 * @param {string} uid
 * @param {{ difficulty: string; teamSize: number; mode?: 'solo'|'team' }} options
 * @returns {Promise<{ queueId: string; difficulty: string; teamSize: number }>}
 */
export async function joinQueue(uid, options) {
  const firestore = getFirestore();

  if (!firestore) {
    throw new Error('Firestore is not initialized.');
  }

  const difficulty = normalizeDifficulty(options.difficulty);
  const teamSize = Math.min(4, Math.max(1, Number(options.teamSize) || 1));
  const mode = options.mode === 'team' ? 'team' : 'solo';

  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
    throw new Error('Invalid difficulty.');
  }

  if (!Number.isInteger(teamSize) || teamSize <= 0) {
    throw new Error('Invalid team size.');
  }

  let entry;
  if (mode === 'team') {
    const userSnap = await firestore.collection(USERS_COLLECTION).doc(uid).get();
    const currentTeamId = userSnap.exists ? userSnap.data()?.currentTeamId : null;
    if (!currentTeamId) throw new Error('You must be in a team to queue as team.');
    const team = await getTeam(currentTeamId);
    if (!team || !team.isActive) throw new Error('Team not found.');
    const members = Array.isArray(team.members) ? team.members : [];
    if (members.length < teamSize) throw new Error(`Team has ${members.length} members; need ${teamSize} for this queue.`);
    const memberUids = members.slice(0, teamSize).map((m) => m.uid);
    const averageMMR = typeof team.averageMMR === 'number' ? team.averageMMR : members.slice(0, teamSize).reduce((s, m) => s + (m.mmr || 1000), 0) / teamSize;
    entry = { type: 'team', teamId: currentTeamId, memberUids, averageMMR };
  } else {
    if (teamSize !== 1) throw new Error('Solo queue is 1v1 only.');
    const userMMR = await getUserMMR(firestore, uid);
    entry = { type: 'solo', playerId: uid, averageMMR: userMMR };
  }

  const queueId = buildQueueId(difficulty, teamSize);
  const queueRef = firestore.collection(QUEUES_COLLECTION).doc(queueId);

  const uidsInEntry = entry.type === 'solo' ? [entry.playerId] : (entry.memberUids || []);

  await firestore.runTransaction(async (tx) => {
    const existingQuery = firestore
      .collection(QUEUES_COLLECTION)
      .where('players', 'array-contains', uid)
      .where('status', '==', 'waiting');
    const existingSnap = await tx.get(existingQuery);
    if (!existingSnap.empty) {
      const existingData = existingSnap.docs[0].data();
      throw new Error(`User is already queued for difficulty=${existingData.difficulty}, teamSize=${existingData.teamSize}`);
    }

    const queueSnap = await tx.get(queueRef);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const entries = queueSnap.exists && Array.isArray(queueSnap.data().entries) ? queueSnap.data().entries.slice() : [];
    const players = queueSnap.exists && Array.isArray(queueSnap.data().players) ? queueSnap.data().players.slice() : [];
    const playerMMRMap = queueSnap.exists && typeof queueSnap.data().playerMMR === 'object' ? { ...queueSnap.data().playerMMR } : {};

    if (queueSnap.exists && queueSnap.data().status !== 'waiting') {
      tx.set(queueRef, {
        difficulty,
        teamSize,
        players: uidsInEntry,
        entries: [entry],
        avgMMR: entry.averageMMR,
        status: 'waiting',
        playerMMR: uidsInEntry.reduce((o, id) => ({ ...o, [id]: entry.averageMMR }), {}),
        createdAt: queueSnap.data().createdAt || now,
      }, { merge: true });
      return;
    }

    if (players.some((p) => uidsInEntry.includes(p))) return;

    if (entries.length >= MAX_QUEUE_SIZE) throw new Error('Queue is full. Try again later.');

    entries.push(entry);
    uidsInEntry.forEach((id) => {
      if (!players.includes(id)) players.push(id);
      playerMMRMap[id] = entry.averageMMR;
    });
    const avgMMR = entries.reduce((s, e) => s + (e.averageMMR || 1000), 0) / entries.length;

    if (!queueSnap.exists) {
      tx.set(queueRef, {
        difficulty,
        teamSize,
        players,
        entries,
        avgMMR,
        status: 'waiting',
        playerMMR: playerMMRMap,
        createdAt: now,
      });
    } else {
      tx.update(queueRef, { players, entries, playerMMR: playerMMRMap, avgMMR });
    }
  });

  await attemptMatch({ id: queueId, difficulty, teamSize });
  return { queueId, difficulty, teamSize };
}

/**
 * Leave matchmaking queue. Removes the entry containing uid (solo or team).
 *
 * @param {string} uid
 * @returns {Promise<{ left: boolean }>}
 */
export async function leaveQueue(uid) {
  const firestore = getFirestore();

  if (!firestore) {
    throw new Error('Firestore is not initialized.');
  }

  const query = firestore
    .collection(QUEUES_COLLECTION)
    .where('players', 'array-contains', uid)
    .where('status', '==', 'waiting');

  let left = false;

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(query);

    if (snap.empty) return;

    const doc = snap.docs[0];
    const data = doc.data() || {};
    const players = Array.isArray(data.players) ? data.players.slice() : [];
    const entries = Array.isArray(data.entries) ? data.entries.slice() : [];
    const playerMMRMap = data.playerMMR && typeof data.playerMMR === 'object' ? { ...data.playerMMR } : {};

    const idx = entries.findIndex((e) => e.playerId === uid || (e.memberUids && e.memberUids.includes(uid)));
    if (idx < 0) {
      if (players.includes(uid)) {
        const remainingPlayers = players.filter((p) => p !== uid);
        delete playerMMRMap[uid];
        if (remainingPlayers.length === 0) tx.delete(doc.ref);
        else {
          const avgMMR = remainingPlayers.reduce((s, p) => s + (playerMMRMap[p] || 1000), 0) / remainingPlayers.length;
          tx.update(doc.ref, { players: remainingPlayers, playerMMR: playerMMRMap, avgMMR });
        }
        left = true;
      }
      return;
    }

    const removed = entries[idx];
    const uidsToRemove = removed.type === 'solo' ? [removed.playerId] : (removed.memberUids || []);
    entries.splice(idx, 1);
    const remainingPlayers = players.filter((p) => !uidsToRemove.includes(p));
    uidsToRemove.forEach((id) => delete playerMMRMap[id]);

    if (remainingPlayers.length === 0) {
      tx.delete(doc.ref);
    } else {
      const avgMMR = entries.length > 0 ? entries.reduce((s, e) => s + (e.averageMMR || 1000), 0) / entries.length : 0;
      tx.update(doc.ref, { players: remainingPlayers, entries, playerMMR: playerMMRMap, avgMMR });
    }
    left = true;
  });

  return { left };
}

/**
 * Get queue status for a user.
 *
 * Returns whether the user is currently queued and, if so,
 * basic info about the queue.
 *
 * @param {string} uid
 * @returns {Promise<{
 *   queued: boolean;
 *   difficulty?: string;
 *   teamSize?: number;
   status?: string;
 }>}
 */
export async function getQueueStatus(uid) {
  const firestore = getFirestore();

  if (!firestore) {
    throw new Error('Firestore is not initialized.');
  }

  const query = firestore
    .collection(QUEUES_COLLECTION)
    .where('players', 'array-contains', uid)
    .where('status', '==', 'waiting');

  const snap = await query.get();

  if (snap.empty) {
    return { queued: false };
  }

  const doc = snap.docs[0];
  const data = doc.data() || {};

  return {
    queued: true,
    difficulty: data.difficulty,
    teamSize: data.teamSize,
    status: data.status,
  };
}

