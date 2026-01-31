import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  const navItems = user ? getAuthNavItems(isAdmin, !!user.currentTeamId) : publicNavItems;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <NavLink to={user ? '/' : '/'} className="font-heading text-xl font-bold text-[var(--neon-cyan)] shrink-0">
          CTF_WAR
        </NavLink>

        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label }) => {
            const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            return (
              <NavLink key={to} to={to} className="relative px-4 py-2 text-sm font-medium">
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
                    layoutId="navbar-underline"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--neon-cyan)]"
                    style={{ boxShadow: '0 0 10px var(--glow-cyan)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
          {user && (
            <button
              type="button"
              onClick={() => signOut()}
              className="relative px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--neon-red)]"
            >
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
