import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  if (sqlite) {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS mealplan_cache (
      id INTEGER PRIMARY KEY,
      status TEXT DEFAULT 'generating',
      plan_json TEXT,
      settings_json TEXT NOT NULL,
      aangemaakt_op TEXT DEFAULT (datetime('now'))
    )`);
  } else {
    await db.run(sql`CREATE TABLE IF NOT EXISTS mealplan_cache (
      id INTEGER PRIMARY KEY,
      status TEXT DEFAULT 'generating',
      plan_json TEXT,
      settings_json TEXT NOT NULL,
      aangemaakt_op TEXT DEFAULT (datetime('now'))
    )`);
  }
  tableReady = true;
}

// GET — poll for result
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();
    const rows = await db.all(sql`SELECT status, plan_json, settings_json FROM mealplan_cache ORDER BY id DESC LIMIT 1`) as { status: string; plan_json: string | null; settings_json: string }[];
    if (rows.length === 0) return NextResponse.json({ status: "none" });
    const row = rows[0];
    if (row.status === "generating") return NextResponse.json({ status: "generating" });
    return NextResponse.json({
      status: "done",
      plan: row.plan_json ? JSON.parse(row.plan_json) : null,
      settings: JSON.parse(row.settings_json),
    });
  } catch {
    return NextResponse.json({ status: "none" });
  }
}

// POST — start generation (returns immediately, generates in background)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen } = body as {
      kcal: number; eiwit: number; koolhydraten: number; vezels: number;
      suiker: number; vet: number; voorkeuren?: string; uitsluitingen?: string;
    };

    await ensureTable();
    const settingsJson = JSON.stringify({ kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen });

    // Clear old and insert generating status
    await db.run(sql`DELETE FROM mealplan_cache`);
    await db.run(sql`INSERT INTO mealplan_cache (status, settings_json) VALUES ('generating', ${settingsJson})`);

    // Fire and forget — server-side, doesn't depend on client
    generateInBackground({ kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen }).catch(() => {
      try { db.run(sql`UPDATE mealplan_cache SET status = 'error'`); } catch { /* ignore */ }
    });

    return NextResponse.json({ status: "generating" });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Onbekende fout" }, { status: 500 });
  }
}

async function generateInBackground(params: {
  kcal: number; eiwit: number; koolhydraten: number; vezels: number;
  suiker: number; vet: number; voorkeuren?: string; uitsluitingen?: string;
}) {
  const { kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen } = params;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    messages: [{
      role: "user",
      content: `Maak een WEEKPLAN (maandag t/m zondag) met elke dag deze macro's:
- ${kcal} kcal
- ${eiwit}g eiwit
- ${koolhydraten}g koolhydraten
- ${vezels}g vezels
- ${suiker}g suiker
- ${vet}g vet

${voorkeuren ? `Voorkeuren: ${voorkeuren}` : ""}
${uitsluitingen ? `Uitsluitingen (NIET gebruiken): ${uitsluitingen}` : ""}

BELANGRIJKE REGELS:
- Beschrijf elke maaltijd als een COMPLEET GERECHT, niet los ingredienten. Bijv: "Havermout bowl: 80g havermout gekookt in 200ml halfvolle melk, 1 schep whey protein erdoor, 1 banaan in plakjes, 15g pindakaas"
- Varieer per dag (niet elke dag hetzelfde)
- 5 maaltijden per dag: ontbijt, lunch, tussendoor, avondeten, avondsnack
- Nederlands/simpel eten, makkelijk te bereiden
- Realistisch: dingen die je bij de Lidl kan kopen

Antwoord als JSON:
{
  "dagen": [
    {
      "dag": "Maandag",
      "maaltijden": [
        {
          "type": "ontbijt",
          "naam": "Havermout bowl met banaan en pindakaas",
          "beschrijving": "Kook 80g havermout in 200ml halfvolle melk. Roer 1 schep (30g) whey protein erdoor. Top met 1 banaan in plakjes en 15g pindakaas.",
          "ingredienten": [
            { "naam": "Havermout", "hoeveelheid": "80g", "kcal": 296, "eiwit": 10, "kh": 48, "vet": 6, "vezels": 8, "suiker": 1 }
          ],
          "totaal": { "kcal": 650, "eiwit": 45, "kh": 80, "vet": 15, "vezels": 12, "suiker": 15 }
        }
      ],
      "dagTotaal": { "kcal": 2750, "eiwit": 190, "kh": 300, "vet": 110, "vezels": 30, "suiker": 60 }
    }
  ],
  "boodschappenlijst": [
    { "product": "Havermout (Krokante Havermout, Lidl)", "hoeveelheid": "1 pak (500g)", "prijs": 0.89, "afdeling": "ontbijt" }
  ],
  "totaalPrijs": 65.50,
  "weekTotaal": { "kcal": 19250, "eiwit": 1330, "kh": 2100, "vet": 770, "vezels": 210, "suiker": 420 }
}

BOODSCHAPPENLIJST REGELS:
- Bereken hoeveel je voor de HELE WEEK nodig hebt
- Rond af naar hele verpakkingen (je koopt geen 80g havermout, je koopt een pak van 500g)
- Gebruik Lidl productnamen en merken (Milbona, Pikok, etc.)
- Schat realistische Lidl prijzen in euro's
- Groepeer per afdeling (zuivel, vlees, groente, ontbijt, etc.)

Zorg dat elke dag zo dicht mogelijk bij de targets zit (max 5% afwijking). Alleen JSON, geen uitleg.`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Geen response");

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Ongeldige response");

  const plan = JSON.parse(jsonMatch[0]);
  const settingsJson = JSON.stringify(params);

  await db.run(sql`DELETE FROM mealplan_cache`);
  await db.run(sql`INSERT INTO mealplan_cache (status, plan_json, settings_json) VALUES ('done', ${JSON.stringify(plan)}, ${settingsJson})`);
}
