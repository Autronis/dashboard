import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarBronnen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/radar/bronnen/[id] — Bron bijwerken
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const bronId = parseInt(id, 10);
    const body = await req.json();
    const { naam, url, type, actief } = body;

    const bestaand = await db
      .select({ id: radarBronnen.id })
      .from(radarBronnen)
      .where(eq(radarBronnen.id, bronId))
      .get();

    if (!bestaand) {
      return NextResponse.json(
        { fout: "Bron niet gevonden" },
        { status: 404 }
      );
    }

    // Check URL uniciteit als URL gewijzigd
    if (url) {
      const duplicaat = await db
        .select({ id: radarBronnen.id })
        .from(radarBronnen)
        .where(eq(radarBronnen.url, url))
        .get();

      if (duplicaat && duplicaat.id !== bronId) {
        return NextResponse.json(
          { fout: "Een bron met deze URL bestaat al" },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, string | number> = {};
    if (naam !== undefined) updates.naam = naam;
    if (url !== undefined) updates.url = url;
    if (type !== undefined) updates.type = type;
    if (actief !== undefined) updates.actief = actief;

    await db.update(radarBronnen)
      .set(updates)
      .where(eq(radarBronnen.id, bronId))
      .run();

    const bron = await db
      .select()
      .from(radarBronnen)
      .where(eq(radarBronnen.id, bronId))
      .get();

    return NextResponse.json({ bron });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/radar/bronnen/[id] — Bron verwijderen
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const bronId = parseInt(id, 10);

    const bestaand = await db
      .select({ id: radarBronnen.id })
      .from(radarBronnen)
      .where(eq(radarBronnen.id, bronId))
      .get();

    if (!bestaand) {
      return NextResponse.json(
        { fout: "Bron niet gevonden" },
        { status: 404 }
      );
    }

    await db.delete(radarBronnen)
      .where(eq(radarBronnen.id, bronId))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
