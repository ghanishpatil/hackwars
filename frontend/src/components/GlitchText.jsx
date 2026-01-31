import { motion } from 'framer-motion';

export function GlitchText({ children, className = '' }) {
  return (
    <motion.span
      className={`inline-block font-heading font-bold tracking-tight ${className}`}
      whileHover={{ scale: 1.02 }}
      style={{
        textShadow: '0 0 20px var(--glow-cyan), 0 0 40px var(--glow-cyan)',
      }}
    >
      <motion.span
        className="block"
        animate={{
          x: [0, -2, 2, -1, 0],
          y: [0, 2, -2, 1, 0],
        }}
        transition={{
          duration: 0.4,
          repeat: Infinity,
          repeatType: 'reverse',
          repeatDelay: 2,
        }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

export function GlitchTextStatic({ children, className = '' }) {
  return (
    <span
      className={`font-heading font-bold tracking-tight glitch-hover ${className}`}
      style={{
        textShadow: '0 0 20px var(--glow-cyan), 0 0 40px var(--glow-cyan)',
      }}
    >
      {children}
    </span>
  );
}
