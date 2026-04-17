import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems, notificaties } from "@/lib/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { sendPushToUser } from "@/lib/push";

// GET /api/cron/agenda-herinnering
// Triggert elke ~5 min (via n8n of GitHub Actions). Stuurt push notificatie
// 10 min voor een agenda item start. Dedup via de notificaties tabel (link
// veld bevat agenda:<id> zodat we niet dubbel sturen).
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ fout: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const vanaf = new Date(now.getTime() + 9 * 60 * 1000).toISOString();
  const tot = new Date(now.getTime() + 11 * 60 * 1000).toISOString();

  const items = await db
    .select({
      id: agendaItems.id,
      gebruikerId: agendaItems.gebruikerId,
      titel: agendaItems.titel,
      startDatum: agendaItems.startDatum,
      heleDag: agendaItems.heleDag,
    })
    .from(agendaItems)
    .where(
      and(
        gte(agendaItems.startDatum, vanaf),
        lte(agendaItems.startDatum, tot),
        eq(agendaItems.heleDag, 0)
      )
    );

  const resultaten: { id: number; gestuurd: number; skipped: string | null }[] = [];

  for (const item of items) {
    if (!item.gebruikerId) {
      resultaten.push({ id: item.id, gestuurd: 0, skipped: "geen gebruiker" });
      continue;
    }

    const dedupLink = `/agenda?reminder=${item.id}`;

    const existing = await db
      .select({ id: notificaties.id })
      .from(notificaties)
      .where(
        and(
          eq(notificaties.gebruikerId, item.gebruikerId),
          eq(notificaties.link, dedupLink)
        )
      )
      .get();

    if (existing) {
      resultaten.push({ id: item.id, gestuurd: 0, skipped: "al verstuurd" });
      continue;
    }

    const startDate = new Date(item.startDatum);
    const tijdStr = startDate.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    });
    const titel = `Over 10 min: ${item.titel || "Agenda item"}`;
    const omschrijving = `Start om ${tijdStr}`;

    try {
      const sent = await sendPushToUser(item.gebruikerId, {
        titel,
        bericht: omschrijving,
        url: "/agenda",
        tag: `agenda-${item.id}`,
      });

      await db.insert(notificaties).values({
        gebruikerId: item.gebruikerId,
        type: "deadline_nadert",
        titel,
        omschrijving,
        link: dedupLink,
        gelezen: 0,
      });

      resultaten.push({ id: item.id, gestuurd: sent, skipped: null });
    } catch (e) {
      resultaten.push({
        id: item.id,
        gestuurd: 0,
        skipped: e instanceof Error ? e.message : "push fout",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    gecheckt: items.length,
    resultaten,
  });
}
