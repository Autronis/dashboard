import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { followUpTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/followup/templates/[id] — update template
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
    if (body.onderwerp !== undefined) updateData.onderwerp = body.onderwerp.trim();
    if (body.inhoud !== undefined) updateData.inhoud = body.inhoud.trim();
    if (body.type !== undefined) updateData.type = body.type;

    const [bijgewerkt] = await db
      .update(followUpTemplates)
      .set(updateData)
      .where(eq(followUpTemplates.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Template niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ template: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/followup/templates/[id] — soft delete template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await db
      .update(followUpTemplates)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(followUpTemplates.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
