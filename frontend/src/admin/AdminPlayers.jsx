import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { adminApi } from '../api/client';

const STATUS_POLL_MS = 5000;

function Avatar({ name, index = 0 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const colors = [
    'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]',
    'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-[var(--neon-cyan)]',
    'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] border-[var(--neon-purple)]',
  ];
  const color = colors[index % colors.length];
  return (
    <div
      className={`flex items-center justify-center rounded-full w-10 h-10 border-2 font-heading font-bold text-sm shrink-0 ${color}`}
    >
      {initial}
    </div>
  );
}

function IconEnvelope({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function IconPhone({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IconBuilding({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  );
}
function IconArrow({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function IconEye({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconPencil({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconBan({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}
function IconTrash({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function StatusPill({ status }) {
  const map = {
    ACTIVE: { label: 'ACTIVE', className: 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]' },
    IN_QUEUE: { label: 'IN QUEUE', className: 'bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] border-[var(--neon-amber)]' },
    IN_MATCH: { label: 'IN MATCH', className: 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-[var(--neon-cyan)]' },
    BANNED: { label: 'BANNED', className: 'bg-[var(--neon-red)]/20 text-[var(--neon-red)] border-[var(--neon-red)]' },
  };
  const c = map[status] || { label: status || '—', className: 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)]' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.className}`}>
      {c.label}
    </span>
  );
}

function RolePill({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        isAdmin ? 'bg-[var(--neon-red)]/20 text-[var(--neon-red)] border-[var(--neon-red)]' : 'bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]'
      }`}
    >
      {isAdmin ? 'ADMIN' : 'PLAYER'}
    </span>
  );
}

export default function AdminPlayers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [action, setAction] = useState({ type: null, uid: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [viewUserDetail, setViewUserDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [selectedUids, setSelectedUids] = useState(new Set());

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const list = await adminApi.getPlayers();
      setUsers(list);
    } catch (err) {
      setError(err?.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!fetchUsers) return;
    const id = setInterval(fetchUsers, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [fetchUsers]);

  const handleBan = async (uid) => {
    setAction({ type: 'ban', uid });
    try {
      await adminApi.banUser(uid);
      await fetchUsers();
    } catch (err) {
      setError(err?.message || 'Failed to ban user');
    } finally {
      setAction({ type: null, uid: null });
    }
  };

  const handleUnban = async (uid) => {
    setAction({ type: 'unban', uid });
    try {
      await adminApi.unbanUser(uid);
      await fetchUsers();
    } catch (err) {
      setError(err?.message || 'Failed to unban user');
    } finally {
      setAction({ type: null, uid: null });
    }
  };

  const handleDeleteClick = (u) => setConfirmDelete(u);
  const handleDeleteCancel = () => setConfirmDelete(null);

  const handleViewUser = async (u) => {
    setViewUser(u);
    setViewUserDetail(null);
    setViewLoading(true);
    try {
      const detail = await adminApi.getUser(u.uid);
      setViewUserDetail(detail);
    } catch {
      setViewUserDetail(null);
    } finally {
      setViewLoading(false);
    }
  };
  const handleCloseView = () => {
    setViewUser(null);
    setViewUserDetail(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const uid = confirmDelete.uid;
    setAction({ type: 'delete', uid });
    try {
      await adminApi.deleteUser(uid);
      setConfirmDelete(null);
      setSelectedUids((s) => { const n = new Set(s); n.delete(uid); return n; });
      await fetchUsers();
    } catch (err) {
      setError(err?.message || 'Failed to delete user');
    } finally {
      setAction({ type: null, uid: null });
    }
  };

  const toggleSelect = (uid) => {
    setSelectedUids((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });
  };
  const toggleSelectAll = () => {
    if (selectedUids.size === users.length) setSelectedUids(new Set());
    else setSelectedUids(new Set(users.map((u) => u.uid)));
  };
  const handleBulkBan = async () => {
    const uids = Array.from(selectedUids);
    if (!uids.length) return;
    setAction({ type: 'bulk-ban', uid: null });
    try {
      await adminApi.bulkBanUsers(uids);
      setSelectedUids(new Set());
      await fetchUsers();
    } catch (err) {
      setError(err?.message || 'Failed to bulk ban');
    } finally {
      setAction({ type: null, uid: null });
    }
  };
  const handleBulkUnban = async () => {
    const uids = Array.from(selectedUids);
    if (!uids.length) return;
    setAction({ type: 'bulk-unban', uid: null });
    try {
      await adminApi.bulkUnbanUsers(uids);
      setSelectedUids(new Set());
      await fetchUsers();
    } catch (err) {
      setError(err?.message || 'Failed to bulk unban');
    } finally {
      setAction({ type: null, uid: null });
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-mono text-[var(--text-muted)]">Loading users…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--neon-red)]"
      >
        Users
      </motion.h1>

      {error && (
        <NeonCard glow="red" className="p-3">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}

      {selectedUids.size > 0 && (
        <div className="flex items-center gap-3 font-mono text-sm">
          <span className="text-[var(--text-muted)]">{selectedUids.size} selected</span>
          <button
            type="button"
            disabled={action.type !== null}
            onClick={handleBulkBan}
            className="px-3 py-1.5 rounded border border-[var(--neon-red)] text-[var(--neon-red)] hover:bg-[var(--neon-red)]/10 disabled:opacity-50"
          >
            Ban selected
          </button>
          <button
            type="button"
            disabled={action.type !== null}
            onClick={handleBulkUnban}
            className="px-3 py-1.5 rounded border border-[var(--neon-green)] text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10 disabled:opacity-50"
          >
            Unban selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedUids(new Set())}
            className="px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Clear
          </button>
        </div>
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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={users.length > 0 && selectedUids.size === users.length}
                      onChange={toggleSelectAll}
                      className="rounded border-[var(--border)]"
                    />
                  </th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">User</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Contact</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Institute</th>
                  <th className="px-4 py-3 font-heading text-sm font-semibold text-[var(--text-muted)]">Role</th>
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
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedUids.has(u.uid)}
                        onChange={() => toggleSelect(u.uid)}
                        className="rounded border-[var(--border)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.displayName || u.username || u.email} index={i} />
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {u.displayName || u.username || u.email || '—'}
                          </p>
                          <p className="text-xs font-mono text-[var(--text-muted)]">
                            {u.rank ?? '—'} {u.track ? `· ${u.track}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center gap-2 text-[var(--text-primary)]">
                          <IconEnvelope className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                          {u.email ?? '—'}
                        </span>
                        <span className="flex items-center gap-2 text-[var(--text-muted)]">
                          <IconPhone className="w-4 h-4 shrink-0" />
                          {u.phone || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                        <IconBuilding className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                        {u.institute || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RolePill role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] flex items-center justify-center hover:bg-[var(--neon-cyan)]/30 transition-colors"
                          title="View"
                          onClick={() => handleViewUser(u)}
                        >
                          <IconArrow className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full bg-[var(--neon-purple)]/20 text-[var(--neon-purple)] flex items-center justify-center hover:bg-[var(--neon-purple)]/30 transition-colors"
                          title="View profile"
                          onClick={() => handleViewUser(u)}
                        >
                          <IconEye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] flex items-center justify-center hover:bg-[var(--neon-cyan)]/30 transition-colors"
                          title="Edit"
                          onClick={() => {}}
                        >
                          <IconPencil className="w-4 h-4" />
                        </button>
                        {u.banned ? (
                          <button
                            type="button"
                            disabled={action.type !== null}
                            onClick={() => handleUnban(u.uid)}
                            className="w-8 h-8 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] flex items-center justify-center hover:bg-[var(--neon-green)]/30 transition-colors disabled:opacity-50"
                            title="Unban"
                          >
                            <IconBan className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={action.type !== null}
                            onClick={() => handleBan(u.uid)}
                            className="w-8 h-8 rounded-full bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] flex items-center justify-center hover:bg-[var(--neon-amber)]/30 transition-colors disabled:opacity-50"
                            title="Ban"
                          >
                            <IconBan className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={action.type !== null}
                          onClick={() => handleDeleteClick(u)}
                          className="w-8 h-8 rounded-full bg-[var(--neon-red)]/20 text-[var(--neon-red)] flex items-center justify-center hover:bg-[var(--neon-red)]/30 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
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

      {viewUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={handleCloseView}
        >
          <NeonCard
            glow="cyan"
            className="p-6 max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold text-[var(--text-primary)]">User details</h3>
              <button
                type="button"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={handleCloseView}
              >
                ×
              </button>
            </div>
            {viewLoading && !viewUserDetail && (
              <p className="font-mono text-sm text-[var(--text-muted)]">Loading…</p>
            )}
            {viewUserDetail && (
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={viewUserDetail.displayName || viewUserDetail.username} index={0} />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{viewUserDetail.displayName || viewUserDetail.username || '—'}</p>
                    <p className="text-[var(--text-muted)]">{viewUserDetail.rank} {viewUserDetail.track ? `· ${viewUserDetail.track}` : ''}</p>
                  </div>
                </div>
                <p><span className="text-[var(--text-muted)]">Email:</span> {viewUserDetail.email ?? '—'}</p>
                <p><span className="text-[var(--text-muted)]">Phone:</span> {viewUserDetail.phone || '—'}</p>
                <p><span className="text-[var(--text-muted)]">Institute:</span> {viewUserDetail.institute || '—'}</p>
                <p><span className="text-[var(--text-muted)]">Role:</span> <RolePill role={viewUserDetail.role} /></p>
                <p><span className="text-[var(--text-muted)]">Status:</span> <StatusPill status={viewUserDetail.status} /></p>
                <p><span className="text-[var(--text-muted)]">MMR:</span> {viewUserDetail.mmr ?? '—'}</p>
                <p><span className="text-[var(--text-muted)]">RP:</span> {viewUserDetail.rp ?? '—'}</p>
              </div>
            )}
          </NeonCard>
        </motion.div>
      )}

      {confirmDelete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={handleDeleteCancel}
        >
          <NeonCard glow="red" className="p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-2">Delete user?</h3>
            <p className="font-mono text-sm text-[var(--text-muted)] mb-4">
              This will permanently remove{' '}
              <strong className="text-[var(--neon-cyan)]">
                {confirmDelete.displayName || confirmDelete.email || confirmDelete.username || confirmDelete.uid}
              </strong>{' '}
              from Firestore and Firebase Auth. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-[var(--neon-red)] text-white font-medium hover:opacity-90 disabled:opacity-50"
                onClick={handleDeleteConfirm}
                disabled={action.type === 'delete'}
              >
                {action.type === 'delete' && action.uid === confirmDelete.uid ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </NeonCard>
        </motion.div>
      )}
    </div>
  );
}
