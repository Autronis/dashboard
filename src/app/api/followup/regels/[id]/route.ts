import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { followUpRegels } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/followup/regels/[id] — update rule
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
    if (body.type !== undefined) updateData.type = body.type;
    if (body.doelgroep !== undefined) updateData.doelgroep = body.doelgroep;
    if (body.dagenDrempel !== undefined) updateData.dagenDrempel = body.dagenDrempel;
    if (body.templateId !== undefined) updateData.templateId = body.templateId;

    const [bijgewerkt] = await db
      .update(followUpRegels)
      .set(updateData)
      .where(eq(followUpRegels.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Regel niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ regel: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/followup/regels/[id] — soft delete rule
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await db
      .update(followUpRegels)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(followUpRegels.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
