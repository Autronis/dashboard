import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { deleteGoogleEvent } from "@/lib/google-calendar";

// PUT /api/agenda/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.titel !== undefined) updateData.titel = body.titel.trim();
    if (body.omschrijving !== undefined) updateData.omschrijving = body.omschrijving?.trim() || null;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.startDatum !== undefined) updateData.startDatum = body.startDatum;
    if (body.eindDatum !== undefined) updateData.eindDatum = body.eindDatum || null;
    if (body.heleDag !== undefined) updateData.heleDag = body.heleDag ? 1 : 0;
    if (body.herinneringMinuten !== undefined) updateData.herinneringMinuten = body.herinneringMinuten;

    const [bijgewerkt] = await db
      .update(agendaItems)
      .set(updateData)
      .where(eq(agendaItems.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Item niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ item: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/agenda/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    // Get item to check for Google event
    const [item] = await db
      .select({ googleEventId: agendaItems.googleEventId })
      .from(agendaItems)
      .where(eq(agendaItems.id, Number(id)))
      .limit(1);

    // Delete from Google Calendar if linked
    if (item?.googleEventId) {
      deleteGoogleEvent(gebruiker.id, item.googleEventId).catch(() => {});
    }

    await db.delete(agendaItems).where(eq(agendaItems.id, Number(id)));
    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
