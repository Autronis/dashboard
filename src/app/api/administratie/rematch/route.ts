import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, isNull, between, sql } from "drizzle-orm";

// Find a bank transaction that matches a given amount ±5%, with no existing bon.
// Handles both positive (Revolut sync) and negative (ING import) amount conventions.
async function findMatchingTransaction(bedrag: number, datumHint?: string) {
  const absBedrag = Math.abs(bedrag);
  const lo = absBedrag * 0.95;
  const hi = absBedrag * 1.05;
  const negLo = -(absBedrag * 1.05);
  const negHi = -(absBedrag * 0.95);

  // First try positive range (Revolut convention)
  const positive = await db
    .select()
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        between(bankTransacties.bedrag, lo, hi),
        isNull(bankTransacties.storageUrl),
        isNull(bankTransacties.bonPad)
      )
    )
    .limit(5);

  if (positive.length > 0) {
    // If a datum hint is given, prefer the closest date
    if (datumHint) {
      positive.sort((a, b) => {
        const da = Math.abs(new Date(a.datum).getTime() - new Date(datumHint).getTime());
        const db2 = Math.abs(new Date(b.datum).getTime() - new Date(datumHint).getTime());
        return da - db2;
      });
    }
    return positive[0];
  }

  // Fallback: negative range (ING import)
  const negative = await db
    .select()
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        between(bankTransacties.bedrag, negLo, negHi),
        isNull(bankTransacties.storageUrl),
        isNull(bankTransacties.bonPad)
      )
    )
    .limit(5);

  if (negative.length === 0) return null;

  if (datumHint) {
    negative.sort((a, b) => {
      const da = Math.abs(new Date(a.datum).getTime() - new Date(datumHint).getTime());
      const db2 = Math.abs(new Date(b.datum).getTime() - new Date(datumHint).getTime());
      return da - db2;
    });
  }
  return negative[0];
}

// POST /api/administratie/rematch — probeer alle onbekoppelde inkomende
// facturen opnieuw te koppelen aan een bank-transactie. Idempotent: facturen
// die al gematcht zijn blijven gematcht, onbekoppelde blijven proberen te
// matchen totdat er een match gevonden wordt of definitief niet kan.
export async function POST() {
  try {
    await requireAuth();

    const onbekoppeld = await db
      .select()
      .from(inkomendeFacturen)
      .where(eq(inkomendeFacturen.status, "onbekoppeld"));

    let gematcht = 0;
    const resultaten: Array<{ id: number; leverancier: string; bedrag: number; gematchtAan?: number }> = [];

    for (const factuur of onbekoppeld) {
      const match = await findMatchingTransaction(factuur.bedrag, factuur.datum);
      if (!match) {
        resultaten.push({ id: factuur.id, leverancier: factuur.leverancier, bedrag: factuur.bedrag });
        continue;
      }

      await db
        .update(inkomendeFacturen)
        .set({
          bankTransactieId: match.id,
          status: "gematcht",
        })
        .where(eq(inkomendeFacturen.id, factuur.id));

      if (factuur.storageUrl) {
        await db
          .update(bankTransacties)
          .set({ storageUrl: factuur.storageUrl })
          .where(eq(bankTransacties.id, match.id));
      }

      gematcht++;
      resultaten.push({
        id: factuur.id,
        leverancier: factuur.leverancier,
        bedrag: factuur.bedrag,
        gematchtAan: match.id,
      });
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inkomendeFacturen)
      .where(eq(inkomendeFacturen.status, "onbekoppeld"));

    return NextResponse.json({
      succes: true,
      gecheckt: onbekoppeld.length,
      gematcht,
      nogOnbekoppeld: countRow?.count ?? 0,
      resultaten,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Rematch mislukt" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}
