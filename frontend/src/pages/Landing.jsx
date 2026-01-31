import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlitchTextStatic } from '../components/GlitchText';
import { AnimatedButton } from '../components/AnimatedButton';
import { LogoAnimation } from '../components/LogoAnimation';

const features = [
  { title: 'Ranked matchmaking', desc: 'Queue by difficulty. MMR-based teams.', accent: 'cyan' },
  { title: 'Live matches', desc: 'Attack & defend. Flags. Uptime scoring.', accent: 'purple' },
  { title: 'Cyber ranks', desc: 'Initiate to Zero-Day. Climb the ladder.', accent: 'green' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] bg-grid-cyber flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-24 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,229,255,0.08) 0%, transparent 50%)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative w-28 h-28 sm:w-36 sm:h-36 mb-10"
        >
          <LogoAnimation className="w-full h-full" />
        </motion.div>
        <motion.h1
          className="relative font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-center text-[var(--text-primary)] mb-5 tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <GlitchTextStatic className="text-[var(--neon-cyan)]">
            ATTACK & DEFEND
          </GlitchTextStatic>
        </motion.h1>
        <motion.p
          className="relative text-[var(--text-muted)] text-center max-w-lg mb-12 font-mono text-sm sm:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          Cyber warfare CTF. Real-time ranked matches. Capture flags, defend services, climb ranks.
        </motion.p>
        <motion.div
          className="relative flex flex-wrap gap-4 justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <Link to="/login">
            <AnimatedButton variant="cyan" className="text-base px-8 py-4 animate-pulse-glow">
              ENTER
            </AnimatedButton>
          </Link>
          <Link to="/signup">
            <AnimatedButton variant="ghost" className="text-base px-8 py-4">
              SIGN UP
            </AnimatedButton>
          </Link>
        </motion.div>
      </section>

      {/* Features strip */}
      <section className="relative border-t border-[var(--border)] bg-[var(--bg-secondary)]/50 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="font-heading text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            What you get
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 text-center"
                style={{ boxShadow: `0 0 24px -4px ${f.glow}` }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {f.title}
                </p>
                <p className="font-mono text-sm text-[var(--text-muted)]">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
