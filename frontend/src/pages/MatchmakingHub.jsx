import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import {
  onChallengeReceived,
  offChallengeReceived,
  onChallengeAccepted,
  offChallengeAccepted,
  onChallengeDeclined,
  offChallengeDeclined,
} from '../socket/socket';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';

const DIFFICULTY_MAP = { beginner: 'easy', advanced: 'medium', expert: 'hard' };
const DIFFICULTY_LABELS = { beginner: 'Beginner', advanced: 'Advanced', expert: 'Expert' };
const MMR_RANGES = { any: null, '±200': 200, '±500': 500 };

export default function MatchmakingHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('solo');
  const [difficulty, setDifficulty] = useState('advanced');
  const [teamSize, setTeamSize] = useState(1);
  const [mmrFilter, setMmrFilter] = useState('±200');
  const [online, setOnline] = useState({ players: [], teams: [], onlineCount: 0 });
  const [loadingOnline, setLoadingOnline] = useState(true);
  const [queued, setQueued] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);
  const [queueTimer, setQueueTimer] = useState(0);
  const [challengeModal, setChallengeModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [profile, setProfile] = useState(null);
  const [team, setTeam] = useState(null);

  const difficultyValue = DIFFICULTY_MAP[difficulty] || 'medium';

  const fetchProfile = useCallback(async () => {
    try {
      const me = await api.getMe();
      setProfile(me);
      if (me.currentTeamId) {
        const t = await api.teams.get(me.currentTeamId).catch(() => null);
        setTeam(t);
      } else setTeam(null);
    } catch (_) {}
  }, []);

  const fetchOnline = useCallback(async () => {
    if (!user) return;
    setLoadingOnline(true);
    try {
      const mmr = profile?.mmr ?? 1000;
      const range = MMR_RANGES[mmrFilter];
      const params = { mode };
      if (range) {
        params.minMMR = mmr - range;
        params.maxMMR = mmr + range;
      }
      const data = await api.presence.online(params);
      setOnline(data);
    } catch (_) {
      setOnline({ players: [], teams: [], onlineCount: 0 });
    } finally {
      setLoadingOnline(false);
    }
  }, [user, mode, mmrFilter, profile?.mmr]);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const status = await api.getQueueStatus();
      setQueued(status.queued === true);
      setQueueStatus(status);
    } catch (_) {
      setQueued(false);
      setQueueStatus(null);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => api.presence.heartbeat('matchmaking'), 30_000);
    api.presence.heartbeat('matchmaking').catch(() => {});
    return () => clearInterval(interval);
  }, [user]);
  useEffect(() => { fetchOnline(); const id = setInterval(fetchOnline, 10_000); return () => clearInterval(id); }, [fetchOnline]);
  useEffect(() => { fetchQueueStatus(); const id = setInterval(fetchQueueStatus, 5_000); return () => clearInterval(id); }, [fetchQueueStatus]);
  useEffect(() => {
    if (!queued) setQueueTimer(0);
    else setQueueTimer((t) => t + 1);
  }, [queued]);
  useEffect(() => {
    if (!queued) return;
    const id = setInterval(() => setQueueTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [queued]);

  const handleEnterQueue = async () => {
    try {
      await api.joinQueue({ difficulty: difficultyValue, teamSize, mode });
      setQueued(true);
      setQueueTimer(0);
      fetchQueueStatus();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to join queue' });
    }
  };

  const handleLeaveQueue = async () => {
    try {
      await api.leaveQueue();
      setQueued(false);
      fetchQueueStatus();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to leave queue' });
    }
  };

  const handleChallenge = async (targetId, targetType) => {
    try {
      const res = await api.challenges.send({ targetId, targetType, difficulty: difficultyValue, teamSize });
      setToast({ type: 'success', message: 'Challenge sent!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to send challenge' });
    }
  };

  const handleAcceptChallenge = async (challengeId) => {
    try {
      const res = await api.challenges.respond(challengeId, 'accept');
      setChallengeModal(null);
      if (res.matchId) navigate(`/match/${res.matchId}`, { replace: true });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to accept' });
    }
  };

  const handleDeclineChallenge = async (challengeId) => {
    try {
      await api.challenges.respond(challengeId, 'decline');
      setChallengeModal(null);
    } catch (_) {}
  };

  useEffect(() => {
    const onReceived = (payload) => setChallengeModal(payload);
    const onAccepted = (payload) => {
      setToast({ type: 'success', message: 'Challenge accepted! Starting match...' });
      if (payload.matchId) navigate(`/match/${payload.matchId}`, { replace: true });
    };
    const onDeclined = (payload) => setToast({ type: 'info', message: payload.reason === 'expired' ? 'Challenge expired' : 'Challenge declined' });
    onChallengeReceived(onReceived);
    onChallengeAccepted(onAccepted);
    onChallengeDeclined(onDeclined);
    return () => {
      offChallengeReceived(onReceived);
      offChallengeAccepted(onAccepted);
      offChallengeDeclined(onDeclined);
    };
  }, [navigate]);

  useEffect(() => {
    if (!challengeModal) return;
    const expiresAt = challengeModal.expiresAt;
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAt * 1000 - Date.now()) / 1000));
      setChallengeModal((m) => (m ? { ...m, secondsLeft: left } : null));
      if (left <= 0) {
        setChallengeModal(null);
        setToast({ type: 'info', message: 'Challenge expired' });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [challengeModal?.challengeId]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const maxTeamSize = team?.maxSize ?? 1;
  const canQueueTeam = mode === 'team' && team && team.currentSize >= teamSize;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          {team ? (
            <>
              <span className="font-heading font-semibold text-[var(--text-primary)]">{team.name}</span>
              <span className="text-sm text-[var(--text-muted)]">{team.currentSize}/{team.maxSize} · {team.averageMMR ?? 0} MMR</span>
              <AnimatedButton variant="ghost" className="text-sm border-[var(--neon-red)] text-[var(--neon-red)]" onClick={() => api.teams.leave().then(() => fetchProfile())}>
                Leave team
              </AnimatedButton>
            </>
          ) : (
            <>
              <span className="font-heading font-semibold text-[var(--text-primary)]">{profile?.displayName || profile?.username || user?.email}</span>
              <span className="text-sm text-[var(--text-muted)]">{profile?.rank} · {profile?.mmr ?? 0} MMR</span>
            </>
          )}
        </div>
        <span className="font-mono text-sm text-[var(--neon-cyan)]">{online.onlineCount} online</span>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: settings */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-2"
        >
          <NeonCard glow="cyan" className="p-6 space-y-6">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">Match settings</h2>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">Mode</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 font-mono text-sm">
                  <input type="radio" name="mode" checked={mode === 'solo'} onChange={() => setMode('solo')} className="rounded" />
                  Solo
                </label>
                <label className="flex items-center gap-2 font-mono text-sm">
                  <input type="radio" name="mode" checked={mode === 'team'} onChange={() => setMode('team')} disabled={!team} className="rounded" />
                  Team {!team && '(join a team first)'}
                </label>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">Difficulty</p>
              <div className="flex gap-4 flex-wrap">
                {Object.keys(DIFFICULTY_LABELS).map((d) => (
                  <label key={d} className="flex items-center gap-2 font-mono text-sm">
                    <input type="radio" name="difficulty" checked={difficulty === d} onChange={() => setDifficulty(d)} className="rounded" />
                    {DIFFICULTY_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">Team size</p>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4].filter((s) => mode !== 'team' ? s === 1 : s <= maxTeamSize).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTeamSize(s)}
                    className={`px-3 py-1.5 rounded font-mono text-sm border ${teamSize === s ? 'border-[var(--neon-cyan)] text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                  >
                    {s}v{s}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-[var(--text-dim)]">Match duration: 30 min · 5 services per team</p>
            {queued ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-sm text-[var(--neon-amber)]">Searching for match... {queueTimer}s</p>
                <AnimatedButton variant="red" onClick={handleLeaveQueue}>Cancel queue</AnimatedButton>
              </div>
            ) : (
              <AnimatedButton
                variant="green"
                onClick={handleEnterQueue}
                disabled={mode === 'team' && !canQueueTeam}
              >
                Enter queue
              </AnimatedButton>
            )}
          </NeonCard>
        </motion.div>

        {/* Right: online list */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <NeonCard glow="red" className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-sm font-semibold text-[var(--text-primary)]">
                {mode === 'solo' ? 'Online players' : 'Online teams'}
              </h2>
              <select
                value={mmrFilter}
                onChange={(e) => setMmrFilter(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1 text-xs text-[var(--text-primary)]"
              >
                <option value="any">Any MMR</option>
                <option value="±200">±200 MMR</option>
                <option value="±500">±500 MMR</option>
              </select>
            </div>
            {loadingOnline ? (
              <p className="font-mono text-xs text-[var(--text-muted)]">Loading...</p>
            ) : mode === 'solo' ? (
              <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                {online.players.length === 0 ? (
                  <li className="text-sm text-[var(--text-muted)]">No players online</li>
                ) : (
                  online.players.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--border)] last:border-0">
                      <div>
                        <span className="font-mono text-sm text-[var(--text-primary)]">{p.name}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">{p.rank} · {p.mmr}</span>
                      </div>
                      <AnimatedButton variant="ghost" className="text-xs border-[var(--neon-red)] text-[var(--neon-red)] py-1" onClick={() => handleChallenge(p.id, 'solo')}>
                        Challenge
                      </AnimatedButton>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                {online.teams.length === 0 ? (
                  <li className="text-sm text-[var(--text-muted)]">No teams online</li>
                ) : (
                  online.teams.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--border)] last:border-0">
                      <div>
                        <span className="font-mono text-sm text-[var(--text-primary)]">{t.name}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">{t.memberCount} · {t.averageMMR} MMR</span>
                      </div>
                      <AnimatedButton variant="ghost" className="text-xs border-[var(--neon-red)] text-[var(--neon-red)] py-1" onClick={() => handleChallenge(t.id, 'team')}>
                        Challenge
                      </AnimatedButton>
                    </li>
                  ))
                )}
              </ul>
            )}
          </NeonCard>
        </motion.div>
      </div>

      {/* Challenge received modal */}
      {challengeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[var(--bg-secondary)] border border-[var(--neon-amber)] rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h2 className="font-heading text-lg font-semibold text-[var(--neon-amber)] mb-2">Challenge received</h2>
            <p className="text-sm text-[var(--text-primary)] mb-2">{challengeModal.from?.name} challenges you!</p>
            <p className="text-xs text-[var(--text-muted)] mb-2">{DIFFICULTY_LABELS[difficulty] || challengeModal.difficulty} · {challengeModal.teamSize}v{challengeModal.teamSize}</p>
            <p className="font-mono text-sm text-[var(--neon-cyan)] mb-4">{challengeModal.secondsLeft != null ? `${Math.floor(challengeModal.secondsLeft / 60)}:${String(challengeModal.secondsLeft % 60).padStart(2, '0')}` : '2:00'} remaining</p>
            <div className="flex gap-2">
              <AnimatedButton variant="green" className="flex-1" onClick={() => handleAcceptChallenge(challengeModal.challengeId)}>Accept</AnimatedButton>
              <AnimatedButton variant="red" className="flex-1" onClick={() => handleDeclineChallenge(challengeModal.challengeId)}>Decline</AnimatedButton>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded border bg-[var(--bg-secondary)] font-mono text-sm" style={{ borderColor: toast.type === 'error' ? 'var(--neon-red)' : toast.type === 'success' ? 'var(--neon-green)' : 'var(--neon-cyan)' }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
