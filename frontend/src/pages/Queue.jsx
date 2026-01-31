import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'];
const TEAM_SIZES = [1, 2, 3];

export default function Queue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [teamSize, setTeamSize] = useState(1);

  const fetchStatus = async () => {
    try {
      const data = await api.getQueueStatus();
      setStatus(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load queue status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    fetchStatus();
  }, [user, navigate]);

  const handleJoin = async () => {
    setAction('join');
    setError('');
    try {
      await api.joinQueue({ difficulty, teamSize });
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Failed to join queue');
    } finally {
      setAction('');
    }
  };

  const handleLeave = async () => {
    setAction('leave');
    setError('');
    try {
      await api.leaveQueue();
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Failed to leave queue');
    } finally {
      setAction('');
    }
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-mono text-[var(--text-muted)]">Loading queue status…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--text-primary)]"
      >
        Queue
      </motion.h1>
      {error && (
        <NeonCard glow="red" className="p-4">
          <p className="text-sm text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      )}
      <NeonCard glow="cyan" className="p-6">
        {status?.queued ? (
          <div>
            <p className="font-mono text-[var(--neon-green)] font-medium mb-2">You are in queue.</p>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Difficulty: <span className="text-[var(--text-primary)]">{status.difficulty}</span>
              {' · '}
              Team size: <span className="text-[var(--text-primary)]">{status.teamSize}</span>
            </p>
            <AnimatedButton
              variant="red"
              onClick={handleLeave}
              disabled={!!action}
            >
              {action === 'leave' ? 'Leaving…' : 'Leave queue'}
            </AnimatedButton>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Select difficulty and team size, then join. When enough players are ready, a match will start.
            </p>
            <div className="flex flex-wrap gap-6 mb-6">
              <div>
                <label className="block text-xs font-mono text-[var(--text-muted)] mb-2 uppercase tracking-wider">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--neon-cyan)]"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-[var(--text-muted)] mb-2 uppercase tracking-wider">
                  Team size
                </label>
                <select
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-1 focus:ring-[var(--neon-cyan)]"
                >
                  {TEAM_SIZES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <AnimatedButton
              variant="cyan"
              onClick={handleJoin}
              disabled={!!action}
            >
              {action === 'join' ? 'Joining…' : 'Join queue'}
            </AnimatedButton>
          </div>
        )}
      </NeonCard>
    </div>
  );
}
