import { NavLink, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'Dashboard' },
  { to: '/admin/matches', label: 'Matches', icon: 'Matches' },
  { to: '/admin/activity', label: 'User Activity', icon: 'UserActivity' },
  { to: '/admin/audit', label: 'Audit', icon: 'Audit' },
  { to: '/admin/reports', label: 'Reports', icon: 'Reports' },
  { to: '/admin/system', label: 'System', icon: 'System' },
];

function NavIcon({ name }) {
  const c = 'w-4 h-4';
  switch (name) {
    case 'Dashboard':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
      );
    case 'Matches':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      );
    case 'Users':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      );
    case 'UserActivity':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
      );
    case 'Audit':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
      );
    case 'Reports':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
      );
    case 'System':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      );
    default:
      return null;
  }
}

export function AdminNav() {
  const location = useLocation();

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1">
          {navItems.map(({ to, label, icon }) => {
            const isActive =
              to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="relative flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors"
              >
                <span
                  className={`flex items-center gap-2 ${
                    isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className={isActive ? 'text-[var(--neon-red)]' : 'text-[var(--text-muted)]'}>
                    <NavIcon name={icon} />
                  </span>
                  {label}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="admin-nav-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--neon-cyan)]"
                    style={{ boxShadow: '0 0 12px var(--glow-cyan)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
          <Link
            to="/dashboard"
            className="ml-auto font-mono text-xs text-[var(--text-muted)] hover:text-[var(--neon-cyan)] py-3 px-2 transition-colors"
          >
            ← Back to game
          </Link>
        </div>
      </div>
    </nav>
  );
}
