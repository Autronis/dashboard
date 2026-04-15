// Re-analyse transactions with the improved prompt + PDF Vision reading.
//
// Targets:
//   1. Transactions with storage_url → re-run with Claude Sonnet Vision so
//      the actual invoice lines are used.
//   2. Transactions flagged as "prive" where the merchant is a hardware /
//      office supplier → reset and re-analyse with conservative prompt.
import { createClient } from "@libsql/client";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as supaCreate } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = supaCreate(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = "administratie";

const SYSTEM = `Je analyseert banktransacties voor Autronis, een klein AI- en automatiseringsbureau (ZZP/VOF).

Belangrijke regels:
- Autronis koopt veel hardware, software, kabels, monitoren, kantoorspullen via Coolblue, Temu, Action, Kruidvat, Kabelshop, Hornbach, etc. Dit zijn ZAKELIJKE uitgaven zolang er geen duidelijke privé-indicatie is.
- Markeer ALLEEN als "prive" wanneer het overduidelijk persoonlijk is (fast food, supermarkt voedsel, persoonlijke verzorging, streaming thuisgebruik).
- Bij twijfel: "kosten" (niet "prive"). Autronis markeert desnoods zelf achteraf als privé.
- "investering" is voor individuele posten >€450 aan hardware, software licenties, apparatuur.`;

function parseJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function analyseWithPdf(tx, storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`Download failed: ${error.message}`);
  const ab = await data.arrayBuffer();
  const base64 = Buffer.from(ab).toString("base64");

  const prompt = `Bijgevoegd: een factuur of bonnetje. Lees de regels en zeg exact wat er is gekocht.

Bank tx context:
- Merchant op bank: ${tx.merchant_naam || tx.omschrijving}
- Bedrag: €${Math.abs(tx.bedrag).toFixed(2)}
- Datum: ${tx.datum}

Geef als JSON:
{"beschrijving":"1 NL zin met daadwerkelijke producten uit de factuurregels, max 120 chars","isAbonnement":true/false,"score":"noodzakelijk|nuttig|overbodig","fiscaalType":"investering|kosten|prive","subsidieMogelijkheden":[]}

Alleen JSON.`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }, title: storagePath.split("/").pop() },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  return parseJson(raw);
}

async function analyseMerchant(tx, aantal, gem) {
  const prompt = `Analyseer deze banktransactie.

- Merchant: ${tx.merchant_naam || tx.omschrijving}
- Omschrijving: ${tx.omschrijving}
- Bedrag: €${Math.abs(tx.bedrag).toFixed(2)}
- Datum: ${tx.datum}
- Frequentie: ${aantal}x in 90 dagen (gem €${gem.toFixed(2)})

Geef als JSON:
{"beschrijving":"Korte specifieke NL beschrijving","isAbonnement":true/false,"score":"noodzakelijk|nuttig|overbodig","fiscaalType":"investering|kosten|prive","subsidieMogelijkheden":[]}

Alleen JSON.`;

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
  return parseJson(raw);
}

// Targets:
//  A) alle tx met storage_url (her-analyse met PDF)
//  B) alle tx die als prive zijn gemarkeerd maar niet vermogen
const metPdf = await turso.execute(`
  SELECT id, datum, omschrijving, merchant_naam, bedrag, storage_url, fiscaal_type
  FROM bank_transacties
  WHERE type = 'af' AND storage_url IS NOT NULL
`);
const privé = await turso.execute(`
  SELECT id, datum, omschrijving, merchant_naam, bedrag, storage_url, fiscaal_type
  FROM bank_transacties
  WHERE type = 'af' AND fiscaal_type = 'prive'
    AND (categorie IS NULL OR categorie != 'vermogen')
`);

const seen = new Set();
const targets = [];
for (const r of metPdf.rows) { if (!seen.has(r.id)) { seen.add(r.id); targets.push(r); } }
for (const r of privé.rows) { if (!seen.has(r.id)) { seen.add(r.id); targets.push(r); } }

console.log(`\n${targets.length} transacties te her-analyseren (${metPdf.rows.length} met PDF, ${privé.rows.length} prive)\n`);

let done = 0;
for (const tx of targets) {
  let result = null;
  let bron = "merchant";

  if (tx.storage_url) {
    try {
      result = await analyseWithPdf(tx, tx.storage_url);
      bron = "pdf";
    } catch (e) {
      console.log(`  ⚠ tx#${tx.id} PDF read fail: ${e.message} — fallback merchant`);
    }
  }

  if (!result) {
    const fq = await turso.execute({
      sql: `SELECT COUNT(*) as aantal, AVG(ABS(bedrag)) as gem FROM bank_transacties
            WHERE type='af' AND (merchant_naam = ? OR omschrijving = ?)
            AND datum >= date('now', '-90 days')`,
      args: [tx.merchant_naam || tx.omschrijving, tx.merchant_naam || tx.omschrijving],
    });
    result = await analyseMerchant(
      tx,
      Number(fq.rows[0]?.aantal ?? 1),
      Number(fq.rows[0]?.gem ?? Math.abs(tx.bedrag))
    );
  }

  if (!result) {
    console.log(`  ✗ tx#${tx.id} ${tx.merchant_naam || tx.omschrijving}`);
    continue;
  }

  await turso.execute({
    sql: `UPDATE bank_transacties
          SET ai_beschrijving = ?, fiscaal_type = ?, is_abonnement = ?,
              overbodigheid_score = ?, subsidie_mogelijkheden = ?
          WHERE id = ?`,
    args: [
      result.beschrijving,
      result.fiscaalType ?? "kosten",
      result.isAbonnement ? 1 : 0,
      result.score ?? "nuttig",
      JSON.stringify(result.subsidieMogelijkheden ?? []),
      tx.id,
    ],
  });
  done++;
  console.log(`  ✓ [${bron}] tx#${tx.id} ${tx.merchant_naam || tx.omschrijving} → ${result.fiscaalType}`);
  console.log(`      "${result.beschrijving}"`);
}

console.log(`\n✓ ${done} / ${targets.length} her-geanalyseerd`);
