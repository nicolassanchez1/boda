// Root path — no public landing. Guests arrive via /i/[token].
// Anyone hitting `/` directly gets a soft redirect to the admin login (the only
// known entry point if you're not a guest).

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/admin/login');
}
