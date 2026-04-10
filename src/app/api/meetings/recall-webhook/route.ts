import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getRecallTranscript } from "@/lib/recall";
import { processMeeting } from "@/lib/meetings/analyse-meeting";

// Recall.ai webhook — called when bot status changes or transcript is ready
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const botId = body.data?.bot_id || body.bot_id;
    const event = body.event || body.data?.status?.code;

    if (!botId) return NextResponse.json({ ok: true });

    // Find meeting linked to this bot
    const rows = await db.all(sql`
      SELECT id FROM meetings WHERE recall_bot_id = ${botId} LIMIT 1
    `) as { id: number }[];

    if (!rows.length) return NextResponse.json({ ok: true });
    const meetingId = rows[0].id;

    // Bot finished — fetch transcript and process with AI
    if (event === "done" || event === "analysis_done" || body.status?.code === "done") {
      try {
        const transcript = await getRecallTranscript(botId);
        if (transcript) {
          // Process directly — no internal HTTP call needed
          await processMeeting(meetingId, transcript);
        }
      } catch {
        await db.run(sql`UPDATE meetings SET status = 'mislukt' WHERE id = ${meetingId}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
