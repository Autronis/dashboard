import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// PUT /api/screen-time/[id] — update project/klant assignment
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const entryId = Number(id);
    if (isNaN(entryId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    // Verify ownership
    const [bestaand] = await db
      .select({ id: screenTimeEntries.id })
      .from(screenTimeEntries)
      .where(
        and(
          eq(screenTimeEntries.id, entryId),
          eq(screenTimeEntries.gebruikerId, gebruiker.id)
        )
      );

    if (!bestaand) {
      return NextResponse.json({ fout: "Entry niet gevonden" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if ("projectId" in body) updates.projectId = body.projectId ?? null;
    if ("klantId" in body) updates.klantId = body.klantId ?? null;
    if ("categorie" in body) updates.categorie = body.categorie;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken" }, { status: 400 });
    }

    await db
      .update(screenTimeEntries)
      .set(updates)
      .where(eq(screenTimeEntries.id, entryId))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
