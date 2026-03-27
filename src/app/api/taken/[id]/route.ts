import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, teamActiviteit } from "@/lib/db/schema";
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

    // Task locking: als taak al toegewezen is aan iemand anders, blokkeer claim
    if (body.toegewezenAan !== undefined && huidig?.toegewezenAan && huidig.toegewezenAan !== gebruiker.id && body.toegewezenAan === gebruiker.id) {
      return NextResponse.json(
        { fout: "Deze taak is al opgepakt door iemand anders." },
        { status: 409 }
      );
    }

    // Als status naar "bezig" gaat en nog niet toegewezen, wijs automatisch toe
    if (body.status === "bezig" && !huidig?.toegewezenAan) {
      body.toegewezenAan = gebruiker.id;
    }

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (body.toegewezenAan !== undefined) updateData.toegewezenAan = body.toegewezenAan || null;
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
    if (body.kalenderId !== undefined) updateData.kalenderId = body.kalenderId || null;

    const [bijgewerkt] = await db
      .update(taken)
      .set(updateData)
      .where(eq(taken.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Taak niet gevonden." }, { status: 404 });
    }

    // Log activiteit voor team awareness
    if (huidig) {
      let actieType: "taak_gepakt" | "taak_afgerond" | "taak_update" | "status_wijziging" = "taak_update";
      let bericht = `heeft "${bijgewerkt.titel}" bijgewerkt`;

      if (body.status === "bezig" && huidig.status !== "bezig") {
        actieType = "taak_gepakt";
        bericht = `is begonnen aan "${bijgewerkt.titel}"`;
      } else if (body.status === "afgerond" && huidig.status !== "afgerond") {
        actieType = "taak_afgerond";
        bericht = `heeft "${bijgewerkt.titel}" afgerond`;
      } else if (body.status !== undefined && body.status !== huidig.status) {
        actieType = "status_wijziging";
        bericht = `heeft "${bijgewerkt.titel}" op ${body.status} gezet`;
      } else if (body.toegewezenAan === gebruiker.id && huidig.toegewezenAan !== gebruiker.id) {
        actieType = "taak_gepakt";
        bericht = `heeft "${bijgewerkt.titel}" opgepakt`;
      }

      db.insert(teamActiviteit).values({
        gebruikerId: gebruiker.id,
        type: actieType,
        taakId: Number(id),
        projectId: huidig.projectId,
        bericht,
      }).execute().catch(() => {});
    }

    // Sync with Google Calendar in the background
    if (huidig) {
      const nieuweDeadline = (body.deadline !== undefined ? body.deadline : huidig.deadline) as string | null;
      const nieuweIngeplandStart = (body.ingeplandStart !== undefined ? body.ingeplandStart : huidig.ingeplandStart) as string | null;
      const nieuweIngeplandEind = (body.ingeplandEind !== undefined ? body.ingeplandEind : huidig.ingeplandEind) as string | null;
      const nieuweTitel = ((body.titel !== undefined ? body.titel : huidig.titel) as string).trim();
      const nieuweOmschrijving = (body.omschrijving !== undefined ? body.omschrijving : huidig.omschrijving) as string | null;

      // Deadline sync
      if (nieuweDeadline && huidig.googleEventId) {
        updateGoogleEvent(gebruiker.id, huidig.googleEventId, {
          summary: nieuweTitel,
          description: nieuweOmschrijving ?? undefined,
          start: nieuweDeadline,
          allDay: true,
        }).catch(() => {});
      } else if (nieuweDeadline && !huidig.googleEventId) {
        pushEventToGoogle(gebruiker.id, {
          summary: nieuweTitel,
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
        deleteGoogleEvent(gebruiker.id, huidig.googleEventId).catch(() => {});
        await db.update(taken).set({ googleEventId: null }).where(eq(taken.id, Number(id))).execute();
      }

      // Ingepland (planned block) sync
      const ingeplandChanged = body.ingeplandStart !== undefined || body.ingeplandEind !== undefined || body.titel !== undefined;
      if (ingeplandChanged) {
        if (nieuweIngeplandStart && huidig.googlePlanEventId) {
          updateGoogleEvent(gebruiker.id, huidig.googlePlanEventId, {
            summary: nieuweTitel,
            description: nieuweOmschrijving ?? undefined,
            start: nieuweIngeplandStart,
            end: nieuweIngeplandEind ?? undefined,
            allDay: false,
          }).catch(() => {});
        } else if (nieuweIngeplandStart && !huidig.googlePlanEventId) {
          pushEventToGoogle(gebruiker.id, {
            summary: nieuweTitel,
            description: nieuweOmschrijving ?? undefined,
            start: nieuweIngeplandStart,
            end: nieuweIngeplandEind ?? undefined,
            allDay: false,
          })
            .then(async (event) => {
              if (event?.id) {
                await db.update(taken).set({ googlePlanEventId: event.id }).where(eq(taken.id, Number(id))).execute();
              }
            })
            .catch(() => {});
        } else if (!nieuweIngeplandStart && huidig.googlePlanEventId) {
          deleteGoogleEvent(gebruiker.id, huidig.googlePlanEventId).catch(() => {});
          await db.update(taken).set({ googlePlanEventId: null }).where(eq(taken.id, Number(id))).execute();
        }
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
    if (taak?.googlePlanEventId) {
      deleteGoogleEvent(gebruiker.id, taak.googlePlanEventId).catch(() => {});
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
