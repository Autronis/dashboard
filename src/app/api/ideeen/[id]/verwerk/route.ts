import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ideeen, projecten } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

// POST /api/ideeen/[id]/verwerk
// AI analyzes a note and suggests: link to project OR convert to idea
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const idee = await db
      .select()
      .from(ideeen)
      .where(eq(ideeen.id, Number(id)))
      .get();

    if (!idee) {
      return NextResponse.json({ fout: "Niet gevonden" }, { status: 404 });
    }

    const tekst = idee.omschrijving || idee.naam;

    // Get all active projects
    const activeProjecten = await db
      .select({ id: projecten.id, naam: projecten.naam, omschrijving: projecten.omschrijving })
      .from(projecten)
      .where(eq(projecten.status, "actief"))
      .all();

    // Get existing ideas (non-inzicht) for context
    const bestaandeIdeeen = await db
      .select({ naam: ideeen.naam, categorie: ideeen.categorie })
      .from(ideeen)
      .where(sql`${ideeen.categorie} != 'inzicht'`)
      .all();

    const client = Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Je bent een AI assistent voor Autronis, een AI- en automatiseringsbureau.

Analyseer deze notitie en bepaal de beste actie:

NOTITIE: "${tekst}"

ACTIEVE PROJECTEN:
${activeProjecten.map((p) => `- ${p.naam} (ID: ${p.id}): ${p.omschrijving || "geen omschrijving"}`).join("\n")}

BESTAANDE IDEEEN:
${bestaandeIdeeen.slice(0, 30).map((i) => `- ${i.naam} (${i.categorie})`).join("\n")}

Geef je antwoord als JSON met exact dit format:
{
  "actie": "project" | "idee",
  "reden": "korte uitleg waarom (1 zin)",
  "project": {
    "id": <project_id of null>,
    "naam": "<project naam>",
    "taakTitel": "<voorgestelde taak titel>"
  },
  "idee": {
    "naam": "<idee naam (max 60 tekens)>",
    "omschrijving": "<uitgebreide omschrijving>",
    "categorie": "dashboard" | "klant_verkoop" | "intern" | "dev_tools" | "content_media" | "geld_groei" | "experimenteel" | "website",
    "prioriteit": "laag" | "normaal" | "hoog"
  }
}

Kies "project" als de notitie duidelijk bij een bestaand project past (voeg toe als taak).
Kies "idee" als het een nieuw concept is dat nog niet bestaat.
Vul BEIDE objecten in (project en idee), zodat de gebruiker kan kiezen.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ fout: "Geen AI response" }, { status: 500 });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ fout: "Ongeldige AI response" }, { status: 500 });
    }

    const suggestie = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      notitieId: idee.id,
      notitieTekst: tekst,
      suggestie,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
