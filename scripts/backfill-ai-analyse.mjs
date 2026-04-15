// Backfill: run Claude Haiku analyse on all bank_transacties that don't
// have ai_beschrijving yet. Fills fiscaal_type (investering/kosten/prive),
// ai_beschrijving, is_abonnement, overbodigheid_score, subsidie_mogelijkheden,
// btw_bedrag (only if null) and kia_aftrek (only if null).
//
// Processes in batches of 20 so we don't spam the Anthropic API and can
// see progress.
import { createClient } from "@libsql/client";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function berekenKIA(bedrag) {
  if (bedrag < 2801 || bedrag > 69764) return 0;
  return Math.round(bedrag * 0.28);
}

async function analyse(tx, aantalKeerGezien, gemiddeldBedrag) {
  const prompt = `Analyseer deze banktransactie voor een klein AI-bureau (Autronis). Geef:

1. beschrijving: Korte NL beschrijving (max 1 zin) — wat is het, waarvoor
2. isAbonnement: true/false (merchant komt ${aantalKeerGezien}x voor, gem €${gemiddeldBedrag.toFixed(2)})
3. score: noodzakelijk/nuttig/overbodig voor een AI-bureau
4. fiscaalType: "investering" (hardware, software, apparatuur > €450), "kosten" (operationele uitgaven), of "prive" (persoonlijk)
5. subsidieMogelijkheden: array van regelingen (WBSO/MIA/VAMIL/EIA) of []

Transactie:
- Merchant: ${tx.merchant_naam || tx.omschrijving}
- Bedrag: €${Math.abs(tx.bedrag).toFixed(2)}
- Datum: ${tx.datum}
- Frequentie: ${aantalKeerGezien}x in 90 dagen

Context: Autronis is een AI- en automatiseringsbureau. Zakelijke tools/hosting/AI = noodzakelijk.

Antwoord ALLEEN als JSON:
{"beschrijving":"...","isAbonnement":true/false,"score":"...","fiscaalType":"...","subsidieMogelijkheden":[]}`;

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = res.content[0].type === "text" ? res.content[0].text : "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// Ongeanalyseerde uitgaven, excluding vermogen
const todo = await turso.execute(`
  SELECT id, datum, omschrijving, merchant_naam, bedrag, btw_bedrag, fiscaal_type, kia_aftrek
  FROM bank_transacties
  WHERE type = 'af'
    AND ai_beschrijving IS NULL
    AND (categorie IS NULL OR categorie != 'vermogen')
  ORDER BY datum DESC
`);

console.log(`\n${todo.rows.length} transacties te analyseren\n`);

let done = 0;
for (const tx of todo.rows) {
  // Frequentie
  const fq = await turso.execute({
    sql: `SELECT COUNT(*) as aantal, AVG(ABS(bedrag)) as gem
          FROM bank_transacties
          WHERE type = 'af'
            AND (merchant_naam = ? OR omschrijving = ?)
            AND datum >= date('now', '-90 days')`,
    args: [tx.merchant_naam || tx.omschrijving, tx.merchant_naam || tx.omschrijving],
  });
  const aantal = Number(fq.rows[0]?.aantal ?? 1);
  const gem = Number(fq.rows[0]?.gem ?? Math.abs(tx.bedrag));

  try {
    const a = await analyse(tx, aantal, gem);
    if (!a) {
      console.log(`  ✗ tx#${tx.id} ${tx.merchant_naam || tx.omschrijving} — geen JSON response`);
      continue;
    }

    const fiscaalType = a.fiscaalType ?? "kosten";
    const btwCalc = fiscaalType !== "prive"
      ? Math.round((Math.abs(tx.bedrag) / 1.21) * 0.21 * 100) / 100
      : 0;
    const kia = fiscaalType === "investering" ? berekenKIA(Math.abs(tx.bedrag)) : 0;

    const sets = ["ai_beschrijving = ?", "is_abonnement = ?", "overbodigheid_score = ?", "subsidie_mogelijkheden = ?"];
    const args = [
      a.beschrijving,
      a.isAbonnement ? 1 : 0,
      a.score,
      JSON.stringify(a.subsidieMogelijkheden ?? []),
    ];

    // Alleen vullen wat nog leeg is
    if (tx.fiscaal_type == null) { sets.push("fiscaal_type = ?"); args.push(fiscaalType); }
    if (tx.btw_bedrag == null) { sets.push("btw_bedrag = ?"); args.push(btwCalc); }
    if (tx.kia_aftrek == null) { sets.push("kia_aftrek = ?"); args.push(kia); }

    args.push(tx.id);
    await turso.execute({
      sql: `UPDATE bank_transacties SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });
    done++;
    console.log(`  ✓ tx#${tx.id} ${tx.merchant_naam || tx.omschrijving} → ${fiscaalType} (${a.beschrijving})`);
  } catch (e) {
    console.log(`  ✗ tx#${tx.id} ${tx.merchant_naam || tx.omschrijving} — ${e.message}`);
  }
}

console.log(`\n✓ ${done} / ${todo.rows.length} geanalyseerd`);
