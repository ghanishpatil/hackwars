import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton } from '../components/AnimatedButton';
import { NetworkBackground } from '../components/NetworkBackground';
import { api } from '../api/client';

const DEFAULT_MISSIONS = [
  { id: 'mission-exploit', title: 'Mission Exploit', tag: 'Coming soon', description: '', images: [] },
  { id: 'mission-exploit-2', title: 'Mission Exploit 2.0', tag: 'Coming soon', description: '', images: [] },
];

const features = [
  {
    title: 'Ranked matchmaking',
    desc: 'Queue by difficulty. MMR-based teams. Solo or with your squad.',
    icon: '◈',
  },
  {
    title: 'Attack & defend',
    desc: 'Live matches, capture flags, defend services. Uptime scoring.',
    icon: '◆',
  },
  {
    title: 'Climb the ranks',
    desc: 'From Initiate to Zero-Day. Earn RP, unlock achievements.',
    icon: '◇',
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

export default function Landing() {
  const [expandedMission, setExpandedMission] = useState(null);
  const [missions, setMissions] = useState(DEFAULT_MISSIONS);

  useEffect(() => {
    api.getLandingMissions()
      .then((data) => Array.isArray(data) && data.length > 0 ? setMissions(data) : null)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-[100vh] min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[var(--bg-primary)] flex flex-col">
      {/* Network background — full viewport */}
      <div className="fixed inset-0 z-0">
        <NetworkBackground />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 20%, transparent 0%, var(--bg-primary) 70%)',
          }}
        />
      </div>

      {/* Hero: fills viewport, two columns on lg */}
      <section className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8 xl:gap-12 px-4 sm:px-6 py-16 sm:py-20 lg:py-12">
        <motion.div
          className="flex-1 w-full max-w-xl lg:max-w-none text-center lg:text-left min-w-0"
          initial="initial"
          animate="animate"
          variants={{
            animate: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
          }}
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card-bg)]/70 px-3 py-1.5 sm:px-4 sm:py-2 mb-4 sm:mb-6 backdrop-blur-sm"
          >
            <img src="/csbc-logo.png" alt="" className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
            <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Powered by CSBC
            </span>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] tracking-tight mb-3 sm:mb-5 leading-tight"
          >
            <span className="text-[var(--neon-cyan)]">Hackwars</span>
            <br className="sm:hidden" />
            <span className="sm:ml-1">— Attack & Defend CTF</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="text-[var(--text-muted)] text-sm sm:text-base lg:text-lg max-w-lg mx-auto lg:mx-0 mb-6 sm:mb-10 leading-relaxed"
          >
            Real-time cyber warfare. Queue up, get matched, capture flags and defend your services. Brought to you by CSBC—your partner for a more engaged security community.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-2 sm:gap-3 justify-center lg:justify-start"
          >
            <Link to="/login">
              <AnimatedButton variant="cyan" className="min-w-[140px] sm:min-w-[160px] text-sm sm:text-base">
                Join a match →
              </AnimatedButton>
            </Link>
            <Link to="/signup">
              <AnimatedButton variant="ghost" className="min-w-[140px] sm:min-w-[160px] text-sm sm:text-base border-[var(--neon-amber)] text-[var(--neon-amber)] hover:bg-[var(--neon-amber)]/10">
                Create account
              </AnimatedButton>
            </Link>
          </motion.div>
        </motion.div>

        {/* Mascot — right side */}
        <motion.div
          className="flex-1 w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[360px] flex items-end justify-center lg:justify-end min-h-[200px] sm:min-h-[260px] lg:min-h-[320px] shrink-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="relative w-full aspect-[3/4] flex items-end justify-center overflow-visible max-h-[320px] lg:max-h-[380px]">
            <motion.img
              src="/mascot.png"
              alt="Hackwars mascot"
              className="relative w-full h-full object-contain object-bottom drop-shadow-2xl origin-bottom"
              style={{
                filter: 'drop-shadow(0 0 28px rgba(0, 230, 118, 0.25))',
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                y: [0, -12, 0],
                scale: 1.3,
              }}
              transition={{
                opacity: { duration: 0.4, delay: 0.25 },
                y: {
                  duration: 2.8,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'easeInOut',
                },
              }}
            />
          </div>
        </motion.div>
      </section>

      {/* Missions — Mission Exploit & 2.0 placeholders */}
      <section className="relative z-10 border-t border-[var(--border)] py-12 sm:py-16 px-4 sm:px-6">
        <div className="w-full max-w-5xl mx-auto">
          <motion.h2
            className="font-heading text-lg sm:text-xl font-semibold text-[var(--text-muted)] text-center uppercase tracking-wider mb-10 sm:mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
          >
            Featured missions
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {missions.map((mission, i) => (
              <motion.article
                key={mission.id}
                role="button"
                tabIndex={0}
                onClick={() => setExpandedMission(mission.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedMission(mission.id); } }}
                className="group relative rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]/60 backdrop-blur-sm overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: i * 0.15, ease: 'easeOut' }}
                whileHover={{
                  y: -4,
                  transition: { duration: 0.25 },
                  boxShadow: '0 12px 40px -12px rgba(0, 229, 255, 0.2), 0 0 0 1px rgba(0, 229, 255, 0.1)',
                }}
              >
                {/* Photo: first image or placeholder */}
                <motion.div
                  className="relative aspect-[16/10] w-full bg-[var(--bg-secondary)] flex items-center justify-center border-b border-[var(--border)] overflow-hidden"
                  initial={{ opacity: 0.6 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.15 + 0.1 }}
                >
                  {mission.images?.length > 0 ? (
                    <img
                      src={mission.images[0].url}
                      alt={mission.images[0].alt || mission.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-[var(--neon-cyan)]/5 to-[var(--neon-purple)]/5"
                        animate={{ opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span className="relative font-mono text-xs sm:text-sm text-[var(--text-dim)] uppercase tracking-widest">
                        {mission.title} — Image
                      </span>
                    </>
                  )}
                  <span className="absolute top-2 right-2 rounded-full bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/40 px-2 py-0.5 font-mono text-[10px] text-[var(--neon-cyan)] uppercase tracking-wider">
                    {mission.tag}
                  </span>
                </motion.div>
                {/* Info */}
                <motion.div
                  className="p-4 sm:p-5"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.15 + 0.2 }}
                >
                  <h3 className="font-heading text-lg sm:text-xl font-semibold text-[var(--text-primary)] mb-2">
                    {mission.title}
                  </h3>
                  <p className="font-mono text-sm text-[var(--text-muted)] leading-relaxed line-clamp-2">
                    {mission.description || 'Mission details and description will appear here. Placeholder for info content.'}
                  </p>
                  <p className="mt-2 font-mono text-xs text-[var(--neon-cyan)] opacity-80">Click to expand →</p>
                </motion.div>
              </motion.article>
            ))}
          </div>

          {/* Floating modal — expanded mission (multiple photos + info) */}
          <AnimatePresence>
            {expandedMission && (
              <>
                <motion.div
                  className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setExpandedMission(null)}
                  aria-hidden
                />
                <motion.div
                  className="fixed inset-4 sm:inset-6 md:inset-8 z-[101] flex items-center justify-center p-2 sm:p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const mission = missions.find((m) => m.id === expandedMission);
                      if (!mission) return null;
                      const sortedImages = [...(mission.images || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                      return (
                        <>
                          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--card-bg)]/95 backdrop-blur-md">
                            <h2 className="font-heading text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                              {mission.title}
                            </h2>
                            <motion.button
                              type="button"
                              onClick={() => setExpandedMission(null)}
                              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-cyan)]"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              aria-label="Close"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </motion.button>
                          </div>
                          <div className="p-4 sm:p-6 space-y-6">
                            {/* Photos — flexible count */}
                            <div>
                              <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
                                Photos
                              </p>
                              {sortedImages.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                                  {sortedImages.map((img, n) => (
                                    <motion.div
                                      key={n}
                                      className="aspect-square rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] overflow-hidden"
                                      initial={{ opacity: 0, y: 12 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: n * 0.05, duration: 0.3 }}
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.alt || `${mission.title} photo ${n + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </motion.div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/30 p-6 text-center">
                                  <p className="font-mono text-xs text-[var(--text-dim)]">No photos yet. Add images in Admin → Landing.</p>
                                </div>
                              )}
                            </div>
                            {/* Info */}
                            <div>
                              <p className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
                                Info
                              </p>
                              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4 sm:p-5">
                                <p className="font-mono text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
                                  {mission.description || 'Mission details and description will appear here. Update in Admin → Landing.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Features — compact, less scroll */}
      <section className="relative z-10 border-t border-[var(--border)] bg-[var(--bg-secondary)]/40 py-10 sm:py-14 px-4 sm:px-6">
        <div className="w-full max-w-4xl mx-auto">
          <motion.h2
            className="font-heading text-base sm:text-lg font-semibold text-[var(--text-muted)] text-center uppercase tracking-wider mb-8 sm:mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-20px' }}
          >
            What you get
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {features.map((item, i) => (
              <motion.article
                key={item.title}
                className="relative rounded-lg border border-[var(--border)] bg-[var(--card-bg)]/80 p-4 sm:p-5 text-left backdrop-blur-sm"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
              >
                <span className="absolute top-3 left-3 font-mono text-xs text-[var(--neon-cyan)] opacity-80" aria-hidden>
                  {item.icon}
                </span>
                <h3 className="font-heading text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-1.5 pl-6">
                  {item.title}
                </h3>
                <p className="font-mono text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed pl-6">
                  {item.desc}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Footer — compact */}
      <footer className="relative z-10 border-t border-[var(--border)] py-4 sm:py-6 px-4 sm:px-6">
        <div className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/csbc-logo.png" alt="CSBC" className="h-5 w-5 object-contain opacity-80" />
            <p className="font-mono text-xs text-[var(--text-dim)]">
              Hackwars powered by CSBC
            </p>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6">
            <Link to="/login" className="font-mono text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--neon-cyan)] transition-colors">
              Sign in
            </Link>
            <Link to="/signup" className="font-mono text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--neon-cyan)] transition-colors">
              Sign up
            </Link>
            <Link to="/rankings" className="font-mono text-xs sm:text-sm text-[var(--text-muted)] hover:text-[var(--neon-cyan)] transition-colors">
              Rankings
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
