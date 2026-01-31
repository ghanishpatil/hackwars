import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';

function ShieldIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function formatTime() {
  const d = new Date();
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function AdminHeader({ engineStatus = 'unknown' }) {
  const { user, signOut } = useAuth();
  const [time, setTime] = useState(formatTime());

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  const connected = engineStatus === 'ok';

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/98 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-[var(--neon-red)] bg-[var(--neon-red)]/5">
              <ShieldIcon className="w-5 h-5 text-[var(--neon-red)]" />
            </div>
            <div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight">
                Admin Control Center
              </h1>
              <p className="font-mono text-xs text-[var(--text-muted)] hidden sm:block">
                CTF War · Admin Suite
              </p>
            </div>
          </div>

          {/* Right: Status, REAL-TIME, User, Logout, Time */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)]">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)]' : 'bg-[var(--neon-red)]'
                }`}
              />
              <span className="font-mono text-xs text-[var(--text-muted)]">
                {connected ? 'Backend: Connected' : 'Backend: Unreachable'}
              </span>
            </div>
            <span className="hidden md:inline font-mono text-xs text-[var(--neon-cyan)] px-2 py-1 rounded border border-[var(--neon-cyan)]/30 bg-[var(--neon-cyan)]/5">
              ((o)) REAL-TIME
            </span>
            <span className="font-mono text-xs text-[var(--text-muted)] hidden sm:inline">
              {user?.username ?? user?.email ?? 'Admin'}
            </span>
            <span className="font-heading text-sm font-semibold text-[var(--neon-red)] uppercase hidden sm:inline">
              Admin
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-heading text-sm font-semibold uppercase bg-[var(--neon-red)]/20 border border-[var(--neon-red)] text-[var(--neon-red)] hover:bg-[var(--neon-red)]/30 transition-colors"
            >
              <span>→</span> Logout
            </button>
            <span className="font-mono text-xs text-[var(--text-dim)] tabular-nums">
              {time}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
