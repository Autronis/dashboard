import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificaties, taken, agendaItems } from "@/lib/db/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";

// GET /api/notifications/pending — ongelezen notificaties + deadline alerts
// Gebruikt door de Tauri desktop app voor native notificaties
export async function GET() {
  try {
    const vandaag = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const results: { title: string; body: string }[] = [];

    // 1. Ongelezen notificaties
    const ongelezen = await db
      .select({ titel: notificaties.titel, omschrijving: notificaties.omschrijving })
      .from(notificaties)
      .where(eq(notificaties.gelezen, 0))
      .limit(5);

    for (const n of ongelezen) {
      results.push({ title: n.titel, body: n.omschrijving ?? "" });
    }

    // 2. Taken met deadline vandaag of morgen
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

    // 3. Agenda items die binnen 30 minuten beginnen
    const nu = new Date();
    const over30min = new Date(nu.getTime() + 30 * 60_000).toISOString();
    const nuStr = nu.toISOString();

    const aankomend = await db
      .select({ titel: agendaItems.titel, startDatum: agendaItems.startDatum })
      .from(agendaItems)
      .where(
        and(
          gte(agendaItems.startDatum, nuStr),
          lte(agendaItems.startDatum, over30min)
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

    // Mark notificaties as gelezen after sending
    if (ongelezen.length > 0) {
      await db
        .update(notificaties)
        .set({ gelezen: 1 })
        .where(eq(notificaties.gelezen, 0));
    }

    return NextResponse.json({ notifications: results });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}
