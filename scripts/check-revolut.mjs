import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// All bank transactions grouped by bank
const res = await turso.execute(
  "SELECT datum, merchant_naam, omschrijving, bedrag, type, bank FROM bank_transacties ORDER BY datum DESC"
);
console.log(`\nTotaal bank_transacties: ${res.rows.length}\n`);

const byBank = {};
for (const r of res.rows) {
  const bank = r.bank || "(onbekend)";
  if (!byBank[bank]) byBank[bank] = [];
  byBank[bank].push(r);
}

for (const bank of Object.keys(byBank).sort()) {
  console.log(`\n=== ${bank} (${byBank[bank].length}) ===`);
  for (const r of byBank[bank]) {
    const sign = r.type === "af" ? "-" : "+";
    console.log(`  ${r.datum}  ${sign}€${Number(r.bedrag).toFixed(2).padStart(8)}  ${r.merchant_naam || r.omschrijving}`);
  }
}
