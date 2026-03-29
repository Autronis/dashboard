import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// Ensure table at module load
if (sqlite) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS mealplan_cache (
    id INTEGER PRIMARY KEY,
    status TEXT DEFAULT 'idle',
    plan_json TEXT,
    settings_json TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`);
}

// Module-level generation — completely independent of any request
let isGenerating = false;

function triggerGeneration() {
  if (isGenerating || !sqlite) return;

  const row = sqlite.prepare("SELECT settings_json FROM mealplan_cache WHERE status = 'pending' LIMIT 1").get() as { settings_json: string } | undefined;
  if (!row) return;

  isGenerating = true;
  sqlite.prepare("UPDATE mealplan_cache SET status = 'generating'").run();

  const params = JSON.parse(row.settings_json);
  const { kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen } = params;

  const client = new Anthropic();
  client.messages.create({
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

REGELS:
- Beschrijf elke maaltijd als COMPLEET GERECHT. Bijv: "Havermout bowl: 80g havermout gekookt in 200ml halfvolle melk, 1 schep whey protein erdoor, 1 banaan in plakjes, 15g pindakaas"
- Varieer per dag
- 5 maaltijden per dag: ontbijt, lunch, tussendoor, avondeten, avondsnack
- Nederlands/simpel eten, Lidl producten

JSON format:
{
  "dagen": [
    {
      "dag": "Maandag",
      "maaltijden": [
        {
          "type": "ontbijt",
          "naam": "Naam gerecht",
          "beschrijving": "Volledige bereiding met hoeveelheden",
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
    { "product": "Havermout (Lidl)", "hoeveelheid": "1 pak (500g)", "prijs": 0.89, "afdeling": "ontbijt" }
  ],
  "totaalPrijs": 65.50,
  "weekTotaal": { "kcal": 19250, "eiwit": 1330, "kh": 2100, "vet": 770, "vezels": 210, "suiker": 420 }
}

Hele verpakkingen bij boodschappen. Lidl merken/prijzen. Max 5% afwijking per dag. Alleen JSON.`,
    }],
  }).then((response) => {
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Geen response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Geen JSON");
    const plan = JSON.parse(jsonMatch[0]);
    sqlite!.prepare("UPDATE mealplan_cache SET status = 'done', plan_json = ?").run(JSON.stringify(plan));
  }).catch(() => {
    sqlite!.prepare("UPDATE mealplan_cache SET status = 'error'").run();
  }).finally(() => {
    isGenerating = false;
  });
}

// GET — poll for status
export async function GET() {
  if (!sqlite) return NextResponse.json({ status: "none" });

  // Check if there's a pending job to start
  triggerGeneration();

  const row = sqlite.prepare("SELECT status, plan_json FROM mealplan_cache ORDER BY id DESC LIMIT 1").get() as { status: string; plan_json: string | null } | undefined;
  if (!row) return NextResponse.json({ status: "none" });
  if (row.status === "done" && row.plan_json) {
    return NextResponse.json({ status: "done", plan: JSON.parse(row.plan_json) });
  }
  return NextResponse.json({ status: row.status });
}

// POST — save settings, mark pending
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    if (!sqlite) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });

    const body = await req.json();
    const settingsJson = JSON.stringify(body);

    sqlite.prepare("DELETE FROM mealplan_cache").run();
    sqlite.prepare("INSERT INTO mealplan_cache (status, settings_json) VALUES ('pending', ?)").run(settingsJson);

    // Try to start immediately
    triggerGeneration();

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Fout" }, { status: 500 });
  }
}
