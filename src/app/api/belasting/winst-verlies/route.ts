import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  facturen,
  bankTransacties,
  investeringen,
  kilometerRegistraties,
  urenCriterium,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, gte, lte, sql, or, isNull, ne } from "drizzle-orm";

// Exclude facturen that were already reported in an earlier BTW-aangifte.
// These stay visible in /administratie as proof but must not double-count
// in current omzet / BTW calculations.
const NIET_VERWERKT = isNull(facturen.verwerktInAangifte);
import { berekenActieveUren } from "@/lib/screen-time-uren";
import { notBalansCategorie } from "@/lib/borg";

// Kosten-filter: type=af, privé-uitgaven uitsluiten, vermogen + borg
// (balans-posten) ook eruit.
const KOSTEN_WHERE = (start: string, eind: string) =>
  and(
    eq(bankTransacties.type, "af"),
    gte(bankTransacties.datum, start),
    lte(bankTransacties.datum, eind),
    or(isNull(bankTransacties.fiscaalType), ne(bankTransacties.fiscaalType, "prive")),
    notBalansCategorie()
  );

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

    // Bruto omzet: betaalde facturen (verwerkt_in_aangifte uitgesloten)
    const omzetResult = await db
      .select({
        totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          eq(facturen.isActief, 1),
          gte(facturen.betaaldOp, jaarStart),
          lte(facturen.betaaldOp, jaarEind),
          NIET_VERWERKT
        )
      )
      .get();

    const brutoOmzet = Math.round((omzetResult?.totaal ?? 0) * 100) / 100;

    // Kosten per categorie — leest uit bank_transacties. Het bedrag is
    // incl. BTW; we trekken btw_bedrag eraf zodat kosten ex BTW zijn
    // (consistent met omzet ex BTW uit de facturen tabel).
    const kostenRows = await db
      .select({
        categorie: bankTransacties.categorie,
        totaalIncl: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
        totaalBtw: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
      })
      .from(bankTransacties)
      .where(KOSTEN_WHERE(jaarStart, jaarEind))
      .groupBy(bankTransacties.categorie);

    const kostenPerCategorie: KostenPerCategorie = {};
    let totaleKosten = 0;
    for (const row of kostenRows) {
      const cat = row.categorie ?? "overig";
      const excl = Math.round(((row.totaalIncl ?? 0) - (row.totaalBtw ?? 0)) * 100) / 100;
      // Aggregate — meerdere rows kunnen dezelfde cat hebben (null groep)
      kostenPerCategorie[cat] = (kostenPerCategorie[cat] ?? 0) + excl;
      totaleKosten += excl;
    }
    totaleKosten = Math.round(totaleKosten * 100) / 100;

    // Afschrijvingen
    const alleInvesteringen = await db
      .select()
      .from(investeringen)
      ;

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
    const kmResult = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          gte(kilometerRegistraties.datum, jaarStart),
          lte(kilometerRegistraties.datum, jaarEind)
        )
      )
      .get();

    const totaalKm = kmResult?.totaalKm ?? 0;
    const KM_TARIEF = 0.23;
    const kmAftrek = Math.round(totaalKm * KM_TARIEF * 100) / 100;

    // Uren criterium check
    const urenRecord = await db
      .select()
      .from(urenCriterium)
      .where(eq(urenCriterium.jaar, jaar))
      .limit(1)
      .get();

    // Bereken uren uit screen time
    const gebruiker = await requireAuth();
    const totaalUren = await berekenActieveUren(gebruiker.id, `${jaar}-01-01`, `${jaar}-12-31`);

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

    // Per kwartaal breakdown — 2 queries totaal (i.p.v. 8) via GROUP BY
    // op kwartaal-label. Scheelt veel round-trips naar Turso.
    const omzetPerQ = await db
      .select({
        q: sql<number>`CAST((CAST(strftime('%m', ${facturen.betaaldOp}) AS INTEGER) - 1) / 3 + 1 AS INTEGER)`,
        totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          eq(facturen.isActief, 1),
          gte(facturen.betaaldOp, jaarStart),
          lte(facturen.betaaldOp, jaarEind),
          NIET_VERWERKT
        )
      )
      .groupBy(sql`CAST((CAST(strftime('%m', ${facturen.betaaldOp}) AS INTEGER) - 1) / 3 + 1 AS INTEGER)`);

    const kostenPerQ = await db
      .select({
        q: sql<number>`CAST((CAST(strftime('%m', ${bankTransacties.datum}) AS INTEGER) - 1) / 3 + 1 AS INTEGER)`,
        totaalIncl: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
        totaalBtw: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
      })
      .from(bankTransacties)
      .where(KOSTEN_WHERE(jaarStart, jaarEind))
      .groupBy(sql`CAST((CAST(strftime('%m', ${bankTransacties.datum}) AS INTEGER) - 1) / 3 + 1 AS INTEGER)`);

    const omzetMap = new Map(omzetPerQ.map((r) => [Number(r.q), Number(r.totaal ?? 0)]));
    const kostenMap = new Map(
      kostenPerQ.map((r) => [
        Number(r.q),
        Math.round((Number(r.totaalIncl ?? 0) - Number(r.totaalBtw ?? 0)) * 100) / 100,
      ])
    );

    const perKwartaal: KwartaalData[] = [1, 2, 3, 4].map((q) => {
      const o = Math.round((omzetMap.get(q) ?? 0) * 100) / 100;
      const k = kostenMap.get(q) ?? 0;
      return { kwartaal: q, omzet: o, kosten: k, winst: Math.round((o - k) * 100) / 100 };
    });

    return NextResponse.json({
      winstVerlies: {
        jaar,
        brutoOmzet,
        kostenPerCategorie,
        totaleKosten,
        afschrijvingen: totaleAfschrijvingen,
        kmAftrek,
        kmTotaal: Math.round(totaalKm * 100) / 100,
        kmTarief: KM_TARIEF,
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
