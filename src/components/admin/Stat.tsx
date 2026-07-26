import type { ReactNode } from 'react';

// One KPI card for the whole admin. Two prior implementations (Invitados hero
// row + Resumen stats) are unified here so the numbers read the same everywhere.
//
// Server-component safe (no hooks) — used directly inside the admin pages.

type Accent = 'sage' | 'terracotta' | 'gold' | 'ink';

const RAIL: Record<Accent, string> = {
  sage: 'bg-sage',
  terracotta: 'bg-terracotta',
  gold: 'bg-gold',
  ink: 'bg-ink/30',
};

const CHIP: Record<Accent, string> = {
  sage: 'bg-sage/15 text-sage-dark',
  terracotta: 'bg-terracotta/10 text-terracotta-dark',
  gold: 'bg-gold/15 text-gold',
  ink: 'bg-ink/10 text-ink-muted',
};

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  accent = 'ink',
  icon,
  filled = false,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: Accent;
  icon?: ReactNode;
  /** Hero emphasis — solid terracotta fill. */
  filled?: boolean;
  /** Dim the card when the value is zero / not actionable. */
  muted?: boolean;
}) {
  if (filled) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-terracotta text-white shadow-soft card-hover p-5">
        <div className="text-[0.65rem] tracking-[0.2em] uppercase font-semibold text-white/75 leading-tight">
          {label}
        </div>
        <div className="display-xl text-3xl sm:text-4xl mt-1.5 leading-none">{value}</div>
        {sub && <div className="text-xs mt-2 text-white/80 truncate">{sub}</div>}
      </div>
    );
  }

  return (
    <div
      className={[
        'group relative overflow-hidden card card-hover',
        muted ? 'opacity-55' : '',
      ].join(' ')}
    >
      {/* Left accent rail */}
      <div className={['absolute left-0 top-0 bottom-0 w-1', RAIL[accent]].join(' ')} />

      <div className="p-5 pl-6 flex items-start gap-3">
        {icon && (
          <div
            className={[
              'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
              CHIP[accent],
            ].join(' ')}
          >
            <span className="w-5 h-5 block">{icon}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[0.65rem] tracking-[0.2em] uppercase font-semibold text-ink-muted leading-tight">
            {label}
          </div>
          <div className="display-xl text-3xl sm:text-4xl mt-1 leading-none truncate">
            {value}
          </div>
          {sub && <div className="text-xs mt-1.5 text-ink-muted truncate">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
