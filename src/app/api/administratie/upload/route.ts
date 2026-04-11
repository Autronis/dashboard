import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, between, isNull } from "drizzle-orm";
import { uploadToStorage } from "@/lib/supabase";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

interface InvoiceData {
  leverancier: string;
  bedrag: number;
  btwBedrag: number | null;
  factuurnummer: string | null;
  datum: string;
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
            text: 'Extract the following from this invoice: leverancier (supplier name), bedrag (total amount including VAT), btwBedrag (VAT amount), factuurnummer (invoice number), datum (invoice date as YYYY-MM-DD). Respond with valid JSON only: {"leverancier": "...", "bedrag": 123.45, "btwBedrag": 21.00, "factuurnummer": "...", "datum": "YYYY-MM-DD"}. Use null for fields you cannot find.',
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const parsed = JSON.parse(textBlock.text) as {
      leverancier?: string;
      bedrag?: number;
      btwBedrag?: number | null;
      factuurnummer?: string | null;
      datum?: string;
    };

    if (!parsed.leverancier || !parsed.bedrag || !parsed.datum) {
      return null;
    }

    return {
      leverancier: parsed.leverancier,
      bedrag: parsed.bedrag,
      btwBedrag: parsed.btwBedrag ?? null,
      factuurnummer: parsed.factuurnummer ?? null,
      datum: parsed.datum,
    };
  } catch {
    return null;
  }
}

async function findMatchingTransaction(bedrag: number) {
  const absBedrag = Math.abs(bedrag);
  const lower = -(absBedrag * 1.05);
  const upper = -(absBedrag * 0.95);

  const matches = await db
    .select()
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        between(bankTransacties.bedrag, lower, upper),
        isNull(bankTransacties.storageUrl),
        isNull(bankTransacties.bonPad)
      )
    )
    .limit(1);

  if (matches.length > 0) return matches[0];

  // Also try positive amount range
  const lowerBound = absBedrag * 0.95;
  const upperBound = absBedrag * 1.05;

  const positiveMatches = await db
    .select()
    .from(bankTransacties)
    .where(
      and(
        eq(bankTransacties.type, "af"),
        between(bankTransacties.bedrag, lowerBound, upperBound),
        isNull(bankTransacties.storageUrl),
        isNull(bankTransacties.bonPad)
      )
    )
    .limit(1);

  return positiveMatches[0] ?? null;
}

// POST /api/administratie/upload — Manual PDF invoice upload
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const bestand = formData.get("bestand");

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

    // Extract invoice data via Claude Vision
    const invoiceData = await extractInvoiceData(pdfBuffer, bestand.name);

    if (!invoiceData) {
      return NextResponse.json(
        { fout: "Kon geen factuurgegevens extraheren uit het bestand" },
        { status: 422 }
      );
    }

    // Upload to Supabase Storage
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const safeFilename = bestand.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${year}/facturen-inkomend/${timestamp}_${safeFilename}`;

    await uploadToStorage(storagePath, pdfBuffer, "application/pdf");

    // Auto-match with bank transaction
    const matchedTransactie = await findMatchingTransaction(invoiceData.bedrag);
    const status = matchedTransactie ? "gematcht" : "onbekoppeld";

    // Create inkomendeFacturen record
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
        bankTransactieId: matchedTransactie?.id ?? null,
        status,
        verwerkOp: new Date().toISOString(),
      })
      .returning();

    // If matched, update the bank transaction with storageUrl
    if (matchedTransactie) {
      await db
        .update(bankTransacties)
        .set({ storageUrl: storagePath, status: "gematcht" })
        .where(eq(bankTransacties.id, matchedTransactie.id));
    }

    return NextResponse.json({
      succes: true,
      factuur,
      status,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
