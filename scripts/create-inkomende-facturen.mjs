// Creates the inkomende_facturen table in Turso. Schema mirrors
// src/lib/db/schema.ts. Safe to re-run — uses IF NOT EXISTS.
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

await turso.execute(`
  CREATE TABLE IF NOT EXISTS inkomende_facturen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leverancier TEXT NOT NULL,
    bedrag REAL NOT NULL,
    btw_bedrag REAL,
    factuurnummer TEXT,
    datum TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    email_id TEXT UNIQUE,
    bank_transactie_id INTEGER REFERENCES bank_transacties(id),
    uitgave_id INTEGER REFERENCES uitgaven(id),
    status TEXT DEFAULT 'onbekoppeld' CHECK (status IN ('gematcht', 'onbekoppeld', 'handmatig_gematcht')),
    verwerk_op TEXT NOT NULL,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )
`);

// Helpful index for the Gmail sync dedupe query
await turso.execute(`CREATE INDEX IF NOT EXISTS idx_inkomende_facturen_email_id ON inkomende_facturen(email_id)`);
await turso.execute(`CREATE INDEX IF NOT EXISTS idx_inkomende_facturen_status ON inkomende_facturen(status)`);
await turso.execute(`CREATE INDEX IF NOT EXISTS idx_inkomende_facturen_datum ON inkomende_facturen(datum)`);

// Verify
const check = await turso.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='inkomende_facturen'"
);
console.log(check.rows.length > 0 ? "✓ inkomende_facturen aangemaakt" : "❌ Aanmaken mislukt");

const columns = await turso.execute("PRAGMA table_info(inkomende_facturen)");
console.log(`\nKolommen (${columns.rows.length}):`);
for (const c of columns.rows) {
  console.log(`  ${c.name}  ${c.type}${c.notnull ? " NOT NULL" : ""}${c.pk ? " PK" : ""}`);
}
