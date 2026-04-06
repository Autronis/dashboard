import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, factuurRegels, klanten, bedrijfsinstellingen } from "@/lib/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { FactuurPDF } from "@/lib/factuur-pdf";
import { Resend } from "resend";
import React from "react";

// GET /api/facturen/cron — Vercel Cron: dagelijks factuur-automatisering
// 1. Markeer verlopen facturen als "te laat"
// 2. Genereer + verstuur terugkerende facturen
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }

    const nu = new Date().toISOString().split("T")[0];
    const results: Record<string, unknown> = {};

    // ─── 1. Markeer verlopen facturen als "te laat" ───
    const verlopen = await db
      .update(facturen)
      .set({ status: "te_laat", bijgewerktOp: new Date().toISOString() })
      .where(and(eq(facturen.status, "verzonden"), lte(facturen.vervaldatum, nu)))
      .returning({ id: facturen.id });
    results.verlopenGemarkeerd = verlopen.length;

    // ─── 2. Genereer + verstuur terugkerende facturen ───
    const terugkerend = await db
      .select()
      .from(facturen)
      .where(and(
        eq(facturen.isTerugkerend, 1),
        eq(facturen.status, "betaald"),
        eq(facturen.isActief, 1),
      ))
      .all();

    let aangemaakt = 0;
    let verzonden = 0;
    const fouten: string[] = [];

    for (const f of terugkerend) {
      if (!f.betaaldOp) continue;

      const interval = f.terugkeerInterval === "wekelijks" ? 7 : 30;
      const daysSince = Math.floor((Date.now() - new Date(f.betaaldOp).getTime()) / 86400000);
      if (daysSince < interval) continue;

      // Genereer factuurnummer
      const jaar = new Date().getFullYear();
      const maxNr = await db
        .select({ max: sql<string>`MAX(factuurnummer)` })
        .from(facturen)
        .where(sql`factuurnummer LIKE ${"AUT-" + jaar + "-%"}`)
        .get();
      const lastNum = maxNr?.max ? parseInt(maxNr.max.split("-")[2]) : 0;
      const nextNummer = `AUT-${jaar}-${String(lastNum + 1).padStart(3, "0")}`;

      const vandaag = new Date().toISOString().split("T")[0];
      const vervalDate = new Date(Date.now() + 30 * 86400000);
      const vervaldatum = vervalDate.toISOString().split("T")[0];

      // Maak nieuwe factuur aan
      const [nieuw] = await db
        .insert(facturen)
        .values({
          klantId: f.klantId,
          projectId: f.projectId,
          factuurnummer: nextNummer,
          status: "concept",
          bedragExclBtw: f.bedragExclBtw,
          btwPercentage: f.btwPercentage,
          btwBedrag: f.btwBedrag,
          bedragInclBtw: f.bedragInclBtw,
          factuurdatum: vandaag,
          vervaldatum,
          isTerugkerend: 1,
          terugkeerInterval: f.terugkeerInterval,
          notities: `Automatisch aangemaakt vanuit ${f.factuurnummer}`,
          isActief: 1,
          aangemaaktDoor: 1,
        })
        .returning()
        .all();

      if (!nieuw) continue;

      // Kopieer factuurregels
      const regels = await db
        .select()
        .from(factuurRegels)
        .where(eq(factuurRegels.factuurId, f.id))
        .all();

      for (const r of regels) {
        await db.insert(factuurRegels).values({
          factuurId: nieuw.id,
          omschrijving: r.omschrijving,
          aantal: r.aantal,
          eenheidsprijs: r.eenheidsprijs,
          btwPercentage: r.btwPercentage,
          totaal: r.totaal,
        }).run();
      }

      aangemaakt++;

      // ─── Auto-verzenden via e-mail ───
      try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) continue;

        const klant = await db
          .select()
          .from(klanten)
          .where(eq(klanten.id, f.klantId))
          .get();

        if (!klant?.email) continue;

        const nieuweRegels = await db
          .select()
          .from(factuurRegels)
          .where(eq(factuurRegels.factuurId, nieuw.id))
          .all();

        const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1);
        const bedrijfData = bedrijf || {
          bedrijfsnaam: "Autronis",
          adres: null, kvkNummer: null, btwNummer: null,
          email: null, telefoon: null, iban: null,
        };

        const taal = (klant.taal === "en" ? "en" : "nl") as "nl" | "en";

        // Genereer PDF
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(
          React.createElement(FactuurPDF, {
            factuur: {
              ...nieuw,
              klantNaam: klant.bedrijfsnaam,
              klantContactpersoon: klant.contactpersoon,
              klantAdres: klant.adres,
            },
            regels: nieuweRegels,
            bedrijf: bedrijfData,
            taal,
          }) as any
        );

        const bedragFormatted = new Intl.NumberFormat(taal === "en" ? "en-GB" : "nl-NL", {
          style: "currency", currency: "EUR",
        }).format(nieuw.bedragInclBtw || 0);

        const naam = klant.contactpersoon || klant.bedrijfsnaam;
        const bedrijfNaam = bedrijfData.bedrijfsnaam || "Autronis";
        const fromEmail = bedrijfData.email || "zakelijk@autronis.com";

        const emailText = taal === "en"
          ? `Dear ${naam},\n\nPlease find attached invoice ${nextNummer} for the amount of ${bedragFormatted}.\n\nThis is an automatically generated recurring invoice.\n\nKind regards,\n${bedrijfNaam}`
          : `Beste ${naam},\n\nIn de bijlage vindt u factuur ${nextNummer} ter hoogte van ${bedragFormatted}.\n\nDit is een automatisch gegenereerde terugkerende factuur.\n\nMet vriendelijke groet,\n${bedrijfNaam}`;

        const subject = taal === "en"
          ? `Invoice ${nextNummer} — ${bedrijfNaam}`
          : `Factuur ${nextNummer} — ${bedrijfNaam}`;

        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: `${bedrijfNaam} <${fromEmail}>`,
          to: klant.email,
          subject,
          text: emailText,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#1F2937;line-height:1.6;">${emailText.replace(/\n/g, "<br>")}</body></html>`,
          attachments: [{
            filename: `Autronis_${taal === "en" ? "Invoice" : "Factuur"}_${nextNummer}.pdf`,
            content: pdfBuffer.toString("base64"),
          }],
        });

        // Update status naar verzonden
        await db
          .update(facturen)
          .set({ status: "verzonden", bijgewerktOp: new Date().toISOString() })
          .where(eq(facturen.id, nieuw.id));

        verzonden++;
      } catch (emailError) {
        fouten.push(`${nextNummer}: ${emailError instanceof Error ? emailError.message : "E-mail fout"}`);
      }
    }

    results.periodiekeAangemaakt = aangemaakt;
    results.periodiekeVerzonden = verzonden;
    if (fouten.length > 0) results.fouten = fouten;

    return NextResponse.json({ succes: true, ...results });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Cron taak mislukt" },
      { status: 500 }
    );
  }
}
