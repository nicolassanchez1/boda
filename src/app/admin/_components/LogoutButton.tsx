'use client';

import { useTransition } from 'react';
import { adminLogout } from '@/actions/admin';
import { useAdminSession } from '@/lib/stores/admin-session';

export default function LogoutButton() {
  const [pending, startTransition] = useTransition();
  const clearSession = useAdminSession((s) => s.clearSession);

  const handleLogout = () => {
    // Clear client-side state FIRST so any cached admin pages stop rendering
    // their content instantly. The server action then clears the cookie and
    // redirects to /admin/login.
    clearSession();
    startTransition(() => adminLogout());
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="group inline-flex items-center gap-2 smallcaps text-ink-muted hover:text-terracotta-dark transition-colors disabled:opacity-50"
    >
      <span>{pending ? 'Saliendo…' : 'Cerrar sesión'}</span>
      <svg
        viewBox="0 0 20 20"
        className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M13 4 L17 10 L13 16" />
        <path d="M17 10 L7 10" />
      </svg>
    </button>
  );
}
