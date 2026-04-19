import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, slimmeTakenTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, or } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { classifyTaakCluster } from "@/lib/cluster";
import { ensureSystemTemplates, fillNaamTemplate, fillPromptTemplate } from "@/lib/slimme-taken";
import { formatSlotToIso } from "@/lib/agenda-slot-finder";

// POST /api/agenda/ai-plan — AI vult de dag met taken, gegroepeerd per cluster
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { datum } = await req.json();

    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    // Werkdag start/eind per dag-van-de-week. Werkdagen (ma-vr) 09:00-19:00,
    // weekend (zat/zon) 10:00-19:00. Sem en Syb delen dit ritme.
    const dagNr = new Date(`${datum}T12:00:00`).getDay(); // 0=Zo, 6=Za
    const isWeekend = dagNr === 0 || dagNr === 6;
    const DAG_START = isWeekend ? "10:00" : "09:00";
    const DAG_EIND = "19:00";
    const DAG_EIND_MS = new Date(`${datum}T${DAG_EIND}:00`).getTime();

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
        fase: taken.fase,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(or(eq(taken.status, "open"), eq(taken.status, "bezig")))
      .all();

    if (openTaken.length === 0) {
      return NextResponse.json({ fout: "Geen open taken om in te plannen" }, { status: 400 });
    }

    // Slimme taken (fase === "Slimme taken"*) worden NIET meegenomen in de
    // cluster-grouping. Ze krijgen dezelfde ingeplandStart als hun cluster-
    // mates zou de UI ze chainen in een Claude sessie-blok met label
    // "Slimme taken" — wat Sem expliciet niet wil. In plaats daarvan worden
    // ze alléén via de auto-fill stap gepland, waar ze elk een uniek slot
    // krijgen en dus als losse taken in de dag verschijnen.
    const isSlimmeTaak = (t: { fase: string | null }) =>
      t.fase === "Slimme taken" || t.fase === "Slimme taken (recurring)";

    // Split in Claude taken en handmatige taken
    const claudeTaken = openTaken.filter((t) => t.uitvoerder === "claude" && !isSlimmeTaak(t));
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
        // Schaal met aantal taken maar cap op 60 min zodat grote clusters
        // niet de hele ochtend opslokken. Was 30 min, te krap voor veel
        // backend/research werk.
        duur: Math.min(60, 15 + tks.length * 3),
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
        uitvoerder: taken.uitvoerder,
      })
      .from(taken)
      .where(or(eq(taken.status, "open"), eq(taken.status, "bezig")))
      .all();

    // Filter op de gevraagde dag + split in twee bucket types voor overlap
    // logica:
    //  - strikteBlokkers: handmatige taken waar Sem zelf achter zit; blokkeren
    //    alles wat er overheen wil.
    //  - claudeBlokkers: Claude sessie blokken; blokkeren ALLEEN andere Claude
    //    items. Handmatig mag gewoon overlappen (Sem is vrij terwijl Claude
    //    werkt — admin/bellen/mailen kunnen naast een Claude sessie).
    interface BlockingInterval {
      start: number; // ms
      eind: number;  // ms
      label: string;
    }
    // Handmatige taken die de AI gaat re-plannen mogen niet als strikte
    // blocker tellen tegen zichzelf — anders self-blockt elke handmatige
    // taak op z'n eigen huidige tijd, en verschuift de AI 'm naar een
    // ander slot ipv 'm te kunnen overlappen met Claude blokken (waar Sem
    // vrij is). Daarom skippen we alle openstaande handmatige in de
    // bestaande blocker-set.
    //
    // UITZONDERING: handmatige SLIMME taken (fase "Slimme taken") worden
    // NIET door de AI herplanned — ze worden alleen door auto-fill
    // aangemaakt met een vast slot. Die moeten WEL als blocker meetellen
    // zodat een tweede AI Plan run er niet overheen plaatst.
    const handmatigeIds = new Set(
      handmatigeTaken.filter((t) => !isSlimmeTaak(t)).map((t) => t.id)
    );
    const strikteBlokkers: BlockingInterval[] = [];
    const claudeBlokkers: BlockingInterval[] = [];
    for (const t of bestaandeIngepland) {
      if (!t.ingeplandStart?.startsWith(datum)) continue;
      if (t.uitvoerder !== "claude" && handmatigeIds.has(t.id)) continue;
      const s = new Date(t.ingeplandStart).getTime();
      const e = t.ingeplandEind ? new Date(t.ingeplandEind).getTime() : s + 30 * 60000;
      if (isNaN(s) || isNaN(e)) continue;
      const interval = { start: s, eind: e, label: t.titel };
      if (t.uitvoerder === "claude") claudeBlokkers.push(interval);
      else strikteBlokkers.push(interval);
    }
    // Voor de AI: menselijk leesbare lijst van bestaande intervals
    const alIngepland = [...strikteBlokkers, ...claudeBlokkers].map(
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
      system: `Je bent een productiviteitsplanner voor een softwarebedrijf (Autronis). Plan taken in een werkdag van ${DAG_START} tot ${DAG_EIND} met een lunchpauze van 12:30-13:00.

Regels:
- Prioriteit "HOOG" taken eerst, zo vroeg mogelijk
- Taken met een deadline vandaag of morgen hebben voorrang
- Schat de duur in als die niet is opgegeven. Sem werkt met AI en is extreem snel: development: 15-30min, meeting: 30min, administratie: 15min, complexe feature: 30-45min. De meeste taken duren 15 min. NOOIT langer dan 45 min per taak.
- Claude sessie blokken (negatieve ID's): ALTIJD duur gebruiken die hierboven is opgegeven. Plan ze VOLGORDELIJK achter elkaar, niet overlappend met elkaar. Eerste Claude sessie start ${DAG_START}.
- Laat 5-10 min pauze tussen Claude sessies onderling
- VUL DE DAG VOL van ${DAG_START} tot ${DAG_EIND} — ~10 uur werk. Laat geen gaten vallen.
- GROEPEER handmatige taken per cluster (bijv. alle "klantcontact" taken achter elkaar, alle "admin" taken achter elkaar). Cluster staat in de task lijst.
- Zware/creatieve taken in de ochtend, lichte taken na de lunch
- Als een taak niet inplanbaar is (bijv. wachten op iets), SKIP die taak
- Start en eind MOETEN het format "HH:MM" hebben
- BELANGRIJK: handmatige taken MOGEN en MOETEN overlappen met Claude sessie blokken — Sem is vrij terwijl Claude werkt. Dus plan admin, klantcontact, meetings, telefoon GEWOON NAAST/TIJDENS Claude blokken. Alleen handmatige development-taken waar Sem zelf achter de computer moet zitten plan je op momenten zonder Claude blok.

Antwoord ALLEEN met een JSON array, geen uitleg:
[{"id": 123, "start": "${DAG_START}", "eind": "09:30", "duur": 30}]`,
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
    // overlapt met de opgegeven blockers. Caller bepaalt welke blockers
    // meegenomen worden:
    //  - Voor Claude items: geef BEIDE buckets (claudeBlokkers + strikteBlokkers)
    //  - Voor handmatige taken: geef alleen strikteBlokkers zodat ze over
    //    Claude sessies heen mogen (Sem is vrij).
    function schuifNaarVrijSlot(
      startMs: number,
      duurMinuten: number,
      blockers: BlockingInterval[]
    ): { start: number; eind: number } | null {
      const duurMs = duurMinuten * 60000;
      let s = startMs;
      let e = s + duurMs;
      for (let iter = 0; iter < 25; iter++) {
        if (e > DAG_EIND_MS) return null;
        const botsing = blockers.find((b) => s < b.eind && e > b.start);
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
    // en geeft ze dezelfde start/eind. Claude blokken botsen met andere
    // Claude blokken EN met strikte handmatige taken, maar niet met lopende
    // handmatige taken die ze mogen overlappen.
    for (const blok of clusterBlokken) {
      const planItem = planning.find((item) => item.id === blok.fakeId);
      if (!planItem) continue;
      if (!tijdRegex.test(planItem.start) || !tijdRegex.test(planItem.eind)) continue;

      const voorgesteldStart = new Date(`${datum}T${planItem.start}:00`).getTime();
      if (isNaN(voorgesteldStart)) continue;

      const vrijSlot = schuifNaarVrijSlot(voorgesteldStart, planItem.duur, [
        ...claudeBlokkers,
        ...strikteBlokkers,
      ]);
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
      // Registreer dit blok als Claude-blocker — blokt andere Claude items
      // maar NIET handmatige taken (die mogen overheen).
      claudeBlokkers.push({
        start: vrijSlot.start,
        eind: vrijSlot.eind,
        label: `Claude sessie ${blok.cluster}`,
      });
    }

    // Plan handmatige taken individueel — alleen tegen strikte blockers,
    // zodat ze vrij over Claude sessies mogen lopen (Sem is vrij tijdens
    // Claude werk).
    for (const item of planning) {
      if (item.id < 0) continue; // Skip cluster blokken (al verwerkt)
      const taak = handmatigeTaken.find((t) => t.id === item.id);
      if (!taak) continue;
      if (!tijdRegex.test(item.start) || !tijdRegex.test(item.eind)) continue;

      const voorgesteldStart = new Date(`${datum}T${item.start}:00`).getTime();
      if (isNaN(voorgesteldStart)) continue;

      const vrijSlot = schuifNaarVrijSlot(voorgesteldStart, item.duur, strikteBlokkers);
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
      strikteBlokkers.push({
        start: vrijSlot.start,
        eind: vrijSlot.eind,
        label: taak.titel,
      });
    }

    // ==== Auto-fill met slimme taken ====
    // Alle slimme taken zijn Claude-uitvoerbaar, dus gebruiken de
    // claudeBlokkers+strikteBlokkers combinatie om naast handmatig/claude
    // werk geplaatst te worden (niet op elkaar). Vullen de dag van
    // DAG_START tot DAG_EIND.
    await ensureSystemTemplates();
    const slimmeTpls = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.isActief, 1))
      .orderBy(slimmeTakenTemplates.naam);

    const vandaagTitles = new Set<string>();
    for (const b of bestaandeIngepland) {
      if (b.ingeplandStart?.startsWith(datum)) vandaagTitles.add(b.titel);
    }
    for (const g of gepland) vandaagTitles.add(g.titel);

    // Cycle door templates heen totdat de dag vol is. Elke cycle krijgen
    // templates een uniek suffix " · herhaling N" zodat ze niet als
    // duplicaat worden geskipt. Stop bij de eerste cycle waar geen enkele
    // template meer past (dag vol) of na MAX_CYCLES om oneindige loops te
    // voorkomen.
    const MAX_CYCLES = 5;
    let autoGevuld = 0;
    for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
      let placedThisCycle = 0;
      for (const tpl of slimmeTpls) {
        const basisTitel = fillNaamTemplate(tpl.naam, {});
        const titel = cycle === 0 ? basisTitel : `${basisTitel} · herhaling ${cycle + 1}`;
        if (vandaagTitles.has(titel)) continue;

        const duur = tpl.geschatteDuur ?? 15;
        const isHandmatig = tpl.uitvoerder === "handmatig";
        // Handmatige slimme taken (LinkedIn posts, cold outreach, demo calls,
        // engagement) mogen OVERLAPPEN met Claude sessies — Sem is tijdens
        // Claude vrij. Maar niet met andere handmatige werk (die strikt blokt
        // zichzelf). Claude slimme taken botsen met beide buckets.
        const slotBlockers = isHandmatig ? strikteBlokkers : [...claudeBlokkers, ...strikteBlokkers];
        const slot = schuifNaarVrijSlot(
          new Date(`${datum}T${DAG_START}:00`).getTime(),
          duur,
          slotBlockers
        );
        if (!slot) continue; // geen plek meer voor deze template vandaag

        const prompt = fillPromptTemplate(tpl.prompt, {});
        const startISO = formatSlotToIso(slot.start);
        const eindISO = formatSlotToIso(slot.eind);

        const [nieuw] = await db
          .insert(taken)
          .values({
            projectId: null,
            aangemaaktDoor: gebruiker.id,
            toegewezenAan: null,
            eigenaar: "vrij",
            titel,
            omschrijving: tpl.beschrijving,
            cluster: tpl.cluster,
            fase: "Slimme taken",
            status: "open",
            prioriteit: "normaal",
            uitvoerder: isHandmatig ? "handmatig" : "claude",
            prompt: isHandmatig ? null : prompt,
            geschatteDuur: duur,
            ingeplandStart: startISO,
            ingeplandEind: eindISO,
          })
          .returning();

        gepland.push({
          id: nieuw.id,
          titel,
          start: formatTijd(slot.start),
          eind: formatTijd(slot.eind),
          cluster: tpl.cluster ?? undefined,
        });
        // Registreer in de juiste bucket — handmatig blokt andere handmatige,
        // claude blokt andere Claude items.
        if (isHandmatig) {
          strikteBlokkers.push({ start: slot.start, eind: slot.eind, label: titel });
        } else {
          claudeBlokkers.push({ start: slot.start, eind: slot.eind, label: titel });
        }
        vandaagTitles.add(titel);
        autoGevuld++;
        placedThisCycle++;
      }
      if (placedThisCycle === 0) break; // dag vol, geen enkele template paste meer
    }

    return NextResponse.json({
      succes: true,
      gepland,
      totaal: gepland.length,
      clusterBlokken: clusterBlokken.length,
      autoClusterGefaald,
      autoGevuld,
      overlapGeskipt: geskiptOverlap,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
