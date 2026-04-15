import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties, facturen, inkomendeFacturen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, gte, lt, sql, or, isNull, ne, isNotNull, eq, exists } from "drizzle-orm";
import { VERMOGEN_CATEGORIE } from "@/lib/vermogensstorting";

// Helper for one-quarter aggregation. Vermogensstortingen (owner equity
// deposits) worden uitgesloten van omzet én BTW — zijn geen omzet.
// Daarnaast: bank-transacties die gekoppeld zijn aan een outgoing factuur
// of inkomende factuur waarvan verwerkt_in_aangifte gevuld is, blijven
// zichtbaar maar tellen niet meer mee in de huidige BTW-aangifte (anders
// double-counten ze met een eerdere periode die al ingediend is).
async function kwartaalTotalen(start: string, eind: string) {
  const nietVermogen = or(
    isNull(bankTransacties.categorie),
    ne(bankTransacties.categorie, VERMOGEN_CATEGORIE)
  );

  const nietVerwerkt = and(
    sql`NOT EXISTS (SELECT 1 FROM ${facturen} WHERE ${facturen.bankTransactieId} = ${bankTransacties.id} AND ${facturen.verwerktInAangifte} IS NOT NULL)`,
    sql`NOT EXISTS (SELECT 1 FROM ${inkomendeFacturen} WHERE ${inkomendeFacturen.bankTransactieId} = ${bankTransacties.id} AND ${inkomendeFacturen.verwerktInAangifte} IS NOT NULL)`
  );

  const [row] = await db
    .select({
      inkomsten: sql<number>`COALESCE(SUM(CASE WHEN ${bankTransacties.type} = 'bij' THEN ABS(${bankTransacties.bedrag}) ELSE 0 END), 0)`,
      uitgaven: sql<number>`COALESCE(SUM(CASE WHEN ${bankTransacties.type} = 'af' THEN ABS(${bankTransacties.bedrag}) ELSE 0 END), 0)`,
      btwAfgedragen: sql<number>`COALESCE(SUM(CASE WHEN ${bankTransacties.type} = 'bij' THEN ${bankTransacties.btwBedrag} ELSE 0 END), 0)`,
      btwTerug: sql<number>`COALESCE(SUM(CASE WHEN ${bankTransacties.type} = 'af' THEN ${bankTransacties.btwBedrag} ELSE 0 END), 0)`,
      itemsTeVerwerken: sql<number>`COALESCE(SUM(CASE WHEN ${bankTransacties.status} = 'onbekend' THEN 1 ELSE 0 END), 0)`,
      totaalItems: sql<number>`COUNT(*)`,
    })
    .from(bankTransacties)
    .where(
      and(
        gte(bankTransacties.datum, start),
        lt(bankTransacties.datum, eind),
        nietVermogen,
        nietVerwerkt
      )
    );

  return {
    inkomsten: Number(row?.inkomsten ?? 0),
    uitgaven: Number(row?.uitgaven ?? 0),
    btwAfgedragen: Number(row?.btwAfgedragen ?? 0),
    btwTerug: Number(row?.btwTerug ?? 0),
    itemsTeVerwerken: Number(row?.itemsTeVerwerken ?? 0),
    totaalItems: Number(row?.totaalItems ?? 0),
  };
}

// GET /api/financien/btw-kwartaal?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaar = parseInt(searchParams.get("jaar") ?? `${new Date().getFullYear()}`, 10);

    const nu = new Date();
    const huidigJaar = nu.getFullYear();
    const huidigKwartaal = Math.floor(nu.getMonth() / 3) + 1;

    const kwartalen = [];
    for (let q = 1; q <= 4; q++) {
      const startMaand = (q - 1) * 3 + 1;
      const start = `${jaar}-${String(startMaand).padStart(2, "0")}-01`;
      const eindMaand = startMaand + 3;
      const eind = eindMaand > 12
        ? `${jaar + 1}-01-01`
        : `${jaar}-${String(eindMaand).padStart(2, "0")}-01`;

      const totalen = await kwartaalTotalen(start, eind);
      const teBetalen = totalen.btwAfgedragen - totalen.btwTerug;

      // Status bepaling
      let status: "leeg" | "huidig" | "klaar" | "aangedaan";
      if (jaar > huidigJaar || (jaar === huidigJaar && q > huidigKwartaal)) {
        status = "leeg";
      } else if (jaar === huidigJaar && q === huidigKwartaal) {
        status = "huidig";
      } else if (totalen.itemsTeVerwerken === 0 && totalen.totaalItems > 0) {
        status = "klaar";
      } else {
        status = "huidig";
      }

      // Eind-datum van het kwartaal zelf (inclusief) is de dag vóór de
      // start van het volgende kwartaal — de `eind` variabele hierboven is
      // exclusief voor de SQL query.
      const eindDatum = new Date(eind);
      eindDatum.setDate(eindDatum.getDate() - 1);
      const eindDatumStr = eindDatum.toISOString().slice(0, 10);

      kwartalen.push({
        kwartaal: q,
        label: `Q${q} ${jaar}`,
        startDatum: start,
        eindDatum: eindDatumStr,
        status,
        inkomsten: Math.round(totalen.inkomsten * 100) / 100,
        uitgaven: Math.round(totalen.uitgaven * 100) / 100,
        btwAfgedragen: Math.round(totalen.btwAfgedragen * 100) / 100,
        btwTerug: Math.round(totalen.btwTerug * 100) / 100,
        teBetalen: Math.round(teBetalen * 100) / 100,
        itemsTeVerwerken: totalen.itemsTeVerwerken,
        totaalItems: totalen.totaalItems,
      });
    }

    return NextResponse.json({ jaar, kwartalen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
