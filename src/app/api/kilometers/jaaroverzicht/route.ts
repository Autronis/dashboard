import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, klanten, brandstofKosten, kmStanden } from "@/lib/db/schema";
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

    // Per doel type
    const perDoelType = await db
      .select({
        type: kilometerRegistraties.doelType,
        km: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
        ritten: sql<number>`COUNT(*)`,
        bedrag: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers} * COALESCE(${kilometerRegistraties.tariefPerKm}, 0.23)), 0)`,
      })
      .from(kilometerRegistraties)
      .where(and(...conditions))
      .groupBy(kilometerRegistraties.doelType)
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

    // Brandstofkosten dit jaar
    const brandstofResult = await db
      .select({
        totaalBedrag: sql<number>`COALESCE(SUM(${brandstofKosten.bedrag}), 0)`,
        totaalLiters: sql<number>`COALESCE(SUM(${brandstofKosten.liters}), 0)`,
        aantalTankbeurten: sql<number>`COUNT(*)`,
      })
      .from(brandstofKosten)
      .where(and(
        eq(brandstofKosten.gebruikerId, gebruiker.id),
        gte(brandstofKosten.datum, jaarStart),
        lte(brandstofKosten.datum, jaarEind),
      ))
      .get();

    // Brandstof per maand
    const brandstofPerMaand = await db
      .select({
        maand: sql<number>`CAST(SUBSTR(${brandstofKosten.datum}, 6, 2) AS INTEGER)`,
        bedrag: sql<number>`COALESCE(SUM(${brandstofKosten.bedrag}), 0)`,
        liters: sql<number>`COALESCE(SUM(${brandstofKosten.liters}), 0)`,
        tankbeurten: sql<number>`COUNT(*)`,
      })
      .from(brandstofKosten)
      .where(and(
        eq(brandstofKosten.gebruikerId, gebruiker.id),
        gte(brandstofKosten.datum, jaarStart),
        lte(brandstofKosten.datum, jaarEind),
      ))
      .groupBy(sql`SUBSTR(${brandstofKosten.datum}, 6, 2)`)
      .orderBy(sql`SUBSTR(${brandstofKosten.datum}, 6, 2)`)
      .all();

    // Recente brandstofkosten (laatste 10)
    const recenteBrandstof = await db
      .select()
      .from(brandstofKosten)
      .where(and(
        eq(brandstofKosten.gebruikerId, gebruiker.id),
        gte(brandstofKosten.datum, jaarStart),
        lte(brandstofKosten.datum, jaarEind),
      ))
      .orderBy(sql`${brandstofKosten.datum} DESC`)
      .limit(10);

    const kostenPerKm = totaalKm > 0
      ? Math.round(((brandstofResult?.totaalBedrag ?? 0) / totaalKm) * 100) / 100
      : 0;

    // Calculate werkelijk zakelijk percentage from km-standen
    const kmStandenData = await db
      .select()
      .from(kmStanden)
      .where(
        and(
          eq(kmStanden.gebruikerId, gebruiker.id),
          eq(kmStanden.jaar, parseInt(jaar))
        )
      )
      .all();

    let werkelijkPercentage: number | null = null;
    let totaalGereden: number | null = null;
    let ontbrekendeMaanden: number[] = [];

    if (kmStandenData.length > 0) {
      totaalGereden = kmStandenData.reduce((sum, ks) => sum + (ks.eindStand - ks.beginStand), 0);
      if (totaalGereden > 0) {
        werkelijkPercentage = Math.round((totaalKm / totaalGereden) * 1000) / 10;
      }
      const huidigeMaand = parseInt(jaar) === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
      const ingevuldeMaanden = new Set(kmStandenData.map((ks) => ks.maand));
      for (let m = 1; m <= huidigeMaand; m++) {
        if (!ingevuldeMaanden.has(m)) ontbrekendeMaanden.push(m);
      }
    }

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
      perDoelType: perDoelType.map((d) => ({
        type: d.type,
        km: Math.round(d.km * 100) / 100,
        ritten: d.ritten,
        bedrag: Math.round(d.bedrag * 100) / 100,
      })),
      vorigJaarKm,
      verschilVorigJaar: totaalKm - vorigJaarKm,
      werkelijkPercentage,
      totaalGereden,
      ontbrekendeMaanden,
      brandstof: {
        totaalBedrag: Math.round((brandstofResult?.totaalBedrag ?? 0) * 100) / 100,
        totaalLiters: Math.round((brandstofResult?.totaalLiters ?? 0) * 100) / 100,
        aantalTankbeurten: brandstofResult?.aantalTankbeurten ?? 0,
        kostenPerKm,
        perMaand: brandstofPerMaand.map((m) => ({
          maand: m.maand,
          bedrag: Math.round(m.bedrag * 100) / 100,
          liters: Math.round(m.liters * 100) / 100,
          tankbeurten: m.tankbeurten,
        })),
        recent: recenteBrandstof.map((k) => ({
          id: k.id,
          datum: k.datum,
          bedrag: k.bedrag,
          liters: k.liters,
          kmStand: k.kmStand,
          notitie: k.notitie,
          isAutomatisch: k.bankTransactieId != null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
