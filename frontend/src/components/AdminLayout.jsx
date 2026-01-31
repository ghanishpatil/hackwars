import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminNav } from './AdminNav';
import { adminApi } from '../api/client';

const pageVariants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

export function AdminLayout() {
  const location = useLocation();
  const [engineStatus, setEngineStatus] = useState('unknown');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminApi.getOverview();
      setEngineStatus(res?.engineHealth?.status === 'ok' ? 'ok' : 'unreachable');
    } catch {
      setEngineStatus('unreachable');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-grid-cyber">
      <AdminHeader engineStatus={engineStatus} />
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
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
      </main>
    </div>
  );
}
