import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTransactions, getVerbindingStatus } from "@/lib/revolut";
import { db } from "@/lib/db";
import { bankTransacties, abonnementen, revolutVerbinding } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface SyncResultaat {
  nieuweTransacties: number;
  gedetecteerdeAbonnementen: string[];
  geanalyseerd: number;
}

// Detect subscriptions: find recurring payments to the same merchant/description
async function detecteerAbonnementen(): Promise<string[]> {
  // Find merchants with 2+ transactions in the last 90 days with similar amounts
  const terugkerend = await db
    .select({
      merchantNaam: bankTransacties.merchantNaam,
      aantal: sql<number>`COUNT(*)`,
      gemiddeldBedrag: sql<number>`AVG(ABS(${bankTransacties.bedrag}))`,
      laatsteDatum: sql<string>`MAX(${bankTransacties.datum})`,
    })
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        sql`${bankTransacties.merchantNaam} IS NOT NULL`,
        sql`${bankTransacties.datum} >= date('now', '-90 days')`
      )
    )
    .groupBy(bankTransacties.merchantNaam)
    .having(sql`COUNT(*) >= 2`);

  const nieuw: string[] = [];

  for (const t of terugkerend) {
    if (!t.merchantNaam) continue;

    // Check if abonnement already exists
    const [bestaand] = await db
      .select({ id: abonnementen.id })
      .from(abonnementen)
      .where(
        and(
          eq(abonnementen.isActief, 1),
          sql`LOWER(${abonnementen.naam}) = LOWER(${t.merchantNaam}) OR LOWER(${abonnementen.leverancier}) = LOWER(${t.merchantNaam})`
        )
      )
      .limit(1);

    if (bestaand) continue;

    // Determine frequency based on average days between transactions
    const transacties = await db
      .select({ datum: bankTransacties.datum })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.type, "af"),
          eq(bankTransacties.merchantNaam, t.merchantNaam),
          sql`${bankTransacties.datum} >= date('now', '-90 days')`
        )
      )
      .orderBy(bankTransacties.datum);

    let frequentie: "maandelijks" | "jaarlijks" | "per_kwartaal" = "maandelijks";
    if (transacties.length >= 2) {
      const eerste = new Date(transacties[0].datum);
      const laatste = new Date(transacties[transacties.length - 1].datum);
      const dagenTussen = (laatste.getTime() - eerste.getTime()) / (1000 * 60 * 60 * 24) / (transacties.length - 1);

      if (dagenTussen > 80) frequentie = "per_kwartaal";
      else if (dagenTussen > 300) frequentie = "jaarlijks";
    }

    // Auto-create the subscription
    await db.insert(abonnementen).values({
      naam: t.merchantNaam,
      leverancier: t.merchantNaam,
      bedrag: Math.round(t.gemiddeldBedrag * 100) / 100,
      frequentie,
      categorie: "overig",
      startDatum: transacties[0]?.datum || t.laatsteDatum,
      notities: "Automatisch gedetecteerd via Revolut",
      isActief: 1,
    });

    nieuw.push(t.merchantNaam);
  }

  return nieuw;
}

// AI analyse: beschrijving, abonnement detectie, overbodigheid score
async function analyseerTransacties(transactieIds: number[]): Promise<number> {
  if (transactieIds.length === 0) return 0;

  let geanalyseerd = 0;

  for (const id of transactieIds) {
    const [tx] = await db.select().from(bankTransacties).where(eq(bankTransacties.id, id));
    if (!tx || tx.type !== "af") continue;

    // Count frequency of this merchant
    const merchantKey = tx.merchantNaam || tx.omschrijving;
    const [freq] = await db
      .select({
        aantal: sql<number>`COUNT(*)`,
        gemiddeld: sql<number>`AVG(ABS(${bankTransacties.bedrag}))`,
      })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.type, "af"),
          sql`(${bankTransacties.merchantNaam} = ${merchantKey} OR ${bankTransacties.omschrijving} = ${merchantKey})`,
          sql`${bankTransacties.datum} >= date('now', '-90 days')`
        )
      );

    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Analyseer deze banktransactie voor een klein AI-bureau (Autronis):
- Merchant: ${merchantKey}
- Categorie: ${tx.merchantCategorie || "onbekend"}
- Bedrag: €${tx.bedrag.toFixed(2)}
- Datum: ${tx.datum}
- Frequentie: ${freq?.aantal ?? 1}x in 90 dagen, gemiddeld €${(freq?.gemiddeld ?? tx.bedrag).toFixed(2)}

Geef: 1) Korte NL beschrijving (max 1 zin), 2) Is dit een abonnement? 3) Score: noodzakelijk/nuttig/overbodig voor een AI-bureau.
Antwoord ALLEEN als JSON: {"beschrijving":"...","isAbonnement":true/false,"score":"noodzakelijk"|"nuttig"|"overbodig"}`,
        }],
      });

      const raw = message.content[0].type === "text" ? message.content[0].text : "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]) as {
          beschrijving: string;
          isAbonnement: boolean;
          score: "noodzakelijk" | "nuttig" | "overbodig";
        };

        await db
          .update(bankTransacties)
          .set({
            aiBeschrijving: result.beschrijving,
            isAbonnement: result.isAbonnement ? 1 : 0,
            overdodigheidScore: result.score,
          })
          .where(eq(bankTransacties.id, id));

        geanalyseerd++;
      }
    } catch {
      // Skip failed, continue
    }
  }

  return geanalyseerd;
}

// POST /api/revolut/sync — Sync transactions from Revolut
export async function POST() {
  try {
    await requireAuth();

    const status = await getVerbindingStatus();
    if (!status.gekoppeld) {
      return NextResponse.json({ fout: "Revolut niet gekoppeld" }, { status: 400 });
    }

    // Fetch last 30 days of transactions (or since last sync)
    const from = status.laatsteSyncOp
      ? new Date(status.laatsteSyncOp).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const transacties = await getTransactions({
      from,
      count: 1000,
    });

    let nieuweTransacties = 0;
    const nieuweIds: number[] = [];

    for (const tx of transacties) {
      if (tx.state !== "completed") continue;

      for (const leg of tx.legs) {
        // Skip if already synced
        const [bestaand] = await db
          .select({ id: bankTransacties.id })
          .from(bankTransacties)
          .where(eq(bankTransacties.revolutTransactieId, tx.id))
          .limit(1);

        if (bestaand) continue;

        const isUitgaand = leg.amount < 0;
        const merchantNaam = tx.merchant?.name || leg.description || tx.reference || "Onbekend";

        const [inserted] = await db.insert(bankTransacties).values({
          datum: (tx.completed_at || tx.created_at).split("T")[0],
          omschrijving: leg.description || tx.reference || merchantNaam,
          bedrag: Math.abs(leg.amount),
          type: isUitgaand ? "af" : "bij",
          bank: "revolut",
          revolutTransactieId: tx.id,
          merchantNaam: isUitgaand ? merchantNaam : null,
          merchantCategorie: tx.merchant?.category_code || null,
          status: "onbekend",
        }).returning({ id: bankTransacties.id });

        nieuweTransacties++;
        if (inserted && isUitgaand) nieuweIds.push(inserted.id);
      }
    }

    // Update last sync timestamp
    await db
      .update(revolutVerbinding)
      .set({
        laatsteSyncOp: new Date().toISOString(),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(revolutVerbinding.isActief, 1));

    // Detect new subscriptions
    const gedetecteerdeAbonnementen = await detecteerAbonnementen();

    // AI analyse of new transactions (max 20 per sync to keep fast)
    const geanalyseerd = await analyseerTransacties(nieuweIds.slice(0, 20));

    const resultaat: SyncResultaat = {
      nieuweTransacties,
      gedetecteerdeAbonnementen,
      geanalyseerd,
    };

    return NextResponse.json(resultaat);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Sync mislukt" },
      { status: 500 }
    );
  }
}
