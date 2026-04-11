import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  followUpRegels, followUpLog, followUpTemplates,
  klanten, leads, meetings, notities, leadActiviteiten, offertes,
} from "@/lib/db/schema";
import { Resend } from "resend";
import { eq, and, max, desc } from "drizzle-orm";

// GET /api/followup/cron — Vercel Cron: dagelijkse follow-up check + e-mail versturen
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }

    const vandaag = new Date();
    const results = { gecontroleerd: 0, getriggerd: 0, verstuurd: 0, mislukt: 0, fouten: [] as string[] };

    // Get active rules with templates
    const regels = await db
      .select()
      .from(followUpRegels)
      .where(eq(followUpRegels.isActief, 1));

    if (regels.length === 0) {
      return NextResponse.json({ ...results, bericht: "Geen actieve regels." });
    }

    // Load templates
    const templateRows = await db.select().from(followUpTemplates).where(eq(followUpTemplates.isActief, 1));
    const templateMap = new Map(templateRows.map((t) => [t.id, t]));

    // ---- DATA OPHALEN ----

    const alleKlanten = await db
      .select({ id: klanten.id, naam: klanten.bedrijfsnaam, contactpersoon: klanten.contactpersoon, email: klanten.email })
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

    const alleLeads = await db
      .select({ id: leads.id, naam: leads.bedrijfsnaam, contactpersoon: leads.contactpersoon, email: leads.email, status: leads.status })
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

    const openOffertes = await db
      .select({ id: offertes.id, klantId: offertes.klantId, datum: offertes.datum, geldigTot: offertes.geldigTot })
      .from(offertes)
      .where(and(eq(offertes.isActief, 1), eq(offertes.status, "verzonden")));

    // Recent logs (dedup within 3 days)
    const recentLogs = await db
      .select({ contactType: followUpLog.contactType, contactId: followUpLog.contactId, regelId: followUpLog.regelId, aangemaaktOp: followUpLog.aangemaaktOp })
      .from(followUpLog)
      .where(eq(followUpLog.status, "verstuurd"))
      .orderBy(desc(followUpLog.aangemaaktOp));

    const recentLogSet = new Set(
      recentLogs
        .filter((l) => {
          const diffDagen = Math.floor((vandaag.getTime() - new Date(l.aangemaaktOp!).getTime()) / 86400000);
          return diffDagen < 3;
        })
        .map((l) => `${l.regelId}-${l.contactType}-${l.contactId}`)
    );

    results.gecontroleerd = klantContactDagen.length + leadContactDagen.length;

    // ---- REGELS EVALUEREN + VERSTUREN ----

    interface Trigger {
      regelId: number;
      contactType: "klant" | "lead";
      contactId: number;
      contactNaam: string;
      contactpersoon: string | null;
      email: string | null;
      dagenGeleden: number;
      offerteId: number | null;
      templateId: number | null;
    }

    const triggers: Trigger[] = [];

    for (const regel of regels) {
      const isDuplicate = (type: "klant" | "lead", id: number) =>
        recentLogSet.has(`${regel.id}-${type}-${id}`);

      if (regel.type === "geen_contact") {
        if (regel.doelgroep === "klanten" || regel.doelgroep === "beide") {
          for (const k of klantContactDagen) {
            if (k.dagenGeleden >= regel.dagenDrempel && !isDuplicate("klant", k.id)) {
              triggers.push({ regelId: regel.id, contactType: "klant", contactId: k.id, contactNaam: k.naam, contactpersoon: k.contactpersoon, email: k.email, dagenGeleden: k.dagenGeleden, offerteId: null, templateId: regel.templateId });
            }
          }
        }
        if (regel.doelgroep === "leads" || regel.doelgroep === "beide") {
          for (const l of leadContactDagen) {
            if (l.dagenGeleden >= regel.dagenDrempel && !isDuplicate("lead", l.id)) {
              triggers.push({ regelId: regel.id, contactType: "lead", contactId: l.id, contactNaam: l.naam, contactpersoon: l.contactpersoon, email: l.email, dagenGeleden: l.dagenGeleden, offerteId: null, templateId: regel.templateId });
            }
          }
        }
      }

      if (regel.type === "offerte_niet_beantwoord") {
        for (const o of openOffertes) {
          if (!o.datum || !o.klantId) continue;
          const dagenSinds = Math.floor((vandaag.getTime() - new Date(o.datum).getTime()) / 86400000);
          if (dagenSinds >= regel.dagenDrempel && !isDuplicate("klant", o.klantId)) {
            const klant = alleKlanten.find((k) => k.id === o.klantId);
            triggers.push({ regelId: regel.id, contactType: "klant", contactId: o.klantId, contactNaam: klant?.naam ?? "Onbekend", contactpersoon: klant?.contactpersoon ?? null, email: klant?.email ?? null, dagenGeleden: dagenSinds, offerteId: o.id, templateId: regel.templateId });
          }
        }
      }

      if (regel.type === "offerte_vervalt") {
        for (const o of openOffertes) {
          if (!o.geldigTot || !o.klantId) continue;
          const dagenTot = Math.floor((new Date(o.geldigTot).getTime() - vandaag.getTime()) / 86400000);
          if (dagenTot <= regel.dagenDrempel && dagenTot >= 0 && !isDuplicate("klant", o.klantId)) {
            const klant = alleKlanten.find((k) => k.id === o.klantId);
            triggers.push({ regelId: regel.id, contactType: "klant", contactId: o.klantId, contactNaam: klant?.naam ?? "Onbekend", contactpersoon: klant?.contactpersoon ?? null, email: klant?.email ?? null, dagenGeleden: dagenTot, offerteId: o.id, templateId: regel.templateId });
          }
        }
      }
    }

    results.getriggerd = triggers.length;

    // ---- VERSTUREN ----

    const fromEmail = process.env.SES_FROM_EMAIL || "sem@autronis.nl";
    const fromName = process.env.SES_FROM_NAME || "Sem van Autronis";

    for (const trigger of triggers) {
      const template = trigger.templateId ? templateMap.get(trigger.templateId) : null;

      // Log the trigger
      const [logEntry] = await db.insert(followUpLog).values({
        regelId: trigger.regelId,
        templateId: trigger.templateId,
        contactType: trigger.contactType,
        contactId: trigger.contactId,
        offerteId: trigger.offerteId,
        status: "getriggerd",
        dagenGeleden: trigger.dagenGeleden,
        emailVerstuurd: trigger.email,
      }).returning();

      // Skip if no email or no template
      if (!trigger.email || !template) {
        await db.update(followUpLog).set({ status: "overgeslagen", notitie: !trigger.email ? "Geen e-mailadres" : "Geen template gekoppeld" }).where(eq(followUpLog.id, logEntry.id));
        continue;
      }

      // Replace template variables
      const naam = trigger.contactpersoon || trigger.contactNaam;
      const replacements: Record<string, string> = {
        "{{naam}}": naam,
        "{{bedrijf}}": trigger.contactNaam,
        "{{dagen}}": String(trigger.dagenGeleden),
      };

      let onderwerp = template.onderwerp;
      let inhoud = template.inhoud;
      for (const [key, value] of Object.entries(replacements)) {
        onderwerp = onderwerp.replaceAll(key, value);
        inhoud = inhoud.replaceAll(key, value);
      }

      // Convert plain text to simple HTML
      const htmlBody = inhoud.includes("<") ? inhoud : `<div style="font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">${inhoud.replace(/\n/g, "<br>")}</div>`;

      try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error("RESEND_API_KEY niet geconfigureerd");
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: trigger.email,
          subject: onderwerp,
          html: htmlBody,
          replyTo: fromEmail,
        });

        await db.update(followUpLog).set({
          status: "verstuurd",
          verstuurdOp: new Date().toISOString(),
        }).where(eq(followUpLog.id, logEntry.id));

        results.verstuurd++;
      } catch (err) {
        const foutmelding = err instanceof Error ? err.message : "Onbekende fout";
        await db.update(followUpLog).set({
          status: "mislukt",
          foutmelding,
        }).where(eq(followUpLog.id, logEntry.id));

        results.mislukt++;
        results.fouten.push(`${trigger.contactNaam}: ${foutmelding}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: 500 }
    );
  }
}
