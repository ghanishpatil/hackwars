/**
 * Single API client for backend. Player and admin routes use same BASE and token.
 * Token is set after login; admin routes require Firebase custom claim admin: true.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let token = null;

export function setApiToken(t) {
  token = t;
}

export function clearApiToken() {
  token = null;
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function requestPublic(path) {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/** For CSV/text exports: same auth as request(), returns response text. */
export async function requestText(path, options = {}) {
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.text();
}

export const api = {
  getMe: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  getQueueStatus: () => request('/queue/status'),
  joinQueue: (body) => request('/queue/join', { method: 'POST', body: JSON.stringify(body) }), // body: { difficulty, teamSize, mode?: 'solo'|'team' }
  leaveQueue: () => request('/queue/leave', { method: 'POST' }),
  startMatch: (matchId) => request('/match/start', { method: 'POST', body: JSON.stringify({ matchId }) }),
  endMatch: (matchId) => request('/match/end', { method: 'POST', body: JSON.stringify({ matchId }) }),
  getAnnouncement: () => requestPublic('/api/announcement'),
  getFeatureFlags: () => requestPublic('/api/feature-flags'),
  getLeaderboard: (limit) => requestPublic(`/api/leaderboard?limit=${limit ?? 50}`),
  getMatchHistory: () => request('/match/history'),
  report: (body) => request('/report', { method: 'POST', body: JSON.stringify(body) }),
  teams: {
    create: (body) => request('/teams/create', { method: 'POST', body: JSON.stringify(body) }),
    join: (body) => request('/teams/join', { method: 'POST', body: JSON.stringify(body) }),
    leave: () => request('/teams/leave', { method: 'POST' }),
    disband: (teamId) => request(`/teams/${teamId}/disband`, { method: 'DELETE' }),
    get: (teamId) => request(`/teams/${teamId}`),
  },
  presence: {
    heartbeat: (currentPage) => request('/presence/heartbeat', { method: 'POST', body: JSON.stringify({ currentPage }) }),
    online: (params) => request(`/presence/online?${new URLSearchParams(params || {}).toString()}`),
  },
  challenges: {
    send: (body) => request('/challenges/send', { method: 'POST', body: JSON.stringify(body) }),
    respond: (challengeId, action) => request(`/challenges/${challengeId}/respond`, { method: 'POST', body: JSON.stringify({ action }) }),
    received: () => request('/challenges/received'),
    sent: () => request('/challenges/sent'),
  },
};

export const adminApi = {
  getOverview: () => request('/admin/overview'),
  getMatches: () => request('/admin/matches'),
  getMatch: (id) => request(`/admin/match/${id}`),
  stopMatch: (id) => request(`/admin/match/${id}/stop`, { method: 'POST' }),
  markMatchInvalid: (id) => request(`/admin/match/${id}/invalid`, { method: 'POST' }),
  getPlayers: () => request('/admin/players'),
  getUser: (uid) => request(`/admin/user/${uid}`),
  getUserActivity: (uid) => request(`/admin/user/${uid}/activity`),
  banUser: (uid) => request(`/admin/user/${uid}/ban`, { method: 'POST' }),
  unbanUser: (uid) => request(`/admin/user/${uid}/unban`, { method: 'POST' }),
  deleteUser: (uid) => request(`/admin/user/${uid}`, { method: 'DELETE' }),
  shadowBanUser: (uid) => request(`/admin/user/${uid}/shadow-ban`, { method: 'POST' }),
  shadowUnbanUser: (uid) => request(`/admin/user/${uid}/shadow-unban`, { method: 'POST' }),
  resetUserRank: (uid) => request(`/admin/user/${uid}/reset-rank`, { method: 'POST' }),
  disableMatchmaking: () => request('/admin/system/matchmaking/disable', { method: 'POST' }),
  enableMatchmaking: () => request('/admin/system/matchmaking/enable', { method: 'POST' }),
  drainQueues: () => request('/admin/system/queues/drain', { method: 'POST' }),
  restartEngine: () => request('/admin/system/engine/restart', { method: 'POST' }),
  enableMaintenance: () => request('/admin/system/maintenance/enable', { method: 'POST' }),
  disableMaintenance: () => request('/admin/system/maintenance/disable', { method: 'POST' }),
  getAnnouncement: () => request('/admin/announcement'),
  setAnnouncement: (body) => request('/admin/announcement', { method: 'PATCH', body: JSON.stringify(body) }),
  getAuditLog: (params) => request(`/admin/audit?${new URLSearchParams(params || {}).toString()}`),
  getLeaderboard: (limit) => request(`/admin/leaderboard?limit=${limit || 20}`),
  getStats: () => request('/admin/stats'),
  bulkBanUsers: (uids) => request('/admin/users/bulk-ban', { method: 'POST', body: JSON.stringify({ uids }) }),
  bulkUnbanUsers: (uids) => request('/admin/users/bulk-unban', { method: 'POST', body: JSON.stringify({ uids }) }),
  exportUsers: (format) => request(`/admin/export/users?format=${format || 'json'}`),
  exportMatches: (format, limit) => request(`/admin/export/matches?format=${format || 'json'}&limit=${limit || 200}`),
  exportAudit: (format, limit) => request(`/admin/export/audit?format=${format || 'json'}&limit=${limit || 500}`),
  exportUsersCsv: () => requestText(`/admin/export/users?format=csv`),
  exportMatchesCsv: (limit) => requestText(`/admin/export/matches?format=csv&limit=${limit || 200}`),
  exportAuditCsv: (limit) => requestText(`/admin/export/audit?format=csv&limit=${limit || 500}`),
  getFeatureFlags: () => request('/admin/feature-flags'),
  setFeatureFlags: (body) => request('/admin/feature-flags', { method: 'PATCH', body: JSON.stringify(body) }),
  getRankTiers: () => request('/admin/rank-tiers'),
  setRankTiers: (tiers) => request('/admin/rank-tiers', { method: 'PUT', body: JSON.stringify(Array.isArray(tiers) ? { tiers } : { tiers }) }),
  getReports: (status) => request(`/admin/reports?status=${status || 'pending'}`),
  dismissReport: (id) => request(`/admin/reports/${id}/dismiss`, { method: 'POST' }),
  actionReport: (id, action) => request(`/admin/reports/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) }),
  getSeasons: () => request('/admin/seasons'),
  createSeason: (body) => request('/admin/seasons', { method: 'POST', body: JSON.stringify(body) }),
  setCurrentSeason: (id) => request(`/admin/seasons/${id}/current`, { method: 'PATCH' }),
  getAchievements: () => request('/admin/achievements'),
  createAchievement: (body) => request('/admin/achievements', { method: 'POST', body: JSON.stringify(body) }),
  assignAchievement: (uid, achievementId) => request(`/admin/user/${uid}/achievements`, { method: 'POST', body: JSON.stringify({ achievementId }) }),
  createCustomMatch: (body) => request('/admin/match/create', { method: 'POST', body: JSON.stringify(body) }),
  getDifficultyPresets: () => request('/admin/difficulty-presets'),
  setDifficultyPresets: (presets) => request('/admin/difficulty-presets', { method: 'PUT', body: JSON.stringify(Array.isArray(presets) ? presets : { presets }) }),
  getMaintenanceConfig: () => request('/admin/maintenance/config'),
  setMaintenanceEndTime: (endTime) => request('/admin/maintenance/end-time', { method: 'PATCH', body: JSON.stringify({ endTime }) }),
  broadcast: (message) => request('/admin/broadcast', { method: 'POST', body: JSON.stringify({ message }) }),
};
