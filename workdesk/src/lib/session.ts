import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Session Data Shape
// The session cookie carries the minimum trusted payload needed to enforce
// auth and RBAC at the middleware/route-handler level without a DB roundtrip.
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: Role;
  isLoggedIn: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// iron-session Options
//
// password: 32+ character secret used to seal (encrypt + sign) the cookie.
//           Must be set in .env as SESSION_SECRET.
// cookieName: arbitrary but namespaced to avoid collisions.
// cookie.httpOnly: blocks JS access — protects against XSS token theft.
// cookie.secure: HTTPS-only in production.
// cookie.sameSite: "lax" prevents CSRF on same-site navigations.
// cookie.maxAge: 7-day sliding expiry (seconds). Subtract 60s safety margin.
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "workdesk.session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7 - 60, // 7 days minus 60s
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// getSession
// Returns the iron-session instance for the current request.
// Must be called inside Server Components, Route Handlers, or Server Actions.
// ─────────────────────────────────────────────────────────────────────────────

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

// ─────────────────────────────────────────────────────────────────────────────
// requireSession
// Throws a typed error if no valid session exists.
// Use in route handlers that need an authenticated caller.
// ─────────────────────────────────────────────────────────────────────────────

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    throw new UnauthenticatedError();
  }
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    isLoggedIn: session.isLoggedIn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAdminSession
// Extends requireSession with an ADMIN role assertion.
// ─────────────────────────────────────────────────────────────────────────────

export async function requireAdminSession(): Promise<SessionData> {
  const sessionData = await requireSession();
  if (sessionData.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  return sessionData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed Auth Errors
// Keeps route handlers clean — catch and map to HTTP status at the edge.
// ─────────────────────────────────────────────────────────────────────────────

export class UnauthenticatedError extends Error {
  readonly code = "UNAUTHENTICATED";
  constructor() {
    super("Authentication required.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor() {
    super("Insufficient permissions.");
    this.name = "ForbiddenError";
  }
}
