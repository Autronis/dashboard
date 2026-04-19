import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { followUpRegels, followUpLog, klanten, offertes } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getKlantContactDagen, getLeadContactDagen } from "@/lib/followup";

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

// POST /api/followup/check — dry-run: scan contacten tegen actieve regels en log triggers (verstuurt NIET).
export async function POST() {
  try {
    await requireAuth();

    const nu = new Date();
    const triggers: TriggerResult[] = [];

    const regels = await db
      .select()
      .from(followUpRegels)
      .where(eq(followUpRegels.isActief, 1));

    if (regels.length === 0) {
      return NextResponse.json({ triggers: [], totaal: 0, gecontroleerd: { klanten: 0, leads: 0, offertes: 0 } });
    }

    const [klantContactDagen, leadContactDagen] = await Promise.all([
      getKlantContactDagen(nu),
      getLeadContactDagen(nu),
    ]);

    // Klant map voor offerte-triggers (incl. eigen bedrijf want offertes kunnen daar niet op staan — filter zit al in getKlantContactDagen)
    const klantById = new Map(klantContactDagen.map((k) => [k.id, k]));

    const openOffertes = await db
      .select({ id: offertes.id, klantId: offertes.klantId, datum: offertes.datum, geldigTot: offertes.geldigTot })
      .from(offertes)
      .where(and(eq(offertes.isActief, 1), eq(offertes.status, "verzonden")));

    // Dedup: zelfde (regel, contact) niet opnieuw binnen 3 dagen — óók als status=overgeslagen,
    // anders blijven contacten zonder template elke dag opnieuw loggen.
    const recentLogs = await db
      .select({
        contactType: followUpLog.contactType,
        contactId: followUpLog.contactId,
        regelId: followUpLog.regelId,
        aangemaaktOp: followUpLog.aangemaaktOp,
      })
      .from(followUpLog)
      .where(inArray(followUpLog.status, ["verstuurd", "overgeslagen", "getriggerd"]))
      .orderBy(desc(followUpLog.aangemaaktOp));

    const recentLogSet = new Set(
      recentLogs
        .filter((l) => {
          const diffDagen = Math.floor((nu.getTime() - new Date(l.aangemaaktOp!).getTime()) / 86400000);
          return diffDagen < 3;
        })
        .map((l) => `${l.regelId}-${l.contactType}-${l.contactId}`)
    );

    for (const regel of regels) {
      const isDuplicate = (type: "klant" | "lead", id: number) =>
        recentLogSet.has(`${regel.id}-${type}-${id}`);

      if (regel.type === "geen_contact") {
        if (regel.doelgroep === "klanten" || regel.doelgroep === "beide") {
          for (const k of klantContactDagen) {
            if (k.dagenGeleden >= regel.dagenDrempel && !isDuplicate("klant", k.id)) {
              triggers.push({
                regelId: regel.id, regelNaam: regel.naam, contactType: "klant",
                contactId: k.id, contactNaam: k.naam, email: k.email,
                dagenGeleden: k.dagenGeleden, offerteId: null, templateId: regel.templateId,
              });
            }
          }
        }
        if (regel.doelgroep === "leads" || regel.doelgroep === "beide") {
          for (const l of leadContactDagen) {
            if (l.dagenGeleden >= regel.dagenDrempel && !isDuplicate("lead", l.id)) {
              triggers.push({
                regelId: regel.id, regelNaam: regel.naam, contactType: "lead",
                contactId: l.id, contactNaam: l.naam, email: l.email,
                dagenGeleden: l.dagenGeleden, offerteId: null, templateId: regel.templateId,
              });
            }
          }
        }
      }

      if (regel.type === "offerte_niet_beantwoord") {
        for (const o of openOffertes) {
          if (!o.datum || !o.klantId) continue;
          const dagenSinds = Math.floor((nu.getTime() - new Date(o.datum).getTime()) / 86400000);
          if (dagenSinds >= regel.dagenDrempel && !isDuplicate("klant", o.klantId)) {
            const k = klantById.get(o.klantId) ?? (await db.select({ naam: klanten.bedrijfsnaam, email: klanten.email }).from(klanten).where(eq(klanten.id, o.klantId)).get());
            triggers.push({
              regelId: regel.id, regelNaam: regel.naam, contactType: "klant",
              contactId: o.klantId, contactNaam: k?.naam ?? "Onbekend", email: k?.email ?? null,
              dagenGeleden: dagenSinds, offerteId: o.id, templateId: regel.templateId,
            });
          }
        }
      }

      if (regel.type === "offerte_vervalt") {
        for (const o of openOffertes) {
          if (!o.geldigTot || !o.klantId) continue;
          const dagenTot = Math.floor((new Date(o.geldigTot).getTime() - nu.getTime()) / 86400000);
          if (dagenTot <= regel.dagenDrempel && dagenTot >= 0 && !isDuplicate("klant", o.klantId)) {
            const k = klantById.get(o.klantId) ?? (await db.select({ naam: klanten.bedrijfsnaam, email: klanten.email }).from(klanten).where(eq(klanten.id, o.klantId)).get());
            triggers.push({
              regelId: regel.id, regelNaam: regel.naam, contactType: "klant",
              contactId: o.klantId, contactNaam: k?.naam ?? "Onbekend", email: k?.email ?? null,
              dagenGeleden: dagenTot, offerteId: o.id, templateId: regel.templateId,
            });
          }
        }
      }
    }

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
