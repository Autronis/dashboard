import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sqlite, tursoClient } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// Unified DB helpers that work with both better-sqlite3 (sync) and Turso/libsql (async)
async function dbExec(query: string): Promise<void> {
  if (sqlite) {
    sqlite.exec(query);
  } else if (tursoClient) {
    await tursoClient.execute(query);
  }
}

async function dbRun(query: string, params: unknown[] = []): Promise<void> {
  if (sqlite) {
    sqlite.prepare(query).run(...params);
  } else if (tursoClient) {
    await tursoClient.execute({ sql: query, args: params });
  }
}

async function dbGet<T>(query: string, params: unknown[] = []): Promise<T | undefined> {
  if (sqlite) {
    return sqlite.prepare(query).get(...params) as T | undefined;
  } else if (tursoClient) {
    const result = await tursoClient.execute({ sql: query, args: params });
    if (result.rows.length === 0) return undefined;
    // libsql returns rows as arrays with column info — convert to object
    const row = result.rows[0];
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < result.columns.length; i++) {
      obj[result.columns[i]] = row[result.columns[i]] ?? row[i];
    }
    return obj as T;
  }
  return undefined;
}

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await dbExec(`CREATE TABLE IF NOT EXISTS mealplan_cache (
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

  const row = await dbGet<{ settings_json: string }>(
    "SELECT settings_json FROM mealplan_cache WHERE status = 'pending' LIMIT 1"
  );
  if (!row) return;

  isGenerating = true;
  await dbRun("UPDATE mealplan_cache SET status = 'generating', progress = 0");

  const params = JSON.parse(row.settings_json);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await dbRun("UPDATE mealplan_cache SET status = 'error'");
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
      await dbRun("UPDATE mealplan_cache SET progress = ?", [i + 1]);
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

    await dbRun("UPDATE mealplan_cache SET status = 'done', plan_json = ?, progress = 8", [JSON.stringify(plan)]);
  })().catch(async () => {
    try { await dbRun("UPDATE mealplan_cache SET status = 'error'"); } catch { /* ignore */ }
  }).finally(() => {
    isGenerating = false;
  });
}

// GET
export async function GET() {
  try {
    await ensureTable();

    const row = await dbGet<{ status: string; plan_json: string | null; progress: number }>(
      "SELECT status, plan_json, progress FROM mealplan_cache ORDER BY id DESC LIMIT 1"
    );
    if (!row) return NextResponse.json({ status: "none" });

    // Trigger background generation if pending
    if (row.status === "pending" || row.status === "generating") {
      triggerGeneration().catch(() => {});
    }

    if (row.status === "done" && row.plan_json) {
      return NextResponse.json({ status: "done", plan: JSON.parse(row.plan_json) });
    }
    return NextResponse.json({ status: row.status, progress: row.progress || 0 });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Onbekende fout" }, { status: 500 });
  }
}

// POST
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();

    const body = await req.json();
    await dbRun("DELETE FROM mealplan_cache");
    await dbRun("INSERT INTO mealplan_cache (status, settings_json) VALUES ('pending', ?)", [JSON.stringify(body)]);
    triggerGeneration().catch(() => {});

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Fout" }, { status: 500 });
  }
}
