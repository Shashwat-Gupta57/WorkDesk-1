import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { SessionData, SESSION_OPTIONS } from "@/lib/session";

// Read-only: unseal the iron-session cookie directly.
//
// We deliberately do NOT use getIronSession(req.cookies, …) here. At the Next.js
// edge runtime, NextRequest.cookies is not the cookie-store shape iron-session's
// stateful API expects, and passing it throws "adapterFn is not a function".
// The proxy only needs to read the session, so unsealData (stateless decrypt) is
// the correct primitive. Returns an empty object if the cookie is absent/invalid.
async function readSession(req: NextRequest): Promise<Partial<SessionData>> {
  const sealed = req.cookies.get(SESSION_OPTIONS.cookieName)?.value;
  if (!sealed) return {};
  try {
    return await unsealData<SessionData>(sealed, {
      password: SESSION_OPTIONS.password,
    });
  } catch {
    // Tampered, expired, or rotated-secret cookie → treat as logged out.
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Proxy — Edge Route Protection (Next.js 16 Proxy Convention)
//
// Runs at the Vercel/Next.js edge runtime before any page or route handler.
// Reads the iron-session cookie and enforces three rules:
//
//   1. Unauthenticated access to protected routes → redirect to /login
//   2. Authenticated access to auth routes (/login) → redirect to /dashboard
//   3. Non-ADMIN access to /settings/admin → redirect to /dashboard
//
// The proxy only reads the cookie — it never writes or destroys it.
// Writes happen in route handlers (login, logout, session).
//
// Matcher excludes:
//   - _next/static  — built assets
//   - _next/image   — image optimisation
//   - favicon.ico   — browser default
//   - /api/auth/*   — auth endpoints must be publicly reachable
// ─────────────────────────────────────────────────────────────────────────────

// Routes that require authentication (any role).
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/archive",
  "/library",
  "/messaging",
  "/bulletin",
  "/mail-hub",
  "/graph-view",
  "/graph",
  "/settings",
  "/profile",
];

// Routes restricted to ADMIN role only.
const ADMIN_ONLY_PREFIXES = ["/settings/admin"];

// Routes that should redirect authenticated users away (e.g. login page).
const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password"];

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Read session from the incoming request cookies (stateless unseal).
  const res = NextResponse.next();
  const session = await readSession(req);

  const isLoggedIn = session.isLoggedIn === true && Boolean(session.userId);
  const isAdmin = isLoggedIn && session.role === "ADMIN";

  // ── Rule 1: Admin-only routes ──────────────────────────────────────────────
  if (ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isLoggedIn) {
      return redirectToLogin(req);
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return res;
  }

  // ── Rule 2: Protected routes (any authenticated user) ─────────────────────
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isLoggedIn) {
      return redirectToLogin(req);
    }
    return res;
  }

  // ── Rule 3: Auth routes (redirect if already logged in) ───────────────────
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return res;
  }

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function redirectToLogin(req: NextRequest): NextResponse {
  const loginUrl = new URL("/login", req.url);
  // Preserve the originally requested path so login can redirect back.
  loginUrl.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// Matcher Config
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
