import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

const publicNavItems = [
  { to: '/', label: 'Home' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/login', label: 'Login' },
];

function getAuthNavItems(isAdmin, hasTeam) {
  const base = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/matchmaking', label: 'Matchmaking' },
    { to: '/profile', label: 'Profile' },
    { to: '/rankings', label: 'Rankings' },
  ];
  if (hasTeam) {
    base.splice(2, 0, { to: '/team-setup', label: 'Team' });
  }
  if (isAdmin) {
    base.push({ to: '/admin', label: 'Admin' });
  }
  return base;
}

export function Navbar() {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = user ? getAuthNavItems(isAdmin, !!user.currentTeamId) : publicNavItems;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full min-w-0 rounded-b-2xl border-b border-[var(--border)]/50 bg-[var(--bg-primary)]/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
      style={{
        background: 'linear-gradient(180deg, rgba(10, 15, 28, 0.6) 0%, rgba(10, 15, 28, 0.25) 70%, transparent 100%)',
      }}
    >
      <div className="w-full max-w-[100vw] mx-auto px-3 sm:px-4 md:px-6 flex items-center justify-between h-14 sm:h-16 gap-2">
        <NavLink
          to="/"
          className="flex items-center gap-2 shrink-0 min-w-0"
          onClick={() => setMenuOpen(false)}
        >
          <motion.img
            src="/csbc-logo.png"
            alt="CSBC"
            className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          />
          <motion.span
            className="font-heading text-lg sm:text-xl font-bold text-[var(--neon-cyan)] truncate"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            Hackwars
          </motion.span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-0.5 flex-wrap justify-end">
          {navItems.map(({ to, label }) => {
            const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <NavLink key={to} to={to} className="relative block shrink-0">
                <motion.span
                  className="relative block px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium shrink-0"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <span
                    className={
                      isActive
                        ? 'text-[var(--neon-cyan)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }
                  >
                    {label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="navbar-pill"
                      className="absolute inset-0 rounded-xl bg-[var(--neon-cyan)]/15 border border-[var(--neon-cyan)]/30 -z-10"
                      style={{ boxShadow: '0 0 20px rgba(0, 229, 255, 0.15)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.span>
              </NavLink>
            );
          })}
          {user && (
            <motion.button
              type="button"
              onClick={() => signOut()}
              className="relative block px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[var(--text-muted)] hover:text-[var(--neon-red)] shrink-0"
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 23, 68, 0.08)' }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              Logout
            </motion.button>
          )}
        </nav>

        {/* Mobile menu button */}
        <motion.button
          type="button"
          className="sm:hidden flex flex-col gap-1.5 p-2.5 rounded-xl text-[var(--text-primary)] hover:bg-[var(--card-bg)]/50"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <span className={`w-5 h-0.5 bg-current transition-transform duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-0.5 bg-current transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-0.5 bg-current transition-transform duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </motion.button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="sm:hidden border-t border-[var(--border)]/50 bg-[var(--bg-primary)]/30 backdrop-blur-lg overflow-hidden rounded-b-2xl"
          >
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                      ? 'text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]/50'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </NavLink>
              ))}
              {user && (
                <button
                  type="button"
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium text-left text-[var(--neon-red)] hover:bg-[var(--neon-red)]/10 transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
