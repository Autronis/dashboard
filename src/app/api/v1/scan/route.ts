import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { uitgaven, bankTransacties } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireApiKey(req);
    const formData = await req.formData();
    const file = formData.get("bon") as File | null;

    if (!file) {
      return NextResponse.json({ fout: "Geen bonnetje geüpload" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = file.type.startsWith("image/") ? file.type : "image/jpeg";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "ANTHROPIC_API_KEY niet geconfigureerd" }, { status: 500 });
    }

    const client = Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
          },
          {
            type: "text",
            text: `Analyseer dit bonnetje/factuur en geef de volgende informatie als JSON:
{
  "leverancier": "naam van de winkel/leverancier",
  "bedrag": 12.50,
  "btwBedrag": 2.17,
  "btwPercentage": 21,
  "datum": "2026-03-15",
  "categorie": "software|hardware|kantoor|reiskosten|marketing|onderwijs|telefoon|verzekeringen|accountant|overig",
  "omschrijving": "korte omschrijving van de aankoop"
}
Alleen JSON, geen uitleg.`,
          },
        ],
      }],
    });

    const tekst = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: {
      leverancier?: string; bedrag?: number; btwBedrag?: number;
      btwPercentage?: number; datum?: string; categorie?: string; omschrijving?: string;
    } = {};

    try {
      const match = tekst.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }

    const validCats = ["kantoor", "hardware", "software", "reiskosten", "marketing", "onderwijs", "telefoon", "verzekeringen", "accountant", "overig"] as const;
    type ValidCat = (typeof validCats)[number];
    const categorie: ValidCat = validCats.includes(parsed.categorie as ValidCat) ? (parsed.categorie as ValidCat) : "overig";

    const [uitgave] = await db
      .insert(uitgaven)
      .values({
        omschrijving: parsed.omschrijving || file.name,
        bedrag: parsed.bedrag || 0,
        datum: parsed.datum || new Date().toISOString().split("T")[0],
        categorie,
        leverancier: parsed.leverancier || null,
        btwBedrag: parsed.btwBedrag || null,
        btwPercentage: parsed.btwPercentage || 21,
        fiscaalAftrekbaar: 1,
        aangemaaktDoor: userId,
      })
      .returning()
      .all();

    // Save receipt image
    const uploadsDir = path.join(process.cwd(), "data", "uploads", "bonnetjes");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = mediaType.includes("png") ? ".png" : ".jpg";
    const fileName = `bon_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
    const bonPad = `data/uploads/bonnetjes/${fileName}`;

    // Auto-match with bank transaction (bedrag + naam)
    let matchedTransactie = null;
    if (parsed.bedrag || parsed.leverancier) {
      // Zoek op bedrag (±15%) OF op leveranciersnaam — pakt de beste match
      const amountMargin = (parsed.bedrag ?? 0) * 0.15;
      const leverancierLower = (parsed.leverancier ?? "").toLowerCase();

      const candidates = await db.select({
        id: bankTransacties.id,
        datum: bankTransacties.datum,
        omschrijving: bankTransacties.omschrijving,
        bedrag: bankTransacties.bedrag,
        merchantNaam: bankTransacties.merchantNaam,
      }).from(bankTransacties).where(
        and(
          eq(bankTransacties.type, "af"),
          sql`${bankTransacties.bonPad} IS NULL`,
          // Bedrag in range OF leverancier in naam/omschrijving
          parsed.bedrag && leverancierLower
            ? sql`(ABS(${bankTransacties.bedrag} - ${parsed.bedrag}) < ${amountMargin} OR LOWER(COALESCE(${bankTransacties.merchantNaam}, '') || ' ' || COALESCE(${bankTransacties.omschrijving}, '')) LIKE ${'%' + leverancierLower + '%'})`
            : parsed.bedrag
              ? sql`ABS(${bankTransacties.bedrag} - ${parsed.bedrag}) < ${amountMargin}`
              : sql`LOWER(COALESCE(${bankTransacties.merchantNaam}, '') || ' ' || COALESCE(${bankTransacties.omschrijving}, '')) LIKE ${'%' + leverancierLower + '%'}`
        )
      ).limit(10);

      if (candidates.length > 0) {
        const scored = candidates.map(m => {
          let score = 0;
          // Bedrag match (max 10 punten)
          if (parsed.bedrag) {
            score += Math.max(0, 10 - Math.abs(m.bedrag - parsed.bedrag) * 2);
          }
          // Datum match (max 5 punten)
          if (parsed.datum) {
            const diff = Math.abs(new Date(m.datum).getTime() - new Date(parsed.datum).getTime()) / 86400000;
            score += Math.max(0, 5 - diff * 2);
          }
          // Naam match (10 punten) — zoek in merchantNaam EN omschrijving
          const txText = ((m.merchantNaam || "") + " " + (m.omschrijving || "")).toLowerCase();
          if (leverancierLower && txText.includes(leverancierLower)) {
            score += 10;
          }
          return { ...m, score };
        }).sort((a, b) => b.score - a.score);

        matchedTransactie = scored[0];
        if (matchedTransactie.score >= 10) {
          await db.update(bankTransacties).set({
            bonPad,
            categorie: categorie,
            btwBedrag: parsed.btwBedrag || undefined,
            status: "gecategoriseerd",
          }).where(eq(bankTransacties.id, matchedTransactie.id));
        }
      }
    }

    return NextResponse.json({
      uitgave,
      extracted: parsed,
      bonPad,
      match: matchedTransactie ? {
        id: matchedTransactie.id,
        omschrijving: matchedTransactie.omschrijving,
        bedrag: matchedTransactie.bedrag,
        autoGekoppeld: (matchedTransactie as unknown as { score: number }).score >= 10,
      } : null,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message === "API key vereist" || message === "Ongeldige API key" ? 401 : 500;
    return NextResponse.json({ fout: message }, { status });
  }
}
