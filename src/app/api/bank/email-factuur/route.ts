import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/bank/email-factuur
// Accepts: forwarded email with PDF attachment, or direct PDF upload
// Can be called by:
// 1. Resend inbound webhook (email forwarding)
// 2. Manual upload from dashboard
// 3. Zapier/Make.com automation
export async function POST(req: NextRequest) {
  // Auth via API key (for webhooks/automations)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.SESSION_SECRET) {
    try {
      const { requireAuth } = await import("@/lib/auth");
      await requireAuth();
    } catch {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";

    let pdfBase64: string | null = null;
    let pdfFileName = "factuur.pdf";
    let emailFrom = "";
    let emailSubject = "";

    if (contentType.includes("multipart/form-data")) {
      // Direct upload or Resend webhook
      const formData = await req.formData();
      const file = formData.get("factuur") as File | null;
      emailFrom = (formData.get("from") as string) ?? "";
      emailSubject = (formData.get("subject") as string) ?? "";

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        pdfBase64 = buffer.toString("base64");
        pdfFileName = file.name;
      }
    } else {
      // JSON body with base64
      const body = await req.json() as {
        pdfBase64?: string;
        fileName?: string;
        from?: string;
        subject?: string;
      };
      pdfBase64 = body.pdfBase64 ?? null;
      pdfFileName = body.fileName ?? "factuur.pdf";
      emailFrom = body.from ?? "";
      emailSubject = body.subject ?? "";
    }

    if (!pdfBase64) {
      return NextResponse.json({ fout: "Geen factuur PDF meegestuurd" }, { status: 400 });
    }

    // Save PDF to Supabase Storage
    const { uploadToStorage } = await import("@/lib/supabase");
    const year = new Date().getFullYear();
    const fileName = `factuur_${Date.now()}_${pdfFileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const storagePath = `${year}/facturen-inkomend/${fileName}`;
    await uploadToStorage(storagePath, Buffer.from(pdfBase64, "base64"), "application/pdf");
    const factuurPad = storagePath;

    // Parse PDF with Claude Vision (first page as image)
    // For now, use the filename + email context to extract info
    const parsePrompt = `Analyseer deze inkomende factuur. Context:
- Van: ${emailFrom || "onbekend"}
- Onderwerp: ${emailSubject || "onbekend"}
- Bestandsnaam: ${pdfFileName}

Geef als JSON:
{
  "leverancier": "naam van de leverancier",
  "bedrag": 123.45,
  "btwBedrag": 21.43,
  "factuurnummer": "INV-2026-001",
  "datum": "2026-03-31",
  "isBuitenlands": true/false
}
Alleen JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: parsePrompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    let parsed: { leverancier?: string; bedrag?: number; btwBedrag?: number; factuurnummer?: string; datum?: string; isBuitenlands?: boolean } = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { /* fallback */ }

    // Auto-match with bank transaction
    let match = null;
    if (parsed.bedrag) {
      const margin = parsed.bedrag * 0.05; // 5% margin for exact invoice amounts
      const matches = await db.select({
        id: bankTransacties.id,
        datum: bankTransacties.datum,
        omschrijving: bankTransacties.omschrijving,
        bedrag: bankTransacties.bedrag,
        merchantNaam: bankTransacties.merchantNaam,
        bonPad: bankTransacties.bonPad,
      }).from(bankTransacties).where(
        and(
          eq(bankTransacties.type, "af"),
          sql`ABS(${bankTransacties.bedrag} - ${parsed.bedrag}) < ${margin}`,
          sql`${bankTransacties.bonPad} IS NULL`
        )
      ).limit(3);

      if (matches.length > 0) {
        const best = matches.sort((a, b) => Math.abs(a.bedrag - (parsed.bedrag ?? 0)) - Math.abs(b.bedrag - (parsed.bedrag ?? 0)))[0];
        match = best;

        // Auto-link
        await db.update(bankTransacties).set({
          bonPad: factuurPad,
          storageUrl: storagePath,
          status: "gematcht",
          isVerlegging: parsed.isBuitenlands ? 1 : undefined,
          btwBedrag: parsed.btwBedrag || undefined,
        }).where(eq(bankTransacties.id, best.id));
      }
    }

    return NextResponse.json({
      succes: true,
      factuurPad,
      parsed,
      match: match ? {
        id: match.id,
        omschrijving: match.omschrijving,
        bedrag: match.bedrag,
        status: "auto-gematcht",
      } : null,
      status: match ? "gematcht" : "handmatig",
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Verwerking mislukt" },
      { status: 500 }
    );
  }
}
