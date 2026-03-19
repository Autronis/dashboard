import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingDeadlines } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/belasting/deadlines/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const deadlineId = parseInt(id, 10);
    const body = await req.json();

    // Verify deadline exists
    const bestaand = await db
      .select()
      .from(belastingDeadlines)
      .where(eq(belastingDeadlines.id, deadlineId))
      .get();

    if (!bestaand) {
      return NextResponse.json({ fout: "Deadline niet gevonden." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (typeof body.afgerond === "number" || typeof body.afgerond === "boolean") {
      updateData.afgerond = body.afgerond ? 1 : 0;
    }

    if (typeof body.notities === "string") {
      updateData.notities = body.notities.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken." }, { status: 400 });
    }

    const [bijgewerkt] = await db
      .update(belastingDeadlines)
      .set(updateData)
      .where(eq(belastingDeadlines.id, deadlineId))
      .returning()
      .all();

    return NextResponse.json({ deadline: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
