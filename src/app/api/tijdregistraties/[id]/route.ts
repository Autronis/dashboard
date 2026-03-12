import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// PUT /api/tijdregistraties/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const { omschrijving, projectId, categorie, startTijd, eindTijd, duurMinuten } = body;

    // Verify ownership
    const [bestaand] = await db
      .select()
      .from(tijdregistraties)
      .where(
        and(
          eq(tijdregistraties.id, Number(id)),
          eq(tijdregistraties.gebruikerId, gebruiker.id)
        )
      );

    if (!bestaand) {
      return NextResponse.json({ fout: "Registratie niet gevonden." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (omschrijving !== undefined) updateData.omschrijving = omschrijving;
    if (projectId !== undefined) updateData.projectId = projectId;
    if (categorie !== undefined) updateData.categorie = categorie;
    if (startTijd !== undefined) updateData.startTijd = startTijd;
    if (eindTijd !== undefined) updateData.eindTijd = eindTijd;
    if (duurMinuten !== undefined) updateData.duurMinuten = duurMinuten;

    const [bijgewerkt] = await db
      .update(tijdregistraties)
      .set(updateData)
      .where(eq(tijdregistraties.id, Number(id)))
      .returning();

    return NextResponse.json({ registratie: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/tijdregistraties/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const [bestaand] = await db
      .select()
      .from(tijdregistraties)
      .where(
        and(
          eq(tijdregistraties.id, Number(id)),
          eq(tijdregistraties.gebruikerId, gebruiker.id)
        )
      );

    if (!bestaand) {
      return NextResponse.json({ fout: "Registratie niet gevonden." }, { status: 404 });
    }

    await db
      .delete(tijdregistraties)
      .where(eq(tijdregistraties.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
