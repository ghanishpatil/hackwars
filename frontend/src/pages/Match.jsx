import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NeonCard } from '../components/NeonCard';
import { connectMatchSocket, disconnectMatchSocket, joinMatch, onMatchState, offMatchState } from '../socket/socket';
import { auth } from '../firebase/config';

export default function Match() {
  const { matchId } = useParams();
  const [matchState, setMatchState] = useState(null);

  // Connect match socket only when on this page (not during login/signup)
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    auth.currentUser?.getIdToken().then((token) => {
      if (!cancelled) {
        connectMatchSocket(token);
        joinMatch(matchId);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
      disconnectMatchSocket();
    };
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    const handler = (payload) => {
      if (payload.matchId === matchId) {
        setMatchState(payload.state);
      }
    };
    onMatchState(handler);
    return () => offMatchState(handler);
  }, [matchId]);

  const stateLabel = matchState ?? 'connecting…';
  const stateColor =
    matchState === 'running' ? 'var(--neon-green)' :
    matchState === 'ended' ? 'var(--text-muted)' :
    'var(--neon-cyan)';

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">
          Match · {matchId?.slice(0, 16) ?? '—'}
        </h1>
        <div
          className="font-mono text-lg font-semibold px-4 py-2 rounded-lg border"
          style={{ color: stateColor, borderColor: stateColor }}
        >
          {stateLabel.toUpperCase()}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-4"
      >
        <NeonCard glow="cyan" className="p-6 text-center">
          <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Attack</p>
          <p className="font-heading text-4xl font-bold text-[var(--neon-cyan)]">0</p>
          <p className="font-mono text-xs text-[var(--text-dim)] mt-1">Scores stream from engine during match</p>
        </NeonCard>
        <NeonCard glow="red" className="p-6 text-center">
          <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Defense</p>
          <p className="font-heading text-4xl font-bold text-[var(--neon-red)]">0</p>
          <p className="font-mono text-xs text-[var(--text-dim)] mt-1">Scores stream from engine during match</p>
        </NeonCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <NeonCard glow="cyan" className="p-5">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">
            Event feed
          </h2>
          <p className="font-mono text-sm text-[var(--text-muted)]">
            {matchState === 'running'
              ? 'Live events appear here during the match.'
              : matchState === 'ended'
                ? 'Match ended.'
                : 'Waiting for match state…'}
          </p>
        </NeonCard>
      </motion.div>
    </div>
  );
}
