'use client';

// Compact "Compartir con catering" button. Copies a plain-text catering
// summary to the clipboard so the admin can paste it in WhatsApp / email
// and hand it to the caterer without sharing the admin URL.

import { useState, useTransition } from 'react';

type Props = {
  dishes: { name: string; count: number }[];
  drinks: { name: string; count: number }[];
  unassignedDish: number;
  unassignedDrink: number;
  dietaryNotes: { guest: string; name: string; notes: string }[];
  confirmedPeople: number;
};

export default function CateringShareButton({
  dishes,
  drinks,
  unassignedDish,
  unassignedDrink,
  dietaryNotes,
  confirmedPeople,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = () => {
    startTransition(async () => {
      const lines: string[] = [];
      lines.push(`Resumen catering — ${confirmedPeople} ${confirmedPeople === 1 ? 'persona confirmada' : 'personas confirmadas'}`);
      lines.push('');
      lines.push('PLATOS PRINCIPALES');
      dishes
        .slice()
        .sort((a, b) => b.count - a.count)
        .forEach((d) => lines.push(`  · ${d.name}: ${d.count}`));
      if (unassignedDish > 0) lines.push(`  · Sin elegir: ${unassignedDish}`);

      lines.push('');
      lines.push('BEBIDAS');
      drinks
        .slice()
        .sort((a, b) => b.count - a.count)
        .forEach((d) => lines.push(`  · ${d.name}: ${d.count}`));
      if (unassignedDrink > 0) lines.push(`  · Sin elegir: ${unassignedDrink}`);

      if (dietaryNotes.length > 0) {
        lines.push('');
        lines.push('NOTAS DIETÉTICAS');
        dietaryNotes.forEach((n) => lines.push(`  · ${n.name} (${n.guest}): ${n.notes}`));
      }

      const text = lines.join('\n');
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        window.prompt('Copia el resumen:', text);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={pending}
      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink text-white text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15 L5 5 L15 5" />
      </svg>
      {copied ? '¡Copiado!' : 'Compartir con catering'}
    </button>
  );
}
