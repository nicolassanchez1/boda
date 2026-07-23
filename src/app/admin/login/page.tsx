import { CornerFlourish, DiamondRule, LaurelOrnament } from '@/components/ui/Ornament';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Editorial corners — hand-drawn brackets that frame the page */}
      <CornerFlourish className="absolute top-6 left-6 w-12 h-12 text-gold/60" />
      <CornerFlourish className="absolute top-6 right-6 w-12 h-12 text-gold/60 -scale-x-100" />
      <CornerFlourish className="absolute bottom-6 left-6 w-12 h-12 text-gold/60 -scale-y-100" />
      <CornerFlourish className="absolute bottom-6 right-6 w-12 h-12 text-gold/60 -scale-100" />

      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16">
        <div className="w-full max-w-md">
          {/* Ornament */}
          <div className="text-terracotta mb-8 animate-fade-up">
            <LaurelOrnament className="w-40 sm:w-48 mx-auto h-10" />
          </div>

          {/* Wordmark */}
          <p className="display-italic text-2xl text-center text-ink-soft mb-3 animate-fade-up [animation-delay:80ms]">
            mella
          </p>

          {/* Headline */}
          <h1 className="display-xl text-4xl sm:text-6xl text-center mb-2 animate-fade-up [animation-delay:160ms]">
            Panel de
            <br />
            <em className="display-italic text-terracotta-dark">administración</em>
          </h1>

          {/* Form */}
          <div className="animate-fade-up [animation-delay:320ms]">
            <DiamondRule className="mb-8 text-gold" />
            <LoginForm next={searchParams.next ?? '/admin'} />
          </div>

          {/* Footer flourish */}
          <p className="mt-12 text-center text-xs smallcaps text-ink-muted/60 animate-fade-up [animation-delay:400ms]">
            hecho con cariño
          </p>
        </div>
      </div>
    </main>
  );
}
