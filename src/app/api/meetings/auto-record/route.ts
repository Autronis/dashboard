import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createRecallBot, isRecallConfigured } from "@/lib/recall";

// Ensure recall_bot_id column exists
async function ensureColumn() {
  try {
    await db.run(sql`ALTER TABLE meetings ADD COLUMN recall_bot_id TEXT`);
  } catch {
    // Column already exists
  }
}

// POST /api/meetings/auto-record — Check upcoming meetings and dispatch bots
// Called by cron or manually
export async function POST() {
  try {
    if (!isRecallConfigured()) {
      return NextResponse.json({ fout: "Recall niet geconfigureerd" }, { status: 500 });
    }

    await ensureColumn();

    // Find meetings starting in the next 2 minutes that have a meeting URL but no bot yet
    const now = new Date();
    const twoMinLater = new Date(now.getTime() + 2 * 60 * 1000);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Also check calendar events from externe_kalenders for upcoming meetings
    // For now, check meetings table for entries with meetingUrl
    const upcoming = await db.all(sql`
      SELECT id, titel, datum FROM meetings
      WHERE datum >= ${fiveMinAgo.toISOString()}
        AND datum <= ${twoMinLater.toISOString()}
        AND recall_bot_id IS NULL
        AND status IS NULL
    `) as { id: number; titel: string; datum: string }[];

    const dispatched: string[] = [];

    for (const meeting of upcoming) {
      // Get meeting URL from metadata or meeting record
      const full = await db.all(sql`SELECT * FROM meetings WHERE id = ${meeting.id}`) as Record<string, unknown>[];
      const meetingUrl = (full[0]?.meeting_url as string) || null;

      if (!meetingUrl) continue;

      try {
        const bot = await createRecallBot(meetingUrl, meeting.titel);
        await db.run(sql`
          UPDATE meetings SET recall_bot_id = ${bot.id}, status = 'verwerken' WHERE id = ${meeting.id}
        `);
        dispatched.push(meeting.titel);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.run(sql`
          UPDATE meetings SET status = 'mislukt' WHERE id = ${meeting.id}
        `);
        dispatched.push(`${meeting.titel} (FOUT: ${msg})`);
      }
    }

    return NextResponse.json({ dispatched, checked: upcoming.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Auto-record mislukt" },
      { status: 500 }
    );
  }
}
