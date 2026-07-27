'use client';

import { useEffect, useRef, useState } from 'react';
import { useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

type Props = {
  totalFrames?: number;
  framePath?: (i: number) => string;
  showFrameCounter?: boolean;
  // 'cover' fills the stage (crops the overflow) — right for footage whose
  // aspect ratio matches the viewport. 'contain' fits the whole frame.
  fit?: 'cover' | 'contain';
};

export default function MotoScroll({
  totalFrames = 96,
  framePath = (i) => `/frames/desktop/frame_${String(i).padStart(4, '0')}.jpg`,
  showFrameCounter = true,
  fit = 'cover',
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
  // Frames we've asked the browser to decode. We only decode a small window
  // around the current frame (not all 96) so full-HD frames don't blow up
  // memory / crash the tab on phones. The browser LRU-evicts decoded bitmaps
  // outside the working set on its own.
  const decodedRef = useRef<Set<number>>(new Set());

  const [isReady, setIsReady] = useState(false);
  // Only used to render the (opt-in) frame counter. Not touched during scroll
  // unless the counter is actually visible.
  const [currentFrame, setCurrentFrame] = useState(0);

  // ---- 1. Load the whole sequence (encoded only — decoding happens lazily in
  //         a window around the current frame). We reveal as soon as the first
  //         frames arrive rather than waiting for all. ----
  useEffect(() => {
    imagesRef.current = new Map();
    decodedRef.current = new Set();
    paintedIdxRef.current = -1;
    setIsReady(false);

    let count = 0;
    let cancelled = false;
    // Reveal the video as soon as a couple of frames are decoded — no loader,
    // just a brief ivory ground, then the footage fades in.
    const readyAt = Math.min(2, totalFrames);

    const advance = () => {
      if (cancelled) return;
      count++;
      if (count >= readyAt) setIsReady(true);
    };

    const load = (n: number) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (cancelled) return;
        imagesRef.current.set(n, img);
        advance();
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

      // Pre-decode a small window around the current frame (skewed forward, the
      // usual scroll direction) so the next frames are ready — without ever
      // decoding all 96 at once. Decoded bitmaps outside the window are
      // LRU-evicted by the browser, keeping memory bounded on phones.
      for (let off = -1; off <= 4; off++) {
        const n = i + 1 + off;
        const im = imagesRef.current.get(n);
        if (im && im.naturalWidth && 'decode' in im && !decodedRef.current.has(n)) {
          decodedRef.current.add(n);
          im.decode().catch(() => decodedRef.current.delete(n));
        }
      }
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

        {/* No loader — while the first frames decode the ivory stage shows
            through; the canvas fades in as soon as the video is ready. */}

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
