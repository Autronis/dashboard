import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens, inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOAuth2Client } from "@/lib/google-calendar";
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

interface SyncResultaat {
  emailId: string;
  onderwerp: string;
  status: "verwerkt" | "geen_factuur" | "overgeslagen" | "fout";
  leverancier?: string;
  bedrag?: number;
}

// GET /api/administratie/gmail-sync — Vercel Cron: Gmail factuur sync elke 30 min
export async function GET(request: NextRequest) {
  // Verify cron secret or Bearer token
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (sessionSecret && authHeader === `Bearer ${sessionSecret}`);

  if (!isAuthorized) {
    return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
  }

  try {
    // Load Gmail tokens (calendarId = 'gmail' marks Gmail tokens)
    const [gmailTokenRow] = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.calendarId, "gmail"))
      .limit(1);

    if (!gmailTokenRow) {
      return NextResponse.json(
        { fout: "Gmail niet gekoppeld. Ga naar /api/auth/google/gmail om te verbinden." },
        { status: 400 }
      );
    }

    // Create OAuth2 client with stored tokens
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: gmailTokenRow.accessToken,
      refresh_token: gmailTokenRow.refreshToken,
      expiry_date: new Date(gmailTokenRow.expiresAt).getTime(),
    });

    // Auto-refresh if expired
    const now = Date.now();
    const expiry = new Date(gmailTokenRow.expiresAt).getTime();
    if (now >= expiry - 60_000) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await db
        .update(googleTokens)
        .set({
          accessToken: credentials.access_token ?? gmailTokenRow.accessToken,
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : gmailTokenRow.expiresAt,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(googleTokens.id, gmailTokenRow.id));
      oauth2Client.setCredentials(credentials);
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Search window: default 2d (cron runs hourly → 48h overlap is a safe
    // vangnet). Override via ?since=<N>d|m|y for manual backfills, e.g.
    // ?since=30d to catch everything in the last month on first run.
    const sinceParam = new URL(request.url).searchParams.get("since") ?? "2d";
    const safeSince = /^\d+[dmy]$/.test(sinceParam) ? sinceParam : "2d";

    const listResult = await gmail.users.messages.list({
      userId: "me",
      q: `has:attachment filename:pdf newer_than:${safeSince}`,
      maxResults: 50,
    });

    const messages = listResult.data.messages ?? [];
    const resultaten: SyncResultaat[] = [];
    let verwerkt = 0;

    for (const msgRef of messages) {
      if (!msgRef.id) continue;

      try {
        // Skip if emailId already exists
        const [existing] = await db
          .select({ id: inkomendeFacturen.id })
          .from(inkomendeFacturen)
          .where(eq(inkomendeFacturen.emailId, msgRef.id))
          .limit(1);

        if (existing) {
          resultaten.push({
            emailId: msgRef.id,
            onderwerp: "",
            status: "overgeslagen",
          });
          continue;
        }

        // Get full message
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: msgRef.id,
        });

        const headers = fullMessage.data.payload?.headers ?? [];
        const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "Onbekend";
        const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "Geen onderwerp";

        // Find PDF attachments in message parts
        const pdfParts = findPdfParts(fullMessage.data.payload);

        if (pdfParts.length === 0) {
          resultaten.push({
            emailId: msgRef.id,
            onderwerp: subjectHeader,
            status: "overgeslagen",
          });
          continue;
        }

        // Process each PDF attachment
        for (const part of pdfParts) {
          if (!part.body?.attachmentId) continue;

          // Download attachment
          const attachment = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: msgRef.id,
            id: part.body.attachmentId,
          });

          if (!attachment.data.data) continue;

          const pdfBuffer = Buffer.from(attachment.data.data, "base64");
          const filename = part.filename ?? "factuur.pdf";

          // Send to Claude to check if it's an invoice
          const invoiceData = await analyzeInvoice(pdfBuffer, filename);

          if (!invoiceData) {
            resultaten.push({
              emailId: msgRef.id,
              onderwerp: subjectHeader,
              status: "geen_factuur",
            });
            continue;
          }

          // Skip eigen uitgaande facturen — die horen in de facturen tabel,
          // niet in inkomende_facturen. De gmail-inbox kan forwards/cc's
          // van eigen verzonden PDFs bevatten.
          if (/autronis/i.test(invoiceData.leverancier)) {
            resultaten.push({
              emailId: msgRef.id,
              onderwerp: subjectHeader,
              status: "geen_factuur",
            });
            continue;
          }

          // Upload PDF to Supabase Storage
          const year = new Date().getFullYear();
          const timestamp = Date.now();
          const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `${year}/facturen-inkomend/${timestamp}_${safeFilename}`;

          await uploadToStorage(storagePath, pdfBuffer, "application/pdf");

          // Auto-match with bank transaction using scoring matcher
          // (leverancier-naam + bedrag + datum combined). Foreign-currency
          // invoices are intentionally NOT auto-matched because the amount
          // on the invoice differs from the bank amount after conversion —
          // they end up as "onbekoppeld" so Sem can handmatig koppelen.
          const skipAutoMatch = invoiceData.currency && invoiceData.currency !== "EUR";
          const match = skipAutoMatch
            ? null
            : await findBestMatch({
                leverancier: invoiceData.leverancier,
                bedrag: invoiceData.bedrag,
                datum: invoiceData.datum,
              });

          await db.insert(inkomendeFacturen).values({
            leverancier: invoiceData.leverancier,
            bedrag: invoiceData.bedrag,
            btwBedrag: invoiceData.btwBedrag,
            factuurnummer: invoiceData.factuurnummer,
            datum: invoiceData.datum,
            storageUrl: storagePath,
            emailId: msgRef.id,
            bankTransactieId: match?.tx.id ?? null,
            status: match ? "gematcht" : "onbekoppeld",
            verwerkOp: new Date().toISOString(),
          });

          // If matched, update the bank transaction with storageUrl
          if (match) {
            await db
              .update(bankTransacties)
              .set({ storageUrl: storagePath })
              .where(eq(bankTransacties.id, match.tx.id));
          }

          verwerkt++;
          resultaten.push({
            emailId: msgRef.id,
            onderwerp: subjectHeader,
            status: "verwerkt",
            leverancier: invoiceData.leverancier,
            bedrag: invoiceData.bedrag,
          });
        }
      } catch (emailError) {
        console.error(`Fout bij verwerken email ${msgRef.id}:`, emailError);
        resultaten.push({
          emailId: msgRef.id,
          onderwerp: "",
          status: "fout",
        });
      }
    }

    return NextResponse.json({
      succes: true,
      verwerkt,
      resultaten,
    });
  } catch (error) {
    console.error("Gmail sync fout:", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout bij Gmail sync" },
      { status: 500 }
    );
  }
}

// Recursively find PDF attachment parts in a Gmail message
function findPdfParts(
  payload: { mimeType?: string | null; filename?: string | null; body?: { attachmentId?: string | null; size?: number | null }; parts?: typeof payload[] } | null | undefined
): { filename: string | null; body: { attachmentId: string | null } }[] {
  if (!payload) return [];

  const results: { filename: string | null; body: { attachmentId: string | null } }[] = [];

  if (
    payload.mimeType === "application/pdf" &&
    payload.body?.attachmentId
  ) {
    results.push({
      filename: payload.filename ?? null,
      body: { attachmentId: payload.body.attachmentId },
    });
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      results.push(...findPdfParts(part));
    }
  }

  return results;
}

// Use Claude Sonnet Vision to analyze if a PDF is an invoice
async function analyzeInvoice(pdfBuffer: Buffer, filename: string): Promise<InvoiceData | null> {
  const anthropic = Anthropic(
    { apiKey: process.env.ANTHROPIC_API_KEY },
    "gmail-sync"
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
            text: `Is this an invoice, receipt, or credit note? If yes, extract structured data. If not (e.g. shipping confirmation, newsletter, contract, agreement), respond with exactly: {"isFactuur": false}.

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
- "bedrag" is the TOTAL amount (incl. BTW/tax) as it appears on the invoice, as a number without currency symbol.
- "currency" MUST be one of "EUR", "USD", "GBP". Look carefully at the currency symbol (€ = EUR, $ = USD, £ = GBP) or the explicit currency code on the invoice. NEVER assume EUR as default — if the invoice shows "$12.10" the currency is USD.
- "btwBedrag" is only non-null for Dutch invoices with NL BTW. For foreign / reverse-charge invoices (Anthropic Ireland, Google Ireland, US invoices) set it to 0 or null.
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
      btwBedrag?: number;
      factuurnummer?: string;
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

