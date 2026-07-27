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

// A beat animates as ONE block (not per-line): a single fade + gentle rise.
// Animating the whole block as one compositor layer — instead of staggering
// several glowing text nodes — is what keeps the beat changes smooth on mobile.
const beatVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  },
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

  // The overlays (text beats, rail, hint) are position:fixed so they stay
  // pinned over the sticky video. But once the guest scrolls PAST the cinematic
  // into the RSVP form below, fixed elements would otherwise stay stuck on
  // screen and cover the form. So we hide them the moment the section's bottom
  // rises into the viewport (i.e. the video is scrolling away and the form is
  // taking over). `activeBeat` becomes -1, letting AnimatePresence fade the
  // last beat out cleanly.
  const [cinematicActive, setCinematicActive] = useState(true);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight || 1;
      setCinematicActive(el.getBoundingClientRect().bottom > vh * 0.85);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const activeBeat = cinematicActive ? beat : -1;

  // As the user nears the end, the cinematic fades to ivory to soften the join
  // into the RSVP section below.
  const cinematicFadeIvory = useTransform(
    scrollYProgress,
    [0.8, 1],
    ['rgba(253,251,247,0)', 'rgba(253,251,247,1)'],
  );

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
          {activeBeat === 0 && (
            <motion.div
              key="beat-0"
              variants={beatVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ willChange: 'transform, opacity' }}
              className="absolute transform-gpu"
            >
              <OverlayCard>
                <p className="eyebrow text-terracotta mb-3">Con mucho cariño</p>
                <h2 className="display-xl text-[clamp(2.25rem,7vw,4.5rem)] text-ink leading-[0.95]">
                  Nos vamos
                  <br />
                  <em className="display-italic text-terracotta-dark">a casar</em>
                </h2>
              </OverlayCard>
            </motion.div>
          )}

          {activeBeat === 1 && (
            <motion.div
              key="beat-1"
              variants={beatVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ willChange: 'transform, opacity' }}
              className="absolute transform-gpu"
            >
              <OverlayCard wide>
                <h2 className="display-xl text-[clamp(1.875rem,6vw,3.75rem)] text-ink leading-[1.05]">
                  Y no queremos
                  <br />
                  <em className="display-italic text-terracotta-dark">celebrarlo sin ti</em>
                </h2>
              </OverlayCard>
            </motion.div>
          )}

          {activeBeat === 2 && (
            <motion.div
              key="beat-2"
              variants={beatVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ willChange: 'transform, opacity' }}
              className="absolute transform-gpu"
            >
              <OverlayCard>
                <p className="eyebrow text-terracotta mb-3">Esta invitación es para</p>
                <h2 className="display-xl text-[clamp(2.25rem,7vw,4.5rem)] text-ink leading-[0.95] break-words">
                  {guestName}
                </h2>
                <p className="mt-3 smallcaps text-ink-muted">
                  {cupos} {cupos === 1 ? 'persona' : 'personas'}
                </p>
                {(weddingInfo.date || weddingInfo.time || weddingInfo.venue) && (
                  <div>
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
                  </div>
                )}
              </OverlayCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll hint — fixed, gated on the cinematic being in view. */}
      {cinematicActive && (
        <motion.div
          style={{ opacity: scrollHintOpacity }}
          className="cine-text fixed bottom-[4dvh] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none"
          aria-hidden
        >
          <span className="smallcaps text-ink-soft">Desliza para descubrir</span>
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 text-terracotta"
            animate={{ y: [0, 7, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="M12 4 L12 18 M6 13 L12 19 L18 13" />
          </motion.svg>
        </motion.div>
      )}
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
