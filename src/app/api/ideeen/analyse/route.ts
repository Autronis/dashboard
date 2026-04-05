import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ideeen, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    // Get all ideas
    const alleIdeeen = await db
      .select({ id: ideeen.id, nummer: ideeen.nummer, naam: ideeen.naam, categorie: ideeen.categorie, status: ideeen.status, omschrijving: ideeen.omschrijving })
      .from(ideeen)
      .where(sql`${ideeen.categorie} != 'inzicht'`)
      .all();

    // Get all active/completed projects
    const alleProjecten = await db
      .select({ naam: projecten.naam, status: projecten.status })
      .from(projecten)
      .all();

    const client = Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Analyseer deze ideeën-backlog en identificeer problemen.

IDEEEN:
${alleIdeeen.map((i) => `ID:${i.id} | #${i.nummer || "-"} | ${i.status} | ${i.categorie} | ${i.naam} — ${i.omschrijving || ""}`).join("\n")}

ACTIEVE/AFGERONDE PROJECTEN:
${alleProjecten.map((p) => `- ${p.naam} (${p.status})`).join("\n")}

Zoek naar:
1. **Al gebouwd** — ideeën die matchen met actieve/afgeronde projecten maar nog status "idee" hebben
2. **Duplicaten** — ideeën die overlappen en samengevoegd kunnen worden (geef welke behouden en welke verwijderen)
3. **Verouderd** — ideeën die niet meer relevant zijn
4. **Notities als idee** — inzichten/notities die eigenlijk bij een bestaand project horen

Antwoord als JSON:
{
  "gebouwd": [{ "id": 1, "reden": "Is actief project X" }],
  "duplicaten": [{ "behouden_id": 1, "verwijder_id": 2, "reden": "Zelfde concept", "nieuwe_naam": "optioneel", "nieuwe_omschrijving": "optioneel" }],
  "verouderd": [{ "id": 1, "reden": "Niet meer relevant" }],
  "notities_bij_project": [{ "id": 1, "project": "Project X", "reden": "Hoort bij project X" }],
  "samenvatting": "Korte samenvatting van de analyse"
}

Alleen JSON.`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ fout: "Geen AI response" }, { status: 500 });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ fout: "Ongeldige response" }, { status: 500 });
    }

    const analyse = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ analyse, totaal: alleIdeeen.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
