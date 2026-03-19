import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAuthUrl, getTokensForUser } from "@/lib/google-calendar";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/auth/google — start OAuth flow of check status
export async function GET() {
  try {
    const gebruiker = await requireAuth();
    const tokens = await getTokensForUser(gebruiker.id);

    return NextResponse.json({
      connected: !!tokens,
      calendarId: tokens?.calendarId ?? "primary",
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 401 }
    );
  }
}

// POST /api/auth/google — start OAuth redirect
export async function POST() {
  try {
    const gebruiker = await requireAuth();
    const state = String(gebruiker.id);
    const url = getAuthUrl(state);

    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 401 }
    );
  }
}

// DELETE /api/auth/google — disconnect
export async function DELETE() {
  try {
    const gebruiker = await requireAuth();
    await db.delete(googleTokens).where(eq(googleTokens.gebruikerId, gebruiker.id));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 401 }
    );
  }
}
