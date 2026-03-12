import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { bedrijfsinstellingen, leads, leadActiviteiten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/leads/[id]/email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    if (!body.onderwerp?.trim() || !body.bericht?.trim()) {
      return NextResponse.json(
        { fout: "Onderwerp en bericht zijn verplicht." },
        { status: 400 }
      );
    }

    // Haal lead op
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, Number(id)));

    if (!lead) {
      return NextResponse.json({ fout: "Lead niet gevonden." }, { status: 404 });
    }

    if (!lead.email) {
      return NextResponse.json(
        { fout: "Lead heeft geen e-mailadres." },
        { status: 400 }
      );
    }

    // Haal bedrijfsinstellingen op voor afzender
    const [instellingen] = await db.select().from(bedrijfsinstellingen);
    const afzenderEmail = instellingen?.email || "noreply@autronis.nl";
    const afzenderNaam = instellingen?.bedrijfsnaam || "Autronis";

    // Verstuur email via Resend
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { fout: "E-mail is niet geconfigureerd (RESEND_API_KEY ontbreekt)." },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: `${afzenderNaam} <${afzenderEmail}>`,
      to: [lead.email],
      subject: body.onderwerp.trim(),
      text: body.bericht.trim(),
    });

    if (error) {
      return NextResponse.json(
        { fout: `E-mail versturen mislukt: ${error.message}` },
        { status: 500 }
      );
    }

    // Maak activiteit aan
    await db.insert(leadActiviteiten).values({
      leadId: Number(id),
      gebruikerId: gebruiker.id,
      type: "email_verstuurd",
      titel: `E-mail verstuurd: ${body.onderwerp.trim()}`,
      omschrijving: body.bericht.trim(),
    });

    return NextResponse.json({ succes: true, bericht: "E-mail succesvol verstuurd." });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
