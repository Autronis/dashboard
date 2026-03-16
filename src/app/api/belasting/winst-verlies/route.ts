import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  facturen,
  uitgaven,
  investeringen,
  kilometerRegistraties,
  urenCriterium,
  tijdregistraties,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, gte, lte, sql } from "drizzle-orm";

interface KwartaalData {
  kwartaal: number;
  omzet: number;
  kosten: number;
  winst: number;
}

interface KostenPerCategorie {
  [categorie: string]: number;
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
  const aanschafMaand = new Date(aanschafDatum).getMonth(); // 0-indexed

  // Investment not yet active or fully depreciated
  if (aanschafJaar > jaar) return 0;
  if (aanschafJaar + termijn <= jaar) return 0;

  const jaarlijkseAfschrijving = (bedrag - restwaarde) / termijn;

  // Proportional for first year
  if (aanschafJaar === jaar) {
    const maandenActief = 12 - aanschafMaand;
    return Math.round((jaarlijkseAfschrijving * maandenActief / 12) * 100) / 100;
  }

  return Math.round(jaarlijkseAfschrijving * 100) / 100;
}

function berekenBelasting2026(belastbaarInkomen: number): number {
  if (belastbaarInkomen <= 0) return 0;

  const schijf1Grens = 75518;
  const schijf1Tarief = 0.3697;
  const schijf2Tarief = 0.4950;

  if (belastbaarInkomen <= schijf1Grens) {
    return Math.round(belastbaarInkomen * schijf1Tarief * 100) / 100;
  }

  const belastingSchijf1 = schijf1Grens * schijf1Tarief;
  const belastingSchijf2 = (belastbaarInkomen - schijf1Grens) * schijf2Tarief;
  return Math.round((belastingSchijf1 + belastingSchijf2) * 100) / 100;
}

// GET /api/belasting/winst-verlies?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();

    const jaarStart = `${jaar}-01-01`;
    const jaarEind = `${jaar}-12-31`;

    // Bruto omzet: betaalde facturen
    const [omzetResult] = await db
      .select({
        totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          eq(facturen.isActief, 1),
          gte(facturen.betaaldOp, jaarStart),
          lte(facturen.betaaldOp, jaarEind)
        )
      );

    const brutoOmzet = Math.round((omzetResult?.totaal ?? 0) * 100) / 100;

    // Kosten per categorie
    const kostenRows = await db
      .select({
        categorie: uitgaven.categorie,
        totaal: sql<number>`COALESCE(SUM(${uitgaven.bedrag}), 0)`,
      })
      .from(uitgaven)
      .where(
        and(
          gte(uitgaven.datum, jaarStart),
          lte(uitgaven.datum, jaarEind)
        )
      )
      .groupBy(uitgaven.categorie);

    const kostenPerCategorie: KostenPerCategorie = {};
    let totaleKosten = 0;
    for (const row of kostenRows) {
      const cat = row.categorie ?? "overig";
      const bedrag = Math.round((row.totaal ?? 0) * 100) / 100;
      kostenPerCategorie[cat] = bedrag;
      totaleKosten += bedrag;
    }
    totaleKosten = Math.round(totaleKosten * 100) / 100;

    // Afschrijvingen
    const alleInvesteringen = await db
      .select()
      .from(investeringen);

    let totaleAfschrijvingen = 0;
    for (const inv of alleInvesteringen) {
      totaleAfschrijvingen += berekenAfschrijving(
        inv.bedrag,
        inv.restwaarde ?? 0,
        inv.afschrijvingstermijn ?? 5,
        inv.datum,
        jaar
      );
    }
    totaleAfschrijvingen = Math.round(totaleAfschrijvingen * 100) / 100;

    // Kilometer aftrek
    const [kmResult] = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          gte(kilometerRegistraties.datum, jaarStart),
          lte(kilometerRegistraties.datum, jaarEind)
        )
      );

    const totaalKm = kmResult?.totaalKm ?? 0;
    const kmAftrek = Math.round(totaalKm * 0.23 * 100) / 100;

    // Uren criterium check
    const [urenRecord] = await db
      .select()
      .from(urenCriterium)
      .where(eq(urenCriterium.jaar, jaar))
      .limit(1);

    // If no urenCriterium record, calculate from tijdregistraties
    let totaalUren = urenRecord?.behaaldUren ?? 0;
    if (!urenRecord) {
      const [urenResult] = await db
        .select({
          totaal: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)`,
        })
        .from(tijdregistraties)
        .where(
          and(
            gte(tijdregistraties.startTijd, jaarStart),
            lte(tijdregistraties.startTijd, jaarEind)
          )
        );
      totaalUren = Math.round(((urenResult?.totaal ?? 0) / 60) * 100) / 100;
    }

    const urenCriteriumVoldoet = totaalUren >= 1225;

    // Winst berekening
    const brutowinst = Math.round((brutoOmzet - totaleKosten - totaleAfschrijvingen - kmAftrek) * 100) / 100;

    const zelfstandigenaftrek = urenCriteriumVoldoet ? 3750 : 0;

    const winstNaZA = Math.max(brutowinst - zelfstandigenaftrek, 0);
    const mkbVrijstelling = urenCriteriumVoldoet
      ? Math.round(winstNaZA * 0.1331 * 100) / 100
      : 0;

    const belastbaarInkomen = Math.max(
      Math.round((brutowinst - zelfstandigenaftrek - mkbVrijstelling) * 100) / 100,
      0
    );

    const geschatteBelasting = berekenBelasting2026(belastbaarInkomen);

    const effectiefTarief = belastbaarInkomen > 0
      ? Math.round((geschatteBelasting / belastbaarInkomen) * 1000) / 10
      : 0;

    // Per kwartaal breakdown
    const perKwartaal: KwartaalData[] = [];
    for (let q = 1; q <= 4; q++) {
      const { start, end } = getQuarterDateRange(q, jaar);

      const [qOmzet] = await db
        .select({
          totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
        })
        .from(facturen)
        .where(
          and(
            eq(facturen.status, "betaald"),
            eq(facturen.isActief, 1),
            gte(facturen.betaaldOp, start),
            lte(facturen.betaaldOp, end)
          )
        );

      const [qKosten] = await db
        .select({
          totaal: sql<number>`COALESCE(SUM(${uitgaven.bedrag}), 0)`,
        })
        .from(uitgaven)
        .where(
          and(
            gte(uitgaven.datum, start),
            lte(uitgaven.datum, end)
          )
        );

      const qOmzetVal = Math.round((qOmzet?.totaal ?? 0) * 100) / 100;
      const qKostenVal = Math.round((qKosten?.totaal ?? 0) * 100) / 100;

      perKwartaal.push({
        kwartaal: q,
        omzet: qOmzetVal,
        kosten: qKostenVal,
        winst: Math.round((qOmzetVal - qKostenVal) * 100) / 100,
      });
    }

    return NextResponse.json({
      winstVerlies: {
        jaar,
        brutoOmzet,
        kostenPerCategorie,
        totaleKosten,
        afschrijvingen: totaleAfschrijvingen,
        kmAftrek,
        brutowinst,
        urenCriterium: {
          totaalUren,
          doel: 1225,
          voldoet: urenCriteriumVoldoet,
        },
        zelfstandigenaftrek,
        mkbVrijstelling,
        belastbaarInkomen,
        geschatteBelasting,
        effectiefTarief,
        perKwartaal,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
