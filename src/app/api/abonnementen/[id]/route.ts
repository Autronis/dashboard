import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { abonnementen } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// PUT /api/abonnementen/[id]
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
    if (body.naam !== undefined) updateData.naam = body.naam.trim();
    if (body.leverancier !== undefined) updateData.leverancier = body.leverancier?.trim() || null;
    if (body.bedrag !== undefined) updateData.bedrag = body.bedrag;
    if (body.frequentie !== undefined) updateData.frequentie = body.frequentie;
    if (body.categorie !== undefined) updateData.categorie = body.categorie;
    if (body.startDatum !== undefined) updateData.startDatum = body.startDatum || null;
    if (body.volgendeBetaling !== undefined) updateData.volgendeBetaling = body.volgendeBetaling || null;
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.url !== undefined) updateData.url = body.url?.trim() || null;
    if (body.notities !== undefined) updateData.notities = body.notities?.trim() || null;

    const [bijgewerkt] = await db
      .update(abonnementen)
      .set(updateData)
      .where(eq(abonnementen.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Abonnement niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ abonnement: bijgewerkt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}

// DELETE /api/abonnementen/[id] (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await db
      .update(abonnementen)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(abonnementen.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}
