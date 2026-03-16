import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [item] = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.id, Number(id)),
          eq(secondBrainItems.gebruikerId, gebruiker.id)
        )
      )
      .all();

    if (!item) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;

    const [bestaand] = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.id, Number(id)),
          eq(secondBrainItems.gebruikerId, gebruiker.id)
        )
      )
      .all();

    if (!bestaand) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    const updateVelden: Record<string, unknown> = {};
    if (body.titel !== undefined) updateVelden.titel = body.titel;
    if (body.inhoud !== undefined) updateVelden.inhoud = body.inhoud;
    if (body.aiTags !== undefined) updateVelden.aiTags = JSON.stringify(body.aiTags);
    if (body.isFavoriet !== undefined) updateVelden.isFavoriet = body.isFavoriet;
    if (body.isGearchiveerd !== undefined) updateVelden.isGearchiveerd = body.isGearchiveerd;
    if (body.taal !== undefined) updateVelden.taal = body.taal;
    updateVelden.bijgewerktOp = new Date().toISOString();

    const [updated] = await db
      .update(secondBrainItems)
      .set(updateVelden)
      .where(eq(secondBrainItems.id, Number(id)))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [item] = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.id, Number(id)),
          eq(secondBrainItems.gebruikerId, gebruiker.id)
        )
      )
      .all();

    if (!item) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    await db
      .update(secondBrainItems)
      .set({ isGearchiveerd: 1, bijgewerktOp: new Date().toISOString() })
      .where(eq(secondBrainItems.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
