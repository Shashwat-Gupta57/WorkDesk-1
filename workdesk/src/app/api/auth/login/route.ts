import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@/modules/auth/schemas";
import { verifyCredentials, InvalidCredentialsError, UserSuspendedError } from "@/modules/auth/services/authService";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/types/common";
import { SafeUser } from "@/modules/auth/types";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
//
// Validates credentials, creates an iron-session cookie.
// Returns the safe user projection (no passwordHash).
//
// Security:
// - Input validated with Zod before any DB call.
// - bcrypt comparison is constant-time (handled in authService).
// - Generic error message prevents user enumeration.
// - Session cookie is HttpOnly, SameSite=lax, Secure in prod.
// - Existing sessions are overwritten on re-login (no session fixation).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const user: SafeUser = await verifyCredentials(email, password);

    // Seal the session.
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name;
    session.role = user.role;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json(ok(user), { status: 200 });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      // 401 — same response shape for wrong email AND wrong password (anti-enumeration).
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    }

    if (err instanceof UserSuspendedError) {
      return NextResponse.json(fail(err.code, err.message), { status: 403 });
    }

    console.error("[POST /api/auth/login]", err);
    return NextResponse.json(
      fail("INTERNAL_ERROR", "An unexpected error occurred."),
      { status: 500 }
    );
  }
}
