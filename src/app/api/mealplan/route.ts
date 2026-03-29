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

  const eerderGebruikt = vorigeDagen.length > 0
    ? `\n\nEERDER GEBRUIKT (kies COMPLEET ANDERE gerechten): ${vorigeDagen.join(", ")}`
    : "";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 5000,
    messages: [{
      role: "user",
      content: `Maak een dagplan voor ${dag}. Macro targets per dag: ${kcal} kcal, ${eiwit}g eiwit, ${koolhydraten}g koolhydraten, ${vet}g vet, ${vezels}g vezels, ${suiker}g suiker.
${voorkeuren ? `\nVoorkeuren: ${voorkeuren}` : ""}${uitsluitingen ? `\nUitsluitingen: ${uitsluitingen}` : ""}${eerderGebruikt}

BELANGRIJK — elk maaltijdtype moet passen bij het moment van de dag:
- **ontbijt**: Ontbijtgerechten! Denk aan havermout, yoghurt met fruit, eieren (roerei/omelet/gebakken), brood met beleg, smoothiebowl, pannenkoeken, overnight oats, muesli. NOOIT een warm diner als ontbijt.
- **lunch**: Lichte maaltijden! Denk aan wraps, salades, broodjes, soep, tosti's, bowl met rijst/quinoa, quesadilla, pasta salade. GEEN zware warme maaltijden.
- **tussendoor**: Snacks! Denk aan noten, fruit, rijstwafels met pindakaas, yoghurt, eiwitreep, hummus met groente, trail mix, cottage cheese, crackers. GEEN warme maaltijden.
- **avondeten**: De enige warme hoofdmaaltijd van de dag. Denk aan pasta, rijst met kip/gehakt, wok, curry, ovenschotel, aardappelen met groente en vlees, burrito bowl, stir-fry.
- **avondsnack**: Licht! Denk aan kwark met honing, caseine shake, noten, fruit, rijstwafel, pindakaas toast, schaaltje yoghurt.

Zorg voor VARIATIE in eiwitbronnen door de dag heen (niet alles kip). Gebruik realistische hoeveelheden.
Alle producten moeten bij de Lidl te koop zijn.

Geef per ingrediënt de exacte hoeveelheid in grammen en de macro's per die hoeveelheid.

JSON formaat (ALLEEN JSON, geen tekst ervoor of erna):
{"dag":"${dag}","maaltijden":[{"type":"ontbijt","naam":"Havermout met banaan en pindakaas","beschrijving":"Kook havermout in water, snijd banaan in plakjes, roer pindakaas erdoor.","ingredienten":[{"naam":"Havermout","hoeveelheid":"80g","kcal":296,"eiwit":10,"kh":48,"vet":6,"vezels":8,"suiker":1},{"naam":"Banaan","hoeveelheid":"1 stuk (120g)","kcal":107,"eiwit":1,"kh":23,"vet":0,"vezels":3,"suiker":12},{"naam":"Pindakaas","hoeveelheid":"20g","kcal":118,"eiwit":5,"kh":3,"vet":10,"vezels":1,"suiker":1}],"totaal":{"kcal":521,"eiwit":16,"kh":74,"vet":16,"vezels":12,"suiker":14}}],"dagTotaal":{"kcal":${kcal},"eiwit":${eiwit},"kh":${koolhydraten},"vet":${vet},"vezels":${vezels},"suiker":${suiker}}}`,
    }],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Geen JSON voor ${dag}`);
  return JSON.parse(match[0]);
}

async function generateBoodschappen(client: Anthropic, dagen: unknown[]): Promise<{ boodschappenlijst: unknown[]; totaalPrijs: number }> {
  // Collect all ingredients from the plan to create an accurate shopping list
  const alleIngredienten: Record<string, number> = {};
  for (const dag of dagen) {
    try {
      const d = dag as { maaltijden?: { ingredienten?: { naam?: string; hoeveelheid?: string }[] }[] };
      if (!d.maaltijden) continue;
      for (const maaltijd of d.maaltijden) {
        if (!maaltijd.ingredienten) continue;
        for (const ing of maaltijd.ingredienten) {
          const naam = (ing.naam || "onbekend").toLowerCase();
          const grams = parseFloat(ing.hoeveelheid || "100") || 100;
          alleIngredienten[naam] = (alleIngredienten[naam] || 0) + grams;
        }
      }
    } catch { continue; }
  }

  const ingredientenSamenvatting = Object.entries(alleIngredienten)
    .map(([naam, gram]) => `${naam}: ${Math.round(gram)}g totaal`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: `Maak een Lidl boodschappenlijst voor deze weekingrediënten:

${ingredientenSamenvatting}

REGELS:
- Reken uit hoeveel VERPAKKINGEN je nodig hebt (bijv. 3.5kg kip nodig → 4 pakken kipfilet van 1kg)
- Gebruik echte Lidl producten met realistische Nederlandse Lidl prijzen (2024/2025)
- Groepeer per afdeling (zuivel, vlees/vis, groente/fruit, droog/conserven, diepvries, overig)
- Rond hoeveelheden omhoog af naar hele verpakkingen
- Bereken de totaalprijs correct (som van alle producten)

JSON formaat (ALLEEN JSON):
{"boodschappenlijst":[{"product":"Kipfilet (1kg)","hoeveelheid":"4 pakken","prijs":5.99,"afdeling":"vlees/vis"}],"totaalPrijs":82.50}`,
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

    // Shopping list — if it fails, still save the plan without it
    let boodschappenlijst: unknown[] = [];
    let totaalPrijs = 0;
    try {
      const boodschappen = await generateBoodschappen(client, dagen);
      boodschappenlijst = boodschappen.boodschappenlijst;
      totaalPrijs = boodschappen.totaalPrijs;
    } catch {
      // Boodschappenlijst failed — save plan without it
    }

    const plan = {
      dagen,
      boodschappenlijst,
      totaalPrijs,
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
  })().catch(async (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Onbekend";
    try { await dbRun("UPDATE mealplan_cache SET status = 'error', plan_json = ?", [JSON.stringify({ fout: msg })]); } catch { /* ignore */ }
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
