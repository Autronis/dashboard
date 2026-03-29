import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.run(sql`CREATE TABLE IF NOT EXISTS mealplan_cache (
    id INTEGER PRIMARY KEY,
    status TEXT DEFAULT 'idle',
    plan_json TEXT,
    settings_json TEXT,
    progress INTEGER DEFAULT 0,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`);
  tableReady = true;
}

let isGenerating = false;

const DAGEN = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

async function generateDay(client: Anthropic, dag: string, params: Record<string, unknown>, vorigeDagen: string[]): Promise<unknown> {
  const { kcal, eiwit, koolhydraten, vezels, suiker, vet, voorkeuren, uitsluitingen } = params;
  const variatieHint = vorigeDagen.length > 0
    ? `\nVARIATIE: Je hebt al gemaakt: ${vorigeDagen.join(", ")}. Kies ANDERE gerechten.`
    : "";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `Dagplan voor ${dag}. Targets: ${kcal}kcal/${eiwit}E/${koolhydraten}KH/${vet}V/${vezels}vez/${suiker}suik.
${voorkeuren ? `Voorkeuren: ${voorkeuren}` : ""}${uitsluitingen ? ` Niet: ${uitsluitingen}` : ""}${variatieHint}

5 maaltijden. Compleet gerecht met bereiding. Max 3 ingredienten per maaltijd. Lidl.

JSON: {"dag":"${dag}","maaltijden":[{"type":"ontbijt","naam":"X","beschrijving":"bereiding","ingredienten":[{"naam":"X","hoeveelheid":"80g","kcal":296,"eiwit":10,"kh":48,"vet":6,"vezels":8,"suiker":1}],"totaal":{"kcal":650,"eiwit":45,"kh":80,"vet":15,"vezels":12,"suiker":15}}],"dagTotaal":{"kcal":${kcal},"eiwit":${eiwit},"kh":${koolhydraten},"vet":${vet},"vezels":${vezels},"suiker":${suiker}}}
Alleen JSON.`,
    }],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Geen JSON voor ${dag}`);
  return JSON.parse(match[0]);
}

async function generateBoodschappen(client: Anthropic, params: Record<string, unknown>): Promise<{ boodschappenlijst: unknown[]; totaalPrijs: number }> {
  const { kcal, eiwit, koolhydraten, vet } = params;
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Boodschappenlijst voor een week mealprep. Dagelijks: ${kcal}kcal/${eiwit}E/${koolhydraten}KH/${vet}V. Lidl producten, hele verpakkingen, realistische prijzen.

JSON: {"boodschappenlijst":[{"product":"Havermout (Lidl)","hoeveelheid":"1 pak","prijs":0.89,"afdeling":"ontbijt"}],"totaalPrijs":65}
Max 25 items. Alleen JSON.`,
    }],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { boodschappenlijst: [], totaalPrijs: 0 };
  return JSON.parse(match[0]);
}

async function triggerGeneration() {
  if (isGenerating) return;
  await ensureTable();

  const rows = await db.all<{ settings_json: string }>(
    sql`SELECT settings_json FROM mealplan_cache WHERE status = 'pending' LIMIT 1`
  );
  const row = rows[0];
  if (!row) return;

  isGenerating = true;
  await db.run(sql`UPDATE mealplan_cache SET status = 'generating', progress = 0`);

  const params = JSON.parse(row.settings_json);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await db.run(sql`UPDATE mealplan_cache SET status = 'error'`);
    isGenerating = false;
    return;
  }

  const client = new Anthropic({ apiKey });

  (async () => {
    const dagen: unknown[] = [];
    const dagNamen: string[] = [];

    for (let i = 0; i < DAGEN.length; i++) {
      const dag = await generateDay(client, DAGEN[i], params, dagNamen);
      dagen.push(dag);
      dagNamen.push(DAGEN[i]);
      await db.run(sql`UPDATE mealplan_cache SET progress = ${i + 1}`);
    }

    const boodschappen = await generateBoodschappen(client, params);

    const plan = {
      dagen,
      boodschappenlijst: boodschappen.boodschappenlijst,
      totaalPrijs: boodschappen.totaalPrijs,
      weekTotaal: {
        kcal: (params.kcal as number) * 7,
        eiwit: (params.eiwit as number) * 7,
        kh: (params.koolhydraten as number) * 7,
        vet: (params.vet as number) * 7,
        vezels: (params.vezels as number) * 7,
        suiker: (params.suiker as number) * 7,
      },
    };

    const planJson = JSON.stringify(plan);
    await db.run(sql`UPDATE mealplan_cache SET status = 'done', plan_json = ${planJson}, progress = 8`);
  })().catch(async () => {
    try { await db.run(sql`UPDATE mealplan_cache SET status = 'error'`); } catch { /* ignore */ }
  }).finally(() => {
    isGenerating = false;
  });
}

// GET
export async function GET() {
  await ensureTable();
  await triggerGeneration();

  const rows = await db.all<{ status: string; plan_json: string | null; progress: number }>(
    sql`SELECT status, plan_json, progress FROM mealplan_cache ORDER BY id DESC LIMIT 1`
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ status: "none" });
  if (row.status === "done" && row.plan_json) {
    return NextResponse.json({ status: "done", plan: JSON.parse(row.plan_json) });
  }
  return NextResponse.json({ status: row.status, progress: row.progress || 0 });
}

// POST
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();

    const body = await req.json();
    await db.run(sql`DELETE FROM mealplan_cache`);
    const settingsJson = JSON.stringify(body);
    await db.run(sql`INSERT INTO mealplan_cache (status, settings_json) VALUES ('pending', ${settingsJson})`);
    await triggerGeneration();

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Fout" }, { status: 500 });
  }
}
