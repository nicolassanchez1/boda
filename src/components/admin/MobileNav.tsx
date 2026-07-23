'use client';

// Mobile navigation drawer. Opens from the right edge with the 4 admin
// sections (Invitados / Resumen / Regalos / Menú). Triggered by a hamburger
// button in the admin header on mobile.
//
// Why a separate drawer instead of collapsing the existing tabs:
//   - The tabs row uses horizontal scroll + snap, which is fine for a peek
//     of section names but not great for actual navigation.
//   - A drawer gives each section a big tap target with its full label and
//     number, which reads better on a 375px screen.
// On `sm:` and up this drawer is hidden — the tabs row takes over.

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const TABS = [
  { href: '/admin', label: 'Invitados', number: '01' },
  { href: '/admin/resumen', label: 'Resumen', number: '02' },
  { href: '/admin/regalos', label: 'Regalos', number: '03' },
  { href: '/admin/menu', label: 'Menú', number: '04' },
];

export default function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Close whenever the route changes (user tapped a link).
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll while the drawer is open. We restore the previous value
  // so we don't clobber a user preference (e.g. reduced-motion overflow).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="sm:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-ink/40"
            onClick={onClose}
            aria-hidden
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de administración"
            className="absolute right-0 top-0 bottom-0 w-[78%] max-w-xs bg-ivory-50 shadow-lift flex flex-col"
          >
            {/* Header */}
            <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 border-b border-ink/10">
              <span className="display-italic text-2xl text-ink">mella</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menú"
                className="cursor-pointer w-11 h-11 rounded-full hover:bg-ivory-100 flex items-center justify-center text-ink-soft transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="w-5 h-5"
                  aria-hidden
                >
                  <path d="M6 6 L18 18 M18 6 L6 18" />
                </svg>
              </button>
            </header>

            {/* Section links */}
            <nav className="flex-1 overflow-y-auto py-2" aria-label="Secciones">
              <ul className="px-2">
                {TABS.map((t) => {
                  const active =
                    t.href === '/admin'
                      ? pathname === '/admin'
                      : pathname.startsWith(t.href);
                  return (
                    <li key={t.href}>
                      <Link
                        href={t.href}
                        className={clsx(
                          'flex items-baseline gap-3 px-4 py-4 rounded-2xl transition-colors min-h-[56px]',
                          active
                            ? 'bg-terracotta/10 text-terracotta-dark'
                            : 'text-ink hover:bg-ivory-100',
                        )}
                      >
                        <span className="smallcaps text-[0.6rem] opacity-70">
                          {t.number}
                        </span>
                        <span
                          className={clsx(
                            'font-display text-2xl',
                            active && 'italic',
                          )}
                        >
                          {t.label}
                        </span>
                        {active && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-terracotta" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Footer with safe-area padding */}
            <footer className="px-5 py-4 border-t border-ink/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="smallcaps text-ink-muted/60 text-center">
                panel de administración
              </p>
            </footer>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
