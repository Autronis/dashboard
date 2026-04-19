// Migration 0011: voeg type kolom toe aan screen_time_samenvattingen
// en vervang unique index op (gebruiker_id, datum) door
// (gebruiker_id, datum, type) zodat dag/week/maand naast elkaar kunnen.
//
// Idempotent: checkt of kolom al bestaat en of index al in juiste vorm is.

import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

if (!process.env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL ontbreekt in .env.local");
  process.exit(1);
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 1. Check of type kolom al bestaat
const cols = await turso.execute("PRAGMA table_info(screen_time_samenvattingen)");
const hasType = cols.rows.some((c) => c.name === "type");

if (hasType) {
  console.log("type kolom bestaat al — skip ALTER");
} else {
  await turso.execute(
    "ALTER TABLE screen_time_samenvattingen ADD COLUMN type TEXT NOT NULL DEFAULT 'dag'"
  );
  console.log("type kolom toegevoegd");
}

// Backfill NULL values (kan gebeuren als kolom eerder zonder DEFAULT is toegevoegd)
const backfill = await turso.execute(
  "UPDATE screen_time_samenvattingen SET type = 'dag' WHERE type IS NULL"
);
if (backfill.rowsAffected > 0) {
  console.log(`backfilled ${backfill.rowsAffected} rijen met type='dag'`);
}

// 2. Drop oude index (als die er nog is)
await turso.execute("DROP INDEX IF EXISTS uniek_gebruiker_datum");
console.log("oude index uniek_gebruiker_datum gedropt (indien aanwezig)");

// 3. Create nieuwe index
await turso.execute(
  "CREATE UNIQUE INDEX IF NOT EXISTS uniek_gebruiker_datum_type ON screen_time_samenvattingen (gebruiker_id, datum, type)"
);
console.log("nieuwe unique index uniek_gebruiker_datum_type aangemaakt");

// 4. Verify
const after = await turso.execute("PRAGMA table_info(screen_time_samenvattingen)");
const typeColumn = after.rows.find((c) => c.name === "type");
console.log(`\nVerified: type kolom = ${typeColumn ? JSON.stringify(typeColumn) : "NIET GEVONDEN"}`);

const indexes = await turso.execute("PRAGMA index_list(screen_time_samenvattingen)");
console.log("Indexes op tabel:");
for (const idx of indexes.rows) {
  console.log(`  - ${idx.name} (unique: ${idx.unique})`);
}

process.exit(0);
