import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { adminApi } from '../api/client';

export default function AdminMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMatches = () => {
    setLoading(true);
    setError('');
    adminApi
      .getMatches()
      .then((data) => setMatches(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load matches'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  if (loading && matches.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-2xl font-bold text-[var(--neon-red)]">Matches</h1>
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <h1 className="font-heading text-2xl font-bold text-[var(--neon-red)]">Matches</h1>
        <button
          type="button"
          className="px-3 py-1.5 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-mono hover:bg-[var(--neon-cyan)]/10"
          onClick={fetchMatches}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </motion.div>

      {error && (
        <NeonCard glow="red" className="p-4">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <NeonCard glow="red" className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Match ID</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Difficulty</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Team A</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Team B</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 font-mono text-sm text-[var(--text-muted)] text-center">
                      No matches yet.
                    </td>
                  </tr>
                ) : (
                  matches.map((m, i) => (
                    <motion.tr
                      key={m.matchId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.03 * i }}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)]/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">{m.matchId}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{m.difficulty}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-medium ${
                            m.status === 'running' ? 'text-[var(--neon-green)]' : m.status === 'pending' || m.status === 'starting' ? 'text-[var(--neon-amber)]' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {Array.isArray(m.teamA) ? m.teamA.length : 0} players
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {Array.isArray(m.teamB) ? m.teamB.length : 0} players
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/matches/${m.matchId}`}
                          className="text-sm font-medium text-[var(--neon-red)] hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </NeonCard>
      </motion.div>
    </div>
  );
}
