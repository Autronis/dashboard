import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankTransacties, facturen, factuurRegels, inkomsten, uitgaven, tijdregistraties, gebruikers } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

// GET /api/belasting/export?type=btw&kwartaal=1&jaar=2026
// GET /api/belasting/export?type=csv&jaar=2026
// GET /api/belasting/export?type=winstverdeling&jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "csv";
    const jaar = parseInt(searchParams.get("jaar") ?? String(new Date().getFullYear()));
    const kwartaal = searchParams.get("kwartaal") ? parseInt(searchParams.get("kwartaal")!) : null;

    if (type === "csv") {
      // Export all transactions as CSV
      const transacties = await db.select().from(bankTransacties)
        .where(sql`${bankTransacties.datum} >= '${jaar}-01-01' AND ${bankTransacties.datum} <= '${jaar}-12-31'`)
        .orderBy(sql`${bankTransacties.datum} ASC`);

      const header = "Datum,Omschrijving,Bedrag,Type,Categorie,FiscaalType,BTW,Verlegging,Status\n";
      const rows = transacties.map(t =>
        `"${t.datum}","${(t.omschrijving || "").replace(/"/g, '""')}",${t.bedrag},"${t.type}","${t.categorie || ""}","${t.fiscaalType || ""}",${t.btwBedrag || 0},${t.isVerlegging ? "Ja" : "Nee"},"${t.status}"`
      ).join("\n");

      return new NextResponse(header + rows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="autronis-transacties-${jaar}.csv"`,
        },
      });
    }

    if (type === "btw") {
      // BTW overzicht per kwartaal
      const startMaand = kwartaal ? (kwartaal - 1) * 3 + 1 : 1;
      const eindMaand = kwartaal ? kwartaal * 3 : 12;
      const startDatum = `${jaar}-${String(startMaand).padStart(2, "0")}-01`;
      const eindDatum = `${jaar}-${String(eindMaand).padStart(2, "0")}-31`;

      // BTW op uitgaven (zakelijk)
      const [uitgavenBtw] = await db.select({
        totaal: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
      }).from(bankTransacties).where(
        and(
          eq(bankTransacties.type, "af"),
          sql`${bankTransacties.datum} >= ${startDatum} AND ${bankTransacties.datum} <= ${eindDatum}`,
          sql`${bankTransacties.fiscaalType} != 'prive' OR ${bankTransacties.fiscaalType} IS NULL`
        )
      );

      // Verleggingsregeling totaal
      const [verlegging] = await db.select({
        totaal: sql<number>`COALESCE(SUM(${bankTransacties.bedrag}), 0)`,
        btw: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
        aantal: sql<number>`COUNT(*)`,
      }).from(bankTransacties).where(
        and(
          eq(bankTransacties.isVerlegging, 1),
          sql`${bankTransacties.datum} >= ${startDatum} AND ${bankTransacties.datum} <= ${eindDatum}`
        )
      );

      // BTW op facturen (inkomsten)
      const facturenPeriode = await db.select({
        btwBedrag: facturen.btwBedrag,
      }).from(facturen).where(
        sql`${facturen.factuurdatum} >= ${startDatum} AND ${facturen.factuurdatum} <= ${eindDatum}`
      );
      const btwOntvangen = facturenPeriode.reduce((s, f) => s + (f.btwBedrag ?? 0), 0);

      const btwBetaald = uitgavenBtw?.totaal ?? 0;
      const btwSaldo = btwOntvangen - btwBetaald;

      const csv = [
        `BTW Overzicht ${kwartaal ? `Q${kwartaal}` : "Jaar"} ${jaar}`,
        "",
        "Omschrijving,Bedrag",
        `BTW ontvangen (facturen),€${btwOntvangen.toFixed(2)}`,
        `BTW betaald (zakelijke uitgaven),€${btwBetaald.toFixed(2)}`,
        `Verleggingsregeling (${verlegging?.aantal ?? 0} transacties),€${(verlegging?.btw ?? 0).toFixed(2)}`,
        "",
        `Te betalen / terug te ontvangen,€${btwSaldo.toFixed(2)}`,
        "",
        "NB: Verleggingsregeling is netto €0 maar moet in de aangifte opgenomen worden.",
        `Totaal verlegde BTW: €${(verlegging?.btw ?? 0).toFixed(2)} (aangeven + aftrekken)`,
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="autronis-btw-${kwartaal ? `Q${kwartaal}-` : ""}${jaar}.csv"`,
        },
      });
    }

    if (type === "winstverdeling") {
      // Per-vennoot uren en winstverdeling
      const users = await db.select({ id: gebruikers.id, naam: gebruikers.naam }).from(gebruikers);

      const rows = ["Vennoot,Totaal Uren,Percentage,Winstaandeel"];
      let totaalUren = 0;

      const urenPerUser: { naam: string; uren: number }[] = [];
      for (const user of users) {
        const [result] = await db.select({
          totaal: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)`,
        }).from(tijdregistraties).where(
          and(
            eq(tijdregistraties.gebruikerId, user.id),
            sql`${tijdregistraties.startTijd} >= '${jaar}-01-01' AND ${tijdregistraties.startTijd} <= '${jaar}-12-31'`
          )
        );
        const uren = Math.round((result?.totaal ?? 0) / 60);
        urenPerUser.push({ naam: user.naam, uren });
        totaalUren += uren;
      }

      for (const u of urenPerUser) {
        const pct = totaalUren > 0 ? Math.round((u.uren / totaalUren) * 100) : 0;
        rows.push(`"${u.naam}",${u.uren},${pct}%,${pct}%`);
      }

      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="autronis-winstverdeling-${jaar}.csv"`,
        },
      });
    }

    return NextResponse.json({ fout: "Onbekend export type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Export mislukt" },
      { status: 500 }
    );
  }
}
