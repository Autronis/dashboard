import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql, isNotNull } from "drizzle-orm";

// GET /api/tijdregistraties/jaaroverzicht?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaar = parseInt(searchParams.get("jaar") ?? String(new Date().getFullYear()), 10);

    const vanDatum = `${jaar}-01-01T00:00:00`;
    const totDatum = `${jaar}-12-31T23:59:59`;

    const rows = await db
      .select({
        gebruikerId: tijdregistraties.gebruikerId,
        gebruikerNaam: gebruikers.naam,
        locatie: tijdregistraties.locatie,
        totaalMinuten: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)`,
      })
      .from(tijdregistraties)
      .leftJoin(gebruikers, eq(tijdregistraties.gebruikerId, gebruikers.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, vanDatum),
          lte(tijdregistraties.startTijd, totDatum),
          isNotNull(tijdregistraties.eindTijd)
        )
      )
      .groupBy(tijdregistraties.gebruikerId, tijdregistraties.locatie);

    // Aggregate per user
    const perGebruiker: Record<number, {
      naam: string;
      totaalMinuten: number;
      kantoorMinuten: number;
      thuisMinuten: number;
    }> = {};

    for (const row of rows) {
      if (!row.gebruikerId) continue;
      if (!perGebruiker[row.gebruikerId]) {
        perGebruiker[row.gebruikerId] = {
          naam: row.gebruikerNaam ?? "Onbekend",
          totaalMinuten: 0,
          kantoorMinuten: 0,
          thuisMinuten: 0,
        };
      }
      const g = perGebruiker[row.gebruikerId];
      g.totaalMinuten += row.totaalMinuten;
      if (row.locatie === "kantoor") g.kantoorMinuten += row.totaalMinuten;
      else if (row.locatie === "thuis") g.thuisMinuten += row.totaalMinuten;
    }

    const overzicht = Object.entries(perGebruiker).map(([id, data]) => ({
      gebruikerId: Number(id),
      naam: data.naam,
      totaalUren: Math.round((data.totaalMinuten / 60) * 100) / 100,
      kantoorUren: Math.round((data.kantoorMinuten / 60) * 100) / 100,
      thuisUren: Math.round((data.thuisMinuten / 60) * 100) / 100,
      doelUren: 1225,
      voortgangPercentage: Math.min(Math.round((data.totaalMinuten / 60 / 1225) * 100), 100),
    }));

    return NextResponse.json({ overzicht, jaar });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
