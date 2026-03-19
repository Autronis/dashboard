import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externeKalenders } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// DELETE /api/agenda/kalenders/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const kalenderId = parseInt(id, 10);

    await db
      .delete(externeKalenders)
      .where(and(eq(externeKalenders.id, kalenderId), eq(externeKalenders.gebruikerId, gebruiker.id)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/agenda/kalenders/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const kalenderId = parseInt(id, 10);
    const body = (await req.json()) as {
      naam?: string;
      kleur?: string;
      isActief?: number;
    };

    await db
      .update(externeKalenders)
      .set({
        ...(body.naam !== undefined && { naam: body.naam }),
        ...(body.kleur !== undefined && { kleur: body.kleur }),
        ...(body.isActief !== undefined && { isActief: body.isActief }),
      })
      .where(and(eq(externeKalenders.id, kalenderId), eq(externeKalenders.gebruikerId, gebruiker.id)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
