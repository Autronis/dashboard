import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, taken, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import Anthropic from "@anthropic-ai/sdk";

interface Actiepunt {
  tekst: string;
  verantwoordelijke: "Sem" | "Syb" | "Klant" | "Onbekend";
}

interface AnalyseResultaat {
  samenvatting: string;
  actiepunten: Actiepunt[];
  besluiten: string[];
  openVragen: string[];
}

async function transcribeAudio(audioPad: string): Promise<string> {
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

  const result = (await response.json()) as { text: string };
  return result.text;
}

async function analyseTranscript(
  transcript: string
): Promise<AnalyseResultaat> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY niet geconfigureerd");
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Je bent een meeting-assistent voor Autronis, een AI- en automatiseringsbedrijf.
Analyseer dit meeting-transcript en genereer:

1. samenvatting: 3-5 bullet points van de belangrijkste punten
2. actiepunten: concrete taken met wie verantwoordelijk is (formaat: {"tekst": "...", "verantwoordelijke": "Sem"|"Syb"|"Klant"|"Onbekend"})
3. besluiten: wat is er besloten
4. openVragen: wat moet nog uitgezocht/beantwoord worden

Transcript:
${transcript}

Antwoord als JSON:
{
  "samenvatting": "bullet points als string",
  "actiepunten": [{"tekst": "...", "verantwoordelijke": "..."}],
  "besluiten": ["..."],
  "openVragen": ["..."]
}
Alleen JSON, geen uitleg.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Geen tekst ontvangen van Claude");
  }

  const parsed = JSON.parse(textBlock.text) as AnalyseResultaat;
  return parsed;
}

function createTakenFromActiepunten(
  actiepunten: Actiepunt[],
  projectId: number | null,
  aanmakerGebruikerId: number
) {
  const alleGebruikers = db.select().from(gebruikers).all();

  for (const punt of actiepunten) {
    if (punt.verantwoordelijke === "Sem" || punt.verantwoordelijke === "Syb") {
      const gebruiker = alleGebruikers.find((g) =>
        g.naam.toLowerCase().includes(punt.verantwoordelijke.toLowerCase())
      );

      if (gebruiker) {
        db.insert(taken)
          .values({
            titel: punt.tekst,
            projectId,
            toegewezenAan: gebruiker.id,
            aangemaaktDoor: aanmakerGebruikerId,
            status: "open",
            prioriteit: "normaal",
          })
          .run();
      }
    }
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();

    const { id } = await params;
    const meetingId = Number(id);

    const meeting = db
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
        transcript = await transcribeAudio(meeting.audioPad);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Transcriptie mislukt";
        db.update(meetings)
          .set({ status: "mislukt" })
          .where(eq(meetings.id, meetingId))
          .run();
        return NextResponse.json({ fout: msg }, { status: 500 });
      }
    }

    if (!transcript) {
      db.update(meetings)
        .set({ status: "mislukt" })
        .where(eq(meetings.id, meetingId))
        .run();
      return NextResponse.json(
        { fout: "Geen audio of transcript beschikbaar" },
        { status: 400 }
      );
    }

    // Step 2: AI Analysis
    let analyse: AnalyseResultaat;
    try {
      analyse = await analyseTranscript(transcript);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "AI analyse mislukt";
      db.update(meetings)
        .set({ transcript, status: "mislukt" })
        .where(eq(meetings.id, meetingId))
        .run();
      return NextResponse.json({ fout: msg }, { status: 500 });
    }

    // Step 3: Create taken from actiepunten
    createTakenFromActiepunten(
      analyse.actiepunten,
      meeting.projectId,
      gebruiker.id
    );

    // Step 4: Update meeting
    db.update(meetings)
      .set({
        transcript,
        samenvatting: analyse.samenvatting,
        actiepunten: JSON.stringify(analyse.actiepunten),
        besluiten: JSON.stringify(analyse.besluiten),
        openVragen: JSON.stringify(analyse.openVragen),
        status: "klaar",
      })
      .where(eq(meetings.id, meetingId))
      .run();

    const updated = db
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
