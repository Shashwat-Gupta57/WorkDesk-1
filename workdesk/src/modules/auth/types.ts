import { Role, UserStatus } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Auth Domain Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safe user projection — never exposes passwordHash.
 * Returned by service layer methods and session reads.
 */
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  themePreference: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Minimal user summary for admin list views.
 */
export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
}

/**
 * Payload written into the iron-session cookie.
 * Re-exported from session.ts for module consumers.
 */
export type { SessionData } from "@/lib/session";

/**
 * Admin action to mutate a user's status or role.
 */
export interface UpdateUserPayload {
  status?: UserStatus;
  role?: Role;
}
