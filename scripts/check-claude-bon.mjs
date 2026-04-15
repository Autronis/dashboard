import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// 1. CLAUDE bank_transactie
const tx = await turso.execute(
  "SELECT id, datum, merchant_naam, omschrijving, bedrag, storage_url, bon_pad FROM bank_transacties WHERE UPPER(merchant_naam) LIKE '%CLAUDE%' OR UPPER(merchant_naam) LIKE '%ANTHROPIC%' ORDER BY datum DESC"
);
console.log(`\n=== bank_transacties CLAUDE/Anthropic (${tx.rows.length}) ===`);
for (const r of tx.rows) {
  const heeftBon = r.storage_url || r.bon_pad ? "✓ BON" : "✗ geen bon";
  console.log(`  id=${r.id} ${r.datum} €${r.bedrag} ${r.merchant_naam} → ${heeftBon}`);
  if (r.storage_url) console.log(`      storage_url: ${r.storage_url}`);
}

// 2. Inkomende facturen CLAUDE/Anthropic
const inv = await turso.execute(
  "SELECT id, datum, leverancier, bedrag, status, bank_transactie_id, storage_url FROM inkomende_facturen WHERE UPPER(leverancier) LIKE '%CLAUDE%' OR UPPER(leverancier) LIKE '%ANTHROPIC%' ORDER BY datum DESC"
);
console.log(`\n=== inkomende_facturen CLAUDE/Anthropic (${inv.rows.length}) ===`);
for (const r of inv.rows) {
  console.log(`  id=${r.id} ${r.datum} €${r.bedrag} ${r.leverancier} status=${r.status} bank_tx=${r.bank_transactie_id ?? 'null'}`);
  if (r.storage_url) console.log(`      pdf: ${r.storage_url}`);
}
