import { useState } from 'react';
import { adminApi } from '../../api/client';

export default function System() {
  const [loading, setLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const run = async (label, action) => {
    setLoading(label);
    setMessage(null);
    try {
      const res = await action();
      setMessage({ type: 'ok', text: `${label}: ${res.status}` });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : `${label} failed`,
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text)]">System controls</h1>

      <p className="text-sm text-[var(--text-muted)]">
        Maintenance and recovery actions. All actions are audited.
      </p>

      {message && (
        <div
          className={`rounded border px-4 py-2 text-sm ${
            message.type === 'ok'
              ? 'border-[var(--success)]/50 bg-[var(--success)]/10 text-[var(--success)]'
              : 'border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)]'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="panel p-4 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-muted)]">Global kill switch (maintenance)</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!loading}
            onClick={() => run('Enable maintenance', adminApi.enableMaintenance)}
            className="rounded border border-[var(--danger)]/80 bg-[var(--danger)]/10 px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/20 disabled:opacity-50"
          >
            {loading === 'Enable maintenance' ? '…' : 'Enable maintenance'}
          </button>
          <button
            type="button"
            disabled={!!loading}
            onClick={() => run('Disable maintenance', adminApi.disableMaintenance)}
            className="rounded border border-[var(--success)]/80 bg-[var(--success)]/10 px-4 py-2 text-sm font-medium text-[var(--success)] hover:bg-[var(--success)]/20 disabled:opacity-50"
          >
            {loading === 'Disable maintenance' ? '…' : 'Disable maintenance'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          When enabled: new queue joins and match start rejected. Admin routes always allowed.
        </p>
      </section>

      <section className="panel p-4 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-muted)]">Matchmaking</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!loading}
            onClick={() => run('Disable matchmaking', adminApi.disableMatchmaking)}
            className="rounded border border-[var(--warn)]/80 bg-[var(--warn)]/10 px-4 py-2 text-sm font-medium text-[var(--warn)] hover:bg-[var(--warn)]/20 disabled:opacity-50"
          >
            {loading === 'Disable matchmaking' ? '…' : 'Disable matchmaking (maintenance)'}
          </button>
          <button
            type="button"
            disabled={!!loading}
            onClick={() => run('Enable matchmaking', adminApi.enableMatchmaking)}
            className="rounded border border-[var(--success)]/80 bg-[var(--success)]/10 px-4 py-2 text-sm font-medium text-[var(--success)] hover:bg-[var(--success)]/20 disabled:opacity-50"
          >
            {loading === 'Enable matchmaking' ? '…' : 'Enable matchmaking'}
          </button>
        </div>
      </section>

      <section className="panel p-4 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-muted)]">Queues</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!loading}
            onClick={() => run('Drain queues', adminApi.drainQueues)}
            className="rounded border border-[var(--danger)]/80 bg-[var(--danger)]/10 px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/20 disabled:opacity-50"
          >
            {loading === 'Drain queues' ? '…' : 'Drain all queues'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Removes all waiting queue entries. Use during maintenance or recovery.
        </p>
      </section>

      <section className="panel p-4 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-muted)]">Match engine</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!!loading}
            onClick={() => run('Restart engine workers', adminApi.restartEngine)}
            className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-50"
          >
            {loading === 'Restart engine workers' ? '…' : 'Restart match-engine workers (logical)'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Logical restart only (audit logged). No OS-level restart.
        </p>
      </section>
    </div>
  );
}
