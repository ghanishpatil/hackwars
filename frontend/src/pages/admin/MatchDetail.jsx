import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';

const POLL_MS = 5_000;

export default function MatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchMatch = useCallback(async () => {
    if (!matchId) return;
    try {
      setError(null);
      const data = await adminApi.getMatch(matchId);
      setMatch(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load match');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const id = setInterval(fetchMatch, POLL_MS);
    return () => clearInterval(id);
  }, [fetchMatch]);

  const handleStop = async () => {
    if (!matchId) return;
    setActionLoading('stop');
    try {
      await adminApi.stopMatch(matchId);
      await fetchMatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop match');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkInvalid = async () => {
    if (!matchId) return;
    setActionLoading('invalid');
    try {
      await adminApi.markMatchInvalid(matchId);
      await fetchMatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invalid');
    } finally {
      setActionLoading(null);
    }
  };

  if (!matchId) {
    navigate('/admin/matches');
    return null;
  }

  if (loading && !match) {
    return (
      <div className="text-[var(--text-muted)]">
        Loading match…
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/admin/matches')}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Back to matches
        </button>
        <div className="rounded border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-[var(--danger)]">
          {error}
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-[var(--text-muted)]">
        Match not found.
        <button
          type="button"
          onClick={() => navigate('/admin/matches')}
          className="ml-2 text-[var(--accent)] hover:underline"
        >
          Back to matches
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin/matches')}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Back to matches
        </button>
      </div>

      <h1 className="text-xl font-semibold text-[var(--text)]">Match {matchId.slice(0, 8)}…</h1>

      {error && (
        <div className="rounded border border-[var(--warn)]/50 bg-[var(--warn)]/10 px-4 py-2 text-[var(--warn)] text-sm">
          {error}
        </div>
      )}

      <section className="panel p-4 space-y-2">
        <p><span className="text-[var(--text-muted)]">Status:</span> {match.status}</p>
        <p><span className="text-[var(--text-muted)]">Engine state:</span> {match.engineState ?? '—'}</p>
        <p><span className="text-[var(--text-muted)]">Difficulty:</span> {match.difficulty ?? '—'}</p>
        <p><span className="text-[var(--text-muted)]">Invalid (no rank update):</span> {match.invalid ? 'Yes' : 'No'}</p>
      </section>

      <section className="panel p-4">
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-2">Team A</h2>
        <ul className="font-mono text-xs text-[var(--text)] list-disc list-inside">
          {(match.teamA ?? []).map((uid) => (
            <li key={uid}>{uid}</li>
          ))}
        </ul>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mt-4 mb-2">Team B</h2>
        <ul className="font-mono text-xs text-[var(--text)] list-disc list-inside">
          {(match.teamB ?? []).map((uid) => (
            <li key={uid}>{uid}</li>
          ))}
        </ul>
      </section>

      {match.result != null && (
        <section className="panel p-4">
          <h2 className="text-sm font-medium text-[var(--text-muted)] mb-2">Result (engine)</h2>
          <pre className="text-xs text-[var(--text)] overflow-auto rounded bg-[var(--bg-deep)] p-3">
            {JSON.stringify(match.result, null, 2)}
          </pre>
        </section>
      )}

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleStop}
          disabled={!!actionLoading}
          className="rounded border border-[var(--danger)]/80 bg-[var(--danger)]/10 px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/20 disabled:opacity-50"
        >
          {actionLoading === 'stop' ? 'Stopping…' : 'Force stop match'}
        </button>
        <button
          type="button"
          onClick={handleMarkInvalid}
          disabled={!!actionLoading || match.invalid}
          className="rounded border border-[var(--warn)]/80 bg-[var(--warn)]/10 px-4 py-2 text-sm font-medium text-[var(--warn)] hover:bg-[var(--warn)]/20 disabled:opacity-50"
        >
          {actionLoading === 'invalid' ? 'Marking…' : 'Mark match invalid (no rank update)'}
        </button>
      </section>
    </div>
  );
}
