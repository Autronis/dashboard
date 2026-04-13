import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/leads/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {
      bijgewerktOp: new Date().toISOString(),
    };

    if (body.bedrijfsnaam !== undefined) updateData.bedrijfsnaam = body.bedrijfsnaam.trim();
    if (body.contactpersoon !== undefined) updateData.contactpersoon = body.contactpersoon?.trim() || null;
    if (body.email !== undefined) updateData.email = body.email?.trim() || null;
    if (body.telefoon !== undefined) updateData.telefoon = body.telefoon?.trim() || null;
    if (body.waarde !== undefined) updateData.waarde = body.waarde;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.bron !== undefined) updateData.bron = body.bron?.trim() || null;
    if (body.notities !== undefined) updateData.notities = body.notities?.trim() || null;
    if (body.volgendeActie !== undefined) updateData.volgendeActie = body.volgendeActie?.trim() || null;
    if (body.volgendeActieDatum !== undefined) updateData.volgendeActieDatum = body.volgendeActieDatum || null;

    const [bijgewerkt] = await db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Lead niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ lead: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/leads/[id] — soft delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await db
      .update(leads)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(leads.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
