import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api/client';

const POLL_MS = 30_000;

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedUid, setSelectedUid] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const fetchPlayers = useCallback(async () => {
    try {
      setError(null);
      const list = await adminApi.getPlayers();
      setPlayers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list players');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
    const id = setInterval(fetchPlayers, POLL_MS);
    return () => clearInterval(id);
  }, [fetchPlayers]);

  const loadProfile = async (uid) => {
    setSelectedUid(uid);
    try {
      const user = await adminApi.getUser(uid);
      setUserProfile(user);
    } catch {
      setUserProfile(null);
    }
  };

  const doAction = async (uid, action, label) => {
    setActionLoading(`${uid}-${label}`);
    try {
      await action();
      await fetchPlayers();
      if (selectedUid === uid) {
        const user = await adminApi.getUser(uid);
        setUserProfile(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed: ${label}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && players.length === 0) {
    return (
      <div className="text-[var(--text-muted)]">
        Loading players…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text)]">Players</h1>

      {error && (
        <div className="rounded border border-[var(--warn)]/50 bg-[var(--warn)]/10 px-4 py-2 text-[var(--warn)] text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
            <thead className="bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--text-muted)]">UID</th>
                <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Username</th>
                <th className="px-4 py-3 font-medium text-[var(--text-muted)]">MMR</th>
                <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Rank</th>
                <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Banned</th>
                <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Shadow</th>
                <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-card)]/30">
              {players.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No players
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.uid} className="text-[var(--text)]">
                    <td className="px-4 py-2 font-mono text-xs">{p.uid.slice(0, 8)}…</td>
                    <td className="px-4 py-2">{p.username ?? '—'}</td>
                    <td className="px-4 py-2">{p.mmr}</td>
                    <td className="px-4 py-2">{p.rank}</td>
                    <td className="px-4 py-2">{p.banned ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">{p.shadowBan ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => loadProfile(p.uid)}
                        className="text-[var(--accent)] hover:underline mr-2"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="panel p-4">
          <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3">Player profile</h2>
          {!selectedUid ? (
            <p className="text-[var(--text-muted)] text-sm">Select a player to view profile and actions.</p>
          ) : userProfile ? (
            <div className="space-y-4">
              <pre className="text-xs text-[var(--text)] overflow-auto rounded bg-[var(--bg-deep)] p-3">
                {JSON.stringify(userProfile, null, 2)}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!actionLoading || userProfile.banned}
                  onClick={() =>
                    doAction(selectedUid, () => adminApi.banUser(selectedUid), 'ban')
                  }
                  className="rounded border border-[var(--danger)]/80 bg-[var(--danger)]/10 px-3 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/20 disabled:opacity-50"
                >
                  Ban
                </button>
                <button
                  type="button"
                  disabled={!!actionLoading || !userProfile.banned}
                  onClick={() =>
                    doAction(selectedUid, () => adminApi.unbanUser(selectedUid), 'unban')
                  }
                  className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-50"
                >
                  Unban
                </button>
                <button
                  type="button"
                  disabled={!!actionLoading || userProfile.shadowBan}
                  onClick={() =>
                    doAction(selectedUid, () => adminApi.shadowBanUser(selectedUid), 'shadow-ban')
                  }
                  className="rounded border border-[var(--warn)]/80 bg-[var(--warn)]/10 px-3 py-1.5 text-xs text-[var(--warn)] hover:bg-[var(--warn)]/20 disabled:opacity-50"
                >
                  Shadow-ban
                </button>
                <button
                  type="button"
                  disabled={!!actionLoading || !userProfile.shadowBan}
                  onClick={() =>
                    doAction(selectedUid, () => adminApi.shadowUnbanUser(selectedUid), 'shadow-unban')
                  }
                  className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-50"
                >
                  Shadow-unban
                </button>
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={() =>
                    doAction(selectedUid, () => adminApi.resetUserRank(selectedUid), 'reset-rank')
                  }
                  className="rounded border border-[var(--warn)]/80 bg-[var(--warn)]/10 px-3 py-1.5 text-xs text-[var(--warn)] hover:bg-[var(--warn)]/20 disabled:opacity-50"
                >
                  Reset rank
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-sm">Failed to load profile.</p>
          )}
        </div>
      </div>
    </div>
  );
}
