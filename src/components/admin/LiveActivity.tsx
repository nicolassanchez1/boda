'use client';

// Tiny live-activity widget. Uses TanStack Query to poll /api/admin/live-stats
// every 30s and shows recent RSVPs and gift reservations.
//
// Failure mode: silent. If the fetch errors (Neon paused, network blip, etc.)
// we keep showing the last known data and just hide the "en vivo" indicator.
// We never display an error to the admin — `/admin/resumen` already shows the
// canonical data, so this widget is purely decorative.

import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

type Stats = {
  total: number;
  confirmed: number;
  declined: number;
  pending: number;
  opened: number;
  recentRsvps: number;
  reservedGifts: number;
  totalGifts: number;
  serverTime: string;
};

async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/admin/live-stats', { cache: 'no-store' });
  if (!res.ok) throw new Error('stats fetch failed');
  return res.json();
}

export default function LiveActivity() {
  const { data, isFetching, dataUpdatedAt, isError } = useQuery({
    queryKey: ['admin', 'live-stats'],
    queryFn: fetchStats,
    refetchInterval: 30_000, // poll every 30s — easier on Neon's free tier
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 5_000,
  });

  // No data yet and fetching failed → render nothing. Avoid alarming the admin.
  if (!data) return null;

  const activityLevel = data.recentRsvps > 0 ? 'active' : 'idle';
  const stale = isError; // we have stale data because a refetch failed

  return (
    <div className="flex items-center gap-4 text-xs">
      {/* Pulse indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <AnimatePresence>
            {activityLevel === 'active' && !stale && (
              <motion.span
                key="ping"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inline-flex h-full w-full rounded-full bg-terracotta"
              />
            )}
          </AnimatePresence>
          <span
            className={[
              'relative inline-flex rounded-full h-2 w-2',
              stale
                ? 'bg-ink/20'
                : activityLevel === 'active'
                ? 'bg-terracotta'
                : 'bg-sage/60',
            ].join(' ')}
          />
        </span>
        <span className="smallcaps text-ink-muted">
          {stale
            ? 'Datos en pausa'
            : activityLevel === 'active'
            ? `${data.recentRsvps} ${data.recentRsvps === 1 ? 'confirmación' : 'confirmaciones'} reciente${data.recentRsvps === 1 ? '' : 's'}`
            : 'Sin actividad reciente'}
        </span>
      </div>

      {/* Live counts */}
      <div className="hidden sm:flex items-center gap-3 text-ink-soft">
        <span>
          <strong className="text-ink">{data.confirmed}</strong> confirmados
        </span>
        <span className="text-ink-muted/40">·</span>
        <span>
          <strong className="text-ink">{data.reservedGifts}</strong>/{data.totalGifts} regalos
        </span>
        {!stale && (
          <>
            <span className="text-ink-muted/40">·</span>
            <span
              className={`transition-opacity ${isFetching ? 'opacity-100' : 'opacity-30'}`}
              title={
                dataUpdatedAt
                  ? `Última actualización: ${new Date(dataUpdatedAt).toLocaleTimeString('es-CO')}`
                  : ''
              }
            >
              en vivo
            </span>
          </>
        )}
      </div>
    </div>
  );
}
