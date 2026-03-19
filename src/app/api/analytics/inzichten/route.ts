import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten, facturen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

interface Inzicht {
  tekst: string;
  type: "positief" | "waarschuwing" | "info";
  metric?: string;
}

const DAG_NAMEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

// GET /api/analytics/inzichten
export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const inzichten: Inzicht[] = [];

    // Period: last 90 days for general insights
    const start90 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
    const startStr = start90.toISOString().slice(0, 19);
    const endStr = now.toISOString().slice(0, 19);

    // Fetch all time entries with project/client data for last 90 days
    const entries = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        startTijd: tijdregistraties.startTijd,
        uurtarief: klanten.uurtarief,
        klantNaam: klanten.bedrijfsnaam,
        klantId: klanten.id,
        projectNaam: projecten.naam,
        projectId: projecten.id,
        geschatteUren: projecten.geschatteUren,
        categorie: tijdregistraties.categorie,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, startStr),
          lte(tijdregistraties.startTijd, endStr),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );

    if (entries.length === 0) {
      inzichten.push({
        tekst: "Nog geen tijdregistraties gevonden in de afgelopen 90 dagen. Begin met registreren voor inzichten.",
        type: "info",
      });
      return NextResponse.json({ inzichten });
    }

    // ===== 1. Hours per weekday =====
    const urenPerDag = new Array<number>(7).fill(0);
    const telPerDag = new Array<number>(7).fill(0);
    for (const e of entries) {
      if (!e.startTijd) continue;
      const dag = new Date(e.startTijd).getDay();
      const uren = (e.duurMinuten || 0) / 60;
      urenPerDag[dag] += uren;
      telPerDag[dag] += 1;
    }
    // Find best weekday (1-5, skip weekend)
    let besteDag = 1;
    let besteGemiddeld = 0;
    for (let d = 1; d <= 5; d++) {
      // Count unique dates for this weekday
      const uniekeDagen = new Set(
        entries
          .filter((e) => e.startTijd && new Date(e.startTijd).getDay() === d)
          .map((e) => e.startTijd!.slice(0, 10))
      ).size;
      const gem = uniekeDagen > 0 ? urenPerDag[d] / uniekeDagen : 0;
      if (gem > besteGemiddeld) {
        besteGemiddeld = gem;
        besteDag = d;
      }
    }
    if (besteGemiddeld > 0) {
      inzichten.push({
        tekst: `Je beste dag is ${DAG_NAMEN[besteDag]}: gemiddeld ${besteGemiddeld.toFixed(1)} uur per dag`,
        type: "positief",
        metric: `${besteGemiddeld.toFixed(1)}u`,
      });
    }

    // ===== 2. Revenue per client vs hours (over-budget clients) =====
    const klantMap = new Map<number, { naam: string; uren: number; omzet: number; geschatteUren: number }>();
    for (const e of entries) {
      if (!e.klantId) continue;
      const existing = klantMap.get(e.klantId) || {
        naam: e.klantNaam || "Onbekend",
        uren: 0,
        omzet: 0,
        geschatteUren: 0,
      };
      const uren = (e.duurMinuten || 0) / 60;
      existing.uren += uren;
      existing.omzet += uren * (e.uurtarief || 0);
      // Track unique projects' estimated hours
      if (e.geschatteUren && e.geschatteUren > 0) {
        existing.geschatteUren = Math.max(existing.geschatteUren, e.geschatteUren);
      }
      klantMap.set(e.klantId, existing);
    }

    // Find over-budget client (actual hours > 120% of estimated)
    for (const [, klant] of klantMap) {
      if (klant.geschatteUren > 0 && klant.uren > klant.geschatteUren * 1.2) {
        const overPerc = Math.round(((klant.uren - klant.geschatteUren) / klant.geschatteUren) * 100);
        inzichten.push({
          tekst: `Klant ${klant.naam} kost je ${overPerc}% meer uren dan geschat (${klant.uren.toFixed(1)}u vs ${klant.geschatteUren.toFixed(1)}u geschat)`,
          type: "waarschuwing",
          metric: `+${overPerc}%`,
        });
        break; // Only show worst offender
      }
    }

    // ===== 3. Billable vs non-billable ratio =====
    let billableMinuten = 0;
    let nonBillableMinuten = 0;
    for (const e of entries) {
      const min = e.duurMinuten || 0;
      if (e.categorie === "administratie" || e.categorie === "overig") {
        nonBillableMinuten += min;
      } else {
        billableMinuten += min;
      }
    }
    const totaalMinuten = billableMinuten + nonBillableMinuten;
    if (totaalMinuten > 0) {
      const billablePerc = Math.round((billableMinuten / totaalMinuten) * 100);
      const nonBillablePerc = 100 - billablePerc;
      if (nonBillablePerc > 30) {
        inzichten.push({
          tekst: `Je besteedt ${nonBillablePerc}% van je tijd aan non-billable werk (administratie/overig). Probeer dit onder 30% te houden.`,
          type: "waarschuwing",
          metric: `${nonBillablePerc}%`,
        });
      } else {
        inzichten.push({
          tekst: `${billablePerc}% van je tijd is billable — goed bezig!`,
          type: "positief",
          metric: `${billablePerc}%`,
        });
      }
    }

    // ===== 4. Monthly revenue trend =====
    const maandOmzet: { maand: string; omzet: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const maandStr = target.toISOString().slice(0, 7);
      const [result] = await db
        .select({ total: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
        .from(facturen)
        .where(
          and(
            eq(facturen.status, "betaald"),
            gte(facturen.betaaldOp, `${maandStr}-01`),
            sql`${facturen.betaaldOp} < date('${sql.raw(maandStr)}-01', '+1 month')`
          )
        );
      maandOmzet.push({ maand: maandStr, omzet: result?.total ?? 0 });
    }

    if (maandOmzet.length >= 3 && maandOmzet[0].omzet > 0) {
      const eerste = maandOmzet[0].omzet;
      const laatste = maandOmzet[maandOmzet.length - 1].omzet;
      const verandering = Math.round(((laatste - eerste) / eerste) * 100);

      if (verandering > 10) {
        inzichten.push({
          tekst: `Je omzet groeit ${verandering}% over de afgelopen 3 maanden`,
          type: "positief",
          metric: `+${verandering}%`,
        });
      } else if (verandering < -10) {
        inzichten.push({
          tekst: `Je omzet daalt ${Math.abs(verandering)}% over de afgelopen 3 maanden`,
          type: "waarschuwing",
          metric: `${verandering}%`,
        });
      } else {
        inzichten.push({
          tekst: `Je omzet is stabiel gebleven de afgelopen 3 maanden`,
          type: "info",
          metric: `${verandering >= 0 ? "+" : ""}${verandering}%`,
        });
      }
    }

    // ===== 5. Average hours per week over last 4 weeks =====
    const start4w = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28);
    const start4wStr = start4w.toISOString().slice(0, 19);
    const recentEntries = entries.filter((e) => e.startTijd && e.startTijd >= start4wStr);
    const totaalUren4w = recentEntries.reduce((sum, e) => sum + (e.duurMinuten || 0) / 60, 0);
    const gemiddeldPerWeek = totaalUren4w / 4;

    if (gemiddeldPerWeek > 0) {
      inzichten.push({
        tekst: `Je werkt gemiddeld ${gemiddeldPerWeek.toFixed(1)} uur per week (laatste 4 weken)`,
        type: gemiddeldPerWeek < 20 ? "info" : gemiddeldPerWeek > 50 ? "waarschuwing" : "positief",
        metric: `${gemiddeldPerWeek.toFixed(1)}u/week`,
      });
    }

    // Limit to 5 insights max
    return NextResponse.json({ inzichten: inzichten.slice(0, 5) });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
