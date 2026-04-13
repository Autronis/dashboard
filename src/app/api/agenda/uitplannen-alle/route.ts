import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { and, eq, isNotNull, ne, or, isNull, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/agenda/uitplannen-alle
 * Cleart ingeplandStart + ingeplandEind voor alle taken van de huidige
 * gebruiker (en taken zonder toegewezen_aan) die nog niet afgerond zijn.
 * Afgeronde taken blijven met rust voor historische weergave.
 */
export async function POST() {
  try {
    const gebruiker = await requireAuth();

    // Tel eerst zodat we kunnen rapporteren wat we doen.
    const countRes = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(taken)
      .where(
        and(
          isNotNull(taken.ingeplandStart),
          ne(taken.ingeplandStart, ""),
          or(eq(taken.toegewezenAan, gebruiker.id), isNull(taken.toegewezenAan)),
          ne(taken.status, "afgerond")
        )
      )
      .get();

    const aantal = countRes?.n ?? 0;

    if (aantal === 0) {
      return NextResponse.json({ uitgepland: 0 });
    }

    await db
      .update(taken)
      .set({ ingeplandStart: null, ingeplandEind: null })
      .where(
        and(
          isNotNull(taken.ingeplandStart),
          ne(taken.ingeplandStart, ""),
          or(eq(taken.toegewezenAan, gebruiker.id), isNull(taken.toegewezenAan)),
          ne(taken.status, "afgerond")
        )
      );

    return NextResponse.json({ uitgepland: aantal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
