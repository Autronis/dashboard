import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachEmails, outreachSequenties, leads } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    await requireApiKey(req);

    const body = await req.json();
    const { email: replyEmail, subject, messageId } = body as {
      email: string;
      subject?: string;
      messageId?: string;
    };

    if (!replyEmail) {
      return NextResponse.json({ fout: "email is verplicht" }, { status: 400 });
    }

    // Zoek de lead op basis van email
    const lead = db
      .select()
      .from(leads)
      .where(eq(leads.email, replyEmail.toLowerCase()))
      .get();

    if (!lead) {
      return NextResponse.json({ fout: "Lead niet gevonden", matched: false });
    }

    // Zoek actieve sequentie voor deze lead
    const sequentie = db
      .select()
      .from(outreachSequenties)
      .where(
        and(
          eq(outreachSequenties.leadId, lead.id),
          eq(outreachSequenties.status, "actief")
        )
      )
      .get();

    if (!sequentie) {
      return NextResponse.json({ matched: false, bericht: "Geen actieve sequentie voor deze lead" });
    }

    // Stop de sequentie
    db.update(outreachSequenties)
      .set({ status: "gestopt", bijgewerktOp: new Date().toISOString() })
      .where(eq(outreachSequenties.id, sequentie.id))
      .run();

    // Markeer de laatst verstuurde email als beantwoord
    const emails = db
      .select()
      .from(outreachEmails)
      .where(eq(outreachEmails.sequentieId, sequentie.id))
      .all();

    const laatsteVerstuurd = emails
      .filter((e) => e.verstuurdOp)
      .sort((a, b) => (b.verstuurdOp ?? "").localeCompare(a.verstuurdOp ?? ""))
      [0];

    if (laatsteVerstuurd) {
      db.update(outreachEmails)
        .set({
          beantwoordOp: new Date().toISOString(),
          status: "beantwoord",
        })
        .where(eq(outreachEmails.id, laatsteVerstuurd.id))
        .run();
    }

    // Annuleer geplande emails
    for (const email of emails) {
      if (email.status === "gepland") {
        db.update(outreachEmails)
          .set({ status: "geannuleerd" })
          .where(eq(outreachEmails.id, email.id))
          .run();
      }
    }

    // Update lead status
    db.update(leads)
      .set({
        status: "contact",
        volgendeActie: "Reply ontvangen op outreach - opvolgen",
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(leads.id, lead.id))
      .run();

    return NextResponse.json({
      matched: true,
      sequentieId: sequentie.id,
      leadId: lead.id,
      actie: "Sequentie gestopt, lead status bijgewerkt naar 'contact'",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message.includes("API key") ? 401 : 500 });
  }
}
