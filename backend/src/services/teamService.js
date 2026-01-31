/**
 * Team Service
 *
 * Create/join/leave/disband teams. Invite codes 6 chars uppercase alphanumeric.
 * Team name unique. One team per user. Leadership transfer on leave.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';

const USERS_COLLECTION = 'users';
const TEAMS_COLLECTION = 'teams';

const INVITE_CODE_LENGTH = 6;
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

async function generateInviteCode(firestore) {
  let code;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 20) {
    code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
    }
    const snap = await firestore.collection(TEAMS_COLLECTION).where('inviteCode', '==', code).limit(1).get();
    exists = !snap.empty;
    attempts++;
  }
  if (exists) throw new Error('Could not generate unique invite code');
  return code;
}

async function getUserProfile(firestore, uid) {
  const snap = await firestore.collection(USERS_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;
  const d = snap.data();
  return {
    uid,
    username: d.username ?? d.displayName ?? '',
    mmr: typeof d.mmr === 'number' ? d.mmr : 1000,
    rank: d.rank ?? 'Initiate',
  };
}

/**
 * Create team. User becomes leader. Name must be unique, 3-20 alphanumeric.
 */
export async function createTeam(uid, { teamName, maxSize }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized.');

  const name = String(teamName ?? '').trim();
  if (name.length < 3 || name.length > 20) throw new Error('Team name must be 3-20 characters.');
  if (!/^[a-zA-Z0-9]+$/.test(name)) throw new Error('Team name must be alphanumeric only.');

  const size = Math.min(4, Math.max(2, Number(maxSize) || 2));
  if (![2, 3, 4].includes(size)) throw new Error('Max size must be 2, 3, or 4.');

  const userSnap = await firestore.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists) throw new Error('User not found.');
  const userData = userSnap.data();
  if (userData.currentTeamId) throw new Error('You must leave your current team first.');

  const nameSnap = await firestore.collection(TEAMS_COLLECTION).where('name', '==', name).where('isActive', '==', true).limit(1).get();
  if (!nameSnap.empty) throw new Error('This team name is already taken.');

  const inviteCode = await generateInviteCode(firestore);
  const profile = await getUserProfile(firestore, uid);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const member = {
    uid,
    username: profile?.username ?? uid,
    mmr: profile?.mmr ?? 1000,
    joinedAt: now,
  };

  const teamRef = firestore.collection(TEAMS_COLLECTION).doc();
  await firestore.runTransaction(async (tx) => {
    tx.set(teamRef, {
      name,
      leaderId: uid,
      members: [member],
      maxSize: size,
      currentSize: 1,
      inviteCode,
      averageMMR: member.mmr,
      isActive: true,
      createdAt: now,
    });
    tx.update(firestore.collection(USERS_COLLECTION).doc(uid), {
      currentTeamId: teamRef.id,
    });
  });

  const teamSnap = await teamRef.get();
  return { id: teamRef.id, ...teamSnap.data() };
}

/**
 * Join team by invite code. Code exists, team not full, user not in another team.
 */
export async function joinTeam(uid, { inviteCode }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized.');

  const code = String(inviteCode ?? '').trim().toUpperCase();
  if (code.length !== INVITE_CODE_LENGTH) throw new Error('Invalid invite code.');

  const teamSnap = await firestore.collection(TEAMS_COLLECTION).where('inviteCode', '==', code).where('isActive', '==', true).limit(1).get();
  if (teamSnap.empty) throw new Error('Invalid invite code.');
  const teamRef = teamSnap.docs[0].ref;
  const teamData = teamSnap.docs[0].data();

  const userSnap = await firestore.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists) throw new Error('User not found.');
  if (userSnap.data().currentTeamId) throw new Error('You must leave your current team first.');

  const members = Array.isArray(teamData.members) ? teamData.members.slice() : [];
  if (members.length >= teamData.maxSize) throw new Error('This team has reached maximum capacity.');

  const profile = await getUserProfile(firestore, uid);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const member = {
    uid,
    username: profile?.username ?? uid,
    mmr: profile?.mmr ?? 1000,
    joinedAt: now,
  };
  members.push(member);
  const averageMMR = members.reduce((s, m) => s + (m.mmr || 1000), 0) / members.length;

  await firestore.runTransaction(async (tx) => {
    tx.update(teamRef, {
      members,
      currentSize: members.length,
      averageMMR,
    });
    tx.update(firestore.collection(USERS_COLLECTION).doc(uid), {
      currentTeamId: teamRef.id,
    });
  });

  const updated = await teamRef.get();
  return { id: teamRef.id, ...updated.data() };
}

/**
 * Leave team. If leader leaves, transfer to next oldest member. If no members left, disband.
 */
export async function leaveTeam(uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized.');

  const userSnap = await firestore.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists || !userSnap.data().currentTeamId) throw new Error('You are not in a team.');

  const teamId = userSnap.data().currentTeamId;
  const teamRef = firestore.collection(TEAMS_COLLECTION).doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) {
    await firestore.collection(USERS_COLLECTION).doc(uid).update({ currentTeamId: admin.firestore.FieldValue.delete() });
    return { left: true };
  }

  const data = teamSnap.data();
  const members = Array.isArray(data.members) ? data.members.filter((m) => m.uid !== uid) : [];

  if (members.length === 0) {
    await firestore.runTransaction(async (tx) => {
      tx.update(teamRef, { isActive: false, members: [], currentSize: 0 });
      tx.update(firestore.collection(USERS_COLLECTION).doc(uid), { currentTeamId: admin.firestore.FieldValue.delete() });
    });
    return { left: true };
  }

  const isLeader = data.leaderId === uid;
  const newLeaderId = isLeader
    ? members.reduce((oldest, m) => {
        const mJoined = m.joinedAt?.toMillis?.() ?? m.joinedAt ?? 0;
        const oldJoined = oldest.joinedAt?.toMillis?.() ?? oldest.joinedAt ?? 0;
        return mJoined < oldJoined ? m : oldest;
      }, members[0]).uid
    : data.leaderId;

  const averageMMR = members.reduce((s, m) => s + (m.mmr || 1000), 0) / members.length;

  await firestore.runTransaction(async (tx) => {
    tx.update(teamRef, {
      members,
      currentSize: members.length,
      leaderId: newLeaderId,
      averageMMR,
    });
    tx.update(firestore.collection(USERS_COLLECTION).doc(uid), { currentTeamId: admin.firestore.FieldValue.delete() });
  });

  return { left: true };
}

/**
 * Disband team. Only leader. Sets isActive false, clears all members' currentTeamId.
 */
export async function disbandTeam(uid, teamId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized.');

  const teamRef = firestore.collection(TEAMS_COLLECTION).doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) throw new Error('Team not found.');
  const data = teamSnap.data();
  if (data.leaderId !== uid) throw new Error('Only the team leader can disband the team.');

  const members = Array.isArray(data.members) ? data.members : [];
  const batch = firestore.batch();
  batch.update(teamRef, { isActive: false, members: [], currentSize: 0 });
  members.forEach((m) => {
    batch.update(firestore.collection(USERS_COLLECTION).doc(m.uid), { currentTeamId: admin.firestore.FieldValue.delete() });
  });
  await batch.commit();
  return { disbanded: true };
}

/**
 * Get team by ID.
 */
export async function getTeam(teamId) {
  const firestore = getFirestore();
  if (!firestore) return null;
  const snap = await firestore.collection(TEAMS_COLLECTION).doc(teamId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Get team by invite code.
 */
export async function getTeamByInviteCode(inviteCode) {
  const firestore = getFirestore();
  if (!firestore) return null;
  const code = String(inviteCode ?? '').trim().toUpperCase();
  const snap = await firestore.collection(TEAMS_COLLECTION).where('inviteCode', '==', code).where('isActive', '==', true).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}
