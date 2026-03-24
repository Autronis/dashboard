import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems, radarItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { pushEventToGoogle } from "@/lib/google-calendar";

// POST /api/radar/lees-later
// Body: { itemId: number }
// Maakt een agenda-herinnering aan voor morgen 09:00
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { itemId } = (await req.json()) as { itemId: number };

    if (!itemId) {
      return NextResponse.json({ fout: "itemId is verplicht" }, { status: 400 });
    }

    const item = await db
      .select({ titel: radarItems.titel, url: radarItems.url })
      .from(radarItems)
      .where(eq(radarItems.id, itemId))
      .get();

    if (!item) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    // Morgen 09:00 lokale tijd (CET)
    const morgen = new Date();
    morgen.setDate(morgen.getDate() + 1);
    morgen.setHours(9, 0, 0, 0);
    const startDatum = morgen.toISOString().replace("Z", "");

    const eindeUur = new Date(morgen);
    eindeUur.setMinutes(30);
    const eindDatum = eindeUur.toISOString().replace("Z", "");

    const [nieuw] = await db
      .insert(agendaItems)
      .values({
        gebruikerId: gebruiker.id,
        titel: `Lees: ${item.titel}`,
        omschrijving: `Learning Radar item: ${item.url}`,
        type: "herinnering",
        startDatum,
        eindDatum,
        heleDag: 0,
        herinneringMinuten: 15,
      })
      .returning();

    // Google Calendar sync (fire-and-forget)
    pushEventToGoogle(gebruiker.id, {
      summary: `Lees: ${item.titel}`,
      description: `Learning Radar item: ${item.url}`,
      start: startDatum,
      end: eindDatum,
      allDay: false,
    })
      .then(async (event) => {
        if (event?.id) {
          await db
            .update(agendaItems)
            .set({ googleEventId: event.id })
            .where(eq(agendaItems.id, nieuw.id))
            .execute();
        }
      })
      .catch(() => {
        // Google sync failed silently
      });

    return NextResponse.json({ succes: true, agendaItemId: nieuw.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
