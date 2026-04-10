import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { processMeeting } from "@/lib/meetings/analyse-meeting";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();

    const { id } = await params;
    const meetingId = Number(id);

    const meeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .get();

    if (!meeting) {
      return NextResponse.json(
        { fout: "Meeting niet gevonden" },
        { status: 404 }
      );
    }

    const body = (await req.json()) as { transcript?: string };
    const transcript = body.transcript;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { fout: "Transcript is verplicht" },
        { status: 400 }
      );
    }

    try {
      await processMeeting(meetingId, transcript, gebruiker.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Verwerking mislukt";
      return NextResponse.json({ fout: msg }, { status: 500 });
    }

    const updated = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .get();

    return NextResponse.json({ meeting: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
