import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  facturen,
  uitgaven,
  investeringen,
  kilometerRegistraties,
  urenCriterium,
  tijdregistraties,
  btwAangiftes,
  belastingReserveringen,
  voorlopigeAanslagen,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { berekenActieveUren } from "@/lib/screen-time-uren";

interface KwartaalOmzet {
  kwartaal: number;
  bedrag: number;
}

interface KwartaalBtw {
  kwartaal: number;
  ontvangen: number;
  betaald: number;
  afdragen: number;
}

function getQuarterDateRange(kwartaal: number, jaar: number): { start: string; end: string } {
  switch (kwartaal) {
    case 1: return { start: `${jaar}-01-01`, end: `${jaar}-03-31` };
    case 2: return { start: `${jaar}-04-01`, end: `${jaar}-06-30` };
    case 3: return { start: `${jaar}-07-01`, end: `${jaar}-09-30` };
    case 4: return { start: `${jaar}-10-01`, end: `${jaar}-12-31` };
    default: return { start: `${jaar}-01-01`, end: `${jaar}-12-31` };
  }
}

function berekenAfschrijving(
  bedrag: number,
  restwaarde: number,
  termijn: number,
  aanschafDatum: string,
  jaar: number
): number {
  const aanschafJaar = new Date(aanschafDatum).getFullYear();
  if (aanschafJaar > jaar || aanschafJaar + termijn <= jaar) return 0;
  const jaarlijks = (bedrag - restwaarde) / termijn;
  if (aanschafJaar === jaar) {
    const maanden = 12 - new Date(aanschafDatum).getMonth();
    return Math.round((jaarlijks * maanden / 12) * 100) / 100;
  }
  return Math.round(jaarlijks * 100) / 100;
}

function berekenKIA(totaal: number): number {
  if (totaal < 2801 || totaal > 69764) return 0;
  return Math.round(totaal * 0.28 * 100) / 100;
}

function berekenBelasting2026(belastbaarInkomen: number): number {
  if (belastbaarInkomen <= 0) return 0;
  const schijf1Grens = 75518;
  if (belastbaarInkomen <= schijf1Grens) {
    return Math.round(belastbaarInkomen * 0.3697 * 100) / 100;
  }
  return Math.round((schijf1Grens * 0.3697 + (belastbaarInkomen - schijf1Grens) * 0.4950) * 100) / 100;
}

// GET /api/belasting/jaaroverzicht?jaar=2026
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();

    const jaarStart = `${jaar}-01-01`;
    const jaarEind = `${jaar}-12-31`;

    // === OMZET ===
    const omzetResult = await db
      .select({ totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
      .from(facturen)
      .where(and(eq(facturen.status, "betaald"), eq(facturen.isActief, 1), gte(facturen.betaaldOp, jaarStart), lte(facturen.betaaldOp, jaarEind)))
      .get();

    const omzetTotaal = Math.round((omzetResult?.totaal ?? 0) * 100) / 100;

    const omzetPerKwartaal: KwartaalOmzet[] = [];
    for (let q = 1; q <= 4; q++) {
      const { start, end } = getQuarterDateRange(q, jaar);
      const r = await db
        .select({ totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
        .from(facturen)
        .where(and(eq(facturen.status, "betaald"), eq(facturen.isActief, 1), gte(facturen.betaaldOp, start), lte(facturen.betaaldOp, end)))
        .get();
      omzetPerKwartaal.push({ kwartaal: q, bedrag: Math.round((r?.totaal ?? 0) * 100) / 100 });
    }

    // === KOSTEN ===
    const kostenRows = await db
      .select({ categorie: uitgaven.categorie, totaal: sql<number>`COALESCE(SUM(${uitgaven.bedrag}), 0)` })
      .from(uitgaven)
      .where(and(gte(uitgaven.datum, jaarStart), lte(uitgaven.datum, jaarEind)))
      .groupBy(uitgaven.categorie)
      ;

    const kostenPerCategorie: Record<string, number> = {};
    let kostenTotaal = 0;
    for (const row of kostenRows) {
      const cat = row.categorie ?? "overig";
      const bedrag = Math.round((row.totaal ?? 0) * 100) / 100;
      kostenPerCategorie[cat] = bedrag;
      kostenTotaal += bedrag;
    }
    kostenTotaal = Math.round(kostenTotaal * 100) / 100;

    // === BTW ===
    const btwRecords = await db
      .select()
      .from(btwAangiftes)
      .where(eq(btwAangiftes.jaar, jaar))
      .orderBy(btwAangiftes.kwartaal)
      ;

    // Enrich BTW from facturen/uitgaven
    const btwPerKwartaal: KwartaalBtw[] = [];
    let btwOntvangenTotaal = 0;
    let btwBetaaldTotaal = 0;

    for (let q = 1; q <= 4; q++) {
      const { start, end } = getQuarterDateRange(q, jaar);

      const fResult = await db
        .select({ totaal: sql<number>`COALESCE(SUM(${facturen.btwBedrag}), 0)` })
        .from(facturen)
        .where(and(eq(facturen.status, "betaald"), eq(facturen.isActief, 1), gte(facturen.betaaldOp, start), lte(facturen.betaaldOp, end)))
        .get();

      const uResult = await db
        .select({ totaal: sql<number>`COALESCE(SUM(${uitgaven.btwBedrag}), 0)` })
        .from(uitgaven)
        .where(and(gte(uitgaven.datum, start), lte(uitgaven.datum, end)))
        .get();

      const ontvangen = Math.round((fResult?.totaal ?? 0) * 100) / 100;
      const betaald = Math.round((uResult?.totaal ?? 0) * 100) / 100;
      btwOntvangenTotaal += ontvangen;
      btwBetaaldTotaal += betaald;

      const btwRecord = btwRecords.find((r) => r.kwartaal === q);
      btwPerKwartaal.push({
        kwartaal: q,
        ontvangen,
        betaald,
        afdragen: Math.round((ontvangen - betaald) * 100) / 100,
        ...( btwRecord ? { status: btwRecord.status } : {}),
      });
    }

    const btwAfgedragenTotaal = Math.round((btwOntvangenTotaal - btwBetaaldTotaal) * 100) / 100;

    // === UREN ===
    const urenRecord = await db.select().from(urenCriterium).where(eq(urenCriterium.jaar, jaar)).limit(1).get();
    // Altijd realtime berekenen vanuit screen time (zelfde logica als Tijd pagina)
    const totaalUren = await berekenActieveUren(gebruiker.id, jaarStart, jaarEind);
    const urenVoldoet = totaalUren >= 1225;

    // === KILOMETERS ===
    const kmResult = await db
      .select({ totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)` })
      .from(kilometerRegistraties)
      .where(and(gte(kilometerRegistraties.datum, jaarStart), lte(kilometerRegistraties.datum, jaarEind)))
      .get();

    const totaalKm = Math.round((kmResult?.totaalKm ?? 0) * 100) / 100;
    const kmAftrekBedrag = Math.round(totaalKm * 0.23 * 100) / 100;

    // === INVESTERINGEN ===
    const alleInvesteringen = await db.select().from(investeringen);
    const investeringenDitJaar = alleInvesteringen.filter(
      (inv) => inv.datum >= jaarStart && inv.datum <= jaarEind
    );
    const investeringenTotaal = Math.round(
      investeringenDitJaar.reduce((s, i) => s + i.bedrag, 0) * 100
    ) / 100;

    let afschrijvingenTotaal = 0;
    for (const inv of alleInvesteringen) {
      afschrijvingenTotaal += berekenAfschrijving(
        inv.bedrag, inv.restwaarde ?? 0, inv.afschrijvingstermijn ?? 5, inv.datum, jaar
      );
    }
    afschrijvingenTotaal = Math.round(afschrijvingenTotaal * 100) / 100;

    const kia = berekenKIA(investeringenTotaal);

    // === WINST & VERLIES ===
    const brutowinst = Math.round((omzetTotaal - kostenTotaal - afschrijvingenTotaal - kmAftrekBedrag) * 100) / 100;
    const zelfstandigenaftrek = urenVoldoet ? 3750 : 0;
    const winstNaZA = Math.max(brutowinst - zelfstandigenaftrek, 0);
    const mkbVrijstelling = urenVoldoet ? Math.round(winstNaZA * 0.1331 * 100) / 100 : 0;
    const belastbaarInkomen = Math.max(
      Math.round((brutowinst - zelfstandigenaftrek - mkbVrijstelling) * 100) / 100,
      0
    );
    const geschatteBelasting = berekenBelasting2026(belastbaarInkomen);
    const effectiefTarief = belastbaarInkomen > 0
      ? Math.round((geschatteBelasting / belastbaarInkomen) * 1000) / 10
      : 0;

    // === RESERVERINGEN ===
    const maandStart = `${jaar}-01`;
    const maandEind = `${jaar}-12`;
    const reserveringen = await db
      .select()
      .from(belastingReserveringen)
      .where(and(gte(belastingReserveringen.maand, maandStart), lte(belastingReserveringen.maand, maandEind)))
      ;

    const totaalGereserveerd = Math.round(
      reserveringen.reduce((s, r) => s + r.bedrag, 0) * 100
    ) / 100;

    const reserveringTekort = Math.max(
      Math.round((geschatteBelasting - totaalGereserveerd) * 100) / 100,
      0
    );

    // === VOORLOPIGE AANSLAGEN ===
    const aanslagen = await db
      .select()
      .from(voorlopigeAanslagen)
      .where(eq(voorlopigeAanslagen.jaar, jaar))
      ;

    const aanslagenTotaal = Math.round(aanslagen.reduce((s, a) => s + a.bedrag, 0) * 100) / 100;
    const aanslagenBetaald = Math.round(aanslagen.reduce((s, a) => s + (a.betaaldBedrag ?? 0), 0) * 100) / 100;
    const aanslagenOpenstaand = Math.round((aanslagenTotaal - aanslagenBetaald) * 100) / 100;

    return NextResponse.json({
      jaaroverzicht: {
        jaar,
        omzet: {
          totaal: omzetTotaal,
          perKwartaal: omzetPerKwartaal,
        },
        kosten: {
          totaal: kostenTotaal,
          perCategorie: kostenPerCategorie,
        },
        btw: {
          ontvangen: Math.round(btwOntvangenTotaal * 100) / 100,
          betaald: Math.round(btwBetaaldTotaal * 100) / 100,
          afgedragen: btwAfgedragenTotaal,
          perKwartaal: btwPerKwartaal,
        },
        uren: {
          totaal: totaalUren,
          doel: 1225,
          voldoet: urenVoldoet,
        },
        kilometers: {
          totaalKm,
          aftrekbaarBedrag: kmAftrekBedrag,
        },
        investeringen: {
          totaal: investeringenTotaal,
          afschrijvingen: afschrijvingenTotaal,
          kia,
        },
        winstVerlies: {
          brutoOmzet: omzetTotaal,
          totaleKosten: kostenTotaal,
          afschrijvingen: afschrijvingenTotaal,
          kmAftrek: kmAftrekBedrag,
          brutowinst,
          zelfstandigenaftrek,
          mkbVrijstelling,
          belastbaarInkomen,
          geschatteBelasting,
          effectiefTarief,
        },
        reserveringen: {
          gereserveerd: totaalGereserveerd,
          nodig: Math.round(geschatteBelasting * 100) / 100,
          tekort: reserveringTekort,
        },
        voorlopigeAanslagen: {
          totaal: aanslagenTotaal,
          betaald: aanslagenBetaald,
          openstaand: aanslagenOpenstaand,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
