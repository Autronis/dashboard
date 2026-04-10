import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, taken, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { logTokenUsage } from "@/lib/ai/tracked-anthropic";

interface Actiepunt {
  tekst: string;
  verantwoordelijke: "Sem" | "Syb" | "Klant" | "Onbekend";
}

interface AnalyseResultaat {
  samenvatting: string;
  actiepunten: Actiepunt[];
  besluiten: string[];
  openVragen: string[];
  sentiment: string;
  duurMinuten: number | null;
  tags: string[];
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
  return JSON.stringify({ text: result.text, duration: result.duration || null });
}

async function analyseTranscript(
  transcript: string
): Promise<AnalyseResultaat> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY niet geconfigureerd");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Je bent een meeting-assistent voor Autronis, een AI- en automatiseringsbedrijf (Sem en Syb).
Analyseer meeting-transcripten en genereer gestructureerde output in JSON.`,
        },
        {
          role: "user",
          content: `Analyseer dit meeting-transcript en genereer:

1. samenvatting: 3-5 bullet points van de belangrijkste punten
2. actiepunten: concrete taken met wie verantwoordelijk is
3. besluiten: wat is er besloten
4. openVragen: wat moet nog uitgezocht/beantwoord worden
5. sentiment: korte beschrijving van de stemming/toon van het gesprek
6. duurMinuten: schat de duur in minuten op basis van de hoeveelheid content (null als niet te schatten)
7. tags: relevante tags (bijv. ["sales", "technisch", "intern", "klantgesprek"])

Transcript:
${transcript}

Antwoord als JSON:
{
  "samenvatting": "bullet points als string",
  "actiepunten": [{"tekst": "...", "verantwoordelijke": "Sem"|"Syb"|"Klant"|"Onbekend"}],
  "besluiten": ["..."],
  "openVragen": ["..."],
  "sentiment": "...",
  "duurMinuten": null,
  "tags": ["..."]
}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API fout: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Geen response van OpenAI");
  }

  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as AnalyseResultaat;
}

async function createTakenFromActiepunten(
  actiepunten: Actiepunt[],
  projectId: number | null,
  aanmakerGebruikerId: number
) {
  const alleGebruikers = await db.select().from(gebruikers).all();

  for (const punt of actiepunten) {
    if (punt.verantwoordelijke === "Sem" || punt.verantwoordelijke === "Syb") {
      const gebruiker = alleGebruikers.find((g) =>
        g.naam.toLowerCase().includes(punt.verantwoordelijke.toLowerCase())
      );

      if (gebruiker) {
        await db.insert(taken)
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
    let duurFromAudio: number | null = null;

    if (!transcript && meeting.audioPad) {
      try {
        const result = JSON.parse(await transcribeAudio(meeting.audioPad)) as { text: string; duration: number | null };
        transcript = result.text;
        if (result.duration) {
          duurFromAudio = Math.round(result.duration / 60);
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

    // Step 2: AI Analysis
    let analyse: AnalyseResultaat;
    try {
      analyse = await analyseTranscript(transcript);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "AI analyse mislukt";
      await db.update(meetings)
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
    const duur = duurFromAudio || analyse.duurMinuten || null;

    await db.update(meetings)
      .set({
        transcript,
        samenvatting: analyse.samenvatting,
        actiepunten: JSON.stringify(analyse.actiepunten),
        besluiten: JSON.stringify(analyse.besluiten),
        openVragen: JSON.stringify(analyse.openVragen),
        sentiment: analyse.sentiment,
        duurMinuten: duur,
        tags: JSON.stringify(analyse.tags),
        status: "klaar",
      })
      .where(eq(meetings.id, meetingId))
      .run();

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
