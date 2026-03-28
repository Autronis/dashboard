import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties, revolutVerbinding, brandstofKosten, facturen, klanten } from "@/lib/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/revolut";

interface WebhookPayload {
  event: "TransactionCreated" | "TransactionStateChanged";
  timestamp: string;
  data: {
    id: string;
    type?: string;
    state?: string;
    old_state?: string;
    new_state?: string;
    created_at?: string;
    completed_at?: string;
    reference?: string;
    legs?: Array<{
      leg_id: string;
      account_id: string;
      amount: number;
      currency: string;
      description: string;
    }>;
    merchant?: {
      name: string;
      city?: string;
      category_code?: string;
      country?: string;
    };
  };
}

// Try to auto-match an incoming payment to an open invoice
async function autoMatchFactuur(transactieId: number, bedrag: number, omschrijving: string): Promise<boolean> {
  // Find open invoices (verzonden or te_laat) with matching amount (incl BTW)
  const openFacturen = await db
    .select({
      id: facturen.id,
      bedragInclBtw: facturen.bedragInclBtw,
      bedragExclBtw: facturen.bedragExclBtw,
      factuurdatum: facturen.factuurdatum,
      klantNaam: klanten.bedrijfsnaam,
    })
    .from(facturen)
    .innerJoin(klanten, eq(facturen.klantId, klanten.id))
    .where(
      and(
        eq(facturen.isActief, 1),
        or(eq(facturen.status, "verzonden"), eq(facturen.status, "te_laat"))
      )
    )
    .orderBy(facturen.factuurdatum); // FIFO: oudste eerst

  if (openFacturen.length === 0) return false;

  const omschrijvingLower = omschrijving.toLowerCase();

  // Score each invoice: exact bedrag match + bedrijfsnaam in omschrijving
  const matches = openFacturen
    .map((f) => {
      let score = 0;

      // Check bedrag match (incl BTW first, then excl BTW, with small tolerance for rounding)
      const bedragIncl = f.bedragInclBtw ?? 0;
      const bedragExcl = f.bedragExclBtw ?? 0;
      if (Math.abs(bedragIncl - bedrag) < 0.02) score += 10;
      else if (Math.abs(bedragExcl - bedrag) < 0.02) score += 8;
      else return null; // No bedrag match at all → skip

      // Check bedrijfsnaam in omschrijving
      const klantNaamLower = (f.klantNaam || "").toLowerCase();
      if (klantNaamLower.length > 2 && omschrijvingLower.includes(klantNaamLower)) {
        score += 5;
      }

      return { factuurId: f.id, score };
    })
    .filter((m): m is { factuurId: number; score: number } => m !== null)
    .sort((a, b) => b.score - a.score); // Highest score first

  if (matches.length === 0) return false;

  // Take the best match (highest score, FIFO for same score since we sorted by factuurdatum)
  const bestMatch = matches[0];
  const vandaag = new Date().toISOString().slice(0, 10);

  // Update factuur: betaald
  await db.update(facturen)
    .set({
      status: "betaald",
      betaaldOp: vandaag,
      bijgewerktOp: new Date().toISOString(),
    })
    .where(eq(facturen.id, bestMatch.factuurId));

  // Update bank transactie: gematcht + koppeling
  await db.update(bankTransacties)
    .set({
      gekoppeldFactuurId: bestMatch.factuurId,
      status: "gematcht",
    })
    .where(eq(bankTransacties.id, transactieId));

  return true;
}

// POST /api/revolut/webhook — Receive real-time transaction notifications
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const timestamp = req.headers.get("Revolut-Request-Timestamp") || "";
    const signature = req.headers.get("Revolut-Signature") || "";

    // Get webhook secret
    const [verbinding] = await db
      .select({ webhookSecret: revolutVerbinding.webhookSecret })
      .from(revolutVerbinding)
      .where(eq(revolutVerbinding.isActief, 1))
      .orderBy(desc(revolutVerbinding.aangemaaktOp))
      .limit(1);

    if (verbinding?.webhookSecret && signature) {
      const valid = verifyWebhookSignature(body, timestamp, signature, verbinding.webhookSecret);
      if (!valid) {
        return NextResponse.json({ fout: "Ongeldige signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(body) as WebhookPayload;

    if (payload.event === "TransactionCreated" && payload.data.legs) {
      const tx = payload.data;

      for (const leg of tx.legs!) {
        // Skip if already exists
        const [bestaand] = await db
          .select({ id: bankTransacties.id })
          .from(bankTransacties)
          .where(eq(bankTransacties.revolutTransactieId, tx.id))
          .limit(1);

        if (bestaand) continue;

        const isUitgaand = leg.amount < 0;
        const merchantNaam = tx.merchant?.name || leg.description || tx.reference || "Onbekend";

        const [inserted] = await db.insert(bankTransacties).values({
          datum: (tx.completed_at || tx.created_at || payload.timestamp).split("T")[0],
          omschrijving: leg.description || tx.reference || merchantNaam,
          bedrag: Math.abs(leg.amount),
          type: isUitgaand ? "af" : "bij",
          bank: "revolut",
          revolutTransactieId: tx.id,
          merchantNaam: isUitgaand ? merchantNaam : null,
          merchantCategorie: tx.merchant?.category_code || null,
          status: "onbekend",
        }).returning();

        if (!inserted) continue;

        if (isUitgaand) {
          // Auto-detect fuel transactions (MCC 5541/5542 = gas stations)
          const mcc = tx.merchant?.category_code;
          if (mcc === "5541" || mcc === "5542") {
            await db.insert(brandstofKosten).values({
              gebruikerId: 1,
              datum: (tx.completed_at || tx.created_at || payload.timestamp).split("T")[0],
              bedrag: Math.abs(leg.amount),
              bankTransactieId: inserted.id,
              notitie: `Auto: ${merchantNaam}`,
            });
          }
        } else {
          // Inkomende betaling → probeer automatisch te matchen aan factuur
          await autoMatchFactuur(
            inserted.id,
            Math.abs(leg.amount),
            leg.description || tx.reference || ""
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Webhook verwerking mislukt" },
      { status: 500 }
    );
  }
}
