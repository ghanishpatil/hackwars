import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { api } from '../api/client';

const MMR_MAX = 2500;

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = () => {
    api.getMe().then((me) => { setProfile(me); setError(''); }).catch((err) => { setError(err.message || 'Failed to load dashboard'); setProfile(null); });
    api.getMatchHistory().then((history) => setMatchHistory(Array.isArray(history) ? history : [])).catch(() => setMatchHistory([]));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, history] = await Promise.all([api.getMe(), api.getMatchHistory().catch(() => [])]);
        if (!cancelled) {
          setProfile(me);
          setMatchHistory(Array.isArray(history) ? history : []);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load dashboard');
          setProfile(null);
          setMatchHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const interval = setInterval(fetchData, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <NeonCard glow="red" className="p-6">
          <p className="text-[var(--neon-red)]">{error}</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">Check your connection and try again.</p>
        </NeonCard>
      </div>
    );
  }

  const mmr = profile?.mmr ?? 1000;
  const progress = Math.min(100, (mmr / MMR_MAX) * 100);
  const displayName = profile?.displayName ?? profile?.username ?? 'Player';

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 sm:space-y-8">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <p className="font-mono text-sm text-[var(--text-muted)] mb-1">Welcome back</p>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{displayName}</h1>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <NeonCard glow="cyan" className="p-6">
            <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">Rank</p>
            <p className="font-heading text-2xl font-bold text-[var(--neon-cyan)]">{profile?.rank ?? 'Initiate'}</p>
            <p className="font-mono text-sm text-[var(--text-muted)] mt-2">
              {displayName} · {profile?.mmr ?? 1000} MMR
            </p>
            <div className="mt-4 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--neon-cyan)]"
                style={{ boxShadow: '0 0 10px var(--glow-cyan)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
            <p className="font-mono text-xs text-[var(--text-muted)] mt-2">
              {profile?.mmr ?? 1000} / {MMR_MAX} MMR · {profile?.rp ?? 0} RP
            </p>
          </NeonCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2 flex flex-col items-center justify-center gap-4">
          <NeonCard glow="green" className="w-full p-8 text-center">
            <p className="font-mono text-sm text-[var(--text-muted)] mb-4">Ready for battle? Go to Matchmaking to find a match or challenge others.</p>
            <Link to="/matchmaking">
              <AnimatedButton variant="green" className="text-lg px-8 py-4">MATCHMAKING</AnimatedButton>
            </Link>
          </NeonCard>
          {user?.currentTeamId && (
            <Link to="/team-setup" className="font-mono text-sm text-[var(--neon-cyan)] hover:underline">
              Team settings →
            </Link>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <NeonCard glow="cyan" className="p-5">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">Recent matches</h2>
            {matchHistory.length === 0 ? (
              <p className="font-mono text-sm text-[var(--text-muted)]">No matches yet. Join the queue and complete a match to see history here.</p>
            ) : (
              <ul className="space-y-2">
                {matchHistory.slice(0, 10).map((m) => (
                  <li key={m.matchId} className="flex items-center justify-between font-mono text-sm">
                    <span className="text-[var(--text-primary)]">{m.matchId.slice(0, 12)}…</span>
                    <span className={`${m.status === 'running' ? 'text-[var(--neon-green)]' : 'text-[var(--text-muted)]'}`}>{m.status}</span>
                    {m.status === 'running' && (
                      <Link to={`/match/${m.matchId}`} className="text-[var(--neon-cyan)] hover:underline ml-2">View</Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </NeonCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <NeonCard glow="cyan" className="p-5">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">System feed</h2>
            <p className="font-mono text-sm text-[var(--text-muted)]">
              Live events appear on the match page when you are in an active match. Open a match from Recent matches above to see the live feed.
            </p>
          </NeonCard>
        </motion.div>
      </div>
    </div>
  );
}
