import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and, isNull } from "drizzle-orm";
import { findBestMatch } from "@/lib/match-factuur";

// POST /api/administratie/rematch — probeer alle onbekoppelde inkomende
// facturen opnieuw te koppelen met de scoring matcher (leverancier + bedrag
// + datum gecombineerd). Idempotent: al-gematchte rows worden niet aangeraakt.
// Accepteert zowel een ingelogde sessie als een Bearer SESSION_SECRET header
// zodat CLI-calls werken (zelfde pattern als gmail-sync).
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const sessionSecret = process.env.SESSION_SECRET;
    const hasBearerAuth =
      sessionSecret && authHeader === `Bearer ${sessionSecret}`;
    if (!hasBearerAuth) {
      await requireAuth();
    }

    // Skip facturen die al in een eerdere aangifte zijn verwerkt — die
    // hoeven niet meer aan een bank-transactie gekoppeld te worden.
    const onbekoppeld = await db
      .select()
      .from(inkomendeFacturen)
      .where(
        and(
          eq(inkomendeFacturen.status, "onbekoppeld"),
          isNull(inkomendeFacturen.verwerktInAangifte)
        )
      );

    let gematcht = 0;
    const resultaten: Array<{
      id: number;
      leverancier: string;
      bedrag: number;
      gematchtAan?: number;
      merchant?: string;
      score?: number;
      reasons?: string[];
    }> = [];

    for (const factuur of onbekoppeld) {
      const match = await findBestMatch({
        leverancier: factuur.leverancier,
        bedrag: factuur.bedrag,
        datum: factuur.datum,
      });

      if (!match) {
        resultaten.push({ id: factuur.id, leverancier: factuur.leverancier, bedrag: factuur.bedrag });
        continue;
      }

      await db
        .update(inkomendeFacturen)
        .set({
          bankTransactieId: match.tx.id,
          status: "gematcht",
        })
        .where(eq(inkomendeFacturen.id, factuur.id));

      if (factuur.storageUrl) {
        await db
          .update(bankTransacties)
          .set({ storageUrl: factuur.storageUrl })
          .where(eq(bankTransacties.id, match.tx.id));
      }

      gematcht++;
      resultaten.push({
        id: factuur.id,
        leverancier: factuur.leverancier,
        bedrag: factuur.bedrag,
        gematchtAan: match.tx.id,
        merchant: match.tx.merchantNaam ?? match.tx.omschrijving,
        score: Math.round(match.score * 100),
        reasons: match.reasons,
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
