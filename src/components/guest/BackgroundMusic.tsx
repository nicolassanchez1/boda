'use client';

// Ambient background music for the guest invitation.
//
// Browsers block autoplay WITH sound until the user makes a gesture, so we never
// force playback on load. Instead we show a small, on-brand toggle:
//   - First visit: control invites a tap ("Música", gentle pulse). Tapping
//     starts the track (we're inside a user gesture → allowed) with a soft fade.
//   - Preference is remembered (localStorage). On a return visit, if the guest
//     had it on, we start on their FIRST tap/scroll gesture automatically.
//   - Pauses when the tab is hidden; resumes when it comes back (if enabled).
//   - If the audio file isn't present, the control simply never appears.
//
// The track path defaults to /audio/music.mp3 and can be overridden with
// NEXT_PUBLIC_MUSIC_URL.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'mella-music';
const TARGET_VOLUME = 0.35;

export default function BackgroundMusic({
  src = process.env.NEXT_PUBLIC_MUSIC_URL || '/audio/music.mp3',
}: {
  src?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false); // audio can play → show control
  const [enabled, setEnabled] = useState(false); // guest wants sound
  const [hintVisible, setHintVisible] = useState(true);

  // Ramp volume smoothly to `target`, then optionally run `onDone`.
  const fadeTo = useCallback((target: number, onDone?: () => void) => {
    const a = audioRef.current;
    if (!a) return;
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const step = () => {
      const el = audioRef.current;
      if (!el) return;
      const diff = target - el.volume;
      if (Math.abs(diff) < 0.02) {
        el.volume = Math.max(0, Math.min(1, target));
        fadeRef.current = null;
        onDone?.();
        return;
      }
      el.volume = Math.max(0, Math.min(1, el.volume + diff * 0.08));
      fadeRef.current = requestAnimationFrame(step);
    };
    step();
  }, []);

  const play = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
      fadeTo(TARGET_VOLUME);
    } catch {
      // Autoplay blocked — playback will start on the next explicit tap.
    }
  }, [fadeTo]);

  // Create the audio element once and restore preference.
  useEffect(() => {
    const a = new Audio(src);
    a.loop = true;
    a.preload = 'metadata';
    a.volume = 0;
    audioRef.current = a;

    const onReady = () => setReady(true);
    const onError = () => setReady(false);
    a.addEventListener('canplay', onReady);
    a.addEventListener('loadedmetadata', onReady);
    a.addEventListener('error', onError);

    let cleanupGesture: (() => void) | undefined;
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'on') {
      setEnabled(true);
      setHintVisible(false);
      // Autoplay is blocked, so arm a one-shot listener: the guest's first
      // gesture (tap/key) resumes their chosen music.
      const start = () => {
        void play();
        cleanupGesture?.();
      };
      window.addEventListener('pointerdown', start, { once: true });
      window.addEventListener('keydown', start, { once: true });
      cleanupGesture = () => {
        window.removeEventListener('pointerdown', start);
        window.removeEventListener('keydown', start);
      };
    }

    return () => {
      a.removeEventListener('canplay', onReady);
      a.removeEventListener('loadedmetadata', onReady);
      a.removeEventListener('error', onError);
      cleanupGesture?.();
      if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
      a.pause();
      a.src = '';
      audioRef.current = null;
    };
  }, [src, play]);

  // Pause when the tab is hidden; resume if the guest had it on.
  useEffect(() => {
    const onVisibility = () => {
      const a = audioRef.current;
      if (!a) return;
      if (document.hidden) {
        a.pause();
      } else if (enabled) {
        void play();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, play]);

  // Auto-hide the invitation hint after a few seconds.
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const toggle = () => {
    setHintVisible(false);
    const a = audioRef.current;
    if (!a) return;
    if (enabled) {
      setEnabled(false);
      try {
        localStorage.setItem(STORAGE_KEY, 'off');
      } catch {
        /* private mode — ignore */
      }
      fadeTo(0, () => a.pause());
    } else {
      setEnabled(true);
      try {
        localStorage.setItem(STORAGE_KEY, 'on');
      } catch {
        /* private mode — ignore */
      }
      void play();
    }
  };

  if (!ready) return null;

  return (
    <div className="fixed z-50 top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex items-center gap-2">
      <AnimatePresence>
        {hintVisible && !enabled && (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.3 }}
            className="rounded-full bg-ivory-50/90 backdrop-blur-md ring-1 ring-ink/10 shadow-soft px-3 py-1.5 text-xs font-medium text-ink-soft"
          >
            Con música
          </motion.span>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? 'Silenciar música' : 'Activar música'}
        className="relative cursor-pointer w-11 h-11 rounded-full bg-ivory-50/90 backdrop-blur-md ring-1 ring-ink/10 shadow-soft flex items-center justify-center text-terracotta-dark hover:bg-ivory-100 transition-colors"
      >
        {/* Gentle pulse ring to invite the first tap (only while off). */}
        {!enabled && (
          <motion.span
            className="absolute inset-0 rounded-full ring-2 ring-terracotta/40"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            aria-hidden
          />
        )}
        <Equalizer active={enabled} />
      </button>
    </div>
  );
}

// Three bars — animate when playing, rest low when muted.
function Equalizer({ active }: { active: boolean }) {
  const bars = [0, 1, 2];
  return (
    <span className="flex items-end gap-[3px] h-4" aria-hidden>
      {bars.map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-current"
          style={{ originY: 1 }}
          animate={
            active
              ? { height: ['35%', '100%', '55%', '85%', '35%'] }
              : { height: '35%' }
          }
          transition={
            active
              ? { duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }
              : { duration: 0.3 }
          }
        />
      ))}
    </span>
  );
}
