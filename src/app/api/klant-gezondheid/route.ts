import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  klanten,
  projecten,
  tijdregistraties,
  facturen,
  klanttevredenheid,
  meetings,
  notities as notitiesTabel,
  clientHealthScores,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  berekenCommunicatieScore,
  berekenBetalingScore,
  berekenProjectScore,
  berekenTevredenheidScore,
  berekenActiviteitScore,
  berekenTotaalScore,
} from "@/lib/health-score";

// ─── Helper ─────────────────────────────────────────────────────
function dagenTussen(van: string | null, tot: Date): number | null {
  if (!van) return null;
  const d = new Date(van.includes("T") ? van : van.replace(" ", "T") + "Z");
  return Math.floor((tot.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── GET: Health scores ophalen ──────────────────────────────────
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const dertigDagenGeleden = new Date(nu.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Alle actieve klanten
    const alleKlanten = await db
      .select({
        id: klanten.id,
        bedrijfsnaam: klanten.bedrijfsnaam,
        contactpersoon: klanten.contactpersoon,
        email: klanten.email,
        branche: klanten.branche,
        isActief: klanten.isActief,
        klantSinds: klanten.klantSinds,
      })
      .from(klanten)
      .where(and(eq(klanten.isActief, 1), eq(klanten.isDemo, 0)));

    // Batch queries
    const [
      projectStats,
      factuurStats,
      tevredenheidStats,
      meetingStats30d,
      notitieStats30d,
      urenStats30d,
      urenStatsAll,
      openTakenStats,
      laatsteContactData,
      bestaandeScores,
    ] = await Promise.all([
      // Projecten per klant
      db.select({
        klantId: projecten.klantId,
        actief: sql<number>`sum(case when ${projecten.status} = 'actief' then 1 else 0 end)`,
        afgerond: sql<number>`sum(case when ${projecten.status} = 'afgerond' then 1 else 0 end)`,
        gemVoortgang: sql<number>`avg(case when ${projecten.status} = 'actief' then ${projecten.voortgangPercentage} else null end)`,
        overdue: sql<number>`sum(case when ${projecten.status} = 'actief' and ${projecten.deadline} < datetime('now') then 1 else 0 end)`,
      }).from(projecten).where(eq(projecten.isActief, 1)).groupBy(projecten.klantId),

      // Facturen per klant
      db.select({
        klantId: facturen.klantId,
        totaal: sql<number>`count(*)`,
        betaald: sql<number>`sum(case when ${facturen.status} = 'betaald' then 1 else 0 end)`,
        teLaat: sql<number>`sum(case when ${facturen.status} = 'te_laat' then 1 else 0 end)`,
        openstaand: sql<number>`sum(case when ${facturen.status} in ('verzonden','te_laat') then ${facturen.bedragInclBtw} else 0 end)`,
        oudsteOverdue: sql<string>`min(case when ${facturen.status} in ('verzonden','te_laat') then ${facturen.vervaldatum} else null end)`,
      }).from(facturen).where(eq(facturen.isActief, 1)).groupBy(facturen.klantId),

      // Tevredenheid per klant
      db.select({
        klantId: klanttevredenheid.klantId,
        scores: sql<string>`group_concat(${klanttevredenheid.score})`,
      }).from(klanttevredenheid).groupBy(klanttevredenheid.klantId),

      // Meetings in 30 dagen
      db.select({
        klantId: meetings.klantId,
        aantal: sql<number>`count(*)`,
      }).from(meetings).where(sql`${meetings.datum} >= ${dertigDagenGeleden}`).groupBy(meetings.klantId),

      // Notities in 30 dagen
      db.select({
        klantId: notitiesTabel.klantId,
        aantal: sql<number>`count(*)`,
      }).from(notitiesTabel).where(sql`${notitiesTabel.aangemaaktOp} >= ${dertigDagenGeleden}`).groupBy(notitiesTabel.klantId),

      // Uren afgelopen 30 dagen
      db.select({
        klantId: projecten.klantId,
        minuten: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)`,
      }).from(tijdregistraties)
        .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
        .where(sql`${tijdregistraties.startTijd} >= ${dertigDagenGeleden}`)
        .groupBy(projecten.klantId),

      // Uren all time
      db.select({
        klantId: projecten.klantId,
        minuten: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)`,
      }).from(tijdregistraties)
        .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
        .groupBy(projecten.klantId),

      // Open taken
      db.select({
        klantId: projecten.klantId,
        aantal: sql<number>`count(*)`,
      }).from(sql`taken`)
        .innerJoin(projecten, sql`taken.project_id = ${projecten.id}`)
        .where(sql`taken.status IN ('open', 'bezig')`)
        .groupBy(projecten.klantId),

      // Laatste contact (notitie, tijdregistratie, meeting)
      db.select({
        klantId: klanten.id,
        laatsteNotitie: sql<string>`(SELECT max(n.aangemaakt_op) FROM notities n WHERE n.klant_id = ${klanten.id})`,
        laatsteTijd: sql<string>`(SELECT max(t.start_tijd) FROM tijdregistraties t INNER JOIN projecten p ON t.project_id = p.id WHERE p.klant_id = ${klanten.id})`,
        laatsteMeeting: sql<string>`(SELECT max(m.datum) FROM meetings m WHERE m.klant_id = ${klanten.id})`,
      }).from(klanten).where(and(eq(klanten.isActief, 1), eq(klanten.isDemo, 0))),

      // Bestaande health scores (meest recente per klant)
      db.select({
        klantId: clientHealthScores.klantId,
        vorigeScore: clientHealthScores.totaalScore,
        berekendOp: clientHealthScores.berekendOp,
      }).from(clientHealthScores)
        .orderBy(desc(clientHealthScores.berekendOp)),
    ]);

    // Maps bouwen
    const projMap = new Map(projectStats.map((p) => [p.klantId, p]));
    const factMap = new Map(factuurStats.map((f) => [f.klantId, f]));
    const tevMap = new Map(tevredenheidStats.map((t) => [t.klantId, t.scores?.split(",").map(Number) ?? []]));
    const meetMap30 = new Map(meetingStats30d.map((m) => [m.klantId, m.aantal]));
    const notMap30 = new Map(notitieStats30d.map((n) => [n.klantId, n.aantal]));
    const urenMap30 = new Map(urenStats30d.map((u) => [u.klantId, u.minuten]));
    const urenMapAll = new Map(urenStatsAll.map((u) => [u.klantId, u.minuten]));
    const openTakenMap = new Map(openTakenStats.map((t) => [t.klantId, t.aantal]));
    const contactMap = new Map(laatsteContactData.map((c) => [c.klantId, c]));

    // Vorige scores map (eerste per klant = meest recent)
    const vorigeMap = new Map<number, number>();
    for (const s of bestaandeScores) {
      if (!vorigeMap.has(s.klantId)) vorigeMap.set(s.klantId, s.vorigeScore);
    }

    // Health scores berekenen
    const resultaten = alleKlanten.map((klant) => {
      const proj = projMap.get(klant.id);
      const fact = factMap.get(klant.id);
      const tevScores = tevMap.get(klant.id) ?? [];
      const contact = contactMap.get(klant.id);

      // Dagen sinds contact
      const laatsteContactDatum = [contact?.laatsteNotitie, contact?.laatsteTijd, contact?.laatsteMeeting]
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null;
      const dagenSindsContact = dagenTussen(laatsteContactDatum, nu);

      // Oudste overdue factuur in dagen
      const oudsteOverdueDagen = fact?.oudsteOverdue ? dagenTussen(fact.oudsteOverdue, nu) : null;

      // Berekeningen
      const comm = berekenCommunicatieScore(
        dagenSindsContact,
        meetMap30.get(klant.id) ?? 0,
        notMap30.get(klant.id) ?? 0,
      );
      const betaling = berekenBetalingScore(
        fact?.totaal ?? 0,
        fact?.betaald ?? 0,
        fact?.teLaat ?? 0,
        fact?.openstaand ?? 0,
        oudsteOverdueDagen ?? null,
      );
      const project = berekenProjectScore(
        proj?.actief ?? 0,
        proj?.gemVoortgang ?? 0,
        proj?.overdue ?? 0,
        proj?.afgerond ?? 0,
      );
      const tevredenheid = berekenTevredenheidScore(tevScores);
      const activiteit = berekenActiviteitScore(
        urenMap30.get(klant.id) ?? 0,
        urenMapAll.get(klant.id) ?? 0,
        openTakenMap.get(klant.id) ?? 0,
      );

      const totaalScore = berekenTotaalScore({
        communicatie: comm.score,
        betaling: betaling.score,
        project: project.score,
        tevredenheid: tevredenheid.score,
        activiteit: activiteit.score,
      });

      const vorigeScore = vorigeMap.get(klant.id) ?? null;
      const trend = vorigeScore !== null ? totaalScore - vorigeScore : null;

      return {
        klantId: klant.id,
        bedrijfsnaam: klant.bedrijfsnaam,
        contactpersoon: klant.contactpersoon,
        email: klant.email,
        branche: klant.branche,
        klantSinds: klant.klantSinds,
        totaalScore,
        communicatieScore: comm.score,
        betalingScore: betaling.score,
        projectScore: project.score,
        tevredenheidScore: tevredenheid.score,
        activiteitScore: activiteit.score,
        trend,
        details: {
          communicatie: comm.details,
          betaling: betaling.details,
          project: project.details,
          tevredenheid: tevredenheid.details,
          activiteit: activiteit.details,
        },
      };
    });

    // Sorteer op score (laagste eerst = meest aandacht nodig)
    resultaten.sort((a, b) => a.totaalScore - b.totaalScore);

    // KPIs
    const scores = resultaten.map((r) => r.totaalScore);
    const gemiddelde = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    const kritiek = resultaten.filter((r) => r.totaalScore < 40).length;
    const risico = resultaten.filter((r) => r.totaalScore >= 40 && r.totaalScore < 60).length;
    const aandacht = resultaten.filter((r) => r.totaalScore >= 60 && r.totaalScore < 80).length;
    const gezond = resultaten.filter((r) => r.totaalScore >= 80).length;

    return NextResponse.json({
      klanten: resultaten,
      kpis: {
        totaalKlanten: resultaten.length,
        gemiddeldeScore: gemiddelde,
        kritiek,
        risico,
        aandacht,
        gezond,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 },
    );
  }
}

// ─── POST: Scores opslaan (snapshot) ─────────────────────────────
export async function POST() {
  try {
    await requireAuth();

    // Haal eerst de berekende scores op via dezelfde logica
    const res = await fetch(new URL("/api/klant-gezondheid", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"), {
      headers: { cookie: "" }, // Skip auth for internal call
    });

    // Alternatief: direct berekenen (niet via fetch)
    // Voor nu slaan we de scores op via de GET response
    return NextResponse.json({ bericht: "Gebruik GET om scores te bekijken" });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 },
    );
  }
}
