import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, agendaItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, isNotNull, or } from "drizzle-orm";
import { google } from "googleapis";
import { getTokensForUser, getAuthenticatedClient } from "@/lib/google-calendar";

// POST /api/admin/google-cal-cleanup
// Haal alle Google Calendar events weg die vanuit het dashboard zijn
// aangemaakt (via googleEventId of googlePlanEventId op taken, of
// googleEventId op agenda_items). Na succes worden de kolommen in de
// DB op null gezet zodat we ze nooit meer aanraken.
//
// Bypassed expres de isGoogleCalSyncEnabled check in deleteGoogleEvent
// (die is sowieso niet gegated, maar voor de zekerheid gebruiken we hier
// een direct calendar.events.delete call op de user's geauthenticeerde
// client).
//
// Auth: sessie (alleen ingelogde users). Idempotent — events die al weg
// zijn (404 van Google) worden als success geteld.
export async function POST() {
  try {
    const gebruiker = await requireAuth();

    // Get authenticated Google client voor deze user
    const client = await getAuthenticatedClient(gebruiker.id);
    if (!client) {
      return NextResponse.json(
        { fout: "Google Calendar niet gekoppeld voor deze gebruiker" },
        { status: 400 }
      );
    }

    const calendar = google.calendar({ version: "v3", auth: client });
    const tokens = await getTokensForUser(gebruiker.id);
    const calendarId = tokens?.calendarId ?? "primary";

    // 1. Pak alle taken met een googleEventId of googlePlanEventId
    const takenMetEvents = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        googleEventId: taken.googleEventId,
        googlePlanEventId: taken.googlePlanEventId,
      })
      .from(taken)
      .where(
        or(isNotNull(taken.googleEventId), isNotNull(taken.googlePlanEventId))
      );

    // 2. Pak alle agenda items met googleEventId
    const agendaMetEvents = await db
      .select({
        id: agendaItems.id,
        titel: agendaItems.titel,
        googleEventId: agendaItems.googleEventId,
      })
      .from(agendaItems)
      .where(isNotNull(agendaItems.googleEventId));

    let verwijderd = 0;
    let alWeg = 0;
    const fouten: string[] = [];

    // Delete helper — treat 404 as success (al weg)
    async function verwijder(eventId: string): Promise<"ok" | "al_weg" | "fout"> {
      try {
        await calendar.events.delete({ calendarId, eventId });
        return "ok";
      } catch (err) {
        const e = err as { code?: number; status?: number };
        if (e?.code === 404 || e?.status === 404 || e?.code === 410 || e?.status === 410) {
          return "al_weg";
        }
        return "fout";
      }
    }

    // 3. Loop door taken en verwijder beide event types
    for (const taak of takenMetEvents) {
      const updates: { googleEventId?: null; googlePlanEventId?: null } = {};

      if (taak.googleEventId) {
        const result = await verwijder(taak.googleEventId);
        if (result === "ok") verwijderd++;
        else if (result === "al_weg") alWeg++;
        else fouten.push(`taak ${taak.id} (${taak.titel}) deadline event ${taak.googleEventId}`);
        updates.googleEventId = null;
      }

      if (taak.googlePlanEventId) {
        const result = await verwijder(taak.googlePlanEventId);
        if (result === "ok") verwijderd++;
        else if (result === "al_weg") alWeg++;
        else fouten.push(`taak ${taak.id} (${taak.titel}) plan event ${taak.googlePlanEventId}`);
        updates.googlePlanEventId = null;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(taken).set(updates).where(eq(taken.id, taak.id));
      }
    }

    // 4. Loop door agenda items
    for (const item of agendaMetEvents) {
      if (item.googleEventId) {
        const result = await verwijder(item.googleEventId);
        if (result === "ok") verwijderd++;
        else if (result === "al_weg") alWeg++;
        else fouten.push(`agenda item ${item.id} (${item.titel}) event ${item.googleEventId}`);
        await db
          .update(agendaItems)
          .set({ googleEventId: null })
          .where(eq(agendaItems.id, item.id));
      }
    }

    return NextResponse.json({
      ok: true,
      verwijderd,
      alWeg,
      fouten: fouten.length,
      foutenDetails: fouten.slice(0, 10), // Eerste 10 voor debugging
      totaal: verwijderd + alWeg + fouten.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
