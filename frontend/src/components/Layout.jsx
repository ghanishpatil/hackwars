import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from './Navbar';
import { AnnouncementBanner } from './AnnouncementBanner';
import { onAdminBroadcast, offAdminBroadcast } from '../socket/socket';

const pageVariants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

/**
 * Player layout. When a logged-in user hits "/", redirect to their dashboard by role:
 * admin → /admin, user → /dashboard.
 */
export function Layout() {
  const location = useLocation();
  const { user, isAdmin, loading } = useAuth();
  const [broadcastMessage, setBroadcastMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    const handler = (payload) => {
      if (payload?.message) setBroadcastMessage(String(payload.message).trim());
    };
    onAdminBroadcast(handler);
    return () => offAdminBroadcast(handler);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] bg-grid-cyber">
        <p className="font-mono text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (user && location.pathname === '/') {
    if (isAdmin) return <Navigate to="/admin" replace />;
    const skipTeam = typeof localStorage !== 'undefined' && localStorage.getItem('skipTeam') === 'true';
    if (!user.currentTeamId && !skipTeam) return <Navigate to="/team-setup" replace />;
    return <Navigate to="/matchmaking" replace />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-grid-cyber">
      <AnnouncementBanner />
      {broadcastMessage && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 py-2 bg-[var(--neon-amber)]/20 border-b border-[var(--neon-amber)] text-[var(--text-primary)]">
          <p className="font-mono text-sm flex-1">{broadcastMessage}</p>
          <button type="button" onClick={() => setBroadcastMessage('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono text-sm">Dismiss</button>
        </div>
      )}
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
