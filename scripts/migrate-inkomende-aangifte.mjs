// Add verwerkt_in_aangifte on inkomende_facturen + backfill all March 2026
// rows as Q1-2026 (Sem heeft Higgsfield/Anthropic/Zoho/Google Workspace
// al ingediend in zijn Q1 aangifte). April 2026+ items blijven ongemoeid
// zodat ze in Q2 meetellen.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  await turso.execute("ALTER TABLE inkomende_facturen ADD COLUMN verwerkt_in_aangifte TEXT");
  console.log("✓ kolom inkomende_facturen.verwerkt_in_aangifte toegevoegd");
} catch (e) {
  if (/duplicate column|already exists/i.test(e.message)) {
    console.log("· kolom bestond al");
  } else { throw e; }
}

// Backfill: alle Q1-2026 rows (datum < 2026-04-01)
const r = await turso.execute({
  sql: `UPDATE inkomende_facturen
        SET verwerkt_in_aangifte = 'Q1-2026'
        WHERE datum < '2026-04-01'
          AND verwerkt_in_aangifte IS NULL`,
  args: [],
});
console.log(`✓ ${r.rowsAffected} inkomende_facturen gemarkeerd als Q1-2026`);

// Verify
const check = await turso.execute(
  "SELECT verwerkt_in_aangifte, COUNT(*) as n FROM inkomende_facturen GROUP BY verwerkt_in_aangifte"
);
console.log("\nStatus inkomende_facturen:");
for (const row of check.rows) {
  console.log(`  ${row.verwerkt_in_aangifte ?? "(nog te verwerken, = Q2)"}: ${row.n}`);
}
