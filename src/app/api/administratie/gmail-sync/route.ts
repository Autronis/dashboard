import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens, inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { eq, and, isNull, between } from "drizzle-orm";
import { getOAuth2Client } from "@/lib/google-calendar";
import { uploadToStorage } from "@/lib/supabase";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

interface InvoiceData {
  leverancier: string;
  bedrag: number;
  btwBedrag: number | null;
  factuurnummer: string | null;
  datum: string;
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

    // Search for emails with PDF attachments from last 48h.
    // Cron runs hourly so 48h gives an overlap window: stragglers that arrive
    // right after one run still get picked up by the next. The dedupe on
    // email_id makes re-scanning safe and idempotent.
    const listResult = await gmail.users.messages.list({
      userId: "me",
      q: "has:attachment filename:pdf newer_than:2d",
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

          // Upload PDF to Supabase Storage
          const year = new Date().getFullYear();
          const timestamp = Date.now();
          const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `${year}/facturen-inkomend/${timestamp}_${safeFilename}`;

          await uploadToStorage(storagePath, pdfBuffer, "application/pdf");

          // Auto-match with bank transaction (type "af", ±5% amount, no existing storageUrl/bonPad)
          const matchedTransactie = await findMatchingTransaction(invoiceData.bedrag);

          // Create inkomendeFacturen record
          const status = matchedTransactie ? "gematcht" : "onbekoppeld";

          await db.insert(inkomendeFacturen).values({
            leverancier: invoiceData.leverancier,
            bedrag: invoiceData.bedrag,
            btwBedrag: invoiceData.btwBedrag,
            factuurnummer: invoiceData.factuurnummer,
            datum: invoiceData.datum,
            storageUrl: storagePath,
            emailId: msgRef.id,
            bankTransactieId: matchedTransactie?.id ?? null,
            status,
            verwerkOp: new Date().toISOString(),
          });

          // If matched, update the bank transaction with storageUrl
          if (matchedTransactie) {
            await db
              .update(bankTransacties)
              .set({ storageUrl: storagePath })
              .where(eq(bankTransacties.id, matchedTransactie.id));
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
            text: 'Is this an invoice? If yes, extract leverancier, bedrag, btwBedrag, factuurnummer, datum as JSON. If not an invoice, respond with exactly: {"isFactuur": false}. If it IS an invoice, respond with: {"isFactuur": true, "leverancier": "...", "bedrag": 123.45, "btwBedrag": 21.00, "factuurnummer": "...", "datum": "YYYY-MM-DD"}. Only respond with valid JSON, nothing else.',
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
    };

    if (!parsed.isFactuur || !parsed.leverancier || !parsed.bedrag || !parsed.datum) {
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

// Find matching bank transaction (type "af", ±5% amount, no storageUrl or bonPad)
async function findMatchingTransaction(bedrag: number) {
  const lowerBound = bedrag * 0.95;
  const upperBound = bedrag * 1.05;

  // Use negative amount for "af" transactions (money going out)
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

  // Also try with positive amount matching
  if (matches.length === 0) {
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

  return matches[0] ?? null;
}
