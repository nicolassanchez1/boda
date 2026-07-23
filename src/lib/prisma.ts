// Prisma singleton.
//
// On Vercel, serverless functions can create a new PrismaClient per invocation,
// which exhausts Neon's pooled connections fast. We cache the client on globalThis
// in dev (so HMR doesn't leak connections) and rely on a single instance per Lambda
// in production.
//
// The runtime client uses DATABASE_URL (pooled). The `directUrl` in schema.prisma
// is consumed only by the Prisma CLI for migrations — Prisma picks it up
// automatically; we don't need to reference it here.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
