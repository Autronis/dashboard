import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, factuurRegels, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { FactuurPDF } from "@/lib/factuur-pdf";
import { Resend } from "resend";
import React from "react";

// POST /api/facturen/[id]/verstuur
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as {
      aan?: string; onderwerp?: string; bericht?: string;
    };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { fout: "E-mail is niet geconfigureerd. Stel RESEND_API_KEY in." },
        { status: 500 }
      );
    }

    const [factuur] = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        status: facturen.status,
        bedragExclBtw: facturen.bedragExclBtw,
        btwPercentage: facturen.btwPercentage,
        btwBedrag: facturen.btwBedrag,
        bedragInclBtw: facturen.bedragInclBtw,
        factuurdatum: facturen.factuurdatum,
        vervaldatum: facturen.vervaldatum,
        notities: facturen.notities,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantEmail: klanten.email,
        klantAdres: klanten.adres,
      })
      .from(facturen)
      .innerJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(eq(facturen.id, Number(id)));

    if (!factuur) {
      return NextResponse.json({ fout: "Factuur niet gevonden." }, { status: 404 });
    }

    if (!factuur.klantEmail) {
      return NextResponse.json(
        { fout: "Klant heeft geen e-mailadres. Voeg een e-mailadres toe aan de klant." },
        { status: 400 }
      );
    }

    const regels = await db
      .select()
      .from(factuurRegels)
      .where(eq(factuurRegels.factuurId, Number(id)));

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
      React.createElement(FactuurPDF, {
        factuur,
        regels,
        bedrijf: bedrijfData,
      }) as any
    );

    const bedragFormatted = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(factuur.bedragInclBtw || 0);

    // Send email
    const resend = new Resend(apiKey);
    const fromEmail = bedrijfData.email || "zakelijk@autronis.com";

    const vervaldatumFormatted = factuur.vervaldatum
      ? new Date(factuur.vervaldatum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const naam = factuur.klantContactpersoon || factuur.klantNaam;
    const bedrijfNaam = bedrijfData.bedrijfsnaam || "Autronis";

    const toEmail = body.aan || factuur.klantEmail;
    const subject = body.onderwerp || `Factuur ${factuur.factuurnummer} — ${bedrijfNaam}`;
    const emailText = body.bericht || `Beste ${naam},\n\nIn de bijlage vindt u factuur ${factuur.factuurnummer} ter hoogte van ${bedragFormatted}.\n\nMet vriendelijke groet,\n${bedrijfNaam}`;

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#1F2937;line-height:1.6;">${emailText.replace(/\n/g, "<br>")}</body></html>`;

    await resend.emails.send({
      from: `${bedrijfNaam} <${fromEmail}>`,
      to: toEmail,
      subject,
      html: htmlBody,
      text: emailText,
      attachments: [
        {
          filename: `Autronis_Factuur_${factuur.factuurnummer}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    // Update status to verzonden
    await db
      .update(facturen)
      .set({ status: "verzonden", bijgewerktOp: new Date().toISOString() })
      .where(eq(facturen.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Kon e-mail niet versturen" },
      { status: 500 }
    );
  }
}
