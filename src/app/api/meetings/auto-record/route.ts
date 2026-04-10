import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, externeKalenders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { createRecallBot, isRecallConfigured } from "@/lib/recall";

// Lightweight ICS parser for auto-record (reuse logic from meetings route)
function parseICSDate(value: string): Date | null {
  const clean = value.replace(/[^0-9TZ]/g, "");
  if (clean.length >= 15) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    const h = parseInt(clean.slice(9, 11), 10);
    const min = parseInt(clean.slice(11, 13), 10);
    const s = parseInt(clean.slice(13, 15), 10);
    if (clean.endsWith("Z")) return new Date(Date.UTC(y, m, d, h, min, s));
    return new Date(y, m, d, h, min, s);
  }
  if (clean.length >= 8) {
    return new Date(parseInt(clean.slice(0, 4), 10), parseInt(clean.slice(4, 6), 10) - 1, parseInt(clean.slice(6, 8), 10));
  }
  return null;
}

function extractMeetUrl(text: string): string | null {
  const match = text.match(/(https?:\/\/(?:meet\.google\.com|[\w.]*zoom\.us|teams\.microsoft\.com)[^\s\\)"]+)/i);
  return match ? match[1] : null;
}

async function ensureColumns() {
  try { await db.run(sql`ALTER TABLE meetings ADD COLUMN recall_bot_id TEXT`); } catch { /* exists */ }
  try { await db.run(sql`ALTER TABLE meetings ADD COLUMN meeting_url TEXT`); } catch { /* exists */ }
}

// POST /api/meetings/auto-record — Check upcoming meetings and dispatch bots
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }
  }

  try {
    if (!isRecallConfigured()) {
      return NextResponse.json({ fout: "Recall niet geconfigureerd" }, { status: 500 });
    }

    await ensureColumns();

    const now = new Date();
    const fiveMinAhead = new Date(now.getTime() + 5 * 60 * 1000);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const dispatched: string[] = [];

    // 1. Check DB meetings with meeting_url that need a bot
    const dbUpcoming = await db.all(sql`
      SELECT id, titel, datum, meeting_url FROM meetings
      WHERE datum >= ${fiveMinAgo.toISOString()}
        AND datum <= ${fiveMinAhead.toISOString()}
        AND meeting_url IS NOT NULL
        AND recall_bot_id IS NULL
        AND (status IS NULL OR status != 'mislukt')
    `) as { id: number; titel: string; datum: string; meeting_url: string }[];

    for (const meeting of dbUpcoming) {
      try {
        const bot = await createRecallBot(meeting.meeting_url, meeting.titel);
        await db.run(sql`UPDATE meetings SET recall_bot_id = ${bot.id}, status = 'verwerken' WHERE id = ${meeting.id}`);
        dispatched.push(`DB: ${meeting.titel}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.run(sql`UPDATE meetings SET status = 'mislukt' WHERE id = ${meeting.id}`);
        dispatched.push(`DB: ${meeting.titel} (FOUT: ${msg})`);
      }
    }

    // 2. Check calendar events for upcoming meetings with Google Meet/Zoom URLs
    const kalenders = await db
      .select({ id: externeKalenders.id, naam: externeKalenders.naam, url: externeKalenders.url })
      .from(externeKalenders)
      .where(eq(externeKalenders.isActief, 1))
      .all();

    for (const kalender of kalenders) {
      try {
        const res = await fetch(kalender.url, {
          headers: { "User-Agent": "Autronis-Dashboard/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const icsText = await res.text();
        const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
        const events = unfolded.split("BEGIN:VEVENT").slice(1);

        for (const eventBlock of events) {
          const getField = (name: string) => {
            const m = eventBlock.match(new RegExp(`^${name}[^:]*:(.+)$`, "m"));
            return m ? m[1].trim() : "";
          };

          const dtstart = getField("DTSTART");
          const summary = getField("SUMMARY");
          const location = getField("LOCATION");
          const description = eventBlock.match(/DESCRIPTION:([\s\S]*?)(?=\n[A-Z])/)?.[1]?.replace(/\\n/g, "\n") || "";
          const uid = getField("UID");

          const start = parseICSDate(dtstart);
          if (!start || isNaN(start.getTime())) continue;

          // Only events starting in the next 5 minutes
          if (start < fiveMinAgo || start > fiveMinAhead) continue;

          // Extract meeting URL from location or description
          const meetUrl = extractMeetUrl(location) || extractMeetUrl(description);
          if (!meetUrl) continue;

          // Check if already in DB (by UID or title+date)
          const existing = await db.all(sql`
            SELECT id FROM meetings
            WHERE (recall_bot_id IS NOT NULL OR meeting_url = ${meetUrl})
          `) as { id: number }[];
          if (existing.length > 0) continue;

          // Create DB meeting + dispatch bot
          const result = await db.run(sql`
            INSERT INTO meetings (titel, datum, meeting_url, status, aangemaakt_op)
            VALUES (${summary || "Kalender meeting"}, ${start.toISOString()}, ${meetUrl}, 'verwerken', datetime('now'))
          `);
          const meetingId = Number(result.lastInsertRowid);

          try {
            const bot = await createRecallBot(meetUrl, summary || "Meeting");
            await db.run(sql`UPDATE meetings SET recall_bot_id = ${bot.id} WHERE id = ${meetingId}`);
            dispatched.push(`Kalender: ${summary}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await db.run(sql`UPDATE meetings SET status = 'mislukt' WHERE id = ${meetingId}`);
            dispatched.push(`Kalender: ${summary} (FOUT: ${msg})`);
          }
        }
      } catch {
        // Skip failed calendars
      }
    }

    return NextResponse.json({ dispatched, checked: dbUpcoming.length, kalenders: kalenders.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Auto-record mislukt" },
      { status: 500 }
    );
  }
}
