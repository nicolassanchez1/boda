// Middleware gates /admin/* (except /admin/login) with the signed admin cookie.
// Uses the Edge-compatible Web Crypto implementation in auth-edge.ts (Node crypto
// is not available in the Edge runtime).

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, isAdminAuthedEdge } from '@/lib/auth-edge';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (pathname.startsWith('/admin/login')) return NextResponse.next();

  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (await isAdminAuthedEdge(cookie)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};
