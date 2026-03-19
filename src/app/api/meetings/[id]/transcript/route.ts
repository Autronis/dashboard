import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, taken, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

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
  req: NextRequest,
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

    const body = (await req.json()) as { transcript?: string };
    const transcript = body.transcript;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { fout: "Transcript is verplicht" },
        { status: 400 }
      );
    }

    // Update transcript
    db.update(meetings)
      .set({ transcript, status: "verwerken" })
      .where(eq(meetings.id, meetingId))
      .run();

    // AI Analysis
    let analyse: AnalyseResultaat;
    try {
      analyse = await analyseTranscript(transcript);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "AI analyse mislukt";
      db.update(meetings)
        .set({ status: "mislukt" })
        .where(eq(meetings.id, meetingId))
        .run();
      return NextResponse.json({ fout: msg }, { status: 500 });
    }

    // Create taken from actiepunten
    createTakenFromActiepunten(
      analyse.actiepunten,
      meeting.projectId,
      gebruiker.id
    );

    // Update meeting with results
    db.update(meetings)
      .set({
        samenvatting: analyse.samenvatting,
        actiepunten: JSON.stringify(analyse.actiepunten),
        besluiten: JSON.stringify(analyse.besluiten),
        openVragen: JSON.stringify(analyse.openVragen),
        sentiment: analyse.sentiment,
        duurMinuten: analyse.duurMinuten,
        tags: JSON.stringify(analyse.tags),
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
