import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachEmails, outreachSequenties, outreachDomeinen, outreachOptOuts, leads } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { eq, and, lte, sql } from "drizzle-orm";
import { sendEmailViaSES, buildEmailHtml } from "@/lib/outreach/ses";
import { createHash } from "crypto";

function generateUnsubscribeToken(email: string): string {
  return createHash("sha256").update(`unsub-${email}-${process.env.SESSION_SECRET || "salt"}`).digest("hex").substring(0, 32);
}

// GET for Vercel Cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
  }
  return processOutreach(req);
}

export async function POST(req: NextRequest) {
  await requireApiKey(req);
  return processOutreach(req);
}

async function processOutreach(req: NextRequest) {
  try {

    const nu = new Date().toISOString();
    const vandaag = nu.split("T")[0];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;

    // Reset dagelijkse tellers als het een nieuwe dag is
    const domeinen = await db.select().from(outreachDomeinen).where(eq(outreachDomeinen.isActief, 1)).all();
    for (const domein of domeinen) {
      if (domein.laatsteResetDatum !== vandaag) {
        await db.update(outreachDomeinen)
          .set({ vandaagVerstuurd: 0, laatsteResetDatum: vandaag })
          .where(eq(outreachDomeinen.id, domein.id))
          .run();
      }
    }

    // Vind emails die verstuurd moeten worden
    const teVersturenEmails = await db
      .select({
        emailId: outreachEmails.id,
        sequentieId: outreachEmails.sequentieId,
        onderwerp: outreachEmails.onderwerp,
        inhoud: outreachEmails.inhoud,
        trackingId: outreachEmails.trackingId,
      })
      .from(outreachEmails)
      .innerJoin(outreachSequenties, eq(outreachEmails.sequentieId, outreachSequenties.id))
      .where(
        and(
          eq(outreachEmails.status, "gepland"),
          lte(outreachEmails.geplandOp, nu),
          eq(outreachSequenties.status, "actief")
        )
      )
      .all();

    let verstuurd = 0;
    let mislukt = 0;
    const fouten: string[] = [];

    for (const email of teVersturenEmails) {
      try {
        // Haal sequentie + lead + domein op
        const sequentie = await db.select().from(outreachSequenties).where(eq(outreachSequenties.id, email.sequentieId)).get();
        if (!sequentie?.leadId || !sequentie?.domeinId) continue;

        const lead = await db.select().from(leads).where(eq(leads.id, sequentie.leadId)).get();
        if (!lead?.email) continue;

        // Check opt-out
        const optOut = await db.select().from(outreachOptOuts).where(eq(outreachOptOuts.email, lead.email)).get();
        if (optOut) {
          await db.update(outreachEmails)
            .set({ status: "geannuleerd" })
            .where(eq(outreachEmails.id, email.emailId))
            .run();
          continue;
        }

        const domein = await db.select().from(outreachDomeinen).where(eq(outreachDomeinen.id, sequentie.domeinId)).get();
        if (!domein || !domein.isActief) continue;

        // Check dag limiet
        const huidigVerstuurd = domein.laatsteResetDatum === vandaag ? (domein.vandaagVerstuurd ?? 0) : 0;
        if (huidigVerstuurd >= (domein.dagLimiet ?? 50)) continue;

        // Bouw email met tracking
        const unsubToken = generateUnsubscribeToken(lead.email);
        const htmlBody = buildEmailHtml(email.inhoud, baseUrl, email.trackingId, unsubToken);

        // Verstuur via SES
        const result = await sendEmailViaSES({
          from: domein.emailAdres,
          fromName: domein.displayNaam,
          to: lead.email,
          subject: email.onderwerp,
          htmlBody,
        });

        // Update email record
        await db.update(outreachEmails)
          .set({
            verstuurdOp: new Date().toISOString(),
            status: "verstuurd",
            sesMessageId: result.messageId,
          })
          .where(eq(outreachEmails.id, email.emailId))
          .run();

        // Update domein teller
        await db.update(outreachDomeinen)
          .set({
            vandaagVerstuurd: huidigVerstuurd + 1,
            laatsteResetDatum: vandaag,
          })
          .where(eq(outreachDomeinen.id, domein.id))
          .run();

        verstuurd++;
      } catch (err) {
        mislukt++;
        fouten.push(`Email ${email.emailId}: ${err instanceof Error ? err.message : "onbekend"}`);
      }
    }

    // Check of sequenties voltooid zijn (alle emails verstuurd/beantwoord)
    const actieveSequenties = await db
      .select()
      .from(outreachSequenties)
      .where(eq(outreachSequenties.status, "actief"))
      .all();

    for (const seq of actieveSequenties) {
      const emails = await db.select().from(outreachEmails).where(eq(outreachEmails.sequentieId, seq.id)).all();
      const alleVerwerkt = emails.every((e) => e.status !== "gepland");
      if (alleVerwerkt) {
        await db.update(outreachSequenties)
          .set({ status: "voltooid", bijgewerktOp: new Date().toISOString() })
          .where(eq(outreachSequenties.id, seq.id))
          .run();
      }
    }

    return NextResponse.json({
      success: true,
      verstuurd,
      mislukt,
      teVerwerken: teVersturenEmails.length,
      fouten: fouten.length > 0 ? fouten : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ success: false, error: message }, { status: message.includes("API key") ? 401 : 500 });
  }
}
