import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachSequenties, outreachEmails, leads, outreachDomeinen, salesEngineScans } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const conditions = [];
    if (statusFilter && statusFilter !== "alle") {
      conditions.push(eq(outreachSequenties.status, statusFilter as "draft" | "actief" | "gepauzeerd" | "voltooid" | "gestopt"));
    }

    const sequenties = await db
      .select({
        id: outreachSequenties.id,
        leadId: outreachSequenties.leadId,
        scanId: outreachSequenties.scanId,
        domeinId: outreachSequenties.domeinId,
        status: outreachSequenties.status,
        abVariant: outreachSequenties.abVariant,
        aangemaaktOp: outreachSequenties.aangemaaktOp,
        bedrijfsnaam: leads.bedrijfsnaam,
        contactpersoon: leads.contactpersoon,
        email: leads.email,
      })
      .from(outreachSequenties)
      .leftJoin(leads, eq(outreachSequenties.leadId, leads.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(outreachSequenties.aangemaaktOp))
      .all();

    // Voeg email stats toe per sequentie
    const sequentiesMetStats = await Promise.all(sequenties.map(async (seq) => {
      const emails = await db
        .select()
        .from(outreachEmails)
        .where(eq(outreachEmails.sequentieId, seq.id))
        .all();

      const domein = seq.domeinId
        ? await db.select().from(outreachDomeinen).where(eq(outreachDomeinen.id, seq.domeinId)).get()
        : null;

      const volgende = emails.find((e) => e.status === "gepland" && e.geplandOp) ?? null;

      return {
        ...seq,
        domein: domein?.emailAdres ?? null,
        domeinDagLimiet: domein?.dagLimiet ?? null,
        domeinVandaagVerstuurd: domein?.vandaagVerstuurd ?? null,
        totaalEmails: emails.length,
        verstuurd: emails.filter((e) => e.status !== "gepland" && e.status !== "geannuleerd").length,
        geopend: emails.filter((e) => e.geopendOp).length,
        geklikt: emails.filter((e) => e.gekliktOp).length,
        beantwoord: emails.filter((e) => e.beantwoordOp).length,
        bounced: emails.filter((e) => e.bouncedOp).length,
        volgendeGeplandEmail: volgende?.geplandOp ?? null,
      };
    }));

    // Status counts (altijd over alle sequenties, ongeacht filter)
    const alleSeqStatussen = await db
      .select({ status: outreachSequenties.status })
      .from(outreachSequenties)
      .all();
    const statusCounts = {
      draft: alleSeqStatussen.filter((s) => s.status === "draft").length,
      actief: alleSeqStatussen.filter((s) => s.status === "actief").length,
      gepauzeerd: alleSeqStatussen.filter((s) => s.status === "gepauzeerd").length,
      gestopt: alleSeqStatussen.filter((s) => s.status === "gestopt").length,
      voltooid: alleSeqStatussen.filter((s) => s.status === "voltooid").length,
    };

    // KPIs
    const alleEmails = await db.select().from(outreachEmails).all();
    const verstuurd = alleEmails.filter((e) => e.verstuurdOp).length;
    const geopend = alleEmails.filter((e) => e.geopendOp).length;
    const geklikt = alleEmails.filter((e) => e.gekliktOp).length;
    const beantwoord = alleEmails.filter((e) => e.beantwoordOp).length;

    // Scans klaar zonder outreach
    const alleCompletedScans = await db
      .select({ id: salesEngineScans.id })
      .from(salesEngineScans)
      .where(eq(salesEngineScans.status, "completed"))
      .all();
    const alleSeqScans = await db.select({ scanId: outreachSequenties.scanId }).from(outreachSequenties).all();
    const scanIdsMetOutreach = new Set(alleSeqScans.map((s) => s.scanId));
    const scansZonderOutreach = alleCompletedScans.filter((s) => !scanIdsMetOutreach.has(s.id)).length;

    return NextResponse.json({
      sequenties: sequentiesMetStats,
      kpis: {
        totaalSequenties: alleSeqStatussen.length,
        actief: statusCounts.actief,
        verstuurd,
        geopend,
        geklikt,
        beantwoord,
        openRate: verstuurd > 0 ? Math.round((geopend / verstuurd) * 100) : 0,
        clickRate: verstuurd > 0 ? Math.round((geklikt / verstuurd) * 100) : 0,
        replyRate: verstuurd > 0 ? Math.round((beantwoord / verstuurd) * 100) : 0,
        statusCounts,
        scansZonderOutreach,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
