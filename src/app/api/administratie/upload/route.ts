import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { uploadToStorage } from "@/lib/supabase";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { findBestMatch } from "@/lib/match-factuur";

interface InvoiceData {
  leverancier: string;
  bedrag: number;
  btwBedrag: number | null;
  factuurnummer: string | null;
  datum: string;
  currency: "EUR" | "USD" | "GBP" | null;
}

async function extractInvoiceData(pdfBuffer: Buffer, filename: string): Promise<InvoiceData | null> {
  const anthropic = Anthropic(
    { apiKey: process.env.ANTHROPIC_API_KEY },
    "administratie-upload"
  );

  const base64Pdf = pdfBuffer.toString("base64");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
            title: filename,
          },
          {
            type: "text",
            text: `Is this an invoice, receipt, or credit note? If yes, extract structured data. If not (e.g. shipping confirmation, newsletter, contract), respond with exactly: {"isFactuur": false}.

If it IS an invoice/receipt/credit note, respond with valid JSON:
{
  "isFactuur": true,
  "leverancier": "Company name as it appears (include 'Inc.', 'Ltd', 'B.V.' etc.)",
  "bedrag": 123.45,
  "btwBedrag": 21.00,
  "factuurnummer": "INV-12345",
  "datum": "YYYY-MM-DD",
  "currency": "EUR"
}

CRITICAL RULES:
- "bedrag" is the TOTAL amount (incl. BTW/tax) as a plain number without currency symbol.
- "currency" MUST be "EUR", "USD", or "GBP". Look at the currency symbol — € = EUR, $ = USD, £ = GBP. NEVER assume EUR by default.
- "btwBedrag" is only non-null for Dutch invoices with NL BTW. Foreign / reverse-charge invoices get 0 or null.
- "datum" is the invoice issue date, not payment or due date.
- Only respond with valid JSON, no other text.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const parsed = JSON.parse(textBlock.text) as {
      isFactuur: boolean;
      leverancier?: string;
      bedrag?: number;
      btwBedrag?: number | null;
      factuurnummer?: string | null;
      datum?: string;
      currency?: string;
    };

    if (!parsed.isFactuur || !parsed.leverancier || !parsed.bedrag || !parsed.datum) {
      return null;
    }

    const currency =
      parsed.currency === "USD" || parsed.currency === "GBP" || parsed.currency === "EUR"
        ? parsed.currency
        : null;

    return {
      leverancier: parsed.leverancier,
      bedrag: parsed.bedrag,
      btwBedrag: parsed.btwBedrag ?? null,
      factuurnummer: parsed.factuurnummer ?? null,
      datum: parsed.datum,
      currency,
    };
  } catch {
    return null;
  }
}

// POST /api/administratie/upload — PDF invoice upload
//
// Accepts both:
//   - Multipart form with field `bestand` (web upload button)
//   - x-api-key header + multipart `bestand` (iOS Shortcut)
//
// Flow: Claude Sonnet Vision extracts invoice data → Supabase upload →
// scoring matcher tries to link to a bank_transactie → insert row in
// inkomende_facturen with status gematcht/onbekoppeld.
export async function POST(request: NextRequest) {
  try {
    // Auth: either session (requireAuth) or x-api-key matching SESSION_SECRET
    const apiKey = request.headers.get("x-api-key");
    const authHeader = request.headers.get("authorization");
    const sessionSecret = process.env.SESSION_SECRET;
    const isShortcut =
      sessionSecret && (apiKey === sessionSecret || authHeader === `Bearer ${sessionSecret}`);
    if (!isShortcut) {
      await requireAuth();
    }

    const formData = await request.formData();
    const bestand = formData.get("bestand");
    // Optional: force-link this invoice to a specific bank_transactie,
    // bypassing the scoring matcher. Used by /financien detail panel when
    // Sem uploads directly from a transaction row — he already knows which
    // transaction this invoice belongs to.
    const forceTransactieRaw = formData.get("transactieId");
    const forceTransactieId =
      typeof forceTransactieRaw === "string" && /^\d+$/.test(forceTransactieRaw)
        ? Number(forceTransactieRaw)
        : null;

    if (!bestand || !(bestand instanceof File)) {
      return NextResponse.json(
        { fout: "Bestand is verplicht (veld: bestand)" },
        { status: 400 }
      );
    }

    if (bestand.type !== "application/pdf") {
      return NextResponse.json(
        { fout: "Alleen PDF bestanden zijn toegestaan" },
        { status: 400 }
      );
    }

    const arrayBuffer = await bestand.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Extract invoice data via Claude Vision (currency-aware)
    const invoiceData = await extractInvoiceData(pdfBuffer, bestand.name);

    if (!invoiceData) {
      return NextResponse.json(
        { fout: "Kon geen factuurgegevens extraheren uit het bestand" },
        { status: 422 }
      );
    }

    // Filter: eigen Autronis uitgaande facturen horen niet in inkomende_facturen.
    if (/autronis/i.test(invoiceData.leverancier)) {
      return NextResponse.json(
        {
          fout: "Dit lijkt een eigen Autronis-factuur (uitgaand). Die horen in /facturen, niet in administratie/inkomend.",
        },
        { status: 400 }
      );
    }

    // Upload PDF naar Supabase Storage
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const safeFilename = bestand.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${year}/facturen-inkomend/${timestamp}_${safeFilename}`;

    await uploadToStorage(storagePath, pdfBuffer, "application/pdf");

    // If caller explicitly passed a transactieId, use that (overrules the
    // matcher). Otherwise run the scoring matcher. Non-EUR invoices still
    // skip auto-match because amounts differ after currency conversion.
    let matchTx: { id: number; merchantNaam: string | null; omschrijving: string; bedrag: number } | null = null;
    let matchScore: number | null = null;
    let matchReasons: string[] = [];

    if (forceTransactieId) {
      const [forced] = await db
        .select()
        .from(bankTransacties)
        .where(eq(bankTransacties.id, forceTransactieId))
        .limit(1);
      if (forced) {
        matchTx = {
          id: forced.id,
          merchantNaam: forced.merchantNaam,
          omschrijving: forced.omschrijving,
          bedrag: forced.bedrag,
        };
        matchReasons = ["handmatig gekoppeld vanuit /financien"];
      }
    } else {
      const skipAutoMatch = invoiceData.currency && invoiceData.currency !== "EUR";
      const match = skipAutoMatch
        ? null
        : await findBestMatch({
            leverancier: invoiceData.leverancier,
            bedrag: invoiceData.bedrag,
            datum: invoiceData.datum,
          });
      if (match) {
        matchTx = {
          id: match.tx.id,
          merchantNaam: match.tx.merchantNaam,
          omschrijving: match.tx.omschrijving,
          bedrag: match.tx.bedrag,
        };
        matchScore = Math.round(match.score * 100);
        matchReasons = match.reasons;
      }
    }

    const [factuur] = await db
      .insert(inkomendeFacturen)
      .values({
        leverancier: invoiceData.leverancier,
        bedrag: invoiceData.bedrag,
        btwBedrag: invoiceData.btwBedrag,
        factuurnummer: invoiceData.factuurnummer,
        datum: invoiceData.datum,
        storageUrl: storagePath,
        emailId: null,
        bankTransactieId: match?.tx.id ?? null,
        status: match ? "gematcht" : "onbekoppeld",
        verwerkOp: new Date().toISOString(),
      })
      .returning();

    if (match) {
      await db
        .update(bankTransacties)
        .set({ storageUrl: storagePath, status: "gematcht" })
        .where(eq(bankTransacties.id, match.tx.id));
    }

    return NextResponse.json({
      succes: true,
      factuur,
      status: match ? "gematcht" : "onbekoppeld",
      gematchtAan: match
        ? {
            id: match.tx.id,
            merchant: match.tx.merchantNaam ?? match.tx.omschrijving,
            bedrag: match.tx.bedrag,
            score: Math.round(match.score * 100),
            reasons: match.reasons,
          }
        : null,
      currencyWarning: skipAutoMatch
        ? `Factuur is in ${invoiceData.currency}, niet EUR — niet auto-gematcht want bedrag verschilt na wisselkoers. Koppel handmatig.`
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
