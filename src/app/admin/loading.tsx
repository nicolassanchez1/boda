// Skeleton shown while admin/* pages load. Matches the editorial aesthetic so the
// transition feels intentional, not broken. Mirrors the real InvitationCard
// structure so the layout doesn't jump when content lands.

export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton — eyebrow + H1 + buttons */}
      <div className="space-y-3">
        <div className="h-3 w-20 bg-terracotta/15 rounded" />
        <div className="h-10 bg-ink/8 rounded w-1/3" />
      </div>

      {/* Stats row skeleton — 4 cards on desktop, 1-col stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-soft p-5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-ink/8 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-2.5 w-20 bg-ink/8 rounded" />
              <div className="h-7 w-12 bg-ink/12 rounded mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="bg-white rounded-2xl shadow-soft p-5">
        <div className="h-2.5 w-16 bg-ink/8 rounded mb-4" />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 w-24 bg-ink/5 rounded-full shrink-0"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Invitation cards skeleton — mirrors the real layout */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-soft overflow-hidden flex"
          >
            {/* Left accent bar */}
            <div className="w-1 bg-ink/8 shrink-0" />
            <div className="flex-1 pl-5 pr-3 py-4 flex items-start gap-3">
              {/* Checkbox */}
              <div className="w-11 h-11 sm:w-7 sm:h-7 rounded-md bg-ink/8 shrink-0" />
              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="flex justify-between gap-2">
                  <div className="h-5 w-1/2 bg-ink/12 rounded" />
                  <div className="h-5 w-16 bg-ink/8 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-20 bg-ink/5 rounded-full" />
                  <div className="h-6 w-16 bg-ink/5 rounded-full" />
                </div>
                <div className="h-3 w-3/4 bg-ink/5 rounded" />
              </div>
              {/* Action buttons */}
              <div className="flex gap-1 shrink-0">
                <div className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-ink/5" />
                <div className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-ink/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
