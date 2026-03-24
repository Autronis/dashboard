import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, factuurRegels } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, like, desc } from "drizzle-orm";

// GET /api/facturen/periodiek — preview: hoeveel periodieke facturen staan klaar
export async function GET() {
  try {
    await requireAuth();
    const terugkerend = await db
      .select({ id: facturen.id, factuurnummer: facturen.factuurnummer, betaaldOp: facturen.betaaldOp, terugkeerInterval: facturen.terugkeerInterval, klantId: facturen.klantId })
      .from(facturen)
      .where(and(eq(facturen.isTerugkerend, 1), eq(facturen.status, "betaald"), eq(facturen.isActief, 1)))
      .all();

    const klaar = terugkerend.filter((f) => {
      if (!f.betaaldOp) return false;
      const interval = f.terugkeerInterval === "wekelijks" ? 7 : 30;
      const daysSince = Math.floor((Date.now() - new Date(f.betaaldOp).getTime()) / 86400000);
      return daysSince >= interval;
    });

    return NextResponse.json({ aantal: klaar.length, facturen: klaar.map((f) => ({ factuurnummer: f.factuurnummer })) });
  } catch {
    return NextResponse.json({ fout: "Preview mislukt" }, { status: 500 });
  }
}

// POST /api/facturen/periodiek — genereer nieuwe facturen voor terugkerende betaalde facturen
export async function POST() {
  try {
    const gebruiker = await requireAuth();

    const terugkerend = await db
      .select()
      .from(facturen)
      .where(
        and(
          eq(facturen.isTerugkerend, 1),
          eq(facturen.status, "betaald"),
          eq(facturen.isActief, 1)
        )
      )
      .all();

    if (terugkerend.length === 0) {
      return NextResponse.json({ aangemaakt: 0, bericht: "Geen terugkerende facturen gevonden." });
    }

    const aangemaakteFacturen: Array<{ factuurId: number; factuurnummer: string; bronFactuur: string }> = [];

    for (const f of terugkerend) {
      // Check if enough time has passed since betaaldOp
      if (!f.betaaldOp) continue;

      const interval = f.terugkeerInterval === "wekelijks" ? 7 : 30;
      const daysSince = Math.floor(
        (Date.now() - new Date(f.betaaldOp).getTime()) / 86400000
      );
      if (daysSince < interval) continue;

      // Generate next factuurnummer
      const jaar = new Date().getFullYear();
      const [laatste] = await db
        .select({ factuurnummer: facturen.factuurnummer })
        .from(facturen)
        .where(like(facturen.factuurnummer, `AUT-${jaar}-%`))
        .orderBy(desc(facturen.factuurnummer))
        .limit(1)
        .all();

      let volgnummer = 1;
      if (laatste) {
        const parts = laatste.factuurnummer.split("-");
        volgnummer = parseInt(parts[2], 10) + 1;
      }
      const nieuweNummer = `AUT-${jaar}-${volgnummer.toString().padStart(3, "0")}`;

      // Calculate new dates
      const nu = new Date();
      const factuurdatum = nu.toISOString().slice(0, 10);
      const vervaldatumDate = new Date(nu);
      vervaldatumDate.setDate(vervaldatumDate.getDate() + 30);
      const vervaldatum = vervaldatumDate.toISOString().slice(0, 10);

      // Create new invoice
      const [nieuw] = await db
        .insert(facturen)
        .values({
          klantId: f.klantId,
          projectId: f.projectId,
          factuurnummer: nieuweNummer,
          status: "concept",
          bedragExclBtw: f.bedragExclBtw,
          btwPercentage: f.btwPercentage,
          btwBedrag: f.btwBedrag,
          bedragInclBtw: f.bedragInclBtw,
          factuurdatum,
          vervaldatum,
          isTerugkerend: 1,
          terugkeerInterval: f.terugkeerInterval,
          notities: f.notities,
          aangemaaktDoor: gebruiker.id,
        })
        .returning()
        .all();

      // Copy factuurregels
      const bronRegels = await db
        .select()
        .from(factuurRegels)
        .where(eq(factuurRegels.factuurId, f.id))
        .all();

      for (const regel of bronRegels) {
        await db.insert(factuurRegels)
          .values({
            factuurId: nieuw.id,
            omschrijving: regel.omschrijving,
            aantal: regel.aantal,
            eenheidsprijs: regel.eenheidsprijs,
            btwPercentage: regel.btwPercentage,
            totaal: regel.totaal,
          })
          .run();
      }

      aangemaakteFacturen.push({
        factuurId: nieuw.id,
        factuurnummer: nieuweNummer,
        bronFactuur: f.factuurnummer,
      });
    }

    return NextResponse.json({
      aangemaakt: aangemaakteFacturen.length,
      facturen: aangemaakteFacturen,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon periodieke facturen niet genereren" },
      { status: 500 }
    );
  }
}
