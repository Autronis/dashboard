import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leadActiviteiten, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { createAutoCapture } from "@/lib/ideeen/auto-capture";
import { aiCompleteJson } from "@/lib/ai/client";

// GET /api/leads/[id]/activiteiten
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const rows = await db
      .select({
        id: leadActiviteiten.id,
        leadId: leadActiviteiten.leadId,
        gebruikerId: leadActiviteiten.gebruikerId,
        gebruikerNaam: gebruikers.naam,
        type: leadActiviteiten.type,
        titel: leadActiviteiten.titel,
        omschrijving: leadActiviteiten.omschrijving,
        aangemaaktOp: leadActiviteiten.aangemaaktOp,
      })
      .from(leadActiviteiten)
      .leftJoin(gebruikers, eq(leadActiviteiten.gebruikerId, gebruikers.id))
      .where(eq(leadActiviteiten.leadId, Number(id)))
      .orderBy(desc(leadActiviteiten.aangemaaktOp));

    return NextResponse.json({ activiteiten: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/leads/[id]/activiteiten
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    if (!body.type || !body.titel?.trim()) {
      return NextResponse.json(
        { fout: "Type en titel zijn verplicht." },
        { status: 400 }
      );
    }

    const [nieuw] = await db
      .insert(leadActiviteiten)
      .values({
        leadId: Number(id),
        gebruikerId: gebruiker.id,
        type: body.type,
        titel: body.titel.trim(),
        omschrijving: body.omschrijving?.trim() || null,
      })
      .returning();

    // Auto-capture: scan note for idea signals (non-blocking)
    const type = body.type as string;
    const omschrijving = body.omschrijving?.trim() as string | undefined;
    if (type === "notitie_toegevoegd" && omschrijving) {
      try {
        const signalen = await aiCompleteJson<Array<{ naam: string; quote: string }>>({
          system: `Scan deze lead-notitie op kans-signalen voor een tech bureau. Zoek naar onvervulde behoeften, feature requests, of marktopportuniteiten. Antwoord ALLEEN met JSON array: [{"naam": "korte titel", "quote": "relevante passage"}]. Geen signalen? Return [].`,
          prompt: omschrijving,
          maxTokens: 300,
        });
        for (const s of signalen) {
          await createAutoCapture({
            naam: s.naam,
            omschrijving: `Uit lead-notitie: ${s.quote}`,
            bron: `lead:${id}`,
            bronTekst: s.quote,
          });
        }
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ activiteit: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
