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

const SEM_PATTERN = /\bgijsberts\b/i;
const SYB_PATTERN = /\bsprenkeler\b/i;

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

// Returns which partner did the deposit, based on family name in the
// merchant or description. Returns null if name is ambiguous (so caller
// can decide to leave eigenaar untagged).
//
// "Sprenkeler" → Syb (his legal surname). "Gijsberts" → Sem.
export function wieGestort(
  merchantNaam: string | null,
  omschrijving: string | null
): "sem" | "syb" | null {
  const haystack = `${merchantNaam ?? ""} ${omschrijving ?? ""}`;
  if (SEM_PATTERN.test(haystack)) return "sem";
  if (SYB_PATTERN.test(haystack)) return "syb";
  return null;
}
