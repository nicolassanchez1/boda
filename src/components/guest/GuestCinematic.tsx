'use client';

// Cinematic intro for the guest invitation.
//
// Scroll-scrubbed 118-frame sequence (see /frames/) with four text beats:
//   1.  0–25%   "Nos vamos a casar"
//   2. 25–60%   "queremos que seas parte de esto"
//   3. 60–90%   <guest name> + wedding date / venue
//   4. 90–100%  CTA → scroll into the RSVP section below
//
// Aesthetic: editorial wedding palette (ivory + ink + terracotta + gold) so the
// cinematic reads as part of the same brand as /admin, NOT a separate Ducati
// demo. The Ducati footage sits behind translucent ivory cards that tint the
// dark frames and make the text legible without losing the moody feel.

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import MotoScroll from '@/components/MotoScroll';

type Props = {
  guestName: string;
  cupos: number;
  weddingInfo: { date: string; time: string; venue: string };
  rsvpAnchorId: string;
};

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

  // Each overlay fades in at its start range and fades out as the next takes
  // over. Slight Y on each gives the "rises into place" editorial feel.
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

  // As the user scrolls past ~75%, the cinematic itself fades to ivory to
  // soften the transition into the RSVP section below.
  const cinematicFadeIvory = useTransform(
    scrollYProgress,
    [0.75, 1],
    ['rgba(253,251,247,0)', 'rgba(253,251,247,1)'],
  );

  // Side progress rail (right edge) — terracotta dot growing
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
    <div ref={ref} className="relative">
      {/* Black stage behind the sticky canvas — required so the dark bike
          frames are not jitter-edged by the surrounding ivory page. */}
      <div className="absolute inset-0 bg-black" aria-hidden />

      {/* The Ducati footage sits at the top. */}
      <MotoScroll totalFrames={118} showFrameCounter={false} />

      {/* Soft ivory tint that grows as the user reaches the end of the scroll,
          making the join to the RSVP section feel continuous rather than
          "hitting a wall of black". */}
      <motion.div
        style={{ background: cinematicFadeIvory }}
        className="pointer-events-none absolute inset-0 z-10"
        aria-hidden
      />

      {/* Phase 1: "Nos vamos a casar" */}
      <motion.div
        style={{ opacity: phase1Opacity, y: phase1Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <OverlayCard>
          <p className="eyebrow text-terracotta mb-3">Una invitación</p>
          <h2 className="display-xl text-4xl sm:text-6xl md:text-7xl text-ink leading-[0.95]">
            Nos vamos
            <br />
            <em className="display-italic text-terracotta-dark">a casar</em>
          </h2>
        </OverlayCard>
      </motion.div>

      {/* Phase 2: "queremos que seas parte de esto" */}
      <motion.div
        style={{ opacity: phase2Opacity, y: phase2Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <OverlayCard wide>
          <h2 className="display-xl text-3xl sm:text-5xl md:text-6xl text-ink leading-[1.05]">
            Y queremos que seas
            <br />
            <em className="display-italic text-terracotta-dark">parte de esto</em>
          </h2>
        </OverlayCard>
      </motion.div>

      {/* Phase 3: guest name + wedding info */}
      <motion.div
        style={{ opacity: phase3Opacity, y: phase3Y }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none px-6"
        aria-hidden
      >
        <OverlayCard>
          <p className="eyebrow text-terracotta mb-2">Esta invitación es para</p>
          <h2 className="display-xl text-4xl sm:text-6xl md:text-7xl text-ink leading-[0.95]">
            {guestName}
          </h2>
          <p className="mt-2 smallcaps text-ink-muted">
            {cupos} {cupos === 1 ? 'persona' : 'personas'}
          </p>
          {weddingInfo.date && (
            <p className="mt-6 display-italic text-2xl sm:text-3xl text-terracotta-dark">
              {weddingInfo.date}
            </p>
          )}
          {weddingInfo.time && (
            <p className="mt-1 text-ink-muted">{weddingInfo.time}</p>
          )}
          {weddingInfo.venue && (
            <p className="mt-1 smallcaps text-ink-muted/70">{weddingInfo.venue}</p>
          )}
        </OverlayCard>
      </motion.div>

      {/* Phase 4: CTA — small enough to not need a backdrop since it's a button */}
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

      {/* Side progress rail — terracotta */}
      <motion.div
        style={{ opacity: railVisible }}
        className="fixed right-4 sm:right-6 top-[12vh] bottom-[14vh] w-px z-30 pointer-events-none"
        aria-hidden
      >
        <div className="absolute inset-0 bg-terracotta/20" />
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
        <OverlayCard compact>
          <p className="text-[0.6rem] tracking-[0.4em] uppercase text-ink-muted">Scroll ↓</p>
        </OverlayCard>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Reusable card for the overlays — ivory with subtle ivory tint, terracotta accent
// line, soft shadow. Light enough to stay legible over the dark Ducati frames
// while still feeling on-brand with /admin.
// -----------------------------------------------------------------------------

function OverlayCard({
  children,
  wide,
  compact,
}: {
  children: React.ReactNode;
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        'inline-block bg-ivory-50/92 backdrop-blur-md rounded-3xl shadow-lift border border-ink/10',
        compact ? 'px-4 py-2' : wide ? 'px-8 sm:px-12 py-6 sm:py-8' : 'px-6 sm:px-10 py-6 sm:py-8',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
