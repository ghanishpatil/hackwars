/**
 * Admin features: announcements, audit log, leaderboard, stats, bulk actions,
 * export, feature flags, rank tiers, reports, seasons, achievements,
 * custom match, difficulty presets, maintenance countdown.
 */

import admin from 'firebase-admin';
import { getFirestore } from '../firebase/firebaseAdmin.js';
import { getEngineHealth } from './engineClient.js';

const USERS_COLLECTION = 'users';
const MATCHES_COLLECTION = 'matches';
const QUEUES_COLLECTION = 'queues';
const ADMIN_EVENTS_COLLECTION = 'admin_events';
const SYSTEM_CONFIG_COLLECTION = 'system_config';
const REPORTS_COLLECTION = 'reports';
const SEASONS_COLLECTION = 'seasons';
const ACHIEVEMENTS_COLLECTION = 'achievements';
const USER_ACHIEVEMENTS_COLLECTION = 'user_achievements';

export async function auditEvent(firestore, adminId, action, target, metadata = {}) {
  await firestore.collection(ADMIN_EVENTS_COLLECTION).add({
    adminId,
    action,
    target,
    metadata,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function audit(firestore, adminId, action, target, metadata = {}) {
  await auditEvent(firestore, adminId, action, target, metadata);
}

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ——— Announcements ———
export async function getAnnouncement() {
  const firestore = getFirestore();
  if (!firestore) return { text: '', enabled: false };
  const doc = await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('announcement').get();
  const d = doc.exists ? doc.data() : {};
  return { text: d.text ?? '', enabled: d.enabled === true };
}

export async function setAnnouncement(adminId, { text, enabled }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('announcement').set(
    { text: String(text ?? '').trim(), enabled: !!enabled, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit(firestore, adminId, 'announcement_set', 'announcement', {});
}

// ——— Audit log ———
export async function getAuditLog(adminId, { limit = 100, action, target } = {}) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await firestore.collection(ADMIN_EVENTS_COLLECTION).orderBy('timestamp', 'desc').limit(Math.min(Number(limit) || 100, 500)).get();
  let events = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      adminId: d.adminId,
      action: d.action,
      target: d.target,
      metadata: d.metadata || {},
      timestamp: d.timestamp?.toMillis?.() ?? d.timestamp ?? null,
    };
  });
  if (action) events = events.filter((e) => e.action === action);
  if (target) events = events.filter((e) => e.target === target);
  await audit(firestore, adminId, 'audit_log_view', 'audit', { count: events.length });
  return events;
}

// ——— Leaderboard ———
function leaderboardQuery(firestore, limit) {
  return firestore.collection(USERS_COLLECTION).orderBy('mmr', 'desc').limit(Math.min(Number(limit) || 20, 100)).get();
}

function mapLeaderboardDocs(snap) {
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      displayName: d.displayName ?? d.username ?? '',
      email: d.email,
      mmr: d.mmr ?? 1000,
      rank: d.rank ?? 'Initiate',
      rp: d.rp ?? 0,
    };
  });
}

/** Public leaderboard: respects feature flag rankingsVisible. No audit. */
export async function getPublicLeaderboard(limit = 20) {
  const firestore = getFirestore();
  if (!firestore) return [];
  const flags = await getFeatureFlags();
  if (flags.rankingsVisible !== true) return [];
  const snap = await leaderboardQuery(firestore, limit);
  return mapLeaderboardDocs(snap);
}

export async function getLeaderboard(adminId, limit = 20) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await leaderboardQuery(firestore, limit);
  const list = mapLeaderboardDocs(snap);
  await audit(firestore, adminId, 'leaderboard_view', 'leaderboard', {});
  return list;
}

// ——— Stats (extended overview) ———
export async function getStats(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const now = admin.firestore.Timestamp.now();
  const todayStart = admin.firestore.Timestamp.fromDate(startOfToday());
  const [usersSnap, queuesSnap, matchesSnap, matchesTodaySnap, engineHealth] = await Promise.all([
    firestore.collection(USERS_COLLECTION).count().get(),
    firestore.collection(QUEUES_COLLECTION).where('status', '==', 'waiting').get(),
    firestore.collection(MATCHES_COLLECTION).where('status', 'in', ['pending', 'starting', 'running']).limit(500).get(),
    firestore.collection(MATCHES_COLLECTION).where('createdAt', '>=', todayStart).get(),
    getEngineHealth(),
  ]);
  await audit(firestore, adminId, 'stats_view', 'platform', {});
  return {
    totalUsers: usersSnap.data().count ?? 0,
    activeQueues: queuesSnap.size,
    activeMatches: matchesSnap.size,
    matchesToday: matchesTodaySnap.size,
    engineHealth: engineHealth ?? { status: 'unreachable' },
  };
}

// ——— Bulk actions ———
export async function bulkBanUsers(adminId, uids) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const list = Array.isArray(uids) ? uids.slice(0, 50) : [];
  const batch = firestore.batch();
  for (const uid of list) {
    if (uid === adminId) continue;
    batch.update(firestore.collection(USERS_COLLECTION).doc(uid), { banned: true });
  }
  await batch.commit();
  await audit(firestore, adminId, 'bulk_ban', 'users', { count: list.length, uids: list });
  return { banned: list.length };
}

export async function bulkUnbanUsers(adminId, uids) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const list = Array.isArray(uids) ? uids.slice(0, 50) : [];
  const batch = firestore.batch();
  for (const uid of list) {
    batch.update(firestore.collection(USERS_COLLECTION).doc(uid), { banned: false });
  }
  await batch.commit();
  await audit(firestore, adminId, 'bulk_unban', 'users', { count: list.length, uids: list });
  return { unbanned: list.length };
}

// ——— Export ———
export async function exportUsers(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await firestore.collection(USERS_COLLECTION).limit(500).get();
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      email: d.email,
      username: d.username,
      displayName: d.displayName,
      phone: d.phone,
      institute: d.institute,
      track: d.track,
      role: d.role,
      mmr: d.mmr,
      rank: d.rank,
      rp: d.rp,
      banned: d.banned,
      shadowBan: d.shadowBan,
      lastLogin: d.lastLogin?.toMillis?.() ?? null,
      lastActive: d.lastActive?.toMillis?.() ?? null,
    };
  });
  await audit(firestore, adminId, 'export_users', 'users', { count: rows.length });
  return rows;
}

export async function exportMatches(adminId, limit = 200) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await firestore.collection(MATCHES_COLLECTION).orderBy('createdAt', 'desc').limit(limit).get();
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      matchId: doc.id,
      difficulty: d.difficulty,
      status: d.status,
      teamA: d.teamA,
      teamB: d.teamB,
      createdAt: d.createdAt?.toMillis?.() ?? null,
      invalid: d.invalid,
    };
  });
  await audit(firestore, adminId, 'export_matches', 'matches', { count: rows.length });
  return rows;
}

export async function exportAudit(adminId, limit = 500) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await firestore.collection(ADMIN_EVENTS_COLLECTION).orderBy('timestamp', 'desc').limit(limit).get();
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      adminId: d.adminId,
      action: d.action,
      target: d.target,
      metadata: d.metadata,
      timestamp: d.timestamp?.toMillis?.() ?? null,
    };
  });
  await audit(firestore, adminId, 'export_audit', 'audit', { count: rows.length });
  return rows;
}

// ——— Feature flags ———
export async function getFeatureFlags() {
  const firestore = getFirestore();
  if (!firestore) return { queueEnabled: true, rankingsVisible: true };
  const doc = await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('feature_flags').get();
  const d = doc.exists ? doc.data() : {};
  return {
    queueEnabled: d.queueEnabled !== false,
    rankingsVisible: d.rankingsVisible !== false,
    signupEnabled: d.signupEnabled !== false,
  };
}

export async function setFeatureFlags(adminId, flags) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const update = {};
  if (typeof flags.queueEnabled === 'boolean') update.queueEnabled = flags.queueEnabled;
  if (typeof flags.rankingsVisible === 'boolean') update.rankingsVisible = flags.rankingsVisible;
  if (typeof flags.signupEnabled === 'boolean') update.signupEnabled = flags.signupEnabled;
  update.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('feature_flags').set(update, { merge: true });
  await audit(firestore, adminId, 'feature_flags_set', 'feature_flags', update);
  return update;
}

// ——— Rank tiers ———
export async function getRankTiers() {
  const firestore = getFirestore();
  if (!firestore) return [];
  const doc = await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('rank_tiers').get();
  if (!doc.exists) return [];
  const d = doc.data();
  return Array.isArray(d.tiers) ? d.tiers : [];
}

export async function setRankTiers(adminId, tiers) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const list = Array.isArray(tiers) ? tiers.map((t) => ({ name: String(t.name ?? ''), min: Number(t.min) || 0 })) : [];
  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('rank_tiers').set(
    { tiers: list, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit(firestore, adminId, 'rank_tiers_set', 'rank_tiers', { count: list.length });
  return list;
}

// ——— Reports ———
export async function createReport(reporterUid, { targetUid, reason }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = await firestore.collection(REPORTS_COLLECTION).add({
    reporterUid,
    targetUid: String(targetUid ?? ''),
    reason: String(reason ?? '').trim(),
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function getReports(adminId, status = 'pending') {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await firestore.collection(REPORTS_COLLECTION).orderBy('createdAt', 'desc').limit(100).get();
  let list = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      reporterUid: d.reporterUid,
      targetUid: d.targetUid,
      reason: d.reason,
      status: d.status ?? 'pending',
      createdAt: d.createdAt?.toMillis?.() ?? null,
      resolvedAt: d.resolvedAt?.toMillis?.() ?? null,
      resolvedBy: d.resolvedBy,
    };
  });
  if (status) list = list.filter((r) => r.status === status);
  await audit(firestore, adminId, 'reports_view', 'reports', { count: list.length });
  return list;
}

export async function dismissReport(adminId, reportId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  await firestore.collection(REPORTS_COLLECTION).doc(reportId).update({
    status: 'dismissed',
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: adminId,
  });
  await audit(firestore, adminId, 'report_dismissed', reportId, {});
  return { status: 'dismissed' };
}

export async function actionReport(adminId, reportId, action) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = firestore.collection(REPORTS_COLLECTION).doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Report not found');
  const targetUid = snap.data().targetUid;
  await ref.update({
    status: action === 'ban' ? 'actioned_ban' : 'actioned',
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: adminId,
    action,
  });
  if (action === 'ban' && targetUid) {
    await firestore.collection(USERS_COLLECTION).doc(targetUid).update({ banned: true });
  }
  await audit(firestore, adminId, 'report_actioned', reportId, { action, targetUid });
  return { status: 'actioned', action };
}

// ——— Seasons ———
export async function getSeasons(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await firestore.collection(SEASONS_COLLECTION).orderBy('startAt', 'desc').limit(20).get();
  const list = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      startAt: d.startAt?.toMillis?.() ?? null,
      endAt: d.endAt?.toMillis?.() ?? null,
      isCurrent: d.isCurrent === true,
    };
  });
  await audit(firestore, adminId, 'seasons_view', 'seasons', {});
  return list;
}

export async function createSeason(adminId, { name, startAt, endAt }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = await firestore.collection(SEASONS_COLLECTION).add({
    name: String(name ?? 'Season'),
    startAt: startAt ? admin.firestore.Timestamp.fromDate(new Date(startAt)) : admin.firestore.FieldValue.serverTimestamp(),
    endAt: endAt ? admin.firestore.Timestamp.fromDate(new Date(endAt)) : null,
    isCurrent: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await audit(firestore, adminId, 'season_create', ref.id, { name });
  return { id: ref.id };
}

export async function setCurrentSeason(adminId, seasonId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const batch = firestore.batch();
  const snap = await firestore.collection(SEASONS_COLLECTION).get();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, { isCurrent: doc.id === seasonId });
  });
  await batch.commit();
  await audit(firestore, adminId, 'season_set_current', seasonId, {});
  return { currentSeasonId: seasonId };
}

// ——— Achievements ———
export async function getAchievements(adminId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const snap = await firestore.collection(ACHIEVEMENTS_COLLECTION).orderBy('name').get();
  const list = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      description: d.description ?? '',
      criteria: d.criteria ?? '',
      icon: d.icon ?? '',
    };
  });
  await audit(firestore, adminId, 'achievements_view', 'achievements', {});
  return list;
}

export async function createAchievement(adminId, { name, description, criteria, icon }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = await firestore.collection(ACHIEVEMENTS_COLLECTION).add({
    name: String(name ?? ''),
    description: String(description ?? ''),
    criteria: String(criteria ?? ''),
    icon: String(icon ?? ''),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await audit(firestore, adminId, 'achievement_create', ref.id, { name });
  return { id: ref.id };
}

export async function assignAchievement(adminId, uid, achievementId) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  await firestore.collection(USER_ACHIEVEMENTS_COLLECTION).add({
    uid,
    achievementId,
    assignedBy: adminId,
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await audit(firestore, adminId, 'achievement_assign', uid, { achievementId });
  return { assigned: true };
}

// ——— Custom match ———
export async function createCustomMatch(adminId, { teamA, teamB, difficulty = 'medium' }) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const teamSize = Math.min(Array.isArray(teamA) ? teamA.length : 0, Array.isArray(teamB) ? teamB.length : 0);
  if (teamSize === 0) throw new Error('Both teams must have at least one player');
  const matchRef = firestore.collection(MATCHES_COLLECTION).doc();
  const teamAIds = (teamA || []).slice(0, teamSize);
  const teamBIds = (teamB || []).slice(0, teamSize);
  await matchRef.set({
    difficulty: String(difficulty),
    teamSize,
    teamA: teamAIds,
    teamB: teamBIds,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: adminId,
    custom: true,
  });
  await audit(firestore, adminId, 'custom_match_create', matchRef.id, { teamA: teamAIds.length, teamB: teamBIds.length });
  return { matchId: matchRef.id };
}

// ——— Difficulty presets ———
export async function getDifficultyPresets() {
  const firestore = getFirestore();
  if (!firestore) return [];
  const doc = await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('difficulty_presets').get();
  if (!doc.exists) return [];
  const d = doc.data();
  return Array.isArray(d.presets) ? d.presets : [];
}

export async function setDifficultyPresets(adminId, presets) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const list = Array.isArray(presets)
    ? presets.map((p) => ({
        id: p.id || undefined,
        name: String(p.name ?? ''),
        difficulty: String(p.difficulty ?? 'medium'),
        teamSize: Number(p.teamSize) || 2,
      }))
    : [];
  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('difficulty_presets').set(
    { presets: list, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit(firestore, adminId, 'difficulty_presets_set', 'presets', { count: list.length });
  return list;
}

// ——— Maintenance countdown ———
export async function getMaintenanceConfig() {
  const firestore = getFirestore();
  if (!firestore) return { enabled: false, endTime: null };
  const doc = await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('maintenance').get();
  const d = doc.exists ? doc.data() : {};
  return {
    enabled: d.enabled === true,
    endTime: d.endTime?.toMillis?.() ?? d.endTime ?? null,
  };
}

export async function setMaintenanceEndTime(adminId, endTime) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore not initialized');
  const ts = endTime ? admin.firestore.Timestamp.fromDate(new Date(endTime)) : null;
  await firestore.collection(SYSTEM_CONFIG_COLLECTION).doc('maintenance').set(
    { endTime: ts, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit(firestore, adminId, 'maintenance_end_time_set', 'maintenance', {});
  return { endTime: ts?.toMillis?.() ?? null };
}
