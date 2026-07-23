'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import MotoScroll from './MotoScroll';

// Same scroll source for overlays + MotoScroll's canvas so timing is locked.

export default function MotoScrollSection() {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // a) 0–25% — intro
  const titleOpacity = useTransform(
    scrollYProgress,
    [0, 0.04, 0.2, 0.25],
    [1, 1, 1, 0],
  );
  const titleY = useTransform(scrollYProgress, [0, 0.25], [0, -40]);

  // b) 25–65% — specs
  const specsOpacity = useTransform(
    scrollYProgress,
    [0.25, 0.3, 0.6, 0.65],
    [0, 1, 1, 0],
  );
  const specsY = useTransform(scrollYProgress, [0.25, 0.65], [60, -60]);

  // c) 65–95% — closer
  const closerOpacity = useTransform(
    scrollYProgress,
    [0.65, 0.7, 0.9, 0.95],
    [0, 1, 1, 0],
  );

  // Vertical progress bar — visible 5%–95%
  const progressHeight = useTransform(scrollYProgress, [0.05, 0.95], ['0%', '100%']);
  const progressVisible = useTransform(
    scrollYProgress,
    [0, 0.04, 0.97, 1],
    [0, 1, 1, 0],
  );

  return (
    <div ref={ref} className="relative bg-black text-white">
      <MotoScroll />

      {/* Vignette — soft radial darkening from edges */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Film grain — SVG noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-10 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Vertical progress bar — Ducati-red line on the right edge */}
      <motion.div
        style={{ opacity: progressVisible }}
        className="pointer-events-none fixed right-6 sm:right-10 top-[12vh] bottom-[14vh] z-20 w-px"
      >
        <div className="absolute inset-0 bg-white/15" />
        <motion.div
          style={{ height: progressHeight }}
          className="absolute inset-x-0 top-0 bg-terracotta origin-top"
        />
        {/* End cap dot */}
        <motion.div
          style={{ top: progressHeight }}
          className="absolute -left-1 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-terracotta shadow-[0_0_12px_rgba(184,92,56,0.7)]"
        />
      </motion.div>

      {/* Scroll hint at the very start */}
      <motion.div
        style={{
          opacity: useTransform(scrollYProgress, [0, 0.02, 0.08], [1, 1, 0]),
        }}
        className="pointer-events-none fixed bottom-[12vh] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center text-white/50"
      >
        <p className="text-[0.6rem] tracking-[0.4em] uppercase mb-2">Scroll</p>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-px h-8 bg-gradient-to-b from-white/60 to-transparent"
        />
      </motion.div>

      {/* Overlay a) — intro */}
      <motion.div
        style={{ opacity: titleOpacity, y: titleY }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none"
      >
        <div className="text-center px-6 max-w-5xl">
          <p className="eyebrow text-terracotta mb-6">Superleggera V4</p>
          <h1 className="display-xl text-5xl sm:text-7xl md:text-[8rem] leading-[0.95] tracking-tight">
            The most
            <br />
            <em className="display-italic text-terracotta">exclusive</em>
          </h1>
          <p className="mt-8 text-[0.7rem] tracking-[0.4em] uppercase text-white/40">
            Ducati · Borgo Panigale · 2024
          </p>
        </div>
      </motion.div>

      {/* Overlay b) — specs */}
      <motion.div
        style={{ opacity: specsOpacity, y: specsY }}
        className="fixed inset-0 z-20 flex items-end justify-center pb-[14vh] pointer-events-none"
      >
        <div className="text-center px-6">
          <div className="flex items-baseline justify-center gap-2">
            <span className="display-xl text-[8rem] sm:text-[10rem] md:text-[14rem] leading-none font-medium">
              207
            </span>
            <span className="display-italic text-terracotta text-5xl sm:text-6xl md:text-7xl">
              hp
            </span>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-terracotta/60" />
            <p className="text-[0.7rem] tracking-[0.4em] uppercase text-white/60">
              Carbon fibre manifesto
            </p>
            <span className="h-px w-8 bg-terracotta/60" />
          </div>
        </div>
      </motion.div>

      {/* Overlay c) — closer */}
      <motion.div
        style={{ opacity: closerOpacity }}
        className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none"
      >
        <div className="text-center max-w-3xl px-8">
          <p className="display-italic text-3xl sm:text-4xl md:text-6xl leading-tight text-white/95">
            Una pieza única
            <br />
            de ingeniería italiana.
          </p>
          <p className="mt-10 text-[0.6rem] tracking-[0.4em] uppercase text-white/40">
            Series · Limited
          </p>
        </div>
      </motion.div>
    </div>
  );
}
