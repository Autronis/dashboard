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
          content: `Analyseer dit meeting-transcript en genereer gestructureerde output.

Formatting regels voor de samenvatting:
- Gebruik 3 tot 5 regels
- Elke regel is een complete Nederlandse zin met correcte interpunctie (hoofdletter, punt aan het eind)
- Elke regel begint met "- " (streepje + spatie)
- Scheid regels met echte newline-karakters (\\n), NIET met komma's of semikolons
- Geen opsommingen binnen één regel met komma's

Voorbeeld van een correcte samenvatting string:
"- Sem en Syb hebben afgesproken de prijs van €500 naar €1000 te verhogen.\\n- Er wordt een nieuwe meeting gepland met Siep.\\n- Een bonusoptie voor agressievere dienstverlening is besproken."

Voor de andere velden:
- actiepunten: concrete taken met wie verantwoordelijk is
- besluiten: wat is er besloten (array van zinnen)
- openVragen: wat moet nog uitgezocht worden (array van zinnen)
- sentiment: korte beschrijving van stemming/toon
- duurMinuten: schat op basis van content (null als niet te schatten)
- tags: relevante tags (bv. ["sales", "technisch", "intern"])

Transcript:
${transcript}

Antwoord als JSON (geen extra tekst eromheen):
{
  "samenvatting": "- Zin 1.\\n- Zin 2.\\n- Zin 3.",
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
