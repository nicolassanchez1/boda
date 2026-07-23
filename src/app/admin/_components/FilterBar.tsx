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
    <div className="flex flex-wrap gap-2">
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
              'text-sm px-4 py-2 rounded-full border transition-colors',
              isActive
                ? 'bg-ink text-white border-ink'
                : 'bg-white border-ink/15 text-ink-soft hover:text-ink hover:border-ink/30',
            )}
          >
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
