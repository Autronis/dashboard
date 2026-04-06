import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { followUpLog, followUpRegels, klanten, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, and, sql } from "drizzle-orm";

// GET /api/followup/log — history of triggered follow-ups
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limiet = Number(searchParams.get("limiet")) || 50;

    const conditions = [];
    if (status && status !== "alle") {
      conditions.push(eq(followUpLog.status, status as "getriggerd" | "verstuurd" | "mislukt" | "overgeslagen" | "gesnoozed"));
    }

    const rows = await db
      .select({
        id: followUpLog.id,
        regelId: followUpLog.regelId,
        regelNaam: followUpRegels.naam,
        contactType: followUpLog.contactType,
        contactId: followUpLog.contactId,
        offerteId: followUpLog.offerteId,
        status: followUpLog.status,
        dagenGeleden: followUpLog.dagenGeleden,
        emailVerstuurd: followUpLog.emailVerstuurd,
        foutmelding: followUpLog.foutmelding,
        notitie: followUpLog.notitie,
        verstuurdOp: followUpLog.verstuurdOp,
        aangemaaktOp: followUpLog.aangemaaktOp,
      })
      .from(followUpLog)
      .leftJoin(followUpRegels, eq(followUpLog.regelId, followUpRegels.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(followUpLog.aangemaaktOp))
      .limit(limiet);

    // Enrich with contact names
    const klantIds = [...new Set(rows.filter((r) => r.contactType === "klant").map((r) => r.contactId))];
    const leadIds = [...new Set(rows.filter((r) => r.contactType === "lead").map((r) => r.contactId))];

    const klantNamen = klantIds.length > 0
      ? await db
          .select({ id: klanten.id, naam: klanten.bedrijfsnaam })
          .from(klanten)
          .where(sql`${klanten.id} IN (${sql.raw(klantIds.join(","))})`)
      : [];

    const leadNamen = leadIds.length > 0
      ? await db
          .select({ id: leads.id, naam: leads.bedrijfsnaam })
          .from(leads)
          .where(sql`${leads.id} IN (${sql.raw(leadIds.join(","))})`)
      : [];

    const naamMap = new Map([
      ...klantNamen.map((k) => [`klant-${k.id}`, k.naam] as const),
      ...leadNamen.map((l) => [`lead-${l.id}`, l.naam] as const),
    ]);

    const enriched = rows.map((r) => ({
      ...r,
      contactNaam: naamMap.get(`${r.contactType}-${r.contactId}`) ?? "Onbekend",
    }));

    return NextResponse.json({ log: enriched });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
