import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { investeringen, belastingAuditLog } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/belasting/investeringen/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const investId = parseInt(id, 10);
    const body = await req.json();

    const bestaand = await db
      .select()
      .from(investeringen)
      .where(eq(investeringen.id, investId))
      .limit(1)
      .all();

    if (bestaand.length === 0) {
      return NextResponse.json(
        { fout: "Investering niet gevonden." },
        { status: 404 }
      );
    }

    const { naam, bedrag, datum, categorie, afschrijvingstermijn, restwaarde, notities } = body as {
      naam?: string;
      bedrag?: number;
      datum?: string;
      categorie?: string;
      afschrijvingstermijn?: number;
      restwaarde?: number;
      notities?: string;
    };

    const updated = await db
      .update(investeringen)
      .set({
        ...(naam !== undefined && { naam }),
        ...(bedrag !== undefined && { bedrag }),
        ...(datum !== undefined && { datum }),
        ...(categorie !== undefined && { categorie: categorie as "hardware" | "software" | "inventaris" | "vervoer" | "overig" }),
        ...(afschrijvingstermijn !== undefined && { afschrijvingstermijn }),
        ...(restwaarde !== undefined && { restwaarde }),
        ...(notities !== undefined && { notities }),
      })
      .where(eq(investeringen.id, investId))
      .returning()
      .all();

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "investering_bijgewerkt",
      entiteitType: "investering",
      entiteitId: investId,
      details: JSON.stringify(body),
    }).run();

    return NextResponse.json({ investering: updated[0] });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/belasting/investeringen/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const investId = parseInt(id, 10);

    const bestaand = await db
      .select()
      .from(investeringen)
      .where(eq(investeringen.id, investId))
      .limit(1)
      .all();

    if (bestaand.length === 0) {
      return NextResponse.json(
        { fout: "Investering niet gevonden." },
        { status: 404 }
      );
    }

    await db.delete(investeringen).where(eq(investeringen.id, investId)).run();

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "investering_verwijderd",
      entiteitType: "investering",
      entiteitId: investId,
      details: JSON.stringify({ naam: bestaand[0]?.naam }),
    }).run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
