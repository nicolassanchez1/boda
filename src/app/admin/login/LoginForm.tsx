'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { adminLogin } from '@/actions/admin';
import { useAdminSession } from '@/lib/stores/admin-session';

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const markAuthenticated = useAdminSession((s) => s.markAuthenticated);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adminLogin({ password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Mark the client-side session so the AuthGuard lets us through on the
      // next render without a flash of the login page.
      markAuthenticated();
      router.replace(next || '/admin');
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <label className="block">
        <span className="smallcaps text-ink-muted">Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          placeholder="•  •  •  •  •  •  •  •"
          className="mt-2 w-full bg-transparent border-0 border-b border-ink/20 px-0 py-3 text-2xl font-display tracking-[0.4em] text-center placeholder:text-ink/15 focus:border-terracotta focus:outline-none focus:ring-0 transition-colors"
        />
      </label>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-terracotta-dark text-center display-italic"
          role="alert"
        >
          {error}
        </motion.p>
      )}

      <button
        type="submit"
        disabled={pending || !password}
        className="group relative w-full rounded-full bg-ink text-ivory-50 py-4 px-6 font-medium overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        <span className="relative z-10 flex items-center justify-center gap-3">
          <span>{pending ? 'Entrando…' : 'Entrar'}</span>
          <svg
            viewBox="0 0 20 20"
            className="w-4 h-4 transition-transform group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 10 L17 10 M12 5 L17 10 L12 15" />
          </svg>
        </span>
        <span className="absolute inset-0 bg-terracotta translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
      </button>
    </form>
  );
}
