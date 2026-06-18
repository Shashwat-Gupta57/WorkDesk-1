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
  phone: string | null;
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

/**
 * Payload for a user updating their own profile.
 */
export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  themePreference?: string;
}

/**
 * Row returned by the admin audit log list.
 */
export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
}
