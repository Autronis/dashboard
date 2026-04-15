import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, gte, lte, sql, isNull, or, ne } from "drizzle-orm";
import { VERMOGEN_CATEGORIE } from "@/lib/vermogensstorting";

// Kapitaalrekening telt ALLEEN op de huidige zakelijke Revolut rekening.
// Eerdere ING / inhaal-imports / oudere Revolut imports horen niet in dit
// overzicht thuis omdat ze de onboarding-fase representeren toen er nog
// geen partner-tracking bestond. Sem heeft expliciet gevraagd: "alleen
// nieuwe uitgaves en inkomsten op de huidige Revolut rekening".
const HUIDIGE_BANK = "revolut";

// Kapitaalrekening per VOF-partner. Berekent voor Sem en Syb apart:
//
//   Ingelegd        — som van vermogensstortingen waarvan eigenaar=hen
//   Eigen uitgaven  — uitgaven (type=af) waar eigenaar=hen, dus volledig op
//                     hun rekening (privé-uitgave die toevallig vanuit de
//                     zakelijke rekening ging — moeten ze terugbetalen)
//   Aandeel team    — teamuitgaven (eigenaar='gedeeld' of NULL) gedeeld
//                     door 2 (default 50/50, splitRatio kan dat overrulen)
//   Saldo           — Ingelegd − (Eigen + Aandeel team)
//                     positief = bedrijf is jou geld schuldig
//                     negatief = jij moet bedrijf nog inleggen
//
// Onderaan: wie moet wie betalen? Verschil tussen de twee saldo's, gedeeld
// door 2 — dat is het bedrag dat de "rijkere" partner naar de "armere" zou
// moeten overmaken om gelijk te staan.

interface PartnerSaldo {
  ingelegd: number;
  eigenUitgaven: number;
  aandeelTeam: number;
  saldo: number;
}

function parseSplit(ratio: string | null): [number, number] {
  if (!ratio) return [0.5, 0.5];
  const parts = ratio.split("/").map((p) => Number(p) / 100);
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
    return [parts[0], parts[1]];
  }
  return [0.5, 0.5];
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();
    const start = `${jaar}-01-01`;
    const eind = `${jaar}-12-31`;

    // 1. Ingelegd per partner (stortingen) — alleen huidige Revolut
    const stortingen = await db
      .select({
        eigenaar: bankTransacties.eigenaar,
        totaal: sql<number>`COALESCE(SUM(${bankTransacties.bedrag}), 0)`,
      })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.bank, HUIDIGE_BANK),
          eq(bankTransacties.type, "bij"),
          eq(bankTransacties.categorie, VERMOGEN_CATEGORIE),
          gte(bankTransacties.datum, start),
          lte(bankTransacties.datum, eind)
        )
      )
      .groupBy(bankTransacties.eigenaar);

    // 2. Eigen uitgaven per partner — alleen huidige Revolut
    const eigenUitgaven = await db
      .select({
        eigenaar: bankTransacties.eigenaar,
        totaal: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
      })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.bank, HUIDIGE_BANK),
          eq(bankTransacties.type, "af"),
          gte(bankTransacties.datum, start),
          lte(bankTransacties.datum, eind),
          or(eq(bankTransacties.eigenaar, "sem"), eq(bankTransacties.eigenaar, "syb")),
          or(isNull(bankTransacties.categorie), ne(bankTransacties.categorie, VERMOGEN_CATEGORIE))
        )
      )
      .groupBy(bankTransacties.eigenaar);

    // 3. Team uitgaven — alleen huidige Revolut
    const teamRows = await db
      .select({
        bedrag: bankTransacties.bedrag,
        eigenaar: bankTransacties.eigenaar,
        splitRatio: bankTransacties.splitRatio,
      })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.bank, HUIDIGE_BANK),
          eq(bankTransacties.type, "af"),
          gte(bankTransacties.datum, start),
          lte(bankTransacties.datum, eind),
          or(isNull(bankTransacties.eigenaar), eq(bankTransacties.eigenaar, "gedeeld")),
          or(isNull(bankTransacties.categorie), ne(bankTransacties.categorie, VERMOGEN_CATEGORIE))
        )
      );

    let teamTotaal = 0;
    let semAandeel = 0;
    let sybAandeel = 0;
    for (const row of teamRows) {
      const abs = Math.abs(row.bedrag);
      teamTotaal += abs;
      const [semPct, sybPct] = parseSplit(row.splitRatio);
      semAandeel += abs * semPct;
      sybAandeel += abs * sybPct;
    }

    const stortingMap = new Map(
      stortingen.map((s) => [s.eigenaar ?? "onbekend", Number(s.totaal ?? 0)])
    );
    const eigenMap = new Map(
      eigenUitgaven.map((s) => [s.eigenaar ?? "onbekend", Number(s.totaal ?? 0)])
    );

    const sem: PartnerSaldo = {
      ingelegd: r2(stortingMap.get("sem") ?? 0),
      eigenUitgaven: r2(eigenMap.get("sem") ?? 0),
      aandeelTeam: r2(semAandeel),
      saldo: 0,
    };
    sem.saldo = r2(sem.ingelegd - sem.eigenUitgaven - sem.aandeelTeam);

    const syb: PartnerSaldo = {
      ingelegd: r2(stortingMap.get("syb") ?? 0),
      eigenUitgaven: r2(eigenMap.get("syb") ?? 0),
      aandeelTeam: r2(sybAandeel),
      saldo: 0,
    };
    syb.saldo = r2(syb.ingelegd - syb.eigenUitgaven - syb.aandeelTeam);

    // Ongetaggde stortingen — hint voor Sem dat er nog wat te labelen valt
    const ongetagdStorting = r2(stortingMap.get("onbekend") ?? 0);
    const ongetagdEigen = r2(eigenMap.get("onbekend") ?? 0);

    // Verrekening — wie moet wie betalen om gelijk te staan?
    // Verschil tussen de saldo's. De partner met het LAGERE saldo moet de
    // andere bijbetalen tot ze gelijk zijn (helft van het verschil).
    let verrekening = {
      van: null as "sem" | "syb" | null,
      naar: null as "sem" | "syb" | null,
      bedrag: 0,
    };
    const verschil = sem.saldo - syb.saldo;
    if (Math.abs(verschil) > 0.01) {
      const helft = r2(Math.abs(verschil) / 2);
      if (verschil > 0) {
        // Sem heeft hoger saldo → Syb moet Sem betalen om gelijk te komen
        verrekening = { van: "syb", naar: "sem", bedrag: helft };
      } else {
        verrekening = { van: "sem", naar: "syb", bedrag: helft };
      }
    }

    return NextResponse.json({
      jaar,
      sem,
      syb,
      teamUitgaven: r2(teamTotaal),
      verrekening,
      ongetagdStorting,
      ongetagdEigen,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
