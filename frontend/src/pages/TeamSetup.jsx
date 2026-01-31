import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { api } from '../api/client';

const SKIP_KEY = 'skipTeam';

export default function TeamSetup() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [maxSize, setMaxSize] = useState(2);
  const [inviteCode, setInviteCode] = useState('');
  const [createdInviteCode, setCreatedInviteCode] = useState('');
  const [createdTeamName, setCreatedTeamName] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    const name = teamName.trim();
    if (name.length < 3 || name.length > 20) {
      setError('Team name must be 3-20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(name)) {
      setError('Team name must be alphanumeric only.');
      return;
    }
    setLoading('Creating team...');
    try {
      const team = await api.teams.create({ teamName: name, maxSize });
      setCreatedInviteCode(team.inviteCode || '');
      setCreatedTeamName(team.name || name);
      setCreateOpen(false);
      setSuccessOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to create team');
    } finally {
      setLoading('');
    }
  };

  const handleJoin = async () => {
    setError('');
    const code = inviteCode.trim().toUpperCase().replace(/\s/g, '');
    if (code.length !== 6) {
      setError('Invite code must be 6 characters.');
      return;
    }
    setLoading('Joining team...');
    try {
      await api.teams.join({ inviteCode: code });
      setJoinOpen(false);
      setInviteCode('');
      navigate('/matchmaking', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to join team');
    } finally {
      setLoading('');
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(SKIP_KEY, 'true');
    } catch (_) {}
    navigate('/matchmaking', { replace: true });
  };

  const handleSuccessContinue = () => {
    setSuccessOpen(false);
    navigate('/matchmaking', { replace: true });
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <NeonCard glow="cyan" className="p-8">
          <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
            Team setup
          </h1>
          <p className="text-sm text-[var(--text-muted)] text-center mb-8">
            Create a team, join with a code, or play solo.
          </p>

          <div className="space-y-4">
            <AnimatedButton
              variant="cyan"
              className="w-full py-4"
              onClick={() => { setCreateOpen(true); setError(''); setTeamName(''); setMaxSize(2); }}
            >
              Create team
            </AnimatedButton>
            <AnimatedButton
              variant="ghost"
              className="w-full py-4 border-[var(--neon-green)] text-[var(--neon-green)]"
              onClick={() => { setJoinOpen(true); setError(''); setInviteCode(''); }}
            >
              Join team
            </AnimatedButton>
            <AnimatedButton
              variant="ghost"
              className="w-full py-4 border-[var(--text-muted)] text-[var(--text-muted)]"
              onClick={handleSkip}
            >
              Skip — Play solo
            </AnimatedButton>
          </div>
        </NeonCard>
      </motion.div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setCreateOpen(false)}>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">Create team</h2>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name (3-20 alphanumeric)"
              maxLength={20}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] mb-4"
            />
            <p className="text-xs text-[var(--text-muted)] mb-2">Max team size</p>
            <div className="flex gap-2 mb-4">
              {[2, 3, 4].map((n) => (
                <label key={n} className="flex items-center gap-1 font-mono text-sm">
                  <input type="radio" name="maxSize" checked={maxSize === n} onChange={() => setMaxSize(n)} className="rounded" />
                  {n}
                </label>
              ))}
            </div>
            {error && <p className="text-sm text-[var(--neon-red)] mb-2">{error}</p>}
            {loading && <p className="text-sm text-[var(--text-muted)] mb-2">{loading}</p>}
            <div className="flex gap-2 justify-end">
              <AnimatedButton variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</AnimatedButton>
              <AnimatedButton variant="cyan" onClick={handleCreate} disabled={!!loading}>Create</AnimatedButton>
            </div>
          </div>
        </div>
      )}

      {/* Join modal */}
      {joinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setJoinOpen(false)}>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">Join team</h2>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="6-character code"
              maxLength={6}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-lg tracking-widest text-center text-[var(--text-primary)] mb-4"
            />
            {error && <p className="text-sm text-[var(--neon-red)] mb-2">{error}</p>}
            {loading && <p className="text-sm text-[var(--text-muted)] mb-2">{loading}</p>}
            <div className="flex gap-2 justify-end">
              <AnimatedButton variant="ghost" onClick={() => setJoinOpen(false)}>Cancel</AnimatedButton>
              <AnimatedButton variant="green" onClick={handleJoin} disabled={!!loading || inviteCode.trim().length !== 6}>Join</AnimatedButton>
            </div>
          </div>
        </div>
      )}

      {/* Success modal (invite code) */}
      {successOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setSuccessOpen(false)}>
          <div className="bg-[var(--bg-secondary)] border border-[var(--neon-cyan)] rounded-lg p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-semibold text-[var(--neon-cyan)] mb-2">Team created</h2>
            <p className="text-sm text-[var(--text-muted)] mb-2">{createdTeamName}</p>
            <p className="text-xs text-[var(--text-muted)] mb-1">Invite code (share with teammates):</p>
            <p className="font-mono text-2xl font-bold tracking-widest text-[var(--neon-cyan)] mb-4">{createdInviteCode}</p>
            <AnimatedButton variant="cyan" className="w-full" onClick={handleSuccessContinue}>Continue to matchmaking</AnimatedButton>
          </div>
        </div>
      )}
    </div>
  );
}
