import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// tx#17 details
const tx = await turso.execute("SELECT * FROM bank_transacties WHERE id = 17");
console.log("=== bank_transactie id=17 ===");
console.log(tx.rows[0]);

// Any other bank tx with amount near 12.10
const similar = await turso.execute(
  "SELECT id, datum, merchant_naam, omschrijving, bedrag, bank, storage_url FROM bank_transacties WHERE ABS(bedrag) BETWEEN 10 AND 15 ORDER BY datum DESC"
);
console.log(`\n=== bank_transacties €10-€15 (${similar.rows.length}) ===`);
for (const r of similar.rows) {
  console.log(`  id=${r.id} ${r.datum} €${r.bedrag} ${r.merchant_naam} (${r.bank}) bon=${r.storage_url ? 'ja' : 'nee'}`);
}

// Full inkomende_facturen row id=1
const f = await turso.execute("SELECT * FROM inkomende_facturen WHERE id = 1");
console.log("\n=== inkomende_facturen id=1 (Anthropic Ireland) ===");
console.log(f.rows[0]);
