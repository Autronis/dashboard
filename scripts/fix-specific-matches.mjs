// Fix specific misread / misclassified facturen:
//  - Rinkel BV €10 → €12,10 (Vision misread), link to tx#17
//  - Autronis uitgaande facturen → delete from inkomende_facturen
//    (they belong in the `facturen` table, not here)
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// 1. Fix Rinkel: corrigeer bedrag en koppel aan tx#17
const rinkel = await turso.execute(
  "SELECT id, storage_url FROM inkomende_facturen WHERE leverancier LIKE '%Rinkel%' AND status = 'onbekoppeld'"
);
if (rinkel.rows.length > 0) {
  const f = rinkel.rows[0];
  await turso.execute({
    sql: `UPDATE inkomende_facturen
          SET bedrag = 12.10, btw_bedrag = 2.10,
              bank_transactie_id = 17, status = 'handmatig_gematcht'
          WHERE id = ?`,
    args: [f.id],
  });
  if (f.storage_url) {
    await turso.execute({
      sql: "UPDATE bank_transacties SET storage_url = ? WHERE id = 17",
      args: [f.storage_url],
    });
  }
  console.log(`✓ Rinkel factuur #${f.id} bedrag gecorrigeerd naar €12,10 en gekoppeld aan tx#17`);
}

// 2. Verwijder Autronis uitgaande facturen uit inkomende_facturen
const autronis = await turso.execute(
  "SELECT id, leverancier, bedrag FROM inkomende_facturen WHERE leverancier LIKE '%Autronis%'"
);
console.log(`\n${autronis.rows.length} Autronis rijen gevonden in inkomende_facturen:`);
for (const r of autronis.rows) {
  console.log(`  id=${r.id} €${r.bedrag} — ${r.leverancier}`);
}
if (autronis.rows.length > 0) {
  await turso.execute({
    sql: "DELETE FROM inkomende_facturen WHERE leverancier LIKE '%Autronis%'",
    args: [],
  });
  console.log(`✓ ${autronis.rows.length} Autronis rijen verwijderd uit inkomende_facturen`);
}

// 3. Final status
const counts = await turso.execute(
  "SELECT status, COUNT(*) as n FROM inkomende_facturen GROUP BY status"
);
console.log("\nFinale status inkomende_facturen:");
for (const r of counts.rows) console.log(`  ${r.status}: ${r.n}`);
