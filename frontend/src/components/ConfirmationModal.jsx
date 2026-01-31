import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton } from './AnimatedButton';

export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  danger = true,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-lg border bg-[var(--card-bg)] border-[var(--border)]"
            style={{
              boxShadow: danger
                ? '0 0 0 1px var(--border), 0 0 40px var(--glow-red)'
                : '0 0 0 1px var(--border), 0 0 40px var(--glow-cyan)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <h2 className="font-heading text-lg font-bold text-[var(--text-primary)] mb-2">
              {title}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
              <AnimatedButton variant="ghost" onClick={onClose}>
                Cancel
              </AnimatedButton>
              <AnimatedButton
                variant={danger ? 'red' : 'cyan'}
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
              >
                {confirmLabel}
              </AnimatedButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
