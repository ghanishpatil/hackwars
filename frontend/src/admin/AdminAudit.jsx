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

export default function AdminAudit() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [limit, setLimit] = useState(100);

  const fetchAudit = useCallback(async () => {
    try {
      setError(null);
      const params = { limit };
      if (actionFilter) params.action = actionFilter;
      if (targetFilter) params.target = targetFilter;
      const data = await adminApi.getAuditLog(params);
      setEvents(data);
    } catch (err) {
      setError(err?.message || 'Failed to load audit log');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [limit, actionFilter, targetFilter]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--neon-red)]"
      >
        Audit log
      </motion.h1>
      <p className="font-mono text-sm text-[var(--text-muted)]">
        All admin actions are logged. Filter by action or target.
      </p>

      {error && (
        <NeonCard glow="red" className="p-3">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Action filter"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] w-40"
        />
        <input
          type="text"
          placeholder="Target filter"
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] w-40"
        />
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <button
          type="button"
          onClick={fetchAudit}
          className="px-4 py-2 rounded border border-[var(--neon-cyan)] text-[var(--neon-cyan)] font-mono text-sm hover:bg-[var(--neon-cyan)]/10"
        >
          Refresh
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <NeonCard glow="red" className="p-0 overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Time</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Action</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Target</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Admin</th>
                  <th className="px-4 py-3 font-heading text-sm text-[var(--text-muted)]">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">
                      No events
                    </td>
                  </tr>
                )}
                {!loading && events.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]/50">
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">{formatTs(e.timestamp)}</td>
                    <td className="px-4 py-2 font-mono text-sm text-[var(--neon-cyan)]">{e.action}</td>
                    <td className="px-4 py-2 font-mono text-sm text-[var(--text-primary)]">{e.target}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">{e.adminId}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text-dim)] max-w-xs truncate" title={JSON.stringify(e.metadata)}>
                      {Object.keys(e.metadata || {}).length ? JSON.stringify(e.metadata) : '—'}
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
