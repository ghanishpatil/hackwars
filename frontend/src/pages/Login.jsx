import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { setApiToken } from '../api/client';
import { api } from '../api/client';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';

export default function Login() {
  const { signIn, auth, bannedMessage, clearBannedMessage } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bannedMessage) setError('');
  }, [bannedMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    clearBannedMessage();
    setLoading(true);
    try {
      await signIn(email, password);
      const fbUser = auth?.currentUser;
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setApiToken(idToken);
        const profile = await api.getMe();
        const isAdmin = profile?.role === 'admin';
        // Non-admin: go to "/" so Layout redirects to /team-setup or /matchmaking
        navigate(isAdmin ? '/admin' : '/', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-grid-cyber flex items-center justify-center px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {bannedMessage && (
          <NeonCard glow="red" className="p-4 mb-4">
            <p className="text-sm text-[var(--neon-red)]" role="alert">{bannedMessage}</p>
            <button
              type="button"
              onClick={clearBannedMessage}
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Dismiss
            </button>
          </NeonCard>
        )}
        <NeonCard glow="cyan" className="p-8">
          <h1 className="font-heading text-2xl font-bold text-[var(--neon-cyan)] mb-2">
            /login
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Authenticate to enter the wargame.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[var(--text-muted)] mb-2 font-mono"
              >
                EMAIL
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                required
                className={`w-full rounded-lg border bg-[var(--bg-secondary)] px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] transition-all duration-300 ${
                  focused === 'email'
                    ? 'border-[var(--neon-cyan)] shadow-[0_0_20px_var(--glow-cyan)]'
                    : 'border-[var(--border)]'
                }`}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--text-muted)] mb-2 font-mono"
              >
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                required
                className={`w-full rounded-lg border bg-[var(--bg-secondary)] px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] transition-all duration-300 ${
                  focused === 'password'
                    ? 'border-[var(--neon-cyan)] shadow-[0_0_20px_var(--glow-cyan)]'
                    : 'border-[var(--border)]'
                }`}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--neon-red)]" role="alert">{error}</p>
            )}
            <AnimatedButton type="submit" variant="cyan" className="w-full" disabled={loading}>
              {loading ? 'SIGNING IN…' : 'SIGN IN'}
            </AnimatedButton>
          </form>

          <p className="mt-6 text-xs text-[var(--text-muted)]">
            <Link to="/" className="text-[var(--neon-cyan)] hover:underline">
              ← Back
            </Link>
            {' · '}
            <Link to="/signup" className="text-[var(--neon-cyan)] hover:underline">
              Sign up
            </Link>
          </p>
        </NeonCard>
      </motion.div>
    </div>
  );
}
