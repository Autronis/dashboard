// Backfill: bank_transacties.storage_url voor tx'en die al via een
// inkomende_facturen rij gekoppeld zijn maar waar oudere matchers de
// bank-kant niet bijwerkten. Hierdoor telde Documentdekking ze als
// "zonder bon".
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const linked = await turso.execute(`
  SELECT i.id AS factuur_id, i.bank_transactie_id, i.storage_url
  FROM inkomende_facturen i
  WHERE i.bank_transactie_id IS NOT NULL
    AND i.storage_url IS NOT NULL
`);

console.log(`Found ${linked.rows.length} linked inkomende facturen with PDF`);
let backfilled = 0;
for (const row of linked.rows) {
  const txRes = await turso.execute({
    sql: "SELECT storage_url FROM bank_transacties WHERE id = ?",
    args: [row.bank_transactie_id],
  });
  const tx = txRes.rows[0];
  if (tx && !tx.storage_url) {
    await turso.execute({
      sql: "UPDATE bank_transacties SET storage_url = ?, status = 'gematcht' WHERE id = ?",
      args: [row.storage_url, row.bank_transactie_id],
    });
    backfilled++;
    console.log(`  Backfilled bank_tx ${row.bank_transactie_id} ← inkomende_factuur ${row.factuur_id}`);
  }
}
console.log(`Done. Backfilled ${backfilled} bank transactions.`);
process.exit(0);
