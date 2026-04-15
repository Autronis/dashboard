// Unmatch all incorrectly matched inkomende_facturen. Resets bank_transactie_id
// to null, status to onbekoppeld, and clears storage_url on the previously
// linked bank_transactie so rematch is clean.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Get all matches
const matched = await turso.execute("SELECT id, bank_transactie_id FROM inkomende_facturen WHERE bank_transactie_id IS NOT NULL");
console.log(`Unmatching ${matched.rows.length} incorrect matches...`);

for (const row of matched.rows) {
  // Clear bank_transactie storage_url only if it points back to this factuur
  await turso.execute({
    sql: "UPDATE bank_transacties SET storage_url = NULL WHERE id = ?",
    args: [row.bank_transactie_id],
  });
  // Reset the factuur
  await turso.execute({
    sql: "UPDATE inkomende_facturen SET bank_transactie_id = NULL, status = 'onbekoppeld' WHERE id = ?",
    args: [row.id],
  });
  console.log(`  ✓ factuur#${row.id} unlinked from tx#${row.bank_transactie_id}`);
}

// Manually match Anthropic Ireland ($12.10 USD) → tx#26 CLAUDE (€10.34 EUR)
// Update the factuur bedrag to the actual EUR charge and remove wrong BTW
// (Anthropic Ireland = EU B2B, reverse-charge so no NL BTW).
await turso.execute({
  sql: `UPDATE inkomende_facturen
        SET bank_transactie_id = 26, status = 'handmatig_gematcht',
            bedrag = 10.34, btw_bedrag = 0,
            leverancier = 'Anthropic Ireland (USD factuur, €10.34 na conversie)'
        WHERE id = 1`,
  args: [],
});
await turso.execute({
  sql: `UPDATE bank_transacties
        SET storage_url = '2026/facturen-inkomend/1776195136425_Invoice-9BF0758D-653735.pdf'
        WHERE id = 26`,
  args: [],
});
console.log("\n✓ Anthropic Ireland factuur handmatig aan tx#26 (CLAUDE €10.34) gekoppeld, currency-converted");

console.log("\nStatus:");
const status = await turso.execute("SELECT status, COUNT(*) as n FROM inkomende_facturen GROUP BY status");
for (const r of status.rows) console.log(`  ${r.status}: ${r.n}`);
