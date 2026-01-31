import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { api } from '../api/client';

const rankColors = {
  'Script Kiddie': 'var(--text-muted)',
  'Initiate': 'var(--neon-green)',
  'Packet Sniffer': 'var(--neon-cyan)',
  'Exploit Crafter': 'var(--neon-purple)',
  'Red Operator': 'var(--neon-red)',
  'Blue Sentinel': 'var(--neon-cyan)',
  'APT Unit': 'var(--neon-purple)',
  'Zero-Day': 'var(--neon-amber)',
};

export default function Rankings() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rankingsVisible, setRankingsVisible] = useState(true);

  const fetchRankings = () => {
    api.getFeatureFlags().then((flags) => setRankingsVisible(flags.rankingsVisible === true)).catch(() => {});
    api.getLeaderboard(50).then((data) => { setList(Array.isArray(data) ? data : []); setError(''); }).catch((err) => { setList([]); setError(err.message || 'Failed to load rankings'); });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [flags, data] = await Promise.all([api.getFeatureFlags(), api.getLeaderboard(50)]);
        if (!cancelled) {
          setRankingsVisible(flags.rankingsVisible === true);
          setList(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setList([]);
          setError(err.message || 'Failed to load rankings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const interval = setInterval(fetchRankings, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Rankings</h1>
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!rankingsVisible) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Rankings</h1>
        <NeonCard glow="cyan" className="p-6">
          <p className="font-mono text-[var(--text-muted)]">Rankings are currently hidden by the organisers.</p>
        </NeonCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Rankings</h1>
        <NeonCard glow="red" className="p-6">
          <p className="text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--text-primary)]"
      >
        Rankings
      </motion.h1>

      <NeonCard glow="cyan" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                <th className="px-6 py-4 font-heading text-sm font-semibold text-[var(--text-muted)]">#</th>
                <th className="px-6 py-4 font-heading text-sm font-semibold text-[var(--text-muted)]">Player</th>
                <th className="px-6 py-4 font-heading text-sm font-semibold text-[var(--text-muted)]">Rank</th>
                <th className="px-6 py-4 font-heading text-sm font-semibold text-[var(--text-muted)]">MMR</th>
                <th className="px-6 py-4 font-heading text-sm font-semibold text-[var(--text-muted)] w-48">Progress</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 font-mono text-sm text-[var(--text-muted)] text-center">
                    No players yet.
                  </td>
                </tr>
              ) : (
                list.map((p, i) => {
                  const nextTier = 2500;
                  const progress = Math.min(100, ((p.mmr ?? 0) / nextTier) * 100);
                  const color = rankColors[p.rank] || 'var(--neon-cyan)';
                  return (
                    <motion.tr
                      key={p.uid}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)]/50"
                    >
                      <td className="px-6 py-4 font-mono text-sm text-[var(--text-primary)]">{i + 1}</td>
                      <td className="px-6 py-4 font-mono text-sm text-[var(--neon-cyan)]">{p.displayName || p.email || p.uid}</td>
                      <td className="px-6 py-4">
                        <span className="font-heading text-sm font-semibold" style={{ color }}>{p.rank}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-[var(--text-primary)]">{p.mmr}</td>
                      <td className="px-6 py-4">
                        <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ width: `${progress}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}60` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, delay: 0.1 + i * 0.03 }}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </NeonCard>
    </div>
  );
}
