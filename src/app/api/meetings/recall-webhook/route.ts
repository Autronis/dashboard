import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getRecallTranscript } from "@/lib/recall";

// Recall.ai webhook — called when bot status changes or transcript is ready
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const botId = body.data?.bot_id || body.bot_id;
    const event = body.event || body.data?.status?.code;

    if (!botId) return NextResponse.json({ ok: true });

    // Find meeting linked to this bot
    const meetings = await db.all(sql`
      SELECT id FROM meetings WHERE recall_bot_id = ${botId} LIMIT 1
    `) as { id: number }[];

    if (!meetings.length) return NextResponse.json({ ok: true });
    const meetingId = meetings[0].id;

    // Bot finished — fetch transcript and process
    if (event === "done" || event === "analysis_done" || body.status?.code === "done") {
      try {
        const transcript = await getRecallTranscript(botId);
        if (transcript) {
          await db.run(sql`
            UPDATE meetings SET transcript = ${transcript}, status = 'verwerken' WHERE id = ${meetingId}
          `);

          // Trigger AI processing
          const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
          fetch(`${baseUrl}/api/meetings/${meetingId}/transcript`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript, autoProcess: true }),
          }).catch(() => {});
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
