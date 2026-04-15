// Add all missing columns on facturen table in Turso.
// Drizzle schema (schema.ts) declares these, but migrations were never run.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const migrations = [
  "ALTER TABLE facturen ADD COLUMN pdf_storage_url TEXT",
  "ALTER TABLE facturen ADD COLUMN terugkeer_aantal INTEGER",
  "ALTER TABLE facturen ADD COLUMN terugkeer_eenheid TEXT",
  "ALTER TABLE facturen ADD COLUMN terugkeer_status TEXT",
  "ALTER TABLE facturen ADD COLUMN volgende_factuurdatum TEXT",
  "ALTER TABLE facturen ADD COLUMN bron_factuur_id INTEGER REFERENCES facturen(id)",
];

for (const sql of migrations) {
  try {
    await turso.execute(sql);
    console.log(`✓ ${sql}`);
  } catch (e) {
    if (e.message.includes("duplicate column") || e.message.includes("already exists")) {
      console.log(`· skipped (exists): ${sql}`);
    } else {
      console.error(`✗ FAIL: ${sql}\n  ${e.message}`);
    }
  }
}

// Verify
const cols = await turso.execute("PRAGMA table_info(facturen)");
console.log(`\nfacturen nu heeft ${cols.rows.length} kolommen:`);
console.log(cols.rows.map((c) => c.name).join(", "));
