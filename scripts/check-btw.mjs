import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Q2 2026 = april 1 → juli 1
const res = await turso.execute(
  "SELECT id, datum, merchant_naam, omschrijving, bedrag, type, bank, btw_bedrag FROM bank_transacties WHERE datum >= '2026-04-01' AND datum < '2026-07-01' AND type='af' ORDER BY datum"
);

console.log(`\n=== Q2 2026 uitgaven (${res.rows.length}) ===\n`);
let totaal = 0;
let totaalBtw = 0;
let zonderBtw = 0;
for (const r of res.rows) {
  const bedrag = Math.abs(Number(r.bedrag));
  const btw = Number(r.btw_bedrag || 0);
  const expected = bedrag / 1.21 * 0.21;
  const mark = btw > 0 ? "✓" : "⚠";
  console.log(`  ${mark} ${r.datum}  €${bedrag.toFixed(2).padStart(8)}  btw:€${btw.toFixed(2).padStart(6)}  (verwacht €${expected.toFixed(2)})  ${r.merchant_naam || r.omschrijving}`);
  totaal += bedrag;
  totaalBtw += btw;
  if (!btw) zonderBtw++;
}

console.log(`\nTotaal uitgaven: €${totaal.toFixed(2)}`);
console.log(`Totaal BTW in DB: €${totaalBtw.toFixed(2)}`);
console.log(`Verwacht totaal BTW (21% over alle): €${(totaal / 1.21 * 0.21).toFixed(2)}`);
console.log(`Zonder btw_bedrag ingevuld: ${zonderBtw} rijen`);
