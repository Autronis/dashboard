import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { uitgaven } from "@/lib/db/schema";
import Anthropic from "@anthropic-ai/sdk";

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

    const client = new Anthropic({ apiKey });
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

    return NextResponse.json({ uitgave, extracted: parsed }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message === "API key vereist" || message === "Ongeldige API key" ? 401 : 500;
    return NextResponse.json({ fout: message }, { status });
  }
}
