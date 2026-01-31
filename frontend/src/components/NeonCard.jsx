import { motion } from 'framer-motion';

const glowMap = {
  cyan: 'var(--neon-cyan)',
  purple: 'var(--neon-purple)',
  red: 'var(--neon-red)',
  green: 'var(--neon-green)',
};

export function NeonCard({
  children,
  className = '',
  glow = 'cyan',
  hoverLift = true,
  ...props
}) {
  const color = glowMap[glow] || glowMap.cyan;

  return (
    <motion.div
      className={`rounded-lg border bg-[var(--card-bg)] border-[var(--border)] p-5 ${className}`}
      style={{
        boxShadow: `0 0 0 1px var(--border), 0 0 24px -4px ${color}40`,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={
        hoverLift
          ? {
              y: -4,
              boxShadow: `0 0 0 1px var(--border), 0 0 32px -2px ${color}60, 0 8px 24px -8px rgba(0,0,0,0.4)`,
            }
          : undefined
      }
      {...props}
    >
      {children}
    </motion.div>
  );
}
