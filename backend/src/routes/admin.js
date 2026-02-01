/**
 * Admin (God Mode) routes. All protected by adminGuard. All actions audited in adminService / adminFeaturesService.
 */

import express from 'express';
import { adminGuard } from '../middleware/adminGuard.js';
import {
  getOverview,
  getMatches,
  getMatchDetail,
  stopMatchAdmin,
  markMatchInvalid,
  getPlayers,
  getUserProfile,
  getUserActivity,
  banUser,
  unbanUser,
  deleteUser,
  shadowBanUser,
  shadowUnbanUser,
  resetUserRank,
  disableMatchmaking,
  enableMatchmaking,
  drainQueues,
  restartEngineWorkers,
  enableMaintenance,
  disableMaintenance,
} from '../services/adminService.js';
import {
  getAnnouncement,
  setAnnouncement,
  getAuditLog,
  getLeaderboard,
  getStats,
  bulkBanUsers,
  bulkUnbanUsers,
  exportUsers,
  exportMatches,
  exportAudit,
  getFeatureFlags,
  setFeatureFlags,
  getRankTiers,
  setRankTiers,
  getReports,
  dismissReport,
  actionReport,
  getSeasons,
  createSeason,
  setCurrentSeason,
  getAchievements,
  createAchievement,
  assignAchievement,
  createCustomMatch,
  getDifficultyPresets,
  setDifficultyPresets,
  getMaintenanceConfig,
  setMaintenanceEndTime,
} from '../services/adminFeaturesService.js';
import multer from 'multer';
import { updateLandingMission, uploadLandingMissionImage } from '../services/landingMissionsService.js';
import {
  listServiceCollections,
  createServiceCollection,
  setDefaultCollection,
} from '../services/serviceCollectionService.js';

const uploadLandingImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('image');

const router = express.Router();

router.use(adminGuard);

/** GET /admin/overview */
router.get('/overview', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await getOverview(adminId);
    return res.json(data);
  } catch (err) {
    console.error('Admin overview error:', err);
    return res.status(500).json({ error: 'Failed to get overview' });
  }
});

/** GET /admin/matches */
router.get('/matches', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const matches = await getMatches(adminId);
    return res.json(matches);
  } catch (err) {
    console.error('Admin matches error:', err);
    return res.status(500).json({ error: 'Failed to list matches' });
  }
});

/** GET /admin/match/:id */
router.get('/match/:id', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const match = await getMatchDetail(adminId, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    return res.json(match);
  } catch (err) {
    console.error('Admin match detail error:', err);
    return res.status(500).json({ error: 'Failed to get match' });
  }
});

/** POST /admin/match/:id/stop */
router.post('/match/:id/stop', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await stopMatchAdmin(adminId, req.params.id);
    return res.json({ status: 'stopped' });
  } catch (err) {
    console.error('Admin match stop error:', err);
    return res.status(500).json({ error: 'Failed to stop match' });
  }
});

/** POST /admin/match/:id/invalid */
router.post('/match/:id/invalid', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await markMatchInvalid(adminId, req.params.id);
    return res.json({ status: 'marked_invalid' });
  } catch (err) {
    console.error('Admin match invalid error:', err);
    return res.status(500).json({ error: 'Failed to mark match invalid' });
  }
});

/** GET /admin/players */
router.get('/players', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const players = await getPlayers(adminId);
    return res.json(players);
  } catch (err) {
    console.error('Admin players error:', err);
    return res.status(500).json({ error: 'Failed to list players' });
  }
});

/** GET /admin/user/:uid */
router.get('/user/:uid', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const user = await getUserProfile(adminId, req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('Admin user profile error:', err);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

/** GET /admin/user/:uid/activity — detailed history, last login, last active, matches, admin events */
router.get('/user/:uid/activity', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const activity = await getUserActivity(adminId, req.params.uid);
    if (!activity) return res.status(404).json({ error: 'User not found' });
    return res.json(activity);
  } catch (err) {
    console.error('Admin user activity error:', err);
    return res.status(500).json({ error: 'Failed to get user activity' });
  }
});

/** POST /admin/user/:uid/ban */
router.post('/user/:uid/ban', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await banUser(adminId, req.params.uid);
    return res.json({ status: 'banned' });
  } catch (err) {
    console.error('Admin ban error:', err);
    return res.status(500).json({ error: 'Failed to ban user' });
  }
});

/** POST /admin/user/:uid/unban */
router.post('/user/:uid/unban', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await unbanUser(adminId, req.params.uid);
    return res.json({ status: 'unbanned' });
  } catch (err) {
    console.error('Admin unban error:', err);
    return res.status(500).json({ error: 'Failed to unban user' });
  }
});

/** DELETE /admin/user/:uid — delete user from Firestore and Firebase Auth */
router.delete('/user/:uid', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await deleteUser(adminId, req.params.uid);
    return res.json({ status: 'deleted' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    const status = err.message?.includes('own account') ? 400 : err.message?.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: err.message || 'Failed to delete user' });
  }
});

/** POST /admin/user/:uid/shadow-ban */
router.post('/user/:uid/shadow-ban', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await shadowBanUser(adminId, req.params.uid);
    return res.json({ status: 'shadow_banned' });
  } catch (err) {
    console.error('Admin shadow-ban error:', err);
    return res.status(500).json({ error: 'Failed to shadow-ban user' });
  }
});

/** POST /admin/user/:uid/shadow-unban */
router.post('/user/:uid/shadow-unban', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await shadowUnbanUser(adminId, req.params.uid);
    return res.json({ status: 'shadow_unbanned' });
  } catch (err) {
    console.error('Admin shadow-unban error:', err);
    return res.status(500).json({ error: 'Failed to shadow-unban user' });
  }
});

/** POST /admin/user/:uid/reset-rank */
router.post('/user/:uid/reset-rank', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await resetUserRank(adminId, req.params.uid);
    return res.json({ status: 'rank_reset' });
  } catch (err) {
    console.error('Admin reset-rank error:', err);
    return res.status(500).json({ error: 'Failed to reset rank' });
  }
});

/** POST /admin/system/matchmaking/disable */
router.post('/system/matchmaking/disable', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await disableMatchmaking(adminId);
    return res.json({ status: 'matchmaking_disabled' });
  } catch (err) {
    console.error('Admin disable matchmaking error:', err);
    return res.status(500).json({ error: 'Failed to disable matchmaking' });
  }
});

/** POST /admin/system/matchmaking/enable */
router.post('/system/matchmaking/enable', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await enableMatchmaking(adminId);
    return res.json({ status: 'matchmaking_enabled' });
  } catch (err) {
    console.error('Admin enable matchmaking error:', err);
    return res.status(500).json({ error: 'Failed to enable matchmaking' });
  }
});

/** POST /admin/system/queues/drain */
router.post('/system/queues/drain', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await drainQueues(adminId);
    return res.json({ status: 'queues_drained' });
  } catch (err) {
    console.error('Admin drain queues error:', err);
    return res.status(500).json({ error: 'Failed to drain queues' });
  }
});

/** POST /admin/system/engine/restart */
router.post('/system/engine/restart', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await restartEngineWorkers(adminId);
    return res.json({ status: 'restart_requested', logical: true });
  } catch (err) {
    console.error('Admin engine restart error:', err);
    return res.status(500).json({ error: 'Failed to request restart' });
  }
});

/** POST /admin/system/maintenance/enable — global kill switch */
router.post('/system/maintenance/enable', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await enableMaintenance(adminId);
    return res.json({ status: 'maintenance_enabled' });
  } catch (err) {
    console.error('Admin enable maintenance error:', err);
    return res.status(500).json({ error: 'Failed to enable maintenance' });
  }
});

/** POST /admin/system/maintenance/disable */
router.post('/system/maintenance/disable', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await disableMaintenance(adminId);
    return res.json({ status: 'maintenance_disabled' });
  } catch (err) {
    console.error('Admin disable maintenance error:', err);
    return res.status(500).json({ error: 'Failed to disable maintenance' });
  }
});

// ——— Announcements ———
router.get('/announcement', async (req, res) => {
  try {
    const data = await getAnnouncement();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get announcement' });
  }
});
router.patch('/announcement', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await setAnnouncement(adminId, req.body || {});
    return res.json(await getAnnouncement());
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set announcement' });
  }
});

// ——— Audit log ———
router.get('/audit', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await getAuditLog(adminId, { limit: req.query.limit, action: req.query.action, target: req.query.target });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// ——— Leaderboard snapshot ———
router.get('/leaderboard', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await getLeaderboard(adminId, req.query.limit);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// ——— Stats ———
router.get('/stats', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await getStats(adminId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ——— Bulk actions ———
router.post('/users/bulk-ban', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const { uids } = req.body || {};
    const data = await bulkBanUsers(adminId, uids);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to bulk ban' });
  }
});
router.post('/users/bulk-unban', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const { uids } = req.body || {};
    const data = await bulkUnbanUsers(adminId, uids);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to bulk unban' });
  }
});

// ——— Export ———
router.get('/export/users', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await exportUsers(adminId);
    const format = req.query.format || 'json';
    if (format === 'csv') {
      const first = data[0];
      const header = first ? Object.keys(first).join(',') : '';
      const rows = data.map((r) => Object.values(r).map((v) => (v == null ? '' : String(v))).join(','));
      res.setHeader('Content-Type', 'text/csv');
      return res.send(header ? [header, ...rows].join('\n') : '');
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export users' });
  }
});
router.get('/export/matches', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await exportMatches(adminId, req.query.limit);
    const format = req.query.format || 'json';
    if (format === 'csv') {
      const first = data[0];
      const header = first ? Object.keys(first).join(',') : '';
      const rows = data.map((r) => Object.values(r).map((v) => (v == null ? '' : Array.isArray(v) ? JSON.stringify(v) : String(v))).join(','));
      res.setHeader('Content-Type', 'text/csv');
      return res.send(header ? [header, ...rows].join('\n') : '');
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export matches' });
  }
});
router.get('/export/audit', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await exportAudit(adminId, req.query.limit);
    const format = req.query.format || 'json';
    if (format === 'csv') {
      const first = data[0];
      const header = first ? Object.keys(first).join(',') : '';
      const rows = data.map((r) => Object.values(r).map((v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))).join(','));
      res.setHeader('Content-Type', 'text/csv');
      return res.send(header ? [header, ...rows].join('\n') : '');
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export audit' });
  }
});

// ——— Feature flags ———
router.get('/feature-flags', async (req, res) => {
  try {
    const data = await getFeatureFlags();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get feature flags' });
  }
});
router.patch('/feature-flags', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    await setFeatureFlags(adminId, req.body || {});
    return res.json(await getFeatureFlags());
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set feature flags' });
  }
});

// ——— Rank tiers ———
router.get('/rank-tiers', async (req, res) => {
  try {
    const data = await getRankTiers();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get rank tiers' });
  }
});
router.put('/rank-tiers', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await setRankTiers(adminId, req.body?.tiers || req.body);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set rank tiers' });
  }
});

// ——— Reports ———
router.get('/reports', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await getReports(adminId, req.query.status);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get reports' });
  }
});
router.post('/reports/:id/dismiss', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await dismissReport(adminId, req.params.id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to dismiss report' });
  }
});
router.post('/reports/:id/action', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const { action } = req.body || {};
    const data = await actionReport(adminId, req.params.id, action || 'ban');
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to action report' });
  }
});

// ——— Seasons ———
router.get('/seasons', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await getSeasons(adminId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get seasons' });
  }
});
router.post('/seasons', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await createSeason(adminId, req.body || {});
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create season' });
  }
});
router.patch('/seasons/:id/current', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await setCurrentSeason(adminId, req.params.id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set current season' });
  }
});

// ——— Achievements ———
router.get('/achievements', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await getAchievements(adminId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get achievements' });
  }
});
router.post('/achievements', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await createAchievement(adminId, req.body || {});
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create achievement' });
  }
});
router.post('/user/:uid/achievements', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const { achievementId } = req.body || {};
    await assignAchievement(adminId, req.params.uid, achievementId);
    return res.json({ assigned: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to assign achievement' });
  }
});

// ——— Custom match ———
router.post('/match/create', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await createCustomMatch(adminId, req.body || {});
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create match' });
  }
});

// ——— Difficulty presets ———
router.get('/difficulty-presets', async (req, res) => {
  try {
    const data = await getDifficultyPresets();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get presets' });
  }
});
router.put('/difficulty-presets', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const data = await setDifficultyPresets(adminId, req.body?.presets || req.body);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set presets' });
  }
});

// ——— Maintenance countdown ———
router.get('/maintenance/config', async (req, res) => {
  try {
    const data = await getMaintenanceConfig();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get maintenance config' });
  }
});
router.patch('/maintenance/end-time', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const { endTime } = req.body || {};
    const data = await setMaintenanceEndTime(adminId, endTime);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set end time' });
  }
});

// ——— Service Collections (default sets for match provisioning) ———
router.get('/service-collections', async (req, res) => {
  try {
    const difficulty = req.query.difficulty;
    const filters = difficulty ? { difficulty } : {};
    const collections = await listServiceCollections(filters);
    return res.json(collections);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list service collections' });
  }
});

router.post('/service-collections', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const collection = await createServiceCollection(adminId, req.body || {});
    return res.json(collection);
  } catch (err) {
    if (err.message === 'INVALID_INPUT') return res.status(400).json({ error: 'Invalid input: name, difficulty, and exactly 5 template IDs required' });
    return res.status(500).json({ error: err.message || 'Failed to create collection' });
  }
});

router.patch('/service-collections/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await setDefaultCollection(id);
    return res.json(collection);
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Collection not found' });
    return res.status(500).json({ error: err.message || 'Failed to set default' });
  }
});

// ——— Landing page (Mission Exploit / 2.0 photos + info) ———
router.patch('/landing/missions/:id', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const { id } = req.params;
    const data = await updateLandingMission(id, req.body || {});
    return res.json(data);
  } catch (err) {
    const status = err.message?.includes('Invalid') ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Failed to update landing mission' });
  }
});

/** POST /admin/landing/missions/:id/upload — upload image file; returns { url }. */
router.post('/landing/missions/:id/upload', (req, res, next) => {
  uploadLandingImage(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image too large. Max 5MB.' });
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No image file provided' });
    const { url } = await uploadLandingMissionImage(id, req.file.buffer, req.file.mimetype, req.file.originalname);
    return res.json({ url });
  } catch (err) {
    const status = err.message?.includes('Invalid') ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Upload failed' });
  }
});

// ——— Broadcast (uses io from app; see server.js) ———
router.post('/broadcast', async (req, res) => {
  try {
    const adminId = req.user?.uid;
    const { message } = req.body || {};
    const io = req.app.get('io');
    if (io) {
      io.of('/match').emit('admin_broadcast', { message: String(message ?? '').trim(), from: adminId });
    }
    const { auditEvent } = await import('../services/adminFeaturesService.js');
    const { getFirestore } = await import('../firebase/firebaseAdmin.js');
    const firestore = getFirestore();
    if (firestore) {
      await auditEvent(firestore, adminId, 'broadcast', 'all', { message: String(message ?? '').trim() });
    }
    return res.json({ sent: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to broadcast' });
  }
});

export default router;
