import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingTips } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PATCH /api/belasting/tips/[id] — Toggle toegepast or update tip
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const tipId = parseInt(id);

    const body = await request.json();

    // Toggle toegepast
    if ("toegepast" in body) {
      const [updated] = await db
        .update(belastingTips)
        .set({
          toegepast: body.toegepast ? 1 : 0,
          toegepastOp: body.toegepast ? new Date().toISOString() : null,
        })
        .where(eq(belastingTips.id, tipId))
        .returning();

      return NextResponse.json({ tip: updated });
    }

    return NextResponse.json({ fout: "Geen geldige update" }, { status: 400 });
  } catch {
    return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
  }
}

// DELETE /api/belasting/tips/[id] — Delete a tip
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const tipId = parseInt(id);

    await db.delete(belastingTips).where(eq(belastingTips.id, tipId));

    return NextResponse.json({ succes: true });
  } catch {
    return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
  }
}
