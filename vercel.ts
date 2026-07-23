// Vercel project config. Replaces vercel.json with a typed, code-driven config.
// Requires: pnpm add -D @vercel/config
// Docs: https://vercel.com/docs/project-configuration/vercel-ts

import { routes, type VercelConfig } from '@vercel/config/v1';

const config: VercelConfig = {
  // Framework auto-detected from package.json — declared explicitly for clarity.
  framework: 'nextjs',
  buildCommand: 'npm run build',
  installCommand: 'npm install --no-audit --no-fund',

  // Prisma generates its client during postinstall (see package.json), but we also
  // run `prisma generate` in the build step so a fresh deploy never skips it.
  // The actual DB schema is applied at runtime via `prisma migrate deploy`, run
  // locally before the first deploy (see README).

  // Always ship security headers on every response.
  headers: [
    routes.cacheControl('/api/(.*)', { private: true, maxAge: 0 }),
    routes.setHeader('/(.*)', {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }),
  ],

  // No rewrites / redirects — the app owns its URLs.
};

export default config;
