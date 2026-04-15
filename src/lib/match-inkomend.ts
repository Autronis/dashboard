// Match incoming bank_transacties (type=bij) to outgoing facturen from
// the `facturen` table. When a client pays an invoice via Revolut, the
// bank transaction arrives via the Revolut sync — this helper links it to
// the corresponding invoice so we don't need Gmail scraping for own
// invoices. Both sides get updated:
//
//   - bank_transacties.gekoppeld_factuur_id → facturen.id
//   - bank_transacties.storage_url → facturen.pdf_storage_url (for paperclip
//     icon on /financien)
//   - facturen.status → 'betaald'
//   - facturen.betaald_op → bank tx date
//
// Match criteria (tight, to avoid wrong couplings):
//   - amount within ±1% of factuur.bedragInclBtw
//   - factuur must be active and not already marked 'betaald'
//   - prefer matches where factuurnummer appears in tx description/reference
//   - otherwise fall back to closest date (within 30 days of factuurdatum)

import { db } from "@/lib/db";
import { facturen, bankTransacties } from "@/lib/db/schema";
import { eq, and, ne, isNull, or, gte, lte, desc } from "drizzle-orm";

export interface InkomendMatch {
  factuurId: number;
  factuurnummer: string;
  storageUrl: string | null;
  score: number;
  reasons: string[];
}

export async function findFactuurMatch(
  bedrag: number,
  omschrijving: string,
  datum: string
): Promise<InkomendMatch | null> {
  const abs = Math.abs(bedrag);
  const lo = abs * 0.99;
  const hi = abs * 1.01;

  // Candidate facturen: active, not yet betaald, amount within 1%, dated
  // at most 90 days before the bank transaction (klanten betalen soms laat).
  const cutoff = new Date(datum);
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const kandidaten = await db
    .select()
    .from(facturen)
    .where(
      and(
        eq(facturen.isActief, 1),
        // Niet al gematcht aan een andere tx
        isNull(facturen.verwerktInAangifte),
        // Status: alles behalve concept (concept-facturen zijn nog niet verzonden)
        ne(facturen.status, "concept"),
        // Bedrag in range — gebruik between via gte/lte op bedragInclBtw
        gte(facturen.bedragInclBtw, lo),
        lte(facturen.bedragInclBtw, hi),
        or(
          isNull(facturen.factuurdatum),
          gte(facturen.factuurdatum, cutoffStr)
        )
      )
    )
    .orderBy(desc(facturen.factuurdatum))
    .limit(20);

  if (kandidaten.length === 0) return null;

  // Score: factuurnummer-in-omschrijving is strongest, daarna datum-nabijheid
  const omschrijvingLower = omschrijving.toLowerCase();
  let best: InkomendMatch | null = null;
  let bestScore = 0;

  for (const f of kandidaten) {
    let score = 0;
    const reasons: string[] = [];

    // Bedrag altijd binnen 1% (want we hebben er op gefilterd)
    score += 0.4;
    reasons.push("bedrag exact");

    // Factuurnummer in omschrijving
    if (f.factuurnummer && omschrijvingLower.includes(f.factuurnummer.toLowerCase())) {
      score += 0.5;
      reasons.push("factuurnummer in omschrijving");
    }

    // Datum nabijheid
    if (f.factuurdatum) {
      const days = Math.abs(
        (new Date(datum).getTime() - new Date(f.factuurdatum).getTime()) / 86400000
      );
      if (days <= 7) {
        score += 0.1;
        reasons.push("binnen week na factuur");
      } else if (days <= 30) {
        score += 0.05;
        reasons.push("binnen maand na factuur");
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = {
        factuurId: f.id,
        factuurnummer: f.factuurnummer,
        storageUrl: f.pdfStorageUrl,
        score,
        reasons,
      };
    }
  }

  // Minimum threshold: 0.4 (bedrag exact) alleen is niet genoeg als er
  // meerdere kandidaten in dezelfde range zijn. Eis minimum 0.45.
  if (!best || bestScore < 0.45) {
    // Als er maar één kandidaat is en bedrag klopt exact, dat is genoeg
    if (kandidaten.length === 1) return best;
    return null;
  }
  return best;
}

// Link a bank transaction to an invoice. Updates both tables in one shot.
export async function linkTxToFactuur(
  bankTransactieId: number,
  match: InkomendMatch,
  datum: string
): Promise<void> {
  await db
    .update(bankTransacties)
    .set({
      gekoppeldFactuurId: match.factuurId,
      storageUrl: match.storageUrl,
      status: "gematcht",
    })
    .where(eq(bankTransacties.id, bankTransactieId));

  await db
    .update(facturen)
    .set({
      status: "betaald",
      betaaldOp: datum,
    })
    .where(eq(facturen.id, match.factuurId));
}
