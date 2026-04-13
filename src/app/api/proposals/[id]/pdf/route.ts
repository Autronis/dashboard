import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { proposals, proposalRegels, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProposalPDF } from "@/lib/proposal-pdf";
import { parseSlides } from "@/lib/proposal-schema";
import React from "react";

// GET /api/proposals/[id]/pdf
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [proposal] = await db
      .select({
        id: proposals.id,
        titel: proposals.titel,
        secties: proposals.secties,
        totaalBedrag: proposals.totaalBedrag,
        geldigTot: proposals.geldigTot,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantEmail: klanten.email,
        klantAdres: klanten.adres,
        aangemaaktOp: proposals.aangemaaktOp,
      })
      .from(proposals)
      .innerJoin(klanten, eq(proposals.klantId, klanten.id))
      .where(eq(proposals.id, Number(id)));

    if (!proposal) {
      return NextResponse.json({ fout: "Proposal niet gevonden." }, { status: 404 });
    }

    const regels = await db
      .select()
      .from(proposalRegels)
      .where(eq(proposalRegels.proposalId, Number(id)));

    const slides = parseSlides(proposal.secties);

    const pdfBuffer = await renderToBuffer(
      React.createElement(ProposalPDF, {
        proposal: {
          titel: proposal.titel,
          klantNaam: proposal.klantNaam,
          klantContactpersoon: proposal.klantContactpersoon,
          klantAdres: proposal.klantAdres,
          datum: proposal.aangemaaktOp,
          geldigTot: proposal.geldigTot,
          totaalBedrag: proposal.totaalBedrag || 0,
        },
        secties: slides,
        regels,
      }) as never
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Autronis_Proposal_${proposal.titel.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon PDF niet genereren" },
      { status: 500 }
    );
  }
}
