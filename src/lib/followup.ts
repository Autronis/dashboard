import { db } from "@/lib/db";
import { klanten, leads, meetings, notities, leadActiviteiten } from "@/lib/db/schema";
import { and, eq, max, ne, sql } from "drizzle-orm";

export interface ContactRow {
  id: number;
  naam: string;
  contactpersoon: string | null;
  email: string | null;
  type: "klant" | "lead";
  status?: string;
  lastContact: string | null;
  dagenGeleden: number;
}

const MS_PER_DAG = 86400000;
const NOOIT = 999;

function dagenSinds(dateStr: string | null | undefined, nu: Date): number {
  if (!dateStr) return NOOIT;
  return Math.floor((nu.getTime() - new Date(dateStr).getTime()) / MS_PER_DAG);
}

export async function getKlantContactDagen(nu: Date = new Date()): Promise<ContactRow[]> {
  const rows = await db
    .select({
      id: klanten.id,
      naam: klanten.bedrijfsnaam,
      contactpersoon: klanten.contactpersoon,
      email: klanten.email,
    })
    .from(klanten)
    .where(
      and(
        eq(klanten.isActief, 1),
        sql`LOWER(${klanten.bedrijfsnaam}) NOT LIKE '%autronis%'`,
      ),
    );

  const mtg = await db
    .select({ klantId: meetings.klantId, lastDate: max(meetings.datum) })
    .from(meetings)
    .groupBy(meetings.klantId);
  const nt = await db
    .select({ klantId: notities.klantId, lastDate: max(notities.aangemaaktOp) })
    .from(notities)
    .groupBy(notities.klantId);

  const meetingMap = new Map(mtg.map((m) => [m.klantId, m.lastDate]));
  const notitieMap = new Map(nt.map((n) => [n.klantId, n.lastDate]));

  return rows.map((k) => {
    const dates = [meetingMap.get(k.id), notitieMap.get(k.id)].filter(Boolean) as string[];
    const lastContact = dates.length > 0 ? dates.sort().reverse()[0] : null;
    return {
      ...k,
      type: "klant" as const,
      lastContact,
      dagenGeleden: dagenSinds(lastContact, nu),
    };
  });
}

export async function getLeadContactDagen(nu: Date = new Date()): Promise<ContactRow[]> {
  const rows = await db
    .select({
      id: leads.id,
      naam: leads.bedrijfsnaam,
      contactpersoon: leads.contactpersoon,
      email: leads.email,
      status: leads.status,
      volgendeActieDatum: leads.volgendeActieDatum,
    })
    .from(leads)
    .where(
      and(
        eq(leads.isActief, 1),
        ne(leads.status, "gewonnen"),
        ne(leads.status, "verloren"),
      ),
    );

  const la = await db
    .select({ leadId: leadActiviteiten.leadId, lastDate: max(leadActiviteiten.aangemaaktOp) })
    .from(leadActiviteiten)
    .groupBy(leadActiviteiten.leadId);
  const leadActivMap = new Map(la.map((a) => [a.leadId, a.lastDate]));

  return rows.map((l) => {
    const lastContact = leadActivMap.get(l.id) ?? l.volgendeActieDatum ?? null;
    return {
      id: l.id,
      naam: l.naam,
      contactpersoon: l.contactpersoon,
      email: l.email,
      status: l.status,
      type: "lead" as const,
      lastContact,
      dagenGeleden: dagenSinds(lastContact, nu),
    };
  });
}

export function urgencyBucket(c: ContactRow): "nooit" | "danger" | "warning" | "ok" {
  if (c.dagenGeleden >= NOOIT) return "nooit";
  const grens = c.type === "klant" ? 30 : 14;
  const warn = c.type === "klant" ? 21 : 7;
  if (c.dagenGeleden > grens) return "danger";
  if (c.dagenGeleden > warn) return "warning";
  return "ok";
}
