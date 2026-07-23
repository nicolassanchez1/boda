// Skeleton shown while admin/* pages load. Matches the editorial aesthetic so the
// transition feels intentional, not broken.

export default function AdminLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-10 bg-ink/8 rounded w-1/3" />
        <div className="h-3 bg-ink/5 rounded w-1/4" />
      </div>

      {/* Content skeleton — generic card stack */}
      <div className="space-y-4">
        <div className="h-px gold-rule opacity-30" />
        <div className="bg-white/60 rounded-2xl shadow-soft overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-5 border-b border-ink/5 last:border-0"
            >
              <div className="w-14 h-14 rounded-xl bg-ink/8" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-ink/10 rounded w-1/3" />
                <div className="h-3 bg-ink/5 rounded w-1/2" />
              </div>
              <div className="w-20 h-8 bg-ink/5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
