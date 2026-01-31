/**
 * Challenge Service
 *
 * Direct challenges: send, accept, decline, expire (2 min).
 * Max 3 pending outgoing per user/team. Cooldown 1 min per target.
 * On accept: create match immediately with type 'challenge'.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import { getTeam } from './teamService.js';
import { getOnlinePlayersAndTeams } from './presenceService.js';

const CHALLENGES_COLLECTION = 'challenges';
const MATCHES_COLLECTION = 'matches';
const USERS_COLLECTION = 'users';

const EXPIRE_MS = 2 * 60 * 1000; // 2 minutes
const COOLDOWN_MS = 60 * 1000;   // 1 minute
const MAX_OUTGOING = 3;

async function getDisplayName(firestore, id, type) {
  if (type === 'solo') {
    const u = await firestore.collection(USERS_COLLECTION).doc(id).get();
    const d = u.exists ? u.data() : {};
    return d.displayName || d.username || d.email || id;
  }
  const t = await getTeam(id);
  return t ? t.name : id;
}

/**
 * Send challenge. Validates target online/available, challenger available, max 3 outgoing, cooldown.
 */
export async function sendChallenge(fromUid, fromType, { targetId, targetType, difficulty, teamSize }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized.');

  const diff = String(difficulty || 'medium').toLowerCase();
  const size = Math.min(4, Math.max(1, Number(teamSize) || 1));

  const userSnap = await firestore.collection(USERS_COLLECTION).doc(fromUid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const fromId = fromType === 'team' ? (userData.currentTeamId || null) : fromUid;
  if (fromType === 'team' && !fromId) throw new Error('You must be in a team to send a team challenge.');
  if (fromType === 'team') {
    const team = await getTeam(fromId);
    if (!team || team.leaderId !== fromUid) throw new Error('Only the team leader can send team challenges.');
  }

  const { players, teams } = await getOnlinePlayersAndTeams(fromUid, { mode: targetType });
  const targetOnline = targetType === 'solo'
    ? players.some((p) => p.id === targetId)
    : teams.some((t) => t.id === targetId);
  if (!targetOnline) throw new Error('This player/team is not currently online.');

  const inQueue = await isInQueueOrMatch(firestore, fromUid, fromType, fromId);
  if (inQueue) throw new Error('You cannot send a challenge while in queue or in a match.');

  const targetInQueue = await isInQueueOrMatch(firestore, targetId, targetType, targetId);
  if (targetInQueue) throw new Error('This player/team is currently unavailable.');

  const outgoing = await getOutgoingChallenges(firestore, fromId);
  if (outgoing.length >= MAX_OUTGOING) throw new Error('Maximum 3 pending challenges. Wait for a response.');

  const lastToTarget = await getLastChallengeToTarget(firestore, fromId, targetId);
  if (lastToTarget && lastToTarget.recentAt && Date.now() - lastToTarget.recentAt < COOLDOWN_MS) throw new Error('Please wait 1 minute before challenging this player/team again.');

  const [fromName, toName] = await Promise.all([
    getDisplayName(firestore, fromId, fromType),
    getDisplayName(firestore, targetId, targetType),
  ]);

  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + EXPIRE_MS);

  const ref = await firestore.collection(CHALLENGES_COLLECTION).add({
    fromId,
    fromType: fromType || 'solo',
    fromName,
    toId: targetId,
    toType: targetType || 'solo',
    toName,
    difficulty: diff,
    teamSize: size,
    status: 'pending',
    createdAt: now,
    expiresAt,
  });

  return {
    success: true,
    challengeId: ref.id,
    notificationPayload: {
      challengeId: ref.id,
      from: { id: fromId, name: fromName, type: fromType || 'solo' },
      difficulty: diff,
      teamSize: size,
      expiresAt: expiresAt.toMillis(),
    },
  };
}

async function isInQueueOrMatch(firestore, uid, type, entityId) {
  const queues = await firestore.collection('queues').where('status', '==', 'waiting').get();
  for (const doc of queues.docs) {
    const d = doc.data();
    if ((d.players || []).includes(uid)) return true;
    const entries = d.entries || [];
    for (const e of entries) {
      if (e.playerId === uid) return true;
      if ((e.memberUids || []).includes(uid)) return true;
      if (e.teamId === entityId) return true;
    }
  }
  const matches = await firestore.collection(MATCHES_COLLECTION).where('status', 'in', ['pending', 'starting', 'running']).limit(200).get();
  for (const doc of matches.docs) {
    const d = doc.data();
    if ((d.teamA || []).includes(uid) || (d.teamB || []).includes(uid)) return true;
  }
  return false;
}

async function getOutgoingChallenges(firestore, fromId) {
  const snap = await firestore
    .collection(CHALLENGES_COLLECTION)
    .where('fromId', '==', fromId)
    .where('status', '==', 'pending')
    .get();
  const now = Date.now();
  return snap.docs.filter((d) => {
    const data = d.data();
    return data.expiresAt && data.expiresAt.toMillis() > now;
  });
}

async function getLastChallengeToTarget(firestore, fromId, toId) {
  const snap = await firestore
    .collection(CHALLENGES_COLLECTION)
    .where('fromId', '==', fromId)
    .where('toId', '==', toId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  const resolvedAt = d.resolvedAt?.toMillis?.() ?? null;
  const createdAt = d.createdAt?.toMillis?.() ?? 0;
  const recentAt = resolvedAt ?? (d.status === 'pending' ? createdAt : createdAt + EXPIRE_MS);
  return { recentAt };
}

/**
 * Respond to challenge: accept or decline.
 */
export async function respondToChallenge(uid, challengeId, action) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized.');

  const ref = firestore.collection(CHALLENGES_COLLECTION).doc(challengeId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Challenge not found.');
  const data = snap.data();

  if (data.status !== 'pending') throw new Error('This challenge has already been resolved.');
  const nowMs = Date.now();
  if (data.expiresAt && data.expiresAt.toMillis() < nowMs) {
    await ref.update({ status: 'expired', resolvedAt: admin.firestore.FieldValue.serverTimestamp() });
    throw new Error('This challenge has expired.');
  }

  const toId = data.toId;
  const toType = data.toType;
  const isTeamTarget = toType === 'team';
  const isRecipient = isTeamTarget
    ? (await getTeam(toId))?.leaderId === uid
    : toId === uid;
  if (!isRecipient) throw new Error('You are not the recipient of this challenge.');

  const now = admin.firestore.FieldValue.serverTimestamp();

  if (action === 'decline') {
    await ref.update({ status: 'declined', resolvedAt: now });
    return { success: true };
  }

  if (action !== 'accept') throw new Error('Invalid action.');

  const fromId = data.fromId;
  const fromType = data.fromType;
  const difficulty = data.difficulty || 'medium';
  const teamSize = data.teamSize || 1;

  const teamA = await getMemberUids(firestore, fromId, fromType);
  const teamB = await getMemberUids(firestore, toId, toType);
  if (!teamA.length || !teamB.length) throw new Error('Invalid team configuration.');
  const size = Math.min(teamSize, teamA.length, teamB.length);
  const finalTeamA = teamA.slice(0, size);
  const finalTeamB = teamB.slice(0, size);
  if (finalTeamA.length < size || finalTeamB.length < size) throw new Error('Team size mismatch.');

  const matchRef = firestore.collection(MATCHES_COLLECTION).doc();
  await firestore.runTransaction(async (tx) => {
    tx.set(matchRef, {
      difficulty,
      teamSize: size,
      teamA: finalTeamA,
      teamB: finalTeamB,
      status: 'pending',
      type: 'challenge',
      createdAt: now,
    });
    tx.update(ref, { status: 'accepted', matchId: matchRef.id, resolvedAt: now });
  });

  return { success: true, matchId: matchRef.id };
}

async function getMemberUids(firestore, entityId, type) {
  if (type === 'solo') return [entityId];
  const team = await getTeam(entityId);
  if (!team || !Array.isArray(team.members)) return [];
  return team.members.map((m) => m.uid);
}

/**
 * Get pending challenges received by current user/team.
 */
export async function getReceivedChallenges(uid) {
  const firestore = getFirestore();
  if (!firestore) return [];

  const userData = (await firestore.collection(USERS_COLLECTION).doc(uid).get()).data() || {};
  const teamId = userData.currentTeamId;
  const toId = teamId || uid;
  const toType = teamId ? 'team' : 'solo';
  const team = teamId ? await getTeam(teamId) : null;
  const isLeader = !teamId || (team && team.leaderId === uid);

  const snap = await firestore
    .collection(CHALLENGES_COLLECTION)
    .where('toId', '==', toId)
    .where('status', '==', 'pending')
    .get();

  const now = Date.now();
  const list = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.expiresAt && d.expiresAt.toMillis() < now) continue;
    if (toType === 'team' && !isLeader) continue;
    list.push({
      id: doc.id,
      ...d,
      createdAt: d.createdAt?.toMillis?.() ?? null,
      expiresAt: d.expiresAt?.toMillis?.() ?? null,
    });
  }
  return list;
}

/**
 * Get pending challenges sent by current user/team.
 */
export async function getSentChallenges(uid) {
  const firestore = getFirestore();
  if (!firestore) return [];

  const userData = (await firestore.collection(USERS_COLLECTION).doc(uid).get()).data() || {};
  const fromId = userData.currentTeamId || uid;
  const fromType = userData.currentTeamId ? 'team' : 'solo';

  const snap = await firestore
    .collection(CHALLENGES_COLLECTION)
    .where('fromId', '==', fromId)
    .where('status', '==', 'pending')
    .get();

  const now = Date.now();
  const list = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.expiresAt && d.expiresAt.toMillis() < now) continue;
    list.push({
      id: doc.id,
      ...d,
      createdAt: d.createdAt?.toMillis?.() ?? null,
      expiresAt: d.expiresAt?.toMillis?.() ?? null,
    });
  }
  return list;
}
