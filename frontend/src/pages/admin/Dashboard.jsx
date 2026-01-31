import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/client';

const POLL_MS = 10_000;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const res = await adminApi.getOverview();
      setData(res);
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
      <div className="text-[var(--text-muted)]">
        Loading platform overview…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-[var(--danger)]">
        {error}
      </div>
    );
  }

  const health = data?.engineHealth;
  const engineOk = health?.status === 'ok';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text)]">Platform Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Active users" value={data?.activeUsers ?? 0} />
        <Card title="Active queues" value={data?.activeQueues ?? 0} />
        <Card title="Active matches" value={data?.activeMatches ?? 0} />
        <Card
          title="Match Engine"
          value={engineOk ? 'OK' : health?.status ?? 'Unreachable'}
          ok={engineOk}
        />
      </div>

      <section className="panel p-4">
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-2">Engine health (from engine API)</h2>
        <pre className="text-xs text-[var(--text)] overflow-auto rounded bg-[var(--bg-deep)] p-3">
          {JSON.stringify(data?.engineHealth ?? {}, null, 2)}
        </pre>
      </section>

      {error && (
        <p className="text-sm text-[var(--warn)]">Last refresh error: {error}</p>
      )}
    </div>
  );
}

function Card({ title, value, ok }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{title}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          ok === true ? 'text-[var(--success)]' : ok === false ? 'text-[var(--warn)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
