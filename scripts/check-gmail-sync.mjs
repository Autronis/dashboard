// Check Gmail sync state: is Gmail connected, how many invoices are in the DB,
// and how many are matched to bank transactions.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 1. Gmail OAuth token
const tokens = await turso.execute(
  "SELECT id, calendar_id, expires_at, bijgewerkt_op FROM google_tokens WHERE calendar_id = 'gmail' LIMIT 1"
);
console.log("\n=== Gmail OAuth ===");
if (tokens.rows.length === 0) {
  console.log("  ❌ Gmail NIET gekoppeld (geen token met calendar_id='gmail')");
} else {
  const t = tokens.rows[0];
  const expired = new Date(t.expires_at).getTime() < Date.now();
  console.log(`  ✓ Gmail gekoppeld (id=${t.id})`);
  console.log(`    token expires: ${t.expires_at} ${expired ? "(EXPIRED — refresh bij volgende call)" : "(valid)"}`);
  console.log(`    laatst bijgewerkt: ${t.bijgewerkt_op}`);
}

// 2. Inkomende facturen
const facturen = await turso.execute(
  "SELECT id, leverancier, bedrag, datum, status, bank_transactie_id, verwerk_op FROM inkomende_facturen ORDER BY datum DESC LIMIT 20"
);
const counts = await turso.execute(
  "SELECT status, COUNT(*) as n FROM inkomende_facturen GROUP BY status"
);

console.log("\n=== Inkomende facturen (PDF bonnen) ===");
console.log(`  Totaal: ${facturen.rows.length > 0 ? "(zie laatste 20)" : "0"}`);
for (const c of counts.rows) {
  console.log(`  ${c.status}: ${c.n}`);
}

if (facturen.rows.length > 0) {
  console.log("\n  Laatste 20:");
  for (const f of facturen.rows) {
    const match = f.bank_transactie_id ? `→ tx#${f.bank_transactie_id}` : "(geen match)";
    console.log(`    ${f.datum}  €${Number(f.bedrag).toFixed(2).padStart(8)}  ${String(f.leverancier).padEnd(30)}  ${f.status}  ${match}`);
  }
}

// 3. Bank transacties met gekoppelde bon (storageUrl OR bonPad)
const metBon = await turso.execute(
  "SELECT COUNT(*) as n FROM bank_transacties WHERE storage_url IS NOT NULL OR bon_pad IS NOT NULL"
);
const zonderBon = await turso.execute(
  "SELECT COUNT(*) as n FROM bank_transacties WHERE type = 'af' AND storage_url IS NULL AND bon_pad IS NULL"
);
console.log("\n=== Bank transacties ↔ bon koppeling ===");
console.log(`  Met bon: ${metBon.rows[0].n}`);
console.log(`  Uitgaves zonder bon: ${zonderBon.rows[0].n}`);
