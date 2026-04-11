import { db } from "@/lib/db";
import { meetings, taken, gebruikers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

export async function analyseTranscript(
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
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  if (data.usage) {
    logTokenUsage("openai", "gpt-4o-mini", data.usage.prompt_tokens, data.usage.completion_tokens, "/api/meetings/analyse");
  }

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Geen response van OpenAI");
  }

  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as AnalyseResultaat;
}

export async function createTakenFromActiepunten(
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

/**
 * Full meeting processing pipeline: AI analyse + taken aanmaken + DB update.
 * Used by both the recall webhook (no auth) and manual verwerk routes.
 */
export async function processMeeting(
  meetingId: number,
  transcript: string,
  aanmakerGebruikerId?: number
): Promise<void> {
  // Update status to processing
  await db.update(meetings)
    .set({ transcript, status: "verwerken" })
    .where(eq(meetings.id, meetingId))
    .run();

  const meeting = await db.select().from(meetings).where(eq(meetings.id, meetingId)).get();

  let analyse: AnalyseResultaat;
  try {
    analyse = await analyseTranscript(transcript);
  } catch (e) {
    await db.update(meetings)
      .set({ status: "mislukt" })
      .where(eq(meetings.id, meetingId))
      .run();
    throw e;
  }

  // Create taken (use gebruiker 1 = Sem as fallback for automated processing)
  const userId = aanmakerGebruikerId ?? 1;
  await createTakenFromActiepunten(analyse.actiepunten, meeting?.projectId ?? null, userId);

  // Update meeting with results
  await db.update(meetings)
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
}
