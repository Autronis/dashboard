import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries, projecten, agendaItems, screenTimeSamenvattingen } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/client";

function getWeekRange(datum: string): { van: string; tot: string; label: string } {
  const d = new Date(datum);
  const day = d.getDay();
  const maandag = d.getDate() - ((day + 6) % 7);
  const van = new Date(d.getFullYear(), d.getMonth(), maandag);
  const tot = new Date(van.getFullYear(), van.getMonth(), van.getDate() + 6);
  return {
    van: van.toISOString().split("T")[0] ?? "",
    tot: tot.toISOString().split("T")[0] ?? "",
    label: `Week ${van.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} - ${tot.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`,
  };
}

function getMaandRange(datum: string): { van: string; tot: string; label: string } {
  const d = new Date(datum);
  const van = new Date(d.getFullYear(), d.getMonth(), 1);
  const tot = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    van: van.toISOString().split("T")[0] ?? "",
    tot: tot.toISOString().split("T")[0] ?? "",
    label: van.toLocaleDateString("nl-NL", { month: "long", year: "numeric" }),
  };
}

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get("datum");
    const type = searchParams.get("type");

    if (!datum || !type) {
      return NextResponse.json({ fout: "datum + type vereist" }, { status: 400 });
    }
    if (type !== "week" && type !== "maand") {
      return NextResponse.json({ fout: "type moet 'week' of 'maand' zijn" }, { status: 400 });
    }

    // Normaliseer datum naar startdatum van de periode zodat lookups consistent zijn
    const range = type === "week" ? getWeekRange(datum) : getMaandRange(datum);

    const rec = await db
      .select()
      .from(screenTimeSamenvattingen)
      .where(
        and(
          eq(screenTimeSamenvattingen.gebruikerId, gebruiker.id),
          eq(screenTimeSamenvattingen.datum, range.van),
          eq(screenTimeSamenvattingen.type, type)
        )
      )
      .get();

    if (!rec) {
      return NextResponse.json({ gevonden: false }, { status: 404 });
    }

    return NextResponse.json({
      gevonden: true,
      samenvatting: {
        type: rec.type,
        periode: range.label,
        van: range.van,
        tot: range.tot,
        samenvattingKort: rec.samenvattingKort,
        samenvattingDetail: rec.samenvattingDetail,
        totaalSeconden: rec.totaalSeconden ?? 0,
        productiefPercentage: rec.productiefPercentage ?? 0,
        topProject: rec.topProject,
        aangemaaktOp: rec.aangemaaktOp,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const body = await req.json();
    const { datum, type } = body as { datum: string; type: "week" | "maand" };

    if (!datum || !type) {
      return NextResponse.json({ fout: "Datum en type zijn verplicht" }, { status: 400 });
    }

    const range = type === "week" ? getWeekRange(datum) : getMaandRange(datum);

    // Aggregate screen time per app + category for the period
    const entries = await db
      .select({
        app: screenTimeEntries.app,
        categorie: screenTimeEntries.categorie,
        vensterTitel: screenTimeEntries.vensterTitel,
        projectNaam: projecten.naam,
        duurSeconden: screenTimeEntries.duurSeconden,
        startTijd: screenTimeEntries.startTijd,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruiker.id),
          gte(screenTimeEntries.startTijd, `${range.van}T00:00:00`),
          lte(screenTimeEntries.startTijd, `${range.tot}T23:59:59`)
        )
      )
      .orderBy(asc(screenTimeEntries.startTijd))
      .all();

    if (entries.length === 0) {
      return NextResponse.json({ fout: "Geen data voor deze periode" }, { status: 404 });
    }

    // Aggregate per dag
    const perDag: Record<string, { seconden: number; productief: number }> = {};
    const perApp: Record<string, { seconden: number; categorie: string; project: string | null }> = {};
    const perProject: Record<string, number> = {};
    let totaalSeconden = 0;
    let productiefSeconden = 0;

    for (const e of entries) {
      if (e.categorie === "inactief") continue;

      const dag = e.startTijd.substring(0, 10);
      if (!perDag[dag]) perDag[dag] = { seconden: 0, productief: 0 };
      perDag[dag].seconden += e.duurSeconden;

      const key = `${e.app}|${e.projectNaam || ""}`;
      if (!perApp[key]) perApp[key] = { seconden: 0, categorie: e.categorie ?? "overig", project: e.projectNaam };
      perApp[key].seconden += e.duurSeconden;

      if (e.projectNaam) {
        perProject[e.projectNaam] = (perProject[e.projectNaam] || 0) + e.duurSeconden;
      }

      totaalSeconden += e.duurSeconden;
      if (e.categorie && ["development", "design", "administratie"].includes(e.categorie)) {
        productiefSeconden += e.duurSeconden;
        if (perDag[dag]) perDag[dag].productief += e.duurSeconden;
      }
    }

    // Cap per-dag seconden at 16 hours each to filter idle tracking noise
    const MAX_DAG_SECONDEN = 57600;
    for (const dag of Object.keys(perDag)) {
      const dagData = perDag[dag];
      if (dagData && dagData.seconden > MAX_DAG_SECONDEN) {
        const ratio = MAX_DAG_SECONDEN / dagData.seconden;
        totaalSeconden -= dagData.seconden - MAX_DAG_SECONDEN;
        productiefSeconden -= dagData.productief - Math.round(dagData.productief * ratio);
        dagData.productief = Math.round(dagData.productief * ratio);
        dagData.seconden = MAX_DAG_SECONDEN;
      }
    }

    const productiefPercentage = totaalSeconden > 0 ? Math.round((productiefSeconden / totaalSeconden) * 100) : 0;
    const aantalDagen = Object.keys(perDag).length;

    // Agenda items in period
    const agenda = await db
      .select({
        titel: agendaItems.titel,
        startDatum: agendaItems.startDatum,
      })
      .from(agendaItems)
      .where(
        and(
          eq(agendaItems.gebruikerId, gebruiker.id),
          gte(agendaItems.startDatum, `${range.van}T00:00:00`),
          lte(agendaItems.startDatum, `${range.tot}T23:59:59`)
        )
      )
      .all();

    // Build context for AI
    const topApps = Object.entries(perApp)
      .sort(([, a], [, b]) => b.seconden - a.seconden)
      .slice(0, 10)
      .map(([key, v]) => {
        const uren = Math.floor(v.seconden / 3600);
        const minuten = Math.round((v.seconden % 3600) / 60);
        const duur = uren > 0 ? `${uren}u ${minuten}m` : `${minuten}m`;
        return `- ${key.split("|")[0]} [${v.categorie}] ${duur}${v.project ? ` (${v.project})` : ""}`;
      })
      .join("\n");

    const topProjecten = Object.entries(perProject)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([naam, sec]) => `- ${naam}: ${Math.floor(sec / 3600)}u ${Math.round((sec % 3600) / 60)}m`)
      .join("\n");

    const dagOverzicht = Object.entries(perDag)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dag, v]) => {
        const uren = Math.floor(v.seconden / 3600);
        const min = Math.round((v.seconden % 3600) / 60);
        const prod = v.seconden > 0 ? Math.round((v.productief / v.seconden) * 100) : 0;
        return `- ${dag}: ${uren}u ${min}m (${prod}% productief)`;
      })
      .join("\n");

    const { text: tekst } = await aiComplete({
      prompt: `Periode: ${range.label}
Totale actieve tijd: ${Math.floor(totaalSeconden / 3600)}u ${Math.round((totaalSeconden % 3600) / 60)}m
Productief: ${productiefPercentage}%
Actieve dagen: ${aantalDagen}
Gemiddeld per dag: ${aantalDagen > 0 ? `${Math.floor(totaalSeconden / aantalDagen / 3600)}u ${Math.round((totaalSeconden / aantalDagen % 3600) / 60)}m` : "0"}

Per dag:
${dagOverzicht}

Top projecten:
${topProjecten || "Geen projecten gedetecteerd"}

Top activiteiten:
${topApps}

Agenda items (${agenda.length}):
${agenda.length > 0 ? agenda.slice(0, 15).map(a => `- ${a.startDatum.substring(0, 10)}: ${a.titel}`).join("\n") : "Geen"}

Genereer JSON:
{
  "kort": "3-4 zinnen samenvatting van de ${type}. Noem specifieke projecten, trends (meer/minder productief dan normaal), en highlights.",
  "detail": "Gedetailleerd overzicht als markdown bullets. Per project/activiteit: wat is er gedaan, trends, opmerkingen. Voeg een 'Inzichten' sectie toe met patronen (drukste dag, meeste focus, etc)."
}

Alleen JSON, geen uitleg.`,
      system: `Je bent een productiviteitsassistent voor Sem, developer bij Autronis (AI/automation bureau).
Schrijf een ${type === "week" ? "week" : "maand"}rapportage op basis van de schermtijd data. Wees SPECIFIEK.`,
      maxTokens: 1024,
    });
    let parsed: { kort: string; detail: string };
    try {
      const jsonMatch = tekst.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { kort: "Samenvatting niet beschikbaar", detail: "" };
    } catch {
      parsed = { kort: "Samenvatting niet beschikbaar", detail: "" };
    }

    const topProject = Object.entries(perProject).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    // Persisteer in screen_time_samenvattingen (upsert op (gebruiker, datum, type))
    try {
      await db
        .insert(screenTimeSamenvattingen)
        .values({
          gebruikerId: gebruiker.id,
          datum: range.van,
          type,
          samenvattingKort: parsed.kort,
          samenvattingDetail: parsed.detail,
          totaalSeconden,
          productiefPercentage,
          topProject,
        })
        .onConflictDoUpdate({
          target: [
            screenTimeSamenvattingen.gebruikerId,
            screenTimeSamenvattingen.datum,
            screenTimeSamenvattingen.type,
          ],
          set: {
            samenvattingKort: parsed.kort,
            samenvattingDetail: parsed.detail,
            totaalSeconden,
            productiefPercentage,
            topProject,
          },
        });
    } catch {
      // Niet fatal — toon het rapport alsnog zodat de user z'n werk niet kwijtraakt
    }

    return NextResponse.json({
      samenvatting: {
        type,
        periode: range.label,
        van: range.van,
        tot: range.tot,
        samenvattingKort: parsed.kort,
        samenvattingDetail: parsed.detail,
        totaalSeconden,
        productiefPercentage,
        aantalDagen,
        topProject,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
