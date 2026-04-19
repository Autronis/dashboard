import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, or } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { classifyTaakCluster } from "@/lib/cluster";

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

    // Auto-classify Claude taken zonder cluster via AI voordat we plannen.
    // Voorheen skipten we ze; nu labelt Haiku ze on-the-fly zodat ze landen
    // in de juiste cluster-blok. Als classify faalt komt de taak alsnog
    // in een "overig" cluster terecht — we skippen niks meer.
    const ongeclusterdeClaudeTaken = claudeTaken.filter((t) => !t.cluster);
    if (ongeclusterdeClaudeTaken.length > 0) {
      const classifications = await Promise.all(
        ongeclusterdeClaudeTaken.map((t) => classifyTaakCluster(t.id))
      );
      for (let i = 0; i < ongeclusterdeClaudeTaken.length; i++) {
        const cls = classifications[i];
        if (cls) ongeclusterdeClaudeTaken[i].cluster = cls;
      }
    }

    // Groepeer Claude taken per cluster. Taken die na classify-poging nog
    // steeds zonder cluster zijn (AI gefaald / API error) komen in "overig"
    // zodat ze alsnog ingepland worden.
    const claudeClusters = new Map<string, typeof claudeTaken>();
    let autoClusterGefaald = 0;
    for (const taak of claudeTaken) {
      const clusterKey = taak.cluster || "overig";
      if (!taak.cluster) autoClusterGefaald++;
      const bestaand = claudeClusters.get(clusterKey);
      if (bestaand) bestaand.push(taak);
      else claudeClusters.set(clusterKey, [taak]);
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

    // Bestaande ingeplande taken op deze dag (vermijd conflicten). We pakken
    // zowel open als bezig taken — je wil niet dat de AI overheen plant van
    // iets dat je al aan het doen bent.
    const bestaandeIngepland = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        ingeplandStart: taken.ingeplandStart,
        ingeplandEind: taken.ingeplandEind,
      })
      .from(taken)
      .where(or(eq(taken.status, "open"), eq(taken.status, "bezig")))
      .all();

    // Filter op de gevraagde dag + verzamel in een set van blocking
    // intervals [start, eind) voor server-side anti-overlap. Taken die we in
    // deze call zelf plannen worden NIET als blocker gebruikt bij hun eigen
    // plan-stap (we filteren op id), maar wel bij opvolgende items.
    interface BlockingInterval {
      start: number; // ms
      eind: number;  // ms
      label: string;
    }
    const blockingIntervals: BlockingInterval[] = [];
    for (const t of bestaandeIngepland) {
      if (!t.ingeplandStart?.startsWith(datum)) continue;
      const s = new Date(t.ingeplandStart).getTime();
      const e = t.ingeplandEind ? new Date(t.ingeplandEind).getTime() : s + 30 * 60000;
      if (isNaN(s) || isNaN(e)) continue;
      blockingIntervals.push({ start: s, eind: e, label: t.titel });
    }
    // Voor de AI: menselijk leesbare lijst van bestaande intervals
    const alIngepland = blockingIntervals.map(
      (b) => `- ${b.label}: ${new Date(b.start).toTimeString().slice(0, 5)}–${new Date(b.eind).toTimeString().slice(0, 5)}`
    );

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

    // Alles wordt nu ingepland (auto-classify hierboven). Alleen een debug-
    // regel meegeven als de classify-API zelf faalde voor sommige taken.
    const ongegroepeerdInfo = autoClusterGefaald > 0
      ? `\n\nNB: ${autoClusterGefaald} Claude taken konden niet auto-geclassified worden en landen in een "overig" blok.`
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
    let geskiptOverlap = 0;

    // Helper: shift een voorgesteld [start, eind] slot totdat 't niet meer
    // overlapt met enige blocker. Check vanaf 08:00, max 12 iteraties.
    // Respecteert ook de werkdag boundary (niet later dan 17:00).
    function schuifNaarVrijSlot(
      startMs: number,
      duurMinuten: number
    ): { start: number; eind: number } | null {
      const DAG_EIND = new Date(`${datum}T17:00:00`).getTime();
      const duurMs = duurMinuten * 60000;
      let s = startMs;
      let e = s + duurMs;
      for (let iter = 0; iter < 20; iter++) {
        if (e > DAG_EIND) return null;
        const botsing = blockingIntervals.find((b) => s < b.eind && e > b.start);
        if (!botsing) return { start: s, eind: e };
        // Schuif naar het einde van de botsende blocker + 5 min buffer
        s = botsing.eind + 5 * 60000;
        e = s + duurMs;
      }
      return null;
    }

    function formatTijd(ms: number): string {
      const d = new Date(ms);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    // Plan de cluster blokken — elk blok pakt alle taken uit diens cluster
    // en geeft ze dezelfde start/eind
    for (const blok of clusterBlokken) {
      const planItem = planning.find((item) => item.id === blok.fakeId);
      if (!planItem) continue;
      if (!tijdRegex.test(planItem.start) || !tijdRegex.test(planItem.eind)) continue;

      const voorgesteldStart = new Date(`${datum}T${planItem.start}:00`).getTime();
      if (isNaN(voorgesteldStart)) continue;

      // Check tegen bestaande blockers + al-geplande items uit deze call
      const vrijSlot = schuifNaarVrijSlot(voorgesteldStart, planItem.duur);
      if (!vrijSlot) {
        geskiptOverlap++;
        continue; // geen plek op de dag, skip dit cluster blok
      }

      const startISO = `${datum}T${formatTijd(vrijSlot.start)}:00`;
      const eindISO = `${datum}T${formatTijd(vrijSlot.eind)}:00`;

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
          start: formatTijd(vrijSlot.start),
          eind: formatTijd(vrijSlot.eind),
          cluster: blok.cluster,
        });
      }
      // Registreer dit blok als blocker voor volgende items
      blockingIntervals.push({
        start: vrijSlot.start,
        eind: vrijSlot.eind,
        label: `Claude sessie ${blok.cluster}`,
      });
    }

    // Plan handmatige taken individueel — zelfde anti-overlap logica
    for (const item of planning) {
      if (item.id < 0) continue; // Skip cluster blokken (al verwerkt)
      const taak = handmatigeTaken.find((t) => t.id === item.id);
      if (!taak) continue;
      if (!tijdRegex.test(item.start) || !tijdRegex.test(item.eind)) continue;

      const voorgesteldStart = new Date(`${datum}T${item.start}:00`).getTime();
      if (isNaN(voorgesteldStart)) continue;

      const vrijSlot = schuifNaarVrijSlot(voorgesteldStart, item.duur);
      if (!vrijSlot) {
        geskiptOverlap++;
        continue;
      }

      const startISO = `${datum}T${formatTijd(vrijSlot.start)}:00`;
      const eindISO = `${datum}T${formatTijd(vrijSlot.eind)}:00`;

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
        start: formatTijd(vrijSlot.start),
        eind: formatTijd(vrijSlot.eind),
        cluster: taak.cluster ?? undefined,
      });
      // Registreer als blocker voor volgende items
      blockingIntervals.push({
        start: vrijSlot.start,
        eind: vrijSlot.eind,
        label: taak.titel,
      });
    }

    return NextResponse.json({
      succes: true,
      gepland,
      totaal: gepland.length,
      clusterBlokken: clusterBlokken.length,
      autoClusterGefaald,
      overlapGeskipt: geskiptOverlap,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
