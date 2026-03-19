import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachSequenties, outreachEmails, leads, outreachDomeinen, salesEngineScans } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const seqId = parseInt(id, 10);

    if (isNaN(seqId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const sequentie = await db
      .select()
      .from(outreachSequenties)
      .where(eq(outreachSequenties.id, seqId))
      .get();

    if (!sequentie) {
      return NextResponse.json({ fout: "Sequentie niet gevonden" }, { status: 404 });
    }

    const lead = sequentie.leadId
      ? db.select().from(leads).where(eq(leads.id, sequentie.leadId)).get()
      : null;

    const domein = sequentie.domeinId
      ? db.select().from(outreachDomeinen).where(eq(outreachDomeinen.id, sequentie.domeinId)).get()
      : null;

    const scan = sequentie.scanId
      ? db.select().from(salesEngineScans).where(eq(salesEngineScans.id, sequentie.scanId)).get()
      : null;

    const emails = await db
      .select()
      .from(outreachEmails)
      .where(eq(outreachEmails.sequentieId, seqId))
      .orderBy(outreachEmails.stapNummer)
      .all();

    return NextResponse.json({
      sequentie,
      lead,
      domein: domein ? { id: domein.id, emailAdres: domein.emailAdres, displayNaam: domein.displayNaam, domein: domein.domein } : null,
      scan: scan ? { id: scan.id, websiteUrl: scan.websiteUrl, samenvatting: scan.samenvatting } : null,
      emails,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
