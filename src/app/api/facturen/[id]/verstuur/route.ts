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

    const htmlBody = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background-color:#0E1719;padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;">${bedrijfNaam.toUpperCase()}</span><br><span style="font-size:11px;color:#8A9BA0;">AI & Automatisering</span></td>
                <td align="right"><span style="font-size:11px;color:#17B8A5;font-weight:600;letter-spacing:1px;">FACTUUR</span><br><span style="font-size:13px;color:#ffffff;font-weight:600;">${factuur.factuurnummer}</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Accent line -->
        <tr><td style="height:3px;background-color:#17B8A5;"></td></tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1F2937;line-height:1.6;">Beste ${naam},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#1F2937;line-height:1.6;">Hierbij ontvangt u factuur <strong>${factuur.factuurnummer}</strong> ter hoogte van <strong style="color:#17B8A5;">${bedragFormatted}</strong>.</p>
            ${bedrijfData.iban ? `
            <!-- Betaalgegevens -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0FDFA;border:1px solid #CCFBF1;border-radius:8px;margin:20px 0;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#0F766E;text-transform:uppercase;letter-spacing:0.5px;">Betaalgegevens</p>
                <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#1F2937;line-height:1.8;">
                  <tr><td style="color:#6B7280;padding-right:12px;">IBAN</td><td style="font-weight:600;">${bedrijfData.iban}</td></tr>
                  <tr><td style="color:#6B7280;padding-right:12px;">T.n.v.</td><td>${bedrijfNaam}</td></tr>
                  <tr><td style="color:#6B7280;padding-right:12px;">Kenmerk</td><td>${factuur.factuurnummer}</td></tr>
                  ${vervaldatumFormatted ? `<tr><td style="color:#6B7280;padding-right:12px;">Uiterlijk</td><td style="font-weight:600;">${vervaldatumFormatted}</td></tr>` : ""}
                </table>
              </td></tr>
            </table>
            ` : ""}
            <p style="margin:20px 0 0;font-size:14px;color:#6B7280;line-height:1.6;">De factuur is als PDF bijgevoegd bij deze e-mail.</p>
            <p style="margin:28px 0 0;font-size:15px;color:#1F2937;">Met vriendelijke groet,</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1F2937;">${bedrijfNaam}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #E5E7EB;padding:24px 40px;background-color:#FAFAFA;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px;color:#9CA3AF;line-height:1.6;">
              <tr>
                <td>${bedrijfNaam}${bedrijfData.adres ? ` · ${bedrijfData.adres}` : ""}</td>
                <td align="right">
                  ${bedrijfData.kvkNummer ? `KvK: ${bedrijfData.kvkNummer}` : ""}
                  ${bedrijfData.btwNummer ? ` · BTW: ${bedrijfData.btwNummer}` : ""}
                </td>
              </tr>
              <tr>
                <td>${bedrijfData.email || "zakelijk@autronis.com"} · autronis.nl</td>
                <td align="right">${bedrijfData.telefoon || ""}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const toEmail = body.aan || factuur.klantEmail;
    const subject = body.onderwerp || `Factuur ${factuur.factuurnummer} — ${bedrijfNaam}`;
    const customBericht = body.bericht;

    await resend.emails.send({
      from: `${bedrijfNaam} <${fromEmail}>`,
      to: toEmail,
      subject,
      html: htmlBody,
      text: customBericht || `Beste ${naam},\n\nHierbij ontvangt u factuur ${factuur.factuurnummer} ter hoogte van ${bedragFormatted}.\n\n${bedrijfData.iban ? `IBAN: ${bedrijfData.iban}\nT.n.v.: ${bedrijfNaam}\nKenmerk: ${factuur.factuurnummer}` : ""}${vervaldatumFormatted ? `\nUiterlijk: ${vervaldatumFormatted}` : ""}\n\nDe factuur is als PDF bijgevoegd.\n\nMet vriendelijke groet,\n${bedrijfNaam}`,
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
