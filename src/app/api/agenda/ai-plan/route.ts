import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, or } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

// POST /api/agenda/ai-plan — AI vult de dag met taken
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { datum } = await req.json();

    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    // Haal alle open/bezig taken op
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
      .where(or(eq(taken.status, "open"), eq(taken.status, "bezig")))
      .all();

    if (openTaken.length === 0) {
      return NextResponse.json({ fout: "Geen open taken om in te plannen" }, { status: 400 });
    }

    // Split in Claude taken en handmatige taken
    const claudeTaken = openTaken.filter((t) => t.uitvoerder === "claude");
    const handmatigeTaken = openTaken.filter((t) => t.uitvoerder !== "claude");

    // Bereken Claude sessie duur: 15 min per taak, min 15, max 120
    const claudeSessieDuur = claudeTaken.length > 0
      ? Math.min(120, Math.max(15, claudeTaken.length * 15))
      : 0;

    // Bestaande ingeplande taken op deze dag (vermijd conflicten)
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

    // Bouw de takenlijst voor AI — ZONDER Claude taken (die plannen we zelf)
    const takenLijst = handmatigeTaken.map((t) => {
      const parts = [`ID:${t.id} "${t.titel}"`];
      if (t.prioriteit === "hoog") parts.push("(HOOG)");
      if (t.deadline) parts.push(`deadline:${t.deadline}`);
      if (t.geschatteDuur) parts.push(`geschat:${t.geschatteDuur}min`);
      if (t.projectNaam) parts.push(`project:${t.projectNaam}`);
      return parts.join(" ");
    }).join("\n");

    // Claude sessie info voor de AI planner
    const claudeBlokInfo = claudeSessieDuur > 0
      ? `\nBELANGRIJK: Er is een "Claude sessie" blok van ${claudeSessieDuur} minuten nodig (ID:-1). Dit is een AI-sessie die ${claudeTaken.length} taken AUTOMATISCH uitvoert — Sem hoeft hier NIKS voor te doen. Plan dit blok als EERSTE van de dag (start 08:00).

CRUCIAAL: Sem is VOLLEDIG VRIJ tijdens de Claude sessie. Je MOET niet-development taken (administratie, meetings, communicatie, telefoon, planning) TIJDENS de Claude sessie plannen. Dat is het hele punt — Claude werkt, Sem doet ondertussen admin/sales/meetings. Plan deze taken dus OVERLAPPEND met het Claude sessie blok (tussen 08:00 en het einde van de sessie). Alleen development taken die Sem ZELF achter de computer moet doen plan je NA de Claude sessie.`
      : "";

    const client = Anthropic(undefined, "/api/agenda/ai-plan");

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
- Zware/creatieve taken in de ochtend, lichte taken na de lunch
- Als een taak niet inplanbaar is (bijv. wachten op iets), SKIP die taak
- Start en eind MOETEN het format "HH:MM" hebben
- Als er een Claude sessie (ID:-1) is: plan meetings, admin en communicatie taken TIJDENS die sessie (Sem is vrij). Plan development taken die Sem ZELF moet doen PAS NA de sessie.

Antwoord ALLEEN met een JSON array, geen uitleg:
[{"id": 123, "start": "08:00", "eind": "08:30", "duur": 30}]`,
      messages: [{
        role: "user",
        content: `Plan deze taken in voor ${datum}:
${claudeBlokInfo}

${takenLijst || "(Geen handmatige taken)"}

${alIngepland.length > 0 ? `\nAl ingepland op deze dag (vermijd conflicten):\n${alIngepland.join("\n")}` : ""}`,
      }],
    });

    const tekst = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = tekst.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ fout: "AI kon geen planning maken" }, { status: 500 });
    }

    const planning: Array<{ id: number; start: string; eind: string; duur: number }> = JSON.parse(jsonMatch[0]);

    const tijdRegex = /^\d{2}:\d{2}$/;
    const gepland: Array<{ id: number; titel: string; start: string; eind: string }> = [];

    // Plan het Claude sessie blok (ID:-1) — alle Claude taken krijgen dezelfde start/eind
    const claudeBlok = planning.find((item) => item.id === -1);
    if (claudeBlok && claudeTaken.length > 0 && tijdRegex.test(claudeBlok.start) && tijdRegex.test(claudeBlok.eind)) {
      const startISO = `${datum}T${claudeBlok.start}:00`;
      const eindISO = `${datum}T${claudeBlok.eind}:00`;

      if (!isNaN(new Date(startISO).getTime()) && !isNaN(new Date(eindISO).getTime())) {
        for (const taak of claudeTaken) {
          await db
            .update(taken)
            .set({
              ingeplandStart: startISO,
              ingeplandEind: eindISO,
              geschatteDuur: claudeBlok.duur,
            })
            .where(eq(taken.id, taak.id));

          gepland.push({ id: taak.id, titel: taak.titel, start: claudeBlok.start, eind: claudeBlok.eind });
        }
      }
    }

    // Plan handmatige taken individueel
    for (const item of planning) {
      if (item.id === -1) continue; // Skip Claude blok (al verwerkt)
      const taak = handmatigeTaken.find((t) => t.id === item.id);
      if (!taak) continue;
      if (!tijdRegex.test(item.start) || !tijdRegex.test(item.eind)) continue;

      const startISO = `${datum}T${item.start}:00`;
      const eindISO = `${datum}T${item.eind}:00`;
      if (isNaN(new Date(startISO).getTime()) || isNaN(new Date(eindISO).getTime())) continue;

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
