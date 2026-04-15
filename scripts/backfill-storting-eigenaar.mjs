// Backfill: bestaande vermogensstortingen krijgen eigenaar (sem/syb) op
// basis van familie-naam in de omschrijving. Eenmalige run nadat de
// kapitaalrekening feature live ging.
import { createClient } from "@libsql/client";
import fs from "fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const t = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Vind alle stortingen (categorie=vermogen, OR detecteerbaar via naam).
// We scope op type=bij omdat een storting altijd inkomend is.
const stortingen = await t.execute(`
  SELECT id, datum, bedrag, omschrijving, merchant_naam, eigenaar
  FROM bank_transacties
  WHERE type='bij'
    AND (
      categorie='vermogen'
      OR LOWER(omschrijving) LIKE '%gijsberts%'
      OR LOWER(omschrijving) LIKE '%sprenkeler%'
      OR LOWER(merchant_naam) LIKE '%gijsberts%'
      OR LOWER(merchant_naam) LIKE '%sprenkeler%'
    )
`);

console.log(`Found ${stortingen.rows.length} potential stortingen`);
let fixed = 0;
let skipped = 0;
for (const r of stortingen.rows) {
  const haystack = `${r.merchant_naam ?? ""} ${r.omschrijving ?? ""}`.toLowerCase();
  let wie = null;
  if (/\bgijsberts\b/.test(haystack)) wie = "sem";
  else if (/\bsprenkeler\b/.test(haystack)) wie = "syb";

  if (!wie) {
    console.log(`  SKIP id=${r.id}: ambiguous "${haystack.slice(0, 60)}"`);
    skipped++;
    continue;
  }

  if (r.eigenaar === wie) {
    continue; // already correct
  }

  // Ook categorie='vermogen' zetten als die nog leeg is
  await t.execute({
    sql: `UPDATE bank_transacties
          SET eigenaar = ?, categorie = 'vermogen', status = 'gecategoriseerd'
          WHERE id = ?`,
    args: [wie, r.id],
  });
  console.log(`  SET id=${r.id} → eigenaar=${wie} (${r.datum} €${r.bedrag})`);
  fixed++;
}
console.log(`\nDone. Fixed ${fixed}, skipped ${skipped}.`);
process.exit(0);
