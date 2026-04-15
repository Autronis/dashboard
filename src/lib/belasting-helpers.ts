// Centralized helpers for reading business costs from bank_transacties.
//
// The legacy `uitgaven` table is no longer populated — all costs now live
// in `bank_transacties` (Revolut sync + ING import + manual entries). This
// helper provides the canonical WHERE-clause + derived aggregates so every
// tax route reads identical numbers.
//
// Rules applied here:
//   - type = 'af' (outgoing money)
//   - fiscaalType ≠ 'prive' (private expenses don't count as business costs)
//   - categorie ≠ 'vermogen' (safety — vermogen is a type=bij sentinel but
//     we defend against mislabeled rows)
//
// Cost figures are returned both INCL and EXCL BTW so callers can use
// whichever fits. Typical BTW aangifte uses excl (costs + deductible
// voorbelasting separately); winst/verlies uses excl.

import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { and, eq, gte, lte, sql, or, isNull, ne, desc } from "drizzle-orm";
import { VERMOGEN_CATEGORIE } from "@/lib/vermogensstorting";

export function kostenWhere(start: string, eind: string) {
  return and(
    eq(bankTransacties.type, "af"),
    gte(bankTransacties.datum, start),
    lte(bankTransacties.datum, eind),
    or(isNull(bankTransacties.fiscaalType), ne(bankTransacties.fiscaalType, "prive")),
    or(isNull(bankTransacties.categorie), ne(bankTransacties.categorie, VERMOGEN_CATEGORIE))
  );
}

export interface KostenTotalen {
  inclBtw: number;
  btw: number;
  exclBtw: number;
  aantal: number;
}

export async function getKostenTotalen(start: string, eind: string): Promise<KostenTotalen> {
  const [row] = await db
    .select({
      inclBtw: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
      btw: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
      aantal: sql<number>`COUNT(*)`,
    })
    .from(bankTransacties)
    .where(kostenWhere(start, eind));

  const inclBtw = Math.round((row?.inclBtw ?? 0) * 100) / 100;
  const btw = Math.round((row?.btw ?? 0) * 100) / 100;
  return {
    inclBtw,
    btw,
    exclBtw: Math.round((inclBtw - btw) * 100) / 100,
    aantal: Number(row?.aantal ?? 0),
  };
}

export interface KostenRij {
  id: number;
  datum: string;
  leverancier: string;
  omschrijving: string;
  bedrag: number; // incl BTW
  btwBedrag: number;
  categorie: string | null;
  fiscaalType: string | null;
}

export async function getKostenRijen(start: string, eind: string): Promise<KostenRij[]> {
  const rows = await db
    .select({
      id: bankTransacties.id,
      datum: bankTransacties.datum,
      merchantNaam: bankTransacties.merchantNaam,
      omschrijving: bankTransacties.omschrijving,
      bedrag: bankTransacties.bedrag,
      btwBedrag: bankTransacties.btwBedrag,
      categorie: bankTransacties.categorie,
      fiscaalType: bankTransacties.fiscaalType,
    })
    .from(bankTransacties)
    .where(kostenWhere(start, eind))
    .orderBy(desc(bankTransacties.datum));

  return rows.map((r) => ({
    id: r.id,
    datum: r.datum,
    leverancier: r.merchantNaam ?? r.omschrijving,
    omschrijving: r.omschrijving,
    bedrag: Math.abs(r.bedrag),
    btwBedrag: r.btwBedrag ?? 0,
    categorie: r.categorie,
    fiscaalType: r.fiscaalType,
  }));
}

export async function getKostenPerCategorie(
  start: string,
  eind: string
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      categorie: bankTransacties.categorie,
      inclBtw: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
      btw: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
    })
    .from(bankTransacties)
    .where(kostenWhere(start, eind))
    .groupBy(bankTransacties.categorie);

  const result: Record<string, number> = {};
  for (const r of rows) {
    const cat = r.categorie ?? "overig";
    const excl = Math.round(((r.inclBtw ?? 0) - (r.btw ?? 0)) * 100) / 100;
    result[cat] = (result[cat] ?? 0) + excl;
  }
  return result;
}
