import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  briefings,
  agendaItems,
  taken,
  projecten,
  klanten,
  facturen,
  screenTimeEntries,
  belastingDeadlines,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, ne, gte, lte, desc, sql, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

// ============ TYPES ============

interface BriefingAgendaItem {
  titel: string;
  type: string;
  startDatum: string;
  heleDag: boolean;
}

interface BriefingTaak {
  id: number;
  titel: string;
  prioriteit: string;
  projectNaam: string | null;
  deadline: string | null;
}

interface BriefingProject {
  naam: string;
  klantNaam: string;
  voortgang: number;
  deadline: string | null;
}

interface BriefingQuickWin {
  id: number;
  titel: string;
  projectNaam: string | null;
}

interface BriefingData {
  id: number;
  datum: string;
  samenvatting: string;
  agendaItems: BriefingAgendaItem[];
  takenPrioriteit: BriefingTaak[];
  projectUpdates: BriefingProject[];
  quickWins: BriefingQuickWin[];
}

// ============ HELPERS ============

function getBegroeting(): string {
  const uur = new Date().getHours();
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

function todayStr(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// ============ GET — Fetch today's briefing ============

export async function GET(request: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const datum = request.nextUrl.searchParams.get("datum") || todayStr();

    const bestaande = db
      .select()
      .from(briefings)
      .where(
        and(
          eq(briefings.gebruikerId, gebruiker.id),
          eq(briefings.datum, datum)
        )
      )
      .get();

    if (!bestaande) {
      return NextResponse.json({ briefing: null });
    }

    const result: BriefingData = {
      id: bestaande.id,
      datum: bestaande.datum,
      samenvatting: bestaande.samenvatting ?? "",
      agendaItems: JSON.parse(bestaande.agendaItems ?? "[]") as BriefingAgendaItem[],
      takenPrioriteit: JSON.parse(bestaande.takenPrioriteit ?? "[]") as BriefingTaak[],
      projectUpdates: JSON.parse(bestaande.projectUpdates ?? "[]") as BriefingProject[],
      quickWins: JSON.parse(bestaande.quickWins ?? "[]") as BriefingQuickWin[],
    };

    return NextResponse.json({ briefing: result });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}

// ============ POST — Generate briefing ============

export async function POST() {
  try {
    const gebruiker = await requireAuth();
    const datum = todayStr();
    const gisteren = yesterdayStr();

    // 1. Agenda items vandaag
    const dagStart = `${datum}T00:00:00`;
    const dagEind = `${datum}T23:59:59`;

    const agendaVandaag = db
      .select({
        titel: agendaItems.titel,
        type: agendaItems.type,
        startDatum: agendaItems.startDatum,
        eindDatum: agendaItems.eindDatum,
        heleDag: agendaItems.heleDag,
      })
      .from(agendaItems)
      .where(
        and(
          eq(agendaItems.gebruikerId, gebruiker.id),
          lte(agendaItems.startDatum, dagEind),
          gte(
            sql`coalesce(${agendaItems.eindDatum}, ${agendaItems.startDatum})`,
            dagStart
          )
        )
      )
      .orderBy(asc(agendaItems.startDatum))
      .all();

    const briefingAgenda: BriefingAgendaItem[] = agendaVandaag.map((a) => ({
      titel: a.titel,
      type: a.type ?? "afspraak",
      startDatum: a.startDatum,
      heleDag: a.heleDag === 1,
    }));

    // 2. Top priority taken (niet afgerond, max 5)
    const prioriteitVolgorde = sql`CASE ${taken.prioriteit} WHEN 'hoog' THEN 1 WHEN 'normaal' THEN 2 WHEN 'laag' THEN 3 END`;

    const topTaken = db
      .select({
        id: taken.id,
        titel: taken.titel,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        projectNaam: projecten.naam,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(
        and(
          eq(taken.toegewezenAan, gebruiker.id),
          ne(taken.status, "afgerond")
        )
      )
      .orderBy(prioriteitVolgorde)
      .limit(5)
      .all();

    const briefingTaken: BriefingTaak[] = topTaken.map((t) => ({
      id: t.id,
      titel: t.titel,
      prioriteit: t.prioriteit ?? "normaal",
      projectNaam: t.projectNaam ?? null,
      deadline: t.deadline ?? null,
    }));

    // 3. Actieve projecten
    const actieveProjecten = db
      .select({
        naam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        voortgang: projecten.voortgangPercentage,
        deadline: projecten.deadline,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(projecten.status, "actief"),
          eq(projecten.isActief, 1)
        )
      )
      .orderBy(desc(projecten.deadline))
      .all();

    const briefingProjecten: BriefingProject[] = actieveProjecten.map((p) => ({
      naam: p.naam,
      klantNaam: p.klantNaam ?? "Onbekend",
      voortgang: p.voortgang ?? 0,
      deadline: p.deadline ?? null,
    }));

    // 4. Quick wins (lage prioriteit, open taken)
    const quickWinTaken = db
      .select({
        id: taken.id,
        titel: taken.titel,
        projectNaam: projecten.naam,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(
        and(
          eq(taken.toegewezenAan, gebruiker.id),
          eq(taken.prioriteit, "laag"),
          eq(taken.status, "open")
        )
      )
      .limit(5)
      .all();

    const briefingQuickWins: BriefingQuickWin[] = quickWinTaken.map((q) => ({
      id: q.id,
      titel: q.titel,
      projectNaam: q.projectNaam ?? null,
    }));

    // 5. Openstaande facturen
    const openFacturen = db
      .select({
        totaal: sql<number>`COALESCE(SUM(${facturen.bedragInclBtw}), 0)`,
        aantal: sql<number>`COUNT(*)`,
      })
      .from(facturen)
      .where(
        and(
          ne(facturen.status, "betaald"),
          eq(facturen.isActief, 1)
        )
      )
      .get();

    const openstaandBedrag = openFacturen?.totaal ?? 0;
    const aantalOpenFacturen = openFacturen?.aantal ?? 0;

    // 6. Screen time gisteren
    const screenTimeGisteren = db
      .select({
        totaal: sql<number>`COALESCE(SUM(${screenTimeEntries.duurSeconden}), 0)`,
      })
      .from(screenTimeEntries)
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruiker.id),
          gte(screenTimeEntries.startTijd, `${gisteren}T00:00:00`),
          lte(screenTimeEntries.startTijd, `${gisteren}T23:59:59`)
        )
      )
      .get();

    const screenTimeUren = screenTimeGisteren
      ? Math.round((screenTimeGisteren.totaal / 3600) * 10) / 10
      : 0;

    // 7. Belasting deadlines komende 30 dagen
    const alleBelastingDeadlines = db
      .select()
      .from(belastingDeadlines)
      .where(eq(belastingDeadlines.afgerond, 0))
      .all()
      .filter(d => {
        const dagen = Math.ceil((new Date(d.datum).getTime() - new Date().getTime()) / 86400000);
        return dagen <= 30 && dagen >= -7;
      });

    // ============ AI Samenvatting ============

    const begroeting = getBegroeting();

    const prompt = `Je bent de persoonlijke assistent van ${gebruiker.naam} bij Autronis, een AI- en automatiseringsbureau. Genereer een beknopte dagbriefing in het Nederlands (2-3 zinnen).

${begroeting} ${gebruiker.naam}!

Hier is de data voor vandaag (${datum}):

AGENDA VANDAAG (${briefingAgenda.length} items):
${briefingAgenda.length > 0 ? briefingAgenda.map((a) => `- ${a.titel} (${a.type}${a.heleDag ? ", hele dag" : `, ${a.startDatum}`})`).join("\n") : "Geen agenda items."}

TOP TAKEN (${briefingTaken.length}):
${briefingTaken.length > 0 ? briefingTaken.map((t) => `- [${t.prioriteit}] ${t.titel}${t.projectNaam ? ` (${t.projectNaam})` : ""}${t.deadline ? ` — deadline: ${t.deadline}` : ""}`).join("\n") : "Geen openstaande taken."}

ACTIEVE PROJECTEN (${briefingProjecten.length}):
${briefingProjecten.length > 0 ? briefingProjecten.map((p) => `- ${p.naam} voor ${p.klantNaam}: ${p.voortgang}% klaar${p.deadline ? ` — deadline: ${p.deadline}` : ""}`).join("\n") : "Geen actieve projecten."}

OPENSTAANDE FACTUREN: ${aantalOpenFacturen} facturen, totaal €${openstaandBedrag.toFixed(2)}

${screenTimeUren > 0 ? `SCHERMTIJD GISTEREN: ${screenTimeUren} uur` : ""}

${alleBelastingDeadlines.length > 0 ? `BELASTING DEADLINES KOMENDE 30 DAGEN:
${alleBelastingDeadlines.map(d => {
  const dagen = Math.ceil((new Date(d.datum).getTime() - new Date().getTime()) / 86400000);
  return `- ${d.omschrijving}: ${d.datum} (${dagen} dagen)`;
}).join("\n")}` : ""}

Schrijf een persoonlijke samenvatting van 2-3 zinnen. Begin met "${begroeting} ${gebruiker.naam}!" en geef een overzicht van de dag. Wees concreet en noem specifieke taken of afspraken als die er zijn. Houd het kort en motiverend.`;

    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const samenvatting =
      response.content[0].type === "text"
        ? response.content[0].text
        : "";

    // ============ Upsert briefing ============

    const bestaande = db
      .select()
      .from(briefings)
      .where(
        and(
          eq(briefings.gebruikerId, gebruiker.id),
          eq(briefings.datum, datum)
        )
      )
      .get();

    const agendaJson = JSON.stringify(briefingAgenda);
    const takenJson = JSON.stringify(briefingTaken);
    const projectenJson = JSON.stringify(briefingProjecten);
    const quickWinsJson = JSON.stringify(briefingQuickWins);

    let briefingId: number;

    if (bestaande) {
      db.update(briefings)
        .set({
          samenvatting,
          agendaItems: agendaJson,
          takenPrioriteit: takenJson,
          projectUpdates: projectenJson,
          quickWins: quickWinsJson,
        })
        .where(eq(briefings.id, bestaande.id))
        .run();
      briefingId = bestaande.id;
    } else {
      const inserted = db
        .insert(briefings)
        .values({
          gebruikerId: gebruiker.id,
          datum,
          samenvatting,
          agendaItems: agendaJson,
          takenPrioriteit: takenJson,
          projectUpdates: projectenJson,
          quickWins: quickWinsJson,
        })
        .returning({ id: briefings.id })
        .get();
      briefingId = inserted.id;
    }

    const result: BriefingData = {
      id: briefingId,
      datum,
      samenvatting,
      agendaItems: briefingAgenda,
      takenPrioriteit: briefingTaken,
      projectUpdates: briefingProjecten,
      quickWins: briefingQuickWins,
    };

    return NextResponse.json({ briefing: result });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
