'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'framer-motion';

type Props = {
  totalFrames?: number;
  framePath?: (i: number) => string;
  showFrameCounter?: boolean;
};

export default function MotoScroll({
  totalFrames = 118,
  framePath = (i) => `/frames/frame_${String(i).padStart(4, '0')}.png`,
  showFrameCounter = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Sliding window of decoded frames. We never hold more than BUFFER*2 in
  // memory at once — Safari iOS will OOM-kill the tab if we hold all 118.
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);

  const [loadedCount, setLoadedCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Detect low-memory devices — buffer shrinks further on iPhone < 4GB RAM.
  const isLowMem = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    // deviceMemory is in GB. Safari may report undefined → assume low-mem to
    // be safe.
    const dm = (navigator as { deviceMemory?: number }).deviceMemory;
    if (typeof dm === 'number') return dm < 4;
    // userAgent sniff for older iPhones that don't expose deviceMemory
    return /iPhone|iPad/.test(navigator.userAgent);
  }, []);

  // Sliding window size: low-mem devices keep only ±BUFFER frames around
  // the current one.
  const BUFFER = isLowMem ? 6 : 12;

  // ---- 1. Seed: load the first BUFFER*2 frames so the user can scroll a bit
  //         before the loader kicks in. The rest is loaded lazily by the
  //         scroll handler. ----
  useEffect(() => {
    const seed = Math.min(BUFFER * 2, totalFrames);
    let count = 0;
    for (let i = 1; i <= seed; i++) {
      loadFrame(i, () => {
        count++;
        setLoadedCount(count);
        if (count === seed) setIsReady(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalFrames, framePath, BUFFER]);

  // Lazily load frame `n` if not already in the buffer.
  const loadFrame = (n: number, onReady?: () => void) => {
    if (n < 1 || n > totalFrames) return;
    if (imagesRef.current.has(n)) {
      onReady?.();
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.src = framePath(n);
    const done = () => {
      imagesRef.current.set(n, img);
      onReady?.();
    };
    if (img.complete) {
      done();
    } else {
      img.onload = () => {
        try {
          // Force the bitmap into a GPU-decoded state before drawImage.
          // Cuts the visible "flash" on first scrub.
          if ('decode' in img) img.decode().catch(() => {});
        } catch {
          /* decode() can reject on bad frames; fall through */
        }
        done();
      };
      img.onerror = () => {
        // Don't throw — a single missing frame shouldn't crash the page.
        // Draw loop will see the gap and skip it.
        // eslint-disable-next-line no-console
        console.warn(`[MotoScroll] failed: ${img.src}`);
        done();
      };
    }
  };

  // Drop frames outside ±BUFFER around n. Releasing the Image src hints
  // the browser to release the decoded bitmap so GC can reclaim.
  const evictFar = (n: number) => {
    const min = Math.max(1, n - BUFFER);
    const max = Math.min(totalFrames, n + BUFFER);
    for (const key of Array.from(imagesRef.current.keys())) {
      if (key < min || key > max) {
        const img = imagesRef.current.get(key);
        if (img) img.src = '';
        imagesRef.current.delete(key);
      }
    }
  };

  // ---- 2. Canvas sizing + high-quality draw helper ----
  const drawRef = useRef<(idx: number, img?: HTMLImageElement) => void>(
    () => {},
  );

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

    const draw = (idx: number, img?: HTMLImageElement) => {
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;

      // Black backdrop always.
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);

      // Look up the image in the sliding window if not passed in.
      const frame = img ?? imagesRef.current.get(idx + 1);
      if (!frame || !frame.naturalWidth) return;

      // object-contain, preserve aspect, center.
      const scale = Math.min(cw / frame.naturalWidth, ch / frame.naturalHeight);
      const dw = frame.naturalWidth * scale;
      const dh = frame.naturalHeight * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      // Round positions to whole pixels in CSS space to avoid sub-pixel blur.
      ctx.drawImage(
        frame,
        Math.round(dx),
        Math.round(dy),
        Math.round(dw),
        Math.round(dh),
      );
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

    // Pre-fetch the surrounding window, evict the far ones. This keeps the
    // buffer small even though the user can scroll the entire 500vh range.
    for (let off = -BUFFER; off <= BUFFER; off++) {
      loadFrame(idx + 1 + off);
    }
    evictFar(idx + 1);

    // Coalesce multiple motion-value updates into one paint.
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const img = imagesRef.current.get(idx + 1);
      drawRef.current(idx, img);
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

        {/* Frame counter — bottom-left, in the letterbox. Opt-in for non-demo uses
            (e.g. guest cinematic) since "0/117 frame" is ugly in production. */}
        {isReady && showFrameCounter && (
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
