import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaar = searchParams.get("jaar") || new Date().getFullYear().toString();

    const jaarStart = `${jaar}-01-01`;
    const jaarEind = `${jaar}-12-31`;

    const conditions = [
      eq(kilometerRegistraties.gebruikerId, gebruiker.id),
      gte(kilometerRegistraties.datum, jaarStart),
      lte(kilometerRegistraties.datum, jaarEind),
    ];

    // Totaal jaar
    const totaalResult = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
        aantalRitten: sql<number>`COUNT(*)`,
      })
      .from(kilometerRegistraties)
      .where(and(...conditions))
      .get();

    const totaalKm = Math.round((totaalResult?.totaalKm ?? 0) * 100) / 100;
    const aantalRitten = totaalResult?.aantalRitten ?? 0;
    const totaalAftrekbaar = Math.round(totaalKm * 0.23 * 100) / 100;

    // Per maand
    const perMaand = await db
      .select({
        maand: sql<number>`CAST(SUBSTR(${kilometerRegistraties.datum}, 6, 2) AS INTEGER)`,
        km: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
        ritten: sql<number>`COUNT(*)`,
      })
      .from(kilometerRegistraties)
      .where(and(...conditions))
      .groupBy(sql`SUBSTR(${kilometerRegistraties.datum}, 6, 2)`)
      .orderBy(sql`SUBSTR(${kilometerRegistraties.datum}, 6, 2)`)
      .all();

    // Per klant
    const perKlant = await db
      .select({
        klantId: kilometerRegistraties.klantId,
        klantNaam: klanten.bedrijfsnaam,
        km: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
        ritten: sql<number>`COUNT(*)`,
      })
      .from(kilometerRegistraties)
      .leftJoin(klanten, eq(kilometerRegistraties.klantId, klanten.id))
      .where(and(...conditions))
      .groupBy(kilometerRegistraties.klantId)
      .orderBy(sql`SUM(${kilometerRegistraties.kilometers}) DESC`)
      .all();

    // Vergelijking vorig jaar
    const vorigJaar = String(parseInt(jaar) - 1);
    const vorigResult = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
      })
      .from(kilometerRegistraties)
      .where(and(
        eq(kilometerRegistraties.gebruikerId, gebruiker.id),
        gte(kilometerRegistraties.datum, `${vorigJaar}-01-01`),
        lte(kilometerRegistraties.datum, `${vorigJaar}-12-31`),
      ))
      .get();

    const vorigJaarKm = Math.round((vorigResult?.totaalKm ?? 0) * 100) / 100;

    return NextResponse.json({
      jaar: parseInt(jaar),
      totaalKm,
      aantalRitten,
      totaalAftrekbaar,
      tariefPerKm: 0.23,
      perMaand: perMaand.map((m) => ({
        maand: m.maand,
        km: Math.round(m.km * 100) / 100,
        ritten: m.ritten,
        bedrag: Math.round(m.km * 0.23 * 100) / 100,
      })),
      perKlant: perKlant.map((k) => ({
        klantId: k.klantId,
        klantNaam: k.klantNaam || "Geen klant",
        km: Math.round(k.km * 100) / 100,
        ritten: k.ritten,
        bedrag: Math.round(k.km * 0.23 * 100) / 100,
      })),
      vorigJaarKm,
      verschilVorigJaar: totaalKm - vorigJaarKm,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
