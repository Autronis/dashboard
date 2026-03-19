import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, salesEngineScans, salesEngineKansen, outreachSequenties, outreachEmails, outreachDomeinen, outreachOptOuts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { generateEmailSequence, extractEmailInput } from "@/lib/outreach/email-generator";
import type { AnalysisResult } from "@/lib/sales-engine/analyzer";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { scanId } = body as { scanId: number };

    if (!scanId) {
      return NextResponse.json({ fout: "scanId is verplicht" }, { status: 400 });
    }

    // Haal scan + lead + kansen op
    const scan = db.select().from(salesEngineScans).where(eq(salesEngineScans.id, scanId)).get();
    if (!scan || scan.status !== "completed") {
      return NextResponse.json({ fout: "Scan niet gevonden of niet voltooid" }, { status: 404 });
    }

    const lead = scan.leadId
      ? db.select().from(leads).where(eq(leads.id, scan.leadId)).get()
      : null;

    if (!lead?.email) {
      return NextResponse.json({ fout: "Lead heeft geen email adres" }, { status: 400 });
    }

    // Check opt-out
    const optOut = db.select().from(outreachOptOuts).where(eq(outreachOptOuts.email, lead.email)).get();
    if (optOut) {
      return NextResponse.json({ fout: "Dit email adres staat op de opt-out lijst" }, { status: 400 });
    }

    // Check of er al een actieve sequentie is voor deze lead
    const bestaandeSequentie = db
      .select()
      .from(outreachSequenties)
      .where(
        and(
          eq(outreachSequenties.leadId, lead.id),
          sql`${outreachSequenties.status} IN ('draft', 'actief')`
        )
      )
      .get();

    if (bestaandeSequentie) {
      return NextResponse.json({ fout: "Er is al een actieve sequentie voor deze lead" }, { status: 400 });
    }

    // Kies een actief domein met capaciteit (mailbox rotatie)
    const vandaag = new Date().toISOString().split("T")[0];
    const domein = db
      .select()
      .from(outreachDomeinen)
      .where(
        and(
          eq(outreachDomeinen.isActief, 1),
          eq(outreachDomeinen.sesConfigured, 1)
        )
      )
      .all()
      .find((d) => {
        if (d.laatsteResetDatum !== vandaag) return true; // Nog niet gereset vandaag = 0 verstuurd
        return (d.vandaagVerstuurd ?? 0) < (d.dagLimiet ?? 50);
      });

    if (!domein) {
      return NextResponse.json({ fout: "Geen beschikbaar outreach domein met capaciteit" }, { status: 400 });
    }

    // Parse AI analyse
    const aiAnalyse = scan.aiAnalyse ? (JSON.parse(scan.aiAnalyse) as AnalysisResult) : null;
    if (!aiAnalyse) {
      return NextResponse.json({ fout: "Scan heeft geen AI analyse" }, { status: 400 });
    }

    // Genereer email input
    const emailInput = extractEmailInput(lead, aiAnalyse, {
      grootsteKnelpunt: scan.grootsteKnelpunt,
    });

    // Genereer beide varianten
    const [variantA, variantB] = await Promise.all([
      generateEmailSequence(emailInput, "a"),
      generateEmailSequence(emailInput, "b"),
    ]);

    // Kies random variant voor A/B test
    const gekozenVariant = Math.random() < 0.5 ? "a" : "b";
    const gekozenEmails = gekozenVariant === "a" ? variantA : variantB;

    // Maak sequentie aan
    const [sequentie] = db
      .insert(outreachSequenties)
      .values({
        leadId: lead.id,
        scanId: scan.id,
        domeinId: domein.id,
        status: "draft",
        abVariant: gekozenVariant,
      })
      .returning()
      .all();

    // Plan emails: dag 0, dag 3, dag 7
    const nu = new Date();
    const dagOffsets = [0, 3, 7];

    for (let i = 0; i < gekozenEmails.emails.length; i++) {
      const email = gekozenEmails.emails[i];
      const geplandDatum = new Date(nu);
      geplandDatum.setDate(geplandDatum.getDate() + dagOffsets[i]);
      // Verstuur tussen 9:00 en 11:00 (random)
      geplandDatum.setHours(9 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

      db.insert(outreachEmails)
        .values({
          sequentieId: sequentie.id,
          stapNummer: i + 1,
          onderwerp: email.onderwerp,
          inhoud: email.inhoud,
          geplandOp: geplandDatum.toISOString(),
          status: "gepland",
          trackingId: randomUUID(),
        })
        .run();
    }

    return NextResponse.json({
      sequentieId: sequentie.id,
      leadId: lead.id,
      variant: gekozenVariant,
      emails: gekozenEmails.emails.map((e, i) => ({
        stap: i + 1,
        onderwerp: e.onderwerp,
        geplandOp: new Date(nu.getTime() + dagOffsets[i] * 86400000).toISOString(),
      })),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
