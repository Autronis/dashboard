import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offertes, offerteRegels, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { OffertePDF } from "@/lib/offerte-pdf";
import { Resend } from "resend";
import React from "react";

// POST /api/offertes/[id]/verstuur
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { fout: "E-mail is niet geconfigureerd. Stel RESEND_API_KEY in." },
        { status: 500 }
      );
    }

    const [offerte] = await db
      .select({
        id: offertes.id,
        offertenummer: offertes.offertenummer,
        titel: offertes.titel,
        status: offertes.status,
        datum: offertes.datum,
        geldigTot: offertes.geldigTot,
        bedragExclBtw: offertes.bedragExclBtw,
        btwPercentage: offertes.btwPercentage,
        btwBedrag: offertes.btwBedrag,
        bedragInclBtw: offertes.bedragInclBtw,
        notities: offertes.notities,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantEmail: klanten.email,
        klantAdres: klanten.adres,
      })
      .from(offertes)
      .innerJoin(klanten, eq(offertes.klantId, klanten.id))
      .where(eq(offertes.id, Number(id)));

    if (!offerte) {
      return NextResponse.json({ fout: "Offerte niet gevonden." }, { status: 404 });
    }

    if (!offerte.klantEmail) {
      return NextResponse.json(
        { fout: "Klant heeft geen e-mailadres. Voeg een e-mailadres toe aan de klant." },
        { status: 400 }
      );
    }

    const regels = await db
      .select()
      .from(offerteRegels)
      .where(eq(offerteRegels.offerteId, Number(id)));

    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1);

    const bedrijfData = bedrijf || {
      bedrijfsnaam: "Autronis",
      adres: null,
      kvkNummer: null,
      btwNummer: null,
      email: null,
      telefoon: null,
      iban: null,
    };

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(OffertePDF, {
        offerte,
        regels,
        bedrijf: bedrijfData,
      }) as any
    );

    const bedragFormatted = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(offerte.bedragInclBtw || 0);

    // Send email
    const resend = new Resend(apiKey);
    const fromEmail = bedrijfData.email || "zakelijk@autronis.com";

    await resend.emails.send({
      from: `${bedrijfData.bedrijfsnaam || "Autronis"} <${fromEmail}>`,
      to: offerte.klantEmail,
      subject: `Offerte ${offerte.offertenummer}${offerte.titel ? ` - ${offerte.titel}` : ""} — ${bedrijfData.bedrijfsnaam || "Autronis"}`,
      text: [
        `Beste ${offerte.klantContactpersoon || offerte.klantNaam},`,
        "",
        `Hierbij ontvangt u onze offerte ${offerte.offertenummer}${offerte.titel ? ` voor "${offerte.titel}"` : ""} ter hoogte van ${bedragFormatted}.`,
        "",
        offerte.geldigTot
          ? `Deze offerte is geldig tot ${new Date(offerte.geldigTot).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}.`
          : "",
        "",
        "Mocht u vragen hebben, neem dan gerust contact met ons op.",
        "",
        "Met vriendelijke groet,",
        bedrijfData.bedrijfsnaam || "Autronis",
      ]
        .filter(Boolean)
        .join("\n"),
      attachments: [
        {
          filename: `Autronis_Offerte_${offerte.offertenummer}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    // Update status to verzonden
    await db
      .update(offertes)
      .set({ status: "verzonden", bijgewerktOp: new Date().toISOString() })
      .where(eq(offertes.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon e-mail niet versturen" },
      { status: 500 }
    );
  }
}
