import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { logTokenUsage } from "@/lib/ai/tracked-anthropic";
import { processMeeting } from "@/lib/meetings/analyse-meeting";

async function transcribeAudio(audioPad: string): Promise<{ text: string; duration: number | null }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY niet geconfigureerd");
  }

  const audioBuffer = await readFile(audioPad);
  const ext = audioPad.split(".").pop() || "webm";
  const fileName = `audio.${ext}`;

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: `audio/${ext}` }),
    fileName
  );
  formData.append("model", "whisper-large-v3");
  formData.append("language", "nl");
  formData.append("response_format", "verbose_json");

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq Whisper API fout: ${response.status} - ${errorBody}`);
  }

  const result = (await response.json()) as { text: string; duration?: number };

  if (result.duration) {
    logTokenUsage("groq", "whisper-large-v3", 0, 0, "/api/meetings/verwerk");
  }

  return { text: result.text, duration: result.duration ?? null };
}

export async function POST(
  _req: NextRequest,
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

    // Step 1: Transcription (if audio exists and no transcript yet)
    let transcript = meeting.transcript;

    if (!transcript && meeting.audioPad) {
      try {
        const result = await transcribeAudio(meeting.audioPad);
        transcript = result.text;
        if (result.duration) {
          await db.update(meetings)
            .set({ duurMinuten: Math.round(result.duration / 60) })
            .where(eq(meetings.id, meetingId))
            .run();
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Transcriptie mislukt";
        await db.update(meetings)
          .set({ status: "mislukt" })
          .where(eq(meetings.id, meetingId))
          .run();
        return NextResponse.json({ fout: msg }, { status: 500 });
      }
    }

    if (!transcript) {
      await db.update(meetings)
        .set({ status: "mislukt" })
        .where(eq(meetings.id, meetingId))
        .run();
      return NextResponse.json(
        { fout: "Geen audio of transcript beschikbaar" },
        { status: 400 }
      );
    }

    // Step 2: AI Analysis + taken + DB update
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
