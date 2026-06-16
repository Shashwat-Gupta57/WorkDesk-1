import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, SESSION_OPTIONS } from "@/lib/session";

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
  "/settings",
];

// Routes restricted to ADMIN role only.
const ADMIN_ONLY_PREFIXES = ["/settings/admin"];

// Routes that should redirect authenticated users away (e.g. login page).
const AUTH_ROUTES = ["/login", "/forgot-password"];

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Read session from the incoming request cookies.
  // getIronSession with NextRequest/NextResponse works at edge.
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req.cookies as any, SESSION_OPTIONS);

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
