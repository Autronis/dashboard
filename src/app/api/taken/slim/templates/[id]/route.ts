import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeTakenTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/taken/slim/templates/[id]
// Body: gedeeltelijke update van het template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = (await req.json()) as {
      naam?: string;
      beschrijving?: string;
      cluster?: string;
      geschatteDuur?: number;
      prompt?: string;
      velden?: Array<{ key: string; label: string; placeholder?: string; type?: string }>;
      recurringDayOfWeek?: number | null;
      isActief?: number;
      uitvoerder?: "claude" | "handmatig";
    };

    const [bestaand] = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.id, Number(id)))
      .limit(1);

    if (!bestaand) {
      return NextResponse.json({ fout: "Template niet gevonden" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (body.naam !== undefined) updateData.naam = body.naam.trim();
    if (body.beschrijving !== undefined) updateData.beschrijving = body.beschrijving?.trim() || null;
    if (body.cluster !== undefined) {
      const VALID = ["backend-infra", "frontend", "klantcontact", "content", "admin", "research"];
      if (!VALID.includes(body.cluster)) {
        return NextResponse.json({ fout: `cluster moet een van ${VALID.join(", ")} zijn` }, { status: 400 });
      }
      updateData.cluster = body.cluster;
    }
    if (body.geschatteDuur !== undefined) updateData.geschatteDuur = body.geschatteDuur;
    if (body.prompt !== undefined) updateData.prompt = body.prompt.trim();
    if (body.velden !== undefined) {
      updateData.velden = body.velden && body.velden.length > 0 ? JSON.stringify(body.velden) : null;
    }
    if (body.recurringDayOfWeek !== undefined) updateData.recurringDayOfWeek = body.recurringDayOfWeek;
    if (body.uitvoerder !== undefined) {
      updateData.uitvoerder = body.uitvoerder === "handmatig" ? "handmatig" : "claude";
    }
    if (body.isActief !== undefined) {
      updateData.isActief = body.isActief;
      // Bij activeren van een suggestie: flip is_suggestie naar 0
      if (body.isActief === 1 && bestaand.isSuggestie === 1) {
        updateData.isSuggestie = 0;
        updateData.suggestieBron = null;
      }
    }

    const [bijgewerkt] = await db
      .update(slimmeTakenTemplates)
      .set(updateData)
      .where(eq(slimmeTakenTemplates.id, Number(id)))
      .returning();

    return NextResponse.json({ template: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/taken/slim/templates/[id]
// Systeem templates kunnen niet verwijderd worden, alleen deactiveren
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [bestaand] = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.id, Number(id)))
      .limit(1);

    if (!bestaand) {
      return NextResponse.json({ fout: "Template niet gevonden" }, { status: 404 });
    }

    if (bestaand.isSysteem === 1) {
      // Systeem template: soft delete (deactiveren)
      await db
        .update(slimmeTakenTemplates)
        .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
        .where(eq(slimmeTakenTemplates.id, Number(id)));
      return NextResponse.json({ ok: true, gedeactiveerd: true });
    }

    // User template: hard delete
    await db.delete(slimmeTakenTemplates).where(eq(slimmeTakenTemplates.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
