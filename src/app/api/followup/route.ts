import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, leads, notities, meetings, leadActiviteiten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, max } from "drizzle-orm";

// GET /api/followup — computes last_contact per klant and lead
export async function GET() {
  try {
    await requireAuth();

    const vandaag = new Date();

    // --- KLANTEN ---
    const alleKlanten = await db
      .select({ id: klanten.id, naam: klanten.bedrijfsnaam, contactpersoon: klanten.contactpersoon, email: klanten.email })
      .from(klanten)
      .where(eq(klanten.isActief, 1));

    // Last meeting per klant
    const klantMeetings = await db
      .select({ klantId: meetings.klantId, lastDate: max(meetings.datum) })
      .from(meetings)
      .groupBy(meetings.klantId);

    // Last notitie per klant
    const klantNotities = await db
      .select({ klantId: notities.klantId, lastDate: max(notities.aangemaaktOp) })
      .from(notities)
      .where(eq(notities.klantId, notities.klantId))
      .groupBy(notities.klantId);

    const meetingMap = new Map(klantMeetings.map((m) => [m.klantId, m.lastDate]));
    const notitieMap = new Map(klantNotities.map((n) => [n.klantId, n.lastDate]));

    const klantResult = alleKlanten.map((k) => {
      const dates = [meetingMap.get(k.id), notitieMap.get(k.id)].filter(Boolean) as string[];
      const lastContact = dates.length > 0 ? dates.sort().reverse()[0] : null;
      const dagenGeleden = lastContact
        ? Math.floor((vandaag.getTime() - new Date(lastContact).getTime()) / 86400000)
        : 999;
      return { ...k, type: "klant" as const, lastContact, dagenGeleden };
    });

    // --- LEADS ---
    const alleLeads = await db
      .select({ id: leads.id, naam: leads.bedrijfsnaam, contactpersoon: leads.contactpersoon, email: leads.email, status: leads.status, volgendeActieDatum: leads.volgendeActieDatum })
      .from(leads)
      .where(eq(leads.isActief, 1));

    // Last activity per lead
    const leadActivs = await db
      .select({ leadId: leadActiviteiten.leadId, lastDate: max(leadActiviteiten.aangemaaktOp) })
      .from(leadActiviteiten)
      .groupBy(leadActiviteiten.leadId);

    const leadActivMap = new Map(leadActivs.map((a) => [a.leadId, a.lastDate]));

    const leadResult = alleLeads
      .filter((l) => l.status !== "gewonnen" && l.status !== "verloren")
      .map((l) => {
        const lastContact = leadActivMap.get(l.id) ?? l.volgendeActieDatum ?? null;
        const dagenGeleden = lastContact
          ? Math.floor((vandaag.getTime() - new Date(lastContact).getTime()) / 86400000)
          : 999;
        return { ...l, type: "lead" as const, lastContact, dagenGeleden };
      });

    // Combine + sort by urgency
    const all = [...klantResult, ...leadResult].sort((a, b) => b.dagenGeleden - a.dagenGeleden);

    // Buckets
    const danger = all.filter((c) => c.dagenGeleden > (c.type === "klant" ? 30 : 14));
    const warning = all.filter((c) => {
      const grens = c.type === "klant" ? 30 : 14;
      const warn = c.type === "klant" ? 21 : 7;
      return c.dagenGeleden > warn && c.dagenGeleden <= grens;
    });
    const ok = all.filter((c) => c.dagenGeleden <= (c.type === "klant" ? 21 : 7));

    return NextResponse.json({ danger, warning, ok, totaal: all.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
