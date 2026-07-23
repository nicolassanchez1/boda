'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion';

type Props = {
  totalFrames?: number;
  framePath?: (i: number) => string;
};

export default function MotoScroll({
  totalFrames = 118,
  framePath = (i) => `/frames/frame_${String(i).padStart(4, '0')}.png`,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef<number | null>(null);

  const [loadedCount, setLoadedCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // ---- 1. Preload + decode every frame so the first draw is crisp. ----
  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    let count = 0;

    const mark = () => {
      count++;
      setLoadedCount(count);
      if (count === totalFrames) setIsReady(true);
    };

    for (let i = 0; i < totalFrames; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = framePath(i + 1);

      const done = async () => {
        try {
          // Force the bitmap into a GPU-decoded state before drawImage.
          // Cuts the visible "flash" on first scrub.
          if ('decode' in img) await img.decode();
        } catch {
          /* decode() can reject on bad frames; fall through to mark() */
        }
        mark();
      };

      if (img.complete) done();
      else {
        img.onload = done;
        img.onerror = () => {
          // eslint-disable-next-line no-console
          console.error(`[MotoScroll] failed: ${img.src}`);
          mark();
        };
      }

      imgs.push(img);
    }

    imagesRef.current = imgs;
  }, [totalFrames, framePath]);

  // ---- 2. Canvas sizing + high-quality draw helper ----
  const drawRef = useRef<(idx: number) => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Cap at 3 to keep phones with 3x DPR responsive without going absurd.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    // Enable high-quality upscaling — critical for low-res source frames.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    };

    const draw = (idx: number) => {
      const img = imagesRef.current[idx];
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;

      // Black backdrop always.
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);

      if (!img || !img.naturalWidth) return;

      // object-contain, preserve aspect, center.
      const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      // Round positions to whole pixels in CSS space to avoid sub-pixel blur.
      ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    drawRef.current = draw;

    if (isReady) draw(0);

    return () => window.removeEventListener('resize', resize);
  }, [isReady]);

  // ---- 3. Scroll → frame index, throttled to one paint per animation frame ----
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const frameIndex = useTransform(scrollYProgress, [0, 1], [0, totalFrames - 1]);

  useMotionValueEvent(frameIndex, 'change', (latest) => {
    if (!isReady) return;
    const idx = Math.max(0, Math.min(totalFrames - 1, Math.round(latest)));
    setCurrentFrame(idx);

    // Coalesce multiple motion-value updates into one paint.
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawRef.current(idx);
    });
  });

  return (
    <div ref={containerRef} className="relative h-[500vh] bg-black">
      {/* Sticky stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`h-full w-full transition-opacity duration-700 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ imageRendering: 'auto' }}
        />

        {/* Cinematic letterbox bars — fixed-height, gold accent on the bottom one. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[8vh] bg-black" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[10vh] bg-black" />
        <div className="pointer-events-none absolute inset-x-0 bottom-[10vh] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        {/* Loader */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center max-w-xs px-6">
              <p className="eyebrow text-terracotta mb-6">Superleggera V4</p>
              <div className="w-12 h-12 mx-auto mb-6 border-2 border-white/20 border-t-terracotta rounded-full animate-spin" />
              {/* Progress bar */}
              <div className="relative h-px w-full bg-white/10 mb-3 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-terracotta"
                  initial={{ width: 0 }}
                  animate={{ width: `${(loadedCount / totalFrames) * 100}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-[0.65rem] tracking-[0.3em] uppercase text-white/50">
                <span className="text-white">{String(loadedCount).padStart(3, '0')}</span>
                {' / '}
                {String(totalFrames).padStart(3, '0')}
              </p>
            </div>
          </div>
        )}

        {/* Frame counter — bottom-left, in the letterbox */}
        {isReady && (
          <div className="pointer-events-none absolute bottom-[2vh] left-6 sm:left-10 text-white/70">
            <p className="text-[0.6rem] tracking-[0.35em] uppercase">Frame</p>
            <p className="font-display text-2xl leading-none mt-1">
              <span className="text-terracotta">
                {String(currentFrame + 1).padStart(3, '0')}
              </span>
              <span className="text-white/40 mx-2">/</span>
              <span className="text-white/40">{String(totalFrames).padStart(3, '0')}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
