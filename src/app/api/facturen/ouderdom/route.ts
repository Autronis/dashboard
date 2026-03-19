import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, inArray } from "drizzle-orm";

interface OuderdomBucket {
  aantal: number;
  bedrag: number;
}

interface KlantOuderdom {
  klantNaam: string;
  openstaand: number;
  oudste: number;
  aantalFacturen: number;
}

// GET /api/facturen/ouderdom — ouderdomsanalyse van openstaande facturen
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();

    // Get all outstanding invoices (verzonden or te_laat)
    const openstaand = await db
      .select({
        id: facturen.id,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
        factuurdatum: facturen.factuurdatum,
        klantId: facturen.klantId,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          inArray(facturen.status, ["verzonden", "te_laat"]),
          eq(facturen.isActief, 1)
        )
      )
      .all();

    // Initialize buckets
    const buckets: Record<string, OuderdomBucket> = {
      "0-30": { aantal: 0, bedrag: 0 },
      "31-60": { aantal: 0, bedrag: 0 },
      "61-90": { aantal: 0, bedrag: 0 },
      "90+": { aantal: 0, bedrag: 0 },
    };

    // Per klant tracking
    const klantMap = new Map<number, KlantOuderdom>();

    for (const f of openstaand) {
      // Calculate days outstanding from vervaldatum (if set), otherwise factuurdatum
      const referentieDatum = f.vervaldatum || f.factuurdatum;
      if (!referentieDatum) continue;

      const dagenOud = Math.floor(
        (nu.getTime() - new Date(referentieDatum).getTime()) / 86400000
      );
      const bedrag = f.bedragInclBtw || 0;

      // Assign to bucket
      if (dagenOud <= 30) {
        buckets["0-30"].aantal++;
        buckets["0-30"].bedrag += bedrag;
      } else if (dagenOud <= 60) {
        buckets["31-60"].aantal++;
        buckets["31-60"].bedrag += bedrag;
      } else if (dagenOud <= 90) {
        buckets["61-90"].aantal++;
        buckets["61-90"].bedrag += bedrag;
      } else {
        buckets["90+"].aantal++;
        buckets["90+"].bedrag += bedrag;
      }

      // Per klant
      if (f.klantId) {
        const bestaand = klantMap.get(f.klantId);
        if (bestaand) {
          bestaand.openstaand += bedrag;
          bestaand.aantalFacturen++;
          if (dagenOud > bestaand.oudste) bestaand.oudste = dagenOud;
        } else {
          klantMap.set(f.klantId, {
            klantNaam: f.klantNaam || "Onbekend",
            openstaand: bedrag,
            oudste: Math.max(dagenOud, 0),
            aantalFacturen: 1,
          });
        }
      }
    }

    // Round bedragen
    for (const bucket of Object.values(buckets)) {
      bucket.bedrag = Math.round(bucket.bedrag * 100) / 100;
    }

    const totaalAantal = Object.values(buckets).reduce((s, b) => s + b.aantal, 0);
    const totaalBedrag = Object.values(buckets).reduce((s, b) => s + b.bedrag, 0);

    const perKlant = Array.from(klantMap.values())
      .map((k) => ({ ...k, openstaand: Math.round(k.openstaand * 100) / 100 }))
      .sort((a, b) => b.openstaand - a.openstaand);

    return NextResponse.json({
      ouderdom: {
        ...buckets,
        totaal: {
          aantal: totaalAantal,
          bedrag: Math.round(totaalBedrag * 100) / 100,
        },
      },
      perKlant,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon ouderdomsanalyse niet berekenen" },
      { status: 500 }
    );
  }
}
