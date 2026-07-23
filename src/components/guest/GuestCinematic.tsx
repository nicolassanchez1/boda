'use client';

// Cinematic intro for the guest invitation.
//
// Scroll-scrubbed 118-frame sequence (see /frames/) with four text beats:
//   1.  0–25%   "Nos vamos a casar"
//   2. 25–60%   "queremos que seas parte de esto"
//   3. 60–90%   <guest name> + wedding date / venue
//   4. 90–100%  CTA → scroll into the RSVP section below
//
// Reuses the canvas + loader + letterbox bars from MotoScroll. The overlay
// text is positioned over the sticky stage via fixed positioning so it
// stays centered as the user scrolls.

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

  // Each overlay has its own opacity (and slight y) keyed to scroll progress.
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

  // Side progress rail + dots
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
      <MotoScroll totalFrames={118} />

      {/* Phase 1: "Nos vamos a casar" */}
      <motion.div
        style={{ opacity: phase1Opacity, y: phase1Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <div className="text-center">
          <p className="eyebrow text-gold mb-4">Una invitación</p>
          <h2 className="display-xl text-5xl sm:text-7xl md:text-8xl text-white leading-[0.95]">
            Nos vamos
            <br />
            <em className="display-italic text-gold">a casar</em>
          </h2>
        </div>
      </motion.div>

      {/* Phase 2: "queremos que seas parte de esto" */}
      <motion.div
        style={{ opacity: phase2Opacity, y: phase2Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <div className="text-center max-w-3xl">
          <h2 className="display-xl text-4xl sm:text-6xl md:text-7xl text-white leading-[1.05]">
            Y queremos que seas
            <br />
            <em className="display-italic text-gold">parte de esto</em>
          </h2>
        </div>
      </motion.div>

      {/* Phase 3: guest name + wedding info */}
      <motion.div
        style={{ opacity: phase3Opacity, y: phase3Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <div className="text-center max-w-3xl">
          <p className="eyebrow text-gold mb-3">Esta invitación es para</p>
          <h2 className="display-xl text-5xl sm:text-7xl md:text-8xl text-white leading-[0.95]">
            {guestName}
          </h2>
          <p className="mt-4 smallcaps text-white/60">
            {cupos} {cupos === 1 ? 'persona' : 'personas'}
          </p>
          {weddingInfo.date && (
            <p className="mt-8 display-italic text-2xl sm:text-3xl text-white/90">
              {weddingInfo.date}
            </p>
          )}
          {weddingInfo.time && (
            <p className="mt-1 text-white/70">{weddingInfo.time}</p>
          )}
          {weddingInfo.venue && (
            <p className="mt-1 smallcaps text-white/50">{weddingInfo.venue}</p>
          )}
        </div>
      </motion.div>

      {/* Phase 4: CTA */}
      <motion.div
        style={{ opacity: phase4Opacity, y: phase4Y }}
        className="fixed inset-x-0 bottom-[14vh] z-20 flex justify-center px-6 pointer-events-none"
      >
        <button
          type="button"
          onClick={scrollToRsvp}
          className="pointer-events-auto inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-ink font-medium hover:bg-gold hover:text-white transition-colors duration-300 shadow-lift"
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

      {/* Side progress rail — Ducati-style red line */}
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
        <div className="text-center text-white/60">
          <p className="text-[0.6rem] tracking-[0.4em] uppercase mb-1.5">Scroll</p>
          <div className="w-px h-6 mx-auto bg-gradient-to-b from-white/60 to-transparent" />
        </div>
      </motion.div>
    </div>
  );
}
