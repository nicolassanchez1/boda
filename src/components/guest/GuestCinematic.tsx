'use client';

// Cinematic intro for the guest invitation.
//
// Scroll-scrubbed 118-frame sequence (see /frames/) with four text beats:
//   1.  0–25%   "Nos vamos a casar"
//   2. 25–60%   "queremos que seas parte de esto"
//   3. 60–90%   <guest name> + wedding date / venue
//   4. 90–100%  CTA → scroll into the RSVP section below
//
// Each text block sits inside a translucent dark card (bg-ink/40 + backdrop-blur)
// so it stays readable on top of the busy frame imagery. Accents use the admin
// palette (terracotta) instead of gold so the guest view stays cohesive with
// the rest of the app.

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import MotoScroll from '@/components/MotoScroll';

type Props = {
  guestName: string;
  cupos: number;
  weddingInfo: { date: string; time: string; venue: string };
  rsvpAnchorId: string;
};

const FADE = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };

// Reusable frosted card behind any overlay text block.
function OverlayCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block bg-ink/55 backdrop-blur-md border border-white/10 rounded-3xl px-6 sm:px-10 py-6 sm:py-8 shadow-lift">
      {children}
    </div>
  );
}

export default function GuestCinematic({
  guestName,
  cupos,
  weddingInfo,
  rsvpAnchorId,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // Phase opacity + slight y for each text beat.
  const phase1Opacity = useTransform(
    scrollYProgress,
    [0, 0.05, 0.2, 0.25],
    [1, 1, 1, 0],
  );
  const phase1Y = useTransform(scrollYProgress, [0, 0.25], [0, -30]);

  const phase2Opacity = useTransform(
    scrollYProgress,
    [0.22, 0.28, 0.55, 0.62],
    [0, 1, 1, 0],
  );
  const phase2Y = useTransform(scrollYProgress, [0.22, 0.62], [40, -40]);

  const phase3Opacity = useTransform(
    scrollYProgress,
    [0.58, 0.65, 0.85, 0.9],
    [0, 1, 1, 0],
  );
  const phase3Y = useTransform(scrollYProgress, [0.58, 0.9], [40, -40]);

  const phase4Opacity = useTransform(
    scrollYProgress,
    [0.88, 0.94, 0.99, 1],
    [0, 1, 1, 0.5],
  );
  const phase4Y = useTransform(scrollYProgress, [0.88, 1], [40, 0]);

  const railVisible = useTransform(
    scrollYProgress,
    [0, 0.02, 0.98, 1],
    [0, 1, 1, 0],
  );
  const railHeight = useTransform(scrollYProgress, [0.02, 0.98], ['0%', '100%']);

  const scrollToRsvp = () => {
    document.getElementById(rsvpAnchorId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={ref} className="relative bg-black">
      <MotoScroll totalFrames={118} showFrameCounter={false} />

      {/* Phase 1: "Nos vamos a casar" */}
      <motion.div
        style={{ opacity: phase1Opacity, y: phase1Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <OverlayCard>
          <div className="text-center">
            <p className="eyebrow text-terracotta mb-3">Una invitación</p>
            <h2 className="display-xl text-5xl sm:text-7xl md:text-8xl text-white leading-[0.95]">
              Nos vamos
              <br />
              <em className="display-italic text-terracotta">a casar</em>
            </h2>
          </div>
        </OverlayCard>
      </motion.div>

      {/* Phase 2: "queremos que seas parte de esto" */}
      <motion.div
        style={{ opacity: phase2Opacity, y: phase2Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <OverlayCard>
          <div className="text-center max-w-3xl">
            <h2 className="display-xl text-3xl sm:text-5xl md:text-6xl text-white leading-[1.05]">
              Y queremos que seas
              <br />
              <em className="display-italic text-terracotta">parte de esto</em>
            </h2>
          </div>
        </OverlayCard>
      </motion.div>

      {/* Phase 3: guest name + wedding info */}
      <motion.div
        style={{ opacity: phase3Opacity, y: phase3Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <OverlayCard>
          <div className="text-center max-w-3xl">
            <p className="eyebrow text-terracotta mb-3">Esta invitación es para</p>
            <h2 className="display-xl text-5xl sm:text-7xl md:text-8xl text-white leading-[0.95]">
              {guestName}
            </h2>
            <p className="mt-3 smallcaps text-white/70">
              {cupos} {cupos === 1 ? 'persona' : 'personas'}
            </p>
            {weddingInfo.date && (
              <p className="mt-6 display-italic text-2xl sm:text-3xl text-white/95">
                {weddingInfo.date}
              </p>
            )}
            {weddingInfo.time && (
              <p className="mt-1 text-white/75 text-sm">{weddingInfo.time}</p>
            )}
            {weddingInfo.venue && (
              <p className="mt-1 smallcaps text-white/60">{weddingInfo.venue}</p>
            )}
          </div>
        </OverlayCard>
      </motion.div>

      {/* Phase 4: CTA — terracotta accent to match admin palette */}
      <motion.div
        style={{ opacity: phase4Opacity, y: phase4Y }}
        className="fixed inset-x-0 bottom-[14vh] z-20 flex justify-center px-6 pointer-events-none"
      >
        <button
          type="button"
          onClick={scrollToRsvp}
          className="pointer-events-auto inline-flex items-center gap-3 px-8 py-4 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors duration-300 shadow-lift"
        >
          Ver mi invitación
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden
          >
            <path d="M12 5 L12 19 M5 12 L12 19 L19 12" />
          </svg>
        </button>
      </motion.div>

      {/* Side progress rail */}
      <motion.div
        style={{ opacity: railVisible }}
        className="fixed right-4 sm:right-6 top-[12vh] bottom-[14vh] w-px z-30 pointer-events-none"
        aria-hidden
      >
        <div className="absolute inset-0 bg-white/15" />
        <motion.div
          style={{ height: railHeight }}
          className="absolute inset-x-0 top-0 bg-terracotta origin-top"
        />
        <motion.div
          style={{ top: railHeight }}
          className="absolute -left-[3px] -translate-y-1/2 w-2 h-2 rounded-full bg-terracotta shadow-[0_0_12px_rgba(184,92,56,0.7)]"
        />
      </motion.div>

      {/* Initial scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="fixed bottom-[3vh] left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        aria-hidden
      >
        <div className="text-center text-white/70 px-3 py-1.5 bg-ink/40 backdrop-blur-sm rounded-full">
          <p className="text-[0.6rem] tracking-[0.4em] uppercase">Scroll</p>
        </div>
      </motion.div>
    </div>
  );
}
