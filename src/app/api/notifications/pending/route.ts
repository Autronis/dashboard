import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificaties, taken, agendaItems } from "@/lib/db/schema";
import { eq, and, lte, gte, sql, inArray, isNull, or } from "drizzle-orm";

// GET /api/notifications/pending — ongelezen notificaties + deadline alerts
// Gebruikt door de Tauri desktop app voor native notificaties
//
// Dedup strategie (voorkomt spammen omdat de desktop app dit endpoint in een loop poll):
// - Ongelezen notificaties: gemarkeerd als gelezen na verzending.
// - Agenda items binnen 30 min: exact 1x per item via agendaItems.herinneringVerstuurdOp,
//   met een "unlock na 4 uur" escape hatch voor het geval iets misgaat.
const REMINDER_THROTTLE_HOURS = 4;

export async function GET() {
  try {
    const vandaag = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const nu = new Date();
    const nuStr = nu.toISOString();
    const throttleGrens = new Date(
      nu.getTime() - REMINDER_THROTTLE_HOURS * 60 * 60_000
    ).toISOString();
    const results: { title: string; body: string }[] = [];

    // 1. Ongelezen in-app notificaties
    const ongelezen = await db
      .select({
        id: notificaties.id,
        titel: notificaties.titel,
        omschrijving: notificaties.omschrijving,
      })
      .from(notificaties)
      .where(eq(notificaties.gelezen, 0))
      .limit(5);

    for (const n of ongelezen) {
      results.push({ title: n.titel, body: n.omschrijving ?? "" });
    }

    // 2. Taken met deadline vandaag of morgen (geen extra dedup — vaak geen issue in de praktijk)
    const urgenteTaken = await db
      .select({ titel: taken.titel, deadline: taken.deadline })
      .from(taken)
      .where(
        and(
          lte(taken.deadline, morgen),
          gte(taken.deadline, vandaag),
          sql`${taken.status} != 'afgerond'`
        )
      )
      .limit(5);

    for (const t of urgenteTaken) {
      const isVandaag = t.deadline === vandaag;
      results.push({
        title: isVandaag ? "Deadline vandaag" : "Deadline morgen",
        body: t.titel,
      });
    }

    // 3. Agenda items die binnen 30 min starten EN nog geen herinnering kregen
    const over30min = new Date(nu.getTime() + 30 * 60_000).toISOString();

    const aankomend = await db
      .select({
        id: agendaItems.id,
        titel: agendaItems.titel,
        startDatum: agendaItems.startDatum,
      })
      .from(agendaItems)
      .where(
        and(
          gte(agendaItems.startDatum, nuStr),
          lte(agendaItems.startDatum, over30min),
          // Eenmalig per item, of opnieuw als de vorige >4u geleden was
          or(
            isNull(agendaItems.herinneringVerstuurdOp),
            lte(agendaItems.herinneringVerstuurdOp, throttleGrens)
          )
        )
      )
      .limit(3);

    for (const a of aankomend) {
      const tijd = new Date(a.startDatum).toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      });
      results.push({
        title: `Afspraak om ${tijd}`,
        body: a.titel,
      });
    }

    // Markeer agenda items als herinnerd (voorkomt dat volgende poll dezelfde item teruggeeft)
    if (aankomend.length > 0) {
      await db
        .update(agendaItems)
        .set({ herinneringVerstuurdOp: nuStr })
        .where(
          inArray(
            agendaItems.id,
            aankomend.map((a) => a.id)
          )
        );
    }

    // Mark ongelezen notificaties as gelezen na verzending (alleen degene die we stuurden)
    if (ongelezen.length > 0) {
      await db
        .update(notificaties)
        .set({ gelezen: 1 })
        .where(
          inArray(
            notificaties.id,
            ongelezen.map((n) => n.id)
          )
        );
    }

    return NextResponse.json({ notifications: results });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}
