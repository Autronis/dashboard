// Dup de /api/administratie route query exact zoals drizzle hem zou doen.
// Gebruikt rauwe SQL om te zien welke kolommen drizzle select-t.
import { createClient } from "@libsql/client";
import fs from "fs";

const envFile = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// 1. SELECT * FROM facturen — should work
try {
  const res = await turso.execute({
    sql: "SELECT * FROM facturen WHERE pdf_storage_url IS NOT NULL AND factuurdatum >= '2026-01-01' AND factuurdatum <= '2026-12-31'",
    args: [],
  });
  console.log(`✓ facturen query: ${res.rows.length} rows`);
} catch (e) {
  console.error("✗ facturen query FAIL:", e.message);
}

// 2. inkomende_facturen
try {
  const res = await turso.execute({
    sql: "SELECT * FROM inkomende_facturen WHERE datum >= '2026-01-01' AND datum <= '2026-12-31'",
    args: [],
  });
  console.log(`✓ inkomende_facturen: ${res.rows.length} rows`);
} catch (e) {
  console.error("✗ inkomende_facturen FAIL:", e.message);
}

// 3. bank_transacties bonnetjes
try {
  const res = await turso.execute({
    sql: "SELECT * FROM bank_transacties WHERE storage_url IS NOT NULL AND storage_url LIKE '%/bonnetjes/%' AND datum >= '2026-01-01' AND datum <= '2026-12-31'",
    args: [],
  });
  console.log(`✓ bank_transacties bonnetjes: ${res.rows.length} rows`);
} catch (e) {
  console.error("✗ bank_transacties FAIL:", e.message);
}

// 4. COUNT onbekoppeld
try {
  const res = await turso.execute("SELECT COUNT(*) as count FROM inkomende_facturen WHERE status = 'onbekoppeld'");
  console.log(`✓ onbekoppeld count: ${res.rows[0].count}`);
} catch (e) {
  console.error("✗ onbekoppeld count FAIL:", e.message);
}

// 5. Check all schema columns from schema.ts — zie of `facturen` schema alle verwachte kolommen heeft
const cols = await turso.execute("PRAGMA table_info(facturen)");
const names = cols.rows.map((c) => c.name);
console.log(`\nfacturen kolommen in Turso: ${names.join(', ')}`);

// Verwachte uit schema.ts
const expected = [
  "id", "klant_id", "project_id", "factuurnummer", "status", "bedrag_excl_btw",
  "btw_percentage", "btw_bedrag", "bedrag_incl_btw", "factuurdatum", "vervaldatum",
  "betaald_op", "is_terugkerend", "terugkeer_interval", "notities", "is_actief",
  "aangemaakt_door", "aangemaakt_op", "bijgewerkt_op", "pdf_storage_url",
];
const missing = expected.filter((e) => !names.includes(e));
if (missing.length > 0) {
  console.log(`\n⚠️  MISSING columns in Turso: ${missing.join(', ')}`);
} else {
  console.log(`\n✓ alle verwachte kolommen aanwezig`);
}
