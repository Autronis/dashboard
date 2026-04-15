// Detect if an incoming bank transaction is an owner equity deposit
// (vermogensstorting) — money coming in from Sem or Syb's private accounts
// as a capital injection. These are NOT revenue, must not be counted as
// omzet, and must not appear in BTW afgedragen calculations.
//
// Patterns we look for in merchant_naam or omschrijving:
//   - "Sem Gijsberts" / "S. Gijsberts" / "Gijsberts"
//   - "Manuel Sprenkeler" / "M. Sprenkeler" / "Sprenkeler" (Syb's legal name)
//   - "Syb Sprenkeler"
//
// The sentinel category used on bank_transacties.categorie is "vermogen".
// All revenue/BTW aggregations filter that out.

const OWNER_NAME_PATTERNS = [
  /\bgijsberts\b/i,
  /\bsprenkeler\b/i,
];

export const VERMOGEN_CATEGORIE = "vermogen";

export function isVermogensstorting(
  type: "bij" | "af",
  merchantNaam: string | null,
  omschrijving: string | null
): boolean {
  // Only incoming (bij) transactions count as potential deposits.
  if (type !== "bij") return false;

  const haystack = `${merchantNaam ?? ""} ${omschrijving ?? ""}`;
  return OWNER_NAME_PATTERNS.some((re) => re.test(haystack));
}
