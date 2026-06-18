import { NextRequest, NextResponse } from "next/server";
import { requireSession, UnauthenticatedError } from "@/lib/session";
import { ok, fail } from "@/types/common";
import { totalUnreadCount } from "@/modules/messaging/services/messagingService";

// GET /api/messaging/unread — returns { count: number } for the unread badge

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const count = await totalUnreadCount(session.userId);
    return NextResponse.json(ok({ count }));
  } catch (err) {
    if (err instanceof UnauthenticatedError)
      return NextResponse.json(fail(err.code, err.message), { status: 401 });
    console.error("[GET /api/messaging/unread]", err);
    return NextResponse.json(fail("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
  }
}
