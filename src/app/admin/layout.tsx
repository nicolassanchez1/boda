import AdminHeader from '@/components/admin/AdminHeader';
import AuthGuard from '@/components/admin/AuthGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AdminHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 md:py-14 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {/* Client-side auth guard: instant redirect if no session, even if the
            server middleware somehow doesn't catch it. */}
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
