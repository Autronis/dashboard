import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persoonlijkeTodos } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/persoonlijk/todo/[id]
// Body: { gedaan?: boolean, titel?: string }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    if (gebruiker.id !== 1) {
      return NextResponse.json({ fout: "Geen toegang" }, { status: 403 });
    }

    const { id } = await params;
    const todoId = Number(id);
    if (Number.isNaN(todoId)) {
      return NextResponse.json({ fout: "Ongeldig id" }, { status: 400 });
    }

    const body = await req.json();
    const updates: { gedaan?: number; gedaanOp?: string | null; titel?: string } = {};

    if (typeof body.gedaan === "boolean") {
      updates.gedaan = body.gedaan ? 1 : 0;
      updates.gedaanOp = body.gedaan ? new Date().toISOString() : null;
    }
    if (typeof body.titel === "string" && body.titel.trim().length > 0) {
      updates.titel = body.titel.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ fout: "Geen wijzigingen" }, { status: 400 });
    }

    const [todo] = await db
      .update(persoonlijkeTodos)
      .set(updates)
      .where(eq(persoonlijkeTodos.id, todoId))
      .returning();

    if (!todo) {
      return NextResponse.json({ fout: "Niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ todo });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/persoonlijk/todo/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    if (gebruiker.id !== 1) {
      return NextResponse.json({ fout: "Geen toegang" }, { status: 403 });
    }

    const { id } = await params;
    const todoId = Number(id);
    if (Number.isNaN(todoId)) {
      return NextResponse.json({ fout: "Ongeldig id" }, { status: 400 });
    }

    await db.delete(persoonlijkeTodos).where(eq(persoonlijkeTodos.id, todoId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
