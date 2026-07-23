import Link from 'next/link';

// Friendly 404 used when an invitation token doesn't match anything.
// Kept in Spanish + warm, because guests are the most likely audience.

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-4">Ups</p>
      <h1 className="display-xl text-4xl md:text-5xl mb-4">No encontramos tu invitación</h1>
      <p className="text-ink-soft max-w-md mb-8">
        Es posible que el enlace esté mal copiado o que la invitación ya no esté disponible. Si
        crees que es un error, escríbenos y lo revisamos.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-full px-6 py-3 bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
