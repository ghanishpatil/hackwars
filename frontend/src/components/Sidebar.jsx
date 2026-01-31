import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const adminNav = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/matches', label: 'Matches' },
  { to: '/admin/players', label: 'Players' },
  { to: '/admin/system', label: 'System' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 border-r border-[var(--border)] bg-[var(--bg-primary)] z-40">
      <div className="p-4 border-b border-[var(--border)]">
        <span className="font-heading font-bold text-[var(--neon-red)]">ADMIN</span>
      </div>
      <nav className="p-3 space-y-1">
        {adminNav.map(({ to, label }) => {
          const isActive = location.pathname === to || (to !== '/admin' && location.pathname.startsWith(to));
          return (
            <NavLink key={to} to={to} className="block">
              <motion.span
                className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[var(--neon-red)] bg-[var(--neon-red)]/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]'
                }`}
                style={
                  isActive
                    ? { boxShadow: 'inset 0 0 20px rgba(255,23,68,0.1)' }
                    : {}
                }
              >
                {label}
              </motion.span>
            </NavLink>
          );
        })}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <NavLink
          to="/dashboard"
          className="block text-xs font-mono text-[var(--text-muted)] hover:text-[var(--neon-cyan)] transition-colors"
        >
          ← Back to game
        </NavLink>
      </div>
    </aside>
  );
}
