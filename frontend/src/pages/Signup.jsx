import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { updateProfile } from 'firebase/auth';
import { NeonCard } from '../components/NeonCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { useAuth } from '../hooks/useAuth';
import { setApiToken, api } from '../api/client';

const TRACK_OPTIONS = [
  'Cyber Security',
  'Web Security',
  'Forensics',
  'Reverse Engineering',
  'Cryptography',
  'Other',
];

export default function Signup() {
  const { signUp, auth } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [institute, setInstitute] = useState('');
  const [track, setTrack] = useState(TRACK_OPTIONS[0]);
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password);
      const fbUser = auth?.currentUser;
      if (fbUser) {
        if (displayName.trim()) {
          await updateProfile(fbUser, { displayName: displayName.trim() });
        }
        const idToken = await fbUser.getIdToken();
        setApiToken(idToken);
        await api.updateProfile({
          displayName: displayName.trim() || undefined,
          phone: phone.trim() || undefined,
          institute: institute.trim() || undefined,
          track: track.trim() || undefined,
        });
      }
      // Redirect to "/" so Layout sends new users to /team-setup or /matchmaking
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (f) =>
    `w-full rounded-lg border bg-[var(--bg-secondary)] px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] transition-all duration-300 ${
      focused === f ? 'border-[var(--neon-purple)] shadow-[0_0_20px_var(--glow-purple)]' : 'border-[var(--border)]'
    }`;
  const labelClass = 'block text-xs font-medium text-[var(--text-muted)] mb-2 font-mono';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-grid-cyber flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <NeonCard glow="purple" className="p-8">
          <h1 className="font-heading text-2xl font-bold text-[var(--neon-purple)] mb-2">
            /signup
          </h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Create an account. All fields are used in your profile and admin view.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="displayName" className={labelClass}>FULL NAME</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onFocus={() => setFocused('displayName')}
                onBlur={() => setFocused(null)}
                className={inputClass('displayName')}
                placeholder="e.g. Sahil Patole"
              />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>EMAIL</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                required
                className={inputClass('email')}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>PASSWORD</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                required
                className={inputClass('password')}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>PHONE</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onFocus={() => setFocused('phone')}
                onBlur={() => setFocused(null)}
                className={inputClass('phone')}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label htmlFor="institute" className={labelClass}>INSTITUTE</label>
              <input
                id="institute"
                type="text"
                value={institute}
                onChange={(e) => setInstitute(e.target.value)}
                onFocus={() => setFocused('institute')}
                onBlur={() => setFocused(null)}
                className={inputClass('institute')}
                placeholder="e.g. Sanjivani University"
              />
            </div>
            <div>
              <label htmlFor="track" className={labelClass}>TRACK / SPECIALIZATION</label>
              <select
                id="track"
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                onFocus={() => setFocused('track')}
                onBlur={() => setFocused(null)}
                className={inputClass('track')}
              >
                {TRACK_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p className="text-sm text-[var(--neon-red)]" role="alert">{error}</p>
            )}
            <AnimatedButton type="submit" variant="purple" className="w-full" disabled={loading}>
              {loading ? 'CREATING…' : 'CREATE ACCOUNT'}
            </AnimatedButton>
          </form>

          <p className="mt-6 text-xs text-[var(--text-muted)]">
            <Link to="/login" className="text-[var(--neon-purple)] hover:underline">
              Already have an account? Sign in
            </Link>
          </p>
        </NeonCard>
      </motion.div>
    </div>
  );
}
