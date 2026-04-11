import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leadActiviteiten, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

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

    return NextResponse.json({ activiteit: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
