import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sqlite, tursoClient } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// Allow up to 5 minutes for full plan + boodschappenlijst generation
export const maxDuration = 300;

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

async function generateDay(client: Anthropic, dag: string, params: Record<string, unknown>, vorigeDagen: { dag: string; gerechten: string[] }[]): Promise<unknown> {
  const kcal = Number(params.kcal) || 2750;
  const eiwit = Number(params.eiwit) || 190;
  const koolhydraten = Number(params.koolhydraten) || 300;
  const vezels = Number(params.vezels) || 30;
  const suiker = Number(params.suiker) || 60;
  const vet = Number(params.vet) || 110;
  const voorkeuren = String(params.voorkeuren || "");
  const uitsluitingen = String(params.uitsluitingen || "");
  const restjes = params.restjes;

  const eerderGebruikt = vorigeDagen.length > 0
    ? `\n\nEERDER GEBRUIKTE GERECHTEN (kies COMPLEET ANDERE gerechten en ingrediënten — GEEN herhalingen!):\n${vorigeDagen.map(d => `${d.dag}: ${d.gerechten.join(", ")}`).join("\n")}\n\nBELANGRIJK: Gebruik ANDERE fruit soorten, ANDERE eiwitbronnen, ANDERE snacks dan hierboven. Variatie is cruciaal — niet elke dag dezelfde shake, hetzelfde fruit of dezelfde snack!`
    : "";

  const restjesInfo = Array.isArray(restjes) && restjes.length > 0
    ? `\n\nRESTJES VAN VORIGE WEEK (gebruik deze ingrediënten EERST op, maak er gerechten mee):\n${(restjes as { product: string; hoeveelheid: string }[]).map(r => `- ${r.product}: ${r.hoeveelheid}`).join("\n")}`
    : "";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{
      role: "user",
      content: `Maak een dagplan voor ${dag}.

MACRO TARGETS (STRIKT AANHOUDEN — maximaal 5% afwijking!):
- Calorieën: ${kcal} kcal (NIET meer dan ${Math.round(kcal * 1.05)}, NIET minder dan ${Math.round(kcal * 0.95)})
- Eiwit: ${eiwit}g (MINIMAAL ${Math.round(eiwit * 0.95)}g — dit is de BELANGRIJKSTE macro)
- Koolhydraten: ${koolhydraten}g
- Vet: ${vet}g
- Vezels: ${vezels}g
- Suiker: max ${suiker}g
${voorkeuren ? `\nVoorkeuren: ${voorkeuren}` : ""}${uitsluitingen ? `\nUitsluitingen: ${uitsluitingen}` : ""}${eerderGebruikt}${restjesInfo}

STRUCTUUR — 6 maaltijden per dag:
- **ontbijt** (~${Math.round(kcal * 0.2)} kcal, ~${Math.round(eiwit * 0.15)}g eiwit): havermout, eieren, yoghurt, brood, smoothiebowl, pannenkoeken
- **tussendoor** (~${Math.round(kcal * 0.08)} kcal, ~${Math.round(eiwit * 0.12)}g eiwit): noten, fruit, rijstwafels, eiwitreep, hummus
- **lunch** (~${Math.round(kcal * 0.25)} kcal, ~${Math.round(eiwit * 0.25)}g eiwit): wraps, salades, broodjes, bowl, tosti
- **tussendoor** (~${Math.round(kcal * 0.08)} kcal, ~${Math.round(eiwit * 0.1)}g eiwit): snack
- **avondeten** (~${Math.round(kcal * 0.3)} kcal, ~${Math.round(eiwit * 0.25)}g eiwit): pasta, rijst, wok, curry, ovenschotel
- **avondsnack** (~${Math.round(kcal * 0.09)} kcal, ~${Math.round(eiwit * 0.13)}g eiwit): kwark, shake, noten, yoghurt

REGELS:
1. Tel de macro's van ALLE ingrediënten op en CONTROLEER dat het dagtotaal binnen 5% van de targets valt
2. Eiwit is PRIORITEIT — als je moet kiezen, ga voor meer eiwit
3. Gebruik realistische hoeveelheden en correcte voedingswaarden per 100g
4. Variatie in eiwitbronnen (kip, rund, vis, eieren, zuivel, peulvruchten, noten)
5. Alle producten bij de Lidl verkrijgbaar

Geef per ingrediënt de exacte hoeveelheid en macro's per die hoeveelheid.
dagTotaal = ECHTE som van alle maaltijden (NIET de targets copy-pasten, maar de WERKELIJKE som berekenen!)

JSON (ALLEEN JSON):
{"dag":"${dag}","maaltijden":[{"type":"ontbijt","naam":"...","beschrijving":"...","ingredienten":[{"naam":"Havermout","hoeveelheid":"80g","kcal":296,"eiwit":10,"kh":48,"vet":6,"vezels":8,"suiker":1}],"totaal":{"kcal":521,"eiwit":25,"kh":74,"vet":16,"vezels":12,"suiker":14}}],"dagTotaal":{"kcal":2750,"eiwit":190,"kh":300,"vet":110,"vezels":30,"suiker":55}}`,
    }],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  // Extract JSON by finding balanced braces
  const startIdx = text.indexOf("{");
  if (startIdx === -1) throw new Error(`Geen JSON voor ${dag}`);
  let depth = 0;
  let endIdx = startIdx;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
  }
  const jsonStr = text.slice(startIdx, endIdx + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`[MEALPLAN] JSON parse error voor ${dag}:`, e instanceof Error ? e.message : e, "Raw:", jsonStr.slice(0, 200));
    throw new Error(`Ongeldige JSON voor ${dag}`);
  }
}

// Normalize ingredient names so "Kipfilet", "kipfilet", "Kip filet" all merge
function normalizeIngredient(naam: string): string {
  return naam.toLowerCase().trim()
    .replace(/\s*\(.*?\)\s*/g, "") // remove "(lidl)", "(gekookt)" etc
    .replace(/\s+/g, " ");
}

async function generateBoodschappen(client: Anthropic, dagen: unknown[], restjes?: { product: string; hoeveelheid: string }[]): Promise<{ boodschappenlijst: unknown[]; totaalPrijs: number }> {
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

  // Limit to top 50 ingredients to keep prompt manageable
  const topEntries = entries.slice(0, 50);
  const ingredientenLijstFinal = topEntries
    .map(([naam, { gram, count }], idx) => {
      const kgDisplay = gram >= 1000 ? `${(gram / 1000).toFixed(1)}kg` : `${Math.round(gram)}g`;
      return `${idx + 1}. ${naam} — ${kgDisplay} (${count}x)`;
    })
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    messages: [{
      role: "user",
      content: `Hier zijn de ${topEntries.length} ingrediënten voor mijn weekmenu. Maak een Lidl boodschappenlijst.

${ingredientenLijstFinal}
${restjes?.length ? `\nRESTJES VAN VORIGE WEEK (heb ik al in huis — trek af van wat ik moet kopen!):\n${restjes.map(r => `- ${r.product}: ${r.hoeveelheid}`).join("\n")}\n\nBELANGRIJK: Als ik een ingrediënt al (deels) heb van vorige week, hoef ik MINDER te kopen. Bijv: ik heb 300g rijst over en heb 800g nodig → ik moet maar 500g kopen (1 pak). Als ik genoeg heb, hoef ik het NIET te kopen — zet dan hoeveelheid op "0 (al in huis)" en prijs op 0.\n` : ""}
REGELS:
1. ELKE ingrediënt hierboven MOET terug te vinden zijn in de boodschappenlijst. Sla NIETS over.
2. Gebruik echte Lidl producten en verpakkingsgroottes (bijv. kipfilet 500g pak, havermout 500g pak, melk 1L, eieren doos 10 stuks)
3. Rond ALTIJD OMHOOG af naar hele verpakkingen (1.2kg kip nodig → 3 pakken van 500g)
4. "hoeveelheid" = hoeveel verpakkingen ik moet kopen (bijv. "2 pakken", "3 zakken", "1 doos")
5. "nodig" = hoeveel ik daadwerkelijk gebruik voor de recepten (bijv. "1.2kg", "8 stuks", "350ml")
6. "over" = VERPLICHT — wat er overblijft na de week. BEREKEN DIT ALTIJD: gekocht hoeveelheid minus nodig. Bijv: 3 pakken van 500g = 1500g gekocht, 1200g nodig → "300g" over. Als precies op, zet "0". NOOIT leeg laten!
7. "prijs" = TOTAALPRIJS voor die hoeveelheid verpakkingen
8. "prijsPerEenheid" = prijs per verpakking (bijv. "€5.99/kg", "€1.29/pak", "€2.49/L")
9. Realistische Nederlandse Lidl prijzen (2026). BUDGET: streef naar €20-25/dag MAX (€140-175/week totaal). Kies ALTIJD huismerken en voordeelverpakkingen. Kies seizoensfruit (appel, banaan, mandarijn) boven duur fruit (frambozen, blauwe bessen). Grote verpakkingen waar mogelijk.
10. Combineer vergelijkbare items waar logisch, maar houd vlees/zuivel/granen apart
11. "totaalPrijs" = exacte som van alle "prijs" waarden
12. "overWaarde" = geschatte geldwaarde van wat er overblijft (bijv. als 300g van een 500g pak over is → 60% van de pakprijs)

JSON (ALLEEN JSON, geen tekst):
{"boodschappenlijst":[{"product":"Kipfilet","hoeveelheid":"3 pakken (500g)","nodig":"1.2kg","over":"300g","overWaarde":1.99,"prijs":11.97,"prijsPerEenheid":"€3.99/pak","afdeling":"vlees/vis"}],"totaalPrijs":85.50,"totaalOverWaarde":12.50}`,
    }],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  console.log("[MEALPLAN] Boodschappen response length:", text.length, "chars. Stop reason:", response.stop_reason);

  // Extract JSON by finding balanced braces
  const startIdx = text.indexOf("{");
  if (startIdx === -1) {
    console.error("[MEALPLAN] Geen JSON gevonden in boodschappen response:", text.slice(0, 300));
    return { boodschappenlijst: [], totaalPrijs: 0 };
  }
  let depth = 0;
  let endIdx = startIdx;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
  }
  const jsonStr = text.slice(startIdx, endIdx + 1);

  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch (e) {
    console.error("[MEALPLAN] JSON parse error:", e instanceof Error ? e.message : e, "Raw:", jsonStr.slice(0, 300));
    return { boodschappenlijst: [], totaalPrijs: 0 };
  }

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
    const dagNamen: { dag: string; gerechten: string[] }[] = [];

    for (let i = 0; i < DAGEN.length; i++) {
      const dagData = await generateDay(client, DAGEN[i], params, dagNamen);
      dagen.push(dagData);
      // Extract meal names for variety tracking
      const d = dagData as { maaltijden?: { naam?: string }[] };
      dagNamen.push({ dag: DAGEN[i], gerechten: d.maaltijden?.map(m => m.naam ?? "") ?? [] });
      await dbRun("UPDATE mealplan_cache SET progress = ?", [i + 1]);
    }

    // Shopping list — if it fails, still save the plan without it
    let boodschappenlijst: unknown[] = [];
    let totaalPrijs = 0;
    try {
      const boodschappen = await generateBoodschappen(client, dagen, Array.isArray(params.restjes) ? params.restjes as { product: string; hoeveelheid: string }[] : undefined);
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

// POST — generate plan synchronously and return it
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();

    const params = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ fout: "API key ontbreekt" }, { status: 500 });

    const client = new Anthropic({ apiKey });
    const dagen: unknown[] = [];
    const dagNamen: { dag: string; gerechten: string[] }[] = [];

    for (const dag of DAGEN) {
      const dagData = await generateDay(client, dag, params, dagNamen);
      dagen.push(dagData);
      const d = dagData as { maaltijden?: { naam?: string }[] };
      dagNamen.push({ dag, gerechten: d.maaltijden?.map(m => m.naam ?? "") ?? [] });
    }

    let boodschappenlijst: unknown[] = [];
    let totaalPrijs = 0;
    const restjesParam = Array.isArray(params.restjes) ? params.restjes as { product: string; hoeveelheid: string }[] : undefined;
    // Try up to 2 times
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[MEALPLAN] Boodschappenlijst poging ${attempt + 1}...`);
        const boodschappen = await generateBoodschappen(client, dagen, restjesParam);
        boodschappenlijst = boodschappen.boodschappenlijst;
        totaalPrijs = boodschappen.totaalPrijs;
        console.log(`[MEALPLAN] Boodschappenlijst OK: ${boodschappenlijst.length} items, €${totaalPrijs}`);
        break;
      } catch (e) {
        console.error(`[MEALPLAN] Boodschappenlijst poging ${attempt + 1} mislukt:`, e instanceof Error ? e.message : e);
      }
    }

    const weekTotaal = { kcal: 0, eiwit: 0, kh: 0, vet: 0, vezels: 0, suiker: 0 };
    for (const dag of dagen) {
      const d = dag as { dagTotaal?: { kcal?: number; eiwit?: number; kh?: number; vet?: number; vezels?: number; suiker?: number } };
      if (d.dagTotaal) {
        weekTotaal.kcal += d.dagTotaal.kcal ?? 0;
        weekTotaal.eiwit += d.dagTotaal.eiwit ?? 0;
        weekTotaal.kh += d.dagTotaal.kh ?? 0;
        weekTotaal.vet += d.dagTotaal.vet ?? 0;
        weekTotaal.vezels += d.dagTotaal.vezels ?? 0;
        weekTotaal.suiker += d.dagTotaal.suiker ?? 0;
      }
    }

    const plan = { dagen, boodschappenlijst, totaalPrijs, weekTotaal };

    // Save to cache
    try {
      await dbRun("DELETE FROM mealplan_cache");
      await dbRun("INSERT INTO mealplan_cache (status, plan_json, settings_json, progress) VALUES ('done', ?, ?, 8)", [JSON.stringify(plan), JSON.stringify(params)]);
    } catch { /* save failed but plan is returned */ }

    return NextResponse.json({ status: "done", plan });
  } catch (error) {
    console.error("[MEALPLAN POST] Error:", error);
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: `Weekplan genereren mislukt: ${msg}` }, { status: 500 });
  }
}
