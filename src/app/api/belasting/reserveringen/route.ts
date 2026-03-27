import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  belastingReserveringen,
  belastingAuditLog,
  facturen,
  uitgaven,
  investeringen,
  kilometerRegistraties,
  urenCriterium,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { berekenActieveUren } from "@/lib/screen-time-uren";

function berekenBelasting2026(belastbaarInkomen: number): number {
  if (belastbaarInkomen <= 0) return 0;
  const schijf1Grens = 75518;
  if (belastbaarInkomen <= schijf1Grens) {
    return Math.round(belastbaarInkomen * 0.3697 * 100) / 100;
  }
  return Math.round((schijf1Grens * 0.3697 + (belastbaarInkomen - schijf1Grens) * 0.4950) * 100) / 100;
}

async function berekenGeschatteBelasting(jaar: number): Promise<number> {
  const jaarStart = `${jaar}-01-01`;
  const jaarEind = `${jaar}-12-31`;

  const omzetResult = await db
    .select({ totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)` })
    .from(facturen)
    .where(and(eq(facturen.status, "betaald"), eq(facturen.isActief, 1), gte(facturen.betaaldOp, jaarStart), lte(facturen.betaaldOp, jaarEind)))
    .get();

  const brutoOmzet = omzetResult?.totaal ?? 0;

  const kostenResult = await db
    .select({ totaal: sql<number>`COALESCE(SUM(${uitgaven.bedrag}), 0)` })
    .from(uitgaven)
    .where(and(gte(uitgaven.datum, jaarStart), lte(uitgaven.datum, jaarEind)))
    .get();

  const totaleKosten = kostenResult?.totaal ?? 0;

  // Afschrijvingen
  const alleInvesteringen = await db.select().from(investeringen);
  let totaleAfschrijvingen = 0;
  for (const inv of alleInvesteringen) {
    const aanschafJaar = new Date(inv.datum).getFullYear();
    const termijn = inv.afschrijvingstermijn ?? 5;
    if (aanschafJaar > jaar || aanschafJaar + termijn <= jaar) continue;
    const jaarlijks = (inv.bedrag - (inv.restwaarde ?? 0)) / termijn;
    if (aanschafJaar === jaar) {
      const maanden = 12 - new Date(inv.datum).getMonth();
      totaleAfschrijvingen += jaarlijks * maanden / 12;
    } else {
      totaleAfschrijvingen += jaarlijks;
    }
  }

  // Km aftrek
  const kmResult = await db
    .select({ totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)` })
    .from(kilometerRegistraties)
    .where(and(gte(kilometerRegistraties.datum, jaarStart), lte(kilometerRegistraties.datum, jaarEind)))
    .get();

  const kmAftrek = (kmResult?.totaalKm ?? 0) * 0.23;

  const brutowinst = brutoOmzet - totaleKosten - totaleAfschrijvingen - kmAftrek;

  // Uren criterium
  // gebruikerId 1 = Sem (primary user)
  const totaalUren = await berekenActieveUren(1, `${jaar}-01-01`, `${jaar}-12-31`);

  const voldoet = totaalUren >= 1225;
  const za = voldoet ? 3750 : 0;
  const winstNaZA = Math.max(brutowinst - za, 0);
  const mkb = voldoet ? winstNaZA * 0.1331 : 0;
  const belastbaarInkomen = Math.max(brutowinst - za - mkb, 0);

  return berekenBelasting2026(belastbaarInkomen);
}

// GET /api/belasting/reserveringen?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();

    const maandStart = `${jaar}-01`;
    const maandEind = `${jaar}-12`;

    const reserveringen = await db
      .select()
      .from(belastingReserveringen)
      .where(
        and(
          gte(belastingReserveringen.maand, maandStart),
          lte(belastingReserveringen.maand, maandEind)
        )
      )
      .orderBy(belastingReserveringen.maand)
      ;

    const totaalGereserveerd = Math.round(
      reserveringen.reduce((sum, r) => sum + r.bedrag, 0) * 100
    ) / 100;

    // Bereken suggestie op basis van huidige W&V
    const geschatteBelasting = await berekenGeschatteBelasting(jaar);
    const suggestieMaandelijks = Math.round((geschatteBelasting / 12) * 100) / 100;
    const tekort = Math.round((geschatteBelasting - totaalGereserveerd) * 100) / 100;

    return NextResponse.json({
      reserveringen,
      samenvatting: {
        totaalGereserveerd,
        geschatteBelasting: Math.round(geschatteBelasting * 100) / 100,
        tekort: Math.max(tekort, 0),
        suggestieMaandelijks,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/belasting/reserveringen
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { maand, bedrag, type, notities } = body as {
      maand: string;
      bedrag: number;
      type?: string;
      notities?: string;
    };

    if (!maand || !bedrag) {
      return NextResponse.json(
        { fout: "Maand (YYYY-MM) en bedrag zijn verplicht." },
        { status: 400 }
      );
    }

    const result = await db
      .insert(belastingReserveringen)
      .values({
        maand,
        bedrag,
        type: (type as "btw" | "inkomstenbelasting" | "overig") ?? "inkomstenbelasting",
        notities,
      })
      .returning()
      ;

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "reservering_aangemaakt",
      entiteitType: "reservering",
      entiteitId: result[0]?.id,
      details: JSON.stringify({ maand, bedrag, type }),
    }).run();

    return NextResponse.json({ reservering: result[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
