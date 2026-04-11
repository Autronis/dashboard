import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/administratie/koppel — Manual match invoice to bank transaction
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json() as { factuurId?: unknown; transactieId?: unknown };
    const { factuurId, transactieId } = body;

    if (typeof factuurId !== "number" || typeof transactieId !== "number") {
      return NextResponse.json(
        { fout: "factuurId en transactieId zijn verplicht en moeten nummers zijn" },
        { status: 400 }
      );
    }

    // Verify factuur exists
    const [factuur] = await db
      .select()
      .from(inkomendeFacturen)
      .where(eq(inkomendeFacturen.id, factuurId))
      .limit(1);

    if (!factuur) {
      return NextResponse.json(
        { fout: "Factuur niet gevonden" },
        { status: 404 }
      );
    }

    // Verify bank transaction exists
    const [transactie] = await db
      .select()
      .from(bankTransacties)
      .where(eq(bankTransacties.id, transactieId))
      .limit(1);

    if (!transactie) {
      return NextResponse.json(
        { fout: "Banktransactie niet gevonden" },
        { status: 404 }
      );
    }

    // Update inkomendeFacturen: link to transaction and mark as manually matched
    await db
      .update(inkomendeFacturen)
      .set({
        bankTransactieId: transactieId,
        status: "handmatig_gematcht",
      })
      .where(eq(inkomendeFacturen.id, factuurId));

    // Update bankTransacties: set storageUrl and mark as matched
    await db
      .update(bankTransacties)
      .set({
        storageUrl: factuur.storageUrl,
        status: "gematcht",
      })
      .where(eq(bankTransacties.id, transactieId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
