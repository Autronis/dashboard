import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen, gebruikers, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { WikiPDF } from "@/lib/wiki-pdf";
import React from "react";

// GET /api/wiki/[id]/pdf — generate branded PDF
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const artikel = await db
      .select({
        id: wikiArtikelen.id,
        titel: wikiArtikelen.titel,
        inhoud: wikiArtikelen.inhoud,
        categorie: wikiArtikelen.categorie,
        auteurNaam: gebruikers.naam,
        bijgewerktOp: wikiArtikelen.bijgewerktOp,
      })
      .from(wikiArtikelen)
      .leftJoin(gebruikers, eq(wikiArtikelen.auteurId, gebruikers.id))
      .where(eq(wikiArtikelen.id, Number(id)))
      .get();

    if (!artikel) {
      return NextResponse.json({ fout: "Artikel niet gevonden" }, { status: 404 });
    }

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(WikiPDF, {
        artikel: {
          titel: artikel.titel,
          inhoud: artikel.inhoud || "",
          categorie: artikel.categorie,
          auteurNaam: artikel.auteurNaam,
          bijgewerktOp: artikel.bijgewerktOp,
        },
        bedrijf: bedrijf || {
          bedrijfsnaam: "Autronis",
          email: null,
          website: null,
          kvkNummer: null,
        },
      }) as any
    );

    const filename = `Autronis_Wiki_${artikel.titel.replace(/[^a-zA-Z0-9 -]/g, "").replace(/\s+/g, "_")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon PDF niet genereren" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
