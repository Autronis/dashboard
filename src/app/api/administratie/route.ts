import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, facturen, bankTransacties, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, desc, sql, isNotNull, like } from "drizzle-orm";

interface Document {
  id: number;
  type: "inkomend" | "uitgaand" | "bonnetje";
  leverancier: string;
  bedrag: number;
  btwBedrag: number | null;
  datum: string;
  status: string;
  storageUrl: string | null;
  factuurnummer: string | null;
  transactieId: number | null;
  verwerktInAangifte: string | null;
}

function getDateRange(jaar: number, kwartaal?: number): { start: string; end: string } {
  if (kwartaal) {
    const startMonth = (kwartaal - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const start = `${jaar}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(jaar, endMonth, 0).getDate();
    const end = `${jaar}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }
  return { start: `${jaar}-01-01`, end: `${jaar}-12-31` };
}

// GET /api/administratie?jaar=2025&kwartaal=1&type=inkomend
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const jaar = parseInt(searchParams.get("jaar") ?? String(new Date().getFullYear()), 10);
    const kwartaalParam = searchParams.get("kwartaal");
    const kwartaal = kwartaalParam ? parseInt(kwartaalParam, 10) : undefined;
    const type = searchParams.get("type") as "inkomend" | "uitgaand" | "bonnetjes" | null;

    const { start, end } = getDateRange(jaar, kwartaal);

    const documenten: Document[] = [];

    // Inkomende facturen
    if (!type || type === "inkomend") {
      const inkomend = await db
        .select()
        .from(inkomendeFacturen)
        .where(and(gte(inkomendeFacturen.datum, start), lte(inkomendeFacturen.datum, end)));

      for (const f of inkomend) {
        documenten.push({
          id: f.id,
          type: "inkomend",
          leverancier: f.leverancier,
          bedrag: f.bedrag,
          btwBedrag: f.btwBedrag ?? null,
          datum: f.datum,
          status: f.status ?? "onbekoppeld",
          storageUrl: f.storageUrl,
          factuurnummer: f.factuurnummer ?? null,
          transactieId: f.bankTransactieId ?? null,
          verwerktInAangifte: f.verwerktInAangifte ?? null,
        });
      }
    }

    // Uitgaande facturen — alle actieve facturen in de periode, ook zonder
    // gekoppelde PDF in Supabase. De leverancier-kolom toont nu de klant-
    // naam (via LEFT JOIN klanten) in plaats van hardcoded "Autronis".
    // Facturen met verwerktInAangifte gezet blijven in de lijst maar tellen
    // niet mee in totalen (zie hieronder bij KPI berekening).
    if (!type || type === "uitgaand") {
      const uitgaand = await db
        .select({
          id: facturen.id,
          factuurnummer: facturen.factuurnummer,
          bedragInclBtw: facturen.bedragInclBtw,
          btwBedrag: facturen.btwBedrag,
          factuurdatum: facturen.factuurdatum,
          status: facturen.status,
          pdfStorageUrl: facturen.pdfStorageUrl,
          verwerktInAangifte: facturen.verwerktInAangifte,
          klantBedrijfsnaam: klanten.bedrijfsnaam,
        })
        .from(facturen)
        .leftJoin(klanten, eq(facturen.klantId, klanten.id))
        .where(
          and(
            eq(facturen.isActief, 1),
            gte(facturen.factuurdatum, start),
            lte(facturen.factuurdatum, end)
          )
        );

      for (const f of uitgaand) {
        documenten.push({
          id: f.id,
          type: "uitgaand",
          leverancier: f.klantBedrijfsnaam ?? "Onbekende klant",
          bedrag: f.bedragInclBtw ?? 0,
          btwBedrag: f.btwBedrag ?? null,
          datum: f.factuurdatum ?? "",
          status: f.status ?? "concept",
          storageUrl: f.pdfStorageUrl ?? null,
          factuurnummer: f.factuurnummer,
          transactieId: null,
          verwerktInAangifte: f.verwerktInAangifte ?? null,
        });
      }
    }

    // Bonnetjes (bankTransacties where storageUrl IS NOT NULL and LIKE '%/bonnetjes/%')
    if (!type || type === "bonnetjes") {
      const bonnetjes = await db
        .select()
        .from(bankTransacties)
        .where(
          and(
            isNotNull(bankTransacties.storageUrl),
            like(bankTransacties.storageUrl, "%/bonnetjes/%"),
            gte(bankTransacties.datum, start),
            lte(bankTransacties.datum, end)
          )
        );

      for (const b of bonnetjes) {
        documenten.push({
          id: b.id,
          type: "bonnetje",
          leverancier: b.merchantNaam ?? b.omschrijving,
          bedrag: Math.abs(b.bedrag),
          btwBedrag: b.btwBedrag ?? null,
          datum: b.datum,
          status: "gematcht",
          storageUrl: b.storageUrl ?? null,
          factuurnummer: null,
          transactieId: b.id,
          verwerktInAangifte: null,
        });
      }
    }

    // Sort all by date descending
    documenten.sort((a, b) => b.datum.localeCompare(a.datum));

    // Count onbekoppeld from inkomendeFacturen (full count, not filtered)
    const [onbekoppeldRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inkomendeFacturen)
      .where(eq(inkomendeFacturen.status, "onbekoppeld"));

    const onbekoppeld = onbekoppeldRow?.count ?? 0;

    // Calculate totals. Skip rows die al in een eerdere aangifte zijn
    // verwerkt — die blijven in de lijst maar tellen niet mee.
    const totalen = {
      inkomend: 0,
      uitgaand: 0,
      btw: 0,
      verwerktAantal: 0,
    };

    for (const doc of documenten) {
      if (doc.verwerktInAangifte) {
        totalen.verwerktAantal++;
        continue;
      }
      if (doc.type === "inkomend" || doc.type === "bonnetje") {
        totalen.inkomend += doc.bedrag;
      } else if (doc.type === "uitgaand") {
        totalen.uitgaand += doc.bedrag;
      }
      totalen.btw += doc.btwBedrag ?? 0;
    }

    return NextResponse.json({ documenten, onbekoppeld, totalen });
  } catch (error) {
    console.error("[/api/administratie] error:", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
