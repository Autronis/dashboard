import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeSamenvattingen, screenTimeEntries, projecten, agendaItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const datum = new URL(req.url).searchParams.get("datum");
    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    const samenvatting = await db
      .select()
      .from(screenTimeSamenvattingen)
      .where(
        and(
          eq(screenTimeSamenvattingen.gebruikerId, gebruiker.id),
          eq(screenTimeSamenvattingen.datum, datum)
        )
      )
      .get();

    return NextResponse.json({ samenvatting: samenvatting || null });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { datum } = body;
    if (!datum) {
      return NextResponse.json({ fout: "Datum is verplicht" }, { status: 400 });
    }

    // Gather day's data grouped by app+project
    const entries = await db
      .select({
        app: screenTimeEntries.app,
        categorie: screenTimeEntries.categorie,
        vensterTitel: screenTimeEntries.vensterTitel,
        projectNaam: projecten.naam,
        duurSeconden: screenTimeEntries.duurSeconden,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruiker.id),
          gte(screenTimeEntries.startTijd, `${datum}T00:00:00`),
          lte(screenTimeEntries.startTijd, `${datum}T23:59:59`)
        )
      )
      .all();

    if (entries.length === 0) {
      return NextResponse.json({ fout: "Geen data voor deze datum" }, { status: 404 });
    }

    // Aggregate per app+project
    const perApp: Record<string, { seconden: number; categorie: string; project: string | null; titels: Set<string> }> = {};
    let totaalSeconden = 0;
    let productiefSeconden = 0;

    for (const e of entries) {
      if (e.categorie === "inactief") continue;
      const key = `${e.app}|${e.projectNaam || ""}`;
      if (!perApp[key]) {
        perApp[key] = { seconden: 0, categorie: e.categorie ?? "overig", project: e.projectNaam, titels: new Set() };
      }
      perApp[key].seconden += e.duurSeconden;
      if (e.vensterTitel) perApp[key].titels.add(e.vensterTitel);
      totaalSeconden += e.duurSeconden;
      if (e.categorie && ["development", "design", "administratie"].includes(e.categorie)) {
        productiefSeconden += e.duurSeconden;
      }
    }

    // Cap at 16 hours to prevent impossible data from idle tracking
    const MAX_DAGELIJKSE_SECONDEN = 57600; // 16 uur
    const ongecaptSeconden = totaalSeconden;
    totaalSeconden = Math.min(totaalSeconden, MAX_DAGELIJKSE_SECONDEN);
    productiefSeconden = Math.min(productiefSeconden, totaalSeconden);

    const productiefPercentage = totaalSeconden > 0 ? Math.round((productiefSeconden / totaalSeconden) * 100) : 0;
    const topProject = Object.values(perApp).sort((a, b) => b.seconden - a.seconden)[0]?.project || null;
    const mogelijkOnnauwkeurig = ongecaptSeconden > 43200; // > 12 hours

    // Build rich context for Claude with window titles
    const activiteitenLijst = Object.entries(perApp)
      .sort(([, a], [, b]) => b.seconden - a.seconden)
      .map(([key, v]) => {
        const uren = Math.floor(v.seconden / 3600);
        const minuten = Math.round((v.seconden % 3600) / 60);
        const duur = uren > 0 ? `${uren}u ${minuten}m` : `${minuten}m`;
        const titels = Array.from(v.titels).slice(0, 20);

        // Extract project names from VS Code titles
        const projecten = new Set<string>();
        const bestanden = new Set<string>();
        for (const t of titels) {
          const vsMatch = t.match(/^(.+?)\s*[-—]\s*(.+?)\s*[-—]\s*(?:Visual Studio Code|Cursor)$/);
          if (vsMatch) { bestanden.add(vsMatch[1].trim()); projecten.add(vsMatch[2].trim()); }
          const claudeMatch = t.match(/^(.+?)\s*[-—]\s*Claude(?:\s|$)/);
          if (claudeMatch) projecten.add(`Claude: ${claudeMatch[1].trim()}`);
          const chromeMatch = t.match(/^(.+?)\s*[-—]\s*Google Chrome$/);
          if (chromeMatch) projecten.add(chromeMatch[1].trim());
          const termMatch = t.match(/(?:~\/|\/Users\/\w+\/)(?:.*\/)?([^\/\s]+)/);
          if (termMatch) projecten.add(termMatch[1].trim());
        }

        const projectStr = projecten.size > 0 ? ` (projecten: ${Array.from(projecten).join(", ")})` : "";
        const bestandStr = bestanden.size > 0 ? ` bestanden: ${Array.from(bestanden).slice(0, 10).join(", ")}` : "";
        const titelStr = titels.length > 0 ? `\n  vensters: ${titels.slice(0, 10).join(" | ")}` : "";
        return `- ${key.split("|")[0]} [${v.categorie}] ${duur}${projectStr}${bestandStr}${titelStr}`;
      })
      .join("\n");

    // Fetch agenda items for calendar context
    const agendaDag = await db
      .select({
        titel: agendaItems.titel,
        type: agendaItems.type,
        startDatum: agendaItems.startDatum,
        eindDatum: agendaItems.eindDatum,
      })
      .from(agendaItems)
      .where(
        and(
          eq(agendaItems.gebruikerId, gebruiker.id),
          gte(agendaItems.startDatum, `${datum}T00:00:00`),
          lte(agendaItems.startDatum, `${datum}T23:59:59`)
        )
      )
      .orderBy(asc(agendaItems.startDatum))
      .all();

    const agendaStr = agendaDag.length > 0
      ? `\nAGENDA ITEMS:\n${agendaDag.map(a => {
          const start = new Date(a.startDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
          const eind = a.eindDatum ? new Date(a.eindDatum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "";
          return `- ${start}${eind ? `-${eind}` : ""}: ${a.titel} (${a.type ?? "afspraak"})`;
        }).join("\n")}\n`
      : "";

    const { text: tekst } = await aiComplete({
      prompt: `Datum: ${datum}
Totale actieve tijd: ${Math.floor(totaalSeconden / 3600)}u ${Math.round((totaalSeconden % 3600) / 60)}m
Productief: ${productiefPercentage}%${mogelijkOnnauwkeurig ? "\nLET OP: De actieve tijd was oorspronkelijk " + Math.floor(ongecaptSeconden / 3600) + "u, wat onrealistisch is. Vermeldt dit kort: 'Mogelijk onnauwkeurige data door idle tracking.'" : ""}
${agendaStr}
Activiteiten met details:
${activiteitenLijst}

Genereer JSON:
{
  "kort": "3-4 zinnen. Beschrijf CONCREET wat Sem heeft gedaan, niet alleen welke apps open stonden. Leid af uit bestandsnamen en venstertitels WAT er gebouwd/bewerkt is. Voorbeeld: 'Screen time regels en locatie-detectie verbeterd in het Autronis Dashboard. Email-feature gebouwd voor documenten module. 3u development in VS Code, 30m communicatie via Discord. Tussendoor YouTube tutorials over Claude API gekeken.'",
  "detail": "Gedetailleerd markdown overzicht. Per project een ## heading met:\n- Wat er concreet gedaan is (afgeleid uit bestandsnamen, venstertitels, URLs)\n- Welke bestanden/componenten er bewerkt zijn\n- Hoelang per activiteit\n- Als er Claude Code of terminal tijd was: wat werd er waarschijnlijk gebouwd/gefixt\nWees specifiek, niet vaag. 'Gewerkt aan dashboard' is FOUT. 'Tijdregistratie locatie-toggle gebouwd, print CSS herschreven voor documenten export' is GOED."
}

Alleen JSON, geen uitleg.`,
      system: `Je bent een productiviteitsassistent voor Sem, developer bij Autronis (AI/automation bureau, VOF met Syb).
Je analyseert schermtijd data en schrijft CONCRETE, SPECIFIEKE samenvattingen.

REGELS:
- Leid uit bestandsnamen af WELKE feature/component er gebouwd werd (bijv. "share-document-modal.tsx" → "deelfunctie voor documenten gebouwd")
- Leid uit venstertitels af WAT er gedaan werd (bijv. "print.css — autronis-dashboard" → "print styling aangepast")
- Claude Code/Terminal tijd = development. Leid uit de projectnaam af WAARAAN gewerkt werd
- Als er meerdere projecten waren, beschrijf per project wat er gedaan is
- Noem concrete features, componenten, bestanden — niet alleen "gecodeerd"
- Koppel schermtijd aan agenda items als die overlappen
- Chrome tabs op dashboard.autronis.nl = testen/reviewen van eigen werk, niet "browsing"
- YouTube met dev-gerelateerde titels = leren, niet afleiding`,
      maxTokens: 1500,
    });
    let parsed: { kort: string; detail: string };
    try {
      const jsonMatch = tekst.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { kort: "Samenvatting niet beschikbaar", detail: "" };
    } catch {
      parsed = { kort: "Samenvatting niet beschikbaar", detail: "" };
    }

    // Upsert
    const bestaand = await db
      .select({ id: screenTimeSamenvattingen.id })
      .from(screenTimeSamenvattingen)
      .where(and(
        eq(screenTimeSamenvattingen.gebruikerId, gebruiker.id),
        eq(screenTimeSamenvattingen.datum, datum)
      ))
      .get();

    if (bestaand) {
      await db.update(screenTimeSamenvattingen)
        .set({
          samenvattingKort: parsed.kort,
          samenvattingDetail: parsed.detail,
          totaalSeconden,
          productiefPercentage,
          topProject,
        })
        .where(eq(screenTimeSamenvattingen.id, bestaand.id))
        .run();
    } else {
      await db.insert(screenTimeSamenvattingen).values({
        gebruikerId: gebruiker.id,
        datum,
        samenvattingKort: parsed.kort,
        samenvattingDetail: parsed.detail,
        totaalSeconden,
        productiefPercentage,
        topProject,
      }).run();
    }

    const samenvatting = await db
      .select()
      .from(screenTimeSamenvattingen)
      .where(and(
        eq(screenTimeSamenvattingen.gebruikerId, gebruiker.id),
        eq(screenTimeSamenvattingen.datum, datum)
      ))
      .get();

    return NextResponse.json({ samenvatting });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
