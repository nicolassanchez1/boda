import Link from 'next/link';
import clsx from 'clsx';

type Filters = { status: string; opened: string };

const STATUS_CHIPS: { key: string; label: string; extra?: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'CONFIRMED', label: 'Confirmados' },
  { key: 'DECLINED', label: 'Declinaron' },
  { key: 'never', label: 'Nunca abrieron', extra: 'opened=never' },
];

export default function FilterBar({ current }: { current: Filters }) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible snap-x snap-mandatory scrollbar-none">
      {STATUS_CHIPS.map((chip) => {
        const params = new URLSearchParams();
        if (chip.key === 'never') {
          params.set('opened', 'never');
        } else if (chip.key !== 'all') {
          params.set('status', chip.key);
        }
        const href = `/admin${params.toString() ? `?${params.toString()}` : ''}`;
        const isActive =
          chip.key === 'never'
            ? current.opened === 'never'
            : chip.key === 'all'
            ? current.status === 'all' && current.opened === 'all'
            : current.status === chip.key && current.opened === 'all';

        return (
          <Link
            key={chip.label}
            href={href}
            className={clsx(
              // Bigger tap target on mobile (44px-ish), tighter on desktop.
              'inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 sm:py-2 rounded-full border transition-all shrink-0 snap-start',
              'active:scale-[0.97]',
              isActive
                ? 'bg-terracotta text-white border-terracotta shadow-soft'
                : 'bg-white border-ink/20 text-ink-soft hover:text-ink hover:border-ink/40 hover:bg-ivory-100',
            )}
          >
            {isActive && (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3 -ml-0.5"
                aria-hidden
              >
                <path d="M3 8 L6.5 11.5 L13 5" />
              </svg>
            )}
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
