// Een borg / waarborgsom is GEEN kosten en GEEN omzet — het is een
// vordering (uitgegeven borg) of schuld (ontvangen borg) op de balans.
// We taggen die transacties met categorie='borg' zodat ze overal worden
// uitgesloten van P&L-aggregaties (kosten, BTW, winst).
//
// Hoort symmetrisch te werken met `vermogen` uit `vermogensstorting.ts`.

import { sql } from "drizzle-orm";
import { bankTransacties } from "@/lib/db/schema";
import { VERMOGEN_CATEGORIE } from "@/lib/vermogensstorting";

export const BORG_CATEGORIE = "borg" as const;

// Auto-detectie van borg-betalingen op basis van keywords in omschrijving
// of merchant name. Gebruik in revolut sync. Conservatief — bij twijfel
// false, Sem kan handmatig labelen via /financien.
const BORG_PATTERNS = [
  /\bborg\b/i,
  /\bwaarborgsom\b/i,
  /\bwaarborg\b/i,
  /\bdeposit\b/i,
  /\bsecurity\s*deposit\b/i,
];

export function isBorg(merchantNaam: string | null, omschrijving: string | null): boolean {
  const haystack = `${merchantNaam ?? ""} ${omschrijving ?? ""}`;
  return BORG_PATTERNS.some((re) => re.test(haystack));
}

// Shared list of "balance sheet" categories that should be excluded from
// every P&L / kosten / BTW aggregation. Use `notBalansCategorie()` in any
// drizzle WHERE clause that touches bank_transacties for finance reporting.
export const BALANS_CATEGORIEEN = [VERMOGEN_CATEGORIE, BORG_CATEGORIE] as const;

export function notBalansCategorie() {
  return sql`(${bankTransacties.categorie} IS NULL OR (${bankTransacties.categorie} != ${VERMOGEN_CATEGORIE} AND ${bankTransacties.categorie} != ${BORG_CATEGORIE}))`;
}
