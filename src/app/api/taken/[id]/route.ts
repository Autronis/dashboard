import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { pushEventToGoogle, deleteGoogleEvent, updateGoogleEvent } from "@/lib/google-calendar";

// PUT /api/taken/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    // Fetch current state for Google Calendar sync comparison
    const [huidig] = await db.select().from(taken).where(eq(taken.id, Number(id))).limit(1);

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (body.titel !== undefined) updateData.titel = body.titel.trim();
    if (body.omschrijving !== undefined) updateData.omschrijving = body.omschrijving?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.deadline !== undefined) updateData.deadline = body.deadline || null;
    if (body.prioriteit !== undefined) updateData.prioriteit = body.prioriteit;
    if (body.fase !== undefined) updateData.fase = body.fase || null;
    if (body.volgorde !== undefined) updateData.volgorde = body.volgorde;
    if (body.uitvoerder !== undefined) updateData.uitvoerder = body.uitvoerder;
    if (body.prompt !== undefined) updateData.prompt = body.prompt?.trim() || null;
    if (body.projectMap !== undefined) updateData.projectMap = body.projectMap || null;
    if (body.geschatteDuur !== undefined) updateData.geschatteDuur = body.geschatteDuur || null;
    if (body.ingeplandStart !== undefined) updateData.ingeplandStart = body.ingeplandStart || null;
    if (body.ingeplandEind !== undefined) updateData.ingeplandEind = body.ingeplandEind || null;

    const [bijgewerkt] = await db
      .update(taken)
      .set(updateData)
      .where(eq(taken.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Taak niet gevonden." }, { status: 404 });
    }

    // Sync with Google Calendar in the background
    if (huidig) {
      const nieuweDeadline = (body.deadline !== undefined ? body.deadline : huidig.deadline) as string | null;
      const nieuweTitel = ((body.titel !== undefined ? body.titel : huidig.titel) as string).trim();
      const nieuweOmschrijving = (body.omschrijving !== undefined ? body.omschrijving : huidig.omschrijving) as string | null;

      if (nieuweDeadline && huidig.googleEventId) {
        // Update existing event
        updateGoogleEvent(gebruiker.id, huidig.googleEventId, {
          summary: `📋 ${nieuweTitel}`,
          description: nieuweOmschrijving ?? undefined,
          start: nieuweDeadline,
          allDay: true,
        }).catch(() => {});
      } else if (nieuweDeadline && !huidig.googleEventId) {
        // Deadline added for the first time — create event
        pushEventToGoogle(gebruiker.id, {
          summary: `📋 ${nieuweTitel}`,
          description: nieuweOmschrijving ?? undefined,
          start: nieuweDeadline,
          allDay: true,
        })
          .then(async (event) => {
            if (event?.id) {
              await db.update(taken).set({ googleEventId: event.id }).where(eq(taken.id, Number(id))).execute();
            }
          })
          .catch(() => {});
      } else if (!nieuweDeadline && huidig.googleEventId) {
        // Deadline removed — delete event
        deleteGoogleEvent(gebruiker.id, huidig.googleEventId).catch(() => {});
        await db.update(taken).set({ googleEventId: null }).where(eq(taken.id, Number(id))).execute();
      }
    }

    return NextResponse.json({ taak: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/taken/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    // Fetch before deleting to get googleEventId
    const [taak] = await db.select().from(taken).where(eq(taken.id, Number(id))).limit(1);

    await db.delete(taken).where(eq(taken.id, Number(id)));

    // Remove from Google Calendar if linked
    if (taak?.googleEventId) {
      deleteGoogleEvent(gebruiker.id, taak.googleEventId).catch(() => {});
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
