// Skeleton shown while /i/[token] loads. Keeps the same vertical rhythm as the
// guest view so there's no layout shift when the real content arrives.

export default function GuestLoading() {
  return (
    <main className="min-h-screen">
      <section className="px-6 pt-16 pb-20 md:pt-24 md:pb-28 max-w-2xl mx-auto text-center">
        <div className="h-3 bg-terracotta/15 rounded w-20 mx-auto mb-6 animate-pulse" />
        <div className="h-14 bg-ink/8 rounded w-2/3 mx-auto mb-6 animate-pulse" />
        <div className="h-4 bg-ink/5 rounded w-3/4 mx-auto mb-2 animate-pulse" />
        <div className="h-4 bg-ink/5 rounded w-2/3 mx-auto mb-10 animate-pulse" />
        <div className="h-24 bg-white/60 rounded-2xl mx-auto max-w-sm animate-pulse" />
      </section>

      <div className="hairline max-w-md mx-auto" />

      <section className="px-6 py-16 max-w-2xl mx-auto">
        <div className="h-3 bg-terracotta/15 rounded w-32 mx-auto mb-3 animate-pulse" />
        <div className="h-10 bg-ink/8 rounded w-1/2 mx-auto mb-4 animate-pulse" />
        <div className="h-4 bg-ink/5 rounded w-3/4 mx-auto mb-10 animate-pulse" />
        <div className="grid sm:grid-cols-2 gap-3 max-w-md mx-auto">
          <div className="h-16 bg-terracotta/10 rounded-2xl animate-pulse" />
          <div className="h-16 bg-ink/5 rounded-2xl animate-pulse" />
        </div>
      </section>
    </main>
  );
}
