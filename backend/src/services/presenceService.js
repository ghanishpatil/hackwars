/**
 * Presence Service
 *
 * Heartbeat every 30s. Mark offline if lastHeartbeat > 2 min.
 * online_users: uid (doc id), username, mmr, rank, teamId, teamName, isInQueue, isInMatch, lastHeartbeat.
 * users.onlineStatus: { isOnline, lastHeartbeat, currentPage }.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';

const USERS_COLLECTION = 'users';
const ONLINE_USERS_COLLECTION = 'online_users';
const QUEUES_COLLECTION = 'queues';
const MATCHES_COLLECTION = 'matches';

const STALE_MS = 2 * 60 * 1000; // 2 minutes

async function isUserInQueue(firestore, uid) {
  const snap = await firestore.collection(QUEUES_COLLECTION).where('status', '==', 'waiting').get();
  for (const doc of snap.docs) {
    const data = doc.data();
    if ((data.players || []).includes(uid)) return true;
    for (const e of data.entries || []) {
      if (e.playerId === uid || (e.memberUids || []).includes(uid)) return true;
    }
  }
  return false;
}

async function isUserInActiveMatch(firestore, uid) {
  const snap = await firestore
    .collection(MATCHES_COLLECTION)
    .where('status', 'in', ['pending', 'starting', 'running'])
    .limit(500)
    .get();
  for (const doc of snap.docs) {
    const data = doc.data();
    const teamA = data.teamA || [];
    const teamB = data.teamB || [];
    if (teamA.includes(uid) || teamB.includes(uid)) return true;
  }
  return false;
}

/**
 * Heartbeat: update online_users and users.onlineStatus, cleanup stale.
 */
export async function heartbeat(uid, currentPage) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized.');

  const now = admin.firestore.Timestamp.now();
  const nowMs = now.toMillis();
  const staleCutoff = admin.firestore.Timestamp.fromMillis(nowMs - STALE_MS);

  const userSnap = await firestore.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists) throw new Error('User not found.');
  const userData = userSnap.data();

  const inQueue = await isUserInQueue(firestore, uid);
  const inMatch = await isUserInActiveMatch(firestore, uid);

  const teamId = userData.currentTeamId || null;
  let teamName = null;
  if (teamId) {
    const teamSnap = await firestore.collection('teams').doc(teamId).get();
    if (teamSnap.exists) teamName = teamSnap.data().name || null;
  }

  const onlineDoc = {
    uid,
    username: userData.username ?? userData.displayName ?? uid,
    mmr: typeof userData.mmr === 'number' ? userData.mmr : 1000,
    rank: userData.rank ?? 'Initiate',
    teamId,
    teamName,
    isInQueue: inQueue,
    isInMatch: inMatch,
    lastHeartbeat: now,
  };

  await firestore.collection(ONLINE_USERS_COLLECTION).doc(uid).set(onlineDoc, { merge: true });
  await firestore.collection(USERS_COLLECTION).doc(uid).update({
    onlineStatus: {
      isOnline: true,
      lastHeartbeat: now,
      currentPage: String(currentPage ?? 'matchmaking').slice(0, 50),
    },
  });

  // Cleanup stale online_users and mark those users offline
  const staleSnap = await firestore
    .collection(ONLINE_USERS_COLLECTION)
    .where('lastHeartbeat', '<', staleCutoff)
    .limit(100)
    .get();
  const batch = firestore.batch();
  for (const doc of staleSnap.docs) {
    batch.update(firestore.collection(USERS_COLLECTION).doc(doc.id), {
      onlineStatus: { isOnline: false, lastHeartbeat: doc.data().lastHeartbeat, currentPage: 'offline' },
    });
    batch.delete(doc.ref);
  }
  if (!staleSnap.empty) await batch.commit();

  const allOnline = await firestore.collection(ONLINE_USERS_COLLECTION).get();
  return { success: true, onlineCount: allOnline.size };
}

/**
 * Get online players and teams for matchmaking. Exclude self, in queue, in match.
 * mode: 'solo' | 'team'. minMMR/maxMMR filter. Returns { players, teams, onlineCount }.
 */
export async function getOnlinePlayersAndTeams(uid, { mode = 'solo', minMMR, maxMMR } = {}) {
  const firestore = getFirestore();
  if (!firestore) return { players: [], teams: [], onlineCount: 0 };

  const now = admin.firestore.Timestamp.now();
  const staleCutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - STALE_MS);

  const userData = (await firestore.collection(USERS_COLLECTION).doc(uid).get()).data() || {};
  const myTeamId = userData.currentTeamId || null;

  const snap = await firestore
    .collection(ONLINE_USERS_COLLECTION)
    .where('lastHeartbeat', '>', staleCutoff)
    .get();

  const players = [];
  const teamsById = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.uid === uid) continue;
    if (data.isInQueue || data.isInMatch) continue;

    const mmr = typeof data.mmr === 'number' ? data.mmr : 1000;
    if (minMMR != null && mmr < minMMR) continue;
    if (maxMMR != null && mmr > maxMMR) continue;

    if (mode === 'solo') {
      players.push({
        id: data.uid,
        type: 'solo',
        name: data.username ?? data.uid,
        mmr: data.mmr ?? 1000,
        rank: data.rank ?? 'Initiate',
      });
    } else {
      if (data.teamId && data.teamName && data.teamId !== myTeamId) {
        if (!teamsById.has(data.teamId)) {
          teamsById.set(data.teamId, {
            id: data.teamId,
            type: 'team',
            name: data.teamName,
            memberCount: 1,
            averageMMR: data.mmr ?? 1000,
            mmrSum: data.mmr ?? 1000,
          });
        } else {
          const t = teamsById.get(data.teamId);
          t.memberCount += 1;
          t.mmrSum += data.mmr ?? 1000;
          t.averageMMR = Math.round(t.mmrSum / t.memberCount);
        }
      }
    }
  }

  const teams = Array.from(teamsById.values()).map((t) => ({
    id: t.id,
    type: 'team',
    name: t.name,
    memberCount: t.memberCount,
    averageMMR: t.averageMMR,
  }));

  return {
    players,
    teams,
    onlineCount: snap.size,
  };
}
