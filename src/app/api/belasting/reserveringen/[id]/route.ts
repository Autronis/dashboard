import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingReserveringen, belastingAuditLog } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/belasting/reserveringen/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const resId = parseInt(id, 10);
    const body = await req.json();

    const bestaand = await db
      .select()
      .from(belastingReserveringen)
      .where(eq(belastingReserveringen.id, resId))
      .limit(1)
      .all();

    if (bestaand.length === 0) {
      return NextResponse.json(
        { fout: "Reservering niet gevonden." },
        { status: 404 }
      );
    }

    const { maand, bedrag, type, notities } = body as {
      maand?: string;
      bedrag?: number;
      type?: string;
      notities?: string;
    };

    const updated = await db
      .update(belastingReserveringen)
      .set({
        ...(maand !== undefined && { maand }),
        ...(bedrag !== undefined && { bedrag }),
        ...(type !== undefined && { type: type as "btw" | "inkomstenbelasting" | "overig" }),
        ...(notities !== undefined && { notities }),
      })
      .where(eq(belastingReserveringen.id, resId))
      .returning()
      .all();

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "reservering_bijgewerkt",
      entiteitType: "reservering",
      entiteitId: resId,
      details: JSON.stringify(body),
    }).run();

    return NextResponse.json({ reservering: updated[0] });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/belasting/reserveringen/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const resId = parseInt(id, 10);

    const bestaand = await db
      .select()
      .from(belastingReserveringen)
      .where(eq(belastingReserveringen.id, resId))
      .limit(1)
      .all();

    if (bestaand.length === 0) {
      return NextResponse.json(
        { fout: "Reservering niet gevonden." },
        { status: 404 }
      );
    }

    await db.delete(belastingReserveringen).where(eq(belastingReserveringen.id, resId)).run();

    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "reservering_verwijderd",
      entiteitType: "reservering",
      entiteitId: resId,
      details: JSON.stringify({ maand: bestaand[0]?.maand, bedrag: bestaand[0]?.bedrag }),
    }).run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
