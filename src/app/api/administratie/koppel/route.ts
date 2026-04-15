import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { findCandidates } from "@/lib/match-factuur";

// GET /api/administratie/koppel?factuurId=123 — return scored candidate
// bank-transactions for an unlinked invoice, for manual matching UI.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const factuurId = Number(searchParams.get("factuurId"));
    if (!Number.isFinite(factuurId)) {
      return NextResponse.json({ fout: "factuurId ontbreekt" }, { status: 400 });
    }

    const [factuur] = await db
      .select()
      .from(inkomendeFacturen)
      .where(eq(inkomendeFacturen.id, factuurId))
      .limit(1);

    if (!factuur) {
      return NextResponse.json({ fout: "Factuur niet gevonden" }, { status: 404 });
    }

    const candidates = await findCandidates({
      leverancier: factuur.leverancier,
      bedrag: factuur.bedrag,
      datum: factuur.datum,
    });

    return NextResponse.json({
      factuur: {
        id: factuur.id,
        leverancier: factuur.leverancier,
        bedrag: factuur.bedrag,
        btwBedrag: factuur.btwBedrag,
        datum: factuur.datum,
        factuurnummer: factuur.factuurnummer,
        storageUrl: factuur.storageUrl,
        status: factuur.status,
      },
      kandidaten: candidates.map((c) => ({
        id: c.tx.id,
        datum: c.tx.datum,
        merchantNaam: c.tx.merchantNaam,
        omschrijving: c.tx.omschrijving,
        bedrag: c.tx.bedrag,
        bank: c.tx.bank,
        categorie: c.tx.categorie,
        score: Math.round(c.score * 100),
        reasons: c.reasons,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/administratie/koppel — Manual match invoice to bank transaction.
// Body: { factuurId: number, transactieId: number }
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = (await request.json()) as { factuurId?: unknown; transactieId?: unknown };
    const { factuurId, transactieId } = body;

    if (typeof factuurId !== "number" || typeof transactieId !== "number") {
      return NextResponse.json(
        { fout: "factuurId en transactieId zijn verplicht en moeten nummers zijn" },
        { status: 400 }
      );
    }

    const [factuur] = await db
      .select()
      .from(inkomendeFacturen)
      .where(eq(inkomendeFacturen.id, factuurId))
      .limit(1);

    if (!factuur) {
      return NextResponse.json({ fout: "Factuur niet gevonden" }, { status: 404 });
    }

    const [transactie] = await db
      .select()
      .from(bankTransacties)
      .where(eq(bankTransacties.id, transactieId))
      .limit(1);

    if (!transactie) {
      return NextResponse.json({ fout: "Banktransactie niet gevonden" }, { status: 404 });
    }

    // If the bank transaction already has a different bon linked, refuse —
    // caller must ontkoppel that first or pick another transaction.
    if (transactie.storageUrl && transactie.storageUrl !== factuur.storageUrl) {
      return NextResponse.json(
        {
          fout: "Deze transactie heeft al een andere bon gekoppeld. Ontkoppel die eerst.",
        },
        { status: 409 }
      );
    }

    await db
      .update(inkomendeFacturen)
      .set({
        bankTransactieId: transactieId,
        status: "handmatig_gematcht",
      })
      .where(eq(inkomendeFacturen.id, factuurId));

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

// DELETE /api/administratie/koppel?factuurId=123 — ontkoppel een factuur
// van z'n bank-transactie. Zet factuur terug op onbekoppeld en verwijdert
// de storage_url referentie op de bank-transactie.
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const factuurId = Number(searchParams.get("factuurId"));
    if (!Number.isFinite(factuurId)) {
      return NextResponse.json({ fout: "factuurId ontbreekt" }, { status: 400 });
    }

    const [factuur] = await db
      .select()
      .from(inkomendeFacturen)
      .where(eq(inkomendeFacturen.id, factuurId))
      .limit(1);

    if (!factuur || !factuur.bankTransactieId) {
      return NextResponse.json({ fout: "Factuur is niet gekoppeld" }, { status: 400 });
    }

    await db
      .update(bankTransacties)
      .set({ storageUrl: null })
      .where(eq(bankTransacties.id, factuur.bankTransactieId));

    await db
      .update(inkomendeFacturen)
      .set({
        bankTransactieId: null,
        status: "onbekoppeld",
      })
      .where(eq(inkomendeFacturen.id, factuurId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
