import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/radar/items/[id] — Item bijwerken (bewaard toggle, categorie override)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const itemId = parseInt(id, 10);
    const body = await req.json();
    const { bewaard, categorie } = body;

    const bestaand = await db
      .select({ id: radarItems.id })
      .from(radarItems)
      .where(eq(radarItems.id, itemId))
      .get();

    if (!bestaand) {
      return NextResponse.json(
        { fout: "Item niet gevonden" },
        { status: 404 }
      );
    }

    const { nietRelevant } = body;
    const updates: Record<string, string | number> = {};
    if (bewaard !== undefined) updates.bewaard = bewaard;
    if (categorie !== undefined) updates.categorie = categorie;
    if (nietRelevant !== undefined) updates.nietRelevant = nietRelevant;

    await db.update(radarItems)
      .set(updates)
      .where(eq(radarItems.id, itemId))
      .run();

    const item = await db
      .select()
      .from(radarItems)
      .where(eq(radarItems.id, itemId))
      .get();

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/radar/items/[id] — Item verwijderen
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const itemId = parseInt(id, 10);

    const bestaand = await db
      .select({ id: radarItems.id })
      .from(radarItems)
      .where(eq(radarItems.id, itemId))
      .get();

    if (!bestaand) {
      return NextResponse.json(
        { fout: "Item niet gevonden" },
        { status: 404 }
      );
    }

    await db.delete(radarItems)
      .where(eq(radarItems.id, itemId))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
