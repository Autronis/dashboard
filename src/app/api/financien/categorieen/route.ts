import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lt, sql } from "drizzle-orm";

// GET /api/financien/categorieen?type=af&periode=maand
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const type = (searchParams.get("type") ?? "af") as "bij" | "af";
    const periode = searchParams.get("periode") ?? "maand";
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    // Date range
    const nu = new Date();
    const jaar = nu.getFullYear();
    const maand = nu.getMonth();
    const kwartaal = Math.floor(maand / 3);
    let startDatum: string | null = null;
    let eindDatum: string | null = null;

    if (periode === "custom" && van && tot) {
      startDatum = van;
      eindDatum = tot;
    } else if (periode === "maand") {
      startDatum = `${jaar}-${String(maand + 1).padStart(2, "0")}-01`;
      eindDatum = maand === 11
        ? `${jaar + 1}-01-01`
        : `${jaar}-${String(maand + 2).padStart(2, "0")}-01`;
    } else if (periode === "kwartaal") {
      const kwartaalStartMaand = kwartaal * 3 + 1;
      startDatum = `${jaar}-${String(kwartaalStartMaand).padStart(2, "0")}-01`;
      const kwartaalEindMaand = kwartaalStartMaand + 3;
      eindDatum = kwartaalEindMaand > 12
        ? `${jaar + 1}-01-01`
        : `${jaar}-${String(kwartaalEindMaand).padStart(2, "0")}-01`;
    } else if (periode === "jaar") {
      startDatum = `${jaar}-01-01`;
      eindDatum = `${jaar + 1}-01-01`;
    }

    const conditions = [eq(bankTransacties.type, type)];
    if (startDatum) conditions.push(gte(bankTransacties.datum, startDatum));
    if (eindDatum) conditions.push(lt(bankTransacties.datum, eindDatum));

    const rows = await db
      .select({
        categorie: bankTransacties.categorie,
        totaal: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
        aantal: sql<number>`COUNT(*)`,
      })
      .from(bankTransacties)
      .where(and(...conditions))
      .groupBy(bankTransacties.categorie);

    // Normalize: map null categorie to "Onbekend"
    const categorieen = rows
      .map((r) => ({
        categorie: r.categorie ?? "Onbekend",
        totaal: Math.round(Number(r.totaal) * 100) / 100,
        aantal: Number(r.aantal),
      }))
      .sort((a, b) => b.totaal - a.totaal);

    const totaalSom = categorieen.reduce((s, c) => s + c.totaal, 0);

    // Add percentage
    const withPct = categorieen.map((c) => ({
      ...c,
      percentage: totaalSom > 0 ? Math.round((c.totaal / totaalSom) * 1000) / 10 : 0,
    }));

    return NextResponse.json({
      categorieen: withPct,
      totaal: Math.round(totaalSom * 100) / 100,
      type,
      periode,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
