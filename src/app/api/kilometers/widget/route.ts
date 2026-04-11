import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const nu = new Date();
    const jaar = nu.getFullYear();
    const maand = nu.getMonth() + 1;

    const startDatum = `${jaar}-${String(maand).padStart(2, "0")}-01`;
    const eindDatum = `${jaar}-${String(maand).padStart(2, "0")}-31`;

    const stats = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
        aantalRitten: sql<number>`COUNT(*)`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          gte(kilometerRegistraties.datum, startDatum),
          lte(kilometerRegistraties.datum, eindDatum)
        )
      )
      .get();

    const km = stats?.totaalKm ?? 0;
    const ritten = stats?.aantalRitten ?? 0;
    const aftrekbaar = Math.round(km * 0.23 * 100) / 100;

    // Per-week breakdown
    const perWeek: number[] = [0, 0, 0, 0, 0];
    const dagData = await db
      .select({
        dag: sql<number>`CAST(SUBSTR(${kilometerRegistraties.datum}, 9, 2) AS INTEGER)`,
        km: sql<number>`SUM(${kilometerRegistraties.kilometers})`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          gte(kilometerRegistraties.datum, startDatum),
          lte(kilometerRegistraties.datum, eindDatum)
        )
      )
      .groupBy(sql`SUBSTR(${kilometerRegistraties.datum}, 9, 2)`)
      .all();

    for (const d of dagData) {
      const weekIdx = Math.min(Math.floor((d.dag - 1) / 7), 4);
      perWeek[weekIdx] += d.km;
    }

    // Previous month for trend
    const vorigeMaand = maand === 1 ? 12 : maand - 1;
    const vorigJaar = maand === 1 ? jaar - 1 : jaar;
    const vorigeStart = `${vorigJaar}-${String(vorigeMaand).padStart(2, "0")}-01`;
    const vorigeEind = `${vorigJaar}-${String(vorigeMaand).padStart(2, "0")}-31`;

    const vorigeStats = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          gte(kilometerRegistraties.datum, vorigeStart),
          lte(kilometerRegistraties.datum, vorigeEind)
        )
      )
      .get();

    const vorigeKm = vorigeStats?.totaalKm ?? 0;
    const trendVsVorigeMaand = vorigeKm > 0
      ? Math.round(((km - vorigeKm) / vorigeKm) * 100)
      : 0;

    return NextResponse.json({
      km: Math.round(km),
      aftrekbaar,
      ritten,
      perWeek: perWeek.map((w) => Math.round(w)),
      trendVsVorigeMaand,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
