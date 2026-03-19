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

    await resend.emails.send({
      from: `${bedrijfData.bedrijfsnaam || "Autronis"} <${fromEmail}>`,
      to: factuur.klantEmail,
      subject: `Factuur ${factuur.factuurnummer} — ${bedrijfData.bedrijfsnaam || "Autronis"}`,
      text: [
        `Beste ${factuur.klantContactpersoon || factuur.klantNaam},`,
        "",
        `Hierbij ontvangt u factuur ${factuur.factuurnummer} ter hoogte van ${bedragFormatted}.`,
        "",
        bedrijfData.iban
          ? `Gelieve het bedrag over te maken op:\nIBAN: ${bedrijfData.iban}\nT.n.v.: ${bedrijfData.bedrijfsnaam || "Autronis"}\nO.v.v.: ${factuur.factuurnummer}`
          : "",
        factuur.vervaldatum
          ? `\nVervaldatum: ${new Date(factuur.vervaldatum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`
          : "",
        "",
        "Met vriendelijke groet,",
        bedrijfData.bedrijfsnaam || "Autronis",
      ]
        .filter(Boolean)
        .join("\n"),
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
