import { createClient } from "@libsql/client";
import fs from "fs";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const t = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Schema check
const cols = await t.execute("PRAGMA table_info(bank_transacties)");
const names = cols.rows.map(r => r.name);
console.log("eigenaar kolom:", names.includes("eigenaar"));
console.log("split_ratio kolom:", names.includes("split_ratio"));

// Data check
const eigSummary = await t.execute(`
  SELECT eigenaar, COUNT(*) as n, ROUND(SUM(ABS(bedrag)), 2) as totaal
  FROM bank_transacties WHERE type='af' GROUP BY eigenaar
`);
console.log("\nUitgaven per eigenaar:");
for (const r of eigSummary.rows) console.log(" ", r.eigenaar ?? "(geen)", r.n, "tx", "€" + r.totaal);

// Stortingen — inkomende type=bij met categorie=vermogen
const stortingen = await t.execute(`
  SELECT id, datum, omschrijving, merchant_naam, bedrag, categorie, eigenaar
  FROM bank_transacties
  WHERE type='bij' AND (categorie='vermogen' OR LOWER(omschrijving) LIKE '%gijsberts%' OR LOWER(omschrijving) LIKE '%sprenkeler%' OR LOWER(merchant_naam) LIKE '%gijsberts%' OR LOWER(merchant_naam) LIKE '%sprenkeler%')
  ORDER BY datum
`);
console.log("\nStortingen gevonden:", stortingen.rows.length);
for (const r of stortingen.rows) console.log(" ", r.datum, "€"+r.bedrag, "—", r.omschrijving?.slice(0,60), "→ eigenaar:", r.eigenaar ?? "(geen)");
