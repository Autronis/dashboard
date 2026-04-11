import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verborgenKalenderMeetings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

// POST /api/meetings/verberg — Hide a calendar meeting
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    // Ensure table exists
    try {
      await db.run(sql`CREATE TABLE IF NOT EXISTS verborgen_kalender_meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kalender_event_id TEXT NOT NULL UNIQUE,
        verborgen_op TEXT DEFAULT (datetime('now'))
      )`);
    } catch { /* already exists */ }

    const { kalenderEventId } = await req.json();
    if (!kalenderEventId || typeof kalenderEventId !== "string") {
      return NextResponse.json({ fout: "kalenderEventId is verplicht" }, { status: 400 });
    }

    await db
      .insert(verborgenKalenderMeetings)
      .values({ kalenderEventId })
      .onConflictDoNothing();

    return NextResponse.json({ succes: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}

// DELETE /api/meetings/verberg — Unhide a calendar meeting
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();

    const { kalenderEventId } = await req.json();
    if (!kalenderEventId || typeof kalenderEventId !== "string") {
      return NextResponse.json({ fout: "kalenderEventId is verplicht" }, { status: 400 });
    }

    await db
      .delete(verborgenKalenderMeetings)
      .where(eq(verborgenKalenderMeetings.kalenderEventId, kalenderEventId));

    return NextResponse.json({ succes: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
