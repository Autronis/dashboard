import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten, facturen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lt, sql } from "drizzle-orm";

interface KlantRapport {
  naam: string;
  omzet: number;
  uren: number;
  uurtarief: number;
}

interface ProjectRapport {
  naam: string;
  klant: string;
  uren: number;
  omzet: number;
}

interface MaandRapport {
  periode: string;
  omzet: number;
  uren: number;
  gemiddeldUurtarief: number;
  billablePercentage: number;
  klanten: KlantRapport[];
  topProjecten: ProjectRapport[];
  vergelijkingVorigeMaand: { omzetDelta: number; urenDelta: number };
  samenvatting: string;
}

function getMaandRange(maandStr: string): { start: string; end: string } {
  const [jaar, maand] = maandStr.split("-").map(Number);
  const startDate = new Date(jaar, maand - 1, 1);
  const endDate = new Date(jaar, maand, 1);
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

function getVorigeMaandStr(maandStr: string): string {
  const [jaar, maand] = maandStr.split("-").map(Number);
  const vorige = new Date(jaar, maand - 2, 1);
  return `${vorige.getFullYear()}-${String(vorige.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/analytics/rapport?maand=2026-03
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const maandParam = searchParams.get("maand") ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const { start, end } = getMaandRange(maandParam);
    const vorigeMaandStr = getVorigeMaandStr(maandParam);
    const vorigeRange = getMaandRange(vorigeMaandStr);

    // === Time entries for this month ===
    const entries = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        uurtarief: klanten.uurtarief,
        klantNaam: klanten.bedrijfsnaam,
        klantId: klanten.id,
        projectNaam: projecten.naam,
        categorie: tijdregistraties.categorie,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, `${start}T00:00:00`),
          lt(tijdregistraties.startTijd, `${end}T00:00:00`),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );

    // === Previous month entries for comparison ===
    const vorigeEntries = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        uurtarief: klanten.uurtarief,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, `${vorigeRange.start}T00:00:00`),
          lt(tijdregistraties.startTijd, `${vorigeRange.end}T00:00:00`),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );

    // === Invoice data for the month ===
    const [factuurResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          gte(facturen.betaaldOp, start),
          lt(facturen.betaaldOp, end)
        )
      );

    const [vorigeFactuurResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          gte(facturen.betaaldOp, vorigeRange.start),
          lt(facturen.betaaldOp, vorigeRange.end)
        )
      );

    // === Calculate totals ===
    let totaalUren = 0;
    let totaalOmzet = 0;
    let billableMinuten = 0;
    let totaalMinuten = 0;

    for (const e of entries) {
      const minuten = e.duurMinuten || 0;
      const uren = minuten / 60;
      totaalMinuten += minuten;
      totaalUren += uren;
      totaalOmzet += uren * (e.uurtarief || 0);
      if (e.categorie !== "administratie" && e.categorie !== "overig") {
        billableMinuten += minuten;
      }
    }

    // Use invoice data if available, otherwise use calculated revenue
    const omzet = (factuurResult?.total ?? 0) > 0 ? (factuurResult?.total ?? 0) : Math.round(totaalOmzet * 100) / 100;

    let vorigeUren = 0;
    let vorigeOmzetBerekend = 0;
    for (const e of vorigeEntries) {
      const uren = (e.duurMinuten || 0) / 60;
      vorigeUren += uren;
      vorigeOmzetBerekend += uren * (e.uurtarief || 0);
    }
    const vorigeOmzet = (vorigeFactuurResult?.total ?? 0) > 0
      ? (vorigeFactuurResult?.total ?? 0)
      : Math.round(vorigeOmzetBerekend * 100) / 100;

    const gemiddeldUurtarief = totaalUren > 0 ? omzet / totaalUren : 0;
    const billablePercentage = totaalMinuten > 0 ? Math.round((billableMinuten / totaalMinuten) * 100) : 0;

    // === Per client breakdown ===
    const klantMap = new Map<number, KlantRapport>();
    for (const e of entries) {
      if (!e.klantId) continue;
      const existing = klantMap.get(e.klantId) || { naam: e.klantNaam || "Onbekend", omzet: 0, uren: 0, uurtarief: e.uurtarief || 0 };
      const uren = (e.duurMinuten || 0) / 60;
      existing.uren += uren;
      existing.omzet += uren * (e.uurtarief || 0);
      klantMap.set(e.klantId, existing);
    }
    const klantenList = [...klantMap.values()]
      .sort((a, b) => b.omzet - a.omzet)
      .map((k) => ({
        naam: k.naam,
        omzet: Math.round(k.omzet * 100) / 100,
        uren: Math.round(k.uren * 100) / 100,
        uurtarief: k.uren > 0 ? Math.round((k.omzet / k.uren) * 100) / 100 : 0,
      }));

    // === Top projects ===
    const projectMap = new Map<string, ProjectRapport>();
    for (const e of entries) {
      const key = e.projectNaam || "Onbekend";
      const existing = projectMap.get(key) || { naam: key, klant: e.klantNaam || "", uren: 0, omzet: 0 };
      const uren = (e.duurMinuten || 0) / 60;
      existing.uren += uren;
      existing.omzet += uren * (e.uurtarief || 0);
      projectMap.set(key, existing);
    }
    const topProjecten = [...projectMap.values()]
      .sort((a, b) => b.uren - a.uren)
      .slice(0, 10)
      .map((p) => ({
        naam: p.naam,
        klant: p.klant,
        uren: Math.round(p.uren * 100) / 100,
        omzet: Math.round(p.omzet * 100) / 100,
      }));

    // === Comparison with previous month ===
    const omzetDelta = vorigeOmzet > 0
      ? Math.round(((omzet - vorigeOmzet) / vorigeOmzet) * 100)
      : 0;
    const urenDelta = vorigeUren > 0
      ? Math.round(((totaalUren - vorigeUren) / vorigeUren) * 100)
      : 0;

    // === Auto-generated summary ===
    const [jaar, maandNr] = maandParam.split("-").map(Number);
    const maandNaam = new Date(jaar, maandNr - 1, 1).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
    const parts: string[] = [];
    parts.push(`In ${maandNaam} is er ${Math.round(totaalUren * 10) / 10} uur gewerkt`);
    if (klantenList.length > 0) {
      parts.push(`verdeeld over ${klantenList.length} klant${klantenList.length !== 1 ? "en" : ""}`);
    }
    parts[parts.length - 1] += ".";

    if (omzetDelta > 0) {
      parts.push(`De omzet steeg ${omzetDelta}% t.o.v. vorige maand.`);
    } else if (omzetDelta < 0) {
      parts.push(`De omzet daalde ${Math.abs(omzetDelta)}% t.o.v. vorige maand.`);
    }

    if (billablePercentage < 70) {
      parts.push(`Let op: slechts ${billablePercentage}% van de uren was billable.`);
    }

    const samenvatting = parts.join(" ");

    const rapport: MaandRapport = {
      periode: maandParam,
      omzet: Math.round(omzet * 100) / 100,
      uren: Math.round(totaalUren * 100) / 100,
      gemiddeldUurtarief: Math.round(gemiddeldUurtarief * 100) / 100,
      billablePercentage,
      klanten: klantenList,
      topProjecten,
      vergelijkingVorigeMaand: { omzetDelta, urenDelta },
      samenvatting,
    };

    return NextResponse.json({ rapport });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
