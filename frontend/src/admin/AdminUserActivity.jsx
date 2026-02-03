import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { adminApi } from '../api/client';

const POLL_MS = 8000;

function Avatar({ name, index = 0 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const colors = [
    'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]',
    'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-[var(--neon-cyan)]',
    'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] border-[var(--neon-purple)]',
  ];
  const c = colors[index % colors.length];
  return (
    <div className={`flex items-center justify-center rounded-full w-9 h-9 border-2 font-heading font-bold text-sm shrink-0 ${c}`}>
      {initial}
    </div>
  );
}

function formatTs(ts) {
  if (ts == null) return '—';
  try {
    const d = new Date(typeof ts === 'number' ? ts : ts);
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function actionLabel(action) {
  switch (action) {
    case 'team_create': return 'Created team';
    case 'team_join': return 'Joined team';
    case 'team_leave': return 'Left team';
    case 'team_disband': return 'Team disbanded';
    case 'team_leader_transfer': return 'Became team leader';
    default: return String(action || 'event');
  }
}

export default function AdminUserActivity() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailUid, setDetailUid] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const list = await adminApi.getPlayers();
      setUsers(list);
    } catch (err) {
      setError(err?.message || 'Failed to load user activity');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const id = setInterval(fetchUsers, POLL_MS);
    return () => clearInterval(id);
  }, [fetchUsers]);

  const openDetail = async (u) => {
    setDetailUid(u.uid);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await adminApi.getUserActivity(u.uid);
      setDetail(data);
      setDetailError(null);
    } catch (err) {
      setDetail(null);
      setDetailError(err?.message || 'Failed to load detailed history');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailUid(null);
    setDetail(null);
    setDetailError(null);
  };

  const isActive = (u) => u.status === 'ACTIVE' || u.status === 'IN_QUEUE' || u.status === 'IN_MATCH';

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-mono text-[var(--text-muted)]">Loading user activity…</p>
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
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--neon-red)]">
            User Activity
          </h1>
          <p className="font-mono text-sm text-[var(--text-muted)] mt-1">
            Last login, last active, status, and detailed history per user
          </p>
        </div>
        <Link
          to="/admin/players"
          className="font-mono text-sm text-[var(--neon-cyan)] hover:underline border border-[var(--neon-cyan)]/50 px-3 py-2 rounded"
        >
          Manage Users →
        </Link>
      </motion.div>

      {error && (
        <NeonCard glow="red" className="p-3">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}

      {/* Total history summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <NeonCard glow="cyan" className="p-4">
          <div className="flex flex-wrap items-center gap-6 font-mono text-sm">
            <span className="text-[var(--text-muted)]">
              Total users: <span className="text-[var(--neon-cyan)] font-semibold">{users.length}</span>
            </span>
            <span className="text-[var(--text-muted)]">
              Active now: <span className="text-[var(--neon-green)] font-semibold">{users.filter(isActive).length}</span>
            </span>
            <span className="text-[var(--text-muted)]">
              Banned: <span className="text-[var(--neon-red)] font-semibold">{users.filter((u) => u.banned).length}</span>
            </span>
          </div>
        </NeonCard>
      </motion.div>

      {/* Activity table */}
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
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">User</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Last login</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Last active</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Active</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <motion.tr
                    key={u.uid}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.02 * i }}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)]/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.displayName || u.username || u.email} index={i} />
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {u.displayName || u.username || u.email || '—'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{u.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">
                      {formatTs(u.lastLogin)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">
                      {formatTs(u.lastActive)}
                    </td>
                    <td className="px-4 py-3">
                      {isActive(u) ? (
                        <span className="text-[var(--neon-green)] font-medium">Yes</span>
                      ) : u.banned ? (
                        <span className="text-[var(--neon-red)] font-medium">Banned</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          u.status === 'ACTIVE'
                            ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]'
                            : u.status === 'IN_QUEUE'
                            ? 'bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] border-[var(--neon-amber)]'
                            : u.status === 'IN_MATCH'
                            ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-[var(--neon-cyan)]'
                            : 'bg-[var(--neon-red)]/20 text-[var(--neon-red)] border-[var(--neon-red)]'
                        }`}
                      >
                        {u.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(u)}
                        className="text-xs font-medium text-[var(--neon-cyan)] hover:underline"
                      >
                        Detailed history
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && !loading && (
            <p className="p-6 font-mono text-sm text-[var(--text-muted)]">No users found.</p>
          )}
        </NeonCard>
      </motion.div>

      {/* Detailed history modal */}
      {detailUid && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeDetail}
        >
          <NeonCard
            glow="cyan"
            className="p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
                Detailed history
                {detail && (
                  <span className="ml-2 font-mono text-sm font-normal text-[var(--text-muted)]">
                    {detail.displayName || detail.email || detailUid}
                  </span>
                )}
              </h3>
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-2xl leading-none"
                onClick={closeDetail}
              >
                ×
              </button>
            </div>

            {detailLoading && !detail && !detailError && <p className="font-mono text-sm text-[var(--text-muted)]">Loading…</p>}

            {detailError && !detailLoading && (
              <div className="py-4">
                <p className="text-sm text-[var(--neon-red)] mb-2">{detailError}</p>
                <p className="text-xs text-[var(--text-muted)]">Check backend logs. You can close and try again.</p>
              </div>
            )}

            {detail && !detailLoading && (
              <div className="space-y-6 font-mono text-sm">
                <div className="grid grid-cols-2 gap-4 p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <div>
                    <p className="text-[var(--text-muted)] text-xs uppercase">Last login</p>
                    <p className="text-[var(--text-primary)]">{formatTs(detail.lastLogin)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)] text-xs uppercase">Last active</p>
                    <p className="text-[var(--text-primary)]">{formatTs(detail.lastActive)}</p>
                  </div>
                </div>

                {/* Team snapshot + team history */}
                <div>
                  <h4 className="font-heading text-sm font-semibold text-[var(--neon-amber)] mb-2">Teams</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <p className="text-[var(--text-muted)] text-xs uppercase mb-2">Current team</p>
                      {detail.currentTeam ? (
                        <div className="space-y-1">
                          <p className="text-[var(--text-primary)] font-semibold">{detail.currentTeam.name || detail.currentTeam.id}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {detail.currentTeam.currentSize}/{detail.currentTeam.maxSize || '—'} members
                            {detail.currentTeam.leaderId ? ` · leader: ${String(detail.currentTeam.leaderId).slice(0, 8)}…` : ''}
                          </p>
                          {Array.isArray(detail.currentTeam.members) && detail.currentTeam.members.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs">
                              {detail.currentTeam.members.slice(0, 6).map((m) => (
                                <li key={m.uid} className="flex items-center justify-between gap-2">
                                  <span className="text-[var(--text-primary)] truncate">{m.username || m.uid}</span>
                                  <span className="text-[var(--text-muted)] shrink-0">{m.mmr ?? '—'} MMR</span>
                                </li>
                              ))}
                              {detail.currentTeam.members.length > 6 && (
                                <li className="text-[var(--text-dim)]">+{detail.currentTeam.members.length - 6} more…</li>
                              )}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <p className="text-[var(--text-muted)]">Not in a team</p>
                      )}
                    </div>

                    <div className="p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <p className="text-[var(--text-muted)] text-xs uppercase mb-2">Team history</p>
                      {detail.teamHistory?.length ? (
                        <ul className="space-y-2 text-xs">
                          {detail.teamHistory.slice(0, 20).map((e) => (
                            <li key={e.id || `${e.action}-${e.createdAt}`} className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[var(--text-primary)]">
                                  <span className="text-[var(--neon-amber)] font-semibold">{actionLabel(e.action)}</span>
                                  {e.teamName ? ` · ${e.teamName}` : e.teamId ? ` · ${e.teamId}` : ''}
                                </p>
                                {e.metadata?.wasLeader && e.metadata?.newLeaderId && (
                                  <p className="text-[var(--text-dim)]">Leader transferred to {String(e.metadata.newLeaderId).slice(0, 8)}…</p>
                                )}
                              </div>
                              <span className="text-[var(--text-muted)] shrink-0">{formatTs(e.createdAt)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[var(--text-muted)]">
                          No team history recorded yet. (Team join/leave events are tracked going forward.)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {detail.loginHistory?.length > 0 && (
                  <div>
                    <h4 className="font-heading text-sm font-semibold text-[var(--neon-green)] mb-2">Login history</h4>
                    <ul className="space-y-1 text-xs font-mono text-[var(--text-muted)]">
                      {detail.loginHistory.slice(-10).reverse().map((ts, i) => (
                        <li key={i}>{formatTs(ts)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="font-heading text-sm font-semibold text-[var(--neon-cyan)] mb-2">Recent matches</h4>
                  {detail.recentMatches?.length ? (
                    <ul className="space-y-1.5 text-[var(--text-primary)]">
                      {detail.recentMatches.slice(0, 15).map((m, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-[var(--text-muted)]">{m.matchId}</span>
                          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]">{m.status}</span>
                          <span className="text-[var(--text-dim)]">{formatTs(m.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[var(--text-muted)]">No matches yet</p>
                  )}
                </div>

                <div>
                  <h4 className="font-heading text-sm font-semibold text-[var(--neon-purple)] mb-2">Admin events (this user)</h4>
                  {detail.recentAdminEvents?.length ? (
                    <ul className="space-y-1.5 text-[var(--text-primary)]">
                      {detail.recentAdminEvents.slice(0, 20).map((e, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="text-[var(--neon-amber)]">{e.action}</span>
                          <span className="text-[var(--text-muted)]">{e.target}</span>
                          <span className="text-[var(--text-dim)]">{formatTs(e.timestamp)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[var(--text-muted)]">No admin events</p>
                  )}
                </div>
              </div>
            )}
          </NeonCard>
        </motion.div>
      )}
    </div>
  );
}
