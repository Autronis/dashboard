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
  } else {
    console.error("[MEALPLAN] dbRun: no database connection! sqlite:", !!sqlite, "turso:", !!tursoClient);
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
  // Add progress column if missing (table existed before this column was added)
  try { await dbExec("ALTER TABLE mealplan_cache ADD COLUMN progress INTEGER DEFAULT 0"); } catch { /* already exists */ }
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

// Normalize ingredient names so "Kipfilet", "kipfilet", "Kip filet" all merge
function normalizeIngredient(naam: string): string {
  return naam.toLowerCase().trim()
    .replace(/\s*\(.*?\)\s*/g, "") // remove "(lidl)", "(gekookt)" etc
    .replace(/\s+/g, " ");
}

async function generateBoodschappen(client: Anthropic, dagen: unknown[]): Promise<{ boodschappenlijst: unknown[]; totaalPrijs: number }> {
  // Step 1: Collect ALL ingredients from the 7-day plan with total grams
  const alleIngredienten: Record<string, { gram: number; count: number }> = {};
  for (const dag of dagen) {
    try {
      const d = dag as { maaltijden?: { ingredienten?: { naam?: string; hoeveelheid?: string }[] }[] };
      if (!d.maaltijden) continue;
      for (const maaltijd of d.maaltijden) {
        if (!maaltijd.ingredienten) continue;
        for (const ing of maaltijd.ingredienten) {
          const naam = normalizeIngredient(ing.naam || "onbekend");
          // Parse grams - handle "80g", "1 stuk (120g)", "150ml", "2 stuks", etc
          const hoeveelheid = ing.hoeveelheid || "100g";
          let gram = parseFloat(hoeveelheid) || 0;
          // If it says "stuks" or "stuk" without grams, estimate
          if (gram === 0 || (hoeveelheid.includes("stuk") && gram < 10)) {
            gram = 150; // default per stuk
          }
          // "ml" roughly equals grams for most liquids
          if (!alleIngredienten[naam]) {
            alleIngredienten[naam] = { gram: 0, count: 0 };
          }
          alleIngredienten[naam].gram += gram;
          alleIngredienten[naam].count += 1;
        }
      }
    } catch { continue; }
  }

  // Step 2: Format as numbered list so AI can't skip any
  const entries = Object.entries(alleIngredienten)
    .sort((a, b) => b[1].gram - a[1].gram);

  const ingredientenLijst = entries
    .map(([naam, { gram, count }], idx) => {
      const kgDisplay = gram >= 1000 ? `${(gram / 1000).toFixed(1)}kg` : `${Math.round(gram)}g`;
      return `${idx + 1}. ${naam} — ${kgDisplay} totaal (${count}x gebruikt in weekplan)`;
    })
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `Hier zijn ALLE ${entries.length} ingrediënten die ik nodig heb voor mijn weekmenu. Maak een complete Lidl boodschappenlijst.

${ingredientenLijst}

REGELS:
1. ELKE ingrediënt hierboven MOET terug te vinden zijn in de boodschappenlijst. Sla NIETS over.
2. Gebruik echte Lidl producten en verpakkingsgroottes (bijv. kipfilet 500g pak, havermout 500g pak, melk 1L, eieren doos 10 stuks)
3. Rond ALTIJD OMHOOG af naar hele verpakkingen (1.2kg kip nodig → 3 pakken van 500g)
4. "hoeveelheid" = hoeveel verpakkingen ik moet kopen (bijv. "2 pakken", "3 zakken", "1 doos")
5. "nodig" = hoeveel ik daadwerkelijk gebruik voor de recepten (bijv. "1.2kg", "8 stuks", "350ml")
6. "over" = VERPLICHT — wat er overblijft na de week. BEREKEN DIT ALTIJD: gekocht hoeveelheid minus nodig. Bijv: 3 pakken van 500g = 1500g gekocht, 1200g nodig → "300g" over. Als precies op, zet "0". NOOIT leeg laten!
7. "prijs" = TOTAALPRIJS voor die hoeveelheid verpakkingen
8. "prijsPerEenheid" = prijs per verpakking (bijv. "€5.99/kg", "€1.29/pak", "€2.49/L")
9. Realistische Nederlandse Lidl prijzen (2026).
10. Combineer vergelijkbare items waar logisch, maar houd vlees/zuivel/granen apart
11. "totaalPrijs" = exacte som van alle "prijs" waarden
12. "overWaarde" = geschatte geldwaarde van wat er overblijft (bijv. als 300g van een 500g pak over is → 60% van de pakprijs)

JSON (ALLEEN JSON, geen tekst):
{"boodschappenlijst":[{"product":"Kipfilet","hoeveelheid":"3 pakken (500g)","nodig":"1.2kg","over":"300g","overWaarde":1.99,"prijs":11.97,"prijsPerEenheid":"€3.99/pak","afdeling":"vlees/vis"}],"totaalPrijs":85.50,"totaalOverWaarde":12.50}`,
    }],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { boodschappenlijst: [], totaalPrijs: 0 };

  const result = JSON.parse(match[0]);

  // Recalculate totaalPrijs to avoid AI math errors
  if (Array.isArray(result.boodschappenlijst)) {
    result.totaalPrijs = result.boodschappenlijst.reduce(
      (sum: number, item: { prijs?: number }) => sum + (Number(item.prijs) || 0), 0
    );
    result.totaalPrijs = Math.round(result.totaalPrijs * 100) / 100;
  }

  return result;
}

async function triggerGeneration() {
  if (isGenerating) return;
  await ensureTable();

  // Pick up 'pending' OR stale 'generating' (server restarted mid-generation)
  let row = await dbGet<{ settings_json: string; status: string; progress: number; aangemaakt_op: string }>(
    "SELECT settings_json, status, progress, aangemaakt_op FROM mealplan_cache WHERE status = 'pending' LIMIT 1"
  );

  if (!row) {
    // Check for stuck 'generating' — if isGenerating is false, the process died
    row = await dbGet<{ settings_json: string; status: string; progress: number; aangemaakt_op: string }>(
      "SELECT settings_json, status, progress, aangemaakt_op FROM mealplan_cache WHERE status = 'generating' LIMIT 1"
    );
    if (!row) return;
    // Reset to pending so we restart from scratch
    await dbRun("UPDATE mealplan_cache SET status = 'pending', progress = 0");
  }

  isGenerating = true;
  await dbRun("UPDATE mealplan_cache SET status = 'generating', progress = 0, aangemaakt_op = datetime('now')");

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
    } catch (boodschapErr) {
      console.error("[MEALPLAN] Boodschappenlijst generatie mislukt:", boodschapErr instanceof Error ? boodschapErr.message : boodschapErr);
    }

    // Calculate real week totals from actual day data
    const weekTotaal = { kcal: 0, eiwit: 0, kh: 0, vet: 0, vezels: 0, suiker: 0 };
    for (const dag of dagen) {
      try {
        const d = dag as { dagTotaal?: { kcal?: number; eiwit?: number; kh?: number; vet?: number; vezels?: number; suiker?: number } };
        if (d.dagTotaal) {
          weekTotaal.kcal += d.dagTotaal.kcal ?? 0;
          weekTotaal.eiwit += d.dagTotaal.eiwit ?? 0;
          weekTotaal.kh += d.dagTotaal.kh ?? 0;
          weekTotaal.vet += d.dagTotaal.vet ?? 0;
          weekTotaal.vezels += d.dagTotaal.vezels ?? 0;
          weekTotaal.suiker += d.dagTotaal.suiker ?? 0;
        }
      } catch { /* skip */ }
    }

    const plan = {
      dagen,
      boodschappenlijst,
      totaalPrijs,
      weekTotaal,
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
