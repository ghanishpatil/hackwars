import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { adminApi } from '../api/client';

const POLL_MS = 10_000;

function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  );
}
function IconLayers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /></svg>
  );
}
function IconActivity({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  );
}
function IconServer({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /><line x1="12" y1="6" x2="12" y2="6.01" /><line x1="12" y1="18" x2="12" y2="18.01" /></svg>
  );
}

const statCards = [
  { key: 'activeUsers', title: 'Total users', glow: 'cyan', Icon: IconUsers },
  { key: 'activeQueues', title: 'Active queues', glow: 'purple', Icon: IconLayers },
  { key: 'activeMatches', title: 'Active matches', glow: 'red', Icon: IconActivity },
  {
    key: 'engine',
    title: 'Match Engine',
    glow: 'green',
    Icon: IconServer,
    format: (d) => (d?.engineHealth?.status === 'ok' ? 'OK' : d?.engineHealth?.status ?? 'Unreachable'),
  },
];

const iconColors = { cyan: 'var(--neon-cyan)', purple: 'var(--neon-purple)', red: 'var(--neon-red)', green: 'var(--neon-green)' };

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const [overview, statsRes, leaderboardRes] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getStats().catch(() => null),
        adminApi.getLeaderboard(10).catch(() => []),
      ]);
      setData(overview);
      setStats(statsRes);
      setLeaderboard(Array.isArray(leaderboardRes) ? leaderboardRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const id = setInterval(fetchOverview, POLL_MS);
    return () => clearInterval(id);
  }, [fetchOverview]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-mono text-[var(--text-muted)]">Loading platform overview…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold text-[var(--neon-red)]">Control Center</h1>
        <NeonCard glow="red" className="p-6">
          <p className="text-[var(--neon-red)]">{error}</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">Check backend and Match Engine.</p>
        </NeonCard>
      </div>
    );
  }

  const engineOk = data?.engineHealth?.status === 'ok';

  return (
    <div className="space-y-8">
      {/* CONTROL CENTER section header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--neon-red)] uppercase tracking-tight">
            Control Center
          </h1>
          <p className="font-mono text-sm text-[var(--text-muted)] mt-1">
            Real-time platform overview
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--card-bg)]">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              engineOk ? 'bg-[var(--neon-green)] shadow-[0_0_10px_var(--neon-green)]' : 'bg-[var(--neon-red)]'
            }`}
          />
          <span className="font-mono text-sm text-[var(--text-primary)]">
            Engine: {engineOk ? 'Connected' : 'Unreachable'}
          </span>
        </div>
      </motion.div>

      {error && (
        <NeonCard glow="red" className="p-3">
          <p className="text-sm text-[var(--neon-red)]">Last refresh error: {error}</p>
        </NeonCard>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-3"
      >
        <Link to="/admin/matches">
          <AnimatedButton variant="red" className="px-5 py-2.5">
            Manage Matches
          </AnimatedButton>
        </Link>
        <Link to="/admin/players">
          <AnimatedButton variant="ghost" className="px-5 py-2.5 border-[var(--border)] text-[var(--text-primary)]">
            Manage Users
          </AnimatedButton>
        </Link>
        <Link to="/admin/system">
          <AnimatedButton variant="ghost" className="px-5 py-2.5 border-[var(--border)] text-[var(--text-primary)]">
            Settings
          </AnimatedButton>
        </Link>
      </motion.div>

      {/* KPI cards with icons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => {
          const value =
            s.key === 'engine'
              ? (s.format ? s.format(data) : data?.engineHealth?.status ?? '—')
              : (data?.[s.key] ?? 0);
          const isOk = s.key === 'engine' && value === 'OK';
          const color = iconColors[s.glow] || iconColors.cyan;
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
            >
              <NeonCard glow={s.glow} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      {s.title}
                    </p>
                    <p
                      className={`font-heading text-2xl font-bold mt-2 ${
                        isOk ? 'text-[var(--neon-green)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                  <span style={{ color }} className="opacity-80">
                    <s.Icon className="w-8 h-8" />
                  </span>
                </div>
              </NeonCard>
            </motion.div>
          );
        })}
      </div>

      {/* Match overview / progress tracker */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <NeonCard glow="cyan" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <span className="text-[var(--neon-cyan)]">●</span> Match overview
            </h2>
            <Link
              to="/admin/matches"
              className="font-mono text-xs text-[var(--neon-cyan)] hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {['Pending', 'Starting', 'Running', 'Ending', 'Ended'].map((label, i) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold border-2 ${
                    i === 0 ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]' : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                  }`}
                >
                  {i + 1}
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
          <p className="font-mono text-xs text-[var(--text-dim)] mt-4">
            Active matches: {data?.activeMatches ?? 0} · Matches today: {stats?.matchesToday ?? '—'} · Engine status above
          </p>
        </NeonCard>
      </motion.div>

      {/* Leaderboard snapshot */}
      {leaderboard.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <NeonCard glow="cyan" className="p-5">
            <h2 className="font-heading text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <span className="text-[var(--neon-cyan)]">●</span> Leaderboard snapshot (top 10)
            </h2>
            <div className="space-y-1.5 font-mono text-sm">
              {leaderboard.slice(0, 10).map((u, i) => (
                <div key={u.uid} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                  <span className="text-[var(--text-muted)] w-6">#{i + 1}</span>
                  <span className="text-[var(--text-primary)] truncate flex-1 mx-2">{u.displayName || u.email || u.uid}</span>
                  <span className="text-[var(--neon-cyan)]">{u.mmr ?? 0}</span>
                  <span className="text-[var(--text-dim)] text-xs ml-2">{u.rank}</span>
                </div>
              ))}
            </div>
          </NeonCard>
        </motion.div>
      )}

    </div>
  );
}
