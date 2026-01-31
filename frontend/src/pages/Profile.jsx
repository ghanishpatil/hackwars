import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';

function Avatar({ name, className }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className={`flex items-center justify-center rounded-full font-heading font-bold text-lg shrink-0 ${className}`}
      style={{ minWidth: '2.5rem', minHeight: '2.5rem' }}
    >
      {initial}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTargetUid, setReportTargetUid] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    (async () => {
      try {
        const data = await api.getMe();
        setProfile(data);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load profile');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, navigate]);

  useEffect(() => {
    if (!profile?.currentTeamId) {
      setTeam(null);
      return;
    }
    let cancelled = false;
    setTeamLoading(true);
    api.teams.get(profile.currentTeamId)
      .then((t) => { if (!cancelled) setTeam(t); })
      .catch(() => { if (!cancelled) setTeam(null); })
      .finally(() => { if (!cancelled) setTeamLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.currentTeamId]);

  if (!user) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-mono text-[var(--text-muted)]">Loading profile…</p>
      </div>
    );
  }

  const displayName = profile?.displayName || profile?.username || user.displayName || user.email || '—';
  const email = profile?.email ?? user.email ?? '—';
  const phone = profile?.phone ?? '—';
  const institute = profile?.institute ?? '—';
  const track = profile?.track ?? '—';

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--text-primary)]"
      >
        Profile
      </motion.h1>
      {error && (
        <NeonCard glow="red" className="p-4">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}
      {profile && (
        <NeonCard glow="cyan" className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar
              name={displayName}
              className="w-14 h-14 bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-2 border-[var(--neon-cyan)]"
            />
            <div>
              <h2 className="font-heading text-xl font-semibold text-[var(--text-primary)]">
                {displayName}
              </h2>
              <p className="font-mono text-sm text-[var(--text-muted)]">
                {track ? `${profile.rank} · ${track}` : profile.rank}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[var(--border)]">
            <div>
              <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Email
              </p>
              <p className="font-mono text-[var(--text-primary)]">{email}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Phone
              </p>
              <p className="font-mono text-[var(--text-primary)]">{phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Institute
              </p>
              <p className="font-mono text-[var(--text-primary)]">{institute || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Track / Specialization
              </p>
              <p className="font-mono text-[var(--text-primary)]">{track || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]">
            <div>
              <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Rank</p>
              <p className="font-heading text-xl text-[var(--neon-cyan)] mt-1">{profile.rank}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">MMR</p>
              <p className="font-mono text-xl text-[var(--text-primary)] mt-1">{profile.mmr}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">RP</p>
              <p className="font-mono text-xl text-[var(--text-primary)] mt-1">{profile.rp}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            <AnimatedButton variant="ghost" className="border-[var(--neon-amber)] text-[var(--neon-amber)] text-sm" onClick={() => setReportOpen(true)}>
              Report a player
            </AnimatedButton>
          </div>
        </NeonCard>
      )}

      {/* Team Management */}
      <NeonCard glow="cyan" className="p-6 space-y-4">
        <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">Team management</h2>
        {teamLoading && !team && (
          <p className="font-mono text-sm text-[var(--text-muted)]">Loading team…</p>
        )}
        {teamError && (
          <p className="text-sm text-[var(--neon-red)]">{teamError}</p>
        )}
        {!teamLoading && profile?.currentTeamId && team && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
              <span className="text-[var(--text-primary)]">{team.name}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-[var(--neon-cyan)]">Invite: {team.inviteCode}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-[var(--text-muted)]">{team.memberUids?.length ?? 0} members</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <AnimatedButton
                variant="ghost"
                className="text-sm border-[var(--neon-red)] text-[var(--neon-red)]"
                disabled={!!teamActionLoading}
                onClick={async () => {
                  setTeamError('');
                  setTeamActionLoading('leave');
                  try {
                    await api.teams.leave();
                    const me = await api.getMe();
                    setProfile(me);
                    setTeam(null);
                  } catch (err) {
                    setTeamError(err.message || 'Failed to leave team');
                  } finally {
                    setTeamActionLoading('');
                  }
                }}
              >
                {teamActionLoading === 'leave' ? 'Leaving…' : 'Leave team'}
              </AnimatedButton>
              {team.leaderUid === user?.uid && (
                <AnimatedButton
                  variant="red"
                  className="text-sm"
                  disabled={!!teamActionLoading}
                  onClick={async () => {
                    if (!window.confirm('Disband this team? All members will be removed.')) return;
                    setTeamError('');
                    setTeamActionLoading('disband');
                    try {
                      await api.teams.disband(team.id);
                      const me = await api.getMe();
                      setProfile(me);
                      setTeam(null);
                    } catch (err) {
                      setTeamError(err.message || 'Failed to disband team');
                    } finally {
                      setTeamActionLoading('');
                    }
                  }}
                >
                  {teamActionLoading === 'disband' ? 'Disbanding…' : 'Disband team'}
                </AnimatedButton>
              )}
            </div>
          </div>
        )}
        {!profile?.currentTeamId && !teamLoading && (
          <div className="flex flex-wrap gap-2">
            <Link to="/team-setup">
              <AnimatedButton variant="cyan" className="text-sm">Create or join team</AnimatedButton>
            </Link>
          </div>
        )}
      </NeonCard>

      {/* Report player modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setReportOpen(false)}>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">Report a player</h3>
            <p className="text-sm text-[var(--text-muted)] mb-3">Submit a report about another player. Provide their user ID (UID) and a reason.</p>
            <input
              type="text"
              value={reportTargetUid}
              onChange={(e) => setReportTargetUid(e.target.value)}
              placeholder="Target user UID"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] mb-3"
            />
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for report"
              rows={3}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] mb-4"
            />
            {reportError && <p className="text-sm text-[var(--neon-red)] mb-2">{reportError}</p>}
            {reportSuccess && <p className="text-sm text-[var(--neon-green)] mb-2">{reportSuccess}</p>}
            <div className="flex gap-2 justify-end">
              <AnimatedButton variant="ghost" onClick={() => { setReportOpen(false); setReportError(''); setReportSuccess(''); setReportTargetUid(''); setReportReason(''); }}>
                Cancel
              </AnimatedButton>
              <AnimatedButton
                variant="red"
                disabled={reportSubmitting || !reportTargetUid.trim() || !reportReason.trim()}
                onClick={async () => {
                  setReportError('');
                  setReportSuccess('');
                  setReportSubmitting(true);
                  try {
                    await api.report({ targetUid: reportTargetUid.trim(), reason: reportReason.trim() });
                    setReportSuccess('Report submitted. Thank you.');
                    setReportTargetUid('');
                    setReportReason('');
                    setTimeout(() => setReportOpen(false), 1500);
                  } catch (err) {
                    setReportError(err.message || 'Failed to submit report');
                  } finally {
                    setReportSubmitting(false);
                  }
                }}
              >
                {reportSubmitting ? 'Submitting…' : 'Submit report'}
              </AnimatedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
