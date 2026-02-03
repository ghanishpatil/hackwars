import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from './Navbar';
import { AnnouncementBanner } from './AnnouncementBanner';

const pageVariants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

/**
 * Player layout. When a logged-in user hits "/", redirect to their dashboard by role:
 * admin → /admin, user → /dashboard.
 * No sockets used here; they are connected only on MatchmakingHub and Match pages.
 */
export function Layout() {
  const location = useLocation();
  const { user, isAdmin, loading } = useAuth();

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
    <div className="min-h-screen min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[var(--bg-primary)] bg-grid-cyber flex flex-col">
      <AnnouncementBanner />
      <Navbar />
      <main className="flex-1 pt-14 sm:pt-20 pb-8 sm:pb-12 min-h-0 w-full">
        <div className="w-full max-w-[100vw] max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 box-border">
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
