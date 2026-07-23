// RSVP helpers — shared between guest page + admin views.

export function isPastDeadline(deadlineIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!deadlineIso) return false;
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) return false;
  return now.getTime() > d.getTime();
}

export function rsvpStatusLabel(status: 'PENDING' | 'CONFIRMED' | 'DECLINED'): string {
  switch (status) {
    case 'PENDING':
      return 'Pendiente';
    case 'CONFIRMED':
      return 'Confirmado';
    case 'DECLINED':
      return 'No asistirá';
  }
}

export function rsvpStatusTone(
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED',
): 'neutral' | 'positive' | 'muted' {
  switch (status) {
    case 'CONFIRMED':
      return 'positive';
    case 'DECLINED':
      return 'muted';
    default:
      return 'neutral';
  }
}
