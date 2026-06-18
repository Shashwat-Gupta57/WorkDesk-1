import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SignUpSchema } from "@/modules/auth/schemas";
import { registerUser, DuplicateEmailError } from "@/modules/auth/services/authService";
import { SESSION_OPTIONS, type SessionData } from "@/lib/session";
import { ok, fail } from "@/types/common";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signup
//
// Registers a new MEMBER account, then immediately seals a session cookie so
// the user is signed in straight after registration.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    const parsed = SignUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { name, phone, email, password } = parsed.data;
    const user = await registerUser({ name, phone, email, password });

    // Seal a session so the user is logged in immediately.
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name;
    session.role = user.role;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json(ok(user), { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return NextResponse.json(fail(err.code, err.message), { status: 409 });
    }
    console.error("[POST /api/auth/signup]", err);
    return NextResponse.json(
      fail("INTERNAL_ERROR", "An unexpected error occurred."),
      { status: 500 }
    );
  }
}
