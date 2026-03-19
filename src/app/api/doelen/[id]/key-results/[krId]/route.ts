import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { okrKeyResults } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/doelen/[id]/key-results/[krId] — update single key result value
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; krId: string }> }
) {
  try {
    await requireAuth();
    const { krId } = await params;
    const keyResultId = Number(krId);

    const body = await req.json() as { huidigeWaarde?: number; confidence?: number };

    if (body.huidigeWaarde === undefined && body.confidence === undefined) {
      return NextResponse.json({ fout: "Huidige waarde of confidence is verplicht" }, { status: 400 });
    }

    const updates: Record<string, number> = {};
    if (body.huidigeWaarde !== undefined) updates.huidigeWaarde = body.huidigeWaarde;
    if (body.confidence !== undefined) updates.confidence = Math.max(0, Math.min(100, body.confidence));

    const [updated] = await db
      .update(okrKeyResults)
      .set(updates)
      .where(eq(okrKeyResults.id, keyResultId))
      .returning();

    if (!updated) {
      return NextResponse.json({ fout: "Key result niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ keyResult: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
