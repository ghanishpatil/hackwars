import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { adminApi } from '../api/client';

const POLL_MS = 10_000;

function StatusRow({ label, status, ok, lastChecked }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
      <span className="font-mono text-sm text-[var(--text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            ok ? 'bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)]' : 'bg-[var(--neon-red)]'
          }`}
        />
        <span className={`font-mono text-sm font-medium ${ok ? 'text-[var(--neon-green)]' : 'text-[var(--neon-red)]'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

export default function AdminSystem() {
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [health, setHealth] = useState({
    backend: null,
    engine: null,
    lastChecked: null,
    loading: true,
    error: null,
  });
  const [announcement, setAnnouncement] = useState({ text: '', enabled: false });
  const [featureFlags, setFeatureFlags] = useState({ queueEnabled: true, rankingsVisible: true, signupEnabled: true });
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [maintenanceConfig, setMaintenanceConfig] = useState({ enabled: false, endTime: null });
  const [rankTiers, setRankTiers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [difficultyPresets, setDifficultyPresets] = useState([]);
  const [customMatchTeamA, setCustomMatchTeamA] = useState('');
  const [customMatchTeamB, setCustomMatchTeamB] = useState('');
  const [customMatchDifficulty, setCustomMatchDifficulty] = useState('medium');
  const [sysError, setSysError] = useState(null);
  const [sysLoading, setSysLoading] = useState(null);

  const fetchHealth = useCallback(async () => {
    setHealth((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const overview = await adminApi.getOverview();
      const engineOk = overview?.engineHealth?.status === 'ok';
      setHealth({
        backend: 'Connected',
        engine: engineOk ? 'Connected' : 'Unreachable',
        engineOk,
        lastChecked: new Date().toISOString(),
        loading: false,
        error: null,
      });
    } catch (err) {
      setHealth({
        backend: 'Disconnected',
        engine: 'Unknown',
        engineOk: false,
        lastChecked: new Date().toISOString(),
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch',
      });
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, POLL_MS);
    return () => clearInterval(id);
  }, [fetchHealth]);

  useEffect(() => {
    adminApi.getAnnouncement().then(setAnnouncement).catch(() => {});
    adminApi.getFeatureFlags().then(setFeatureFlags).catch(() => {});
    adminApi.getMaintenanceConfig().then(setMaintenanceConfig).catch(() => {});
    adminApi.getRankTiers().then(setRankTiers).catch(() => []);
    adminApi.getSeasons().then(setSeasons).catch(() => []);
    adminApi.getAchievements().then(setAchievements).catch(() => []);
    adminApi.getDifficultyPresets().then(setDifficultyPresets).catch(() => []);
  }, []);

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--neon-red)]"
      >
        System controls
      </motion.h1>

      {/* System health */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <NeonCard glow="cyan" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
              System health
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[var(--text-dim)]">
                Last checked: {formatTime(health.lastChecked)}
              </span>
              <AnimatedButton variant="ghost" className="border-[var(--neon-cyan)] text-[var(--neon-cyan)] px-3 py-1.5 text-sm" onClick={fetchHealth} disabled={health.loading}>
                {health.loading ? 'Checking…' : 'Refresh'}
              </AnimatedButton>
            </div>
          </div>
          {health.error && (
            <p className="text-sm text-[var(--neon-red)] mb-3">{health.error}</p>
          )}
          <div className="space-y-0">
            <StatusRow
              label="Backend connection"
              status={health.loading ? 'Checking…' : (health.backend ?? '—')}
              ok={health.backend === 'Connected'}
            />
            <StatusRow
              label="Match engine connection"
              status={health.loading ? 'Checking…' : (health.engine ?? '—')}
              ok={health.engineOk === true}
            />
          </div>
          <p className="font-mono text-xs text-[var(--text-dim)] mt-4">
            Auto-refresh every {POLL_MS / 1000}s. Backend = API server. Match engine = data plane (Docker, scoring).
          </p>
        </NeonCard>
      </motion.div>

      <p className="text-sm text-[var(--text-muted)]">
        Maintenance and recovery. Use controls below to disable matchmaking, drain queues, or enable maintenance mode.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <NeonCard glow="red" className="p-5 space-y-4">
          <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">
            Global kill switch (maintenance)
          </h2>
          <div className="flex flex-wrap gap-3">
            <AnimatedButton variant="red" onClick={() => setMaintenanceModalOpen(true)}>
              Enable maintenance
            </AnimatedButton>
            <AnimatedButton
              variant="green"
              onClick={() => adminApi.disableMaintenance().then(() => adminApi.getMaintenanceConfig().then(setMaintenanceConfig))}
            >
              Disable maintenance
            </AnimatedButton>
          </div>
          <ConfirmationModal
            open={maintenanceModalOpen}
            onClose={() => setMaintenanceModalOpen(false)}
            onConfirm={() => adminApi.enableMaintenance().then(() => { setMaintenanceModalOpen(false); adminApi.getMaintenanceConfig().then(setMaintenanceConfig); })}
            title="Enable maintenance?"
            message="New queue joins and match starts will be rejected. Admin routes remain allowed."
            confirmLabel="Enable"
            danger
          />
          <p className="text-xs text-[var(--text-dim)]">
            When enabled: new queue joins and match start rejected.
          </p>
        </NeonCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <NeonCard glow="red" className="p-5 space-y-4">
          <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">
            Matchmaking
          </h2>
          <div className="flex flex-wrap gap-3">
            <AnimatedButton variant="ghost" className="border-[var(--neon-amber)] text-[var(--neon-amber)]" onClick={() => adminApi.disableMatchmaking()}>
              Disable matchmaking
            </AnimatedButton>
            <AnimatedButton variant="green" onClick={() => adminApi.enableMatchmaking()}>Enable matchmaking</AnimatedButton>
          </div>
        </NeonCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <NeonCard glow="red" className="p-5 space-y-4">
          <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">
            Queues
          </h2>
          <div className="flex flex-wrap gap-3">
            <AnimatedButton variant="red" onClick={() => adminApi.drainQueues()}>Drain all queues</AnimatedButton>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Removes all waiting queue entries.
          </p>
        </NeonCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <NeonCard glow="red" className="p-5 space-y-4">
          <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">
            Match engine
          </h2>
          <div className="flex flex-wrap gap-3">
            <AnimatedButton variant="ghost" className="border-[var(--border)] text-[var(--text-primary)]" onClick={() => adminApi.restartEngine().then(fetchHealth)}>
              Restart engine workers
            </AnimatedButton>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Logical restart only. No OS-level restart.
          </p>
        </NeonCard>
      </motion.div>

      {/* Announcement */}
      <NeonCard glow="cyan" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Global announcement</h2>
        <input
          type="text"
          value={announcement.text}
          onChange={(e) => setAnnouncement((a) => ({ ...a, text: e.target.value }))}
          placeholder="Banner text (shown to all players)"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 font-mono text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={announcement.enabled} onChange={(e) => setAnnouncement((a) => ({ ...a, enabled: e.target.checked }))} className="rounded" />
            Enabled
          </label>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
            onClick={() => adminApi.setAnnouncement(announcement).then(setAnnouncement)}
          >
            Save
          </button>
        </div>
      </NeonCard>

      {/* Feature flags */}
      <NeonCard glow="purple" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Feature flags</h2>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 font-mono text-sm">
            <input type="checkbox" checked={featureFlags.queueEnabled} onChange={(e) => setFeatureFlags((f) => ({ ...f, queueEnabled: e.target.checked }))} className="rounded" />
            Queue enabled
          </label>
          <label className="flex items-center gap-2 font-mono text-sm">
            <input type="checkbox" checked={featureFlags.rankingsVisible} onChange={(e) => setFeatureFlags((f) => ({ ...f, rankingsVisible: e.target.checked }))} className="rounded" />
            Rankings visible
          </label>
          <label className="flex items-center gap-2 font-mono text-sm">
            <input type="checkbox" checked={featureFlags.signupEnabled} onChange={(e) => setFeatureFlags((f) => ({ ...f, signupEnabled: e.target.checked }))} className="rounded" />
            Signup enabled
          </label>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-purple)] text-[var(--neon-purple)] text-sm font-mono hover:bg-[var(--neon-purple)]/10"
            onClick={() => adminApi.setFeatureFlags(featureFlags).then(setFeatureFlags)}
          >
            Save
          </button>
        </div>
      </NeonCard>

      {/* Export */}
      <NeonCard glow="cyan" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Export data</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
            onClick={async () => {
              const data = await adminApi.exportUsers('json');
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `users-export-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Users JSON
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
            onClick={async () => {
              const text = await adminApi.exportUsersCsv();
              const blob = new Blob([text], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Users CSV
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
            onClick={async () => {
              const data = await adminApi.exportMatches('json');
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `matches-export-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Matches JSON
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
            onClick={async () => {
              const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/admin/export/matches?format=csv`, { headers: { Authorization: `Bearer ${localStorage.getItem('firebaseIdToken') || ''}` } });
              const blob = await res.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `matches-export-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Matches CSV
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
            onClick={async () => {
              const data = await adminApi.exportAudit('json');
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Audit JSON
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
            onClick={async () => {
              const text = await adminApi.exportAuditCsv();
              const blob = new Blob([text], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Audit CSV
          </button>
        </div>
      </NeonCard>

      {/* Broadcast */}
      <NeonCard glow="red" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Broadcast message</h2>
        <input
          type="text"
          value={broadcastMessage}
          onChange={(e) => setBroadcastMessage(e.target.value)}
          placeholder="Message to all connected users"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        />
        <button
          type="button"
          className="px-3 py-1.5 rounded border border-[var(--neon-red)] text-[var(--neon-red)] text-sm font-mono hover:bg-[var(--neon-red)]/10"
          onClick={() => adminApi.broadcast(broadcastMessage).then(() => setBroadcastMessage(''))}
        >
          Send broadcast
        </button>
      </NeonCard>

      {/* Maintenance countdown */}
      <NeonCard glow="amber" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Maintenance end time</h2>
        <input
          type="datetime-local"
          value={maintenanceConfig.endTime ? new Date(maintenanceConfig.endTime).toISOString().slice(0, 16) : ''}
          onChange={(e) => {
            const v = e.target.value;
            adminApi.setMaintenanceEndTime(v ? new Date(v).toISOString() : null).then(() => adminApi.getMaintenanceConfig().then(setMaintenanceConfig));
          }}
          className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        />
      </NeonCard>

      {/* Rank tiers */}
      <NeonCard glow="green" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Rank tiers</h2>
        <p className="font-mono text-xs text-[var(--text-dim)]">Edit name and min MMR, then Save.</p>
        <ul className="font-mono text-sm space-y-2">
          {rankTiers.map((t, i) => (
            <li key={i} className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={t.name ?? ''}
                onChange={(e) => setRankTiers((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="w-32 rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[var(--text-primary)]"
                placeholder="Name"
              />
              <input
                type="number"
                value={t.min ?? 0}
                onChange={(e) => setRankTiers((prev) => prev.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) || 0 } : x)))}
                className="w-20 rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[var(--text-primary)]"
                placeholder="Min MMR"
              />
              <button
                type="button"
                className="text-[var(--neon-red)] text-xs hover:underline"
                onClick={() => setRankTiers((prev) => prev.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-green)] text-[var(--neon-green)] text-sm font-mono"
            onClick={() => setRankTiers((prev) => [...prev, { name: 'New', min: 0 }])}
          >
            Add tier
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono"
            onClick={() => adminApi.setRankTiers(rankTiers).then(setRankTiers)}
          >
            Save tiers
          </button>
        </div>
      </NeonCard>

      {/* Seasons */}
      <NeonCard glow="cyan" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Seasons</h2>
        <ul className="font-mono text-sm space-y-2">
          {seasons.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span>{s.name} {s.isCurrent ? '(current)' : ''}</span>
              {!s.isCurrent && (
                <button
                  type="button"
                  className="text-[var(--neon-cyan)] text-xs hover:underline"
                  onClick={() => adminApi.setCurrentSeason(s.id).then(() => adminApi.getSeasons().then(setSeasons))}
                >
                  Set as current
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono"
          onClick={() => adminApi.createSeason({ name: `Season ${new Date().toFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` }).then(() => adminApi.getSeasons().then(setSeasons))}
        >
          Create season
        </button>
      </NeonCard>

      {/* Achievements */}
      <NeonCard glow="purple" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Achievements</h2>
        <ul className="font-mono text-sm space-y-1">
          {achievements.map((a) => (
            <li key={a.id}>{a.name}: {a.description}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 items-end">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-purple)] text-[var(--neon-purple)] text-sm font-mono"
            onClick={() => adminApi.createAchievement({ name: 'New Achievement', description: '', criteria: '' }).then(() => adminApi.getAchievements().then(setAchievements))}
          >
            Create achievement
          </button>
          <span className="font-mono text-xs text-[var(--text-muted)]">Assign to user:</span>
          <input
            type="text"
            id="assign-achievement-uid"
            placeholder="User UID"
            className="w-48 rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-sm text-[var(--text-primary)]"
          />
          <select
            id="assign-achievement-id"
            className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-sm text-[var(--text-primary)]"
          >
            <option value="">Select achievement</option>
            {achievements.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-purple)] text-[var(--neon-purple)] text-sm font-mono"
            onClick={() => {
              const uid = document.getElementById('assign-achievement-uid')?.value?.trim();
              const achievementId = document.getElementById('assign-achievement-id')?.value;
              if (uid && achievementId) adminApi.assignAchievement(uid, achievementId).then(() => { document.getElementById('assign-achievement-uid').value = ''; document.getElementById('assign-achievement-id').value = ''; });
            }}
          >
            Assign
          </button>
        </div>
      </NeonCard>

      {/* Difficulty presets */}
      <NeonCard glow="amber" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Difficulty presets</h2>
        <p className="font-mono text-xs text-[var(--text-dim)]">Presets for queue/match configuration. Edit and Save.</p>
        <ul className="font-mono text-sm space-y-2">
          {difficultyPresets.map((p, i) => (
            <li key={p.id || i} className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={p.name ?? ''}
                onChange={(e) => setDifficultyPresets((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="w-28 rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[var(--text-primary)]"
                placeholder="Name"
              />
              <select
                value={p.difficulty ?? 'medium'}
                onChange={(e) => setDifficultyPresets((prev) => prev.map((x, j) => (j === i ? { ...x, difficulty: e.target.value } : x)))}
                className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[var(--text-primary)]"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <input
                type="number"
                min={1}
                value={p.teamSize ?? 2}
                onChange={(e) => setDifficultyPresets((prev) => prev.map((x, j) => (j === i ? { ...x, teamSize: Number(e.target.value) || 2 } : x)))}
                className="w-16 rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-[var(--text-primary)]"
                placeholder="Size"
              />
              <button
                type="button"
                className="text-[var(--neon-red)] text-xs hover:underline"
                onClick={() => setDifficultyPresets((prev) => prev.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-amber)] text-[var(--neon-amber)] text-sm font-mono"
            onClick={() => setDifficultyPresets((prev) => [...prev, { name: 'New', difficulty: 'medium', teamSize: 2 }])}
          >
            Add preset
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono"
            onClick={() => adminApi.setDifficultyPresets(difficultyPresets).then(setDifficultyPresets)}
          >
            Save presets
          </button>
        </div>
      </NeonCard>

      {/* Custom match */}
      <NeonCard glow="red" className="p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-[var(--text-muted)]">Custom match</h2>
        <p className="text-xs text-[var(--text-dim)]">Comma-separated UIDs for team A and team B.</p>
        <input
          type="text"
          value={customMatchTeamA}
          onChange={(e) => setCustomMatchTeamA(e.target.value)}
          placeholder="Team A UIDs (comma-separated)"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        />
        <input
          type="text"
          value={customMatchTeamB}
          onChange={(e) => setCustomMatchTeamB(e.target.value)}
          placeholder="Team B UIDs (comma-separated)"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        />
        <select
          value={customMatchDifficulty}
          onChange={(e) => setCustomMatchDifficulty(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button
          type="button"
          className="px-3 py-1.5 rounded border border-[var(--neon-red)] text-[var(--neon-red)] text-sm font-mono"
          onClick={() => {
            const teamA = customMatchTeamA.split(',').map((s) => s.trim()).filter(Boolean);
            const teamB = customMatchTeamB.split(',').map((s) => s.trim()).filter(Boolean);
            adminApi.createCustomMatch({ teamA, teamB, difficulty: customMatchDifficulty }).then(() => { setCustomMatchTeamA(''); setCustomMatchTeamB(''); });
          }}
        >
          Create custom match
        </button>
      </NeonCard>
    </div>
  );
}
