import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { btwAangiftes, belastingDeadlines } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

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

        // Mark corresponding BTW deadline as afgerond
        try {
          const deadline = await db.select().from(belastingDeadlines).where(and(
            eq(belastingDeadlines.type, "btw"),
            eq(belastingDeadlines.kwartaal, bestaand.kwartaal),
            eq(belastingDeadlines.jaar, bestaand.jaar),
          )).get();
          if (deadline) {
            await db.update(belastingDeadlines).set({ afgerond: 1 }).where(eq(belastingDeadlines.id, deadline.id));
          }
        } catch { /* deadline marking is best-effort */ }
      }
    }

    if (typeof body.notities === "string") {
      updateData.notities = body.notities.trim() || null;
    }

    if (typeof body.betalingskenmerk === "string") {
      updateData.betalingskenmerk = body.betalingskenmerk.trim() || null;
    }

    // Rubriek fields
    const rubriekFields = [
      "rubriek1aOmzet", "rubriek1aBtw", "rubriek1bOmzet", "rubriek1bBtw",
      "rubriek4aOmzet", "rubriek4aBtw", "rubriek4bOmzet", "rubriek4bBtw",
      "rubriek5aBtw", "rubriek5bBtw", "saldo",
    ] as const;

    for (const field of rubriekFields) {
      if (typeof body[field] === "number") {
        updateData[field] = body[field];
      }
    }

    // Also update legacy fields for backward compatibility
    if (typeof body.rubriek1aBtw === "number") {
      updateData.btwOntvangen = body.rubriek1aBtw + (body.rubriek1bBtw ?? 0);
    }
    if (typeof body.rubriek5bBtw === "number") {
      updateData.btwBetaald = body.rubriek5bBtw;
    }
    if (typeof body.saldo === "number") {
      updateData.btwAfdragen = body.saldo;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken." }, { status: 400 });
    }

    const [bijgewerkt] = await db
      .update(btwAangiftes)
      .set(updateData)
      .where(eq(btwAangiftes.id, aangifteId))
      .returning();

    return NextResponse.json({ aangifte: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
