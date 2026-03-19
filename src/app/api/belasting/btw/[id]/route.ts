import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { btwAangiftes } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/belasting/btw/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const aangifteId = parseInt(id, 10);
    const body = await req.json();

    // Verify aangifte exists
    const bestaand = await db
      .select()
      .from(btwAangiftes)
      .where(eq(btwAangiftes.id, aangifteId))
      .get();

    if (!bestaand) {
      return NextResponse.json({ fout: "BTW aangifte niet gevonden." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.status && ["open", "ingediend", "betaald"].includes(body.status)) {
      updateData.status = body.status;

      if (body.status === "ingediend") {
        updateData.ingediendOp = new Date().toISOString();
      }
    }

    if (typeof body.notities === "string") {
      updateData.notities = body.notities.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken." }, { status: 400 });
    }

    const [bijgewerkt] = await db
      .update(btwAangiftes)
      .set(updateData)
      .where(eq(btwAangiftes.id, aangifteId))
      .returning()
      .all();

    return NextResponse.json({ aangifte: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
