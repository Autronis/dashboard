import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, or } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

// POST /api/agenda/ai-plan — AI vult de dag met taken, gegroepeerd per cluster
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
        cluster: taken.cluster,
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

    // Groepeer Claude taken per cluster. Taken zonder cluster komen in
    // een "overig" groep die we SKIPPEN — Sem heeft expliciet gezegd dat
    // ongegroepeerde taken niet door elkaar gepland moeten worden. Hij
    // moet eerst Auto-cluster runnen om ze te labelen.
    const claudeClusters = new Map<string, typeof claudeTaken>();
    const claudeZonderCluster: typeof claudeTaken = [];
    for (const taak of claudeTaken) {
      if (taak.cluster) {
        const bestaand = claudeClusters.get(taak.cluster);
        if (bestaand) bestaand.push(taak);
        else claudeClusters.set(taak.cluster, [taak]);
      } else {
        claudeZonderCluster.push(taak);
      }
    }

    // Maak per cluster een virtueel blok. Fake id's zijn negatief
    // (-1, -2, -3, ...) zodat ze niet conflicteren met echte taak ids.
    // Elk blok is max 30 min — Claude doet meerdere taken per sessie.
    interface ClusterBlok {
      fakeId: number;
      cluster: string;
      duur: number;
      taakIds: number[];
    }
    const clusterBlokken: ClusterBlok[] = [];
    let blokIndex = 0;
    for (const [cluster, tks] of claudeClusters) {
      blokIndex++;
      clusterBlokken.push({
        fakeId: -blokIndex,
        cluster,
        duur: Math.min(30, 8 + tks.length * 2),
        taakIds: tks.map((t) => t.id),
      });
    }

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

    // Bouw de takenlijst voor AI — ZONDER Claude taken (die plannen we als blokken).
    // Handmatige taken krijgen ook hun cluster mee zodat de AI ze kan groeperen.
    const takenLijst = handmatigeTaken.map((t) => {
      const parts = [`ID:${t.id} "${t.titel}"`];
      if (t.prioriteit === "hoog") parts.push("(HOOG)");
      if (t.deadline) parts.push(`deadline:${t.deadline}`);
      if (t.geschatteDuur) parts.push(`geschat:${t.geschatteDuur}min`);
      if (t.projectNaam) parts.push(`project:${t.projectNaam}`);
      if (t.cluster) parts.push(`cluster:${t.cluster}`);
      return parts.join(" ");
    }).join("\n");

    // Cluster-blok info voor de AI planner. Voor elke cluster een apart
    // "Claude sessie" blok. Sem is vrij tijdens elke Claude sessie.
    const clusterBlokInfo = clusterBlokken.length > 0
      ? `\nBELANGRIJK: Er zijn ${clusterBlokken.length} Claude sessie blok(ken) nodig, één per cluster. Plan ze VOLGORDELIJK achter elkaar (niet overlappend met elkaar). Elk blok is één Claude chat-sessie waarin meerdere taken uit datzelfde cluster worden afgewerkt — Claude doet meerdere taken per beurt, niet 15 min per taak.

${clusterBlokken.map((b) => `- ID:${b.fakeId} = "Claude sessie ${b.cluster}" (${b.taakIds.length} taken, ${b.duur} min)`).join("\n")}

CRUCIAAL: Sem is VOLLEDIG VRIJ tijdens elke Claude sessie. Plan niet-development taken (administratie, meetings, communicatie, telefoon, planning, klantcontact) GEWOON NAAST/OVERLAPPEND met de Claude sessie blokken. Claude werkt, Sem doet ondertussen admin/sales/meetings. Alleen taken die Sem ZELF achter de computer moet doen plan je op momenten dat er geen Claude blok overlapt.`
      : "";

    // Informeer de AI over ongegroepeerde Claude taken (zonder cluster) —
    // die plannen we NIET in. Sem moet eerst Auto-cluster runnen.
    const ongegroepeerdInfo = claudeZonderCluster.length > 0
      ? `\n\nLET OP: ${claudeZonderCluster.length} Claude taken hebben GEEN cluster en worden niet ingepland. Sem moet eerst de Auto-cluster knop draaien op /taken om ze te labelen.`
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
- Claude sessie blokken (negatieve ID's): ALTIJD duur gebruiken die hierboven is opgegeven (max 30 min). Plan ze VOLGORDELIJK achter elkaar, niet overlappend met elkaar. Eerste Claude sessie start 08:00.
- Laat 5-10 min pauze tussen taken
- Maximaal 8 uur werk, niet alles hoeft gepland als er te veel is
- GROEPEER handmatige taken per cluster (bijv. alle "klantcontact" taken achter elkaar, alle "admin" taken achter elkaar). Cluster staat in de task lijst.
- Zware/creatieve taken in de ochtend, lichte taken na de lunch
- Als een taak niet inplanbaar is (bijv. wachten op iets), SKIP die taak
- Start en eind MOETEN het format "HH:MM" hebben
- Als er Claude sessie blokken zijn: plan meetings, admin en klantcontact taken TIJDENS die blokken (Sem is vrij). Plan development/frontend taken die Sem ZELF moet doen NA alle Claude sessies.

Antwoord ALLEEN met een JSON array, geen uitleg:
[{"id": 123, "start": "08:00", "eind": "08:30", "duur": 30}]`,
      messages: [{
        role: "user",
        content: `Plan deze taken in voor ${datum}:
${clusterBlokInfo}${ongegroepeerdInfo}

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
    const gepland: Array<{ id: number; titel: string; start: string; eind: string; cluster?: string }> = [];

    // Plan de cluster blokken — elk blok pakt alle taken uit diens cluster
    // en geeft ze dezelfde start/eind
    for (const blok of clusterBlokken) {
      const planItem = planning.find((item) => item.id === blok.fakeId);
      if (!planItem) continue;
      if (!tijdRegex.test(planItem.start) || !tijdRegex.test(planItem.eind)) continue;

      const startISO = `${datum}T${planItem.start}:00`;
      const eindISO = `${datum}T${planItem.eind}:00`;
      if (isNaN(new Date(startISO).getTime()) || isNaN(new Date(eindISO).getTime())) continue;

      for (const taakId of blok.taakIds) {
        const taak = claudeTaken.find((t) => t.id === taakId);
        if (!taak) continue;
        await db
          .update(taken)
          .set({
            ingeplandStart: startISO,
            ingeplandEind: eindISO,
            geschatteDuur: planItem.duur,
          })
          .where(eq(taken.id, taakId));

        gepland.push({
          id: taakId,
          titel: taak.titel,
          start: planItem.start,
          eind: planItem.eind,
          cluster: blok.cluster,
        });
      }
    }

    // Plan handmatige taken individueel
    for (const item of planning) {
      if (item.id < 0) continue; // Skip cluster blokken (al verwerkt)
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

      gepland.push({
        id: item.id,
        titel: taak.titel,
        start: item.start,
        eind: item.eind,
        cluster: taak.cluster ?? undefined,
      });
    }

    return NextResponse.json({
      succes: true,
      gepland,
      totaal: gepland.length,
      clusterBlokken: clusterBlokken.length,
      ongegroepeerdGeskipt: claudeZonderCluster.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
