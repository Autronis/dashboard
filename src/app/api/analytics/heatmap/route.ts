import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { sql, and, gte, lte } from "drizzle-orm";

// GET /api/analytics/heatmap — daily hours for the last 365 days
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const start = new Date(nu);
    start.setDate(start.getDate() - 365);

    const startStr = start.toISOString().slice(0, 10) + "T00:00:00";
    const eindStr = nu.toISOString().slice(0, 10) + "T23:59:59";

    const rows = await db
      .select({
        datum: sql<string>`date(${tijdregistraties.startTijd})`.as("datum"),
        totaalMinuten: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)`.as("totaal_minuten"),
      })
      .from(tijdregistraties)
      .where(
        and(
          gte(tijdregistraties.startTijd, startStr),
          lte(tijdregistraties.startTijd, eindStr),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      )
      .groupBy(sql`date(${tijdregistraties.startTijd})`);

    const data = rows.map((r) => ({
      datum: r.datum,
      uren: Math.round((r.totaalMinuten / 60) * 100) / 100,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
