// Tiny set of inline SVG ornaments. Hand-tuned strokes, no stock icon library.
// Each component is sized to the parent and inherits `currentColor`.

export function LaurelOrnament({ className = '' }: { className?: string }) {
  // Symmetric leaf-laurel with a centered "kiss" — a heart wrapped in two leaves.
  return (
    <svg
      viewBox="0 0 220 40"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Left leaf */}
      <path d="M12 20 Q40 6 70 20" />
      <path d="M70 20 Q40 14 18 24" opacity="0.6" />
      <path d="M30 18 Q34 14 40 14" opacity="0.5" />
      <path d="M48 16 Q52 12 58 14" opacity="0.5" />
      <path d="M22 22 Q26 26 32 26" opacity="0.4" />
      <path d="M52 24 Q56 28 62 24" opacity="0.4" />

      {/* Center heart */}
      <path d="M110 30 C 102 22, 100 16, 104 14 C 108 12, 110 16, 110 18 C 110 16, 112 12, 116 14 C 120 16, 118 22, 110 30 Z" />

      {/* Right leaf (mirror) */}
      <path d="M208 20 Q180 6 150 20" />
      <path d="M150 20 Q180 14 202 24" opacity="0.6" />
      <path d="M190 18 Q186 14 180 14" opacity="0.5" />
      <path d="M172 16 Q168 12 162 14" opacity="0.5" />
      <path d="M198 22 Q194 26 188 26" opacity="0.4" />
      <path d="M168 24 Q164 28 158 24" opacity="0.4" />
    </svg>
  );
}

export function DiamondRule({ className = '' }: { className?: string }) {
  // A thin line broken by a small diamond. Replaces generic `<hr>`.
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <div className="flex-1 gold-rule" />
      <svg viewBox="0 0 10 10" className="w-2 h-2" fill="currentColor">
        <path d="M5 0 L10 5 L5 10 L0 5 Z" />
      </svg>
      <div className="flex-1 gold-rule" />
    </div>
  );
}

export function CornerFlourish({ className = '' }: { className?: string }) {
  // Top-left ornamental bracket. Use 4 of these in the page corners.
  return (
    <svg
      viewBox="0 0 60 60"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 30 Q2 2 30 2" />
      <path d="M10 30 Q10 10 30 10" opacity="0.5" />
      <circle cx="2" cy="2" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
