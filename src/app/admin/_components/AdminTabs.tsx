'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const TABS = [
  { href: '/admin', label: 'Invitados', number: '01' },
  { href: '/admin/resumen', label: 'Resumen', number: '02' },
  { href: '/admin/regalos', label: 'Regalos', number: '03' },
  { href: '/admin/menu', label: 'Menú', number: '04' },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-5 sm:gap-10 overflow-x-auto -mb-px pt-2 snap-x snap-mandatory scrollbar-none"
      aria-label="Secciones"
    >
      {TABS.map((t) => {
        const active =
          t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              'group relative pb-4 whitespace-nowrap transition-colors snap-start shrink-0',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
            )}
          >
            <span className="smallcaps mr-1.5 sm:mr-2 text-[0.55rem] sm:text-[0.6rem] opacity-70 align-middle">
              {t.number}
            </span>
            <span
              className={clsx(
                'font-display text-lg sm:text-xl md:text-2xl',
                active && 'italic text-terracotta-dark',
              )}
            >
              {t.label}
            </span>
            <span
              className={clsx(
                'absolute left-0 right-0 -bottom-px h-px transition-all duration-500',
                active
                  ? 'bg-terracotta opacity-100'
                  : 'bg-ink/20 opacity-0 group-hover:opacity-60',
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
