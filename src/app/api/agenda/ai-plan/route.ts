import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, or, isNull } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

// POST /api/agenda/ai-plan — AI vult de dag met taken
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { datum } = await req.json();

    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    // Haal alle open/bezig taken op die NIET ingepland zijn
    const openTaken = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        status: taken.status,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        geschatteDuur: taken.geschatteDuur,
        uitvoerder: taken.uitvoerder,
        projectMap: taken.projectMap,
        projectNaam: projecten.naam,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(
        or(eq(taken.status, "open"), eq(taken.status, "bezig"))
      )
      .all();

    const nietIngepland = openTaken.filter((t) => !t.geschatteDuur || true); // alle open taken

    if (nietIngepland.length === 0) {
      return NextResponse.json({ fout: "Geen open taken om in te plannen" }, { status: 400 });
    }

    // Haal bestaande agenda items op voor die dag (om conflicten te voorkomen)
    const bestaandeIngepland = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        ingeplandStart: taken.ingeplandStart,
        ingeplandEind: taken.ingeplandEind,
      })
      .from(taken)
      .where(eq(taken.status, "open"))
      .all();

    const alIngepland = bestaandeIngepland
      .filter((t) => t.ingeplandStart?.startsWith(datum))
      .map((t) => `- ${t.titel}: ${t.ingeplandStart?.slice(11, 16)} – ${t.ingeplandEind?.slice(11, 16)}`);

    const takenLijst = nietIngepland.map((t) => {
      const parts = [`ID:${t.id} "${t.titel}"`];
      if (t.prioriteit === "hoog") parts.push("(HOOG)");
      if (t.uitvoerder === "claude") parts.push("[AI-TAAK]");
      if (t.deadline) parts.push(`deadline:${t.deadline}`);
      if (t.geschatteDuur) parts.push(`geschat:${t.geschatteDuur}min`);
      if (t.projectNaam) parts.push(`project:${t.projectNaam}`);
      return parts.join(" ");
    }).join("\n");

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `Je bent een productiviteitsplanner voor een softwarebedrijf (Autronis). Plan taken in een werkdag van 08:00 tot 17:00 met een lunchpauze van 12:00-12:30.

Regels:
- Prioriteit "HOOG" taken eerst, zo vroeg mogelijk
- Taken met een deadline vandaag of morgen hebben voorrang
- Schat de duur in als die niet is opgegeven. Sem werkt met AI en is extreem snel: development: 15-30min, meeting: 30min, administratie: 15min, complexe feature: 30-45min. De meeste taken duren 15 min. NOOIT langer dan 45 min per taak.
- Laat 5-10 min pauze tussen taken
- Maximaal 8 uur werk, niet alles hoeft gepland als er te veel is
- Groepeer vergelijkbare taken (bijv. administratie achter elkaar)
- BELANGRIJK: Groepeer [AI-TAAK] taken achter elkaar in één aaneengesloten blok. De gebruiker start deze als batch via Claude Code terwijl hij iets anders doet. Plan ze bij voorkeur als eerste blok van de dag of direct na de lunch.
- Zware/creatieve taken in de ochtend, lichte taken na de lunch

Antwoord ALLEEN met een JSON array, geen uitleg:
[{"id": 123, "start": "08:00", "eind": "09:30", "duur": 90}]`,
      messages: [{
        role: "user",
        content: `Plan deze taken in voor ${datum}:

${takenLijst}

${alIngepland.length > 0 ? `\nAl ingepland op deze dag (vermijd conflicten):\n${alIngepland.join("\n")}` : ""}`,
      }],
    });

    const tekst = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = tekst.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ fout: "AI kon geen planning maken" }, { status: 500 });
    }

    const planning: Array<{ id: number; start: string; eind: string; duur: number }> = JSON.parse(jsonMatch[0]);

    // Plan de taken in
    const gepland: Array<{ id: number; titel: string; start: string; eind: string }> = [];
    for (const item of planning) {
      const taak = nietIngepland.find((t) => t.id === item.id);
      if (!taak) continue;

      const startISO = `${datum}T${item.start}:00`;
      const eindISO = `${datum}T${item.eind}:00`;

      await db
        .update(taken)
        .set({
          ingeplandStart: startISO,
          ingeplandEind: eindISO,
          geschatteDuur: item.duur,
        })
        .where(eq(taken.id, item.id));

      gepland.push({ id: item.id, titel: taak.titel, start: item.start, eind: item.eind });
    }

    return NextResponse.json({ succes: true, gepland, totaal: gepland.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
