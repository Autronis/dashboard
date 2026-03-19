import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracten, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { ContractPDF } from "@/lib/contract-pdf";
import React from "react";

// GET /api/contracten/[id]/pdf
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [contract] = await db
      .select({
        id: contracten.id,
        titel: contracten.titel,
        type: contracten.type,
        inhoud: contracten.inhoud,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        aangemaaktOp: contracten.aangemaaktOp,
      })
      .from(contracten)
      .leftJoin(klanten, eq(contracten.klantId, klanten.id))
      .where(eq(contracten.id, Number(id)))
      .all();

    if (!contract) {
      return NextResponse.json({ fout: "Contract niet gevonden." }, { status: 404 });
    }

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1).all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(ContractPDF, {
        contract: {
          titel: contract.titel,
          type: contract.type,
          inhoud: contract.inhoud || "",
          klantNaam: contract.klantNaam || "Klant",
          klantContactpersoon: contract.klantContactpersoon,
          aangemaaktOp: contract.aangemaaktOp,
        },
        bedrijf: bedrijf || {
          bedrijfsnaam: "Autronis",
          adres: null,
          kvkNummer: null,
          email: null,
        },
      }) as any
    );

    const filename = `Autronis_Contract_${contract.titel.replace(/\s+/g, "_")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon PDF niet genereren" },
      { status: 500 }
    );
  }
}
