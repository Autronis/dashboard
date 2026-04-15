// Smart matching between an inkomende factuur and a bank_transactie.
//
// The matcher scores each candidate on three axes:
//   - Amount overlap (tight ±2% = perfect, ±10% = loose)
//   - Merchant name overlap (token-based, case-insensitive)
//   - Date proximity (within 21 days forward/backward)
//
// A candidate must pass a minimum score threshold to be accepted. This
// prevents the old bug where pure ±5% amount matching paired a €12.10
// Rinkel invoice with a €12.10 Anthropic PDF.
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { and, eq, isNull, or, gte, lte, desc, sql } from "drizzle-orm";

export interface FactuurHint {
  leverancier: string;
  bedrag: number;
  datum: string;
  // Optional currency code (e.g. "EUR", "USD", "GBP"). When set, candidate
  // bank transactions with a *different* non-null valuta are filtered out —
  // prevents a $12.10 Anthropic USD invoice from matching a €12.10 bank tx.
  // Candidate txs with NULL valuta (legacy rows pre-currency-tracking) are
  // still accepted so we don't regress match rates on existing data.
  valuta?: string | null;
}

export interface MatchResult {
  tx: typeof bankTransacties.$inferSelect;
  score: number;
  reasons: string[];
}

// Stopwoorden die niks zeggen over de leverancier-identiteit
const STOP_WORDS = new Set([
  "bv", "b.v.", "bv.", "inc", "inc.", "ltd", "ltd.", "limited", "gmbh",
  "corporation", "corp", "corp.", "llc", "nv", "n.v.", "company", "co",
  "the", "de", "het", "een", "en", "van", "ireland", "netherlands",
  "nederland", "group", "international", "services", "service",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[,.\-()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function nameOverlap(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  let hits = 0;
  for (const t of ta) {
    if (tb.some((x) => x.includes(t) || t.includes(x))) hits++;
  }
  return hits / Math.max(ta.length, tb.length);
}

function amountScore(a: number, b: number): number {
  const abs = Math.abs(a);
  const diff = Math.abs(abs - Math.abs(b));
  const pct = diff / abs;
  if (pct <= 0.02) return 1;
  if (pct <= 0.05) return 0.75;
  if (pct <= 0.1) return 0.4;
  return 0;
}

function dateScore(a: string, b: string): number {
  const days = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
  if (days <= 3) return 1;
  if (days <= 7) return 0.8;
  if (days <= 14) return 0.5;
  if (days <= 21) return 0.25;
  return 0;
}

// Weighted scoring: name overlap is the strongest signal because it's the
// thing that most reliably distinguishes "same invoice" from "same amount
// coincidence". Date is a good tiebreaker. Amount is necessary but not
// sufficient.
const WEIGHTS = { name: 0.5, amount: 0.3, date: 0.2 };
const MIN_SCORE = 0.55; // must have SOME name overlap to pass

// Find all candidate bank-transactions for a factuur, scored and sorted.
// Used by the manual matching UI so Sem can pick from the top N candidates.
// Unlike findBestMatch this does NOT enforce the MIN_SCORE threshold — it
// returns everything that has at least some name overlap or a close amount,
// so Sem can override the matcher when needed.
export async function findCandidates(
  hint: FactuurHint,
  limit = 10
): Promise<MatchResult[]> {
  const absBedrag = Math.abs(hint.bedrag);
  // Wider window: ±30% amount, ±45 days. Caller filters down via score.
  const lo = absBedrag * 0.7;
  const hi = absBedrag * 1.3;
  const negLo = -hi;
  const negHi = -lo;

  const hintDate = new Date(hint.datum);
  const windowStart = new Date(hintDate.getTime() - 45 * 86400000).toISOString().slice(0, 10);
  const windowEnd = new Date(hintDate.getTime() + 45 * 86400000).toISOString().slice(0, 10);

  const valutaFilter = hint.valuta
    ? or(isNull(bankTransacties.valuta), eq(bankTransacties.valuta, hint.valuta))
    : sql`1=1`;

  const candidates = await db
    .select()
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        or(
          and(gte(bankTransacties.bedrag, lo), lte(bankTransacties.bedrag, hi)),
          and(gte(bankTransacties.bedrag, negLo), lte(bankTransacties.bedrag, negHi))
        ),
        isNull(bankTransacties.storageUrl),
        isNull(bankTransacties.bonPad),
        gte(bankTransacties.datum, windowStart),
        lte(bankTransacties.datum, windowEnd),
        valutaFilter
      )
    )
    .orderBy(desc(bankTransacties.datum))
    .limit(100);

  const scored: MatchResult[] = candidates.map((tx) => {
    const name = nameOverlap(hint.leverancier, tx.merchantNaam || tx.omschrijving || "");
    const amt = amountScore(hint.bedrag, tx.bedrag);
    const dat = dateScore(hint.datum, tx.datum);
    const score = WEIGHTS.name * name + WEIGHTS.amount * amt + WEIGHTS.date * dat;

    const reasons: string[] = [];
    if (name >= 0.5) reasons.push(`naam match ${Math.round(name * 100)}%`);
    else if (name > 0) reasons.push(`deels naam ${Math.round(name * 100)}%`);
    if (amt === 1) reasons.push("bedrag exact");
    else if (amt >= 0.75) reasons.push("bedrag ±5%");
    else if (amt >= 0.4) reasons.push("bedrag ±10%");
    if (dat >= 0.8) reasons.push("binnen week");
    else if (dat >= 0.5) reasons.push("binnen 2 weken");

    return { tx, score, reasons };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function findBestMatch(hint: FactuurHint): Promise<MatchResult | null> {
  const absBedrag = Math.abs(hint.bedrag);
  // Looser candidate window (±15%) — scoring filters later
  const lo = absBedrag * 0.85;
  const hi = absBedrag * 1.15;
  const negLo = -hi;
  const negHi = -lo;

  // ±21 day window around the invoice date for candidate retrieval
  const hintDate = new Date(hint.datum);
  const windowStart = new Date(hintDate.getTime() - 21 * 86400000).toISOString().slice(0, 10);
  const windowEnd = new Date(hintDate.getTime() + 21 * 86400000).toISOString().slice(0, 10);

  const valutaFilter = hint.valuta
    ? or(isNull(bankTransacties.valuta), eq(bankTransacties.valuta, hint.valuta))
    : sql`1=1`;

  const candidates = await db
    .select()
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        or(
          and(gte(bankTransacties.bedrag, lo), lte(bankTransacties.bedrag, hi)),
          and(gte(bankTransacties.bedrag, negLo), lte(bankTransacties.bedrag, negHi))
        ),
        isNull(bankTransacties.storageUrl),
        isNull(bankTransacties.bonPad),
        gte(bankTransacties.datum, windowStart),
        lte(bankTransacties.datum, windowEnd),
        valutaFilter
      )
    )
    .orderBy(desc(bankTransacties.datum))
    .limit(40);

  let best: MatchResult | null = null;
  for (const tx of candidates) {
    const name = nameOverlap(hint.leverancier, tx.merchantNaam || tx.omschrijving || "");
    const amt = amountScore(hint.bedrag, tx.bedrag);
    const dat = dateScore(hint.datum, tx.datum);

    // Hard floor: no amount match at all, skip
    if (amt === 0) continue;
    // Hard floor: zero name overlap AND the amount-match isn't tight, skip
    // (prevents random pairings of unrelated invoices with same amount).
    if (name === 0 && amt < 1) continue;

    const score = WEIGHTS.name * name + WEIGHTS.amount * amt + WEIGHTS.date * dat;

    if (!best || score > best.score) {
      const reasons: string[] = [];
      if (name >= 0.5) reasons.push(`naam match (${Math.round(name * 100)}%)`);
      else if (name > 0) reasons.push(`deels naam match (${Math.round(name * 100)}%)`);
      if (amt === 1) reasons.push("bedrag exact");
      else if (amt >= 0.75) reasons.push("bedrag binnen 5%");
      if (dat >= 0.8) reasons.push("datum binnen week");
      best = { tx, score, reasons };
    }
  }

  if (!best || best.score < MIN_SCORE) return null;
  return best;
}
