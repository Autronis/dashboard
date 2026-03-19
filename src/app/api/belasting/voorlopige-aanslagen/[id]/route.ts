import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voorlopigeAanslagen, belastingAuditLog } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/belasting/voorlopige-aanslagen/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const aanslagId = parseInt(id, 10);
    const body = await req.json();

    const bestaand = await db
      .select()
      .from(voorlopigeAanslagen)
      .where(eq(voorlopigeAanslagen.id, aanslagId))
      .limit(1)
      .all();

    if (bestaand.length === 0) {
      return NextResponse.json(
        { fout: "Voorlopige aanslag niet gevonden." },
        { status: 404 }
      );
    }

    const { bedrag, betaaldBedrag, status, vervaldatum, notities, type } = body as {
      bedrag?: number;
      betaaldBedrag?: number;
      status?: string;
      vervaldatum?: string;
      notities?: string;
      type?: string;
    };

    const updated = await db
      .update(voorlopigeAanslagen)
      .set({
        ...(bedrag !== undefined && { bedrag }),
        ...(betaaldBedrag !== undefined && { betaaldBedrag }),
        ...(status !== undefined && { status: status as "openstaand" | "betaald" | "bezwaar" }),
        ...(vervaldatum !== undefined && { vervaldatum }),
        ...(notities !== undefined && { notities }),
        ...(type !== undefined && { type: type as "inkomstenbelasting" | "zvw" }),
      })
      .where(eq(voorlopigeAanslagen.id, aanslagId))
      .returning()
      .all();

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "voorlopige_aanslag_bijgewerkt",
      entiteitType: "voorlopige_aanslag",
      entiteitId: aanslagId,
      details: JSON.stringify(body),
    }).run();

    return NextResponse.json({ aanslag: updated[0] });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/belasting/voorlopige-aanslagen/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const aanslagId = parseInt(id, 10);

    const bestaand = await db
      .select()
      .from(voorlopigeAanslagen)
      .where(eq(voorlopigeAanslagen.id, aanslagId))
      .limit(1)
      .all();

    if (bestaand.length === 0) {
      return NextResponse.json(
        { fout: "Voorlopige aanslag niet gevonden." },
        { status: 404 }
      );
    }

    await db.delete(voorlopigeAanslagen).where(eq(voorlopigeAanslagen.id, aanslagId)).run();

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "voorlopige_aanslag_verwijderd",
      entiteitType: "voorlopige_aanslag",
      entiteitId: aanslagId,
      details: JSON.stringify({ jaar: bestaand[0]?.jaar, bedrag: bestaand[0]?.bedrag }),
    }).run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
