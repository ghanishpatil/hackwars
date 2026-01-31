import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/client';

const POLL_MS = 15_000;

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    try {
      setError(null);
      const list = await adminApi.getMatches();
      setMatches(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const id = setInterval(fetchMatches, POLL_MS);
    return () => clearInterval(id);
  }, [fetchMatches]);

  if (loading && matches.length === 0) {
    return (
      <div className="text-[var(--text-muted)]">
        Loading matches…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text)]">Matches</h1>

      {error && (
        <div className="rounded border border-[var(--warn)]/50 bg-[var(--warn)]/10 px-4 py-2 text-[var(--warn)] text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-[var(--border)]">
        <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
          <thead className="bg-[var(--bg-elevated)]">
            <tr>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Match ID</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Difficulty</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Team A</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Team B</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Invalid</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-card)]/30">
            {matches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No matches
                </td>
              </tr>
            ) : (
              matches.map((m) => (
                <tr key={m.matchId} className="text-[var(--text)]">
                  <td className="px-4 py-2 font-mono text-xs">{m.matchId.slice(0, 8)}…</td>
                  <td className="px-4 py-2">{m.difficulty}</td>
                  <td className="px-4 py-2">{m.status}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.teamA.length} players</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.teamB.length} players</td>
                  <td className="px-4 py-2">{m.invalid ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/admin/matches/${m.matchId}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
