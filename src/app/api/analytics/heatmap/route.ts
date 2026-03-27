import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { sql, and, gte, lte } from "drizzle-orm";

// GET /api/analytics/heatmap — daily hours for the last 365 days (screen time)
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
        datum: sql<string>`date(${screenTimeEntries.startTijd})`.as("datum"),
        totaalSeconden: sql<number>`COALESCE(SUM(${screenTimeEntries.duurSeconden}), 0)`.as("totaal_seconden"),
      })
      .from(screenTimeEntries)
      .where(
        and(
          gte(screenTimeEntries.startTijd, startStr),
          lte(screenTimeEntries.startTijd, eindStr),
          sql`${screenTimeEntries.categorie} != 'inactief'`
        )
      )
      .groupBy(sql`date(${screenTimeEntries.startTijd})`);

    const data = rows.map((r) => ({
      datum: r.datum,
      uren: Math.round((r.totaalSeconden / 3600) * 100) / 100,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
