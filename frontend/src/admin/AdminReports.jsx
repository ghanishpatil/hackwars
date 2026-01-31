import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { adminApi } from '../api/client';

function formatTs(ts) {
  if (ts == null) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [action, setAction] = useState({ type: null, id: null });

  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      const data = await adminApi.getReports(statusFilter);
      setReports(data);
    } catch (err) {
      setError(err?.message || 'Failed to load reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDismiss = async (id) => {
    setAction({ type: 'dismiss', id });
    try {
      await adminApi.dismissReport(id);
      await fetchReports();
    } catch (err) {
      setError(err?.message || 'Failed to dismiss');
    } finally {
      setAction({ type: null, id: null });
    }
  };

  const handleAction = async (id, act) => {
    setAction({ type: act, id });
    try {
      await adminApi.actionReport(id, act);
      await fetchReports();
    } catch (err) {
      setError(err?.message || 'Failed to action');
    } finally {
      setAction({ type: null, id: null });
    }
  };

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--neon-red)]"
      >
        Reports
      </motion.h1>
      <p className="font-mono text-sm text-[var(--text-muted)]">
        User-submitted reports. Dismiss or take action (e.g. ban reported user).
      </p>

      {error && (
        <NeonCard glow="red" className="p-3">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}

      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="dismissed">Dismissed</option>
          <option value="actioned_ban">Actioned (ban)</option>
        </select>
        <button
          type="button"
          onClick={fetchReports}
          className="px-4 py-2 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] font-mono text-sm hover:bg-[var(--neon-cyan)]/10"
        >
          Refresh
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <NeonCard glow="red" className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Time</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Reporter</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Target</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Reason</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">Loading…</td>
                  </tr>
                )}
                {!loading && reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">No reports</td>
                  </tr>
                )}
                {!loading && reports.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]/50">
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">{formatTs(r.createdAt)}</td>
                    <td className="px-4 py-2 font-mono text-sm text-[var(--text-primary)]">{r.reporterUid}</td>
                    <td className="px-4 py-2 font-mono text-sm text-[var(--neon-cyan)]">{r.targetUid}</td>
                    <td className="px-4 py-2 text-sm text-[var(--text-primary)] max-w-xs truncate">{r.reason || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium ${r.status === 'pending' ? 'text-[var(--neon-amber)]' : 'text-[var(--text-muted)]'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      {r.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={action.type !== null}
                            onClick={() => handleDismiss(r.id)}
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            disabled={action.type !== null}
                            onClick={() => handleAction(r.id, 'ban')}
                            className="text-xs text-[var(--neon-red)] hover:underline disabled:opacity-50"
                          >
                            Ban target
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </NeonCard>
      </motion.div>
    </div>
  );
}
