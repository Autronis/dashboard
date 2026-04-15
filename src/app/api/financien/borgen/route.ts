import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, eq, sql, desc } from "drizzle-orm";
import { BORG_CATEGORIE } from "@/lib/borg";
import { BORG_CONFIG } from "@/lib/borg-config";

// Borgen-overzicht: alle transacties met categorie='borg', gegroepeerd in
// "uitgegeven" (af) en "ontvangen" (bij). Plus de hardcoded BORG_CONFIG
// voor het Edisonstraat 60 kantoor — dat is jullie standaard borg-arrangement.
//
// Borgen zijn balans-posten:
//   uitgegeven (af) → vordering: jullie geld dat bij verhuurder ligt, krijg je terug
//   ontvangen (bij) → schuld: bedrag dat huurders bij jullie hebben gestald, moet terug
//
// Saldo = uitgegeven - ontvangen. Positief = jullie hebben netto geld
// uitstaan. Negatief = jullie houden netto geld vast.

interface BorgTransactie {
  id: number;
  datum: string;
  omschrijving: string;
  merchantNaam: string | null;
  bedrag: number;
  type: "bij" | "af";
  bank: string | null;
}

export async function GET() {
  try {
    await requireAuth();

    const transacties = await db
      .select({
        id: bankTransacties.id,
        datum: bankTransacties.datum,
        omschrijving: bankTransacties.omschrijving,
        merchantNaam: bankTransacties.merchantNaam,
        bedrag: bankTransacties.bedrag,
        type: bankTransacties.type,
        bank: bankTransacties.bank,
      })
      .from(bankTransacties)
      .where(eq(bankTransacties.categorie, BORG_CATEGORIE))
      .orderBy(desc(bankTransacties.datum));

    const uitgegeven: BorgTransactie[] = [];
    const ontvangen: BorgTransactie[] = [];
    for (const tx of transacties) {
      if (tx.type === "af") uitgegeven.push(tx);
      else ontvangen.push(tx);
    }

    const totaalUitgegeven = Math.round(
      uitgegeven.reduce((s, t) => s + Math.abs(t.bedrag), 0) * 100
    ) / 100;
    const totaalOntvangen = Math.round(
      ontvangen.reduce((s, t) => s + Math.abs(t.bedrag), 0) * 100
    ) / 100;
    const saldo = Math.round((totaalUitgegeven - totaalOntvangen) * 100) / 100;

    // Aantal in totaal voor snelle hint
    const [totaal] = await db
      .select({ aantal: sql<number>`COUNT(*)` })
      .from(bankTransacties)
      .where(and(eq(bankTransacties.categorie, BORG_CATEGORIE)));

    return NextResponse.json({
      saldo,
      totaalUitgegeven,
      totaalOntvangen,
      aantalTransacties: Number(totaal?.aantal ?? 0),
      uitgegeven,
      ontvangen,
      // Hardcoded arrangement (Edisonstraat 60 kantoor)
      arrangement: BORG_CONFIG,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
