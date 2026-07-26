'use client';

// Cinematic intro for the guest invitation.
//
// Scroll-scrubbed 96-frame sequence (desktop 16:9 / mobile 9:16) behind three
// narrative "beats":
//   Beat 0  (0–30%)   "Nos vamos a casar"
//   Beat 1  (30–60%)  "Y no queremos celebrarlo sin ti"
//   Beat 2  (60–100%) <guest name> + wedding date / venue
//
// The scroll position selects the active beat; each beat's text fades/rises in
// as a smooth cross-fade (no solid card — the text sits directly over the frame
// with a soft ivory glow for legibility). The "¿Nos acompañarás?" prompt lives
// in the attendance bar below (GuestView), not here.

import { useRef, useState, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion';
import MotoScroll from '@/components/MotoScroll';

type Props = {
  guestName: string;
  cupos: number;
  weddingInfo: { date: string; time: string; venue: string };
};

const EASE = [0.22, 1, 0.36, 1] as const;

// The text block for a beat. Transparent (no card), so the entrance stays
// simple: a smooth fade + gentle rise — no scale, no child delay, no backdrop
// blur. Removing the old "settle then pop" gap is what stops the transition
// from looking cut/janky on mobile.
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE, staggerChildren: 0.05 },
  },
  exit: {
    opacity: 0,
    y: -14,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  },
};

// Each line rises in, inheriting the small stagger from its parent beat.
const lineVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export default function GuestCinematic({
  guestName,
  cupos,
  weddingInfo,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // Pick the frame set matching the viewport orientation (desktop video is
  // 16:9, mobile is 9:16). Resolved on the client (null until mounted) to
  // avoid an SSR/CSR mismatch; MotoScroll remounts via `key` if the user
  // crosses the breakpoint (e.g. rotates a tablet).
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  const variant = isDesktop ? 'desktop' : 'mobile';

  // Scroll position → active beat (0/1/2). Only changes 2–3 times across the
  // whole scroll, so this drives at most a couple of re-renders — the reveal
  // itself is a time-based animation, decoupled from the scroll velocity.
  const [beat, setBeat] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const next = p < 0.3 ? 0 : p < 0.6 ? 1 : 2;
    setBeat((prev) => (prev === next ? prev : next));
  });

  // As the user nears the end, the cinematic fades to ivory to soften the join
  // into the RSVP section below.
  const cinematicFadeIvory = useTransform(
    scrollYProgress,
    [0.8, 1],
    ['rgba(253,251,247,0)', 'rgba(253,251,247,1)'],
  );

  // Side progress rail (right edge) — terracotta dot growing.
  const railVisible = useTransform(scrollYProgress, [0, 0.02, 0.98, 1], [0, 1, 1, 0]);
  const railHeight = useTransform(scrollYProgress, [0.02, 0.98], ['0%', '100%']);

  // Scroll hint fades out once the user starts scrolling.
  const scrollHintOpacity = useTransform(scrollYProgress, [0, 0.03, 0.08], [1, 1, 0]);

  return (
    <div ref={ref} className="relative min-h-[500svh]">
      {/* Ivory stage behind the sticky canvas — keeps the cinematic on-palette
          (the canvas is transparent where a frame doesn't reach). */}
      <div className="absolute inset-0 bg-ivory-50" aria-hidden />

      {/* Scroll-scrubbed wedding footage. Frame set matches the viewport
          orientation (desktop 16:9 / mobile 9:16); remounts on breakpoint
          change via `key`. */}
      {isDesktop !== null && (
        <MotoScroll
          key={variant}
          totalFrames={96}
          framePath={(i) =>
            `/frames/${variant}/frame_${String(i).padStart(4, '0')}.jpg`
          }
          fit="cover"
          showFrameCounter={false}
          loaderLabel="Nuestra boda"
        />
      )}

      {/* Soft ivory tint that grows toward the end, making the join to the RSVP
          section feel continuous. */}
      <motion.div
        style={{ background: cinematicFadeIvory }}
        className="pointer-events-none absolute inset-0 z-10"
        aria-hidden
      />

      {/* ─── Narrative beats ─── The active one plays a staggered reveal:
           card settles first, text rises in after. */}
      <div
        className="fixed inset-0 z-20 flex items-center justify-center px-6 pointer-events-none"
        aria-hidden
      >
        <AnimatePresence>
          {beat === 0 && (
            <motion.div
              key="beat-0"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute"
            >
              <OverlayCard>
                <motion.p variants={lineVariants} className="eyebrow text-terracotta mb-3">
                  Con mucho cariño
                </motion.p>
                <motion.h2
                  variants={lineVariants}
                  className="display-xl text-[clamp(2.25rem,7vw,4.5rem)] text-ink leading-[0.95]"
                >
                  Nos vamos
                  <br />
                  <em className="display-italic text-terracotta-dark">a casar</em>
                </motion.h2>
              </OverlayCard>
            </motion.div>
          )}

          {beat === 1 && (
            <motion.div
              key="beat-1"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute"
            >
              <OverlayCard wide>
                <motion.h2
                  variants={lineVariants}
                  className="display-xl text-[clamp(1.875rem,6vw,3.75rem)] text-ink leading-[1.05]"
                >
                  Y no queremos
                  <br />
                  <em className="display-italic text-terracotta-dark">celebrarlo sin ti</em>
                </motion.h2>
              </OverlayCard>
            </motion.div>
          )}

          {beat === 2 && (
            <motion.div
              key="beat-2"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute"
            >
              <OverlayCard>
                <motion.p variants={lineVariants} className="eyebrow text-terracotta mb-3">
                  Esta invitación es para
                </motion.p>
                <motion.h2
                  variants={lineVariants}
                  className="display-xl text-[clamp(2.25rem,7vw,4.5rem)] text-ink leading-[0.95] break-words"
                >
                  {guestName}
                </motion.h2>
                <motion.p variants={lineVariants} className="mt-3 smallcaps text-ink-muted">
                  {cupos} {cupos === 1 ? 'persona' : 'personas'}
                </motion.p>
                {(weddingInfo.date || weddingInfo.time || weddingInfo.venue) && (
                  <motion.div variants={lineVariants}>
                    <div className="gold-rule w-24 mx-auto my-6" />
                    {weddingInfo.date && (
                      <p className="display-italic text-2xl sm:text-3xl text-terracotta-dark">
                        {weddingInfo.date}
                      </p>
                    )}
                    {weddingInfo.time && <p className="mt-1 text-ink-muted">{weddingInfo.time}</p>}
                    {weddingInfo.venue && (
                      <p className="mt-1 smallcaps text-ink-muted/70">{weddingInfo.venue}</p>
                    )}
                  </motion.div>
                )}
              </OverlayCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Side progress rail — terracotta */}
      <motion.div
        style={{ opacity: railVisible }}
        className="fixed right-4 sm:right-6 top-[12dvh] bottom-[14dvh] w-px z-30 pointer-events-none"
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

      {/* Initial scroll hint — fades out once the user starts scrolling. */}
      <motion.div
        style={{ opacity: scrollHintOpacity }}
        className="fixed bottom-[3dvh] left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        aria-hidden
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <OverlayCard compact>
            <p className="text-[0.6rem] tracking-[0.4em] uppercase text-ink-muted">
              Scroll ↓
            </p>
          </OverlayCard>
        </motion.div>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Reusable overlay wrapper — fully transparent so the video frame shows through.
// Text legibility comes from the `.cine-text` glow, not a background.
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
        'cine-text inline-block max-w-[92vw] text-center',
        compact ? 'px-4 py-2' : wide ? 'px-8 sm:px-12 py-6' : 'px-6 sm:px-10 py-6',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
