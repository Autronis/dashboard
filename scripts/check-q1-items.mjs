import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// 1. Check bank_transacties for jan/feb/mrt
const bankJan = await turso.execute(
  "SELECT id, datum, merchant_naam, omschrijving, bedrag, bank FROM bank_transacties WHERE datum >= '2026-01-01' AND datum < '2026-04-01' ORDER BY datum"
);
console.log(`\n=== bank_transacties Q1 2026 (${bankJan.rows.length}) ===`);
for (const r of bankJan.rows) {
  console.log(`  ${r.datum}  €${Number(r.bedrag).toFixed(2).padStart(8)}  ${r.merchant_naam || r.omschrijving}  (${r.bank})`);
}

// 2. Check uitgaven table (schema says it exists)
try {
  const uitgaven = await turso.execute(
    "SELECT id, datum, leverancier, bedrag, categorie FROM uitgaven WHERE datum >= '2026-01-01' AND datum < '2026-04-01' ORDER BY datum"
  );
  console.log(`\n=== uitgaven Q1 2026 (${uitgaven.rows.length}) ===`);
  for (const r of uitgaven.rows) {
    console.log(`  ${r.datum}  €${Number(r.bedrag).toFixed(2).padStart(8)}  ${r.leverancier}  (${r.categorie})`);
  }
} catch (e) {
  console.log(`\n(uitgaven query mislukt: ${e.message})`);
}

// 3. Check if Lovable/Google Workspace/Praxis exists at all
const keywords = ['Lovable', 'Google Workspace', 'Praxis', 'Megekko', 'Hostnet', 'Leen Bakker', 'Toolstation'];
console.log(`\n=== Zoeken op keywords ===`);
for (const kw of keywords) {
  const r1 = await turso.execute({
    sql: "SELECT COUNT(*) as n FROM bank_transacties WHERE merchant_naam LIKE ? OR omschrijving LIKE ?",
    args: [`%${kw}%`, `%${kw}%`],
  });
  console.log(`  bank_transacties like "${kw}": ${r1.rows[0].n}`);
}
