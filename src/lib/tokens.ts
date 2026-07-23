// Generates short, URL-safe invitation tokens.
// 8 chars from [A-Za-z0-9] is plenty of entropy (~47 bits) for a private guest list
// and stays readable enough to paste in WhatsApp.
//
// We loop on a uniqueness check (Prisma) and retry — collisions are vanishingly rare
// in a small DB but the check is cheap.

import crypto from 'node:crypto';
import { prisma } from './prisma';

const TOKEN_LEN = 8;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no 0/O/1/l/i

function randomToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LEN);
  let out = '';
  for (let i = 0; i < TOKEN_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export async function generateUniqueToken(maxAttempts = 20): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const token = randomToken();
    // Cheap existence check; the unique constraint is the real safety net.
    const exists = await prisma.invitation.findUnique({ where: { token }, select: { id: true } });
    if (!exists) return token;
  }
  throw new Error('Could not generate a unique invitation token after several attempts.');
}
