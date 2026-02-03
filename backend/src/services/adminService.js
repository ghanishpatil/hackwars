/**
 * Admin Service: platform overview, match control, player moderation, system controls.
 * All actions are audited to admin_events. All admin actions go Backend → Engine (no direct frontend → engine).
 */

import admin from 'firebase-admin';
import { getFirestore, getAuth } from '../firebase/firebaseAdmin.js';
import { getMatchStatus, getMatchResult, getEngineHealth, stopMatch, cleanupMatch } from './engineClient.js';

const USERS_COLLECTION = 'users';
const MATCHES_COLLECTION = 'matches';
const QUEUES_COLLECTION = 'queues';
const ADMIN_EVENTS_COLLECTION = 'admin_events';
const TEAM_EVENTS_COLLECTION = 'team_events';
const SYSTEM_CONFIG_COLLECTION = 'system_config';

/**
 * Write an audit event for every admin action.
 *
 * @param {import('firebase-admin').firestore.Firestore} firestore
 * @param {string} adminId
 * @param {string} action
 * @param {string} target
 * @param {Record<string, unknown>} metadata
 */
async function audit(firestore, adminId, action, target, metadata = {}) {
  await firestore.collection(ADMIN_EVENTS_COLLECTION).add({
    adminId,
    action,
    target,
    metadata,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * GET /admin/overview: active users, queues, matches, engine health.
 *
 * @param {string} adminId
 * @returns {Promise<{ activeUsers: number; activeQueues: number; activeMatches: number; engineHealth: object | null }>}
 */
export async function getOverview(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const [usersSnap, queuesSnap, matchesSnap, engineHealth] = await Promise.all([
    firestore.collection(USERS_COLLECTION).count().get(),
    firestore.collection(QUEUES_COLLECTION).where('status', '==', 'waiting').get(),
    firestore.collection(MATCHES_COLLECTION).where('status', 'in', ['pending', 'starting', 'running']).limit(500).get(),
    getEngineHealth(),
  ]);

  await audit(firestore, adminId, 'overview', 'platform', {});

  return {
    activeUsers: usersSnap.data().count ?? 0,
    activeQueues: queuesSnap.size,
    activeMatches: matchesSnap.size,
    engineHealth: engineHealth ?? { status: 'unreachable' },
  };
}

/**
 * GET /admin/matches: list matches (from Firestore, with optional engine state).
 *
 * @param {string} adminId
 * @returns {Promise<Array<{ matchId: string; difficulty: string; status: string; teamA: string[]; teamB: string[]; engineState?: string }>>}
 */
export async function getMatches(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const snap = await firestore.collection(MATCHES_COLLECTION).orderBy('createdAt', 'desc').limit(100).get();
  const matches = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    matches.push({
      matchId: doc.id,
      difficulty: d.difficulty ?? 'easy',
      status: d.status ?? 'pending',
      teamA: d.teamA ?? [],
      teamB: d.teamB ?? [],
      invalid: d.invalid === true,
    });
  }

  await audit(firestore, adminId, 'list_matches', 'matches', { count: matches.length });
  return matches;
}

/**
 * GET /admin/match/:id: match detail (Firestore + engine result if ended).
 *
 * @param {string} adminId
 * @param {string} matchId
 * @returns {Promise<object>}
 */
export async function getMatchDetail(adminId, matchId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const matchRef = firestore.collection(MATCHES_COLLECTION).doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    return null;
  }

  const data = matchSnap.data();
  let engineState = null;
  let result = null;
  try {
    engineState = await getMatchStatus(matchId);
    if (engineState && engineState.state === 'ENDED') {
      result = await getMatchResult(matchId);
    }
  } catch {
    engineState = { state: 'unknown' };
  }

  await audit(firestore, adminId, 'match_detail', matchId, {});

  return {
    matchId,
    difficulty: data.difficulty,
    teamSize: data.teamSize,
    teamA: data.teamA,
    teamB: data.teamB,
    status: data.status,
    invalid: data.invalid === true,
    engineState: engineState?.state ?? null,
    result,
  };
}

/**
 * POST /admin/match/:id/stop: force stop match (backend → engine).
 *
 * @param {string} adminId
 * @param {string} matchId
 */
export async function stopMatchAdmin(adminId, matchId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await stopMatch(matchId);
  await firestore.collection(MATCHES_COLLECTION).doc(matchId).update({ status: 'stopped' });
  await audit(firestore, adminId, 'match_stop', matchId, {});
}

/**
 * POST /admin/match/:id/invalid: mark match invalid (no rank update on end).
 *
 * @param {string} adminId
 * @param {string} matchId
 */
export async function markMatchInvalid(adminId, matchId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const matchRef = firestore.collection(MATCHES_COLLECTION).doc(matchId);
  await matchRef.update({ invalid: true });
  await audit(firestore, adminId, 'match_invalid', matchId, {});
}

/**
 * POST /admin/match/:id/delete: permanently erase match (engine cleanup + Firestore delete, no trace).
 *
 * @param {string} adminId
 * @param {string} matchId
 */
export async function deleteMatchAdmin(adminId, matchId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const matchRef = firestore.collection(MATCHES_COLLECTION).doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    return; // already gone
  }

  try {
    await cleanupMatch(matchId);
  } catch (err) {
    console.warn(`[admin] Engine cleanup for match ${matchId} failed (continuing DB delete):`, err.message);
  }

  await matchRef.delete();
  await audit(firestore, adminId, 'match_delete', matchId, {});
}

/**
 * Compute real-time status for a user: BANNED | IN_MATCH | IN_QUEUE | ACTIVE.
 *
 * @param {string} uid
 * @param {boolean} banned
 * @param {Set<string>} uidsInQueue
 * @param {Set<string>} uidsInMatch
 * @returns {'BANNED'|'IN_MATCH'|'IN_QUEUE'|'ACTIVE'}
 */
function computeUserStatus(uid, banned, uidsInQueue, uidsInMatch) {
  if (banned) return 'BANNED';
  if (uidsInMatch.has(uid)) return 'IN_MATCH';
  if (uidsInQueue.has(uid)) return 'IN_QUEUE';
  return 'ACTIVE';
}

/**
 * GET /admin/players: list players with displayName, contact, institute, track, role, real-time status.
 *
 * @param {string} adminId
 * @returns {Promise<Array<object>>}
 */
export async function getPlayers(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const [usersSnap, queuesSnap, matchesSnap] = await Promise.all([
    firestore.collection(USERS_COLLECTION).limit(200).get(),
    firestore.collection(QUEUES_COLLECTION).where('status', '==', 'waiting').get(),
    firestore.collection(MATCHES_COLLECTION).where('status', 'in', ['pending', 'starting', 'running']).limit(500).get(),
  ]);

  const uidsInQueue = new Set();
  for (const doc of queuesSnap.docs) {
    const players = doc.data().players;
    if (Array.isArray(players)) players.forEach((p) => uidsInQueue.add(p));
  }

  const uidsInMatch = new Set();
  for (const doc of matchesSnap.docs) {
    const d = doc.data();
    (d.teamA || []).forEach((p) => uidsInMatch.add(p));
    (d.teamB || []).forEach((p) => uidsInMatch.add(p));
  }

  const players = usersSnap.docs.map((doc) => {
    const d = doc.data();
    const banned = d.banned === true;
    const status = computeUserStatus(doc.id, banned, uidsInQueue, uidsInMatch);
    return {
      uid: doc.id,
      email: d.email,
      username: d.username,
      displayName: d.displayName ?? '',
      phone: d.phone ?? '',
      institute: d.institute ?? '',
      track: d.track ?? '',
      role: d.role ?? 'user',
      mmr: d.mmr,
      rank: d.rank,
      rp: d.rp,
      banned,
      shadowBan: d.shadowBan === true,
      lastLogin: d.lastLogin?.toMillis?.() ?? d.lastLogin ?? null,
      lastActive: d.lastActive?.toMillis?.() ?? d.lastActive ?? d.lastLogin?.toMillis?.() ?? d.lastLogin ?? null,
      status,
    };
  });

  await audit(firestore, adminId, 'list_players', 'players', { count: players.length });
  return players;
}

/**
 * GET /admin/user/:uid: player profile with real-time status.
 *
 * @param {string} adminId
 * @param {string} uid
 * @returns {Promise<object | null>}
 */
export async function getUserProfile(adminId, uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const [userSnap, queuesSnap, matchesSnap] = await Promise.all([
    firestore.collection(USERS_COLLECTION).doc(uid).get(),
    firestore.collection(QUEUES_COLLECTION).where('players', 'array-contains', uid).where('status', '==', 'waiting').limit(1).get(),
    firestore.collection(MATCHES_COLLECTION).where('status', 'in', ['pending', 'starting', 'running']).limit(100).get(),
  ]);

  if (!userSnap.exists) return null;
  const d = userSnap.data();

  const inQueue = queuesSnap.size > 0;
  let inMatch = false;
  for (const doc of matchesSnap.docs) {
    const data = doc.data();
    const teamA = data.teamA || [];
    const teamB = data.teamB || [];
    if (teamA.includes(uid) || teamB.includes(uid)) {
      inMatch = true;
      break;
    }
  }
  const banned = d.banned === true;
  const status = computeUserStatus(uid, banned, new Set(inQueue ? [uid] : []), new Set(inMatch ? [uid] : []));

  await audit(firestore, adminId, 'user_profile', uid, {});

  return {
    uid: userSnap.id,
    email: d.email,
    username: d.username,
    displayName: d.displayName ?? '',
    phone: d.phone ?? '',
    institute: d.institute ?? '',
    track: d.track ?? '',
    role: d.role ?? 'user',
    mmr: d.mmr,
    rank: d.rank,
    rp: d.rp,
    banned,
    shadowBan: d.shadowBan === true,
    lastLogin: d.lastLogin?.toMillis?.() ?? d.lastLogin ?? null,
    lastActive: d.lastActive?.toMillis?.() ?? d.lastActive ?? d.lastLogin?.toMillis?.() ?? d.lastLogin ?? null,
    status,
  };
}

/**
 * GET /admin/user/:uid/activity: detailed history for a user (last login, last active, matches, admin events).
 *
 * @param {string} adminId
 * @param {string} uid
 * @returns {Promise<{ lastLogin: number|null; lastActive: number|null; recentMatches: array; recentAdminEvents: array }>}
 */
export async function getUserActivity(adminId, uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const [userSnap, matchesSnap, eventsSnap, teamEventsSnap] = await Promise.all([
    firestore.collection(USERS_COLLECTION).doc(uid).get(),
    firestore.collection(MATCHES_COLLECTION).orderBy('createdAt', 'desc').limit(100).get(),
    // No orderBy to avoid composite index; we sort in memory
    firestore.collection(ADMIN_EVENTS_COLLECTION).where('target', '==', uid).limit(100).get(),
    // Team history: written by teamService (join/leave/disband). No orderBy; sort in memory.
    firestore.collection(TEAM_EVENTS_COLLECTION).where('uid', '==', uid).limit(200).get(),
  ]);

  if (!userSnap.exists) return null;
  const d = userSnap.data();

  const recentMatches = [];
  for (const doc of matchesSnap.docs) {
    const data = doc.data();
    const teamA = data.teamA || [];
    const teamB = data.teamB || [];
    if (teamA.includes(uid) || teamB.includes(uid)) {
      recentMatches.push({
        matchId: doc.id,
        status: data.status,
        difficulty: data.difficulty,
        createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? null,
      });
    }
  }

  const adminEventsRaw = eventsSnap.docs.map((doc) => {
    const data = doc.data();
    const ts = data.timestamp?.toMillis?.() ?? data.timestamp ?? 0;
    return {
      action: data.action,
      adminId: data.adminId,
      target: data.target,
      metadata: data.metadata || {},
      timestamp: ts,
    };
  });
  adminEventsRaw.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const recentAdminEvents = adminEventsRaw.slice(0, 50).map((e) => ({ ...e, timestamp: e.timestamp || null }));

  await audit(firestore, adminId, 'user_activity', uid, {});

  const loginHistory = Array.isArray(d.loginHistory) ? d.loginHistory.filter((ts) => typeof ts === 'number') : [];

  // Team history (most recent first)
  const teamEventsRaw = teamEventsSnap.docs.map((doc) => {
    const data = doc.data();
    const ts = data.createdAt?.toMillis?.() ?? data.createdAt ?? 0;
    return {
      id: doc.id,
      action: data.action,
      teamId: data.teamId || null,
      teamName: data.teamName || null,
      teamSnapshot: data.teamSnapshot || null,
      metadata: data.metadata || {},
      createdAt: ts || null,
    };
  });
  teamEventsRaw.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const teamHistory = teamEventsRaw.slice(0, 100);

  // Current team snapshot (if any)
  let currentTeam = null;
  if (d.currentTeamId) {
    try {
      const teamSnap = await firestore.collection('teams').doc(d.currentTeamId).get();
      if (teamSnap.exists) {
        const td = teamSnap.data();
        currentTeam = {
          id: teamSnap.id,
          name: td.name ?? null,
          leaderId: td.leaderId ?? null,
          currentSize: td.currentSize ?? (Array.isArray(td.members) ? td.members.length : 0),
          maxSize: td.maxSize ?? null,
          averageMMR: td.averageMMR ?? null,
          isActive: td.isActive === true,
          members: Array.isArray(td.members)
            ? td.members.map((m) => ({
                uid: m.uid,
                username: m.username ?? '',
                mmr: m.mmr ?? 1000,
                joinedAt: m.joinedAt?.toMillis?.() ?? m.joinedAt ?? null,
              }))
            : [],
        };
      }
    } catch {
      currentTeam = null;
    }
  }

  return {
    uid,
    displayName: d.displayName ?? '',
    email: d.email ?? '',
    lastLogin: d.lastLogin?.toMillis?.() ?? d.lastLogin ?? null,
    lastActive: d.lastActive?.toMillis?.() ?? d.lastLogin ?? null,
    loginHistory,
    recentMatches,
    recentAdminEvents,
    currentTeam,
    teamHistory,
  };
}

/**
 * DELETE /admin/user/:uid: delete user from Firestore and Firebase Auth.
 * Irreversible. Admin must not delete themselves.
 *
 * @param {string} adminId
 * @param {string} uid
 */
export async function deleteUser(adminId, uid) {
  const firestore = getFirestore();
  const auth = getAuth();
  if (!firestore) throw new Error('Firestore not initialized');
  if (adminId === uid) throw new Error('Cannot delete your own account');

  const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new Error('User not found');

  await userRef.delete();
  if (auth) {
    try {
      await auth.deleteUser(uid);
    } catch (e) {
      await audit(firestore, adminId, 'user_delete_auth_failed', uid, { error: String(e.message) });
      throw e;
    }
  }
  await audit(firestore, adminId, 'user_delete', uid, {});
}

/**
 * POST /admin/user/:uid/ban: set user banned.
 *
 * @param {string} adminId
 * @param {string} uid
 */
export async function banUser(adminId, uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(USERS_COLLECTION).doc(uid).update({ banned: true });
  await audit(firestore, adminId, 'user_ban', uid, {});
}

/**
 * POST /admin/user/:uid/unban: clear banned.
 *
 * @param {string} adminId
 * @param {string} uid
 */
export async function unbanUser(adminId, uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(USERS_COLLECTION).doc(uid).update({ banned: false });
  await audit(firestore, adminId, 'user_unban', uid, {});
}

/**
 * POST /admin/user/:uid/shadow-ban: can queue, never matched.
 *
 * @param {string} adminId
 * @param {string} uid
 */
export async function shadowBanUser(adminId, uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(USERS_COLLECTION).doc(uid).update({ shadowBan: true });
  await audit(firestore, adminId, 'user_shadow_ban', uid, {});
}

/**
 * POST /admin/user/:uid/shadow-unban
 *
 * @param {string} adminId
 * @param {string} uid
 */
export async function shadowUnbanUser(adminId, uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(USERS_COLLECTION).doc(uid).update({ shadowBan: false });
  await audit(firestore, adminId, 'user_shadow_unban', uid, {});
}

/**
 * POST /admin/user/:uid/reset-rank: set mmr=1000, rank=Initiate, rp=0.
 *
 * @param {string} adminId
 * @param {string} uid
 */
export async function resetUserRank(adminId, uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(USERS_COLLECTION).doc(uid).update({
    mmr: 1000,
    rank: 'Initiate',
    rp: 0,
    lossesSincePromotion: 0,
  });
  await audit(firestore, adminId, 'user_reset_rank', uid, {});
}

/**
 * POST /admin/system/matchmaking/disable: maintenance mode.
 *
 * @param {string} adminId
 */
export async function disableMatchmaking(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('matchmaking').set(
    { disabled: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit(firestore, adminId, 'system_matchmaking_disable', 'matchmaking', {});
}

/**
 * POST /admin/system/matchmaking/enable
 *
 * @param {string} adminId
 */
export async function enableMatchmaking(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('matchmaking').set(
    { disabled: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit(firestore, adminId, 'system_matchmaking_enable', 'matchmaking', {});
}

/**
 * POST /admin/system/queues/drain: remove all waiting queues.
 *
 * @param {string} adminId
 */
export async function drainQueues(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const snap = await firestore.collection(QUEUES_COLLECTION).where('status', '==', 'waiting').get();
  const batch = firestore.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  await audit(firestore, adminId, 'system_queues_drain', 'queues', { deleted: snap.size });
}

/**
 * POST /admin/system/engine/restart: logical call (audit only; no OS restart).
 *
 * @param {string} adminId
 */
export async function restartEngineWorkers(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  await audit(firestore, adminId, 'system_engine_restart', 'engine', { logical: true });
}

/**
 * POST /admin/system/maintenance/enable: global kill switch.
 * When enabled: new queue joins and match start rejected; admin routes always allowed.
 *
 * @param {string} adminId
 */
export async function enableMaintenance(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const { setMaintenanceEnabled } = await import('./maintenance.js');
  await setMaintenanceEnabled(true);
  await audit(firestore, adminId, 'system_maintenance_enable', 'maintenance', {});
}

/**
 * POST /admin/system/maintenance/disable
 *
 * @param {string} adminId
 */
export async function disableMaintenance(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');

  const { setMaintenanceEnabled } = await import('./maintenance.js');
  await setMaintenanceEnabled(false);
  await audit(firestore, adminId, 'system_maintenance_disable', 'maintenance', {});
}
