import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { useState, useEffect } from 'react';

export default function Home() {
  const { user, bannedMessage, clearBannedMessage } = useAuth();
  const [profile, setProfile] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [me, status] = await Promise.all([api.getMe(), api.getQueueStatus()]);
        if (!cancelled) {
          setProfile(me);
          setQueueStatus(status);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load');
          setProfile(null);
          setQueueStatus(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return (
      <div className="space-y-8">
        {bannedMessage && (
          <div className="panel p-4 border border-[var(--neon-red)] bg-[var(--neon-red)]/10 text-center">
            <p className="text-[var(--neon-red)] font-medium mb-2">{bannedMessage}</p>
            <button
              type="button"
              onClick={clearBannedMessage}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="panel p-8 text-center panel-glow">
          <h1 className="font-mono text-2xl font-bold text-[var(--accent)] mb-2">
            Attack &amp; Defense CTF
          </h1>
          <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
            Queue up, get matched, capture flags and defend your services. Rank up and compete.
          </p>
          <Link
            to="/login"
            className="inline-block rounded bg-[var(--accent)] px-6 py-2 text-sm font-medium text-[var(--bg-deep)] hover:bg-[var(--accent-dim)] transition-colors"
          >
            Sign in to play
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-sm text-[var(--text-muted)]">
          <div className="panel p-4">Queue by difficulty</div>
          <div className="panel p-4">Live match state</div>
          <div className="panel p-4">Rank &amp; MMR</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-xl font-semibold text-[var(--accent)] mb-4">/dashboard</h1>
        {error && (
          <div className="panel border-[var(--danger)]/50 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)] mb-4">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="panel p-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Rank</p>
            <p className="font-mono text-lg text-[var(--accent)] mt-1">{profile?.rank ?? '—'}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">MMR</p>
            <p className="font-mono text-lg text-[var(--text)] mt-1">{profile?.mmr ?? '—'}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">RP</p>
            <p className="font-mono text-lg text-[var(--text)] mt-1">{profile?.rp ?? '—'}</p>
          </div>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-[var(--text-muted)] mb-2">Queue status</p>
          {queueStatus?.queued ? (
            <p className="text-[var(--success)]">
              In queue — {queueStatus.difficulty} / team size {queueStatus.teamSize}
              <br />
              <Link to="/queue" className="text-[var(--accent)] hover:underline text-sm mt-1 inline-block">Manage queue →</Link>
            </p>
          ) : (
            <p className="text-[var(--text-muted)]">
              Not in queue. <Link to="/queue" className="text-[var(--accent)] hover:underline">Join queue →</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
