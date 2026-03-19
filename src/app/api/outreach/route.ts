import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachSequenties, outreachEmails, leads, outreachDomeinen } from "@/lib/db/schema";
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
        ? db.select().from(outreachDomeinen).where(eq(outreachDomeinen.id, seq.domeinId)).get()
        : null;

      return {
        ...seq,
        domein: domein?.emailAdres ?? null,
        totaalEmails: emails.length,
        verstuurd: emails.filter((e) => e.status !== "gepland" && e.status !== "geannuleerd").length,
        geopend: emails.filter((e) => e.geopendOp).length,
        geklikt: emails.filter((e) => e.gekliktOp).length,
        beantwoord: emails.filter((e) => e.beantwoordOp).length,
        bounced: emails.filter((e) => e.bouncedOp).length,
      };
    }));

    // KPIs
    const alleEmails = await db.select().from(outreachEmails).all();
    const verstuurd = alleEmails.filter((e) => e.verstuurdOp).length;
    const geopend = alleEmails.filter((e) => e.geopendOp).length;
    const geklikt = alleEmails.filter((e) => e.gekliktOp).length;
    const beantwoord = alleEmails.filter((e) => e.beantwoordOp).length;

    return NextResponse.json({
      sequenties: sequentiesMetStats,
      kpis: {
        totaalSequenties: sequenties.length,
        actief: sequenties.filter((s) => s.status === "actief").length,
        verstuurd,
        geopend,
        geklikt,
        beantwoord,
        openRate: verstuurd > 0 ? Math.round((geopend / verstuurd) * 100) : 0,
        clickRate: verstuurd > 0 ? Math.round((geklikt / verstuurd) * 100) : 0,
        replyRate: verstuurd > 0 ? Math.round((beantwoord / verstuurd) * 100) : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
