import Lottie from 'lottie-react';
import { motion } from 'framer-motion';
import matchmakingSuccessAnimation from '../assets/matchmaking-success.json';

export function MatchmakingSuccessAnimation({ message = 'Match found! Preparing your game...' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center gap-6 p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        className="relative w-64 h-64 md:w-80 md:h-80"
        style={{ filter: 'drop-shadow(0 0 24px rgba(0, 255, 255, 0.5))' }}
      >
        <Lottie
          animationData={matchmakingSuccessAnimation}
          loop={false}
          className="w-full h-full"
        />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
        className="text-xl md:text-2xl font-heading font-semibold text-[var(--neon-cyan)] text-center"
      >
        {message}
      </motion.p>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="flex gap-2"
      >
        <div className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] animate-pulse" style={{ animationDelay: '0.4s' }} />
      </motion.div>
    </motion.div>
  );
}
