import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { adminApi } from '../api/client';

export default function AdminMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    setError('');
    adminApi
      .getMatch(matchId)
      .then(setMatch)
      .catch((err) => setError(err.message || 'Failed to load match'))
      .finally(() => setLoading(false));
  }, [matchId]);

  const doAction = (label, fn) => {
    setActionLoading(label);
    fn()
      .then(() => setMatch(null))
      .then(() => adminApi.getMatch(matchId).then(setMatch))
      .catch((err) => setError(err.message || 'Action failed'))
      .finally(() => setActionLoading(''));
  };

  if (loading && !match) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-2xl font-bold text-[var(--neon-red)]">Match</h1>
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className="space-y-8">
        <button type="button" onClick={() => navigate('/admin/matches')} className="text-sm text-[var(--text-muted)] hover:text-[var(--neon-red)]">
          ← Back to matches
        </button>
        <NeonCard glow="red" className="p-6">
          <p className="text-[var(--neon-red)]">{error}</p>
        </NeonCard>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="space-y-8">
        <button type="button" onClick={() => navigate('/admin/matches')} className="text-sm text-[var(--text-muted)] hover:text-[var(--neon-red)]">
          ← Back to matches
        </button>
        <p className="font-mono text-[var(--text-muted)]">Match not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <button
          type="button"
          onClick={() => navigate('/admin/matches')}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--neon-red)]"
        >
          ← Back to matches
        </button>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-heading text-2xl font-bold text-[var(--neon-red)]"
      >
        Match {match.matchId}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <NeonCard glow="red" className="p-5 space-y-2">
          <p><span className="text-[var(--text-muted)]">Status:</span> {match.status}</p>
          <p><span className="text-[var(--text-muted)]">Engine state:</span> {match.engineState ?? 'unknown'}</p>
          <p><span className="text-[var(--text-muted)]">Difficulty:</span> {match.difficulty}</p>
          <p><span className="text-[var(--text-muted)]">Team size:</span> {match.teamSize}</p>
          <p><span className="text-[var(--text-muted)]">Invalid (no rank update):</span> {match.invalid ? 'Yes' : 'No'}</p>
          {match.result && (
            <p><span className="text-[var(--text-muted)]">Result:</span> {JSON.stringify(match.result)}</p>
          )}
        </NeonCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-3"
      >
        <AnimatedButton
          variant="red"
          disabled={!!actionLoading}
          onClick={() => doAction('stop', () => adminApi.stopMatch(matchId))}
        >
          {actionLoading === 'stop' ? 'Stopping…' : 'Force stop match'}
        </AnimatedButton>
        <AnimatedButton
          variant="ghost"
          className="border-[var(--neon-amber)] text-[var(--neon-amber)]"
          disabled={!!actionLoading}
          onClick={() => doAction('invalid', () => adminApi.markMatchInvalid(matchId))}
        >
          {actionLoading === 'invalid' ? 'Updating…' : 'Mark match invalid'}
        </AnimatedButton>
      </motion.div>
    </div>
  );
}
