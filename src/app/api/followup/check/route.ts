import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  followUpRegels, followUpLog, followUpTemplates,
  klanten, leads, meetings, notities, leadActiviteiten, offertes,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, or, max, desc } from "drizzle-orm";

interface TriggerResult {
  regelId: number;
  regelNaam: string;
  contactType: "klant" | "lead";
  contactId: number;
  contactNaam: string;
  email: string | null;
  dagenGeleden: number;
  offerteId: number | null;
  templateId: number | null;
}

// POST /api/followup/check — scan all contacts against active rules, log triggers
export async function POST() {
  try {
    await requireAuth();

    const vandaag = new Date();
    const triggers: TriggerResult[] = [];

    // Get active rules
    const regels = await db
      .select()
      .from(followUpRegels)
      .where(eq(followUpRegels.isActief, 1));

    if (regels.length === 0) {
      return NextResponse.json({ triggers: [], message: "Geen actieve regels." });
    }

    // ---- DATA OPHALEN ----

    // Klanten + laatste contact
    const alleKlanten = await db
      .select({ id: klanten.id, naam: klanten.bedrijfsnaam, email: klanten.email })
      .from(klanten)
      .where(eq(klanten.isActief, 1));

    const klantMeetings = await db
      .select({ klantId: meetings.klantId, lastDate: max(meetings.datum) })
      .from(meetings)
      .groupBy(meetings.klantId);

    const klantNotities = await db
      .select({ klantId: notities.klantId, lastDate: max(notities.aangemaaktOp) })
      .from(notities)
      .groupBy(notities.klantId);

    const meetingMap = new Map(klantMeetings.map((m) => [m.klantId, m.lastDate]));
    const notitieMap = new Map(klantNotities.map((n) => [n.klantId, n.lastDate]));

    const klantContactDagen = alleKlanten.map((k) => {
      const dates = [meetingMap.get(k.id), notitieMap.get(k.id)].filter(Boolean) as string[];
      const lastContact = dates.length > 0 ? dates.sort().reverse()[0] : null;
      const dagenGeleden = lastContact
        ? Math.floor((vandaag.getTime() - new Date(lastContact).getTime()) / 86400000)
        : 999;
      return { ...k, dagenGeleden };
    });

    // Leads + laatste activiteit
    const alleLeads = await db
      .select({ id: leads.id, naam: leads.bedrijfsnaam, email: leads.email, status: leads.status })
      .from(leads)
      .where(eq(leads.isActief, 1));

    const leadActivs = await db
      .select({ leadId: leadActiviteiten.leadId, lastDate: max(leadActiviteiten.aangemaaktOp) })
      .from(leadActiviteiten)
      .groupBy(leadActiviteiten.leadId);

    const leadActivMap = new Map(leadActivs.map((a) => [a.leadId, a.lastDate]));

    const leadContactDagen = alleLeads
      .filter((l) => l.status !== "gewonnen" && l.status !== "verloren")
      .map((l) => {
        const lastContact = leadActivMap.get(l.id) ?? null;
        const dagenGeleden = lastContact
          ? Math.floor((vandaag.getTime() - new Date(lastContact).getTime()) / 86400000)
          : 999;
        return { ...l, dagenGeleden };
      });

    // Onbeantwoorde offertes
    const openOffertes = await db
      .select({
        id: offertes.id,
        klantId: offertes.klantId,
        datum: offertes.datum,
        geldigTot: offertes.geldigTot,
        status: offertes.status,
      })
      .from(offertes)
      .where(and(
        eq(offertes.isActief, 1),
        eq(offertes.status, "verzonden"),
      ));

    // Recent follow-up log (avoid duplicates within 3 days)
    const recentLogs = await db
      .select({
        contactType: followUpLog.contactType,
        contactId: followUpLog.contactId,
        regelId: followUpLog.regelId,
        aangemaaktOp: followUpLog.aangemaaktOp,
      })
      .from(followUpLog)
      .where(eq(followUpLog.status, "verstuurd"))
      .orderBy(desc(followUpLog.aangemaaktOp));

    const recentLogSet = new Set(
      recentLogs
        .filter((l) => {
          const logDate = new Date(l.aangemaaktOp!);
          const diffDagen = Math.floor((vandaag.getTime() - logDate.getTime()) / 86400000);
          return diffDagen < 3;
        })
        .map((l) => `${l.regelId}-${l.contactType}-${l.contactId}`)
    );

    // ---- REGELS EVALUEREN ----

    for (const regel of regels) {
      const isDuplicate = (type: "klant" | "lead", id: number) =>
        recentLogSet.has(`${regel.id}-${type}-${id}`);

      if (regel.type === "geen_contact") {
        // Klanten check
        if (regel.doelgroep === "klanten" || regel.doelgroep === "beide") {
          for (const k of klantContactDagen) {
            if (k.dagenGeleden >= regel.dagenDrempel && !isDuplicate("klant", k.id)) {
              triggers.push({
                regelId: regel.id,
                regelNaam: regel.naam,
                contactType: "klant",
                contactId: k.id,
                contactNaam: k.naam,
                email: k.email,
                dagenGeleden: k.dagenGeleden,
                offerteId: null,
                templateId: regel.templateId,
              });
            }
          }
        }
        // Leads check
        if (regel.doelgroep === "leads" || regel.doelgroep === "beide") {
          for (const l of leadContactDagen) {
            if (l.dagenGeleden >= regel.dagenDrempel && !isDuplicate("lead", l.id)) {
              triggers.push({
                regelId: regel.id,
                regelNaam: regel.naam,
                contactType: "lead",
                contactId: l.id,
                contactNaam: l.naam,
                email: l.email,
                dagenGeleden: l.dagenGeleden,
                offerteId: null,
                templateId: regel.templateId,
              });
            }
          }
        }
      }

      if (regel.type === "offerte_niet_beantwoord") {
        for (const o of openOffertes) {
          if (!o.datum || !o.klantId) continue;
          const dagenSindsVerzonden = Math.floor(
            (vandaag.getTime() - new Date(o.datum).getTime()) / 86400000
          );
          if (dagenSindsVerzonden >= regel.dagenDrempel && !isDuplicate("klant", o.klantId)) {
            const klant = alleKlanten.find((k) => k.id === o.klantId);
            triggers.push({
              regelId: regel.id,
              regelNaam: regel.naam,
              contactType: "klant",
              contactId: o.klantId,
              contactNaam: klant?.naam ?? "Onbekend",
              email: klant?.email ?? null,
              dagenGeleden: dagenSindsVerzonden,
              offerteId: o.id,
              templateId: regel.templateId,
            });
          }
        }
      }

      if (regel.type === "offerte_vervalt") {
        for (const o of openOffertes) {
          if (!o.geldigTot || !o.klantId) continue;
          const dagenTotVervallen = Math.floor(
            (new Date(o.geldigTot).getTime() - vandaag.getTime()) / 86400000
          );
          if (dagenTotVervallen <= regel.dagenDrempel && dagenTotVervallen >= 0 && !isDuplicate("klant", o.klantId)) {
            const klant = alleKlanten.find((k) => k.id === o.klantId);
            triggers.push({
              regelId: regel.id,
              regelNaam: regel.naam,
              contactType: "klant",
              contactId: o.klantId,
              contactNaam: klant?.naam ?? "Onbekend",
              email: klant?.email ?? null,
              dagenGeleden: dagenTotVervallen,
              offerteId: o.id,
              templateId: regel.templateId,
            });
          }
        }
      }
    }

    // Log all triggers
    if (triggers.length > 0) {
      await db.insert(followUpLog).values(
        triggers.map((t) => ({
          regelId: t.regelId,
          templateId: t.templateId,
          contactType: t.contactType,
          contactId: t.contactId,
          offerteId: t.offerteId,
          status: "getriggerd" as const,
          dagenGeleden: t.dagenGeleden,
          emailVerstuurd: t.email,
        }))
      );
    }

    return NextResponse.json({
      triggers,
      totaal: triggers.length,
      gecontroleerd: {
        klanten: klantContactDagen.length,
        leads: leadContactDagen.length,
        offertes: openOffertes.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
