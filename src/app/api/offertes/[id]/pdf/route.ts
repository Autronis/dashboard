import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offertes, offerteRegels, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { OffertePDF } from "@/lib/offerte-pdf";
import React from "react";

// GET /api/offertes/[id]/pdf
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [offerte] = await db
      .select({
        id: offertes.id,
        offertenummer: offertes.offertenummer,
        titel: offertes.titel,
        status: offertes.status,
        datum: offertes.datum,
        geldigTot: offertes.geldigTot,
        bedragExclBtw: offertes.bedragExclBtw,
        btwPercentage: offertes.btwPercentage,
        btwBedrag: offertes.btwBedrag,
        bedragInclBtw: offertes.bedragInclBtw,
        notities: offertes.notities,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantEmail: klanten.email,
        klantAdres: klanten.adres,
      })
      .from(offertes)
      .innerJoin(klanten, eq(offertes.klantId, klanten.id))
      .where(eq(offertes.id, Number(id)));

    if (!offerte) {
      return NextResponse.json({ fout: "Offerte niet gevonden." }, { status: 404 });
    }

    const regels = await db
      .select()
      .from(offerteRegels)
      .where(eq(offerteRegels.offerteId, Number(id)));

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(OffertePDF, {
        offerte,
        regels,
        bedrijf: bedrijf || {
          bedrijfsnaam: "Autronis",
          adres: null,
          kvkNummer: null,
          btwNummer: null,
          email: null,
          telefoon: null,
          iban: null,
        },
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Autronis_Offerte_${offerte.offertenummer}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon PDF niet genereren", stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}
