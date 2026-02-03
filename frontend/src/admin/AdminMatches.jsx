import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { adminApi } from '../api/client';

export default function AdminMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  const handleDeleteClick = (e, m) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(m);
  };
  const handleDeleteCancel = () => setConfirmDelete(null);
  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const matchId = confirmDelete.matchId;
    setConfirmDelete(null);
    setDeletingId(matchId);
    setError('');
    try {
      await adminApi.deleteMatch(matchId);
      await fetchMatches();
    } catch (err) {
      setError(err.message || err.data?.error || 'Failed to delete match');
    } finally {
      setDeletingId(null);
    }
  };

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
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/admin/matches/${m.matchId}`}
                            className="text-sm font-medium text-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] hover:underline"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, m)}
                            disabled={deletingId === m.matchId}
                            className="px-2.5 py-1 rounded border border-[var(--border)] text-xs font-mono text-[var(--text-muted)] hover:border-[var(--neon-red)] hover:text-[var(--neon-red)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Permanently delete match"
                          >
                            {deletingId === m.matchId ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </NeonCard>
      </motion.div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleDeleteCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-match-title"
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--neon-red)] rounded-xl p-6 max-w-md w-full shadow-xl shadow-[var(--neon-red)]/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-match-title" className="font-heading text-lg font-semibold text-[var(--neon-red)] mb-2">
              Delete match permanently?
            </h2>
            <p className="text-sm text-[var(--text-primary)] mb-2">
              Engine cleanup (containers, network, state) and database record will be removed. This cannot be undone.
            </p>
            <p className="font-mono text-xs text-[var(--text-muted)] mb-4 break-all">{confirmDelete.matchId}</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleDeleteCancel}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-mono text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg border border-[var(--neon-red)] text-sm font-mono text-[var(--neon-red)] hover:bg-[var(--neon-red)]/10 transition-colors"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
