import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { gewoontes } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const existing = await db
      .select()
      .from(gewoontes)
      .where(
        and(eq(gewoontes.id, Number(id)), eq(gewoontes.gebruikerId, gebruiker.id))
      )
      .get();

    if (!existing) {
      return NextResponse.json({ fout: "Gewoonte niet gevonden" }, { status: 404 });
    }

    const updated = await db
      .update(gewoontes)
      .set({
        ...(body.naam !== undefined && { naam: body.naam }),
        ...(body.icoon !== undefined && { icoon: body.icoon }),
        ...(body.frequentie !== undefined && { frequentie: body.frequentie }),
        ...(body.streefwaarde !== undefined && { streefwaarde: body.streefwaarde }),
        ...(body.volgorde !== undefined && { volgorde: body.volgorde }),
        ...(body.doel !== undefined && { doel: body.doel }),
        ...(body.waarom !== undefined && { waarom: body.waarom }),
        ...(body.verwachteTijd !== undefined && { verwachteTijd: body.verwachteTijd }),
        ...(body.isActief !== undefined && { isActief: body.isActief }),
      })
      .where(
        and(eq(gewoontes.id, Number(id)), eq(gewoontes.gebruikerId, gebruiker.id))
      )
      .returning()
      .get();

    return NextResponse.json({ gewoonte: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    // Soft delete
    await db.update(gewoontes)
      .set({ isActief: 0 })
      .where(
        and(eq(gewoontes.id, Number(id)), eq(gewoontes.gebruikerId, gebruiker.id))
      )
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    if (msg === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: msg }, { status: 401 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
