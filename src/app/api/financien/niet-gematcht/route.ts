import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties, facturen, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, or, isNull, sql } from "drizzle-orm";

// GET /api/financien/niet-gematcht — Alle inkomende betalingen zonder factuurkoppeling
export async function GET() {
  try {
    await requireAuth();

    const transacties = await db
      .select({
        id: bankTransacties.id,
        datum: bankTransacties.datum,
        omschrijving: bankTransacties.omschrijving,
        bedrag: bankTransacties.bedrag,
        bank: bankTransacties.bank,
        revolutTransactieId: bankTransacties.revolutTransactieId,
        status: bankTransacties.status,
      })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.type, "bij"),
          isNull(bankTransacties.gekoppeldFactuurId),
          sql`${bankTransacties.status} != 'gematcht'`
        )
      )
      .orderBy(sql`${bankTransacties.datum} DESC`);

    // Also return open invoices for manual matching dropdown
    const openFacturen = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        bedragInclBtw: facturen.bedragInclBtw,
        bedragExclBtw: facturen.bedragExclBtw,
        klantNaam: klanten.bedrijfsnaam,
        factuurdatum: facturen.factuurdatum,
        vervaldatum: facturen.vervaldatum,
      })
      .from(facturen)
      .innerJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.isActief, 1),
          or(eq(facturen.status, "verzonden"), eq(facturen.status, "te_laat"))
        )
      )
      .orderBy(facturen.factuurdatum);

    return NextResponse.json({ transacties, openFacturen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/financien/niet-gematcht — Handmatig koppelen van transactie aan factuur
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const { transactieId, factuurId } = await req.json();

    if (!transactieId || !factuurId) {
      return NextResponse.json({ fout: "transactieId en factuurId zijn verplicht" }, { status: 400 });
    }

    // Verify transactie exists and is unmatched
    const [transactie] = await db
      .select({ id: bankTransacties.id, gekoppeldFactuurId: bankTransacties.gekoppeldFactuurId })
      .from(bankTransacties)
      .where(eq(bankTransacties.id, transactieId))
      .limit(1);

    if (!transactie) {
      return NextResponse.json({ fout: "Transactie niet gevonden" }, { status: 404 });
    }
    if (transactie.gekoppeldFactuurId) {
      return NextResponse.json({ fout: "Transactie is al gekoppeld aan een factuur" }, { status: 409 });
    }

    // Verify factuur exists and is open
    const [factuur] = await db
      .select({ id: facturen.id, status: facturen.status })
      .from(facturen)
      .where(eq(facturen.id, factuurId))
      .limit(1);

    if (!factuur) {
      return NextResponse.json({ fout: "Factuur niet gevonden" }, { status: 404 });
    }
    if (factuur.status === "betaald") {
      return NextResponse.json({ fout: "Factuur is al betaald" }, { status: 409 });
    }

    const vandaag = new Date().toISOString().slice(0, 10);

    // Update factuur → betaald
    await db.update(facturen)
      .set({
        status: "betaald",
        betaaldOp: vandaag,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(facturen.id, factuurId));

    // Update transactie → gematcht
    await db.update(bankTransacties)
      .set({
        gekoppeldFactuurId: factuurId,
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
