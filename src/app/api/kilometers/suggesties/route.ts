import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, klanten, googleTokens } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedClient } from "@/lib/google-calendar";
import { berekenAfstand } from "@/lib/google-maps";
import { google } from "googleapis";

export async function GET(_req: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    // Check if Google Calendar is connected
    const tokens = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.gebruikerId, gebruiker.id))
      .get();

    if (!tokens) {
      return NextResponse.json({ suggesties: [] });
    }

    const auth = await getAuthenticatedClient(gebruiker.id);
    if (!auth) {
      return NextResponse.json({ suggesties: [] });
    }

    const calendar = google.calendar({ version: "v3", auth });
    const vandaag = new Date();
    const startVanDag = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    const eindVanDag = new Date(startVanDag.getTime() + 24 * 60 * 60 * 1000);

    const events = await calendar.events.list({
      calendarId: "primary",
      timeMin: startVanDag.toISOString(),
      timeMax: eindVanDag.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = events.data.items ?? [];
    const eventsMetLocatie = items.filter((e) => e.location?.trim());

    if (eventsMetLocatie.length === 0) {
      return NextResponse.json({ suggesties: [] });
    }

    // Get today's logged trips
    const vandaagStr = vandaag.toISOString().slice(0, 10);
    const bestaandeRitten = await db
      .select()
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          eq(kilometerRegistraties.datum, vandaagStr)
        )
      )
      .all();

    const gelogdeLocaties = new Set(
      bestaandeRitten.flatMap((r) => [r.vanLocatie.toLowerCase(), r.naarLocatie.toLowerCase()])
    );

    // Get all active klanten for auto-matching (klanten uses bedrijfsnaam, not naam)
    const alleKlanten = await db
      .select()
      .from(klanten)
      .where(eq(klanten.isActief, 1))
      .all();

    const suggesties = [];

    for (const event of eventsMetLocatie) {
      const locatie = event.location!.trim();
      if (gelogdeLocaties.has(locatie.toLowerCase())) continue;

      // Try to match with a klant by bedrijfsnaam
      let klantId: number | null = null;
      let klantNaam: string | null = null;
      for (const k of alleKlanten) {
        if (
          locatie.toLowerCase().includes(k.bedrijfsnaam.toLowerCase()) ||
          k.bedrijfsnaam.toLowerCase().includes(locatie.toLowerCase().split(",")[0])
        ) {
          klantId = k.id;
          klantNaam = k.bedrijfsnaam;
          break;
        }
      }

      // Calculate distance (best effort)
      let afstandKm: number | null = null;
      const afstand = await berekenAfstand("Autronis, Eindhoven", locatie);
      if (afstand) afstandKm = afstand.afstandKm;

      suggesties.push({
        eventId: event.id,
        titel: event.summary ?? "Geen titel",
        locatie,
        startTijd: event.start?.dateTime ?? event.start?.date ?? "",
        afstandKm,
        klantId,
        klantNaam,
      });
    }

    return NextResponse.json({ suggesties });
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
