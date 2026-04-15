// Smoke-test the schema drift detector against Turso without starting
// Next.js. Imports schema.ts via a TypeScript loader workaround — we
// replicate the detector logic inline in JS so we don't need tsx.
//
// This also serves as a one-shot ALTER for any remaining drift that the
// db/index.ts auto-migrate would catch at next server start — running it
// now applies fixes immediately.
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

// Parse schema.ts for table definitions. Simple regex-based — works because
// schema.ts uses consistent `sqliteTable("name", {...})` syntax.
const schemaText = fs.readFileSync(
  new URL("../src/lib/db/schema.ts", import.meta.url),
  "utf8"
);

const tables = [];
const tableRe = /export const (\w+)\s*=\s*sqliteTable\(\s*"(\w+)"\s*,\s*\{([\s\S]*?)\n\}\s*(?:,\s*\([\s\S]*?\))?\s*\);/g;
let match;
while ((match = tableRe.exec(schemaText))) {
  const [, exportName, tableName, bodyRaw] = match;
  const columns = [];
  // Match column definitions: `name: text("col_name")`, `integer("col_name")`, etc.
  const colRe = /(\w+):\s*(text|integer|real|blob|numeric)\s*\(\s*"(\w+)"(?:\s*,\s*\{[^}]*\})?\s*\)/g;
  let cm;
  while ((cm = colRe.exec(bodyRaw))) {
    const [, , typeDr, colName] = cm;
    const sqlType =
      typeDr === "integer" ? "INTEGER" :
      typeDr === "text" ? "TEXT" :
      typeDr === "real" ? "REAL" :
      typeDr === "blob" ? "BLOB" :
      "NUMERIC";
    columns.push({ name: colName, type: sqlType });
  }
  tables.push({ exportName, tableName, columns });
}

console.log(`Schema heeft ${tables.length} tabellen, totaal ${tables.reduce((s, t) => s + t.columns.length, 0)} kolommen\n`);

let totalApplied = 0;
let totalErrors = 0;

for (const table of tables) {
  let info;
  try {
    info = await turso.execute(`PRAGMA table_info("${table.tableName}")`);
  } catch (e) {
    console.error(`✗ PRAGMA ${table.tableName}: ${e.message}`);
    continue;
  }

  if (info.rows.length === 0) {
    console.log(`· ${table.tableName}: tabel niet aanwezig (skip — aparte CREATE nodig)`);
    continue;
  }

  const existing = new Set(info.rows.map((r) => r.name));
  const missing = table.columns.filter((c) => !existing.has(c.name));

  if (missing.length === 0) continue;

  console.log(`⚠ ${table.tableName}: ${missing.length} ontbrekende kolom(men)`);
  for (const col of missing) {
    const sql = `ALTER TABLE "${table.tableName}" ADD COLUMN "${col.name}" ${col.type}`;
    try {
      await turso.execute(sql);
      console.log(`  ✓ ${col.name} (${col.type})`);
      totalApplied++;
    } catch (e) {
      if (/duplicate column|already exists/i.test(e.message)) {
        console.log(`  · ${col.name} (bestond al)`);
      } else {
        console.error(`  ✗ ${col.name}: ${e.message}`);
        totalErrors++;
      }
    }
  }
}

console.log(`\n${totalApplied} kolommen toegevoegd, ${totalErrors} fouten`);
