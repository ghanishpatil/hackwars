import { motion } from 'framer-motion';

const variants = {
  cyan: 'bg-[var(--neon-cyan)] text-[var(--bg-primary)] border-[var(--neon-cyan)] shadow-[0_0_20px_var(--glow-cyan)]',
  purple: 'bg-[var(--neon-purple)] text-white border-[var(--neon-purple)] shadow-[0_0_20px_var(--glow-purple)]',
  red: 'bg-[var(--neon-red)] text-white border-[var(--neon-red)] shadow-[0_0_20px_var(--glow-red)]',
  green: 'bg-[var(--neon-green)] text-[var(--bg-primary)] border-[var(--neon-green)] shadow-[0_0_20px_var(--glow-green)]',
  ghost: 'bg-transparent text-[var(--neon-cyan)] border-[var(--neon-cyan)]',
};

export function AnimatedButton({
  children,
  variant = 'cyan',
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  const base =
    'relative font-heading font-semibold px-6 py-3 rounded-lg border overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClass = variants[variant] || variants.cyan;

  return (
    <motion.button
      type={type}
      className={`${base} ${variantClass} ${className}`}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      {...props}
    >
      <motion.span
        className="absolute inset-0 bg-white/20"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.4 }}
        style={{ pointerEvents: 'none' }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
