import type { Metadata } from 'next';
import MotoScrollSection from '@/components/MotoScrollSection';

export const metadata: Metadata = {
  title: 'Demo',
  robots: { index: false, follow: false },
};

// Pure server component — all the work happens inside MotoScrollSection (client).
export default function DemoPage() {
  return <MotoScrollSection />;
}
