import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, uitgaven, projecten, klanten, abonnementen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";

interface ForecastEntry {
  datum: string;
  verwachtInkomsten: number;
  verwachtUitgaven: number;
  saldo: number;
}

// GET /api/financien/liquiditeit — 90-day liquidity forecast
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const huidigSaldo = parseFloat(searchParams.get("huidigSaldo") || "0");

    const vandaag = new Date();
    const over90Dagen = new Date(vandaag);
    over90Dagen.setDate(over90Dagen.getDate() + 90);
    const vandaagStr = vandaag.toISOString().slice(0, 10);
    const over90Str = over90Dagen.toISOString().slice(0, 10);

    // 1. Open invoices (expected income by due date)
    const openFacturen = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
        klantNaam: klanten.bedrijfsnaam,
        status: facturen.status,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.isActief, 1),
          inArray(facturen.status, ["verzonden", "te_laat"])
        )
      );

    // 2. Calculate average monthly expenses from last 3 months
    const drieMandenGeleden = new Date(vandaag);
    drieMandenGeleden.setMonth(drieMandenGeleden.getMonth() - 3);
    const drieMandenStr = drieMandenGeleden.toISOString().slice(0, 10);

    const [uitgavenGemiddeld] = await db
      .select({
        totaal: sql<number>`coalesce(sum(${uitgaven.bedrag}), 0)`,
        aantal: sql<number>`count(*)`,
      })
      .from(uitgaven)
      .where(
        and(
          gte(uitgaven.datum, drieMandenStr),
          lte(uitgaven.datum, vandaagStr)
        )
      );

    const maandelijkseUitgavenVariabel = (uitgavenGemiddeld?.totaal ?? 0) / 3;

    // 3b. Abonnementen vaste lasten (maandelijks equivalent)
    const abonnementenLijst = await db
      .select({ bedrag: abonnementen.bedrag, frequentie: abonnementen.frequentie })
      .from(abonnementen)
      .where(eq(abonnementen.isActief, 1));

    const maandelijkseAbonnementen = abonnementenLijst.reduce((sum, a) => {
      const maand = a.frequentie === "maandelijks" ? a.bedrag
        : a.frequentie === "per_kwartaal" ? a.bedrag / 3
        : a.bedrag / 12;
      return sum + maand;
    }, 0);

    const maandelijkseUitgaven = maandelijkseUitgavenVariabel + maandelijkseAbonnementen;
    const dagelijkseUitgaven = maandelijkseUitgaven / 30;

    // 3. Active projects expected revenue
    const actieveProjecten = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        uurtarief: klanten.uurtarief,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(projecten.isActief, 1),
          eq(projecten.status, "actief")
        )
      );

    const projectRevenue = actieveProjecten.reduce((sum, p) => {
      const resterendeUren = Math.max(0, (p.geschatteUren || 0) - (p.werkelijkeUren || 0));
      const tarief = p.uurtarief || 85;
      return sum + resterendeUren * tarief;
    }, 0);

    // 4. Build 90-day forecast (weekly buckets)
    const forecast: ForecastEntry[] = [];
    let lopendSaldo = huidigSaldo;

    for (let week = 0; week < 13; week++) {
      const weekStart = new Date(vandaag);
      weekStart.setDate(weekStart.getDate() + week * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      // Expected income this week from open invoices
      const weekInkomsten = openFacturen
        .filter((f) => {
          const vd = f.vervaldatum || vandaagStr;
          return vd >= weekStartStr && vd <= weekEndStr;
        })
        .reduce((sum, f) => sum + (f.bedragInclBtw || 0), 0);

      // Spread project revenue evenly across weeks
      const weekProjectInkomsten = projectRevenue / 13;

      const weekUitgaven = dagelijkseUitgaven * 7;

      const verwachtInkomsten = weekInkomsten + (week > 4 ? weekProjectInkomsten * 0.3 : 0);
      lopendSaldo = lopendSaldo + verwachtInkomsten - weekUitgaven;

      forecast.push({
        datum: weekStartStr,
        verwachtInkomsten: Math.round(verwachtInkomsten * 100) / 100,
        verwachtUitgaven: Math.round(weekUitgaven * 100) / 100,
        saldo: Math.round(lopendSaldo * 100) / 100,
      });
    }

    // Summary at 30/60/90 days
    const saldo30 = forecast[4]?.saldo ?? huidigSaldo;
    const saldo60 = forecast[8]?.saldo ?? huidigSaldo;
    const saldo90 = forecast[12]?.saldo ?? huidigSaldo;

    const totaalOpenstaand = openFacturen.reduce((sum, f) => sum + (f.bedragInclBtw || 0), 0);

    return NextResponse.json({
      huidigSaldo,
      forecast,
      saldo30,
      saldo60,
      saldo90,
      totaalOpenstaand,
      maandelijkseUitgaven: Math.round(maandelijkseUitgaven * 100) / 100,
      maandelijkseAbonnementen: Math.round(maandelijkseAbonnementen * 100) / 100,
      projectRevenue: Math.round(projectRevenue * 100) / 100,
      openFacturen: openFacturen.map((f) => ({
        factuurnummer: f.factuurnummer,
        klant: f.klantNaam,
        bedrag: f.bedragInclBtw,
        vervaldatum: f.vervaldatum,
        status: f.status,
      })),
      waarschuwing: saldo30 < 0 || saldo60 < 0 || saldo90 < 0,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
