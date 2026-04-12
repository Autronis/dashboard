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

    // 1 + 2. Inkomsten/uitgaven huidige en vorige maand via SQL aggregatie
    const huidig = await maandTotalen(maandStart, volgendeMaand);
    const vorig = await maandTotalen(vorigeMaand, maandStart);

    const inkomstenMaand = huidig.inkomsten;
    const uitgavenMaand = huidig.uitgaven;

    const inkomstenDelta = vorig.inkomsten > 0
      ? Math.round(((huidig.inkomsten - vorig.inkomsten) / vorig.inkomsten) * 100)
      : null;
    const uitgavenDelta = vorig.uitgaven > 0
      ? Math.round(((huidig.uitgaven - vorig.uitgaven) / vorig.uitgaven) * 100)
      : null;

    // 3. Netto (huidig en vorig)
    const huidigNetto = inkomstenMaand - uitgavenMaand;
    const vorigNetto = vorig.inkomsten - vorig.uitgaven;
    const nettoDelta = vorigNetto !== 0
      ? Math.round(((huidigNetto - vorigNetto) / Math.abs(vorigNetto)) * 100)
      : null;

    // 4. BTW terug te vragen (huidig kwartaal, alleen uitgaande btw)
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

    // 5. BTW af te dragen (huidig kwartaal, alleen inkomende btw)
    const btwAfRows = await db
      .select({ btw: bankTransacties.btwBedrag })
      .from(bankTransacties)
      .where(
        and(
          eq(bankTransacties.type, "bij"),
          gte(bankTransacties.datum, kwartaalStart),
          lt(bankTransacties.datum, kwartaalEind)
        )
      )
      .all();
    const btwAfTeDragen = btwAfRows.reduce((sum, r) => sum + (r.btw ?? 0), 0);

    // 6. Sparklines: 30-daagse dagelijkse totalen voor inkomsten en uitgaven
    const dertigDagenTerug = new Date(nu);
    dertigDagenTerug.setDate(dertigDagenTerug.getDate() - 30);
    const sparklineStart = dertigDagenTerug.toISOString().slice(0, 10);
    const sparklineEind = nu.toISOString().slice(0, 10);

    const dagMap = new Map<string, { bij: number; af: number }>();
    for (let i = 0; i <= 30; i++) {
      const d = new Date(dertigDagenTerug);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dagMap.set(key, { bij: 0, af: 0 });
    }

    const sparkRows = await db
      .select({
        datum: bankTransacties.datum,
        type: bankTransacties.type,
        bedrag: bankTransacties.bedrag,
      })
      .from(bankTransacties)
      .where(and(gte(bankTransacties.datum, sparklineStart), lt(bankTransacties.datum, sparklineEind)))
      .all();

    for (const row of sparkRows) {
      const key = row.datum.slice(0, 10);
      if (!dagMap.has(key)) continue;
      const entry = dagMap.get(key)!;
      if (row.type === "bij") entry.bij += Math.abs(row.bedrag ?? 0);
      else if (row.type === "af") entry.af += Math.abs(row.bedrag ?? 0);
    }

    const sortedKeys = Array.from(dagMap.keys()).sort();
    const inkomstenSparkline = sortedKeys.map((k) => dagMap.get(k)!.bij);
    const uitgavenSparkline = sortedKeys.map((k) => dagMap.get(k)!.af);

    // 7. BTW status: count items met status='onbekend' in huidig kwartaal
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
    const huidigKwartaalLabel = `Q${kwartaal + 1} ${jaar}`;

    return NextResponse.json({
      inkomstenMaand,
      uitgavenMaand,
      inkomstenDelta,
      uitgavenDelta,
      netto: Math.round(huidigNetto * 100) / 100,
      nettoDelta,
      btwTerugTeVragen: Math.round(btwTerugTeVragen * 100) / 100,
      btwAfTeDragen: Math.round(btwAfTeDragen * 100) / 100,
      btwTeVerwerken,
      huidigKwartaal: huidigKwartaalLabel,
      inkomstenSparkline,
      uitgavenSparkline,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
