import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lt, sql } from "drizzle-orm";

// Helper for aggregating one month in a single query
async function maandTotalen(start: string, eind: string) {
  const [row] = await db
    .select({
      inkomsten: sql<number>`COALESCE(SUM(CASE WHEN ${bankTransacties.type} = 'bij' THEN ABS(${bankTransacties.bedrag}) ELSE 0 END), 0)`,
      uitgaven: sql<number>`COALESCE(SUM(CASE WHEN ${bankTransacties.type} = 'af' THEN ABS(${bankTransacties.bedrag}) ELSE 0 END), 0)`,
    })
    .from(bankTransacties)
    .where(and(gte(bankTransacties.datum, start), lt(bankTransacties.datum, eind)));
  return {
    inkomsten: Number(row?.inkomsten ?? 0),
    uitgaven: Number(row?.uitgaven ?? 0),
  };
}

// GET /api/financien/dashboard — KPIs voor de financien pagina header
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const jaar = nu.getFullYear();
    const maand = nu.getMonth(); // 0-11
    const kwartaal = Math.floor(maand / 3); // 0-3

    // Tijdsranges (NL local, ISO strings voor SQLite)
    const maandStart = `${jaar}-${String(maand + 1).padStart(2, "0")}-01`;
    const volgendeMaand = maand === 11
      ? `${jaar + 1}-01-01`
      : `${jaar}-${String(maand + 2).padStart(2, "0")}-01`;
    const vorigeMaand = maand === 0
      ? `${jaar - 1}-12-01`
      : `${jaar}-${String(maand).padStart(2, "0")}-01`;

    const kwartaalStartMaand = kwartaal * 3 + 1;
    const kwartaalStart = `${jaar}-${String(kwartaalStartMaand).padStart(2, "0")}-01`;
    const volgendKwartaalMaand = kwartaalStartMaand + 3;
    const kwartaalEind = volgendKwartaalMaand > 12
      ? `${jaar + 1}-01-01`
      : `${jaar}-${String(volgendKwartaalMaand).padStart(2, "0")}-01`;

    // 1. Inkomsten/uitgaven huidige maand
    const huidigeMaandRows = await db
      .select({
        type: bankTransacties.type,
        bedrag: bankTransacties.bedrag,
      })
      .from(bankTransacties)
      .where(
        and(
          gte(bankTransacties.datum, maandStart),
          lt(bankTransacties.datum, volgendeMaand)
        )
      )
      .all();

    const inkomstenMaand = huidigeMaandRows
      .filter((r) => r.type === "bij")
      .reduce((sum, r) => sum + Math.abs(r.bedrag ?? 0), 0);
    const uitgavenMaand = huidigeMaandRows
      .filter((r) => r.type === "af")
      .reduce((sum, r) => sum + Math.abs(r.bedrag ?? 0), 0);

    // 2. Inkomsten/uitgaven vorige maand voor delta
    const vorigeMaandRows = await db
      .select({
        type: bankTransacties.type,
        bedrag: bankTransacties.bedrag,
      })
      .from(bankTransacties)
      .where(
        and(
          gte(bankTransacties.datum, vorigeMaand),
          lt(bankTransacties.datum, maandStart)
        )
      )
      .all();

    const inkomstenVorig = vorigeMaandRows
      .filter((r) => r.type === "bij")
      .reduce((sum, r) => sum + Math.abs(r.bedrag ?? 0), 0);
    const uitgavenVorig = vorigeMaandRows
      .filter((r) => r.type === "af")
      .reduce((sum, r) => sum + Math.abs(r.bedrag ?? 0), 0);

    const inkomstenDelta = inkomstenVorig > 0
      ? Math.round(((inkomstenMaand - inkomstenVorig) / inkomstenVorig) * 100)
      : null;
    const uitgavenDelta = uitgavenVorig > 0
      ? Math.round(((uitgavenMaand - uitgavenVorig) / uitgavenVorig) * 100)
      : null;

    // 3. BTW terug te vragen (huidig kwartaal, alleen uitgaande btw)
    const btwRows = await db
      .select({ btw: bankTransacties.btwBedrag })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.type, "af"),
          gte(bankTransacties.datum, kwartaalStart),
          lt(bankTransacties.datum, kwartaalEind)
        )
      )
      .all();
    const btwTerugTeVragen = btwRows.reduce((sum, r) => sum + (r.btw ?? 0), 0);

    // 4. BTW status: count items met status='onbekend' in huidig kwartaal
    const onbekendRows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.status, "onbekend"),
          gte(bankTransacties.datum, kwartaalStart),
          lt(bankTransacties.datum, kwartaalEind)
        )
      )
      .all();
    const btwTeVerwerken = Number(onbekendRows[0]?.count ?? 0);
    const huidigKwartaalLabel = `Q${kwartaal + 1}`;

    return NextResponse.json({
      inkomstenMaand,
      uitgavenMaand,
      inkomstenDelta,
      uitgavenDelta,
      btwTerugTeVragen: Math.round(btwTerugTeVragen * 100) / 100,
      btwTeVerwerken,
      huidigKwartaal: huidigKwartaalLabel,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
