import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties, revolutVerbinding, brandstofKosten } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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

        // Auto-detect fuel transactions (MCC 5541/5542 = gas stations)
        const mcc = tx.merchant?.category_code;
        if (inserted && isUitgaand && (mcc === "5541" || mcc === "5542")) {
          await db.insert(brandstofKosten).values({
            gebruikerId: 1, // Default to Sem; will be linked to Revolut account owner
            datum: (tx.completed_at || tx.created_at || payload.timestamp).split("T")[0],
            bedrag: Math.abs(leg.amount),
            bankTransactieId: inserted.id,
            notitie: `Auto: ${merchantNaam}`,
          });
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
