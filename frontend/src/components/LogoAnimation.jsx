import { useRef } from 'react';
import Lottie from 'lottie-react';
import { motion } from 'framer-motion';

// Placeholder: no JSON file yet — render a styled logo block
const PLACEHOLDER_ANIMATION = null;

export function LogoAnimation({ className = '', lottieJson = null }) {
  const lottieRef = useRef(null);
  const data = lottieJson || PLACEHOLDER_ANIMATION;

  if (data) {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={data}
          loop
          className="w-full h-full"
        />
      </motion.div>
    );
  }

  // Placeholder: animated logo block
  return (
    <motion.div
      className={`flex items-center justify-center rounded-xl border-2 border-[var(--neon-cyan)] bg-[var(--card-bg)] ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        boxShadow: '0 0 40px var(--glow-cyan), inset 0 0 40px rgba(0,229,255,0.05)',
      }}
    >
      <motion.span
        className="font-heading text-2xl sm:text-3xl font-bold text-[var(--neon-cyan)]"
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        CTF_WAR
      </motion.span>
    </motion.div>
  );
}
