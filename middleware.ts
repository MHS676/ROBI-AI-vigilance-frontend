import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// ─── Constants ────────────────────────────────────────────────────────────────
const TOKEN_COOKIE_KEY = 'falcon_access_token';

/** Must match backend JWT_SECRET exactly */
const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ??
      'falcon_super_secret_jwt_key_change_in_production',
  );

/** Default landing page per role after login */
const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  ADMIN: '/admin/dashboard',
  AGENT: '/admin/dashboard',
};

/** Route-prefix → minimum allowed roles */
const PROTECTED_ROUTES: Array<{ prefix: string; allowed: string[] }> = [
  { prefix: '/super-admin', allowed: ['SUPER_ADMIN'] },
  { prefix: '/admin', allowed: ['SUPER_ADMIN', 'ADMIN', 'AGENT'] },
];

// ─── Middleware ───────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through Next.js internals / static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_COOKIE_KEY)?.value;

  // ── Redirect already-authenticated users away from /login ──────────────────
  if (pathname === '/login' || pathname === '/') {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getSecret(), {
          issuer: 'falcon-security-limited',
        });
        const role = (payload.role as string) ?? 'AGENT';
        return NextResponse.redirect(
          new URL(ROLE_HOME[role] ?? '/admin/dashboard', request.url),
        );
      } catch {
        // Token invalid — fall through to login page
      }
    }
    return NextResponse.next();
  }

  // ── All other routes require a valid token ─────────────────────────────────
  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname); // preserve intended destination
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'falcon-security-limited',
    });
    const role = (payload.role as string) ?? 'AGENT';

    // ── Role-based route guard ───────────────────────────────────────────────
    for (const { prefix, allowed } of PROTECTED_ROUTES) {
      if (pathname.startsWith(prefix) && !allowed.includes(role)) {
        // Wrong role — bounce to their own dashboard
        return NextResponse.redirect(
          new URL(ROLE_HOME[role] ?? '/admin/dashboard', request.url),
        );
      }
    }

    // ── Forward user identity to Server Components via request headers ───────
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set('x-user-id', String(payload.sub));
    reqHeaders.set('x-user-role', role);
    reqHeaders.set('x-user-center-id', String(payload.centerId ?? ''));
    reqHeaders.set('x-user-email', String(payload.email ?? ''));

    return NextResponse.next({ request: { headers: reqHeaders } });
  } catch {
    // Expired / tampered token → clear cookie & redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(TOKEN_COOKIE_KEY);
    return response;
  }
}

export const config = {
  // Run on every route except Next.js internals & static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
