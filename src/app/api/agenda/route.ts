import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte } from "drizzle-orm";
import { pushEventToGoogle } from "@/lib/google-calendar";

// GET /api/agenda?van=2026-03-01&tot=2026-03-31
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    const conditions = [];
    if (van) conditions.push(gte(agendaItems.startDatum, van));
    if (tot) conditions.push(lte(agendaItems.startDatum, tot + "T23:59:59"));

    const items = await db
      .select({
        id: agendaItems.id,
        gebruikerId: agendaItems.gebruikerId,
        gebruikerNaam: gebruikers.naam,
        titel: agendaItems.titel,
        omschrijving: agendaItems.omschrijving,
        type: agendaItems.type,
        startDatum: agendaItems.startDatum,
        eindDatum: agendaItems.eindDatum,
        heleDag: agendaItems.heleDag,
        herinneringMinuten: agendaItems.herinneringMinuten,
      })
      .from(agendaItems)
      .leftJoin(gebruikers, eq(agendaItems.gebruikerId, gebruikers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(agendaItems.startDatum);

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/agenda
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    if (!body.titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }
    if (!body.startDatum) {
      return NextResponse.json({ fout: "Startdatum is verplicht." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(agendaItems)
      .values({
        gebruikerId: gebruiker.id,
        titel: body.titel.trim(),
        omschrijving: body.omschrijving?.trim() || null,
        type: body.type || "afspraak",
        startDatum: body.startDatum,
        eindDatum: body.eindDatum || null,
        heleDag: body.heleDag ? 1 : 0,
        herinneringMinuten: body.herinneringMinuten ?? null,
      })
      .returning();

    // Push to Google Calendar (fire-and-forget)
    pushEventToGoogle(gebruiker.id, {
      summary: body.titel.trim(),
      description: body.omschrijving?.trim(),
      start: body.startDatum,
      end: body.eindDatum || undefined,
      allDay: !!body.heleDag,
    })
      .then((event) => {
        if (event?.id) {
          db.update(agendaItems)
            .set({ googleEventId: event.id })
            .where(eq(agendaItems.id, nieuw.id))
            .execute();
        }
      })
      .catch(() => {
        // Google sync failed silently — item is still saved locally
      });

    return NextResponse.json({ item: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
