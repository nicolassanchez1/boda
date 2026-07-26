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
  showFrameCounter?: boolean;
  // 'cover' fills the stage (crops the overflow) — right for footage whose
  // aspect ratio matches the viewport. 'contain' fits the whole frame.
  fit?: 'cover' | 'contain';
  // Optional eyebrow shown in the loader. Omit for none.
  loaderLabel?: string;
};

export default function MotoScroll({
  totalFrames = 96,
  framePath = (i) => `/frames/desktop/frame_${String(i).padStart(4, '0')}.jpg`,
  showFrameCounter = true,
  fit = 'cover',
  loaderLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Whole sequence stays loaded for the entire scroll (short clip, ~85KB JPGs)
  // so we never evict-then-reload — that was what made frames flash/disappear.
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());

  // Hot-path refs — kept out of React state so scrubbing doesn't re-render.
  const rafRef = useRef<number | null>(null);
  const latestIdxRef = useRef(0);
  const paintedIdxRef = useRef(-1);

  const [loadedCount, setLoadedCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  // Only used to render the (opt-in) frame counter. Not touched during scroll
  // unless the counter is actually visible.
  const [currentFrame, setCurrentFrame] = useState(0);

  // ---- 1. Preload the whole sequence, pre-decoded, in order. We reveal as
  //         soon as the first frames are ready rather than waiting for all. ----
  useEffect(() => {
    imagesRef.current = new Map();
    paintedIdxRef.current = -1;
    setLoadedCount(0);
    setIsReady(false);

    let count = 0;
    let cancelled = false;
    const readyAt = Math.min(12, totalFrames);

    const advance = () => {
      if (cancelled) return;
      count++;
      setLoadedCount(count);
      if (count >= readyAt) setIsReady(true);
    };

    const load = (n: number) => {
      const img = new Image();
      img.decoding = 'async';
      const finish = () => {
        if (cancelled) return;
        imagesRef.current.set(n, img);
        advance();
      };
      img.onload = () => {
        // Decode off the critical path so the first draw of each frame doesn't
        // block the main thread mid-scroll. Fall back to using it undecoded.
        if ('decode' in img) img.decode().then(finish).catch(finish);
        else finish();
      };
      img.onerror = () => {
        // eslint-disable-next-line no-console
        console.warn(`[MotoScroll] failed: ${img.src}`);
        advance();
      };
      img.src = framePath(n);
    };

    for (let i = 1; i <= totalFrames; i++) load(i);

    return () => {
      cancelled = true;
    };
  }, [totalFrames, framePath]);

  // ---- 2. Canvas sizing + draw helper ----
  const drawRef = useRef<(idx: number) => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // alpha:true → unpainted areas are transparent and reveal the ivory stage.
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Cache CSS-pixel dimensions so the draw hot-path never calls
    // getBoundingClientRect (which forces layout).
    const dims = { cw: 0, ch: 0 };

    // Return the requested frame, or the nearest already-loaded one, so the
    // canvas is never left empty mid-scroll while a frame is still decoding.
    const pickFrame = (idx: number): HTMLImageElement | null => {
      const exact = imagesRef.current.get(idx + 1);
      if (exact && exact.naturalWidth) return exact;
      for (let off = 1; off < totalFrames; off++) {
        const lo = imagesRef.current.get(idx + 1 - off);
        if (lo && lo.naturalWidth) return lo;
        const hi = imagesRef.current.get(idx + 1 + off);
        if (hi && hi.naturalWidth) return hi;
      }
      return null;
    };

    const draw = (idx: number) => {
      const { cw, ch } = dims;
      ctx.clearRect(0, 0, cw, ch);
      const frame = pickFrame(idx);
      if (!frame) return; // nothing decoded yet (loader is covering this)

      const scale =
        fit === 'cover'
          ? Math.max(cw / frame.naturalWidth, ch / frame.naturalHeight)
          : Math.min(cw / frame.naturalWidth, ch / frame.naturalHeight);
      const dw = frame.naturalWidth * scale;
      const dh = frame.naturalHeight * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      ctx.drawImage(
        frame,
        Math.round(dx),
        Math.round(dy),
        Math.round(dw),
        Math.round(dh),
      );
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dims.cw = rect.width;
      dims.ch = rect.height;

      // DPR capped at 2 (a scroll-video doesn't need 3×), and the backing
      // store is bounded so huge monitors don't pay for pixels the ≤1280px
      // source frames can't fill anyway. Both slash per-frame fill cost.
      const MAX_SIDE = 2560;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let bw = rect.width * dpr;
      let bh = rect.height * dpr;
      const k = Math.min(1, MAX_SIDE / Math.max(bw, bh, 1));
      bw *= k;
      bh *= k;
      canvas.width = Math.max(1, Math.floor(bw));
      canvas.height = Math.max(1, Math.floor(bh));

      const effDpr = canvas.width / rect.width || 1;
      ctx.setTransform(effDpr, 0, 0, effDpr, 0, 0);
      // 'medium' is ~indistinguishable from 'high' on already-upscaled source
      // frames, at a fraction of the cost.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';

      draw(latestIdxRef.current);
    };

    drawRef.current = draw;
    resize();
    window.addEventListener('resize', resize, { passive: true });
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, fit, totalFrames]);

  // ---- 3. Scroll → frame index. Paint is coalesced to one per animation
  //         frame; React state is left untouched unless the counter is shown. ----
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const frameIndex = useTransform(scrollYProgress, [0, 1], [0, totalFrames - 1]);

  useMotionValueEvent(frameIndex, 'change', (latest) => {
    if (!isReady) return;
    const idx = Math.max(0, Math.min(totalFrames - 1, Math.round(latest)));
    latestIdxRef.current = idx;

    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const i = latestIdxRef.current;
      if (i === paintedIdxRef.current) return; // scroll moved sub-frame — skip
      paintedIdxRef.current = i;
      drawRef.current(i);
      if (showFrameCounter) setCurrentFrame(i);
    });
  });

  return (
    <div ref={containerRef} className="relative h-[500svh] bg-ivory-50">
      {/* Sticky stage — ivory ground so any margin/gap stays on-palette. */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-ivory-50">
        <canvas
          ref={canvasRef}
          className={`h-full w-full transition-opacity duration-700 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ imageRendering: 'auto' }}
        />

        {/* Loader — warm ivory ground, ink text. */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-ivory-50 text-ink">
            <div className="text-center max-w-xs px-6">
              {loaderLabel && (
                <p className="eyebrow text-terracotta mb-6">{loaderLabel}</p>
              )}
              <div className="w-12 h-12 mx-auto mb-6 border-2 border-ink/15 border-t-terracotta rounded-full animate-spin" />
              {/* Progress bar */}
              <div className="relative h-px w-full bg-ink/10 mb-3 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-terracotta"
                  initial={{ width: 0 }}
                  animate={{ width: `${(loadedCount / totalFrames) * 100}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-[0.65rem] tracking-[0.3em] uppercase text-ink-muted">
                <span className="text-ink">{String(loadedCount).padStart(3, '0')}</span>
                {' / '}
                {String(totalFrames).padStart(3, '0')}
              </p>
            </div>
          </div>
        )}

        {/* Frame counter — opt-in (off for the guest cinematic). */}
        {isReady && showFrameCounter && (
          <div className="pointer-events-none absolute bottom-[2svh] left-6 sm:left-10 text-ink/60">
            <p className="text-[0.6rem] tracking-[0.35em] uppercase">Frame</p>
            <p className="font-display text-2xl leading-none mt-1">
              <span className="text-terracotta">
                {String(currentFrame + 1).padStart(3, '0')}
              </span>
              <span className="text-ink/30 mx-2">/</span>
              <span className="text-ink/30">{String(totalFrames).padStart(3, '0')}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
